import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    console.log('Print Markdown extension is active!');

    let disposable = vscode.commands.registerCommand('printMD.print', async () => {
        // Try to get the markdown file from active editor, visible editors, or all open documents
        let mdDocument: vscode.TextDocument | undefined;
        
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
            mdDocument = editor.document;
        } else {
            // If called from preview, find the corresponding markdown file
            // First check all visible text editors for a markdown file
            const mdEditors = vscode.window.visibleTextEditors.filter(
                e => e.document.languageId === 'markdown'
            );
            if (mdEditors.length > 0) {
                mdDocument = mdEditors[0].document;
            } else {
                // Check all open documents (including those not currently visible)
                const mdDocs = vscode.workspace.textDocuments.filter(
                    doc => doc.languageId === 'markdown' && !doc.isUntitled
                );
                if (mdDocs.length > 0) {
                    mdDocument = mdDocs[0];
                }
            }
        }

        if (!mdDocument) {
            vscode.window.showErrorMessage('No markdown file found to print. Please open a markdown file.');
            return;
        }

        try {
            vscode.window.showInformationMessage(`Rendering ${path.basename(mdDocument.fileName)}...`);

            // Use VS Code's built-in markdown rendering
            const html = await vscode.commands.executeCommand<string>(
                'markdown.api.render',
                mdDocument.getText()
            );

            if (!html) {
                vscode.window.showErrorMessage('Failed to render markdown content.');
                return;
            }

            // Create a complete HTML document with print-friendly styling
            const fullHtml = createPrintableHtml(html, path.basename(mdDocument.fileName));

            // Save HTML to temp file
            const tempDir = context.globalStorageUri.fsPath;
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const htmlPath = path.join(tempDir, 'print-preview.html');
            const pdfPath = path.join(tempDir, 'print-output.pdf');
            
            fs.writeFileSync(htmlPath, fullHtml, 'utf-8');

            // Show preview in webview
            const panel = vscode.window.createWebviewPanel(
                'markdownPrintPreview',
                `Print Preview: ${path.basename(mdDocument.fileName)}`,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true
                }
            );

            // Add print button to the HTML
            const previewHtml = addPrintButton(fullHtml);
            panel.webview.html = previewHtml;

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async message => {
                    if (message.command === 'print') {
                        vscode.window.showInformationMessage(`Printing ${path.basename(mdDocument.fileName)}...`);

                        // Convert HTML to PDF and print using Python script
                        const pythonEngine = path.join(context.extensionPath, 'src', 'printMD.py');
                        
                        const pyProc = spawn('python', [
                            `"${pythonEngine}"`,
                            '--html',
                            `"${htmlPath}"`,
                            '--pdf',
                            `"${pdfPath}"`
                        ], { shell: true });

                        let errorOutput = '';

                        pyProc.stdout.on('data', (data) => {
                            const output = data.toString();
                            console.log(`stdout: ${output}`);
                        });

                        pyProc.stderr.on('data', (data) => {
                            errorOutput += data.toString();
                            console.error(`stderr: ${data}`);
                        });

                        pyProc.on('close', (code) => {
                            panel.dispose();
                            if (code === 0) {
                                vscode.window.showInformationMessage(`Print job completed for ${path.basename(mdDocument.fileName)}`);
                            } else {
                                vscode.window.showErrorMessage(`Printing failed (exit code ${code})\n${errorOutput}`);
                            }
                        });
                    } else if (message.command === 'cancel') {
                        panel.dispose();
                        vscode.window.showInformationMessage('Print cancelled.');
                    }
                },
                undefined,
                context.subscriptions
            );

        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

function createPrintableHtml(bodyHtml: string, title: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        @page {
            size: Letter;
            margin: 0.75in;
        }
        
        /* Page simulation for preview */
        @media screen {
            body {
                background: #525252;
                padding: 20px;
            }
            
            .page-container {
                background: white;
                width: 8.5in;
                min-height: 11in;
                margin: 0 auto 0.5in auto;
                padding: 0.75in;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                box-sizing: border-box;
            }
            
            .page-container:last-child {
                margin-bottom: 0;
            }
        }
        
        /* Print styles */
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .page-container {
                width: auto;
                min-height: auto;
                margin: 0;
                padding: 0;
                box-shadow: none;
                page-break-after: always;
            }
            
            .page-container:last-child {
                page-break-after: auto;
            }
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #24292f;
            margin: 0;
        }
        
        .content {
            max-width: 100%;
        }
        
        /* Headers */
        h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
            line-height: 1.25;
            page-break-after: avoid;
        }
        
        h1 { font-size: 20pt; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
        h2 { font-size: 16pt; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
        h3 { font-size: 14pt; }
        h4 { font-size: 12pt; }
        
        /* Code blocks */
        code {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 10pt;
            background-color: rgba(175, 184, 193, 0.2);
            padding: 0.2em 0.4em;
            border-radius: 3px;
        }
        
        pre {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 10pt;
            background-color: #f6f8fa;
            border-radius: 6px;
            padding: 1em;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        
        pre code {
            background-color: transparent;
            padding: 0;
        }
        
        /* Lists */
        ul, ol {
            padding-left: 2em;
            margin: 0.5em 0;
        }
        
        li {
            margin: 0.25em 0;
        }
        
        /* Tables */
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
            page-break-inside: avoid;
        }
        
        th, td {
            border: 1px solid #d0d7de;
            padding: 0.4em 0.8em;
            text-align: left;
        }
        
        th {
            background-color: #f6f8fa;
            font-weight: 600;
        }
        
        /* Links */
        a {
            color: #0969da;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* Blockquotes */
        blockquote {
            border-left: 4px solid #d0d7de;
            padding-left: 1em;
            margin-left: 0;
            color: #57606a;
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
        }
        
        /* Horizontal rules */
        hr {
            border: none;
            border-top: 1px solid #d0d7de;
            margin: 1.5em 0;
        }
        
        /* Avoid page breaks inside elements */
        h1, h2, h3, h4, h5, h6, pre, table, blockquote {
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
<div class="page-container">
<div class="content">
${bodyHtml}
</div>
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function addPrintButton(html: string): string {
    // Add a floating print toolbar to the HTML
    const toolbar = `
    <style>
        .print-toolbar {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: white;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            gap: 10px;
        }
        
        .print-toolbar button {
            padding: 8px 16px;
            font-size: 14px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        .print-toolbar button.print-btn {
            background: #0969da;
            color: white;
        }
        
        .print-toolbar button.print-btn:hover {
            background: #0550ae;
        }
        
        .print-toolbar button.cancel-btn {
            background: #f6f8fa;
            color: #24292f;
            border: 1px solid #d0d7de;
        }
        
        .print-toolbar button.cancel-btn:hover {
            background: #eaeef2;
        }
        
        @media print {
            .print-toolbar {
                display: none !important;
            }
        }
    </style>
    <div class="print-toolbar">
        <button class="print-btn" onclick="sendMessage('print')">🖨️ Print</button>
        <button class="cancel-btn" onclick="sendMessage('cancel')">✖ Cancel</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function sendMessage(command) {
            vscode.postMessage({ command: command });
        }
    </script>
    `;
    
    // Insert toolbar right after <body> tag
    return html.replace('<body>', '<body>' + toolbar);
}

export function deactivate() {}

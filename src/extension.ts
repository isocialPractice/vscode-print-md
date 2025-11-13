// extension
// Activate and run vscode-print-md extension.

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

      // Save HTML to temp file with unique timestamp to avoid conflicts
      const tempDir = context.globalStorageUri.fsPath;
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = Date.now();
      const htmlPath = path.join(tempDir, `print-preview-${timestamp}.html`);
      const pdfPath = path.join(tempDir, `print-output-${timestamp}.pdf`);

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
          if (message.command === 'debug') {
            console.log('[Webview Debug]:', message.data);
          } else if (message.command === 'print') {
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
              // Clean up temporary files after a delay to ensure printing is complete
              setTimeout(() => {
                try {
                  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
                  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
                } catch (cleanupError) {
                  console.error('Cleanup error:', cleanupError);
                }
              }, 5000);
              
              if (code === 0) {
                vscode.window.showInformationMessage(`Print job completed for ${path.basename(mdDocument.fileName)}`);
              } else {
                vscode.window.showErrorMessage(`Printing failed (exit code ${code})\n${errorOutput}`);
              }
            });
          } else if (message.command === 'cancel') {
            panel.dispose();
            // Clean up temporary files on cancel
            try {
              if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
              if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
            } catch (cleanupError) {
              console.error('Cleanup error:', cleanupError);
            }
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
      margin: 0 auto;
      padding: 0.75in;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
      box-sizing: border-box;
      position: relative;
     }

     .page-break-indicator {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: red;
      z-index: 100;
      pointer-events: none;
     }

     .page-break-indicator::before {
      content: 'Page ' attr(data-page) ' Break (est.)';
      position: absolute;
      right: 10px;
      top: -20px;
      background: red;
      color: white;
      padding: 2px 8px;
      font-size: 10px;
      border-radius: 3px;
      font-weight: bold;
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
      margin: 0;
      padding: 0;
      box-shadow: none;
     }

     .page-break-indicator {
      display: none !important;
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

    /* Avoid page breaks after headers */
    h1, h2, h3, h4, h5, h6 {
     page-break-after: avoid;
    }

    @media print {
     .page-break-indicator {
      display: none !important;
     }
    }
   </style>
  </head>
  <body>
  <div id="content-wrapper">
  <div class="page-container">
  <div class="content">
  ${bodyHtml}
  </div>
  </div>
  </div>
  <script>
  // Add page break indicators for letter-sized pages (8.5" x 11")
  function addPageBreakIndicators() {
   const wrapper = document.getElementById('content-wrapper');
   const container = wrapper.querySelector('.page-container');

   if (!container) {
    return;
   }

   // Available content height per page: 11in - (0.75in top + 0.75in bottom margins) = 9.5in
   const pageHeight = 9.5 * 96; // 9.5 inches in pixels (96 DPI)

   // Get the total content height
   const content = container.querySelector('.content');
   const totalHeight = content.scrollHeight;

   // Calculate how many page breaks we need
   const numPages = Math.ceil(totalHeight / pageHeight);

   // Add red line indicators at each page break position   
   var pageBreakMarginTop = 60;
   var topMarIncrementer =  96;
   var topMarIncrementCount = 0;
   // Inline support function
   let nextPageMargin = (cur, marTop, idx) => {
    topMarIncrementCount++;
    cur.style.marginTop = marTop + 'px';
    if (idx > 0) pageBreakMarginTop -= topMarIncrementer; // starts at 96
    // decrease to account for new margins of pages for better est.
    if (idx >= 2) {
      if (topMarIncrementCount >= 5) {
        topMarIncrementCount = 0;
        topMarIncrementer -= 56;
        if (pageBreakMarginTop <= -240) {
          pageBreakMarginTop = 0;
          topMarIncrementer = 40;
        }
      }
    }
   };
   for (let i = 0; i < numPages; i++) {
    const breakPosition = i * pageHeight;
    const indicator = document.createElement('div');
    indicator.className = 'page-break-indicator';
    indicator.style.top = breakPosition + 'px';

    // account for new page margin or additional from code blocks
    indicator.setAttribute('data-page', String(i));
    indicator.style.setProperty('--page-number', String(i + 1));
    nextPageMargin(indicator, pageBreakMarginTop, i);
    // add page break estimate
    if (i != 0) container.appendChild(indicator);
   }
  }

  // Run when content is ready
  if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', () => {
    setTimeout(addPageBreakIndicators, 100);
   });
  } else {
   setTimeout(addPageBreakIndicators, 100);
  }
  </script>
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

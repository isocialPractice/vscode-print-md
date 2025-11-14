// extension
// Activate and run vscode-print-md extension.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// Global types.
type vsExt = vscode.ExtensionContext

// Global variables.
var extContext: vsExt; // defined at activate

// ************************************* SUPPORT FUNCTIONS *************************************
// Generate path to extension views.
function getView(viewFile: string): string {
  return path.join(extContext.extensionPath, 'src/views', viewFile);
}

// Check if a printer is a PDF printer
function isPdfPrinter(printerName: string): boolean {
  const pdfPrinterNames = [
    'adobe pdf',
    'microsoft print to pdf',
    'pdf',
    'print to pdf'
  ];
  return pdfPrinterNames.some(name => printerName.toLowerCase().includes(name));
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Print Markdown extension is active!');
  extContext = context;
  // Variable to store the last used printer across extension sessions
  let lastUsedPrinter: string | undefined = context.globalState.get('lastUsedPrinter');
  let pageRangeSettings = { mode: 'all', value: '' }; // Default to all pages

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
          } else if (message.command === 'getPrinters') {
            // Get list of available printers from Python script
            const pythonEngine = path.join(context.extensionPath, 'src', 'printMD.py');
            
            const command = `python "${pythonEngine}" --list-printers`;
            const pyProc = spawn(command, [], { shell: true });

            let printerOutput = '';
            let errorOutput = '';

            pyProc.stdout.on('data', (data) => {
              printerOutput += data.toString();
            });

            pyProc.stderr.on('data', (data) => {
              errorOutput += data.toString();
            });

            pyProc.on('close', (code) => {
              if (code === 0) {
                const printers = printerOutput.trim().split('\n').filter(p => p.trim());
                panel.webview.postMessage({ command: 'printerList', printers: printers });
              } else {
                vscode.window.showErrorMessage(`Failed to get printer list: ${errorOutput}`);
                panel.webview.postMessage({ command: 'printerList', printers: [] });
              }
            });
          } else if (message.command === 'setPageRange') {
            // Store the selected page range settings
            if (message.data) {
              pageRangeSettings = {
                mode: message.data.mode || 'all',
                value: message.data.value || ''
              };
              console.log(`[Page Range] Mode: ${pageRangeSettings.mode}, Value: ${pageRangeSettings.value}`);
            }
          } else if (message.command === 'print') {
            const config = vscode.workspace.getConfiguration('vscode-print-md');
            const printerSelectMode = config.get<string>('printer.select', 'default');
            const selectedPrinter = message.data?.selectedPrinter;

            // Determine which printer to use
            let printerToUse: string | undefined;
            
            if (selectedPrinter) {
              // User selected a printer in this session
              printerToUse = selectedPrinter;
              if (printerSelectMode === 'last-used') {
                // Save for next time
                lastUsedPrinter = selectedPrinter;
                context.globalState.update('lastUsedPrinter', selectedPrinter);
              }
            } else if (printerSelectMode === 'last-used' && lastUsedPrinter) {
              // Use the last used printer
              printerToUse = lastUsedPrinter;
            }
            // If printerSelectMode is 'default' or no printer selected, printerToUse remains undefined (system default)

            // Handle save-pdf mode OR if a PDF printer is selected
            const isPdfMode = printerSelectMode === 'save-pdf' || (printerToUse && isPdfPrinter(printerToUse));
            
            if (isPdfMode) {
              const defaultPath = path.join(
                path.dirname(mdDocument.fileName),
                path.basename(mdDocument.fileName, '.md') + '.pdf'
              );
              
              const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultPath),
                filters: {
                  'PDF files': ['pdf']
                },
                title: 'Save Markdown as PDF'
              });

              if (!saveUri) {
                vscode.window.showInformationMessage('Save cancelled.');
                return;
              }

              vscode.window.showInformationMessage(`Saving ${path.basename(mdDocument.fileName)} as PDF...`);

              // Convert HTML to PDF and save
              const pythonEngine = path.join(context.extensionPath, 'src', 'printMD.py');

              const command = `python "${pythonEngine}" --html "${htmlPath}" --pdf "${saveUri.fsPath}"`;
              const pyProc = spawn(command, [], { shell: true });

              let errorOutput = '';

              pyProc.stdout.on('data', (data) => {
                console.log(`stdout: ${data.toString()}`);
              });

              pyProc.stderr.on('data', (data) => {
                errorOutput += data.toString();
              });

              pyProc.on('close', (code) => {
                panel.dispose();
                // Clean up temporary HTML file
                setTimeout(() => {
                  try {
                    if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
                  } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError);
                  }
                }, 1000);
                
                if (code === 0) {
                  vscode.window.showInformationMessage(`PDF saved successfully to ${path.basename(saveUri.fsPath)}`);
                } else {
                  vscode.window.showErrorMessage(`PDF save failed (exit code ${code})\n${errorOutput}`);
                }
              });
              return;
            }

            // Regular printing to physical printer
            vscode.window.showInformationMessage(`Printing ${path.basename(mdDocument.fileName)}...`);

            // Convert HTML to PDF and print using Python script
            const pythonEngine = path.join(context.extensionPath, 'src', 'printMD.py');

            // Build command with proper quoting
            let command = `python "${pythonEngine}" --html "${htmlPath}" --pdf "${pdfPath}"`;
            if (printerToUse) {
              command += ` --printer "${printerToUse}"`;
            }
            // Add page range if specified
            const pageRange = message.data?.pageRange || pageRangeSettings;
            if (pageRange.mode !== 'all' && pageRange.value) {
              command += ` --pages "${pageRange.value}"`;
            }

            const pyProc = spawn(command, [], { shell: true });

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
              }, 15000);
              
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
  let printableHtml = fs.readFileSync(getView('createPrintableHtml.htm'), 'utf-8');
  printableHtml = printableHtml.replace('bodyHtml', bodyHtml);
  printableHtml = printableHtml.replace('escapeHtml', escapeHtml(title));
  return printableHtml;
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
  const toolbar = fs.readFileSync(getView('addPrintButton.htm'), 'utf-8');
  // Insert toolbar right after <body> tag
  return html.replace('<body>', '<body>' + toolbar);
}

export function deactivate() {}

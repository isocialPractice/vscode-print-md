// extension
// Activate and run vscode-print-md extension.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// Helper function to check if a printer is a PDF printer
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

  // Variable to store the last used printer across extension sessions
  let lastUsedPrinter: string | undefined = context.globalState.get('lastUsedPrinter');

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
    align-items: center;
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

  .print-options-container {
    position: relative;
    margin-right: auto;
  }

  .print-options-btn {
    padding: 8px 16px;
    font-size: 14px;
    background: #f6f8fa;
    color: #24292f;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .print-options-btn:hover {
    background: #eaeef2;
  }

  .print-options-menu {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: white;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 180px;
    z-index: 10001;
  }

  .print-options-menu.show {
    display: block;
  }

  .print-options-menu ul {
    list-style: none;
    margin: 0;
    padding: 4px 0;
  }

  .print-options-menu li {
    padding: 8px 16px;
    cursor: pointer;
    transition: background-color 0.1s;
    font-size: 14px;
  }

  .print-options-menu li:hover {
    background: #f6f8fa;
  }

  .printer-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 10002;
    align-items: center;
    justify-content: center;
  }

  .printer-modal.show {
    display: flex;
  }

  .printer-modal-content {
    background: white;
    border-radius: 6px;
    padding: 20px;
    max-width: 500px;
    width: 90%;
    max-height: 70vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .printer-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #d0d7de;
  }

  .printer-modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .printer-modal-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #57606a;
    padding: 0;
    width: 24px;
    height: 24px;
    line-height: 1;
  }

  .printer-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .printer-list li {
    padding: 12px;
    margin: 4px 0;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .printer-list li:hover {
    background: #f6f8fa;
    border-color: #0969da;
  }

  .printer-list li.selected {
    background: #ddf4ff;
    border-color: #0969da;
  }

  .printer-loading {
    text-align: center;
    padding: 20px;
    color: #57606a;
  }

  @media print {
    .print-toolbar {
        display: none !important;
    }
    .printer-modal {
        display: none !important;
    }
  }
  </style>
  <div class="print-toolbar">
    <div class="print-options-container">
      <button class="print-options-btn" onclick="togglePrintOptions()">Print Options ▼</button>
      <div class="print-options-menu" id="printOptionsMenu">
        <ul>
          <li onclick="openPrinterSelection()">Select Printer</li>
        </ul>
      </div>
    </div>
    <button class="print-btn" onclick="sendMessage('print')">🖨️ Print</button>
    <button class="cancel-btn" onclick="sendMessage('cancel')">✖ Cancel</button>
  </div>

  <div class="printer-modal" id="printerModal">
    <div class="printer-modal-content">
      <div class="printer-modal-header">
        <h3>Select Printer</h3>
        <button class="printer-modal-close" onclick="closePrinterModal()">×</button>
      </div>
      <div id="printerListContainer">
        <div class="printer-loading">Loading printers...</div>
      </div>
    </div>
  </div>

  <script>
  const vscode = acquireVsCodeApi();
  let selectedPrinter = null;
  let availablePrinters = [];

  function sendMessage(command, data) {
    if (command === 'print') {
      // Include selected printer when printing
      vscode.postMessage({ 
        command: command, 
        data: { selectedPrinter: selectedPrinter }
      });
    } else {
      vscode.postMessage({ command: command, data: data });
    }
  }

  function togglePrintOptions() {
    const menu = document.getElementById('printOptionsMenu');
    menu.classList.toggle('show');
  }

  function openPrinterSelection() {
    togglePrintOptions();
    const modal = document.getElementById('printerModal');
    modal.classList.add('show');
    // Request printer list from extension
    sendMessage('getPrinters');
  }

  function closePrinterModal() {
    const modal = document.getElementById('printerModal');
    modal.classList.remove('show');
  }

  function selectPrinter(printerName) {
    selectedPrinter = printerName;
    // Update UI to show selected printer
    const items = document.querySelectorAll('.printer-list li');
    items.forEach(item => {
      if (item.textContent === printerName) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
    // Close modal after selection
    setTimeout(() => closePrinterModal(), 300);
    sendMessage('debug', { message: 'Selected printer: ' + printerName });
  }

  function displayPrinters(printers) {
    const container = document.getElementById('printerListContainer');
    if (!printers || printers.length === 0) {
      container.innerHTML = '<div class="printer-loading">No printers found</div>';
      return;
    }

    availablePrinters = printers;
    const ul = document.createElement('ul');
    ul.className = 'printer-list';

    printers.forEach(printer => {
      const li = document.createElement('li');
      li.textContent = printer;
      li.onclick = () => selectPrinter(printer);
      if (printer === selectedPrinter) {
        li.classList.add('selected');
      }
      ul.appendChild(li);
    });

    container.innerHTML = '';
    container.appendChild(ul);
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('printOptionsMenu');
    const container = document.querySelector('.print-options-container');
    if (menu && container && !container.contains(e.target)) {
      menu.classList.remove('show');
    }
  });

  // Listen for messages from extension
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'printerList') {
      displayPrinters(message.printers);
    }
  });
  </script>
  `;

  // Insert toolbar right after <body> tag
  return html.replace('<body>', '<body>' + toolbar);
}

export function deactivate() {}

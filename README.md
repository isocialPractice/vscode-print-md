# vscode-print-md

A VS Code extension that allows you to print Markdown files directly to your office printer with a preview before printing.

## Features

- 🖨️ **Print Markdown files** directly from VS Code to any office printer
- 👀 **Live Preview** before printing with page breaks
- 📄 **Letter-sized pages** with professional formatting
- 🎨 **GitHub-style rendering** matching VS Code's markdown preview
- ✅ **Right-click support** in both editor and preview pane

## Installation

### Prerequisites

- **Node.js** (for VS Code extension)
- **Python 3.x** with pip

### Quick Setup

1. Clone or download this extension
2. Run one command:

```bash
npm install
```

That's it! The postinstall script will:
- Compile TypeScript code
- Install Python dependencies (markdown, weasyprint, pygments, pywin32)
- Set up everything automatically

## Usage

### Method 1: From Markdown Editor
1. Open any `.md` file
2. Right-click in the editor
3. Select **"Print Markdown"**
4. Review the preview
5. Click the **Print** button

### Method 2: From Markdown Preview
1. Open markdown preview (Ctrl+Shift+V)
   * May need to install VSCode Extension **[HTML Preview](https://marketplace.visualstudio.com/items?itemName=george-alisson.html-preview-vscode)**
2. Right-click in the preview pane
3. Select **"Print Markdown"**
4. Review and print

## Development

### Run Extension in Debug Mode
Press `F5` in VS Code to launch Extension Development Host

### Compile TypeScript
```bash
npm run compile    # Single compile
npm run watch      # Watch mode
```

### Project Structure
```
vscode-print-md/
├── src/
│   ├── extension.ts    # Main extension code
│   └── printMD.py      # Python printing script
├── out/                # Compiled JavaScript
├── package.json        # Extension manifest
└── tsconfig.json       # TypeScript config
```

## How It Works

1. Extension uses VS Code's native `markdown.api.render` to convert markdown to HTML
2. Applies print-friendly CSS styling
3. Shows preview in webview with page breaks
4. On confirmation, Python script converts HTML → PDF using WeasyPrint
5. PDF sent directly to Windows default printer

## Requirements

- VS Code 1.80.0 or higher
- Python 3.x with packages:
  - `markdown` - Markdown processing
  - `weasyprint` - HTML to PDF conversion
  - `pygments` - Syntax highlighting
  - `pywin32` - Windows printer integration

## License

MIT

# Print Markdown for VS Code

Print your Markdown files directly to any printer with a beautiful preview — no browser needed.

## Features

- 🖨️ **Print Markdown files** directly from VS Code to any office printer
- 👀 **Live Preview** before printing with accurate page breaks
- 📄 **Letter-sized pages** (US Letter) with professional formatting
- 📑 **Page Range Selection** — print specific pages (e.g., 1-3, 5, 7-9)
- 🎨 **GitHub-style rendering** matching VS Code's markdown preview
- 🖱️ **Right-click anywhere** — works in editor and preview pane
- 💾 **Save as PDF** option instead of printing
- 🔧 **Printer Selection** — remember last used printer or always use default
- 🌐 **Cross-Platform** — Windows, macOS, and Linux support

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
- Install Python dependencies automatically (platform-specific)
- Set up everything for your operating system

### Platform-Specific Notes

#### macOS

If you encounter "externally-managed-environment" errors, the installer will automatically try multiple strategies. If all fail, you can install manually:

```bash
# Option 1: Use --break-system-packages (quickest, recommended for Homebrew Python)
python3 -m pip install --break-system-packages markdown weasyprint pygments

# Option 2: Install with --user flag (if allowed)
python3 -m pip install --user markdown weasyprint pygments

# Option 3: Use a virtual environment (recommended for development)
python3 -m venv .venv
source .venv/bin/activate
pip install markdown weasyprint pygments

# Option 4: Use Homebrew (some packages may not be available)
brew install python-markdown
pip3 install --break-system-packages weasyprint pygments
```

#### Windows

On Windows, the extension automatically installs `pywin32` for better printer integration. Python packages install to the system or user Python environment.

#### Linux

Similar to macOS, uses the `--user` flag for externally-managed environments. No Windows-specific packages are installed.

### Manual Python Package Installation

If automatic installation fails, install manually:

**All Platforms:**

```bash
python3 -m pip install markdown weasyprint pygments
```

**Windows Only (additional):**

```bash
python -m pip install pywin32
```

## Usage

### Quick Start

1. **Open any Markdown file** (`.md`)
2. **Right-click** in the editor or preview pane
3. **Select "Print Markdown"**
4. **Review the preview** with accurate page breaks
5. **(Optional) Select page range** — print all pages, current page, or custom range (e.g., 1-3, 5, 7-9)
6. **(Optional) Choose printer** — or save as PDF
7. **Click Print** 🎉

### From Markdown Editor

1. Open any `.md` file
2. Right-click anywhere in the editor
3. Select **"Print Markdown"**
4. Review, configure, and print

### From Markdown Preview

1. Open markdown preview (Ctrl+Shift+V / Cmd+Shift+V)
2. Right-click in the preview pane
3. Select **"Print Markdown"**
4. Review, configure, and print

### Page Range Selection

In the print preview, you can select which pages to print:

- **All Pages** — Print the entire document
- **Current Page** — Print only the page you're viewing
- **Custom Range** — Specify pages like:
  - `3` — Just page 3
  - `1-5` — Pages 1 through 5
  - `1-3, 5, 7-9` — Pages 1-3, page 5, and pages 7-9

### Printer Options

Configure printer behavior in VS Code settings:

Use property **vscode-print-md.printer.select**, and set value to one of:

- **default** — Always use system default
- **last-used** — Remember and reuse last selected printer
- **save-pdf** — Always save as PDF instead of printing

#### Example

```json
{
  "vscode-print-md.printer.select": "default" | "last-used" | "save-pdf"
}
```


## Development

### Run Extension in Debug Mode

Press `F5` in VS Code to launch Extension Development Host

### Compile TypeScript

```bash
npm run compile    # Single compile
npm run watch      # Watch mode
```

### Project Structure

```text
vscode-print-md/
├── src/
│   ├── extension.ts           # Main extension code
│   ├── printMD.py             # Python printing engine
│   ├── utils/
│   │   └── cleanTemp.ts       # Temp folder cleanup utility
│   └── views/
│       ├── addPrintButton.htm      # Print button UI template
│       ├── createPrintableHtml.htm # Printable HTML template
│       └── mdToHtml.htm            # Markdown to HTML template
├── scripts/
│   └── install-python-deps.js # Cross-platform Python installer
├── test/
│   ├── coding-standards.test.js # Code style validation
│   └── print/                   # Test markdown files
├── out/                       # Compiled JavaScript output
├── package.json               # Extension manifest
└── tsconfig.json              # TypeScript configuration
```

## How It Works

1. Extension uses VS Code's native `markdown.api.render` to convert markdown to HTML
2. Applies print-friendly CSS styling
3. Shows preview in webview with page breaks
4. On confirmation, Python script converts HTML → PDF using WeasyPrint
5. PDF sent to system printer (platform-specific handling)

## Requirements

### All OS

- VS Code 1.80.0 or higher
- Python 3.x with packages:
  - `markdown` - Markdown processing
  - `weasyprint` - HTML to PDF conversion
  - `pygments` - Syntax highlighting

### Windows Only

- Python 3.x with packages:
  - `pywin32` - Windows printer integration (Windows only)

## Cross-Platform Support

The extension works seamlessly across all major platforms:

| Platform | Print Method | Fallback Behavior |
|----------|--------------|-------------------|
| **Windows** | Native printer integration via `pywin32` | Opens PDF with default viewer if printing fails |
| **macOS** | System `lp` command | Opens PDF in Preview app for manual printing |
| **Linux** | System `lp` or `lpr` command | Opens PDF in default viewer (xdg-open) |

### Print Behavior

The extension intelligently handles printing across platforms:

1. **Direct Printing** (preferred): Sends PDF directly to printer using system commands
2. **Fallback Mode**: If direct printing fails or no printer is available, opens PDF in system default viewer
   - Allows manual printing with full control over printer settings
   - Useful when printer isn't detected or requires special configuration

## Troubleshooting

### Python Not Found

If you see "Python is not installed" warning:

**Windows:**

```bash
# Install Python from Microsoft Store or python.org
# Ensure 'python' command works in terminal
python --version
```

**macOS/Linux:**

```bash
# Install Python 3 if not already installed
python3 --version

# Extension automatically detects python3 on Unix systems
```

### Installation Errors

**macOS "externally-managed-environment" error:**

The extension installer handles this automatically. If manual installation is needed:

```bash
python3 -m pip install --break-system-packages markdown weasyprint pygments
```

**Linux permission errors:**

```bash
python3 -m pip install --user markdown weasyprint pygments
```

### Printing Issues

**Colors not printing:**

Check your PDF viewer settings:

- Adobe Reader: Disable "Print in Grayscale"

**No printers detected:**

The extension will automatically open the PDF in your default viewer for manual printing.

**Page breaks in wrong places:**

Page breaks are calculated during preview. Adjust your markdown formatting or use manual page break hints if needed.

### Getting Help

If you encounter issues:

1. Check the **Output** panel (View → Output → Select "Print Markdown")
2. Enable debug mode by searching for debug settings
3. Report issues with OS, Python version, and error messages

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup

```bash
git clone https://github.com/isocialPractice/vscode-print-md.git
cd vscode-print-md
npm install  # Installs Node and Python dependencies
```

Press `F5` in VS Code to launch the Extension Development Host.

## License

MIT License — Copyright (c) 2025 practicing.xyz

See [LICENSE](LICENSE) file for details.

---

Enjoy printing your Markdown files! 🎉

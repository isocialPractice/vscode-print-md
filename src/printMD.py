#!/usr/bin/env python3
"""
print.py

Usage:
    python print.py path/to/file.md [--printer "Printer Name"] [--wait-seconds 3]

What it does:
 - Converts Markdown to HTML with a simple print-friendly CSS (GitHub-like).
 - Attempts to render the HTML to a Letter-sized PDF using WeasyPrint.
 - Sends the PDF to the default (or named) printer.
 - Cross-platform fallbacks:
     - Windows: try pywin32 ShellExecute, else os.startfile(..., "print"), else rundll32 hack.
     - macOS / Linux: use 'lp' or 'lpr' to send the PDF to the printer.
 - If WeasyPrint is not installed, saves HTML and optionally opens it in the default browser (manual print).
 - Cleans up temporary files.

Dependencies (recommended):
    pip install markdown weasyprint pygments

Optional (Windows printing reliability):
    pip install pywin32

Note: WeasyPrint on Windows requires additional C libraries in some environments. If that's a problem,
the script will fall back to saving HTML for manual printing.
"""

from __future__ import annotations
import argparse
import shutil
import sys
import tempfile
import time
import os
import subprocess
from pathlib import Path
import html

# Try optional packages
_have_weasy = True
_have_pywin32 = True
_have_pygments = True
try:
    import markdown
except Exception:
    print("ERROR: Missing Python package 'markdown'. Install with: pip install markdown")
    sys.exit(2)

try:
    from weasyprint import HTML, CSS  # type: ignore
except Exception:
    _have_weasy = False

try:
    import pygments  # noqa: F401
except Exception:
    _have_pygments = False

try:
    import win32api  # type: ignore
    import win32print  # type: ignore
except Exception:
    _have_pywin32 = False

# A compact, print-friendly CSS that resembles GitHub markdown style.
PRINT_CSS = r"""
@page { size: Letter; margin: 1in; }
body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    color: #222;
    line-height: 1.45;
    background: white;
    padding: 0;
    margin: 0;
}
article { max-width: 7.5in; margin: 0 auto; padding: 0; }
h1 { font-size: 20pt; margin-top: 0.6em; margin-bottom: 0.3em; font-weight: 700; }
h2 { font-size: 16pt; margin-top: 0.6em; margin-bottom: 0.3em; font-weight: 700; }
h3 { font-size: 13pt; margin-top: 0.5em; margin-bottom: 0.2em; font-weight: 700; }
pre, code { font-family: Consolas, "Courier New", monospace; background: #f6f8fa; border: 1px solid #e1e4e8; padding: 0.2em 0.4em; border-radius: 3px; }
pre { padding: 0.6em; overflow: auto; }
table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
th, td { border: 1px solid #dfe2e5; padding: 0.4em; text-align: left; vertical-align: top; }
a { color: #0366d6; text-decoration: none; }
a[href]:after { content: " (" attr(href) ")"; font-size: 85%; color: #444; }
ul, ol { margin: 0.4em 0 0.8em 1.2em; }
h1, h2, h3, pre, table { page-break-inside: avoid; }
"""

MARKDOWN_EXTS = [
    'fenced_code',
    'codehilite',
    'tables',
    'toc',
    'nl2br',
    'sane_lists',
    'attr_list',
]


def md_to_html(md_text: str, title: str = "Document") -> str:
    md = markdown.Markdown(extensions=MARKDOWN_EXTS, output_format='html5')
    body = md.convert(md_text)
    html_doc = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=8.5in, initial-scale=1.0">
<title>{html.escape(title)}</title>
<style>
{PRINT_CSS}
</style>
</head>
<body>
<article class="markdown-body">
{body}
</article>
</body>
</html>"""
    return html_doc


def render_pdf(html_str: str, out_pdf: str) -> None:
    if not _have_weasy:
        raise RuntimeError("WeasyPrint not available")
    # Ensure Letter page size with CSS override
    HTML(string=html_str).write_pdf(out_pdf, stylesheets=[CSS(string='@page { size: Letter; margin: 1in }')])


def print_pdf_windows(pdf_path: str, printer_name: str | None = None) -> None:
    # If a named printer is supplied, try to use win32print to set it. Otherwise ShellExecute uses default.
    if _have_pywin32 and printer_name:
        try:
            hPrinter = win32print.OpenPrinter(printer_name)
            win32print.ClosePrinter(hPrinter)
            # Use ShellExecute with the printer set as the default temporarily could be complex;
            # For now, recommend using default printer or supply no name.
        except Exception:
            print(f"Warning: could not access printer '{printer_name}' via pywin32. Falling back to default printer.")
    # Best attempt: use ShellExecute (pywin32) or os.startfile
    if _have_pywin32:
        try:
            print("Printing via win32api.ShellExecute(..., 'print') ...")
            win32api.ShellExecute(0, "print", pdf_path, None, ".", 0)
            return
        except Exception as e:
            print("pywin32 ShellExecute failed:", e)
    # os.startfile fallback
    try:
        print("Printing via os.startfile(..., 'print') ...")
        os.startfile(pdf_path, "print")
        return
    except Exception as e:
        print("os.startfile print failed:", e)
    # last-ditch attempt using rundll32 (Windows)
    try:
        print("Attempting rundll32 ShellExec_RunDLL fallback ...")
        subprocess.run(['rundll32', 'shell32.dll,ShellExec_RunDLL', pdf_path, 'print'], shell=True)
    except Exception as e:
        print("Final Windows fallback failed:", e)
        raise RuntimeError("Unable to send to printer on Windows")


def print_pdf_unix(pdf_path: str, printer_name: str | None = None) -> None:
    # Use lp or lpr if present
    lp_cmd = shutil.which('lp') or shutil.which('lpr')
    if not lp_cmd:
        raise RuntimeError("Neither 'lp' nor 'lpr' was found on PATH")
    cmd = [lp_cmd]
    if printer_name:
        # lp uses -d, lpr uses -P
        if os.path.basename(lp_cmd) == 'lp':
            cmd += ['-d', printer_name]
        else:
            cmd += ['-P', printer_name]
    cmd += [pdf_path]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def open_html_in_browser(html_path: str) -> None:
    # last-resort: open the HTML in the default browser for manual printing
    try:
        print("Opening HTML in default browser for manual printing:", html_path)
        if sys.platform.startswith('win'):
            os.startfile(html_path)
        elif sys.platform == 'darwin':
            subprocess.run(['open', html_path])
        else:
            subprocess.run(['xdg-open', html_path])
    except Exception as e:
        print("Failed to open browser:", e)


def main() -> int:
    parser = argparse.ArgumentParser(description="Print Markdown to a physical printer (via HTML preview -> PDF)")
    parser.add_argument('mdfile', nargs='?', help="Path to a markdown file")
    parser.add_argument('--html', help="Path to pre-rendered HTML file (alternative to mdfile)")
    parser.add_argument('--pdf', help="Path where PDF should be saved")
    parser.add_argument('--printer', '-p', help="Printer name (optional)", default=None)
    parser.add_argument('--wait-seconds', '-w', type=float, default=3.0, help="Seconds to wait after issuing print command before cleanup")
    args = parser.parse_args()

    # Determine if we're using pre-rendered HTML or markdown
    if args.html:
        # Use pre-rendered HTML from VS Code
        html_input_path = Path(args.html).expanduser().resolve()
        if not html_input_path.exists() or not html_input_path.is_file():
            print("ERROR: HTML file not found:", html_input_path)
            return 2
        html_doc = html_input_path.read_text(encoding='utf-8')
        title = html_input_path.stem
    elif args.mdfile:
        # Original markdown processing
        md_path = Path(args.mdfile).expanduser().resolve()
        if not md_path.exists() or not md_path.is_file():
            print("ERROR: markdown file not found:", md_path)
            return 2
        md_text = md_path.read_text(encoding='utf-8')
        html_doc = md_to_html(md_text, title=md_path.name)
        title = md_path.stem
    else:
        print("ERROR: Either mdfile or --html must be provided")
        return 2

    tmpdir = Path(tempfile.mkdtemp(prefix="printmd_"))
    try:
        # Use provided PDF path or create temp one
        if args.pdf:
            pdf_path = args.pdf
            cleanup_pdf = False
        else:
            pdf_path = str(tmpdir / (title + ".pdf"))
            cleanup_pdf = True
            
        html_path = str(tmpdir / (title + ".html"))

        if _have_weasy:
            try:
                print("Rendering PDF (Letter) using WeasyPrint...")
                render_pdf(html_doc, pdf_path)
                print("PDF saved to:", pdf_path)
            except Exception as e:
                print("WeasyPrint rendering failed:", e)
                print("Falling back to saving HTML for manual printing.")
                Path(html_path).write_text(html_doc, encoding='utf-8')
                open_html_in_browser(html_path)
                return 0
        else:
            # Save HTML fallback
            print("WeasyPrint not available. Saving HTML preview for manual printing.")
            Path(html_path).write_text(html_doc, encoding='utf-8')
            open_html_in_browser(html_path)
            return 0

        # Send to printer
        try:
            print("Sending to printer...")
            if sys.platform.startswith('win'):
                print_pdf_windows(pdf_path, args.printer)
            else:
                print_pdf_unix(pdf_path, args.printer)
            # Give the system some time to queue the job before we remove the file
            time.sleep(max(1.0, float(args.wait_seconds)))
            print("Print command issued.")
            return 0
        except Exception as e:
            print("Error sending to printer:", e)
            print("Saved PDF at:", pdf_path)
            return 3
    finally:
        # Cleanup: try to remove temp dir (but not custom PDF path)
        try:
            time.sleep(0.5)
            if cleanup_pdf:
                shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())

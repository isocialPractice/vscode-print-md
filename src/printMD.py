#!/usr/bin/env python3
# printMD
# Converts markdown to html, and sends to default printer.

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
import importlib

# Try optional packages
_have_weasy = True
_have_pywin32 = True
_have_pygments = True
_have_pypdf = True
PdfReader = None  # type: ignore
PdfWriter = None  # type: ignore
PageRange = None  # type: ignore
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
  from pypdf import PdfReader as _PdfReader, PdfWriter as _PdfWriter, PageRange as _PageRange  # type: ignore
  PdfReader = _PdfReader
  PdfWriter = _PdfWriter
  PageRange = _PageRange
except Exception:
  _have_pypdf = False

try:
  import win32api    # type: ignore
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
  """
  Print PDF on Windows. Adobe Reader may have 'Print in Grayscale' enabled by default.
  To fix: Open Adobe Reader > Edit > Preferences > Page Display > uncheck 'Use Grayscale'
  
  This function tries multiple methods to print with color preservation.
  """
  
  # Method 1: Try SumatraPDF first - it's lightweight and respects color better than Adobe
  sumatra_paths = [
    r"C:\Program Files\SumatraPDF\SumatraPDF.exe",
    r"C:\Program Files (x86)\SumatraPDF\SumatraPDF.exe",
  ]
  
  for sumatra_path in sumatra_paths:
    if os.path.exists(sumatra_path):
      try:
        target_printer = printer_name
        if not target_printer and _have_pywin32:
          try:
            target_printer = win32print.GetDefaultPrinter()
          except Exception:
            pass
        
        print(f"Printing via SumatraPDF to printer: {target_printer or 'default'}")
        
        # SumatraPDF command: -print-to "printer name" file.pdf (or -print-to-default)
        if target_printer:
          subprocess.run([sumatra_path, '-print-to', target_printer, pdf_path], timeout=15, check=True)
        else:
          subprocess.run([sumatra_path, '-print-to-default', pdf_path], timeout=15, check=True)
        
        print("SumatraPDF print command completed")
        return
      except subprocess.TimeoutExpired:
        print("SumatraPDF print timed out (but may have succeeded)")
        return
      except FileNotFoundError:
        print(f"SumatraPDF not found at {sumatra_path}")
        break
      except Exception as e:
        print(f"SumatraPDF printing failed: {e}")
        break
  
  # Method 2: Fallback to ShellExecute
  # NOTE: This may invoke Adobe Reader which might have "Print in Grayscale" enabled.
  # User should check: Adobe Reader > Edit > Preferences > Page Display > uncheck "Use Grayscale"
  print("WARNING: Using ShellExecute (Adobe Reader). If prints are grayscale:")
  print("  Fix: Adobe Reader > Edit > Preferences > Page Display > uncheck 'Use Grayscale'")
  print("  Or install SumatraPDF for better color handling")
  
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

def get_available_printers() -> list[str]:
  """Get list of available printers on the system."""
  printers = []

  if sys.platform.startswith('win'):
    # Windows: use win32print if available, otherwise enumerate via wmic
    if _have_pywin32:
      try:
        # EnumPrinters returns a list of tuples: (Flags, Description, Name, Comment)
        printer_info = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
        printers = [info[2] for info in printer_info]  # info[2] is the printer name
      except Exception as e:
        print(f"Warning: Failed to enumerate printers via pywin32: {e}", file=sys.stderr)
        # Fallback to wmic
        try:
          result = subprocess.run(['wmic', 'printer', 'get', 'name'], capture_output=True, text=True, shell=True)
          if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            printers = [line.strip() for line in lines[1:] if line.strip()]
        except Exception as e2:
          print(f"Warning: Failed to enumerate printers via wmic: {e2}", file=sys.stderr)
    else:
      # No pywin32, try wmic
      try:
        result = subprocess.run(['wmic', 'printer', 'get', 'name'], capture_output=True, text=True, shell=True)
        if result.returncode == 0:
          lines = result.stdout.strip().split('\n')
          printers = [line.strip() for line in lines[1:] if line.strip()]
      except Exception as e:
        print(f"Warning: Failed to enumerate printers: {e}", file=sys.stderr)
  else:
    # Unix/Linux/macOS: use lpstat
    try:
      result = subprocess.run(['lpstat', '-p'], capture_output=True, text=True)
      if result.returncode == 0:
        for line in result.stdout.strip().split('\n'):
          if line.startswith('printer '):
            # Format: "printer PrinterName is ..."
            parts = line.split()
            if len(parts) >= 2:
              printers.append(parts[1])
    except Exception as e:
      print(f"Warning: Failed to enumerate printers: {e}", file=sys.stderr)

  return printers

def parse_page_range(page_spec: str) -> list[str]:
  """
  Convert user-friendly page specification to pypdf PageRange slice notation.
  User enters pages 1-indexed: '3' or '1-5' or '1-3,5,7-9'
  Returns list of slice strings (0-indexed): ['2:3'] or ['0:5'] or ['0:3','4:5','6:9']
  Examples:
    '3' -> ['2:3'] (page 3 becomes slice 2:3)
    '1-5' -> ['0:5'] (pages 1-5 become slice 0:5)
    '1-3,5,7-9' -> ['0:3','4:5','6:9'] (multiple ranges)
  """
  if not page_spec or not page_spec.strip():
    return []
  
  try:
    slices = []
    parts = page_spec.split(',')
    
    for part in parts:
      part = part.strip()
      if not part:
        continue
      
      if '-' in part:
        # Range like '1-5' -> slice '0:5'
        start_str, end_str = part.split('-', 1)
        start = int(start_str.strip()) - 1  # Convert to 0-indexed
        end = int(end_str.strip())  # End is exclusive in slice notation
        slices.append(f"{start}:{end}")
      else:
        # Single page like '3' -> slice '2:3'
        page_num = int(part) - 1  # Convert to 0-indexed
        slices.append(f"{page_num}:{page_num + 1}")
    
    print(f"Parsed page range '{page_spec}' -> slices {slices}")
    return slices
  except (ValueError, AttributeError) as e:
    print(f"Warning: Invalid page range '{page_spec}' ({e}). Printing all pages.")
    return []

def filter_pdf_pages(input_pdf: str, output_pdf: str, page_slices: list[str]) -> bool:
  """
  Create filtered PDF containing only specified pages using pypdf PageRange.
  page_slices: list of slice notation strings like ['0:5','6:9']
  Returns True if successful, False otherwise.
  """
  if (not _have_pypdf) or (not PdfReader) or (not PdfWriter) or (not PageRange):
    if not ensure_pypdf_available():
      print("Warning: pypdf not available. Cannot filter pages. Install with: pip install pypdf")
      return False
  
  try:
    reader = PdfReader(input_pdf)
    writer = PdfWriter()
    
    total_pages = len(reader.pages)
    print(f"Total pages in PDF: {total_pages}")
    
    # Append each page range slice
    for slice_spec in page_slices:
      print(f"  Extracting pages: PageRange('{slice_spec}')")
      writer.append(reader, pages=PageRange(slice_spec))
    
    if len(writer.pages) == 0:
      print("Error: No valid pages to print")
      return False
    
    # Write the filtered PDF
    with open(output_pdf, 'wb') as output_file:
      writer.write(output_file)
    
    print(f"Created filtered PDF with {len(writer.pages)} page(s): {output_pdf}")
    return True
  except Exception as e:
    print(f"Error filtering PDF pages: {e}")
    return False

def ensure_pypdf_available() -> bool:
  global _have_pypdf, PdfReader, PdfWriter, PageRange
  if _have_pypdf and PdfReader and PdfWriter and PageRange:
    return True
  try:
    print("Installing required dependency 'pypdf' for page range support...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', 'pypdf'], check=True)
    module = importlib.import_module('pypdf')
    PdfReader = module.PdfReader
    PdfWriter = module.PdfWriter
    PageRange = module.PageRange
    _have_pypdf = True
    print("'pypdf' installed successfully.")
    return True
  except Exception as e:
    print(f"Warning: Unable to install 'pypdf'. Page range filtering unavailable. ({e})")
    return False

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
  global debug_print_md
  parser = argparse.ArgumentParser(description="Print Markdown to a physical printer (via HTML preview -> PDF)")
  parser.add_argument('mdfile', nargs='?', help="Path to a markdown file")
  parser.add_argument('--html', help="Path to pre-rendered HTML file (alternative to mdfile)")
  parser.add_argument('--pdf', help="Path where PDF should be saved")
  parser.add_argument('--printer', '-p', help="Printer name (optional)", default=None)
  parser.add_argument('--pages', help="Page range: single page '3' or range '1-5,7,9-12' (optional)", default=None)
  parser.add_argument('--list-printers', action='store_true', help="List available printers and exit")
  parser.add_argument('--wait-seconds', '-w', type=float, default=3.0, help="Seconds to wait after issuing print command before cleanup")
  args = parser.parse_args()

  # Handle list-printers command
  if args.list_printers:
    printers = get_available_printers()
    for printer in printers:
      print(printer)
    return 0

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
      
      # Parse page range if specified
      page_slices = parse_page_range(args.pages) if args.pages else []
      
      # If page filtering is requested, create a filtered PDF
      pdf_to_print = pdf_path
      if page_slices:
        filtered_pdf = str(tmpdir / (title + "_filtered.pdf"))
        if filter_pdf_pages(pdf_path, filtered_pdf, page_slices):
          pdf_to_print = filtered_pdf
        else:
          print("Warning: Page filtering failed, printing entire document")
          page_slices = []
      
      if sys.platform.startswith('win'):
        print_pdf_windows(pdf_to_print, args.printer)
      else:
        print_pdf_unix(pdf_to_print, args.printer)
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

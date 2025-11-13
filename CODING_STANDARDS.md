# vscode-print-md Coding Standards

This project follows consistent coding conventions across TypeScript and Python files.

### 1. Introduction

**Purpose:** Establish consistent code style, improve maintainability, and enable seamless collaboration.

**Scope:** Applies to all TypeScript (`.ts`) and Python (`.py`) files in this project.

### 2. Naming Conventions

#### TypeScript
- **Variables:** `camelCase` (e.g., `mdDocument`, `htmlPath`, `errorOutput`)
- **Functions/Methods:** `camelCase` (e.g., `activate`, `createPrintableHtml`, `addPrintButton`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `PRINT_CSS`, `MARKDOWN_EXTS`)
- **Types/Interfaces:** `PascalCase` (e.g., `TextDocument`, `ExtensionContext`)

#### Python
- **Variables:** `snake_case` (e.g., `md_text`, `html_doc`, `pdf_path`)
- **Functions:** `snake_case` (e.g., `md_to_html`, `render_pdf`, `print_pdf_windows`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `PRINT_CSS`, `MARKDOWN_EXTS`)
- **Classes:** `PascalCase`

### 3. Formatting and Style

#### TypeScript
- **Indentation:** 2 spaces
- **Line Length:** Maximum 120 characters (flexible for template literals)
- **Braces:** K&R style (opening brace on same line)
- **Quotes:** Single quotes (`'`) for strings, backticks for template literals
- **Semicolons:** Required at end of statements
- **Blank Lines:** One blank line between functions

#### Python
- **Indentation:** 2 spaces (consistent with TypeScript)
- **Line Length:** Maximum 120 characters
- **Quotes:** Single quotes (`'`) preferred, double quotes (`"`) for docstrings
- **Blank Lines:** Two blank lines between top-level functions
- **Type Hints:** Use modern syntax (`str | None` instead of `Optional[str]`)

### 4. Commenting

#### TypeScript
- **File Headers:** Brief comment describing purpose (e.g., `// extension`, `// Activate and run vscode-print-md extension.`)
- **Inline Comments:** Explain non-obvious logic, placed above code block
- **Multi-line Comments:** Use `//` for each line
- **Code Grouping:** Comment sections of functionality (e.g., `// Try to get the markdown file...`)

#### Python
- **File Headers:** Shebang line, brief comment, and comprehensive docstring
- **Docstrings:** Triple-quoted strings describing module/function purpose, usage, parameters
- **Inline Comments:** Explain complex logic, use `#` prefix
- **Section Comments:** Use clear headers for different code sections

### 5. Error Handling

#### TypeScript
- **Try-Catch:** Wrap async operations in try-catch blocks
- **Error Messages:** Use `vscode.window.showErrorMessage()` for user-facing errors
- **Info Messages:** Use `vscode.window.showInformationMessage()` for status updates
- **Console Logging:** Use `console.log()` and `console.error()` for debugging

#### Python
- **Exceptions:** Handle specific exceptions where possible
- **Fallbacks:** Provide graceful degradation when dependencies unavailable
- **User Feedback:** Print clear messages about errors and fallback actions
- **Exit Codes:** Return appropriate exit codes (0=success, 2=input error, 3=print error)

### 6. Best Practices and Anti-Patterns

#### General
- **Avoid Magic Numbers:** Use constants or comments to explain literal values
- **Small Functions:** Keep functions focused on single responsibility
- **Descriptive Names:** Use clear, self-documenting variable and function names
- **Template Literals:** Use for embedding expressions in strings (TypeScript) or f-strings (Python)

#### TypeScript Specific
- **Async/Await:** Prefer over callbacks
- **Type Safety:** Use TypeScript types (avoid `any` when possible)
- **Resource Cleanup:** Add disposables to `context.subscriptions`
- **Optional Chaining:** Use `?.` for safe property access

#### Python Specific
- **Pathlib:** Use `Path` objects instead of string manipulation
- **Type Annotations:** Include return types and parameter types
- **Context Managers:** Use for resource management
- **Platform Detection:** Use `sys.platform` for cross-platform code

### 7. Examples

#### Correct TypeScript Example
```typescript
function createPrintableHtml(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
```

#### Correct Python Example
```python
def md_to_html(md_text: str, title: str = "Document") -> str:
  md = markdown.Markdown(extensions=MARKDOWN_EXTS, output_format='html5')
  body = md.convert(md_text)
  return f"<!doctype html><html><body>{body}</body></html>"
```

### 8. Contribution and Enforcement

- **Code Reviews:** All changes require review before merging
- **Automated Testing:** Run test suite to verify standards compliance
- **Linting:** Use ESLint for TypeScript, flake8 or ruff for Python
- **Consistency:** When in doubt, match the existing code style

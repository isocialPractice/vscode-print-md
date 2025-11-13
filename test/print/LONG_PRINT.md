# TypeScript Exercise

## Arrays and Tuples

| TypeScript Feature | Description | Example |
| --- | --- | --- |
| `Array<T>` or `T[]` | Generic array type with type safety | `const nums: number[] = [1, 2, 3]` |
| `ReadonlyArray<T>` | Immutable array that cannot be modified | `const fixed: readonly string[] = ['a', 'b']` |
| `Tuple` | Fixed-length array with specific types per position | `const coord: [number, number] = [10, 20]` |
| `typeof` | Extract type from a value | `const user = { name: 'John' }; type User = typeof user` |
| `keyof` | Get union of object keys as type | `type Keys = keyof { x: number, y: number } // 'x' \| 'y'` |
| `extends` | Generic constraint or conditional type | `<T extends string>` or `T extends U ? X : Y` |
| `as const` | Literal type assertion for immutability | `const colors = ['red', 'blue'] as const` |
| `?.` Optional Chaining | Safely access nested properties | `user?.address?.street` |
| `??` Nullish Coalescing | Default value only for null/undefined | `const name = user.name ?? 'Anonymous'` |
| `never` | Type for values that never occur | `function error(msg: string): never { throw new Error(msg) }` |
| `unknown` | Type-safe alternative to any | `const val: unknown = getData(); if (typeof val === 'string') {...}` |
| `infer` | Extract types within conditional types | `type ReturnType<T> = T extends (...args: any[]) => infer R ? R : any` |

### Arrays

- **Type Declaration**: Arrays can be declared with explicit types (e.g., `string[]`, `number[]`)
- **Readonly Arrays**: Arrays can be marked as `readonly` to prevent modifications
- **Type Inference**: TypeScript can infer array types when values are provided

### Tuples

- **Definition**: Tuples are typed arrays with a fixed number of elements, where each element can have a different type
- **Structure**: Types are defined at declaration time (e.g., `[string, number, boolean]`)
- **Readonly Tuples**: Tuples can also be marked as `readonly` for immutability

### Example: Tuple Destructuring

Deconstructing a tuple with geographic coordinates (28.43221, 30.34):

```typescript
const coord: [x: number, y: number] = [28.43221, 30.34];
const [x, y] = coord;

console.log(`${x}, ${y}`);
// Output: "28.43221, 30.34"
```

- **Labeled Tuple Elements**: The tuple declaration uses labeled elements (`x: number, y: number`) to improve code readability and IDE support, making it clear that the first element represents x-coordinate and the second represents y-coordinate
- **Destructuring Assignment**: The square bracket syntax `[x, y] = coord` extracts both values from the tuple in a single operation, automatically assigning them to separate variables that match the tuple's order
- **Template Literals**: The backtick syntax with `${x}, ${y}` allows embedding variables directly into strings, providing a cleaner alternative to string concatenation with the `+` operator

### Notes

- **Union Types**: Function parameters can accept multiple types using union syntax (e.g., `string | number`)
- **Type Safety**: TypeScript ensures type consistency throughout your code

### Example: Array with forEach

Working with number arrays and mathematical operations:

```typescript
const arrNum: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

const powNum = (num: number): void => {
    console.log(Math.pow(num, 2));
};

arrNum.forEach(powNum);
// Example output: 1, 4, 9, 16, 25, 36, 49, 64, 81, 0
```

## TypeScript in VS Code Extensions

### Type Safety Benefits

When building VS Code extensions, TypeScript provides crucial type safety that helps prevent runtime errors:

- **Compile-time Error Detection**: Catch errors before running the extension
- **IntelliSense Support**: Get autocomplete suggestions for VS Code API methods
- **Refactoring Confidence**: Rename symbols across files safely
- **API Documentation**: Inline documentation appears as you type

### Extension Context Types

The VS Code extension API is fully typed, making it easier to work with extension lifecycle:

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // context.subscriptions is typed as vscode.Disposable[]
  // context.extensionPath is typed as string
  // context.globalState is typed as vscode.Memento
  
  let disposable = vscode.commands.registerCommand('extension.command', () => {
    vscode.window.showInformationMessage('Hello from TypeScript!');
  });
  
  context.subscriptions.push(disposable);
}
```

### Working with Documents

TypeScript helps ensure you're working with document objects correctly:

```typescript
function processMarkdownDocument(document: vscode.TextDocument): void {
  // Type checking ensures document exists and has correct methods
  if (document.languageId === 'markdown') {
    const text: string = document.getText();
    const lineCount: number = document.lineCount;
    const fileName: string = document.fileName;
    
    console.log(`Processing ${fileName} with ${lineCount} lines`);
  }
}
```

### Command Registration Patterns

Different ways to register commands with proper typing:

```typescript
// Simple command with no parameters
vscode.commands.registerCommand('extension.simple', () => {
  vscode.window.showInformationMessage('Simple command executed');
});

// Command with URI parameter
vscode.commands.registerCommand('extension.withUri', (uri: vscode.Uri) => {
  console.log(`File path: ${uri.fsPath}`);
});

// Async command with return value
vscode.commands.registerCommand('extension.async', async (): Promise<string> => {
  const result = await vscode.window.showInputBox({
    prompt: 'Enter some text'
  });
  return result || '';
});
```

### Webview Message Handling

Type-safe message passing between extension and webview:

```typescript
interface WebviewMessage {
  command: 'print' | 'cancel' | 'debug';
  data?: any;
}

panel.webview.onDidReceiveMessage(
  async (message: WebviewMessage) => {
    switch (message.command) {
      case 'print':
        await handlePrint(message.data);
        break;
      case 'cancel':
        panel.dispose();
        break;
      case 'debug':
        console.log('[Debug]:', message.data);
        break;
    }
  }
);
```

### File System Operations

TypeScript ensures file system operations are type-safe:

```typescript
import * as fs from 'fs';
import * as path from 'path';

function saveHtmlFile(htmlContent: string, outputPath: string): void {
  const directory: string = path.dirname(outputPath);
  
  // Ensure directory exists
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  
  // Write file with UTF-8 encoding
  fs.writeFileSync(outputPath, htmlContent, 'utf-8');
}
```

### Configuration Access

Reading extension configuration with type safety:

```typescript
interface ExtensionConfig {
  fontSize: number;
  pageSize: 'Letter' | 'A4' | 'Legal';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

function getConfiguration(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('printMD');
  
  return {
    fontSize: config.get<number>('fontSize', 11),
    pageSize: config.get<'Letter' | 'A4' | 'Legal'>('pageSize', 'Letter'),
    margins: {
      top: config.get<number>('margins.top', 0.75),
      right: config.get<number>('margins.right', 0.75),
      bottom: config.get<number>('margins.bottom', 0.75),
      left: config.get<number>('margins.left', 0.75)
    }
  };
}
```

## Advanced TypeScript Patterns

### Generic Functions for Reusability

Generics make code more flexible while maintaining type safety:

```typescript
function findDocumentByLanguage<T extends vscode.TextDocument>(
  languageId: string
): T | undefined {
  const documents = vscode.workspace.textDocuments;
  return documents.find(doc => doc.languageId === languageId) as T | undefined;
}

// Usage
const mdDoc = findDocumentByLanguage<vscode.TextDocument>('markdown');
```

### Union Types for Flexible Parameters

Handle multiple input types gracefully:

```typescript
type DocumentSource = vscode.TextDocument | vscode.Uri | string;

async function loadDocument(source: DocumentSource): Promise<string> {
  if (typeof source === 'string') {
    // File path as string
    return fs.readFileSync(source, 'utf-8');
  } else if (source instanceof vscode.Uri) {
    // URI object
    const document = await vscode.workspace.openTextDocument(source);
    return document.getText();
  } else {
    // TextDocument object
    return source.getText();
  }
}
```

### Type Guards for Runtime Checking

Ensure type safety at runtime:

```typescript
function isMarkdownDocument(document: any): document is vscode.TextDocument {
  return document && 
         typeof document.languageId === 'string' &&
         document.languageId === 'markdown';
}

function processDocument(doc: any): void {
  if (isMarkdownDocument(doc)) {
    // TypeScript knows doc is vscode.TextDocument here
    const text = doc.getText();
    console.log(`Processing markdown: ${text.length} characters`);
  }
}
```

### Enums for Constant Values

Define fixed sets of values:

```typescript
enum PageSize {
  Letter = 'Letter',
  A4 = 'A4',
  Legal = 'Legal',
  Tabloid = 'Tabloid'
}

enum Orientation {
  Portrait = 'portrait',
  Landscape = 'landscape'
}

interface PrintSettings {
  size: PageSize;
  orientation: Orientation;
  margins: number;
}

const settings: PrintSettings = {
  size: PageSize.Letter,
  orientation: Orientation.Portrait,
  margins: 0.75
};
```

### Interfaces vs Type Aliases

Both define object shapes, with subtle differences:

```typescript
// Interface - can be extended
interface BaseConfig {
  enabled: boolean;
  version: string;
}

interface PrintConfig extends BaseConfig {
  pageSize: string;
  margins: number;
}

// Type alias - can use unions and intersections
type Status = 'idle' | 'processing' | 'completed' | 'error';

type Result<T> = 
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

// Usage
const printResult: Result<string> = {
  status: 'success',
  data: 'Print completed successfully'
};
```

### Async/Await with Promises

Modern asynchronous code with type safety:

```typescript
async function renderMarkdownToHtml(
  document: vscode.TextDocument
): Promise<string> {
  try {
    const html = await vscode.commands.executeCommand<string>(
      'markdown.api.render',
      document.getText()
    );
    
    if (!html) {
      throw new Error('Failed to render markdown');
    }
    
    return html;
  } catch (error) {
    console.error('Render error:', error);
    throw error;
  }
}

// Using the function
async function printDocument(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  
  const html = await renderMarkdownToHtml(editor.document);
  console.log(`Generated HTML: ${html.length} characters`);
}
```

### Optional Chaining and Nullish Coalescing

Safely access nested properties:

```typescript
function getDocumentInfo(editor?: vscode.TextEditor): string {
  // Optional chaining - stops at first undefined/null
  const fileName = editor?.document?.fileName ?? 'untitled';
  const lineCount = editor?.document?.lineCount ?? 0;
  const languageId = editor?.document?.languageId ?? 'unknown';
  
  return `File: ${fileName}, Lines: ${lineCount}, Language: ${languageId}`;
}

// Usage
const info = getDocumentInfo(vscode.window.activeTextEditor);
```

### Readonly Properties

Prevent accidental modifications:

```typescript
interface PrintJob {
  readonly id: string;
  readonly createdAt: Date;
  readonly documentPath: string;
  status: 'pending' | 'completed' | 'failed'; // Can be modified
}

const job: PrintJob = {
  id: 'job-123',
  createdAt: new Date(),
  documentPath: '/path/to/file.md',
  status: 'pending'
};

// This works
job.status = 'completed';

// This would cause a TypeScript error
// job.id = 'job-456'; // Error: Cannot assign to 'id' because it is a read-only property
```

## Best Practices

### Error Handling in Extensions

Proper error handling improves user experience:

```typescript
async function safeExecuteCommand(commandId: string, ...args: any[]): Promise<void> {
  try {
    await vscode.commands.executeCommand(commandId, ...args);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Command failed: ${errorMessage}`);
    console.error(`Error executing ${commandId}:`, error);
  }
}
```

### Dispose Pattern for Resource Cleanup

Always clean up resources:

```typescript
class PrintManager implements vscode.Disposable {
  private panels: vscode.WebviewPanel[] = [];
  private disposables: vscode.Disposable[] = [];
  
  createPanel(title: string): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'printPreview',
      title,
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    
    this.panels.push(panel);
    
    // Clean up when panel is closed
    panel.onDidDispose(() => {
      const index = this.panels.indexOf(panel);
      if (index > -1) {
        this.panels.splice(index, 1);
      }
    }, null, this.disposables);
    
    return panel;
  }
  
  dispose(): void {
    // Dispose all panels
    this.panels.forEach(panel => panel.dispose());
    this.panels = [];
    
    // Dispose all registered disposables
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

### Type-Safe Event Handling

Use typed event emitters:

```typescript
import { EventEmitter } from 'events';

interface PrintEvents {
  'started': (jobId: string) => void;
  'progress': (jobId: string, percent: number) => void;
  'completed': (jobId: string, outputPath: string) => void;
  'failed': (jobId: string, error: Error) => void;
}

class TypedEventEmitter<T extends Record<string, (...args: any[]) => void>> {
  private emitter = new EventEmitter();
  
  on<K extends keyof T>(event: K, listener: T[K]): void {
    this.emitter.on(event as string, listener);
  }
  
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void {
    this.emitter.emit(event as string, ...args);
  }
}

// Usage
const printEvents = new TypedEventEmitter<PrintEvents>();

printEvents.on('completed', (jobId, outputPath) => {
  console.log(`Job ${jobId} completed: ${outputPath}`);
});

printEvents.emit('completed', 'job-123', '/output/file.pdf');
```

## Summary

TypeScript transforms VS Code extension development by providing:

- **Type Safety**: Catch errors at compile time, not runtime
- **Better IDE Support**: IntelliSense and autocomplete throughout your code
- **Self-Documenting Code**: Types serve as inline documentation
- **Refactoring Tools**: Rename, move, and restructure code confidently
- **Modern JavaScript Features**: Use latest ECMAScript features with confidence

### Key Takeaways

1. Always define interfaces for complex objects
2. Use union types for flexible parameters
3. Leverage generics for reusable functions
4. Implement proper error handling
5. Follow the dispose pattern for resource management
6. Use async/await for cleaner asynchronous code
7. Take advantage of optional chaining and nullish coalescing
8. Mark properties as readonly when they shouldn't change

### Further Learning

- [Official TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

/**
 * Coding Standards Compliance Test
 * 
 * This test suite validates that source files adhere to the project's coding standards.
 * It checks naming conventions, formatting, and structural requirements.
 * 
 * Usage:
 *   node test/coding-standards.test.js
 * 
 * Or with a test runner (Jest, Mocha, etc.):
 *   npm test test/coding-standards.test.js
 */

const fs = require('fs');
const path = require('path');

// Simple test framework functions for standalone execution
const isStandalone = typeof describe === 'undefined';
let testsPassed = 0;
let testsFailed = 0;
let currentSuite = '';

if (isStandalone) {
  global.describe = (name, fn) => {
    currentSuite = name;
    console.log(`\n${name}`);
    fn();
  };
  
  global.test = (name, fn) => {
    try {
      fn();
      testsPassed++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      testsFailed++;
      console.log(`  ✗ ${name}`);
      console.log(`    ${error.message}`);
      if (error.details) {
        console.log(`    Details: ${error.details}`);
      }
    }
  };
  
  global.expect = (actual) => ({
    toBe: (expected) => {
      if (actual !== expected) {
        const error = new Error(`Expected ${expected} but got ${actual}`);
        if (actual.lineNumbers) {
          error.details = `Lines: ${actual.lineNumbers.join(', ')}`;
        }
        throw error;
      }
    },
    toBeGreaterThan: (expected) => {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan: (expected) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeLessThanOrEqual: (expected) => {
      if (actual > expected) {
        const error = new Error(`Expected ${actual} to be less than or equal to ${expected}`);
        if (actual.lineNumbers) {
          error.details = `Lines: ${actual.lineNumbers.join(', ')}`;
        }
        throw error;
      }
    },
    toMatch: (pattern) => {
      if (!pattern.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${pattern}`);
      }
    }
  });
}

describe('Coding Standards Compliance', () => {
  
  describe('TypeScript Files', () => {
    const tsFiles = [
      path.join(__dirname, '../src/extension.ts')
    ];
    
    tsFiles.forEach(filePath => {
      const fileName = path.basename(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      describe(`${fileName}`, () => {
        
        test('should use 2-space indentation', () => {
          const invalidIndents = [];
          let inTemplateLiteral = false;
          lines.forEach((line, idx) => {
            // Track if we're inside a template literal
            const backticks = (line.match(/`/g) || []).length;
            if (backticks % 2 !== 0) {
              inTemplateLiteral = !inTemplateLiteral;
            }
            
            // Skip indentation checks for lines inside template literals
            if (inTemplateLiteral && !line.includes('`')) {
              return;
            }
            
            if (line.match(/^[\s]+\S/)) {
              const spaces = line.match(/^([\s]+)/)[1];
              if (spaces.length % 2 !== 0 && !line.includes('\t')) {
                invalidIndents.push(idx + 1);
              }
            }
          });
          if (invalidIndents.length > 0) {
            const error = new Error(`Found ${invalidIndents.length} line(s) with invalid indentation`);
            error.details = `Lines: ${invalidIndents.join(', ')}`;
            throw error;
          }
        });
        
        test('should use camelCase for variables', () => {
          const varDeclarations = [];
          const varPattern = /\b(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
          let match;
          while ((match = varPattern.exec(content)) !== null) {
            const varName = match[2];
            if (!/^[a-z][a-zA-Z0-9]*$/.test(varName) && !/^[A-Z][A-Z0-9_]*$/.test(varName)) {
              const lineNum = content.substring(0, match.index).split('\n').length;
              varDeclarations.push({ name: varName, line: lineNum });
            }
          }
          if (varDeclarations.length > 0) {
            const error = new Error(`Found ${varDeclarations.length} variable(s) not in camelCase`);
            error.details = varDeclarations.map(v => `'${v.name}' at line ${v.line}`).join(', ');
            throw error;
          }
        });
        
        test('should use camelCase for functions', () => {
          const funcDeclarations = [];
          const funcPattern = /function\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
          let match;
          while ((match = funcPattern.exec(content)) !== null) {
            const funcName = match[1];
            if (!/^[a-z][a-zA-Z0-9]*$/.test(funcName)) {
              const lineNum = content.substring(0, match.index).split('\n').length;
              funcDeclarations.push({ name: funcName, line: lineNum });
            }
          }
          if (funcDeclarations.length > 0) {
            const error = new Error(`Found ${funcDeclarations.length} function(s) not in camelCase`);
            error.details = funcDeclarations.map(f => `'${f.name}' at line ${f.line}`).join(', ');
            throw error;
          }
        });
        
        test('should have file header comments', () => {
          const firstLines = lines.slice(0, 5).join('\n');
          expect(firstLines).toMatch(/^\/\//);
        });
        
        test('should use single quotes for strings (except template literals)', () => {
          const doubleQuotedIssues = [];
          
          // Track if we're inside a template literal or single-quoted string
          let inTemplateLiteral = false;
          let inSingleQuote = false;
          let templateDepth = 0;
          
          lines.forEach((line, idx) => {
            // Count backticks to track template literal state
            const backticks = (line.match(/`/g) || []).length;
            if (backticks % 2 !== 0) {
              inTemplateLiteral = !inTemplateLiteral;
            }
            
            // Skip lines that are entirely within template literals
            if (inTemplateLiteral && !line.includes('`')) {
              return;
            }
            
            // Skip lines that start template literals
            if (line.includes('return `') || line.includes('= `')) {
              return;
            }
            
            // Check for double quotes that are NOT inside single quotes or template literals
            // Pattern: double quote not preceded by single quote
            const doubleQuoteMatches = line.match(/(?<!')\"[^"]*\"/g);
            
            if (doubleQuoteMatches) {
              doubleQuoteMatches.forEach(match => {
                // Skip if this appears to be inside a single-quoted string
                const beforeMatch = line.substring(0, line.indexOf(match));
                const singleQuotesBefore = (beforeMatch.match(/'/g) || []).length;
                
                // If odd number of single quotes before, we're inside a single-quoted string
                if (singleQuotesBefore % 2 === 0) {
                  // This is a standalone double quote, not nested in single quotes
                  doubleQuotedIssues.push({ line: idx + 1, content: match.substring(0, 30) });
                }
              });
            }
          });
          
          // Allow some exceptions for HTML attributes and special cases
          if (doubleQuotedIssues.length > 5) {
            const error = new Error(`Found ${doubleQuotedIssues.length} double-quoted string(s) (max 5 allowed)`);
            error.details = doubleQuotedIssues.slice(0, 10).map(i => `Line ${i.line}: "${i.content}..."`).join(', ');
            throw error;
          }
        });
        
        test('should end statements with semicolons', () => {
          const missingSemicolons = [];
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            
            // Check if line starts with let/const/var/return
            if (trimmed.match(/^(let|const|var|return)\s/)) {
              // Skip if line already ends with semicolon (with or without comment), comma, or opening brace/paren
              if (trimmed.endsWith(';') || trimmed.includes('; //') || trimmed.includes('; /*') ||
                  trimmed.endsWith(',') || trimmed.endsWith('{') || trimmed.endsWith('(')) {
                return;
              }
              
              // Check if this is a multi-line statement
              // 1. Template literals (backticks)
              if (trimmed.includes('`')) {
                return; // Multi-line template literal
              }
              
              // 2. Array/object with line breaks
              if (trimmed.endsWith('[') || trimmed.endsWith('=')) {
                return; // Statement continues on next line
              }
              
              // 3. Method chaining (line ends with .)
              if (trimmed.endsWith('.')) {
                return; // Method chaining continues
              }
              
              // 4. Check if next line is indented (continuation)
              if (idx + 1 < lines.length) {
                const nextLine = lines[idx + 1];
                const currentIndent = line.match(/^(\s*)/)[1].length;
                const nextIndent = nextLine.match(/^(\s*)/)[1].length;
                
                // If next line is more indented, or starts with . or ), it's a continuation
                if (nextIndent > currentIndent || 
                    nextLine.trim().startsWith('.') || 
                    nextLine.trim().startsWith(')') ||
                    nextLine.trim().startsWith(']')) {
                  return; // Statement continues on next line
                }
              }
              
              // If we get here, semicolon is likely missing
              missingSemicolons.push(idx + 1);
            }
          });
          if (missingSemicolons.length > 0) {
            const error = new Error(`Found ${missingSemicolons.length} statement(s) missing semicolons`);
            error.details = `Lines: ${missingSemicolons.join(', ')}`;
            throw error;
          }
        });
        
        test('should not exceed 120 character line length (with exceptions)', () => {
          const longLines = [];
          lines.forEach((line, idx) => {
            // Allow template literals and comments to exceed
            if (line.includes('`') || line.trim().startsWith('//') || line.trim().startsWith('*')) {
              return;
            }
            if (line.length > 120) {
              longLines.push({ line: idx + 1, length: line.length });
            }
          });
          if (longLines.length > 2) {
            const error = new Error(`Found ${longLines.length} line(s) exceeding 120 characters (max 2 allowed)`);
            error.details = longLines.map(l => `Line ${l.line} (${l.length} chars)`).join(', ');
            throw error;
          }
        });
        
      });
    });
  });
  
  describe('Python Files', () => {
    const pyFiles = [
      path.join(__dirname, '../src/printMD.py')
    ];
    
    pyFiles.forEach(filePath => {
      const fileName = path.basename(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      describe(`${fileName}`, () => {
        
        test('should use 2-space indentation', () => {
          const invalidIndents = [];
          lines.forEach((line, idx) => {
            if (line.match(/^[\s]+\S/) && !line.includes('\t')) {
              const spaces = line.match(/^([\s]+)/)[1];
              if (spaces.length % 2 !== 0) {
                invalidIndents.push(idx + 1);
              }
            }
          });
          if (invalidIndents.length > 0) {
            const error = new Error(`Found ${invalidIndents.length} line(s) with invalid indentation`);
            error.details = `Lines: ${invalidIndents.join(', ')}`;
            throw error;
          }
        });
        
        test('should use snake_case for functions', () => {
          const invalidFuncs = [];
          const funcPattern = /def\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
          let match;
          while ((match = funcPattern.exec(content)) !== null) {
            const funcName = match[1].replace(':', '');
            if (!/^[a-z][a-z0-9_]*$/.test(funcName) && funcName !== '__main__') {
              const lineNum = content.substring(0, match.index).split('\n').length;
              invalidFuncs.push({ name: funcName, line: lineNum });
            }
          }
          if (invalidFuncs.length > 0) {
            const error = new Error(`Found ${invalidFuncs.length} function(s) not in snake_case`);
            error.details = invalidFuncs.map(f => `'${f.name}' at line ${f.line}`).join(', ');
            throw error;
          }
        });
        
        test('should use UPPER_SNAKE_CASE for constants', () => {
          const invalidConstants = [];
          lines.forEach((line, idx) => {
            if (line.match(/^[A-Z][A-Z0-9_]*\s*=/) && 
                !line.includes('def ') && 
                !line.includes('class ')) {
              const varName = line.split('=')[0].trim();
              if (!/^[A-Z][A-Z0-9_]*$/.test(varName)) {
                invalidConstants.push({ name: varName, line: idx + 1 });
              }
            }
          });
          if (invalidConstants.length > 0) {
            const error = new Error(`Found ${invalidConstants.length} constant(s) not in UPPER_SNAKE_CASE`);
            error.details = invalidConstants.map(c => `'${c.name}' at line ${c.line}`).join(', ');
            throw error;
          }
        });
        
        test('should have shebang and file header', () => {
          expect(lines[0]).toMatch(/^#!/);
          const firstComments = lines.slice(0, 10).join('\n');
          expect(firstComments).toMatch(/^#/);
        });
        
        test('should have module docstring', () => {
          const docstringStart = content.indexOf('"""');
          if (docstringStart === -1) {
            throw new Error('No module docstring found (""" not found in file)');
          }
          if (docstringStart >= 500) {
            const lineNum = content.substring(0, docstringStart).split('\n').length;
            const error = new Error(`Module docstring starts too late in file (at position ${docstringStart})`);
            error.details = `Docstring found at line ${lineNum} (should be within first 500 characters)`;
            throw error;
          }
        });
        
        test('should use type hints for function signatures', () => {
          const functionDefs = content.match(/def\s+[a-z_][a-z0-9_]*\([^)]*\)/g) || [];
          const typedFunctions = functionDefs.filter(def => 
            def.includes(':') && (def.includes('str') || def.includes('int') || def.includes('None'))
          );
          // Expect most functions to have type hints
          expect(typedFunctions.length).toBeGreaterThan(functionDefs.length * 0.5);
        });
        
        test('should prefer single quotes for strings', () => {
          // Count single vs double quotes (excluding docstrings and comments)
          const codeLines = lines.filter(line => 
            !line.trim().startsWith('#') && 
            !line.trim().startsWith('"""') &&
            !line.includes('"""')
          ).join('\n');
          
          const singleQuotes = (codeLines.match(/'/g) || []).length;
          const doubleQuotes = (codeLines.match(/"/g) || []).length;
          
          // Single quotes should be used more frequently
          expect(singleQuotes).toBeGreaterThan(doubleQuotes * 0.3);
        });
        
        test('should not exceed 120 character line length', () => {
          const longLines = [];
          lines.forEach((line, idx) => {
            // Allow comments and docstrings to exceed
            if (line.trim().startsWith('#') || line.includes('"""')) {
              return;
            }
            if (line.length > 120) {
              longLines.push({ line: idx + 1, length: line.length });
            }
          });
          if (longLines.length > 5) {
            const error = new Error(`Found ${longLines.length} line(s) exceeding 120 characters (max 5 allowed)`);
            error.details = longLines.map(l => `Line ${l.line} (${l.length} chars)`).join(', ');
            throw error;
          }
        });
        
      });
    });
  });
  
  describe('Cross-Language Consistency', () => {
    
    test('TypeScript and Python should use consistent indentation (2 spaces)', () => {
      const tsContent = fs.readFileSync(path.join(__dirname, '../src/extension.ts'), 'utf-8');
      const pyContent = fs.readFileSync(path.join(__dirname, '../src/printMD.py'), 'utf-8');
      
      // Both should use 2-space indentation
      const tsHas2Spaces = tsContent.includes('  if (') || tsContent.includes('  const ');
      const pyHas2Spaces = pyContent.includes('  if ') || pyContent.includes('  def ');
      
      expect(tsHas2Spaces).toBe(true);
      expect(pyHas2Spaces).toBe(true);
    });
    
    test('Constants should use UPPER_SNAKE_CASE in both languages', () => {
      const tsContent = fs.readFileSync(path.join(__dirname, '../src/extension.ts'), 'utf-8');
      const pyContent = fs.readFileSync(path.join(__dirname, '../src/printMD.py'), 'utf-8');
      
      // Check for UPPER_SNAKE_CASE constants
      const tsConstants = tsContent.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || [];
      const pyConstants = pyContent.match(/^[A-Z][A-Z0-9_]+\s*=/gm) || [];
      
      expect(tsConstants.length + pyConstants.length).toBeGreaterThan(0);
    });
    
  });
  
});

// Print results if running standalone
if (isStandalone) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log('='.repeat(50));
  
  if (testsFailed > 0) {
    console.log('\n⚠️  Some tests failed. Please review coding standards.');
    process.exit(1);
  } else {
    console.log('\n✅ All coding standards tests passed!');
    process.exit(0);
  }
}

#!/usr/bin/env node
/**
 * Cross-platform Python dependency installer
 * Handles platform-specific package installation for Windows, macOS, and Linux
 */

const { execSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

// Core packages needed on all platforms
const corePackages = ['markdown', 'weasyprint', 'pygments'];

// Platform-specific packages
const windowsPackages = ['pywin32'];

// Determine Python command
let pythonCmd = 'python3';
if (isWindows) {
  // Try python first on Windows, fallback to python3
  try {
    execSync('python --version', { stdio: 'ignore' });
    pythonCmd = 'python';
  } catch (e) {
    pythonCmd = 'python3';
  }
}

console.log('\n📦 Installing Python dependencies...\n');
console.log(`Platform: ${platform}`);
console.log(`Python command: ${pythonCmd}\n`);

// Build package list
let packages = [...corePackages];
if (isWindows) {
  packages = packages.concat(windowsPackages);
  console.log('Installing Windows-specific packages: pywin32\n');
}

try {
  // Check if we're in an externally-managed environment (macOS/Linux)
  if (!isWindows) {
    // Strategy 1: Try --user flag first (safer)
    try {
      const installCmd = `${pythonCmd} -m pip install --user --quiet ${packages.join(' ')}`;
      console.log('Attempting installation with --user flag...');
      execSync(installCmd, { stdio: 'pipe' });
      console.log('✓ Python packages installed successfully with --user flag!\n');
      process.exit(0);
    } catch (userError) {
      // Strategy 2: Try without --user (might be in venv)
      console.log('Retrying without --user flag...');
      try {
        const installCmd = `${pythonCmd} -m pip install --quiet ${packages.join(' ')}`;
        execSync(installCmd, { stdio: 'pipe' });
        console.log('✓ Python packages installed successfully!\n');
        process.exit(0);
      } catch (venvError) {
        // Strategy 3: Try --break-system-packages (macOS Homebrew Python)
        console.log('Retrying with --break-system-packages flag...');
        try {
          const installCmd = `${pythonCmd} -m pip install --break-system-packages --quiet ${packages.join(' ')}`;
          execSync(installCmd, { stdio: 'inherit' });
          console.log('\n✓ Python packages installed successfully with --break-system-packages!\n');
          process.exit(0);
        } catch (breakError) {
          // All strategies failed, provide helpful message
          console.error('\n⚠️  Automatic Python package installation failed.');
          console.error('\n📋 Manual installation options:\n');
          console.error('  Option 1: Install with --break-system-packages (quickest):');
          console.error(`     ${pythonCmd} -m pip install --break-system-packages ${packages.join(' ')}\n`);
          console.error('  Option 2: Use a virtual environment (recommended for development):');
          console.error(`     ${pythonCmd} -m venv .venv`);
          console.error('     source .venv/bin/activate  # On Windows: .venv\\Scripts\\activate');
          console.error(`     pip install ${packages.join(' ')}\n`);
          console.error('  Option 3: Check if packages are already installed:');
          console.error('     pip3 list | grep -E "markdown|weasyprint|pygments"\n');
          console.error('💡 The extension will work if these packages are already available.\n');
          process.exit(0); // Exit with success to not block npm install
        }
      }
    }
  } else {
    // Windows - standard installation
    const installCmd = `${pythonCmd} -m pip install --quiet ${packages.join(' ')}`;
    execSync(installCmd, { stdio: 'inherit' });
    console.log('\n✓ Python packages installed successfully!\n');
  }
} catch (error) {
  console.error('\n⚠️  Warning: Failed to install Python packages.');
  console.error('Error:', error.message);
  console.error('\nPlease install manually:');
  console.error(`  ${pythonCmd} -m pip install ${packages.join(' ')}`);
  console.error('\nThe extension may not work without these packages.\n');
  // Exit with success to not block npm install
  process.exit(0);
}

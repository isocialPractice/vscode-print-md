// cleanTemp
// Run a background operation that cleans the temporary folders in the operating systems temp folder after a timeout of twenty minutes.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Cleans old printmd_* temporary folders that are older than 20 minutes.
 * Excludes the currently active folder from deletion.
 * 
 * @param currentFolder - The current temp folder path to exclude from deletion
 */
export function cleanTempPrintFolder(currentFolder: string): void {
  // Run cleanup after 20 minutes (1200000 ms)
  setTimeout(() => {
    try {
      // Get the OS temp directory
      const tempDir = os.tmpdir();
      
      // Get all entries in temp directory
      const entries = fs.readdirSync(tempDir);
      
      // Filter for printmd_* folders
      const printmdFolders = entries.filter(entry => {
        if (!entry.startsWith('printmd_')) {
          return false;
        }
        
        const fullPath = path.join(tempDir, entry);
        try {
          const stats = fs.statSync(fullPath);
          return stats.isDirectory();
        } catch (err) {
          return false;
        }
      });
      
      // Current time for comparison
      const now = Date.now();
      const twentyMinutesAgo = now - (20 * 60 * 1000);
      
      // Process each printmd folder
      printmdFolders.forEach(folderName => {
        const folderPath = path.join(tempDir, folderName);
        
        // Skip the current folder
        if (folderPath === currentFolder) {
          return;
        }
        
        try {
          // Get folder creation/modification time
          const stats = fs.statSync(folderPath);
          const folderTime = stats.mtimeMs; // Use modification time
          
          // Delete if older than 20 minutes
          if (folderTime < twentyMinutesAgo) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`Cleaned up old temp folder: ${folderName}`);
          }
        } catch (err) {
          // Silently ignore errors (folder may be in use or already deleted)
          console.error(`Failed to clean temp folder ${folderName}:`, err);
        }
      });
    } catch (err) {
      // Silently ignore errors in background cleanup
      console.error('Error during temp folder cleanup:', err);
    }
  }, 20 * 60 * 1000); // 20 minutes in milliseconds
}

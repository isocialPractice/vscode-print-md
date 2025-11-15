"use strict";
// cleanTemp
// Run a background operation that cleans the temporary folders in the operating systems temp folder after a timeout of twenty minutes.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanTempPrintFolder = cleanTempPrintFolder;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Cleans old printmd_* temporary folders that are older than 20 minutes.
 * Excludes the currently active folder from deletion.
 *
 * @param currentFolder - The current temp folder path to exclude from deletion
 */
function cleanTempPrintFolder(currentFolder) {
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
                }
                catch (err) {
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
                }
                catch (err) {
                    // Silently ignore errors (folder may be in use or already deleted)
                    console.error(`Failed to clean temp folder ${folderName}:`, err);
                }
            });
        }
        catch (err) {
            // Silently ignore errors in background cleanup
            console.error('Error during temp folder cleanup:', err);
        }
    }, 20 * 60 * 1000); // 20 minutes in milliseconds
}
//# sourceMappingURL=cleanTemp.js.map
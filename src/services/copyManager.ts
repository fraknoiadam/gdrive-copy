import type { GoogleDriveAPI } from '../api/googleDrive.js';
import type { CopyResult } from '../types/index.js';

export interface RenamePattern {
  from: string;
  to: string;
}

export class CopyManager {
  private api: GoogleDriveAPI;

  constructor(api: GoogleDriveAPI) {
    this.api = api;
  }

  /**
   * Apply regex-based renaming to a filename
   */
  private applyRenamePattern(filename: string, pattern: RenamePattern): string {
    try {
      // If pattern is empty, return original name
      if (!pattern.from || !pattern.to) {
        return filename;
      }

      // Special case: if using default pattern (.*)/$1, return original name
      // This ensures we don't unnecessarily process files that shouldn't be renamed
      if (pattern.from === '(.*)' && pattern.to === '$1') {
        return filename;
      }

      const regex = new RegExp(pattern.from);
      const newName = filename.replace(regex, pattern.to);
      
      // Always return the result of the replacement, even if it's the same
      // This prevents Google Drive from adding "Copy of" prefix
      if (newName === filename && !regex.test(filename)) {
        console.log(`Regex pattern "${pattern.from}" did not match filename "${filename}", but will use original name to avoid "Copy of" prefix`);
      } else {
        console.log(`Renamed "${filename}" to "${newName}" using pattern "${pattern.from}" -> "${pattern.to}"`);
      }
      
      return newName;
    } catch (error) {
      console.error(`Error applying rename pattern to "${filename}":`, error);
      return filename; // Return original name if regex fails
    }
  }

  async createFolder(name: string, parentFolderId: string, renamePattern?: RenamePattern): Promise<string> {
    try {
      let finalName = name;
      
      if (renamePattern) {
        // Check if we're using the default "no rename" pattern
        if (renamePattern.from === '(.*)' && renamePattern.to === '$1') {
          // Keep original name
          finalName = name;
        } else {
          // Apply rename pattern
          finalName = this.applyRenamePattern(name, renamePattern);
        }
      }
      
      const result = await this.api.createFolder(finalName, parentFolderId);
      return result.id;
    } catch (error) {
      console.error(`Failed to create folder ${name}:`, error);
      throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async copyFile(fileId: string, destinationFolderId: string, originalName?: string, renamePattern?: RenamePattern): Promise<any> {
    try {
      let newName: string | undefined;
      
      if (originalName && renamePattern) {
        // Check if we're using the default "no rename" pattern
        if (renamePattern.from === '(.*)' && renamePattern.to === '$1') {
          // Use undefined to let Google Drive handle naming naturally
          newName = undefined;
        } else {
          // Always apply the rename pattern to get a consistent name
          newName = this.applyRenamePattern(originalName, renamePattern);
          // Always use the result to prevent Google Drive from adding "Copy of" prefix
          // Even if the name didn't change, explicitly setting it prevents the auto-prefix
        }
      }
      
      const result = await this.api.copyFile(fileId, destinationFolderId, newName);
      return result;
    } catch (error) {
      console.error(`Failed to copy file ${fileId}:`, error);
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async copyItem(fileId: string, destinationFolderId: string, originalName?: string, renamePattern?: RenamePattern): Promise<any> {
    // Keeping for backward compatibility
    return this.copyFile(fileId, destinationFolderId, originalName, renamePattern);
  }

  async copyMultipleItems(
    fileIds: string[], 
    destinationFolderId: string, 
    onProgress?: (copied: number, total: number) => void,
    renamePattern?: RenamePattern
  ): Promise<CopyResult[]> {
    const results: CopyResult[] = [];
    let copiedCount = 0;

    for (const fileId of fileIds) {
      try {
        const result = await this.copyItem(fileId, destinationFolderId, undefined, renamePattern);
        results.push({ fileId, success: true, result });
        copiedCount++;
      } catch (error) {
        results.push({ 
          fileId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      if (onProgress) {
        onProgress(copiedCount, fileIds.length);
      }
    }

    return results;
  }
}

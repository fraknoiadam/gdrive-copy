import type { GoogleDriveAPI } from '../api/googleDrive.js';
import type { CopyResult, RenameSettings } from '../types/index.js';

export class CopyManager {
  private api: GoogleDriveAPI;

  constructor(api: GoogleDriveAPI) {
    this.api = api;
  }

  /**
   * Apply list-based renaming to a filename
   */
  private applyRenameSettings(filename: string, settings: RenameSettings): string {
    if (!settings.mappings || settings.mappings.length === 0) {
      return filename;
    }

    let result = filename;
    
    // Apply each mapping in order
    for (const mapping of settings.mappings) {
      const { from, to } = mapping;
      
      // Handle different types of replacements
      if (from === '') {
        // Empty 'from' means add prefix (if 'to' has content)
        if (to !== '') {
          result = to + result;
        }
      } else {
        // Replace all occurrences of 'from' with 'to'
        result = result.split(from).join(to);
      }
    }

    if (result !== filename) {
      console.log(`Renamed "${filename}" to "${result}" using mappings:`, settings.mappings);
    }
    
    return result;
  }

  async createFolder(name: string, parentFolderId: string, renameSettings?: RenameSettings): Promise<string> {
    try {
      let finalName = name;
      
      if (renameSettings && renameSettings.mappings.length > 0) {
        finalName = this.applyRenameSettings(name, renameSettings);
      }
      
      const result = await this.api.createFolder(finalName, parentFolderId);
      return result.id;
    } catch (error) {
      console.error(`Failed to create folder ${name}:`, error);
      throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async copyFile(fileId: string, destinationFolderId: string, originalName?: string, renameSettings?: RenameSettings): Promise<any> {
    try {
      let newName: string | undefined;
      
      if (originalName && renameSettings && renameSettings.mappings.length > 0) {
        // Apply the rename settings to get a consistent name
        newName = this.applyRenameSettings(originalName, renameSettings);
        // Always use the result to prevent Google Drive from adding "Copy of" prefix
        // Even if the name didn't change, explicitly setting it prevents the auto-prefix
      }
      
      const result = await this.api.copyFile(fileId, destinationFolderId, newName);
      return result;
    } catch (error) {
      console.error(`Failed to copy file ${fileId}:`, error);
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async copyItem(fileId: string, destinationFolderId: string, originalName?: string, renameSettings?: RenameSettings): Promise<any> {
    // Keeping for backward compatibility
    return this.copyFile(fileId, destinationFolderId, originalName, renameSettings);
  }

  async copyMultipleItems(
    fileIds: string[], 
    destinationFolderId: string, 
    onProgress?: (copied: number, total: number) => void,
    renameSettings?: RenameSettings
  ): Promise<CopyResult[]> {
    const results: CopyResult[] = [];
    let copiedCount = 0;

    for (const fileId of fileIds) {
      try {
        const result = await this.copyItem(fileId, destinationFolderId, undefined, renameSettings);
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

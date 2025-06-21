import type { GoogleDriveAPI } from '../api/googleDrive.js';
import type { CopyResult } from '../types/index.js';

export class CopyManager {
  private api: GoogleDriveAPI;

  constructor(api: GoogleDriveAPI) {
    this.api = api;
  }

  async createFolder(name: string, parentFolderId: string): Promise<string> {
    try {
      const result = await this.api.createFolder(name, parentFolderId);
      return result.id;
    } catch (error) {
      console.error(`Failed to create folder ${name}:`, error);
      throw new Error(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async copyFile(fileId: string, destinationFolderId: string): Promise<any> {
    try {
      const result = await this.api.copyFile(fileId, destinationFolderId);
      return result;
    } catch (error) {
      console.error(`Failed to copy file ${fileId}:`, error);
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async copyItem(fileId: string, destinationFolderId: string): Promise<any> {
    // Keeping for backward compatibility
    return this.copyFile(fileId, destinationFolderId);
  }

  async copyMultipleItems(fileIds: string[], destinationFolderId: string, onProgress?: (copied: number, total: number) => void): Promise<CopyResult[]> {
    const results: CopyResult[] = [];
    let copiedCount = 0;

    for (const fileId of fileIds) {
      try {
        const result = await this.copyItem(fileId, destinationFolderId);
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

export class CopyManager {
  constructor(api) {
    this.api = api;
  }

  async copyItem(fileId, destinationFolderId) {
    try {
      const result = await this.api.copyFile(fileId, destinationFolderId);
      return result;
    } catch (error) {
      console.error(`Failed to copy item ${fileId}:`, error);
      throw new Error(`Failed to copy item: ${error.message}`);
    }
  }

  async copyMultipleItems(fileIds, destinationFolderId, onProgress = null) {
    const results = [];
    let copiedCount = 0;

    for (const fileId of fileIds) {
      try {
        const result = await this.copyItem(fileId, destinationFolderId);
        results.push({ fileId, success: true, result });
        copiedCount++;
      } catch (error) {
        results.push({ fileId, success: false, error: error.message });
      }

      if (onProgress) {
        onProgress(copiedCount, fileIds.length);
      }
    }

    return results;
  }
}

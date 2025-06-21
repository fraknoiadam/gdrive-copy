export class FolderManager {
  constructor(api) {
    this.api = api;
  }

  async loadFolderStructure(folderId) {
    const structure = await this._fetchFolderContents(folderId);
    return structure;
  }

  async _fetchFolderContents(folderId, path = '') {
    const items = [];
    let nextPageToken = null;

    do {
      const response = await this.api.listFiles(folderId, nextPageToken);
      const files = response.files || [];

      for (const file of files) {
        const item = {
          id: file.id,
          name: file.name,
          type: this.api.isFolder(file.mimeType) ? 'folder' : 'file',
          path: path + '/' + file.name,
          children: []
        };

        // Recursively fetch folder contents for folders
        if (item.type === 'folder') {
          try {
            item.children = await this._fetchFolderContents(file.id, item.path);
          } catch (error) {
            console.warn(`Failed to load contents of folder ${file.name}:`, error);
            // Continue with empty children array
          }
        }

        items.push(item);
      }

      nextPageToken = response.nextPageToken;
    } while (nextPageToken);

    // Sort items: folders first, then files, both alphabetically
    return items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
}

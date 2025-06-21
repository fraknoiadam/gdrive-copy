import type { FolderItem, SelectionState, SelectedItem } from '../types/index.js';
import type { GoogleDriveAPI } from '../api/googleDrive.js';

export class FolderManager {
  private api: GoogleDriveAPI;
  public selectionStates: Map<string, SelectionState> = new Map();

  constructor(api: GoogleDriveAPI) {
    this.api = api;
  }

  async loadFolderStructure(folderId: string): Promise<FolderItem[]> {
    const structure = await this._fetchFolderContents(folderId);
    // Initialize all items as unselected
    this._initializeSelectionStates(structure);
    return structure;
  }

  private _initializeSelectionStates(items: FolderItem[]): void {
    for (const item of items) {
      this.selectionStates.set(item.id, 'none');
      if (item.children && item.children.length > 0) {
        this._initializeSelectionStates(item.children);
      }
    }
  }

  // Cycle through selection states: none -> all -> folder-only -> none
  cycleSelection(itemId: string, structure: FolderItem[]): SelectionState {
    const currentState = this.selectionStates.get(itemId) || 'none';
    const item = this._findItemById(itemId, structure);
    
    if (!item) return currentState;

    let newState: SelectionState;
    if (item.type === 'folder' && item.children.length > 0) {
      // For folders with children: none -> all -> folder-only -> none
      switch (currentState) {
        case 'none':
          newState = 'all';
          break;
        case 'all':
          newState = 'folder-only';
          break;
        case 'folder-only':
          newState = 'none';
          break;
        default:
          newState = 'all';
      }
    } else {
      // For files or empty folders: none -> all -> none
      switch (currentState) {
        case 'none':
          newState = 'all';
          break;
        case 'all':
          newState = 'none';
          break;
        default:
          newState = 'all';
      }
    }

    this.selectionStates.set(itemId, newState);
    this._updateChildrenStates(item, newState);
    this._updateParentStates(itemId, structure);
    
    return newState;
  }

  private _updateChildrenStates(item: FolderItem, parentState: SelectionState): void {
    if (!item.children) return;

    for (const child of item.children) {
      if (parentState === 'all') {
        this.selectionStates.set(child.id, 'all');
        this._updateChildrenStates(child, 'all');
      } else if (parentState === 'none' || parentState === 'folder-only') {
        this.selectionStates.set(child.id, 'none');
        this._updateChildrenStates(child, 'none');
      }
    }
  }

  private _updateParentStates(itemId: string, structure: FolderItem[]): void {
    const parent = this._findParentOfItem(itemId, structure);
    if (!parent) return;

    const childrenStates = parent.children.map(child => 
      this.selectionStates.get(child.id) || 'none'
    );

    const allSelected = childrenStates.every(state => state === 'all');
    const noneSelected = childrenStates.every(state => state === 'none');
    const parentFolderState = this.selectionStates.get(parent.id);

    if (allSelected && (parentFolderState === 'folder-only' || parentFolderState === 'all')) {
      this.selectionStates.set(parent.id, 'all');
    } else if (noneSelected && parentFolderState !== 'folder-only') {
      this.selectionStates.set(parent.id, 'none');
    } else {
      // Some children selected, some not
      const hasAnySelection = childrenStates.some(state => state !== 'none');
      if (hasAnySelection || parentFolderState === 'folder-only') {
        this.selectionStates.set(parent.id, 'partial');
      }
    }

    this._updateParentStates(parent.id, structure);
  }

  private _findItemById(id: string, items: FolderItem[]): FolderItem | null {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = this._findItemById(id, item.children);
        if (found) return found;
      }
    }
    return null;
  }

  private _findParentOfItem(itemId: string, items: FolderItem[], parent: FolderItem | null = null): FolderItem | null {
    for (const item of items) {
      if (item.id === itemId) return parent;
      if (item.children) {
        const found = this._findParentOfItem(itemId, item.children, item);
        if (found) return found;
      }
    }
    return null;
  }

  getSelectionState(itemId: string): SelectionState {
    return this.selectionStates.get(itemId) || 'none';
  }

  // Get all selected items for copying
  getSelectedItems(structure: FolderItem[]): SelectedItem[] {
    const selected: SelectedItem[] = [];
    this._collectSelectedItems(structure, selected);
    return selected;
  }

  private _collectSelectedItems(items: FolderItem[], selected: SelectedItem[]): void {
    for (const item of items) {
      const state = this.selectionStates.get(item.id);
      
      if (state === 'all' || state === 'folder-only') {
        selected.push({
          item: item,
          selectionType: state,
          includeChildren: state === 'all'
        });
      } else if (state === 'partial' && item.children) {
        // For partial selection, add the folder if needed and continue with children
        const hasSelectedChildren = item.children.some(child => 
          ['all', 'folder-only', 'partial'].includes(this.selectionStates.get(child.id) || 'none')
        );
        
        if (hasSelectedChildren) {
          selected.push({
            item: item,
            selectionType: 'folder-only',
            includeChildren: false
          });
        }
        
        this._collectSelectedItems(item.children, selected);
      }
    }
  }

  private async _fetchFolderContents(folderId: string, path: string = ''): Promise<FolderItem[]> {
    const items: FolderItem[] = [];
    let nextPageToken: string | undefined = undefined;

    do {
      const response = await this.api.listFiles(folderId, nextPageToken);
      const files = response.files || [];

      for (const file of files) {
        const item: FolderItem = {
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

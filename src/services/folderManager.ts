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
        case 'partial':
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
        case 'partial':
          newState = 'all';
          break;
        case 'all':
          newState = 'none';
          break;
        default:
          newState = 'all';
      }
    }

    console.log(`Cycling selection for "${item.name}": ${currentState} -> ${newState}`);
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
    const parentFolderState = this.selectionStates.get(parent.id) || 'none';

    // Check if all children are effectively fully selected (including partial states that cover all content)
    const allEffectivelySelected = childrenStates.every(state => {
      if (state === 'all') return true;
      if (state === 'partial') {
        // For partial state, check if it effectively covers all children
        const child = parent.children.find(c => this.selectionStates.get(c.id) === 'partial');
        if (child) {
          return this._isFullySelectedRecursive(child);
        }
      }
      return false;
    });

    if (allSelected || allEffectivelySelected) {
      // All children are selected - parent should be 'all' unless it was explicitly set to folder-only
      this.selectionStates.set(parent.id, 'all');
    } else if (noneSelected) {
      // No children selected
      if (parentFolderState === 'folder-only') {
        // Keep folder-only if it was explicitly set
        this.selectionStates.set(parent.id, 'folder-only');
      } else {
        this.selectionStates.set(parent.id, 'none');
      }
    } else {
      // Some children selected, some not - this is partial
      this.selectionStates.set(parent.id, 'partial');
    }

    this._updateParentStates(parent.id, structure);
  }

  private _isFullySelectedRecursive(item: FolderItem): boolean {
    const state = this.selectionStates.get(item.id) || 'none';
    
    if (state === 'all') return true;
    if (state === 'none' || state === 'folder-only') return false;
    
    // For partial state, check if all children are effectively selected
    if (state === 'partial' && item.children) {
      return item.children.every(child => this._isFullySelectedRecursive(child));
    }
    
    return false;
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

  // New method to count actual items that will be copied
  getSelectedItemCount(structure: FolderItem[]): number {
    return this._countSelectedItems(structure);
  }

  private _countSelectedItems(items: FolderItem[]): number {
    let count = 0;
    
    for (const item of items) {
      const state = this.selectionStates.get(item.id) || 'none';
      
      if (state === 'all') {
        // Count this item and all its children recursively
        count += this._countAllItems(item);
      } else if (state === 'folder-only') {
        // Count only the folder itself
        count += 1;
      } else if (state === 'partial' && item.children) {
        // For partial selection, count selected children recursively
        count += this._countSelectedItems(item.children);
      }
      // 'none' state contributes 0 to the count
    }
    
    return count;
  }

  private _countAllItems(item: FolderItem): number {
    let count = 1; // Count the item itself
    
    if (item.children) {
      for (const child of item.children) {
        count += this._countAllItems(child);
      }
    }
    
    return count;
  }

  private _collectSelectedItems(items: FolderItem[], selected: SelectedItem[]): void {
    for (const item of items) {
      const state = this.selectionStates.get(item.id);
      
      if (state === 'all') {
        // When a folder is selected with 'all', include it and skip its children
        // (children will be processed as part of the parent)
        selected.push({
          item: item,
          selectionType: state,
          includeChildren: true
        });
        // Don't recurse into children - they're handled by the parent
      } else if (state === 'folder-only') {
        selected.push({
          item: item,
          selectionType: state,
          includeChildren: false
        });
        // Still need to check children in case some are individually selected
        if (item.children) {
          this._collectSelectedItems(item.children, selected);
        }
      } else if (state === 'partial' && item.children) {
        // For partial selection, don't include the folder itself unless it has explicit folder-only selection
        // Just recurse into children to find individually selected items
        this._collectSelectedItems(item.children, selected);
      }
      // For 'none' state, skip this item and don't recurse
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

  // Test method to verify counting logic (can be removed in production)
  debugSelectionCount(structure: FolderItem[]): void {
    console.log('=== Selection Count Debug ===');
    const selectedItems = this.getSelectedItems(structure);
    const actualCount = this.getSelectedItemCount(structure);
    
    console.log(`Selected items (nodes): ${selectedItems.length}`);
    console.log(`Actual items to copy: ${actualCount}`);
    
    console.log('Selection details:');
    selectedItems.forEach(item => {
      const childrenInfo = item.item.children ? ` (${item.item.children.length} children)` : '';
      console.log(`- ${item.item.name} [${item.item.type}] (${item.selectionType}, includeChildren: ${item.includeChildren})${childrenInfo}`);
    });
    
    console.log('Full selection state map:');
    this.selectionStates.forEach((state, id) => {
      if (state !== 'none') {
        const item = this._findItemById(id, structure);
        if (item) {
          console.log(`  ${item.name} [${item.type}]: ${state}`);
        }
      }
    });
    
    console.log('=== End Debug ===');
  }
}

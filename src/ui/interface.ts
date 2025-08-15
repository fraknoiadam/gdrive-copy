import type { FolderItem, RenameSettings } from '../types/index.js';
import type { FolderManager } from '../services/folderManager.js';

export class UI {
  private folderTreeContainer: HTMLElement;
  private folderSection: HTMLElement;
  private copySection: HTMLElement;
  private loadBtn: HTMLButtonElement;
  private loadSpinner: HTMLElement;
  private progressContainer: HTMLElement;
  private progressFill: HTMLElement;
  private progressText: HTMLElement;
  private selectionCount: HTMLElement;
  private renameMappingsContainer: HTMLElement;
  private addRenameMappingBtn: HTMLElement;
  private enableRenameCheckbox: HTMLInputElement;
  private renameConfig: HTMLElement;

  constructor() {
    this.folderTreeContainer = this.getElement('folder-tree');
    this.folderSection = this.getElement('folder-section');
    this.copySection = this.getElement('copy-section');
    this.loadBtn = this.getElement('load-btn') as HTMLButtonElement;
    this.loadSpinner = this.getElement('load-spinner');
    this.progressContainer = this.getElement('progress-container');
    this.progressFill = this.getElement('progress-fill');
    this.progressText = this.getElement('progress-text');
    this.selectionCount = this.getElement('selection-count');
    this.renameMappingsContainer = this.getElement('rename-mappings');
    this.addRenameMappingBtn = this.getElement('add-rename-mapping');
    this.enableRenameCheckbox = this.getElement('enable-rename') as HTMLInputElement;
    this.renameConfig = this.getElement('rename-config');
    
    this.setupRenameEventListeners();
  }

  private getElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Element with id '${id}' not found`);
    }
    return element;
  }

  enableLoadButton(): void {
    this.loadBtn.disabled = false;
  }

  showLoadingSpinner(): void {
    this.loadSpinner.classList.remove('hidden');
  }

  hideLoadingSpinner(): void {
    this.loadSpinner.classList.add('hidden');
  }

  showFolderSection(): void {
    this.folderSection.classList.remove('hidden');
  }

  showCopySection(): void {
    this.copySection.classList.remove('hidden');
  }

  showProgressContainer(): void {
    this.progressContainer.classList.remove('hidden');
  }

  updateProgress(percentage: number, text: string): void {
    this.progressFill.style.width = `${percentage}%`;
    this.progressText.textContent = text;
  }

  updateSelectionCount(count: number): void {
    this.selectionCount.textContent = `${count} items selected`;
  }

  renderFolderTree(items: FolderItem[], onSelectionChange: (itemId: string) => void, folderManager: FolderManager): void {
    this.folderTreeContainer.innerHTML = '';
    // Store reference for updates if needed in the future
    // this.folderManager = folderManager;
    this._renderItems(items, this.folderTreeContainer, 0, onSelectionChange, null);
    // After initial render, update visibility based on current selection states
    this.updateVisibilityBySelection(folderManager);
  }

  private _renderItems(items: FolderItem[], container: HTMLElement, level: number, onSelectionChange: (itemId: string) => void, parentId: string | null): void {
    items.forEach(item => {
      const itemElement = this._createItemElement(item, level, onSelectionChange);
      // annotate hierarchy metadata for visibility control
      itemElement.dataset.level = String(level);
      itemElement.dataset.parentId = parentId ?? '';
      itemElement.dataset.type = item.type;
      container.appendChild(itemElement);

      if (item.children && item.children.length > 0) {
        this._renderItems(item.children, container, level + 1, onSelectionChange, item.id);
      }
    });
  }

  private _createItemElement(item: FolderItem, level: number, onSelectionChange: (itemId: string) => void): HTMLElement {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'folder-item';
    itemDiv.style.paddingLeft = `${level * 1.5 + 0.75}rem`;
    itemDiv.dataset.itemId = item.id;
    // annotate type & level for quick checks
    itemDiv.dataset.type = item.type;
    itemDiv.dataset.level = String(level);

    // Selection indicator (not a checkbox, but a visual indicator)
    const selectionIndicator = document.createElement('span');
    selectionIndicator.className = 'selection-indicator';
    selectionIndicator.dataset.itemId = item.id;
    this._updateSelectionIndicator(selectionIndicator, 'none');

    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = item.type === 'folder' ? '📁' : '📄';

    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = item.name;

    itemDiv.appendChild(selectionIndicator);
    itemDiv.appendChild(icon);
    itemDiv.appendChild(name);

    // Make the entire row clickable
    itemDiv.addEventListener('click', (e) => {
      e.preventDefault();
      onSelectionChange(item.id);
    });

    return itemDiv;
  }

  private _updateSelectionIndicator(indicator: HTMLElement, state: 'none' | 'all' | 'folder-only' | 'partial'): void {
    indicator.className = `selection-indicator ${state}`;
    
    switch (state) {
      case 'none':
        indicator.textContent = '○';
        indicator.title = 'Not selected';
        break;
      case 'all':
        indicator.textContent = '●';
        indicator.title = 'Fully selected';
        break;
      case 'folder-only':
        indicator.textContent = '◐';
        indicator.title = 'Folder only (no contents)';
        break;
      case 'partial':
        indicator.textContent = '◑';
        indicator.title = 'Partially selected';
        break;
    }
  }

  updateSelectionStates(folderManager: FolderManager): void {
    const indicators = this.folderTreeContainer.querySelectorAll('.selection-indicator');
    indicators.forEach(indicator => {
      const element = indicator as HTMLElement;
      const itemId = element.dataset.itemId;
      if (itemId) {
        const state = folderManager.getSelectionState(itemId);
        this._updateSelectionIndicator(element, state);
      }
    });

    // Also update visibility (collapse children of deselected folders)
    this.updateVisibilityBySelection(folderManager);
  }

  // Hide descendants of folders that are deselected (or folder-only)
  private updateVisibilityBySelection(folderManager: FolderManager): void {
    const rows = Array.from(this.folderTreeContainer.querySelectorAll('.folder-item')) as HTMLElement[];
    const collapseLevels: number[] = [];

    for (const row of rows) {
      const level = parseInt(row.dataset.level || '0', 10);

      // Exit any collapsed scopes that we've moved out of
      while (collapseLevels.length > 0 && level <= collapseLevels[collapseLevels.length - 1]) {
        collapseLevels.pop();
      }

      // Determine if current row should be hidden due to an active collapsed ancestor
      if (collapseLevels.length > 0 && level > collapseLevels[collapseLevels.length - 1]) {
        row.classList.add('hidden');
      } else {
        row.classList.remove('hidden');
      }

      // If this row is a folder with state none or folder-only, collapse its descendants
      const id = row.dataset.itemId;
      const type = row.dataset.type;
      if (type === 'folder' && id) {
        const state = folderManager.getSelectionState(id);
        if (state === 'none' || state === 'folder-only') {
          collapseLevels.push(level);
        }
      }
    }
  }

  private setupRenameEventListeners(): void {
    // Toggle rename config visibility
    this.enableRenameCheckbox.addEventListener('change', () => {
      if (this.enableRenameCheckbox.checked) {
        this.renameConfig.classList.remove('hidden');
        this.addDefaultRenameMapping();
      } else {
        this.renameConfig.classList.add('hidden');
      }
    });

    // Add new rename mapping
    this.addRenameMappingBtn.addEventListener('click', () => {
      this.addRenameMapping('', '');
    });
  }

  private addDefaultRenameMapping(): void {
    // Only add if no mappings exist
    if (this.renameMappingsContainer.children.length === 0) {
      this.addRenameMapping('', '');
    }
  }

  private addRenameMapping(from: string = '', to: string = ''): void {
    const mappingDiv = document.createElement('div');
    mappingDiv.className = 'rename-mapping';

    const fromInput = document.createElement('input');
    fromInput.type = 'text';
    fromInput.placeholder = 'Text to find';
    fromInput.value = from;

    const arrow = document.createElement('span');
    arrow.className = 'rename-mapping-arrow';
    arrow.textContent = '→';

    const toInput = document.createElement('input');
    toInput.type = 'text';
    toInput.placeholder = 'Replace with';
    toInput.value = to;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-mapping-btn';
    removeBtn.textContent = '✕';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      mappingDiv.remove();
    });

    mappingDiv.appendChild(fromInput);
    mappingDiv.appendChild(arrow);
    mappingDiv.appendChild(toInput);
    mappingDiv.appendChild(removeBtn);

    this.renameMappingsContainer.appendChild(mappingDiv);
  }

  getRenameSettings(): RenameSettings {
    const mappings: Array<{from: string, to: string}> = [];
    
    if (this.enableRenameCheckbox.checked) {
      const mappingElements = this.renameMappingsContainer.querySelectorAll('.rename-mapping');
      
      mappingElements.forEach(mappingEl => {
        const fromInput = mappingEl.querySelector('input[placeholder="Text to find"]') as HTMLInputElement;
        const toInput = mappingEl.querySelector('input[placeholder="Replace with"]') as HTMLInputElement;
        
        if (fromInput && toInput) {
          const from = fromInput.value.trim();
          const to = toInput.value.trim();
          
          // Include mappings even if 'from' is empty (for prefix/suffix operations)
          // Only exclude if both are empty
          if (from !== '' || to !== '') {
            mappings.push({ from, to });
          }
        }
      });
    }
    
    return { mappings };
  }
}

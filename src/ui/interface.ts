import type { FolderItem } from '../types/index.js';
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

  renderFolderTree(items: FolderItem[], onSelectionChange: (itemId: string) => void, _folderManager: FolderManager): void {
    this.folderTreeContainer.innerHTML = '';
    // Store reference for updates if needed in the future
    // this.folderManager = folderManager;
    this._renderItems(items, this.folderTreeContainer, 0, onSelectionChange);
  }

  private _renderItems(items: FolderItem[], container: HTMLElement, level: number, onSelectionChange: (itemId: string) => void): void {
    items.forEach(item => {
      const itemElement = this._createItemElement(item, level, onSelectionChange);
      container.appendChild(itemElement);

      if (item.children && item.children.length > 0) {
        this._renderItems(item.children, container, level + 1, onSelectionChange);
      }
    });
  }

  private _createItemElement(item: FolderItem, level: number, onSelectionChange: (itemId: string) => void): HTMLElement {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'folder-item';
    itemDiv.style.paddingLeft = `${level * 1.5 + 0.75}rem`;
    itemDiv.dataset.itemId = item.id;

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
  }
}

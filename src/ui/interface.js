export class UI {
  constructor() {
    this.folderTreeContainer = document.getElementById('folder-tree');
    this.folderSection = document.getElementById('folder-section');
    this.copySection = document.getElementById('copy-section');
    this.loadBtn = document.getElementById('load-btn');
    this.loadSpinner = document.getElementById('load-spinner');
    this.progressContainer = document.getElementById('progress-container');
    this.progressFill = document.getElementById('progress-fill');
    this.progressText = document.getElementById('progress-text');
    this.selectionCount = document.getElementById('selection-count');
  }

  enableLoadButton() {
    this.loadBtn.disabled = false;
  }

  showLoadingSpinner() {
    this.loadSpinner.classList.remove('hidden');
  }

  hideLoadingSpinner() {
    this.loadSpinner.classList.add('hidden');
  }

  showFolderSection() {
    this.folderSection.classList.remove('hidden');
  }

  showCopySection() {
    this.copySection.classList.remove('hidden');
  }

  showProgressContainer() {
    this.progressContainer.classList.remove('hidden');
  }

  updateProgress(percentage, text) {
    this.progressFill.style.width = `${percentage}%`;
    this.progressText.textContent = text;
  }

  updateSelectionCount(count) {
    this.selectionCount.textContent = `${count} items selected`;
  }

  renderFolderTree(items, onSelectionChange) {
    this.folderTreeContainer.innerHTML = '';
    this._renderItems(items, this.folderTreeContainer, 0, onSelectionChange);
  }

  _renderItems(items, container, level, onSelectionChange) {
    items.forEach(item => {
      const itemElement = this._createItemElement(item, level, onSelectionChange);
      container.appendChild(itemElement);

      if (item.children && item.children.length > 0) {
        this._renderItems(item.children, container, level + 1, onSelectionChange);
      }
    });
  }

  _createItemElement(item, level, onSelectionChange) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'folder-item';
    itemDiv.style.paddingLeft = `${level * 1.5 + 0.75}rem`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.itemId = item.id;
    checkbox.addEventListener('change', (e) => {
      onSelectionChange(item.id, e.target.checked);
    });

    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = item.type === 'folder' ? '📁' : '📄';

    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = item.name;

    itemDiv.appendChild(checkbox);
    itemDiv.appendChild(icon);
    itemDiv.appendChild(name);

    // Make the entire row clickable (except the checkbox)
    itemDiv.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        onSelectionChange(item.id, checkbox.checked);
      }
    });

    return itemDiv;
  }

  selectAllItems() {
    const checkboxes = this.folderTreeContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
    });
  }

  deselectAllItems() {
    const checkboxes = this.folderTreeContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
  }
}

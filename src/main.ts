import { GoogleDriveAPI } from './api/googleDrive.js';
import { UI } from './ui/interface.js';
import { FolderManager } from './services/folderManager.js';
import { CopyManager } from './services/copyManager.js';
import { StatusManager } from './services/statusManager.js';
import { LLMService } from './services/llmService.js';
import type { FolderItem, SelectionState, SelectedItem } from './types/index.js';

class App {
  private api: GoogleDriveAPI;
  private ui: UI;
  private folderManager: FolderManager;
  private copyManager: CopyManager;
  private statusManager: StatusManager;
  private llmService: LLMService;
  private isAuthenticated: boolean = false;
  private folderStructure: FolderItem[] | null = null;

  constructor() {
    this.api = new GoogleDriveAPI();
    this.ui = new UI();
    this.folderManager = new FolderManager(this.api);
    this.copyManager = new CopyManager(this.api);
    this.statusManager = new StatusManager();
    this.llmService = new LLMService();
    
    this.init();
  }

  private init(): void {
    this.setupEventListeners();
    this.updateDynamicContent();
    // Check if we're returning from OAuth redirect
    this.checkAuthenticationOnLoad();
  }

  private updateDynamicContent(): void {
    // Get the base URL - prefer environment variable, fallback to current origin
    const baseUrl = this.getBaseUrl();
    
    // Update the example domains in the instructions
    const exampleOrigin = document.getElementById('example-origin');
    const exampleRedirect = document.getElementById('example-redirect');
    const currentDomain = document.getElementById('current-domain');
    
    if (exampleOrigin) {
      exampleOrigin.textContent = baseUrl;
    }
    
    if (exampleRedirect) {
      exampleRedirect.textContent = baseUrl;
    }
    
    if (currentDomain) {
      currentDomain.textContent = baseUrl;
    }
    
    console.log(`Application running on: ${baseUrl}`);
    console.log(`Environment VITE_BASE_URL: ${import.meta.env.VITE_BASE_URL || 'not set'}`);
    console.log(`Window location origin: ${window.location.origin}`);
  }

  private getBaseUrl(): string {
    // At build time, Vite will replace import.meta.env.VITE_BASE_URL with the actual value
    // If it's not set, it will be undefined, so we fallback to window.location.origin
    const envBaseUrl = import.meta.env.VITE_BASE_URL;
    
    // Check if we have a valid environment base URL that's not localhost when we're not on localhost
    if (envBaseUrl && 
        envBaseUrl !== 'undefined' && 
        envBaseUrl !== 'null' &&
        // Don't use localhost URL when we're not actually on localhost
        !(envBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost'))) {
      return envBaseUrl;
    }
    
    // Fallback to current origin - this works for both dev and production
    return window.location.origin;
  }

  private async checkAuthenticationOnLoad(): Promise<void> {
    // Check if there's an access token in the URL (from OAuth redirect)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    
    if (accessToken) {
      // We have a token, try to complete authentication
      const clientId = localStorage.getItem('google_client_id');
      const apiKey = localStorage.getItem('google_api_key');
      
      if (clientId && apiKey) {
        try {
          await this.api.loadAPI();
          await this.api.initialize(clientId, apiKey);
          const success = await this.api.authenticate(); // Will use token from URL
          
          if (success) {
            this.isAuthenticated = true;
            this.statusManager.show('Successfully authenticated with Google Drive', 'success');
            this.ui.enableLoadButton();
            
            // Restore form values
            const clientIdInput = document.getElementById('clientId') as HTMLInputElement;
            const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
            if (clientIdInput) clientIdInput.value = clientId;
            if (apiKeyInput) apiKeyInput.value = apiKey;
          }
        } catch (error) {
          this.statusManager.show(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      }
    }
  }

  private setupEventListeners(): void {
    // Authentication
    const authBtn = document.getElementById('auth-btn');
    authBtn?.addEventListener('click', () => this.authenticate());
    
    // Load folder structure
    const loadBtn = document.getElementById('load-btn');
    loadBtn?.addEventListener('click', () => this.loadFolderStructure());
    
    // Add debug info for OAuth troubleshooting
    this.addDebugInfo();
    
    // LLM integration
    const enableLlmCheckbox = document.getElementById('enable-llm') as HTMLInputElement;
    enableLlmCheckbox?.addEventListener('change', (e) => {
      const llmConfig = document.getElementById('llm-config');
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        llmConfig?.classList.remove('hidden');
      } else {
        llmConfig?.classList.add('hidden');
      }
    });
    
    const applyLlmBtn = document.getElementById('apply-llm-btn');
    applyLlmBtn?.addEventListener('click', () => this.applyLLMSelection());
    
    // Selection controls
    const selectAllBtn = document.getElementById('select-all-btn');
    selectAllBtn?.addEventListener('click', () => this.selectAll());
    
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    deselectAllBtn?.addEventListener('click', () => this.deselectAll());
    
    // Copy process
    const copyBtn = document.getElementById('copy-btn');
    copyBtn?.addEventListener('click', () => this.startCopy());
  }

  private async authenticate(): Promise<void> {
    console.log("Authenticating with Google Drive...");
    const clientIdInput = document.getElementById('clientId') as HTMLInputElement;
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    
    const clientId = clientIdInput?.value;
    const apiKey = apiKeyInput?.value;

    if (!clientId || !apiKey) {
      this.statusManager.show('Please enter both Client ID and API Key', 'error');
      return;
    }

    // Store credentials for after redirect
    localStorage.setItem('google_client_id', clientId);
    localStorage.setItem('google_api_key', apiKey);

    try {
      await this.api.loadAPI();
      await this.api.initialize(clientId, apiKey);
      
      // This will redirect to Google OAuth, so we won't reach the lines below
      await this.api.authenticate();
      
    } catch (error) {
      this.statusManager.show(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  private async loadFolderStructure(): Promise<void> {
    const sourceFolderInput = document.getElementById('sourceFolderId') as HTMLInputElement;
    const sourceFolderId = sourceFolderInput?.value;
    
    if (!sourceFolderId) {
      this.statusManager.show('Please enter a source folder ID', 'error');
      return;
    }

    if (!this.isAuthenticated) {
      this.statusManager.show('Please authenticate first', 'error');
      return;
    }

    this.ui.showLoadingSpinner();

    try {
      this.folderStructure = await this.folderManager.loadFolderStructure(sourceFolderId);
      this.ui.renderFolderTree(this.folderStructure, (itemId: string) => {
        this.handleItemClick(itemId);
      }, this.folderManager);
      
      this.statusManager.show('Folder structure loaded successfully', 'success');
      this.ui.showFolderSection();
      this.ui.showCopySection();
      this.updateSelectionCount();
    } catch (error) {
      this.statusManager.show(`Failed to load folder structure: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      this.ui.hideLoadingSpinner();
    }
  }

  private handleItemClick(itemId: string): void {
    if (!this.folderStructure) return;
    
    this.folderManager.cycleSelection(itemId, this.folderStructure);
    // Use newState if needed for additional logic
    this.ui.updateSelectionStates(this.folderManager);
    this.updateSelectionCount();
  }

  private async applyLLMSelection(): Promise<void> {
    if (!this.folderStructure) {
      this.statusManager.show('Please load folder structure first', 'error');
      return;
    }

    const enableLlmCheckbox = document.getElementById('enable-llm') as HTMLInputElement;
    const openaiKeyInput = document.getElementById('openai-key') as HTMLInputElement;
    const promptInput = document.getElementById('llm-prompt') as HTMLInputElement;
    
    const enableLLM = enableLlmCheckbox?.checked ?? false;
    const openaiKey = openaiKeyInput?.value;
    const prompt = promptInput?.value;

    if (enableLLM) {
      this.llmService.setApiKey(openaiKey || '');
    } else {
      this.llmService.setApiKey(''); // Force mock mode
    }

    try {
      this.statusManager.show('Applying AI selection...', 'info');
      
      const selections = await this.llmService.selectFiles(this.folderStructure, prompt || '');
      
      // Apply selections to folder manager
      for (const [itemId, state] of selections) {
        this.folderManager.selectionStates.set(itemId, state);
      }
      
      this.ui.updateSelectionStates(this.folderManager);
      this.updateSelectionCount();
      
      this.statusManager.show('AI selection applied successfully', 'success');
    } catch (error) {
      this.statusManager.show(`AI selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  private updateSelectionCount(): void {
    if (!this.folderManager || !this.folderStructure) return;
    
    const selectedItemCount = this.folderManager.getSelectedItemCount(this.folderStructure);
    this.ui.updateSelectionCount(selectedItemCount);
    
    // Debug logging (can be removed in production)
    this.folderManager.debugSelectionCount(this.folderStructure);
  }

  private selectAll(): void {
    if (!this.folderStructure) return;
    
    this._setAllStates(this.folderStructure, 'all');
    this.ui.updateSelectionStates(this.folderManager);
    this.updateSelectionCount();
  }

  private deselectAll(): void {
    if (!this.folderStructure) return;
    
    this._setAllStates(this.folderStructure, 'none');
    this.ui.updateSelectionStates(this.folderManager);
    this.updateSelectionCount();
  }

  private _setAllStates(items: FolderItem[], state: SelectionState): void {
    for (const item of items) {
      this.folderManager.selectionStates.set(item.id, state);
      if (item.children) {
        this._setAllStates(item.children, state);
      }
    }
  }

  private async startCopy(): Promise<void> {
    if (!this.folderManager || !this.folderStructure) {
      this.statusManager.show('Please load folder structure first', 'error');
      return;
    }

    const selectedItems = this.folderManager.getSelectedItems(this.folderStructure);
    
    if (selectedItems.length === 0) {
      this.statusManager.show('Please select at least one item to copy', 'error');
      return;
    }

    const destinationFolderInput = document.getElementById('destinationFolderId') as HTMLInputElement;
    const destinationFolderId = destinationFolderInput?.value;
    
    if (!destinationFolderId) {
      this.statusManager.show('Please enter a destination folder ID', 'error');
      return;
    }

    if (!this.isAuthenticated) {
      this.statusManager.show('Please authenticate with Google Drive first', 'error');
      return;
    }

    this.ui.showProgressContainer();

    try {
      // Get the actual number of items that will be copied (not just selected nodes)
      const totalItemsToProcess = this.folderManager.getSelectedItemCount(this.folderStructure);

      // Create a mapping for folder hierarchy
      const createdFolders = new Map<string, string>(); // originalId -> newId
      createdFolders.set('root', destinationFolderId);
      
      console.log(`Starting copy of ${selectedItems.length} selected nodes (${totalItemsToProcess} total items) to folder ID: ${destinationFolderId}`);
      console.log('Selected items to process:', selectedItems.map(item => ({
        name: item.item.name,
        type: item.item.type,
        selectionType: item.selectionType,
        includeChildren: item.includeChildren,
        childrenCount: item.item.children?.length || 0
      })));
      
      // Process each selected item and track actual items processed
      const progressTracker = {
        totalItems: totalItemsToProcess,
        processedItems: 0,
        updateProgress: (increment: number = 1) => {
          progressTracker.processedItems += increment;
          const progress = (progressTracker.processedItems / progressTracker.totalItems) * 100;
          console.log(`Progress: ${progress.toFixed(2)}% (${progressTracker.processedItems}/${progressTracker.totalItems} items)`);
          this.ui.updateProgress(progress, `Processed ${progressTracker.processedItems} of ${progressTracker.totalItems} items`);
        }
      };
      
      for (const selectedItem of selectedItems) {
        console.log(`Processing item: ${selectedItem.item.name} (${selectedItem.item.id}) at path: ${selectedItem.item.path}`);
        await this.processSelectedItemWithProgress(selectedItem, createdFolders, progressTracker);
      }

      this.statusManager.show(`Successfully processed ${progressTracker.processedItems} items`, 'success');
      this.ui.updateProgress(100, 'Copy completed successfully!');
    } catch (error) {
      console.error('Copy operation failed:', error);
      this.statusManager.show(`Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  private async processSelectedItemWithProgress(
    selectedItem: SelectedItem, 
    createdFolders: Map<string, string>, 
    progressTracker: { updateProgress: (increment?: number) => void }
  ): Promise<void> {
    const { item, includeChildren } = selectedItem;
    
    try {
      if (item.type === 'folder') {
        // Create the folder in the destination
        const parentId = await this.findOrCreateParentId(item, createdFolders);
        console.log(`Creating folder "${item.name}" in parent ${parentId}`);
        const newFolderId = await this.copyManager.createFolder(item.name, parentId);
        createdFolders.set(item.id, newFolderId);
        console.log(`Created folder "${item.name}" with ID: ${newFolderId}`);
        progressTracker.updateProgress(1); // Count the folder itself
        
        // If we should include children, process them all
        if (includeChildren && item.children) {
          for (const child of item.children) {
            // When parent is selected with 'all', copy all children regardless of their individual state
            await this.processSelectedItemWithProgress({
              item: child,
              selectionType: 'all',
              includeChildren: true
            }, createdFolders, progressTracker);
          }
        }
      } else {
        // Copy the file
        const parentId = await this.findOrCreateParentId(item, createdFolders);
        console.log(`Copying file "${item.name}" to parent ${parentId}`);
        await this.copyManager.copyFile(item.id, parentId);
        console.log(`Copied file "${item.name}" successfully`);
        progressTracker.updateProgress(1); // Count the file
      }
    } catch (error) {
      console.error(`Failed to process item "${item.name}":`, error);
      throw error;
    }
  }

  private async findOrCreateParentId(item: FolderItem, createdFolders: Map<string, string>): Promise<string> {
    // Get the parent path by removing the current item from the path
    const pathParts = item.path.split('/');
    const parentPath = pathParts.slice(0, -1).join('/');
    
    console.log(`Finding parent for item "${item.name}" at path "${item.path}". Parent path: "${parentPath}"`);
    
    // If this item is at the root level, return the destination folder
    if (parentPath === '' || pathParts.length <= 1) {
      console.log(`Item "${item.name}" is at root level, using destination folder`);
      return createdFolders.get('root') || '';
    }
    
    // Check if we already created the parent folder
    const parentId = this.findFolderIdByPath(parentPath, createdFolders);
    if (parentId) {
      console.log(`Parent folder for path "${parentPath}" already exists with ID: ${parentId}`);
      return parentId;
    }
    
    // If parent folder doesn't exist, we need to create it
    // First, find the parent folder information from our folder structure
    const parentFolder = this.findFolderByPath(parentPath, this.folderStructure!);
    if (parentFolder) {
      console.log(`Creating parent folder "${parentFolder.name}" for path "${parentPath}"`);
      // Recursively create parent folders if needed
      const grandParentId = await this.findOrCreateParentId(parentFolder, createdFolders);
      const newParentId = await this.copyManager.createFolder(parentFolder.name, grandParentId);
      createdFolders.set(parentFolder.id, newParentId);
      console.log(`Created parent folder "${parentFolder.name}" with ID: ${newParentId}`);
      return newParentId;
    }
    
    // Fallback to root if we can't find parent
    console.log(`Could not find parent folder for path "${parentPath}", using root`);
    return createdFolders.get('root') || '';
  }

  private findFolderIdByPath(path: string, createdFolders: Map<string, string>): string | null {
    // Look through our folder structure to find a folder with this path
    if (!this.folderStructure) return null;
    
    const folder = this.findFolderByPath(path, this.folderStructure);
    if (folder && createdFolders.has(folder.id)) {
      return createdFolders.get(folder.id) || null;
    }
    return null;
  }

  private findFolderByPath(path: string, items: FolderItem[]): FolderItem | null {
    for (const item of items) {
      if (item.path === path) {
        return item;
      }
      if (item.children && item.children.length > 0) {
        const found = this.findFolderByPath(path, item.children);
        if (found) return found;
      }
    }
    return null;
  }

  private addDebugInfo(): void {
    // Add debug information to help with OAuth troubleshooting
    const debugDiv = document.createElement('div');
    debugDiv.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #f0f0f0;
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      max-width: 300px;
      z-index: 1000;
      display: none;
    `;
    debugDiv.innerHTML = `
      <strong>Debug Info:</strong><br>
      Current URL: ${window.location.href}<br>
      Origin: ${window.location.origin}<br>
      Protocol: ${window.location.protocol}<br>
      VITE_BASE_URL: ${import.meta.env.VITE_BASE_URL || 'Not set'}
    `;
    
    // Add toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '🐛';
    toggleBtn.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #007acc;
      color: white;
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      font-size: 14px;
      cursor: pointer;
      z-index: 1001;
    `;
    toggleBtn.title = 'Toggle debug info';
    
    toggleBtn.addEventListener('click', () => {
      debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
    });
    
    document.body.appendChild(debugDiv);
    document.body.appendChild(toggleBtn);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new App();
});

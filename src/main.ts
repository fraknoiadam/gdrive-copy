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
    // Check if we're returning from OAuth redirect
    this.checkAuthenticationOnLoad();
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
    
    const selectedItems = this.folderManager.getSelectedItems(this.folderStructure);
    this.ui.updateSelectionCount(selectedItems.length);
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
      let copiedCount = 0;
      const totalItems = selectedItems.length;

      // Create a mapping for folder hierarchy
      const createdFolders = new Map<string, string>(); // originalId -> newId
      createdFolders.set('root', destinationFolderId);
      console.log(`Starting copy of ${totalItems} items to folder ID: ${destinationFolderId}. Selected items:`, selectedItems);
      
      for (const selectedItem of selectedItems) {
        console.log(`Processing item: ${selectedItem.item.name} (${selectedItem.item.id})`);
        await this.processSelectedItem(selectedItem, createdFolders);
        copiedCount++;
        
        const progress = (copiedCount / totalItems) * 100;
        console.log(`Progress: ${progress.toFixed(2)}%`);
        this.ui.updateProgress(progress, `Processed ${copiedCount} of ${totalItems} items`);
      }

      this.statusManager.show(`Successfully processed ${copiedCount} items`, 'success');
      this.ui.updateProgress(100, 'Copy completed successfully!');
    } catch (error) {
      this.statusManager.show(`Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  private async processSelectedItem(selectedItem: SelectedItem, createdFolders: Map<string, string>): Promise<void> {
    const { item, includeChildren } = selectedItem;
    
    if (item.type === 'folder') {
      // Create the folder in the destination
      const parentId = this.findParentId(item, createdFolders);
      const newFolderId = await this.copyManager.createFolder(item.name, parentId);
      createdFolders.set(item.id, newFolderId);
      
      // If we should include children, process them
      if (includeChildren && item.children) {
        for (const child of item.children) {
          // Check if this child is also selected, if not, copy it anyway because parent was selected with 'all'
          const childSelection = this.folderManager.getSelectionState(child.id);
          if (childSelection === 'none') {
            // Force include since parent was selected with 'all'
            await this.processSelectedItem({
              item: child,
              selectionType: 'all',
              includeChildren: true
            }, createdFolders);
          }
        }
      }
    } else {
      // Copy the file
      const parentId = this.findParentId(item, createdFolders);
      await this.copyManager.copyFile(item.id, parentId);
    }
  }

  private findParentId(_item: FolderItem, createdFolders: Map<string, string>): string {
    // Find the parent folder ID in our created folders map
    // This is a simplified version - in a real implementation, you'd track the full hierarchy
    // const parentPath = item.path.split('/').slice(0, -1).join('/');
    
    // For now, we'll use the destination folder as parent for all items
    // In a full implementation, you'd need to track the folder hierarchy properly
    return createdFolders.get('root') || '';
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new App();
});

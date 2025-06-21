import { GoogleDriveAPI } from './api/googleDrive.js';
import { UI } from './ui/interface.js';
import { FolderManager } from './services/folderManager.js';
import { CopyManager } from './services/copyManager.js';
import { StatusManager } from './services/statusManager.js';

class App {
  constructor() {
    this.api = new GoogleDriveAPI();
    this.ui = new UI();
    this.folderManager = new FolderManager(this.api);
    this.copyManager = new CopyManager(this.api);
    this.statusManager = new StatusManager();
    
    this.selectedItems = new Set();
    this.isAuthenticated = false;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    // Check if we're returning from OAuth redirect
    this.checkAuthenticationOnLoad();
  }

  async checkAuthenticationOnLoad() {
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
            document.getElementById('clientId').value = clientId;
            document.getElementById('apiKey').value = apiKey;
          }
        } catch (error) {
          this.statusManager.show(`Authentication failed: ${error.message}`, 'error');
        }
      }
    }
  }

  setupEventListeners() {
    // Authentication
    document.getElementById('auth-btn').addEventListener('click', () => this.authenticate());
    
    // Load folder structure
    document.getElementById('load-btn').addEventListener('click', () => this.loadFolderStructure());
    
    // Selection controls
    document.getElementById('select-all-btn').addEventListener('click', () => this.selectAll());
    document.getElementById('deselect-all-btn').addEventListener('click', () => this.deselectAll());
    
    // Copy process
    document.getElementById('copy-btn').addEventListener('click', () => this.startCopy());
  }

  async authenticate() {
    console.log("Authenticating with Google Drive...");
    const clientId = document.getElementById('clientId').value;
    const apiKey = document.getElementById('apiKey').value;

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
      this.statusManager.show(`Authentication failed: ${error.message}`, 'error');
    }
  }

  async loadFolderStructure() {
    const sourceFolderId = document.getElementById('sourceFolderId').value;
    
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
      const structure = await this.folderManager.loadFolderStructure(sourceFolderId);
      this.ui.renderFolderTree(structure, (itemId, isSelected) => {
        this.toggleSelection(itemId, isSelected);
      });
      
      this.statusManager.show('Folder structure loaded successfully', 'success');
      this.ui.showFolderSection();
      this.ui.showCopySection();
    } catch (error) {
      this.statusManager.show(`Failed to load folder structure: ${error.message}`, 'error');
    } finally {
      this.ui.hideLoadingSpinner();
    }
  }

  toggleSelection(itemId, isSelected) {
    if (isSelected) {
      this.selectedItems.add(itemId);
    } else {
      this.selectedItems.delete(itemId);
    }
    this.ui.updateSelectionCount(this.selectedItems.size);
  }

  selectAll() {
    this.ui.selectAllItems();
    const checkboxes = document.querySelectorAll('#folder-tree input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const itemId = checkbox.dataset.itemId;
      this.selectedItems.add(itemId);
    });
    this.ui.updateSelectionCount(this.selectedItems.size);
  }

  deselectAll() {
    this.ui.deselectAllItems();
    this.selectedItems.clear();
    this.ui.updateSelectionCount(0);
  }

  async startCopy() {
    if (this.selectedItems.size === 0) {
      this.statusManager.show('Please select at least one item to copy', 'error');
      return;
    }

    const destinationFolderId = document.getElementById('destinationFolderId').value;
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
      const selectedItemsArray = Array.from(this.selectedItems);
      let copiedCount = 0;

      for (const itemId of selectedItemsArray) {
        await this.copyManager.copyItem(itemId, destinationFolderId);
        copiedCount++;
        
        const progress = (copiedCount / selectedItemsArray.length) * 100;
        this.ui.updateProgress(progress, `Copied ${copiedCount} of ${selectedItemsArray.length} items`);
      }

      this.statusManager.show(`Successfully copied ${copiedCount} items`, 'success');
      this.ui.updateProgress(100, 'Copy completed successfully!');
    } catch (error) {
      this.statusManager.show(`Copy failed: ${error.message}`, 'error');
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new App();
});

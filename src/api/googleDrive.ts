import type { DriveFile, DriveFilesResponse, TokenResponse } from '../types/index.js';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export class GoogleDriveAPI {
  private isLoaded: boolean = false;
  private isInitialized: boolean = false;
  private accessToken: string | null = null;
  private clientId: string = '';
  // private apiKey: string = ''; // For future quota management

  async loadAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load both Google Identity Services and Google APIs client library
      const promises: Promise<void>[] = [];
      
      // Load Google Identity Services for authentication
      if (!window.google?.accounts?.id) {
        promises.push(this.loadScript('https://accounts.google.com/gsi/client'));
      }
      
      // Load Google APIs client library for API calls
      if (!window.gapi) {
        promises.push(this.loadScript('https://apis.google.com/js/api.js'));
      }

      Promise.all(promises)
        .then(() => {
          this.initializeGapi().then(resolve).catch(reject);
        })
        .catch(reject);
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private initializeGapi(): Promise<void> {
    return new Promise((resolve) => {
      if (window.gapi) {
        window.gapi.load('client', () => {
          this.isLoaded = true;
          resolve();
        });
      } else {
        this.isLoaded = true;
        resolve();
      }
    });
  }

  async initialize(clientId: string, apiKey: string): Promise<void> {
    console.log('Initializing Google API...');
    
    if (!this.isLoaded) {
      await this.loadAPI();
    }
    
    // Prevent double initialization
    if (this.isInitialized) {
      console.warn('Google API client already initialized');
      return;
    }
    
    try {
      // Initialize Google APIs client for Drive API
      if (window.gapi && window.gapi.client) {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
        });
        console.log('Google APIs client initialized');
      }
      
      this.clientId = clientId;
      // Store apiKey for potential future use (e.g., quota management)
      // this.apiKey = apiKey;
      this.isInitialized = true;
      console.log('Google API initialization complete');
      
    } catch (error) {
      console.error('Failed to initialize Google API:', error);
      throw error;
    }
  }

  async authenticate(): Promise<boolean> {
    console.log('Starting authentication...');
    
    if (!this.isInitialized) {
      throw new Error('Google API not initialized. Call initialize() first.');
    }

    // Check if we already have an access token from URL hash (after redirect)
    const urlParams = this.getTokenFromUrl();
    if (urlParams.access_token) {
      console.log('Found access token in URL');
      this.accessToken = urlParams.access_token;
      
      // Set up the token for API calls
      if (window.gapi && window.gapi.client) {
        window.gapi.client.setToken({
          access_token: this.accessToken
        });
      }
      
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }

    // If no token, redirect to Google OAuth
    console.log('No access token found, redirecting to OAuth...');
    
    // Get the redirect URI - use environment variable for production, fallback to current origin
    let redirectUri = this.getBaseUrl();
    
    console.log('Using redirect URI:', redirectUri);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${this.clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive')}&` +
      `include_granted_scopes=true&` +
      `state=drive_access`;

    console.log('Auth URL components:');
    console.log('- Client ID:', this.clientId);
    console.log('- Redirect URI:', redirectUri);
    console.log('- Full Auth URL:', authUrl);
    
    // Check if we're in a secure context
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.warn('Warning: OAuth may not work properly over HTTP in production');
    }
    
    window.location.href = authUrl;
    return false; // Will redirect, so return false for now
  }

  private getTokenFromUrl(): TokenResponse {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    return {
      access_token: params.get('access_token'),
      token_type: params.get('token_type'),
      expires_in: params.get('expires_in')
    };
  }

  private getBaseUrl(): string {
    // At build time, Vite will replace import.meta.env.VITE_BASE_URL with the actual value
    // If it's not set, it will be undefined, so we fallback to window.location.origin
    const envBaseUrl = import.meta.env.VITE_BASE_URL;
    
    if (envBaseUrl && envBaseUrl !== 'undefined') {
      console.log('Using configured VITE_BASE_URL:', envBaseUrl);
      return envBaseUrl;
    }
    
    // Fallback to current origin - this works for both dev and production
    const currentOrigin = window.location.origin;
    console.log('No VITE_BASE_URL found, using current origin:', currentOrigin);
    return currentOrigin;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async listFiles(folderId: string, pageToken?: string): Promise<DriveFilesResponse> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    // Set the access token for API calls
    window.gapi.client.setToken({
      access_token: this.accessToken
    });

    const params: any = {
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,parents),nextPageToken',
      pageSize: 1000
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await window.gapi.client.drive.files.list(params);
    return response.result;
  }

  async copyFile(fileId: string, destinationFolderId: string): Promise<DriveFile> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    // Set the access token for API calls
    window.gapi.client.setToken({
      access_token: this.accessToken
    });

    const response = await window.gapi.client.drive.files.copy({
      fileId: fileId,
      resource: {
        parents: [destinationFolderId]
      }
    });
    return response.result;
  }

  async createFolder(name: string, parentFolderId: string): Promise<DriveFile> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    // Set the access token for API calls
    window.gapi.client.setToken({
      access_token: this.accessToken
    });

    const response = await window.gapi.client.drive.files.create({
      resource: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      }
    });
    
    return response.result;
  }

  isFolder(mimeType: string): boolean {
    return mimeType === 'application/vnd.google-apps.folder';
  }
}

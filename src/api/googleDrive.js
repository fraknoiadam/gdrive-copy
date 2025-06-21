export class GoogleDriveAPI {
  constructor() {
    this.gapi = null;
    this.isLoaded = false;
  }

  loadAPI() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        this.gapi = window.gapi;
        this.initializeGapi().then(resolve).catch(reject);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        this.gapi = window.gapi;
        this.initializeGapi().then(resolve).catch(reject);
      };
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  initializeGapi() {
    return new Promise((resolve) => {
      this.gapi.load('auth2:client', () => {
        this.isLoaded = true;
        resolve();
      });
    });
  }

  async initialize(clientId, apiKey) {
    if (!this.isLoaded) {
      await this.loadAPI();
    }

    await this.gapi.client.init({
      apiKey: apiKey,
      clientId: clientId,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      scope: 'https://www.googleapis.com/auth/drive'
    });
  }

  async authenticate() {
    const authInstance = this.gapi.auth2.getAuthInstance();
    
    if (authInstance.isSignedIn.get()) {
      return true;
    }

    await authInstance.signIn();
    return authInstance.isSignedIn.get();
  }

  isAuthenticated() {
    if (!this.gapi || !this.gapi.auth2) return false;
    const authInstance = this.gapi.auth2.getAuthInstance();
    return authInstance && authInstance.isSignedIn.get();
  }

  async listFiles(folderId, pageToken = null) {
    const params = {
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,parents),nextPageToken',
      pageSize: 1000
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await this.gapi.client.drive.files.list(params);
    return response.result;
  }

  async copyFile(fileId, destinationFolderId) {
    const response = await this.gapi.client.drive.files.copy({
      fileId: fileId,
      resource: {
        parents: [destinationFolderId]
      }
    });
    return response.result;
  }

  isFolder(mimeType) {
    return mimeType === 'application/vnd.google-apps.folder';
  }
}

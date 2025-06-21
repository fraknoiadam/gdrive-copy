// Google Drive API types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

export interface DriveFilesResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

// Folder structure types
export interface FolderItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children: FolderItem[];
}

export type SelectionState = 'none' | 'all' | 'folder-only' | 'partial';

export interface SelectedItem {
  item: FolderItem;
  selectionType: SelectionState;
  includeChildren: boolean;
}

// Authentication types
export interface TokenResponse {
  access_token: string | null;
  token_type: string | null;
  expires_in: string | null;
}

// LLM Service types
export interface LLMSelectionMap extends Map<string, SelectionState> {}

// Status types
export type StatusType = 'success' | 'error' | 'warning' | 'info';

// Copy manager types
export interface CopyResult {
  fileId: string;
  success: boolean;
  result?: any;
  error?: string;
}

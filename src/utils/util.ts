/**
 * Utility functions for the Google Drive Copy Tool
 */

/**
 * Gets the base URL for the application, including protocol, hostname, and port if applicable
 * This function handles both development and production environments
 * 
 * Priority order:
 * 1. Environment variable VITE_BASE_URL if set
 * 2. Current window location origin (protocol + hostname + port)
 * 
 * @returns The complete base URL with protocol, hostname, and port (if applicable)
 */
export function getBaseURL(): string {
  // Check for environment variable first (useful for production overrides)
  const envBaseUrl = import.meta.env.VITE_BASE_URL;
  
  if (envBaseUrl && envBaseUrl !== 'undefined' && envBaseUrl !== 'null' && envBaseUrl.trim() !== '') {
    console.log('📍 Using environment VITE_BASE_URL:', envBaseUrl);
    return envBaseUrl;
  }
  
  // Build URL from current location
  const protocol = window.location.protocol; // 'http:' or 'https:'
  const hostname = window.location.hostname; // 'localhost', 'example.com', etc.
  const port = window.location.port; // '5173', '3000', '' (empty for default ports)
  
  // Construct the base URL
  let baseUrl = `${protocol}//${hostname}`;
  
  // Add port if it's not a default port (80 for HTTP, 443 for HTTPS)
  if (port && 
      !((protocol === 'http:' && port === '80') || 
        (protocol === 'https:' && port === '443'))) {
    baseUrl += `:${port}`;
  }
  
  console.log('📍 Using detected base URL:', baseUrl);
  console.log('  - Protocol:', protocol);
  console.log('  - Hostname:', hostname);  
  console.log('  - Port:', port || 'default');
  
  return baseUrl;
}

/**
 * Gets the current domain for display purposes (without protocol)
 * Useful for showing users what domain to configure in Google Console
 * 
 * @returns Domain with port if applicable (e.g., "localhost:5173" or "example.com")
 */
export function getCurrentDomain(): string {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  if (port && 
      !((window.location.protocol === 'http:' && port === '80') || 
        (window.location.protocol === 'https:' && port === '443'))) {
    return `${hostname}:${port}`;
  }
  
  return hostname;
}

/**
 * Checks if we're running in development mode
 * @returns true if running on localhost or with development indicators
 */
export function isDevelopment(): boolean {
  return window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' ||
         window.location.hostname.startsWith('192.168.') ||
         window.location.hostname.startsWith('10.') ||
         import.meta.env.DEV === true;
}

/**
 * Gets a user-friendly environment description
 * @returns 'Development', 'Production', or 'Local'
 */
export function getEnvironmentType(): string {
  if (isDevelopment()) {
    return 'Development';
  }
  
  if (window.location.protocol === 'https:') {
    return 'Production';
  }
  
  return 'Local';
}

# Google Drive Copy Tool

A modern web application for selectively copying folders and files between Google Drive locations using the Google Drive API.

## Features

- 🔐 Google OAuth2 authentication
- 📁 Browse and navigate folder structures
- ✅ Select specific files and folders to copy
- 📊 Real-time progress tracking
- 🎨 Clean, minimalistic UI
- 📱 Responsive design

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Get Google API credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Drive API
   - Create OAuth 2.0 Client ID credentials
   - Add your development URL (e.g., `http://localhost:5173`) to authorized JavaScript origins
   - The app will automatically detect your current URL and port
   - Copy the Client ID and API Key

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Navigate to the URL shown in the terminal (usually `http://localhost:5173`)
   - The app will automatically detect the correct base URL including port
   - Enter your Google API credentials
   - Authenticate and start copying files!

## Usage

1. Enter your Google API Client ID and API Key
2. Click "Authenticate with Google" to sign in
3. Enter source and destination folder IDs from Google Drive URLs
4. Click "Load Folder Structure" to browse files
5. Select the files/folders you want to copy
6. Click "Start Copy Process" to begin copying

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── api/
│   └── googleDrive.js      # Google Drive API wrapper
├── services/
│   ├── folderManager.js    # Folder structure management
│   ├── copyManager.js      # File copying logic
│   └── statusManager.js    # Status message handling
├── ui/
│   └── interface.js        # UI components and interactions
├── styles/
│   └── main.css           # Minimalistic styling
└── main.js                # Application entry point
```

## License

MIT

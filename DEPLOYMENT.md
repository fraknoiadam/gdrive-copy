# Deployment Instructions

## How Environment Variables Work

This application automatically detects the correct domain at runtime for maximum flexibility:

- **Development**: Auto-detects `http://localhost:5173` (or your dev server port)
- **Production**: Auto-detects the actual domain where the app is deployed
- **Environment Override**: You can optionally set `VITE_BASE_URL` to force a specific domain

### Runtime Auto-Detection

The app now works correctly in all scenarios:
1. `npm run dev` (development mode) - auto-detects localhost
2. `npm run build` then serve the `dist` folder - auto-detects server domain
3. Deploy to any hosting platform - auto-detects deployed domain
4. Open built files directly as static files - auto-detects file location

**No environment variables are required!** The app automatically uses the correct domain.

## Cloudflare Pages Deployment

### 1. Optional: Set Environment Variables (Recommended for production)
In your Cloudflare Pages project dashboard:
1. Go to Settings > Environment variables
2. Add the following variables for **Production** (optional but recommended):

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

Note: `VITE_BASE_URL` is no longer required! The app auto-detects your domain.

### 2. Configure Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 client ID
4. Add your Cloudflare Pages domain to:
   - **Authorized JavaScript origins**: `https://your-app.pages.dev`
   - **Authorized redirect URIs**: `https://your-app.pages.dev`

### 3. Testing
- The app works on `localhost:5173` (development) 
- Works on your Cloudflare Pages domain
- Works when served from any web server
- Works when opened as static files
- Check browser console for auto-detected domain info

## General Deployment (Any Platform)

1. Build the app: `npm run build`
2. Deploy the `dist` folder to your hosting platform
3. Add your domain to Google Cloud Console (see step 2 above)
4. No environment variables needed - auto-detection handles everything!

## Local Testing

Test the built app locally:
```bash
# Build the app
npm run build

# Serve with any static server
python3 -m http.server 8080 --directory dist
# or
npx serve dist
# or
npm run preview
```

## Common Issues:

### 1. "redirect_uri_mismatch" error:
- Make sure the domain in Cloudflare environment variables exactly matches what's configured in Google Console
- Check for trailing slashes or protocol mismatches (http vs https)

### 2. "origin_mismatch" error:
- Add your Cloudflare Pages domain to "Authorized JavaScript origins" in Google Console

### 3. Environment variables not working:
- Make sure variables start with `VITE_` prefix
- Redeploy after adding environment variables
- Check that the build logs show the variables are being picked up

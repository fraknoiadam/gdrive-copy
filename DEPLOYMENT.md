# Cloudflare Pages Deployment Instructions

## Environment Variables Setup

To make Google OAuth work on Cloudflare Pages, you need to configure environment variables:

### 1. In Cloudflare Pages Dashboard:
1. Go to your Cloudflare Pages project
2. Navigate to Settings > Environment variables
3. Add the following variables for **Production**:

```
VITE_BASE_URL=https://your-app.pages.dev
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_API_KEY=your_google_api_key
```

### 2. In Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 client ID
4. Add your Cloudflare Pages domain to:
   - **Authorized JavaScript origins**: `https://your-app.pages.dev`
   - **Authorized redirect URIs**: `https://your-app.pages.dev`

### 3. Testing:
- The app should work on both `localhost:5173` (development) and your Cloudflare Pages domain
- Check browser console for authentication debugging info

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

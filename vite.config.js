import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable sourcemaps to avoid additional files
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        // Try different file extension
        entryFileNames: 'assets/app-[hash].bundle.js',
        chunkFileNames: 'assets/chunk-[hash].bundle.js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Use ES format but try to make it work
        format: 'es',
        // Inline everything possible
        inlineDynamicImports: true,
        manualChunks: undefined,
      }
    },
    // Inline small assets
    assetsInlineLimit: 4096,
    // Don't split CSS
    cssCodeSplit: false,
  },
  // Add explicit environment variable
  define: {
    'import.meta.env.VITE_BASE_URL': '"https://gdrivecopy.durreinfo.hu"'
  }
})

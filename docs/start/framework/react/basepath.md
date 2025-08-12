---
id: basepath
title: Basepath Configuration
---

When you need to deploy your TanStack Start application to a subdirectory, you can configure a basepath. This is useful when you want to serve your application from a path like `https://example.com/my-app`.

## ⚠️ Important: Dual Configuration Required

When using basepath, you need to configure it in **two places** with the same value:

1. **TanStack Start Configuration** - for routing
2. **Vite Configuration** - for static assets

If both configurations are not set correctly, you may experience issues such as static file loading failures or incorrect path references.

## Configuration Example

### 1. TanStack Start Configuration (app.config.ts):

```typescript
import { defineConfig } from '@tanstack/start/config'

export default defineConfig({
  server: {
    preset: 'node-server',
    basepath: '/my-app', // Set your basepath here
  },
})
```

### 2. Vite Configuration (vite.config.ts):

```typescript
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/start/vite'

export default defineConfig({
  base: '/my-app', // Must match the basepath above
  plugins: [tanstackStart()],
})
```

## Why Both Configurations?

- **TanStack Start's basepath**: Handles application routing and navigation
- **Vite's base**: Ensures static assets (JS, CSS, images) are loaded from the correct path

## Troubleshooting

If you experience issues with assets not loading or 404 errors after setting a basepath:

1. Verify both configurations use the exact same path
2. Ensure the path starts with `/` and doesn't end with `/`
3. Clear your build cache and rebuild the application
4. Clear browser cache and refresh the page

### Correct Path Format:
- ✅ `/my-app`
- ✅ `/api/v1`
- ❌ `my-app` (doesn't start with slash)
- ❌ `/my-app/` (ends with slash)

## Deployment Considerations

When using basepath, ensure your deployment environment is configured to serve the application correctly from the specified path. For example:

- **Nginx**: Configure `location /my-app/` block
- **Apache**: Set up path rewrite rules in `.htaccess`
- **Netlify/Vercel**: Verify basepath support in deployment settings

## Example Project Structure

Complete project structure example with basepath configured:

```
my-project/
├── app.config.ts          # basepath: '/my-app'
├── vite.config.ts         # base: '/my-app'
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   └── index.tsx
│   └── main.tsx
└── package.json
```

With this configuration, your application will work correctly at `https://yourdomain.com/my-app`.

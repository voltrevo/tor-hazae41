# GitHub Pages Deployment Guide

This guide will help you deploy your Tor client demo to GitHub Pages.

## 🚀 Quick Setup

### 1. Enable GitHub Pages in Repository Settings

1. Go to your GitHub repository
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. Save the configuration

### 2. Push Your Code

Once you push your code to the `main` branch, the GitHub Action will automatically:

- Build your Vite project
- Deploy it to GitHub Pages
- Make it available at `https://yourusername.github.io/tor-js/`

## 🔧 What Was Configured

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)

- Automatically triggers on pushes to `main` branch
- Sets up Node.js environment
- Installs dependencies with `npm ci`
- Builds the project with `npm run build`
- Deploys to GitHub Pages

### Vite Configuration (`vite.config.js`)

- Added proper base path for GitHub Pages (`/tor-js/`)
- Configured build output to `dist` directory
- Disabled sourcemaps for smaller build size
- Maintained all existing polyfills and optimizations

### Package Scripts (`package.json`)

- Added `build` script: `vite build`
- Added `preview` script: `vite preview` (for local testing)

### Static Files (`public/.nojekyll`)

- Prevents Jekyll processing on GitHub Pages
- Ensures all files are served correctly

## 🧪 Testing Locally

Before deploying, you can test the production build locally:

```bash
# Build the project
npm run build

# Preview the built project
npm run preview
```

This will serve the built files locally, simulating the GitHub Pages environment.

## 🌐 Deployment Process

1. **Push to main branch**

   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

2. **Monitor deployment**
   - Go to your repository's **Actions** tab
   - Watch the deployment workflow progress
   - Check for any errors in the logs

3. **Access your site**
   - Once deployed, visit: `https://yourusername.github.io/tor-js/`

- Replace `yourusername` with your actual GitHub username

## 🔍 Troubleshooting

### Common Issues

1. **404 Error on GitHub Pages**
   - Ensure the repository name matches the base path in `vite.config.js`
   - Check that GitHub Pages is enabled and source is set to "GitHub Actions"

2. **Build Failures**
   - Check the Actions tab for detailed error logs
   - Ensure all dependencies are properly listed in `package.json`
   - Verify that the build works locally with `npm run build`

3. **Assets Not Loading**
   - The `.nojekyll` file should prevent Jekyll processing
   - Verify the base path configuration in `vite.config.js`

### Manual Deployment

If automatic deployment fails, you can manually trigger it:

1. Go to your repository's **Actions** tab
2. Click on the "Deploy to GitHub Pages" workflow
3. Click "Run workflow" button
4. Select the `main` branch and click "Run workflow"

## 📝 Notes

- **First deployment** may take a few minutes to propagate
- **Subsequent deployments** are usually faster
- The site updates automatically when you push to the `main` branch
- Your Tor client demo will work in the browser environment with all configured polyfills

## 🛡️ Security Considerations

- The demo runs entirely in the browser
- All Tor connections use the Snowflake proxy system
- No sensitive data is stored or transmitted beyond the demo functionality
- The GitHub Pages deployment is static and doesn't include any server-side components

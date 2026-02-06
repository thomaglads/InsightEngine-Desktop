# InsightEngine Desktop - Deployment Guide

## Overview
This guide covers the deployment process for InsightEngine Desktop, an enterprise-grade AI data analysis application built with Electron and React.

## Prerequisites

### Development Environment
- Node.js 18.x or 20.x LTS
- npm 9.x or higher
- Git 2.x or higher
- Windows: Visual Studio Build Tools (for native modules)
- macOS: Xcode Command Line Tools
- Linux: build-essential package

### Required Secrets (GitHub)
Configure these secrets in your GitHub repository Settings > Secrets and variables > Actions:

#### Code Signing Certificates
- `WINDOWS_CERTIFICATE`: Base64-encoded P12 certificate for Windows signing
- `WINDOWS_CERTIFICATE_PASSWORD`: Password for Windows certificate
- `MACOS_CERTIFICATE`: Base64-encoded P12 certificate for macOS signing
- `MACOS_CERTIFICATE_PASSWORD`: Password for macOS certificate
- `KEYCHAIN_PASSWORD`: Password for temporary macOS keychain

#### Apple Notarization (macOS only)
- `APPLE_ID`: Apple Developer ID email
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for notarization
- `APPLE_TEAM_ID`: Apple Developer Team ID

#### Error Tracking (Optional)
- `SENTRY_DSN`: Sentry DSN for crash reporting

## Deployment Workflows

### 1. Continuous Integration (CI)
Automatically runs on every push and pull request.

**File**: `.github/workflows/ci.yml`

**Triggers**:
- Push to `main`, `lemon`, or `develop` branches
- Pull requests to these branches

**Jobs**:
- **Test & Lint**: Runs unit tests, coverage report, and ESLint
- **Build Application**: Builds the app on Ubuntu, Windows, and macOS
- **Security Audit**: Runs `npm audit` and CodeQL analysis

### 2. Release Workflow
Creates signed installers for all platforms.

**File**: `.github/workflows/release.yml`

**Triggers**:
- Git tags starting with `v` (e.g., `v1.0.0`)
- Manual workflow dispatch

**Output**: Signed installers uploaded to GitHub Releases

## Manual Deployment Process

### Step 1: Version Bump
```bash
# Update version in package.json
npm version [patch|minor|major]

# Or manually edit package.json version field
```

### Step 2: Create Git Tag
```bash
# Create and push tag to trigger release workflow
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### Step 3: Monitor Build
1. Go to GitHub Actions tab
2. Watch the "Release" workflow
3. Wait for all platform builds to complete (10-20 minutes)

### Step 4: Publish Release
1. Go to GitHub Releases
2. Find the draft release created by the workflow
3. Review release notes
4. Publish the release

## Local Build (Testing)

### Development Mode
```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev
```

### Production Build
```bash
# Build for current platform
npm run electron:build

# Build for all platforms (requires certificates)
npm run electron:build:all
```

## Platform-Specific Notes

### Windows
- **Installer**: `.exe` (NSIS)
- **Portable**: `.exe` (no installation required)
- **Code Signing**: Required for SmartScreen bypass
- **Minimum**: Windows 10 (64-bit)

### macOS
- **Installer**: `.dmg`
- **Portable**: `.zip`
- **Code Signing**: Required for Gatekeeper
- **Notarization**: Required for macOS 10.15+
- **Minimum**: macOS 11.0 (Big Sur)

### Linux
- **Universal**: `.AppImage`
- **Debian/Ubuntu**: `.deb`
- **Fedora/RHEL**: `.rpm`
- **No signing required**
- **Minimum**: glibc 2.31+

## Environment Configuration

### Production Environment Variables
Create `.env.production` in the project root:

```env
NODE_ENV=production
SENTRY_DSN=your_sentry_dsn_here
```

### Electron Build Configuration
Settings are in `package.json` under the `build` key:
- App ID: `com.insightengine.app`
- Product Name: `InsightEngine Enterprise`
- Output Directory: `dist_electron/`

## Testing

### Unit Tests
```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### E2E Tests
```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

## Security Considerations

### Code Signing
- All Windows and macOS builds must be signed
- Unsigned builds will show security warnings
- Certificates must be renewed annually

### Content Security Policy
- Electron renderer has CSP enabled
- No inline scripts allowed
- Only local resources permitted

### IPC Security
- All IPC channels are explicitly defined in `preload.js`
- No direct Node.js access from renderer
- Context isolation is enabled

### Data Privacy
- No telemetry in offline mode
- Sentry only collects error data (configurable)
- File paths are sanitized before reporting

## Troubleshooting

### Build Failures
1. Check Node.js version (must be 18.x or 20.x)
2. Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
3. Check for missing native dependencies

### Signing Failures
1. Verify certificates are not expired
2. Check certificate passwords are correct
3. Ensure macOS keychain is properly configured

### E2E Test Failures
1. Update Playwright: `npx playwright install`
2. Check if dev server is running on port 5173
3. Verify test fixtures exist in `e2e/fixtures/`

## Rollback Procedure

If a release has critical issues:

1. Delete the GitHub Release
2. Remove the Git tag: `git push --delete origin v1.0.0`
3. Create a hotfix branch from the previous stable tag
4. Apply fixes and create new release

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review error messages in Sentry (if configured)
3. Consult the troubleshooting section above
4. Create an issue in the repository

## Release Checklist

Before publishing a release:
- [ ] All tests passing (unit + E2E)
- [ ] Security audit completed
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Git tag created and pushed
- [ ] CI/CD pipeline successful
- [ ] Installers tested on all platforms
- [ ] Code signing verified
- [ ] Release notes reviewed
# PWA Installation Troubleshooting Guide

## Why You Might Not See the Install Button (+)

### Common Reasons:

1. **Browser Compatibility**
   - ✅ **Chrome/Edge (Desktop)**: Full PWA support
   - ✅ **Safari (iOS/Mac)**: PWA support via "Add to Home Screen"
   - ⚠️ **Firefox**: Limited PWA support (no auto-prompt)
   - ❌ **Some browsers**: No PWA support at all

2. **HTTPS Requirement**
   - PWAs only work on **HTTPS** or **localhost**
   - If your site is on HTTP, install won't work

3. **Already Installed**
   - If you've already installed the app, the prompt won't show
   - Check if Tale Weaver is already in your apps

4. **First Visit Timing**
   - Browsers require **user engagement** before showing install
   - Visit the site, interact with it, then the prompt appears
   - May take 30 seconds to a few minutes of usage

5. **Browser Settings**
   - Some browsers have PWA disabled by default
   - Check browser settings for "Install apps" or "PWA" options

## How to Install (Manual Methods)

### Chrome (Desktop)
1. Look for the **install icon** (⊕ or ⬇️) in the address bar (right side)
2. Click it and select "Install"
3. Or: Menu (⋮) → "Install Tale Weaver"
4. Or: Menu (⋮) → "More tools" → "Create shortcut" → Check "Open as window"

### Edge (Desktop)
1. Look for the **install icon** in the address bar
2. Or: Menu (⋯) → "Apps" → "Install Tale Weaver"
3. Or: Menu (⋯) → "More tools" → "Create shortcut"

### Safari (Mac)
1. Click **File** in menu bar
2. Select **"Add to Dock..."**
3. Name the app and click **Add**

### Safari (iOS/iPhone)
1. Tap the **Share** button (square with arrow)
2. Scroll down and tap **"Add to Home Screen"**
3. Name it and tap **Add**

### Chrome (Android)
1. Tap the **menu** (⋮)
2. Tap **"Install"** or **"Add to Home screen"**
3. Follow the prompts

### Firefox (Desktop)
1. Firefox has limited PWA support
2. Use: Menu (≡) → "More tools" → "Create shortcut"
3. This creates a desktop shortcut but not a full PWA

## Testing PWA Installation

### Check if PWA is Working

1. **Open DevTools** (F12 or Ctrl+Shift+D / Cmd+Option+I)
2. Go to **Application** tab (Chrome/Edge)
3. Check:
   - **Manifest**: Should show app name, icons, etc.
   - **Service Workers**: Should show "activated" status
   - **Cache Storage**: Should show cached files

### Console Commands to Test

Open browser console (F12) and run:

```javascript
// Check if PWA is installable
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('Install prompt available!');
});

// Check service worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Service workers:', registrations);
});

// Check manifest
fetch('/manifest.json')
  .then(r => r.json())
  .then(m => console.log('Manifest loaded:', m));
```

## Why Install Button Might Not Work

### The Install Button Shows But Does Nothing:

1. **No Install Event Captured**
   - Browser hasn't triggered the `beforeinstallprompt` event yet
   - Solution: Use the site for a bit, then try again

2. **Already Installed**
   - Can't install twice
   - Solution: Uninstall first, then reinstall

3. **Browser Doesn't Support It**
   - Some browsers don't support programmatic install
   - Solution: Use manual installation methods above

4. **Dev Mode**
   - Service workers are disabled in development mode
   - Solution: Test in production build

## PWA Features in Tale Weaver

### What's Included:
- ✅ **manifest.json** - App metadata and icons
- ✅ **Service Worker** - Offline caching
- ✅ **Install Prompt** - Auto-shows when available
- ✅ **Install Guide** - Browser-specific instructions
- ✅ **Install Button** - Manual trigger in header

### What It Does:
- Caches app shell for offline use
- Works without internet (cached pages)
- Runs as standalone app (no browser UI)
- Auto-updates on each launch
- Custom icon on desktop/home screen

## Debugging Steps

### If Install Still Doesn't Work:

1. **Clear Browser Cache**
   - Chrome: Ctrl+Shift+Delete / Cmd+Shift+Delete
   - Clear "Cached images and files"
   - Reload page

2. **Clear Service Workers**
   - Open DevTools → Application → Service Workers
   - Click "Unregister" on any workers
   - Reload page

3. **Clear All Site Data**
   - DevTools → Application → Storage
   - Click "Clear site data"
   - Reload page

4. **Try Incognito/Private Mode**
   - Opens fresh browser session
   - No cached data interfering

5. **Try Different Browser**
   - Chrome or Edge recommended for desktop
   - Safari for iOS

6. **Check HTTPS**
   - Ensure site is on HTTPS (not HTTP)
   - Localhost works for testing

## Browser Console Errors

### Common Errors and Solutions:

**"Install prompt is not a function"**
- Fixed: Updated to use proper event handling

**"Manifest not found (404)"**
- Fixed: Created manifest.json in public folder

**"Service worker registration failed"**
- Check: Service worker file exists at `/service-worker.js`
- Check: Site is on HTTPS or localhost

**"beforeinstallprompt not firing"**
- Normal: Browser requires user engagement first
- Solution: Interact with site, wait 30+ seconds

## Success Indicators

### You'll Know It's Working When:

1. ✅ Install prompt appears automatically
2. ✅ Install button in header triggers browser prompt
3. ✅ App installs to desktop/home screen
4. ✅ App opens in standalone window (no address bar)
5. ✅ App works offline (disconnect internet)
6. ✅ App has custom icon

## After Installation

### What to Expect:

- **Desktop**: App appears in applications folder
- **Mac**: App added to Dock
- **Windows**: App added to Start Menu
- **iOS**: App icon on home screen
- **Android**: App icon in app drawer

### Updates:

- App auto-updates when you reload
- Service worker checks for new version on each load
- No manual updates needed

---

## Quick Reference

| Browser | Install Method | Support Level |
|---------|---------------|---------------|
| Chrome (Desktop) | Address bar icon or Menu | ✅ Full |
| Edge (Desktop) | Address bar icon or Menu | ✅ Full |
| Safari (Mac) | File → Add to Dock | ✅ Full |
| Safari (iOS) | Share → Add to Home Screen | ✅ Full |
| Chrome (Android) | Menu → Install | ✅ Full |
| Firefox | Menu → Create Shortcut | ⚠️ Limited |

**Need Help?**
- Check browser console for errors
- Try manual installation methods
- Use Chrome or Edge for best experience
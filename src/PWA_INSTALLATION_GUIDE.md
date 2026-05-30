# PWA Installation Guide - Tale Weaver

## What is a PWA?

A **Progressive Web App (PWA)** is a web application that can be installed on your device like a native app. PWAs provide:

- ✅ **Native app experience** - Runs in its own window without browser UI
- ✅ **Offline support** - Works even when you're offline (cached content)
- ✅ **Cross-platform** - Install on Windows, Mac, Linux, iOS, and Android
- ✅ **Auto-updates** - Always gets the latest version without manual updates
- ✅ **No app store** - Install directly from the browser

## Installation Instructions

### Windows/Mac/Linux (Desktop)

#### Google Chrome / Microsoft Edge
1. Open [Tale Weaver](https://your-app-url.com) in Chrome or Edge
2. Look for the **install icon** (⊕) in the address bar
3. Click **"Install"** or **"Add to desktop"**
4. The app will install and appear on your desktop/start menu

**Alternative method:**
1. Click the **three dots menu** (⋮ or ⋯)
2. Go to **"More tools"** or **"Apps"**
3. Select **"Create shortcut"** or **"Install Tale Weaver"**
4. Check **"Open as window"** and click **Create**

#### Safari (Mac)
1. Open Tale Weaver in Safari
2. Click **File** in the menu bar
3. Select **"Add to Dock..."**
4. Name the app and click **Add**
5. The app appears in your Dock

#### Firefox
1. Open Tale Weaver in Firefox
2. Click the **menu button** (≡)
3. Select **"More tools"** → **"Create shortcut"**
4. Name the shortcut and click **Create**

### Mobile Devices

#### iOS (iPhone/iPad)
1. Open Tale Weaver in **Safari**
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Name the app and tap **Add**
5. The app icon appears on your Home Screen

#### Android (Chrome)
1. Open Tale Weaver in Chrome
2. Tap the **three dots menu** (⋮)
3. Select **"Add to Home screen"** or **"Install app"**
4. Name the app and tap **Add**
5. The app appears on your Home Screen

## Features

### Offline Capabilities
Once installed, Tale Weaver caches essential files for offline use:
- App shell and UI components
- Character data (locally stored)
- Recent game sessions
- Core assets and icons

**Note:** Some features requiring server connection (AI story generation, cloud saves) need internet access.

### App Updates
PWAs update automatically:
- Service worker checks for updates on each visit
- New version downloads in background
- Updates apply on next app launch
- No manual updates needed!

### Storage
- **Cache size:** ~5-10 MB for app shell
- **Offline data:** Character sheets, game sessions
- **Managed automatically:** Old cache cleared on updates

## Troubleshooting

### App Won't Install?

**Check browser compatibility:**
- ✅ Chrome 67+
- ✅ Edge 79+
- ✅ Safari 11.3+ (iOS 11.3+)
- ✅ Firefox 68+
- ❌ Internet Explorer (not supported)

**Desktop issues:**
- Make sure you're on **HTTPS** (secure connection)
- Clear browser cache and reload
- Try a different browser

**Mobile issues:**
- iOS: Must use **Safari** (not Chrome on iOS)
- Android: Use Chrome or Samsung Internet
- Check if you have storage space

### App Not Working Offline?

1. **First-time setup:** Open the app while online to cache files
2. **Check cache:** Open DevTools → Application → Cache Storage
3. **Clear and reload:** Clear cache and reload the page
4. **Reinstall:** Uninstall and reinstall the app

### App Looks Different Than Browser?

This is normal! The PWA:
- Removes browser UI (address bar, tabs)
- Uses standalone display mode
- May have different window controls
- Optimized for app experience

## Uninstall Instructions

### Windows
1. Open **Settings** → **Apps**
2. Find **Tale Weaver**
3. Click **Uninstall**

### Mac
1. Open **Finder** → **Applications**
2. Find **Tale Weaver**
3. Drag to **Trash** or right-click → **Move to Trash**

### Chrome/Edge (All Platforms)
1. Open `chrome://apps` or `edge://apps`
2. Right-click **Tale Weaver**
3. Select **Remove from Chrome/Edge**

### iOS
1. Long-press the app icon
2. Tap **Remove App**
3. Confirm **Delete**

### Android
1. Long-press the app icon
2. Tap **Uninstall** or drag to **Uninstall**

## Technical Details

### Service Worker
The app uses a service worker (`/service-worker.js`) to:
- Cache app assets
- Handle offline requests
- Manage app updates
- Enable background sync

### Manifest File
The PWA manifest (`/manifest.json`) defines:
- App name and description
- Icons and theme colors
- Display mode (standalone)
- Start URL and orientation

### Cache Strategy
- **Cache-first:** App shell, icons, core assets
- **Network-first:** Dynamic content, API calls
- **Stale-while-revalidate:** Mixed content

## Privacy & Security

### Data Storage
- **Local cache:** App files only (no personal data)
- **Character data:** Stored on Base44 servers
- **Session data:** Synced to cloud when online

### Security
- **HTTPS required:** All PWA features need secure connection
- **Sandboxed:** Runs in secure browser environment
- **No native access:** Cannot access device files/system

## Performance Tips

### First Load
- Initial load may take 2-5 seconds
- Subsequent loads are instant (from cache)
- Offline mode loads immediately

### Best Practices
1. **Install on SSD:** Faster load times
2. **Keep browser updated:** Latest PWA features
3. **Clear cache monthly:** Remove old data
4. **Use on stable connection:** For initial install

## Browser Support Matrix

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Desktop Install | ✅ | ✅ | ✅ | ⚠️ Limited |
| Mobile Install | ✅ | ✅ | ✅ (iOS) | ❌ |
| Offline Mode | ✅ | ✅ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ | ❌ | ✅ |
| Background Sync | ✅ | ✅ | ❌ | ❌ |
| File Access | ✅ | ✅ | ❌ | ❌ |

✅ = Full support | ⚠️ = Partial support | ❌ = Not supported

## Advanced: Developer Mode

### Inspect PWA
1. Open app
2. Press **F12** (DevTools)
3. Go to **Application** tab
4. View **Manifest**, **Service Workers**, **Cache Storage**

### Debug Service Worker
```javascript
// In browser console
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg);
});

// Check cache
caches.keys().then(names => {
  console.log('Caches:', names);
});
```

### Force Update
```javascript
// Force service worker update
navigator.serviceWorker.getRegistration().then(reg => {
  if (reg) reg.update();
});
```

## Support

Having issues? Contact support with:
- **Browser name and version**
- **Operating system**
- **Error messages** (if any)
- **Steps to reproduce**

## Links

- [What are PWAs?](https://web.dev/progressive-web-apps/)
- [PWA Installation Guide](https://web.dev/install-criteria/)
- [Service Worker Basics](https://web.dev/learn/pwa/service-workers)
- [Web App Manifest](https://web.dev/add-manifest/)

---

**Tale Weaver PWA** - Version 1.0  
Built with Base44 Platform  
© 2024 Tale Weaver
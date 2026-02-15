# Mobile App Setup (Same Web App UI)

This project can run as a native mobile app using Capacitor while keeping the same web UI (`index.html`, `app.js`, `styles.css`).

## 1. Prerequisites

- Node.js 18+ and npm
- Android Studio (for Android app)
- Xcode (for iOS app, macOS only)

## 2. Install dependencies

```bash
npm install
```

## 3. Prepare web bundle for mobile

```bash
npm run mobile:prepare
```

This copies web files into `mobile-web/` (the Capacitor web directory).

## 4. Initialize native platforms (one-time)

```bash
npx cap add android
npx cap add ios
```

## 5. Open in native IDE

Android:

```bash
npm run mobile:android
```

iOS:

```bash
npm run mobile:ios
```

## 6. Build and run

- In Android Studio: choose emulator/device -> Run.
- In Xcode: choose simulator/device -> Run.

## 7. After every web code change

When you update `index.html`, `app.js`, `styles.css`, `utils.js`, or `config.js`, run:

```bash
npm run mobile:sync
```

Then build again from Android Studio / Xcode.

## 8. Data behavior in mobile

- If `config.js` has Supabase configured, mobile app users share realtime data with web users.
- If Supabase is empty, mobile app stores data only on that device browser storage.

## 9. Important note for `config.js`

Do not commit private secrets. Keep only public values used by frontend:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SHARED_STATE_ROW_ID`
- `SUPABASE_STORAGE_BUCKET`


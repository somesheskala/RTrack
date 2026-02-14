# Supabase Realtime Setup

1. Create a Supabase project.
2. Open SQL Editor and run `/Users/se066192/Documents/New project/supabase-setup.sql`.
3. In Project Settings -> API, copy:
   - Project URL
   - Anon public key
4. Update `/Users/se066192/Documents/New project/config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_PUBLIC_KEY",
  SHARED_STATE_ROW_ID: "shared"
};
```

5. Deploy/host the app over HTTPS.

Notes:
- All users will read/write the same shared row (`app_state.id = "shared"`).
- If Supabase config is empty, app falls back to local browser storage.

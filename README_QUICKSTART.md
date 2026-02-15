# RTrack Quickstart

## 1) One-Time Setup

1. Configure Supabase in `config.js`:
```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_PUBLIC_KEY",
  SHARED_STATE_ROW_ID: "shared"
};
```

2. Run `supabase-setup.sql` once in Supabase SQL Editor.

3. Deploy to Netlify from GitHub repo (`somesheskala/RTrack`).

---

## 2) Daily Dev Flow (Bug Fix / Feature)

```bash
cd "/Users/se066192/Documents/New project"
git checkout master
git pull origin master
git checkout -b fix/<short-name>
```

Make changes, test, then:

```bash
git add .
git commit -m "Describe change"
git push -u origin fix/<short-name>
```

Create PR -> Merge to `master`.

Netlify auto-deploys (if connected to GitHub).

---

## 3) Fast Production Update (Direct to master)

```bash
cd "/Users/se066192/Documents/New project"
git checkout master
git pull origin master
git add .
git commit -m "Quick fix"
git push origin master
```

---

## 4) Verify Realtime

1. Open production URL in 2 browsers/devices.
2. Update tenant/unit/payment in one window.
3. Confirm other window updates automatically.

---

## 5) No-Data-Loss Rules

1. Do **not** change `SHARED_STATE_ROW_ID` in production.
2. Do **not** drop `public.app_state`.
3. Before major changes, export backup from Supabase `app_state` table.

---

## 6) Common Fixes

## UI not updating after deploy
```text
Hard refresh (Cmd+Shift+R) and clear site data if needed.
```

## Realtime not working
```text
Check SUPABASE_URL, SUPABASE_ANON_KEY, and SQL setup.
```

## Email not sending
```text
Check EmailJS Public Key, Service ID, Template ID in Settings.
```

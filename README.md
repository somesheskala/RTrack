# RTrack - Rental Management App

This app is a static frontend (`index.html`, `app.js`, `styles.css`) with optional shared realtime data using Supabase.

## 1. Quick Architecture

- Frontend hosting: Netlify (or any static host)
- Shared data store: Supabase table `public.app_state`
- Realtime sync: Supabase `postgres_changes` subscription in `app.js`
- Email notifications: EmailJS API

Important:
- If `config.js` has empty Supabase values, app falls back to browser `localStorage` (not shared).
- For multi-user realtime, `config.js` must be configured and app must run on hosted HTTPS URL.

---

## 2. Supabase Setup (Realtime Shared Data)

### Step 1: Create project
1. Go to https://supabase.com
2. Create/select project.

### Step 2: Create table and policies
1. Open Supabase `SQL Editor`.
2. Run file: `supabase-setup.sql`

This creates:
- table: `public.app_state`
- RLS policies for read/write

### Step 3: Get keys
From Supabase `Project Settings -> API`, copy:
- `Project URL`
- `anon public key`

### Step 4: Configure app
Edit `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_PUBLIC_KEY",
  SHARED_STATE_ROW_ID: "shared"
};
```

Keep `SHARED_STATE_ROW_ID` stable (for example `shared`) so existing data is reused.

---

## 3. EmailJS Setup (Rent Reminder / Review Emails)

### Step 1: Create EmailJS account
1. Go to https://www.emailjs.com
2. Create account/login.

### Step 2: Add email service
1. Create a mail service connection (Gmail/Outlook/etc).
2. Note the `Service ID`.

### Step 3: Create template
1. Create template for reminders/review emails.
2. Include params used by app:
   - `to_email`
   - `to_name`
   - `cc_emails`
   - `subject`
   - `message`
3. Note the `Template ID`.

### Step 4: Get public key
1. EmailJS account -> API keys.
2. Copy `Public Key`.

### Step 5: Save in app (Admin)
In app `Settings` tab, fill:
- Administrator Emails
- Manager Emails
- EmailJS Public Key
- EmailJS Service ID
- EmailJS Template ID
- Sender Name
- Review subject template

Click `Save Email Lists`.

---

## 4. Netlify Deployment

## Option A: Deploy from GitHub (recommended)
1. Push code to GitHub repo (for example `somesheskala/RTrack`).
2. In Netlify: `Add new site -> Import an existing project`.
3. Connect GitHub and select repo.
4. Build command: empty
5. Publish directory: `.`
6. Deploy.

## Option B: Drag-and-drop
1. Zip or drag project folder contents to Netlify deploy UI.
2. Deploy manually.

After deploy, open your site URL (example):
- `https://your-site-name.netlify.app`

---

## 5. Safe Update Workflow (Bug Fix / New Feature)

Use this every time to avoid breaking production and avoid data loss.

### Step 1: Pull latest
```bash
git checkout master
git pull origin master
```

### Step 2: Create feature branch
```bash
git checkout -b fix/<short-name>
```

### Step 3: Make code changes
- Update `app.js`, `styles.css`, `index.html`, etc.
- Keep `SHARED_STATE_ROW_ID` unchanged unless intentionally migrating data.

### Step 4: Local test checklist
- Login with Viewer/Manager/Admin PIN
- Add/edit tenant/unit
- Mark paid/unpaid
- Verify dashboard/active/lease tabs
- Verify no console errors

### Step 5: Commit and push
```bash
git add .
git commit -m "Describe fix/feature"
git push -u origin fix/<short-name>
```

### Step 6: Merge to master
- Create PR on GitHub
- Review and merge to `master`

### Step 7: Netlify deploy
- If linked to GitHub: Netlify auto-deploys on merge to `master`
- If manual: redeploy latest project files

### Step 8: Post-deploy validation
- Open production URL
- Verify existing data is still visible
- Verify realtime sync with second browser/device

---

## 6. Data Safety / No Data Loss Notes

1. App data is stored in Supabase row:
   - table: `public.app_state`
   - id: `SHARED_STATE_ROW_ID` (default `shared`)

2. Do not change `SHARED_STATE_ROW_ID` unless you want a new blank dataset.

3. Do not drop/replace `public.app_state` in production without backup.

4. Before major release, take a backup:
   - Supabase Table Editor -> export `app_state`
   - or SQL dump from Supabase tools

5. Frontend redeploy (Netlify) does not delete Supabase data by itself.

---

## 7. Troubleshooting

## Realtime not syncing
- Check `config.js` keys are set correctly.
- Check Supabase SQL setup ran successfully.
- Check browser console/network errors.

## App shows old UI after deploy
- Hard refresh (`Cmd+Shift+R`).
- Clear site data in browser.

## Email not sending
- Verify EmailJS Public Key, Service ID, Template ID.
- Verify template param names match app payload.

---

## 8. Project Files

- `index.html` - main UI
- `styles.css` - visual styles
- `app.js` - main logic
- `utils.js` - utility helpers
- `config.js` - runtime config (Supabase values)
- `supabase-setup.sql` - DB setup script
- `SUPABASE_SETUP.md` - short Supabase notes

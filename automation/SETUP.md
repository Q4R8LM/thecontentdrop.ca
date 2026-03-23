# Content Automation Setup Guide

This system auto-generates and publishes Pinterest pins, Facebook posts, and blog articles on a weekly schedule using Google Apps Script (free), Cloudinary (free), and the APIs for each platform.

**Time to set up: ~45 minutes**

---

## What You'll Need

- A Google account (for Sheets + Apps Script)
- A Cloudinary account (free tier — sign up at cloudinary.com)
- Pinterest Business account with API access
- Facebook Page with a developer app
- GitHub Personal Access Token

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet
2. Name it: **The Content Drop — Content Calendar**
3. From the menu: **Extensions → Apps Script**
4. A new script editor will open. Delete all default code in the editor.
5. Paste the entire contents of `Code.gs` into the editor
6. Click the floppy disk icon (or Ctrl+S / Cmd+S) to save
7. Name the project: **Content Drop Automation**

---

## Step 2 — Run the Setup Function

1. In the Apps Script editor, click the function dropdown (next to the Run button) and select **`setup`**
2. Click **Run**
3. You'll be asked to authorize the script — click **Review permissions**, choose your Google account, then click **Allow**
4. The script will create 4 sheets: **Content**, **Strategy**, **Analytics**, and **Config**
5. It will also create the scheduled triggers automatically

If you see a red error about authorization, just click Run again — the second attempt will work after permissions are granted.

---

## Step 3 — Set Up Cloudinary (Image Generation)

Cloudinary generates your Pinterest and Facebook images programmatically for free.

### Create your account
1. Go to [cloudinary.com](https://cloudinary.com) and sign up for a free account
2. From your dashboard, note your **Cloud Name** (top left, looks like `dxxxxxxxx`)

### Upload the background images
1. In your Cloudinary dashboard, go to **Media Library**
2. Click **Upload** → **Browse**
3. Upload these two files from the repo:
   - `assets/pin-bg.svg` → after uploading, note the **Public ID** (e.g., `pin-bg`)
   - `assets/fb-bg.svg` → note the **Public ID** (e.g., `fb-bg`)
4. If Cloudinary adds a folder prefix, the Public ID will look like `folder/pin-bg` — use the full ID as shown in the Media Library

### Add to Config sheet
Fill in these rows in the **Config** sheet:
- `CLOUDINARY_CLOUD_NAME` → your Cloud Name (e.g., `dxxxxxxxx`)
- `CLOUDINARY_BG_PIN_ID` → Public ID of pin-bg.svg (e.g., `pin-bg`)
- `CLOUDINARY_BG_FB_ID` → Public ID of fb-bg.svg (e.g., `fb-bg`)

---

## Step 4 — Get Your Pinterest Access Token

### Enable API access
1. Go to [developers.pinterest.com](https://developers.pinterest.com)
2. Click **My Apps → Create app**
3. Fill in the app details (name: "Content Drop", description: anything)
4. Under **Redirect URIs**, add: `https://oauth.pstmn.io/v1/callback`
5. Note your **App ID** and **App Secret**

### Get a long-lived access token
The easiest method is to use the Pinterest Token Generator:
1. Go to: `https://www.pinterest.com/oauth/?client_id=YOUR_APP_ID&redirect_uri=https://oauth.pstmn.io/v1/callback&response_type=code&scope=boards:read,pins:write,user_accounts:read`
2. Replace `YOUR_APP_ID` with your actual App ID
3. Authorize the app
4. You'll be redirected — copy the `code=` value from the URL
5. Exchange it for a token using Postman or curl:
   ```
   curl -X POST https://api.pinterest.com/v5/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -u "YOUR_APP_ID:YOUR_APP_SECRET" \
     -d "grant_type=authorization_code&code=YOUR_CODE&redirect_uri=https://oauth.pstmn.io/v1/callback"
   ```
6. Copy the `access_token` from the response

**Note:** Pinterest tokens expire after 1 year. The `refresh_token` in the response can be used to get a new one before it expires.

### Add to Config sheet
- `PINTEREST_ACCESS_TOKEN` → paste your access token

---

## Step 5 — Get Your Facebook Page Access Token

This is the most involved step. You need a **long-lived Page access token** (valid for 60 days, renewable).

### Create a Facebook App
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click **My Apps → Create App**
3. Choose **Business** type → click **Next**
4. Fill in app name: "Content Drop" → click **Create App**
5. In the app dashboard, go to **Add a Product** → find **Facebook Login** → click **Set Up**
6. Under **Settings → Basic**, note your **App ID** and **App Secret**

### Get a short-lived user token
1. Go to the [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown (top right)
3. Click **Generate Access Token**
4. Authorize and grant these permissions: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`
5. Copy the token shown

### Exchange for a long-lived token
Run this in your browser (replace the placeholders):
```
https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_TOKEN
```
Copy the `access_token` from the JSON response.

### Get the Page access token
Run this (replace YOUR_LONG_TOKEN):
```
https://graph.facebook.com/v19.0/me/accounts?access_token=YOUR_LONG_TOKEN
```
Find your page in the list and copy its `access_token` and `id`.

### Add to Config sheet
- `FACEBOOK_PAGE_ID` → your page ID (the number)
- `FACEBOOK_ACCESS_TOKEN` → the page access token

**Note:** Long-lived page tokens are valid for 60 days. You'll need to repeat this process every 2 months, or set up a token refresh — the Graph API allows refreshing tokens before they expire.

---

## Step 6 — Get Your GitHub Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Name it: "Content Drop Publishing"
4. Set expiration to **No expiration** (or 1 year)
5. Check the scope: **repo** (this gives read/write access to your repos)
6. Click **Generate token**
7. Copy the token — you won't see it again

### Add to Config sheet
- `GITHUB_TOKEN` → your personal access token
- `GITHUB_REPO` is already filled in as `Q4R8LM/thecontentdrop.ca`

---

## Step 7 — Fill in Remaining Config Values

Open the **Config** sheet and fill in any remaining empty rows:

| Key | Value |
|-----|-------|
| `CLAUDE_API_KEY` | Your Anthropic API key (from console.anthropic.com) |
| `CLOUDINARY_CLOUD_NAME` | From Step 3 |
| `CLOUDINARY_BG_PIN_ID` | From Step 3 |
| `CLOUDINARY_BG_FB_ID` | From Step 3 |
| `PINTEREST_ACCESS_TOKEN` | From Step 4 |
| `FACEBOOK_PAGE_ID` | From Step 5 |
| `FACEBOOK_ACCESS_TOKEN` | From Step 5 |
| `GITHUB_TOKEN` | From Step 6 |
| `GITHUB_REPO` | `Q4R8LM/thecontentdrop.ca` (pre-filled) |
| `SITE_URL` | `https://thecontentdrop.ca` (pre-filled) |
| `STRIPE_URL` | `https://thecontentdrop.ca/captions.html` (pre-filled) |

---

## Step 8 — Load Your Pinterest Boards

1. In the Google Sheet, click the **Content Drop** menu (top menu bar)
2. Click **Fetch Pinterest Boards**
3. This will pull all your board names and IDs from Pinterest and store them in the Config sheet
4. You should see a success message in a few seconds

If you get an error, check that your Pinterest access token is correct and has the `boards:read` scope.

---

## Step 9 — Test the System

### Run a manual generation
1. Click the **Content Drop** menu → **Generate This Week's Content**
2. This will take 30–60 seconds (it's calling Claude three times)
3. When done, check the **Content** sheet — you should see rows for 35 Pinterest pins, 7 Facebook posts, and 2 blog posts, all with status **Draft**

### Approve and publish one item
1. Find any Pinterest pin row in the Content sheet
2. Change its **Status** cell from `Draft` to `Approved`
3. The `onEdit` trigger fires immediately and attempts to publish it
4. Check the row — status should change to `Published` and a Pin URL should appear in the Notes column

If it fails, the status will change to `Failed` and the error will be in the Notes column.

---

## How the System Works Week-to-Week

### Automatic Schedule
| When | What happens |
|------|-------------|
| Every Monday at 7am | Generates 35 Pinterest pins + 7 Facebook posts + 2 blog posts for the week (all set to Draft) |
| Every hour | Scans for any Approved rows that haven't been published yet (safety net) |
| Every Sunday at 8am | Pulls Pinterest + Facebook analytics, writes to Analytics sheet, generates a strategy tip |

### Your Weekly Workflow (10–20 min)
1. **Monday** — Open the Content sheet, review the generated content
2. For anything you want published: change Status from `Draft` to `Approved`
3. Publishing happens automatically within seconds of approval
4. **Sunday** — Open the Analytics sheet to see what performed best that week

### Editing content before approving
You can edit the **Headline**, **Description/Message**, or **Body HTML** columns before approving. The published version uses whatever is in the sheet at the time of approval.

### Skipping content
Leave anything you don't want as `Draft` — it will never be published. Or change Status to `Skipped` to mark it intentionally.

---

## Troubleshooting

**"Exception: Request failed" on publishing**
- Check that your access token hasn't expired
- Pinterest tokens last 1 year; Facebook page tokens last 60 days
- Re-run the token steps and update the Config sheet

**Content sheet is empty after generation**
- Check the CLAUDE_API_KEY in Config is correct
- Open Apps Script → Executions (left sidebar) to see the error log

**Blog post not appearing on the site**
- Check your GitHub token has `repo` scope
- Verify GITHUB_REPO is exactly `Q4R8LM/thecontentdrop.ca`
- Check Apps Script executions for the error

**Pinterest boards not loading**
- Make sure your Pinterest token has `boards:read` scope
- Try regenerating the token with all required scopes

**Images look broken on Pinterest/Facebook**
- Verify the Cloudinary Public IDs are correct (no extra slashes or spaces)
- Test the image URL directly in a browser: `https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/YOUR_PUBLIC_ID`

---

## Token Renewal Reminders

Set a calendar reminder for:
- **Facebook token renewal**: every 50 days (before the 60-day expiry)
- **Pinterest token renewal**: every 11 months (before the 1-year expiry)
- **GitHub token renewal**: annually (if you set an expiry)

When renewing, just update the value in the Config sheet — no need to touch the script.

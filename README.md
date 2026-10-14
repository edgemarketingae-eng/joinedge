# Edge Academy enquiry page → Google Sheets

## Files
- `edge-academy-enquiry.html` — the full page (logo embedded). Host it anywhere: your website, Hostinger/cPanel, Netlify, Vercel, or GitHub Pages.
- `Code.gs` — the Google Apps Script that writes every submission into a Google Sheet.

## 1. Create the Sheet (5 min)
1. Create a new Google Sheet, e.g. **Edge Academy – Course Leads** (use the shared team account).
2. **Extensions → Apps Script**. Delete the sample code, paste all of `Code.gs`, click **Save**.
3. Optional: set `NOTIFY_EMAIL = 'sales@…, service@…'` to get an email for every new lead.
4. In the function dropdown pick **setup** → **Run** → approve the Google permissions prompt.
   A `Leads` tab appears with headers, a Status dropdown and frozen header row.

## 2. Publish the script as a Web App
1. **Deploy → New deployment** → gear icon → **Web app**.
2. *Execute as:* **Me**. *Who has access:* **Anyone**.
3. **Deploy** → copy the **Web app URL** (ends in `/exec`).
4. Paste it into a browser tab: you should see `{"ok":true,...}`.

## 3. Connect the page
Open `edge-academy-enquiry.html`, find near the bottom:

```js
const SCRIPT_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
```

Replace the text in quotes with your `/exec` URL, save, upload the page. Submit one test lead and check the `Leads` tab.

> If you later edit `Code.gs`, use **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same URL. Creating a *new deployment* gives a new URL that you'd have to paste again.

## What lands in each row
Submitted time (Dubai) · Full name · Phone · WhatsApp · WhatsApp chat link (click to open a chat) · Same as phone · Job title · **Status** (New → Contacted → Interested → Follow-up → Enrolled / Not interested / Invalid number) · Assigned to · Notes · UTM source / medium / campaign / content / term · Page · Referrer.

## Team workflow
1. Lead submits → row appears with Status **New** (and an email if enabled).
2. Service team filters Status = New, clicks the chat link, messages on WhatsApp, sets **Assigned to** and moves Status.
3. Marketing reads campaign quality from the UTM columns, e.g. a Pivot table of Status by `UTM campaign`.

## Ads tracking
Use UTM links in ads, e.g. `…/enquiry.html?utm_source=meta&utm_medium=paid&utm_campaign=oct_batch`.
On success the page also fires `fbq('track','Lead')` and a `dataLayer` event `lead_submitted` if Meta Pixel / Google Tag Manager are installed on the page.

## Built-in protection
Hidden honeypot field for bots, duplicate guard (same WhatsApp within 10 minutes is ignored), formula-injection safe cells, and a lock so simultaneous submissions don't overwrite each other.

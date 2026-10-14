/**
 * Edge Trading Academy — Course enquiry → Google Sheets
 * Paste this whole file into Extensions → Apps Script of your Google Sheet.
 * Run setup() once, then Deploy → New deployment → Web app.
 *
 * @OnlyCurrentDoc  (limits access to this one spreadsheet)
 */

const SHEET_NAME   = 'Leads';
const TIMEZONE     = 'Asia/Dubai';
// Optional: comma-separated emails that get a message for every new lead. Leave '' to turn off.
const NOTIFY_EMAIL = '';

const HEADERS = [
  'Submitted (Dubai)', 'Full name', 'Phone', 'WhatsApp', 'WhatsApp chat link',
  'WhatsApp same as phone', 'Job title', 'Status', 'Assigned to', 'Notes',
  'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term', 'Page', 'Referrer'
];
const STATUSES = ['New', 'Contacted', 'Interested', 'Follow-up', 'Enrolled', 'Not interested', 'Invalid number'];

/** Run once from the editor: creates the Leads tab, headers, status dropdown and formatting. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#021A1A').setFontColor('#08E186');
  sh.setFrozenRows(1);
  const statusCol = HEADERS.indexOf('Status') + 1;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
  sh.getRange(2, statusCol, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  sh.setColumnWidths(1, HEADERS.length, 150);
  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(10, 260);
}

/** Lets you open the /exec URL in a browser to confirm the deployment is live. */
function doGet() {
  return json_({ ok: true, service: 'Edge Academy enquiry endpoint' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = (e && e.parameter) || {};

    // Honeypot: bots fill the hidden "company" field. Pretend success, store nothing.
    if (p.company) return json_({ ok: true });

    const name  = clean_(p.name, 80);
    const phone = phone_(p.phone);
    const wa    = phone_(p.whatsapp);
    const job   = clean_(p.job_title, 80);
    if (!name || !phone || !wa || !job) return json_({ ok: false, error: 'Missing required fields' });

    const sh = getSheet_();

    // Duplicate guard: same WhatsApp number in the last 10 minutes → don't add a second row.
    const last = sh.getLastRow();
    if (last > 1) {
      const from = Math.max(2, last - 30);
      const rows = sh.getRange(from, 1, last - from + 1, 4).getValues();
      const now = Date.now();
      for (const r of rows) {
        const t = r[0] instanceof Date ? r[0].getTime() : 0;
        if (String(r[3]).replace(/\D/g, '') === wa.replace(/\D/g, '') && now - t < 10 * 60 * 1000) {
          return json_({ ok: true, duplicate: true });
        }
      }
    }

    const waLink = 'https://wa.me/' + wa.replace(/\D/g, '');
    sh.appendRow([
      new Date(), name, "'" + phone, "'" + wa, waLink,
      p.same_as_phone === 'yes' ? 'Yes' : 'No', job, 'New', '', '',
      clean_(p.utm_source, 100), clean_(p.utm_medium, 100), clean_(p.utm_campaign, 150),
      clean_(p.utm_content, 150), clean_(p.utm_term, 150), clean_(p.page, 300), clean_(p.referrer, 300)
    ]);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat('yyyy-mm-dd hh:mm');

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'New Edge Academy enquiry: ' + name,
        body: [
          'Name: ' + name, 'Phone: ' + phone, 'WhatsApp: ' + wa, 'Chat: ' + waLink,
          'Job title: ' + job, 'Source: ' + (p.utm_source || 'direct') + ' / ' + (p.utm_campaign || '-'),
          '', 'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
        ].join('\n')
      });
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { setup(); sh = ss.getSheetByName(SHEET_NAME); }
  return sh;
}
// Trim, cap length, and neutralise spreadsheet formula injection (=, +, -, @ at the start).
function clean_(v, max) {
  let s = String(v || '').trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function phone_(v) {
  const s = String(v || '').trim();
  const d = s.replace(/\D/g, '');
  // The page sends "+971 501234567"; keep only digits, "+" and spaces.
  return d.length >= 6 && d.length <= 16 ? s.replace(/[^\d+ ]/g, '') : '';
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

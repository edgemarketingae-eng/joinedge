/**
 * Edge Trading Academy — Website enquiries → Google Sheets
 * Two tabs: "Course Leads" (Forex Course) and "Mentorship Leads" (Edge Mentorship Program).
 * The page sends program=course|mentorship; each submission goes to its own tab.
 * Run setup() once after editing, then Deploy → Manage deployments → Edit → New version.
 *
 * @OnlyCurrentDoc  (limits access to this one spreadsheet)
 */

const TIMEZONE     = 'Asia/Dubai';
// Optional: comma-separated emails that get a message for every new lead. Leave '' to turn off.
const NOTIFY_EMAIL = '';

const UTM_COLS = ['UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'UTM term', 'Page', 'Referrer'];

const TABS = {
  course: {
    name: 'Course Leads',
    legacyName: 'Leads', // the original tab is renamed, its rows are kept
    headers: ['Submitted (Dubai)', 'Full name', 'Phone', 'WhatsApp', 'WhatsApp chat link',
              'WhatsApp same as phone', 'Job title', 'Status', 'Assigned to', 'Notes'].concat(UTM_COLS),
    statuses: ['New', 'Contacted', 'Interested', 'Follow-up', 'Enrolled', 'Not interested', 'Invalid number'],
    headerBg: '#021A1A', headerFg: '#08E186'
  },
  mentorship: {
    name: 'Mentorship Leads',
    headers: ['Submitted (Dubai)', 'Full name', 'Phone', 'WhatsApp', 'WhatsApp chat link',
              'WhatsApp same as phone', 'Job title / Profession', 'Trading experience', 'Status',
              'Assigned to', 'Assessment call', 'Notes'].concat(UTM_COLS),
    statuses: ['New', 'Contacted', 'Assessment call booked', 'Assessed', 'Selected', 'Enrolled',
               'Not suitable', 'Not interested', 'Invalid number'],
    headerBg: '#03624C', headerFg: '#FFFFFF'
  }
};
const EXPERIENCE = ['Beginner / Just starting', 'Less than 1 year', '1–2 years', 'More than 2 years'];

/** Run from the editor: creates/updates both tabs, headers, Status dropdowns and formatting. Safe to re-run. */
function setup() {
  Object.keys(TABS).forEach(function (k) { ensureTab_(k); });
}

function ensureTab_(key) {
  const cfg = TABS[key];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(cfg.name);
  if (!sh && cfg.legacyName) {
    sh = ss.getSheetByName(cfg.legacyName);
    if (sh) sh.setName(cfg.name);
  }
  if (!sh) sh = ss.insertSheet(cfg.name);
  sh.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers])
    .setFontWeight('bold').setBackground(cfg.headerBg).setFontColor(cfg.headerFg);
  sh.setFrozenRows(1);
  const statusCol = cfg.headers.indexOf('Status') + 1;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(cfg.statuses, true).setAllowInvalid(false).build();
  sh.getRange(2, statusCol, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  sh.setColumnWidths(1, cfg.headers.length, 150);
  sh.setColumnWidth(2, 180);
  sh.setColumnWidth(cfg.headers.indexOf('Notes') + 1, 260);
  return sh;
}

/** Lets you open the /exec URL in a browser to confirm the deployment is live. */
function doGet() {
  return json_({ ok: true, service: 'Edge Academy enquiry endpoint', tabs: [TABS.course.name, TABS.mentorship.name] });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const p = (e && e.parameter) || {};

    // Honeypot: bots fill the hidden "company" field. Pretend success, store nothing.
    if (p.company) return json_({ ok: true });

    const key   = p.program === 'mentorship' ? 'mentorship' : 'course';
    const name  = clean_(p.name, 80);
    const phone = phone_(p.phone);
    const wa    = phone_(p.whatsapp);
    const job   = clean_(p.job_title, 80);
    const exp   = EXPERIENCE.indexOf(p.trading_experience) > -1 ? p.trading_experience : '';
    if (!name || !phone || !wa || !job) return json_({ ok: false, error: 'Missing required fields' });
    if (key === 'mentorship' && !exp) return json_({ ok: false, error: 'Missing trading experience' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(TABS[key].name) || ensureTab_(key);

    // Duplicate guard: same WhatsApp number in this tab within 10 minutes → don't add a second row.
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
    const same = p.same_as_phone === 'yes' ? 'Yes' : 'No';
    const tail = [
      clean_(p.utm_source, 100), clean_(p.utm_medium, 100), clean_(p.utm_campaign, 150),
      clean_(p.utm_content, 150), clean_(p.utm_term, 150), clean_(p.page, 300), clean_(p.referrer, 300)
    ];
    const row = key === 'mentorship'
      ? [new Date(), name, "'" + phone, "'" + wa, waLink, same, job, exp, 'New', '', '', ''].concat(tail)
      : [new Date(), name, "'" + phone, "'" + wa, waLink, same, job, 'New', '', ''].concat(tail);
    sh.appendRow(row);
    sh.getRange(sh.getLastRow(), 1).setNumberFormat('yyyy-mm-dd hh:mm');

    if (NOTIFY_EMAIL) {
      const label = key === 'mentorship' ? 'Mentorship application' : 'Course enquiry';
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: 'New Edge Academy ' + label + ': ' + name,
        body: [
          'Program: ' + label, 'Name: ' + name, 'Phone: ' + phone, 'WhatsApp: ' + wa, 'Chat: ' + waLink,
          'Job title: ' + job, exp ? 'Trading experience: ' + exp : '',
          'Source: ' + (p.utm_source || 'direct') + ' / ' + (p.utm_campaign || '-'),
          '', 'Sheet: ' + ss.getUrl()
        ].filter(String).join('\n')
      });
    }
    return json_({ ok: true, tab: TABS[key].name });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */
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

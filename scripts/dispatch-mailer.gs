/**
 * THE KEEPER'S DISPATCH - free self-hosted newsletter sender.
 *
 * Pairs with the intake that already runs: puzzlesecret.com/api/subscribe -> Apps
 * Script -> this Google Sheet. That half is LIVE. This file is the other half:
 * it sends the monthly issue FROM the sheet, and honours unsubscribes.
 *
 * You compose each issue as a normal GMAIL DRAFT whose subject starts with
 * "DISPATCH:". Nothing here asks you to write HTML.
 *
 * WHY A DRAFT: the newsletter is written, previewed and proofread in the tool Dan
 * already uses, and this script is only a delivery mechanism. It also means a
 * half-written issue can never go out - the marker in the subject is the safety.
 *
 * QUOTA REALITY (consumer gmail.com): Apps Script may send to 100 recipients/day.
 * sendDispatch() is therefore RESUMABLE - it marks each address as it goes and
 * stops before the quota runs out. Re-run it and it picks up exactly where it
 * stopped. A 250-person list takes three mornings.
 *
 * SETUP: see NEWSLETTER-SETUP.md in site/.
 */

// ---------------------------------------------------------------- configuration

const CFG = {
  SHEET_NAME: 'Subscribers',      // tab holding the addresses
  SUBJECT_MARKER: 'DISPATCH:',    // draft subject prefix that arms an issue
  FROM_NAME: "The Keeper's Dispatch",
  SITE: 'https://puzzlesecret.com',
  // CAN-SPAM requires a real postal address in every commercial email, and it is
  // printed in the footer of every issue. Swap in a PO box here if you would rather
  // not publish a home address to the list.
  POSTAL_ADDRESS: 'Daniel Herlehy, 5309 Roberts Road, Suite 11, Hamburg, NY 14075',
  // Stay under the 100/day consumer ceiling with room for your ordinary mail.
  DAILY_CAP: 85,
  SEND_ATTACHMENTS: false,        // link to PDFs instead - attachments hurt delivery
};

const COLS = ['Email', 'Joined', 'Source', 'Status', 'Token', 'LastIssue', 'LastSent'];

// ---------------------------------------------------------------- sheet helpers

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Bind this script to the subscriber Sheet (open the Sheet, then Extensions > Apps Script).');
  const sh = ss.getSheetByName(CFG.SHEET_NAME) || ss.getSheets()[0];
  if (!sh) throw new Error('No sheet found.');
  return sh;
}

/** Header name -> 0-based column index, matched case-insensitively. */
function headerMap_(sh) {
  const row = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  const map = {};
  row.forEach(function (h, i) {
    const k = String(h || '').trim().toLowerCase();
    if (k) map[k] = i;
  });
  return map;
}

/**
 * Make the sheet safe to send from: guarantee every column this script needs,
 * give every subscriber an unguessable unsubscribe token, default blank statuses
 * to active, and drop duplicate addresses. Idempotent - run it whenever.
 */
function setupSheet() {
  const sh = sheet_();
  let map = headerMap_(sh);

  // Append any missing columns rather than assuming a layout - the intake script
  // owns the leading columns and must not be disturbed.
  COLS.forEach(function (c) {
    if (!(c.toLowerCase() in map)) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(c);
      map = headerMap_(sh);
    }
  });

  const last = sh.getLastRow();
  if (last < 2) { Logger.log('Sheet ready. No subscribers yet.'); return; }

  const width = sh.getLastColumn();
  const data = sh.getRange(2, 1, last - 1, width).getValues();
  const iEmail = map['email'], iStatus = map['status'], iToken = map['token'];

  const seen = {};
  const kill = [];
  data.forEach(function (r, n) {
    const email = String(r[iEmail] || '').trim().toLowerCase();
    if (!email) return;
    if (seen[email]) { kill.push(n + 2); return; }   // later duplicate - remove
    seen[email] = true;
    if (!r[iStatus]) r[iStatus] = 'active';
    if (!r[iToken]) r[iToken] = Utilities.getUuid();
  });

  sh.getRange(2, 1, data.length, width).setValues(data);
  // Delete bottom-up so earlier row indices stay valid.
  kill.reverse().forEach(function (rowNum) { sh.deleteRow(rowNum); });

  Logger.log('Sheet ready. ' + Object.keys(seen).length + ' unique subscribers, ' + kill.length + ' duplicates removed.');
}

// ---------------------------------------------------------------- the issue

/** Find the armed Gmail draft. Exactly one must match, so a send is never ambiguous. */
function findDraft_() {
  const hits = GmailApp.getDrafts().filter(function (d) {
    return String(d.getMessage().getSubject() || '').trim().indexOf(CFG.SUBJECT_MARKER) === 0;
  });

  if (!hits.length) {
    throw new Error('No armed draft. Compose a Gmail draft whose subject starts with "' + CFG.SUBJECT_MARKER + '".');
  }
  if (hits.length > 1) {
    throw new Error('Found ' + hits.length + ' drafts starting with "' + CFG.SUBJECT_MARKER +
      '". Leave exactly one armed so there is no doubt which issue goes out.');
  }
  return hits[0];
}

/** A stable id for this issue, so a resumed run never mails anyone twice. */
function issueId_(subject) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, subject)).slice(0, 10);
}

function footer_(token) {
  const url = CFG.SITE + '/api/unsubscribe?t=' + encodeURIComponent(token);
  return '' +
    '<div style="margin-top:32px;padding-top:16px;border-top:1px solid #d8d2c4;' +
    'font:13px/1.6 Georgia,serif;color:#6b6455">' +
    '<p style="margin:0 0 6px">You are receiving the Dispatch because you joined the ' +
    'Keeper&rsquo;s list at ' + CFG.SITE + '.</p>' +
    '<p style="margin:0 0 6px"><a href="' + url + '" style="color:#6b6455">' +
    'Unsubscribe with one click</a> &mdash; it takes effect immediately.</p>' +
    '<p style="margin:0;color:#8b8577">' + CFG.POSTAL_ADDRESS + '</p>' +
    '</div>';
}

// ---------------------------------------------------------------- sending

/**
 * Send the armed draft to every active subscriber who has not already received
 * this issue. Safe to run repeatedly: it resumes, it never double-sends, and it
 * stops before the daily quota is exhausted.
 */
function sendDispatch() {
  if (!CFG.POSTAL_ADDRESS) {
    throw new Error('Set CFG.POSTAL_ADDRESS first - a physical mailing address is legally ' +
      'required in commercial email (CAN-SPAM). A PO box is fine.');
  }

  const draft = findDraft_();
  const msg = draft.getMessage();
  const subject = String(msg.getSubject()).replace(CFG.SUBJECT_MARKER, '').trim();
  const body = msg.getBody();
  const attachments = CFG.SEND_ATTACHMENTS ? msg.getAttachments() : [];
  const issue = issueId_(subject);

  const sh = sheet_();
  const map = headerMap_(sh);
  const last = sh.getLastRow();
  if (last < 2) { Logger.log('No subscribers.'); return; }

  const width = sh.getLastColumn();
  const range = sh.getRange(2, 1, last - 1, width);
  const data = range.getValues();
  const iEmail = map['email'], iStatus = map['status'], iToken = map['token'];
  const iIssue = map['lastissue'], iSent = map['lastsent'];

  if (iToken === undefined || iStatus === undefined || iIssue === undefined) {
    throw new Error('Run setupSheet() once before sending.');
  }

  const budgetStart = Math.min(CFG.DAILY_CAP, MailApp.getRemainingDailyQuota());
  let budget = budgetStart;
  let sent = 0, skipped = 0, failed = 0;

  for (let n = 0; n < data.length; n++) {
    if (budget <= 0) break;

    const row = data[n];
    const email = String(row[iEmail] || '').trim().toLowerCase();
    if (!email) continue;
    if (String(row[iStatus]).toLowerCase() !== 'active') { skipped++; continue; }
    if (String(row[iIssue]) === issue) { skipped++; continue; }   // already got it

    if (!row[iToken]) row[iToken] = Utilities.getUuid();

    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: body + footer_(row[iToken]),
        name: CFG.FROM_NAME,
        attachments: attachments,
      });
      row[iIssue] = issue;
      row[iSent] = new Date();
      sent++; budget--;
    } catch (err) {
      // One bad address must never abort the run. Park it and move on.
      row[iStatus] = 'bounced';
      failed++;
      Logger.log('FAILED ' + email + ': ' + err);
    }
  }

  range.setValues(data);

  const remaining = data.filter(function (r) {
    return String(r[iStatus]).toLowerCase() === 'active' && String(r[iIssue]) !== issue;
  }).length;

  Logger.log('Issue "' + subject + '" (' + issue + '): sent ' + sent +
    ', skipped ' + skipped + ', failed ' + failed + ', still queued ' + remaining +
    '. Quota left today: ' + MailApp.getRemainingDailyQuota() + '.');

  if (remaining === 0 && sent > 0) {
    Logger.log('Issue complete. You may now delete the armed draft.');
  }
}

/** Send only to yourself, so you read the real thing before the list does. */
function sendTestToSelf() {
  const draft = findDraft_();
  const msg = draft.getMessage();
  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: '[TEST] ' + String(msg.getSubject()).replace(CFG.SUBJECT_MARKER, '').trim(),
    htmlBody: msg.getBody() + footer_('test-token-not-a-real-unsubscribe'),
    name: CFG.FROM_NAME,
    attachments: CFG.SEND_ATTACHMENTS ? msg.getAttachments() : [],
  });
  Logger.log('Test copy sent to ' + Session.getActiveUser().getEmail());
}

function listStats() {
  const sh = sheet_();
  const map = headerMap_(sh);
  const last = sh.getLastRow();
  if (last < 2) { Logger.log('0 subscribers.'); return; }
  const data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  const tally = {};
  data.forEach(function (r) {
    const s = String(r[map['status']] || 'active').toLowerCase();
    tally[s] = (tally[s] || 0) + 1;
  });
  Logger.log(JSON.stringify(tally));
}

// ---------------------------------------------------------------- unsubscribe

/**
 * Called server-side by puzzlesecret.com/api/unsubscribe with the subscriber's
 * token. The token is an opaque UUID, so the link cannot be guessed and no email
 * address ever travels in a URL.
 *
 * Deploy: Deploy > New deployment > Web app > Execute as ME, access ANYONE.
 */
function doGet(e) {
  function out(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const token = e && e.parameter && e.parameter.t;
    if (!token) return out({ ok: false, reason: 'no_token' });

    const sh = sheet_();
    const map = headerMap_(sh);
    const last = sh.getLastRow();
    if (last < 2) return out({ ok: true, note: 'not_on_list' });

    const data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
    const iToken = map['token'], iStatus = map['status'];

    for (let n = 0; n < data.length; n++) {
      if (String(data[n][iToken]) === String(token)) {
        sh.getRange(n + 2, iStatus + 1).setValue('unsubscribed');
        return out({ ok: true });
      }
    }
    // An already-removed row is indistinguishable from a bad token, and that is
    // fine: the visitor's desired end state ("I am off the list") holds either way.
    return out({ ok: true, note: 'not_on_list' });
  } catch (err) {
    return out({ ok: false, reason: 'error' });
  }
}

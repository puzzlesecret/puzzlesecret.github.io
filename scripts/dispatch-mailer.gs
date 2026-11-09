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
 *
 * MIRROR: the running copy is Dispatch.gs in the Apps Script project bound to the signup Sheet on
 * puzzlesecretvault@gmail.com. Editing this file changes nothing until it is pasted over Dispatch.gs and saved.
 * sendDispatch / sendToSeeds / sendTestToSelf run from the editor, so a SAVE is enough for them; only
 * handleUnsubscribe_ runs through the web app, and it did not change on 2026-11-09, so no new deployment
 * version is needed for this revision.
 *
 * 2026-11-09: unsubscribe link fixed (footer_), any-error-means-bounced fixed (classifyError_ / trySend_),
 * per-row writes, brand in FROM_NAME, seeds (addSeed / addVaultSeed / sendToSeeds).
 */

// ---------------------------------------------------------------- configuration

const CFG = {
  SHEET_NAME: 'Sheet1',           // tab holding the addresses (intake writes here)
  SUBJECT_MARKER: 'DISPATCH:',    // draft subject prefix that arms an issue
  FROM_NAME: "PuzzleSecret · The Keeper's Dispatch",   // brand in the sender name (STRATEGY-DECISIONS §4.3)
  SITE: 'https://puzzlesecret.com',
  // CAN-SPAM requires a real postal address in every commercial email, and it is
  // printed in the footer of every issue. Swap in a PO box here if you would rather
  // not publish a home address to the list.
  POSTAL_ADDRESS: 'Daniel Herlehy, 5309 Roberts Road, Suite 11, Hamburg, NY 14075',
  // Stay under the 100/day consumer ceiling with room for your ordinary mail.
  DAILY_CAP: 85,
  SEND_ATTACHMENTS: false,        // link to PDFs instead - attachments hurt delivery
};

// Only the columns the SENDER needs. The intake script owns Timestamp/Email/Source
// and names them its own way, so they are deliberately not listed here - setupDispatch()
// appends what is missing and never renames or reorders what is already there.
const COLS = ['Email', 'Status', 'Token', 'LastIssue', 'LastSent'];

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
function setupDispatch() {
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

/**
 * The ONLY footer an issue carries (issue bodies never add their own unsubscribe/address lines).
 *
 * FIXED 2026-11-09: the link used to be /api/unsubscribe?t=…, an endpoint that removes only on POST, so a
 * click (a GET) answered with raw health JSON and removed nobody - every issue would have shipped with a dead
 * unsubscribe link. It now points at the /unsubscribed/ PAGE, which shows one confirm button that does the
 * POST. (The site also forwards the old /api/unsubscribe?t=… address to that page, so either works.)
 */
function footer_(token) {
  const url = CFG.SITE + '/unsubscribed/?t=' + encodeURIComponent(token);
  return '' +
    '<div style="margin-top:32px;padding-top:16px;border-top:1px solid #d8d2c4;' +
    'font:13px/1.6 Georgia,serif;color:#6b6455">' +
    '<p style="margin:0 0 6px">You are receiving the Dispatch because you joined the ' +
    'Keeper&rsquo;s list at ' + CFG.SITE + '.</p>' +
    '<p style="margin:0 0 6px"><a href="' + url + '" style="color:#6b6455">' +
    'Unsubscribe</a> &mdash; one button on the next page and you are off the list.</p>' +
    '<p style="margin:0;color:#8b8577">PuzzleSecret &middot; ' + CFG.POSTAL_ADDRESS + '</p>' +
    '</div>';
}

/**
 * Sort a MailApp failure into what to do about it.
 *   'invalid' - the address itself was refused before sending (MailApp's "Invalid email: …"). Permanent.
 *   'quota'   - the daily sending limit tripped. Stop the run; resume tomorrow.
 *   'retry'   - anything else (a Google hiccup, a timeout). Leave the subscriber exactly as they were.
 * FIXED 2026-11-09: the old catch marked EVERY exception 'bounced' - one transient Google failure would
 * silently and permanently drop a subscriber from every future issue. Real bounces arrive later as
 * mailer-daemon mail in the puzzlesecretvault inbox and are handled by hand (set Status to 'bounced').
 */
function classifyError_(err) {
  const m = String(err && err.message || err || '');
  if (/invalid (email|recipient)|invalid argument:\s*(to|recipient)/i.test(m)) return 'invalid';
  if (/too many times|quota|limit exceeded|rate ?limit/i.test(m)) return 'quota';
  return 'retry';
}

/** Send one message; one quiet retry on a transient failure. Returns '' on success or the failure kind. */
function trySend_(message) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      MailApp.sendEmail(message);
      return '';
    } catch (err) {
      const kind = classifyError_(err);
      Logger.log('Send to ' + message.to + ' failed (' + kind + ', attempt ' + (attempt + 1) + '): ' + err);
      if (kind !== 'retry' || attempt === 1) return kind;
      Utilities.sleep(3000);
    }
  }
  return 'retry';
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
  const data = sh.getRange(2, 1, last - 1, width).getValues();
  const iEmail = map['email'], iStatus = map['status'], iToken = map['token'];
  const iIssue = map['lastissue'], iSent = map['lastsent'], iSource = map['source'];

  if (iToken === undefined || iStatus === undefined || iIssue === undefined || iSent === undefined) {
    throw new Error('Run setupDispatch() once before sending.');
  }

  const budgetStart = Math.min(CFG.DAILY_CAP, MailApp.getRemainingDailyQuota());
  let budget = budgetStart;
  let sent = 0, skipped = 0, invalid = 0, deferred = 0, transientInARow = 0, stopped = '';

  // Each row is written back the moment it changes (2026-11-09). The old version wrote the whole block once at
  // the end, which (a) lost every stamp if the run died part-way, so the next run re-mailed people, and (b)
  // overwrote any unsubscribe that landed DURING the run with the stale 'active' read at the start.
  const put = function (n, col, value) { sh.getRange(n + 2, col + 1).setValue(value); };

  for (let n = 0; n < data.length; n++) {
    if (budget <= 0) { stopped = 'daily cap'; break; }

    const row = data[n];
    const email = String(row[iEmail] || '').trim().toLowerCase();
    if (!email) continue;
    // Seed rows (Dan's own test inboxes, added with addSeed) only ever get sendToSeeds(), never a real issue.
    if (iSource !== undefined && String(row[iSource] || '').trim().toLowerCase() === 'seed') { skipped++; continue; }
    // A BLANK status means active. The intake webhook writes only Timestamp/Email/
    // Source, so every new signup arrives with Status empty; treating blank as
    // inactive would silently drop each new subscriber from every issue.
    if (String(row[iStatus] || 'active').toLowerCase() !== 'active') { skipped++; continue; }
    if (String(row[iIssue]) === issue) { skipped++; continue; }   // already got it

    // Re-read this row's Status right before sending: someone may have unsubscribed since the run began.
    const liveStatus = String(sh.getRange(n + 2, iStatus + 1).getValue() || 'active').toLowerCase();
    if (liveStatus !== 'active') { skipped++; continue; }

    if (!row[iToken]) { row[iToken] = Utilities.getUuid(); put(n, iToken, row[iToken]); }

    const failure = trySend_({
      to: email,
      subject: subject,
      htmlBody: body + footer_(row[iToken]),
      name: CFG.FROM_NAME,
      attachments: attachments,
    });

    if (!failure) {
      put(n, iIssue, issue);
      put(n, iSent, new Date());
      sent++; budget--; transientInARow = 0;
    } else if (failure === 'invalid') {
      // The address was refused outright - the only failure that changes a subscriber's status.
      put(n, iStatus, 'bounced');
      invalid++;
    } else if (failure === 'quota') {
      deferred++; stopped = 'Google sending quota'; break;
    } else {
      // Transient: leave them active and un-stamped, so the next run tries again.
      deferred++; transientInARow++;
      if (transientInARow >= 3) { stopped = '3 failures in a row - Google may be having trouble'; break; }
    }
  }

  SpreadsheetApp.flush();
  const fresh = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const remaining = fresh.filter(function (r) {
    const seed = iSource !== undefined && String(r[iSource] || '').trim().toLowerCase() === 'seed';
    return !seed && String(r[iEmail] || '').trim() &&
      String(r[iStatus] || 'active').toLowerCase() === 'active' && String(r[iIssue]) !== issue;
  }).length;

  Logger.log('Issue "' + subject + '" (' + issue + '): sent ' + sent +
    ', skipped ' + skipped + ', invalid address ' + invalid + ', deferred (will retry) ' + deferred +
    ', still queued ' + remaining + (stopped ? ', stopped early: ' + stopped : '') +
    '. Quota left today: ' + MailApp.getRemainingDailyQuota() + '.');

  if (remaining === 0 && sent > 0) {
    Logger.log('Issue complete. You may now delete the armed draft.');
  }
}

/**
 * Add one of Dan's own inboxes as a SEED: a row with Source 'seed' and a real token. Seeds never receive a real
 * issue (sendDispatch skips them); sendToSeeds() mails only them, with working unsubscribe links, so the whole
 * path - email, footer, click, confirm button, Sheet flips to 'unsubscribed' - can be proved before the list
 * sees anything. Run from the editor: addSeed('puzzlesecretvault@gmail.com') via a one-line wrapper, or use
 * addVaultSeed() below.
 */
function addSeed(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 1) throw new Error('addSeed needs an email address.');
  setupDispatch();
  const sh = sheet_();
  const map = headerMap_(sh);
  const width = sh.getLastColumn();
  const last = sh.getLastRow();
  if (last >= 2) {
    const data = sh.getRange(2, 1, last - 1, width).getValues();
    for (let n = 0; n < data.length; n++) {
      if (String(data[n][map['email']] || '').trim().toLowerCase() === email) {
        // Already present: make it a seed again, active, with a token.
        sh.getRange(n + 2, map['source'] + 1).setValue('seed');
        sh.getRange(n + 2, map['status'] + 1).setValue('active');
        if (!data[n][map['token']]) sh.getRange(n + 2, map['token'] + 1).setValue(Utilities.getUuid());
        Logger.log('Seed refreshed: ' + email);
        return;
      }
    }
  }
  const row = new Array(width).fill('');
  row[map['timestamp'] !== undefined ? map['timestamp'] : 0] = new Date();
  row[map['email']] = email;
  if (map['source'] !== undefined) row[map['source']] = 'seed';
  row[map['status']] = 'active';
  row[map['token']] = Utilities.getUuid();
  sh.appendRow(row);
  Logger.log('Seed added: ' + email);
}

/** The one seed Claude uses for tests: the list's own sending inbox. */
function addVaultSeed() { addSeed('puzzlesecretvault@gmail.com'); }

/**
 * Mail the armed draft ONLY to seed rows, with their real tokens, whatever their Status (so a seed that was
 * unsubscribed during the last test is mailed again). Never stamps LastIssue, so seeds are reusable each month.
 * Subject is prefixed [SEED] so the copy is never mistaken for the real send.
 */
function sendToSeeds() {
  const draft = findDraft_();
  const msg = draft.getMessage();
  const subject = '[SEED] ' + String(msg.getSubject()).replace(CFG.SUBJECT_MARKER, '').trim();
  const sh = sheet_();
  const map = headerMap_(sh);
  if (map['source'] === undefined) throw new Error('No Source column - add a seed with addSeed() first.');
  const last = sh.getLastRow();
  if (last < 2) { Logger.log('No seeds.'); return; }
  const data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  let sent = 0;
  for (let n = 0; n < data.length; n++) {
    const r = data[n];
    if (String(r[map['source']] || '').trim().toLowerCase() !== 'seed') continue;
    const email = String(r[map['email']] || '').trim().toLowerCase();
    if (!email) continue;
    let token = r[map['token']];
    if (!token) { token = Utilities.getUuid(); sh.getRange(n + 2, map['token'] + 1).setValue(token); }
    const failure = trySend_({
      to: email,
      subject: subject,
      htmlBody: msg.getBody() + footer_(token),
      name: CFG.FROM_NAME,
      attachments: CFG.SEND_ATTACHMENTS ? msg.getAttachments() : [],
    });
    if (!failure) sent++;
  }
  Logger.log('Seed copies sent: ' + sent + '. Click Unsubscribe in one, press the button, then run listStats().');
}

/**
 * Send only to yourself, so you read the real thing before the list does.
 * NOTE: the footer carries a fake token, so its Unsubscribe link proves nothing - use sendToSeeds() for that.
 */
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
 * NOT named doGet on purpose: Code.gs already owns doGet for the signup webhook,
 * and this project has exactly one web-app deployment. Code.gs delegates here when
 * a ?t= parameter is present, so signup and unsubscribe share the one /exec URL.
 */
function handleUnsubscribe_(e) {
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

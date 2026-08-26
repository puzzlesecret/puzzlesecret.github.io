/**
 * INTAKE WEBHOOK - the live signup endpoint behind puzzlesecret.com/api/subscribe.
 *
 * MIRROR ONLY. The authoritative copy is Code.gs inside the Apps Script project
 * bound to the "PuzzleSecret Newsletter Signups" Sheet
 * (1BlWZ_WTVcpG6K9MLzUVNVepDmgUTZbsNRZ-W9SGjEGY) on puzzlesecretvault@gmail.com.
 * Editing this file changes nothing by itself - paste it into that project and
 * cut a new deployment version for it to take effect.
 *
 * Captured 2026-08-25, after adding the one-line doGet delegation to
 * handleUnsubscribe_ (defined in dispatch-mailer.gs / Dispatch.gs). doPost and
 * setupSheet below are byte-for-byte as they have run since 2026-07-28.
 *
 * NOTE the two setup functions are NOT the same thing:
 *   setupSheet()    - this file, intake: formats the Timestamp/Email/Source columns
 *   setupDispatch() - dispatch-mailer.gs, sender: adds Status/Token/LastIssue/LastSent
 */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  }
  function doGet(e) {
  if (e && e.parameter && e.parameter.t) return handleUnsubscribe_(e);
  return json_({ok: true, service: 'puzzlesecret-newsletter'});
  }
  function doPost(e) {
  try {
  var body = JSON.parse(e.postData.contents);
  var email = String(body.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 1) return json_({ok: false, reason: 'bad_email'});
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var last = sh.getLastRow();
  if (last > 1) {
  var seen = sh.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < seen.length; i++) {
  if (String(seen[i][0]).trim().toLowerCase() === email) return json_({ok: true, duplicate: true});
  }
  }
  sh.appendRow([new Date(), email, String(body.source || 'puzzlesecret.com')]);
  return json_({ok: true});
  } catch (err) {
  return json_({ok: false, reason: 'error'});
  }
  }
  function setupSheet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  sh.showColumns(1, 3);
  sh.showRows(1, 3);
  sh.getRange('A1:C1').setValues([['Timestamp', 'Email', 'Source']]).setFontWeight('bold');
  sh.setColumnWidth(1, 170);
  sh.setColumnWidth(2, 260);
  sh.setColumnWidth(3, 220);
  sh.setFrozenRows(1);
  return 'ok';
  }


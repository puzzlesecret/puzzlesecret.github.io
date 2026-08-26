# The Keeper's Dispatch — free newsletter, no third party

**What already runs (live, verified 2026-08-25):** `puzzlesecret.com/api/subscribe` → Apps Script
→ a Google Sheet on `puzzlesecretvault@gmail.com`. `GET /api/subscribe` returns
`{"configured":true}` on production, so signups are landing in the Sheet today.

**What this adds:** the sending half, plus the one-click unsubscribe `/newsletter` already
promises. Total cost: $0, at any list size. No Mailchimp, no ESP account, no card on file.

| Piece | Where it lives |
|---|---|
| Sender + unsubscribe handler | `site/scripts/dispatch-mailer.gs` (paste into Apps Script) |
| Unsubscribe endpoint | `site/src/pages/api/unsubscribe.js` |
| Unsubscribe landing page | `site/src/pages/unsubscribed.astro` |

---

## The one hard limit, up front

A consumer `gmail.com` account may send to **100 recipients per day** through Apps Script.
`sendDispatch()` is built around that: it marks each address as it sends, stops before the
quota runs out, and resumes where it stopped next time it runs. A 250-person list goes out
over three mornings.

**Migrate when the list passes ~300**, or the first month opens visibly collapse. Export the
Sheet to CSV and import to MailerLite (free to 1,000 subscribers) or Kit (free to 10,000).
The Sheet stays the master list the whole time, so there is never any lock-in to escape.

Also honest: mail from a plain `@gmail.com` address has no DKIM signature for
`puzzlesecret.com` and cannot set a `List-Unsubscribe` header, so some copies will land in
Promotions. For an opt-in list of tens of readers that is fine. It is not fine at thousands.

---

## Setup — once, about 15 minutes

1. **Open the subscriber Sheet** (signed in as `puzzlesecretvault@gmail.com`), then
   **Extensions → Apps Script**. The intake script is already there; do not edit it.
2. **File → + → Script**, name it `dispatch-mailer`, and paste the whole contents of
   `site/scripts/dispatch-mailer.gs`.
3. **Postal address — already filled in** as
   `Daniel Herlehy, 5309 Roberts Road, Suite 11, Hamburg, NY 14075`.
   CAN-SPAM requires a valid physical address in every commercial email — it is not
   optional — and it prints in the footer of every issue. To change it later, edit
   `CFG.POSTAL_ADDRESS`. `sendDispatch()` refuses to run while it is blank, deliberately.
4. **Run `setupSheet()`** and approve the permission prompt. It adds the `Status`, `Token`,
   `LastIssue` and `LastSent` columns, gives every subscriber an unguessable unsubscribe
   token, and removes duplicate addresses. Safe to re-run any time.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**

   Copy the `/exec` URL it gives you.
6. **Vercel → puzzlesecret project → Settings → Environment Variables**, add to
   **Production and Preview**:
   ```
   UNSUB_WEBHOOK = <the /exec URL from step 5>
   ```
   Redeploy. Confirm with:
   ```bash
   curl -s https://puzzlesecret.com/api/unsubscribe
   ```
   It should report `"configured":true`.

---

## Sending an issue — monthly, about 10 minutes

1. In Gmail (as `puzzlesecretvault@gmail.com`), write the issue as an ordinary **draft**.
   The subject **must** start with `DISPATCH:` — that marker is what arms it:
   ```
   DISPATCH: September — Ten New Puzzles and the Corsair's First Chart
   ```
   Everything before the marker is stripped from what subscribers see.
2. Run **`sendTestToSelf()`** and read the real email in your own inbox.
3. Run **`sendDispatch()`**. Check the execution log: it reports sent / skipped / failed /
   still queued, and the quota left.
4. If anything is still queued, run `sendDispatch()` again tomorrow. It will not mail anyone
   twice — each address is stamped with the issue id.
5. When the log says `Issue complete`, delete the draft.

**Link to the 10 puzzles, do not attach them.** Attachments from a Gmail address are a
deliverability liability; a link to a PDF on `puzzlesecret.com` is not. `SEND_ATTACHMENTS`
is `false` for that reason — flip it only if you decide otherwise.

### Optional: let it finish by itself
Apps Script → **Triggers** → Add trigger → `sendDispatch` → Time-driven → Day timer.
It becomes a no-op on days with no armed draft, and drains the queue on days with one.

---

## What the reader sees when they unsubscribe

Every issue carries a per-subscriber link to `/unsubscribed?t=<token>`. That page performs
the removal itself, then confirms it.

The removal is a **POST**, never a GET, and this matters: mail clients and corporate security
appliances prefetch every GET link in a message. Had removal happened on GET, those scanners
would silently unsubscribe readers who never clicked. Humans still get one click; scanners
change nothing. There is a `<noscript>` button for anyone without JavaScript.

The token is an opaque UUID stored in the Sheet, so unsubscribe links cannot be guessed and
no email address ever travels inside a URL.

---

## Promises `/newsletter` currently makes

Live copy on the page commits to all of these. The system above satisfies them; keep them true:

- Ten printable Sudoku puzzles every month (Easy / Medium / Hard)
- Delivered **on the 1st of every month**
- One-click unsubscribe, effective immediately
- No email gating on vault rewards — those stay free and open

If a month's puzzles are not ready, move the date on the page before the 1st rather than
sending late.

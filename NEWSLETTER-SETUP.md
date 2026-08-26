# The Keeper's Dispatch — free newsletter, no third party

**STATUS: LIVE and verified end to end on 2026-08-25.** Setup is done. This file is now the
operating manual, not a to-do list. Skip to **Sending an issue**.

Signups land in the Google Sheet *PuzzleSecret Newsletter Signups*
(`1BlWZ_WTVcpG6K9MLzUVNVepDmgUTZbsNRZ-W9SGjEGY`) on `puzzlesecretvault@gmail.com`, and issues
go out from that same sheet. Total cost: $0, at any list size. No ESP account, no card on file.

| Piece | Where it lives |
|---|---|
| Sender + unsubscribe handler | `site/scripts/dispatch-mailer.gs` → `Dispatch.gs` in the Apps Script project |
| Signup intake (pre-existing) | `site/scripts/intake-webhook.gs` → `Code.gs` in the same project |
| Unsubscribe endpoint | `site/src/pages/api/unsubscribe.js` |
| Unsubscribe landing page | `site/src/pages/unsubscribed.astro` |

Both scripts live in **one** Apps Script project — *"PuzzleSecret Newsletter - intake +
Dispatch mailer"*, bound to the sheet — sharing **one** web-app deployment, so signup and
unsubscribe run through the same `/exec` URL. `Code.gs`'s `doGet` delegates to
`handleUnsubscribe_` whenever a `?t=` parameter is present.

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

## Sending an issue — monthly, about 10 minutes

1. In Gmail (as `puzzlesecretvault@gmail.com`), write the issue as an ordinary **draft**.
   The subject **must** start with `DISPATCH:` — that marker is what arms it:
   ```
   DISPATCH: September — Ten New Puzzles and the Corsair's First Chart
   ```
   Everything up to and including the marker is stripped from what subscribers see.
2. Open the Sheet → **Extensions → Apps Script**, pick `Dispatch.gs`, choose
   **`sendTestToSelf`** in the function dropdown, and **Run**. Read the real email in your
   own inbox before anyone else gets it.
3. Switch the dropdown to **`sendDispatch`** and **Run**. The execution log reports
   sent / skipped / failed / still queued, and the quota left.
4. If anything is still queued, run `sendDispatch` again tomorrow. Nobody is mailed twice —
   each address is stamped with the issue id.
5. When the log says `Issue complete`, delete the draft.

**Link to the 10 puzzles, do not attach them.** Attachments from a Gmail address are a
deliverability liability; a link to a PDF on `puzzlesecret.com` is not. `SEND_ATTACHMENTS`
is `false` for that reason — flip it only if you decide otherwise.

### Other functions
- **`setupDispatch()`** — re-stamps the sheet: fills blank `Status`, issues missing `Token`s,
  removes duplicate addresses. Idempotent. Not required before a send (`sendDispatch` mints a
  token for anyone missing one), but harmless and tidy to run occasionally.
- **`listStats()`** — logs a tally of active / unsubscribed / bounced.
- Do **not** confuse `setupDispatch()` with `setupSheet()`. `setupSheet()` belongs to the
  intake script and only formats the Timestamp/Email/Source columns.

### Optional: let it finish by itself
Apps Script → **Triggers** → Add trigger → `sendDispatch` → Time-driven → Day timer.
It becomes a no-op on days with no armed draft, and drains the queue on days with one.

---

## How the sheet is used

`Timestamp | Email | Source` are written by the intake webhook and are never modified by the
sender. `Status | Token | LastIssue | LastSent` belong to the sender.

**A blank `Status` means active.** New signups always arrive with `Status` empty, because the
intake only writes the first three columns. The sender treats blank as active for exactly that
reason — an earlier version required the literal string `active` and would have silently
dropped every new subscriber from every issue.

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

## Verified end to end (2026-08-25)

Run against production, not a mock:

| Check | Result |
|---|---|
| `GET /api/subscribe` | `configured: true` |
| `GET /api/unsubscribe` | `configured: true` |
| Real signup `POST /api/subscribe` | row appeared in the Sheet |
| `setupDispatch()` | status `active`, UUID token assigned |
| Real `POST /api/unsubscribe` with that token | row flipped to `unsubscribed` |
| Same token again | still `ok` — idempotent |
| `GET /api/unsubscribe?t=<token>` | health JSON only, **no** removal (scanner-safe) |
| Duplicate signup | no second row (intake dedups) |

Test rows were deleted afterwards; the list is empty.

---

## Promises `/newsletter` currently makes

Live copy on the page commits to all of these. The system above satisfies them; keep them true:

- Ten printable Sudoku puzzles every month (Easy / Medium / Hard)
- Delivered **on the 1st of every month**
- One-click unsubscribe, effective immediately
- No email gating on vault rewards — those stay free and open

If a month's puzzles are not ready, move the date on the page before the 1st rather than
sending late.

---

## Vercel

`UNSUB_WEBHOOK` (Production + Preview) holds the `/exec` URL of the *"PuzzleSecret newsletter
webhook v1"* deployment. `NEWSLETTER_WEBHOOK` was already set and was not touched.

**If you ever cut a new Apps Script deployment**, note that a web app serves a *pinned
version* — editing code changes nothing until you go **Deploy → Manage deployments → edit →
New version → Deploy**. The URL stays the same, so no Vercel change is needed.

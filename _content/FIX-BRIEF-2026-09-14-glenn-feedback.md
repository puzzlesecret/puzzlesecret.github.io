# FIX BRIEF — the first full solver's report (Glenn Dallas, 2026-09-14)

> **HOW TO USE THIS FILE:** open a Claude Code session in `R:\Documents\Claude\Projects\PuzzleSecret`
> and paste:
> *"Read `site/_content/FIX-BRIEF-2026-09-14-glenn-feedback.md` in full. Follow PART 3 before you
> touch anything, then do PART 2 in the order C → B, then PART 5 before you say you are done."*
>
> _v3, 2026-09-14. Two independent audits found five factual errors in v1; everything below has been
> checked against the code, and where v1 was wrong the correction is marked ⚠️ **v1 WAS WRONG** so
> nobody re-derives the same mistake._
>
> ✅ **TASK A (the Sanctum wall) IS ALREADY DONE — Dan corrected it by hand on 2026-09-14. Do not
> attempt it, and read the box in PART 2 before doing anything that could touch the wall.**

---

## PART 1 — WHY THIS EXISTS

On **2026-09-14**, Glenn Dallas — a reviewer at **PuzzCulture / PuzzleNation** who was sent a
complimentary copy — became **the first person ever to finish the book 100%**: all three acts, the
hidden fourth room, the master puzzles, and he carved his initials on the Sanctum wall. He then sent
a detailed, generous email with five notes and one bug report.

**Three things follow, and they govern the whole job:**

1. 🔴 **He is a working reviewer who may publish about this site, and he is the one person on earth
   guaranteed to re-check anything he is told was fixed.**
2. 🔴 **Dan's reply to him makes promises in writing.** Before you start, **open the actual Gmail
   draft** (thread `1a05dfabdeb32ac6`) and read it — do not trust this brief's paraphrase, and
   **confirm whether it has already been sent.** The promises are: the wall initials (✅ **already
   honoured by Dan, 2026-09-14**), the word box (**Task B**), and *"I'll write and tell you when it's
   fixed"* for the lock (**Task C**).
3. ⚠️ **The lock bug is REPORTED, NOT YET REPRODUCED.** Nobody has seen it fail. "Two different
   browsers" rules out his machine but **not** his input device — a trackpad, a touchscreen or a
   high-frequency pointer stream are all live possibilities. **Read PART 3 rule 1 before you begin.**

**Things Glenn praised, which are therefore CONSTRAINTS — do not degrade or restyle them while
fixing what sits next to them:**
- *"And etch my initials, which is a lovely feature!"* — the carving feature itself is a win. Its
  **data** has already been curated by hand; **nothing in this job may touch its behaviour.**
- *"the illustrated point-and-click sections scratch a happy part of my brain from the old LucasArts
  days"* — the painted vault's look is a win. Task C may fix its logic; **it must not restyle it.**
- *"The Sudoku were scaled well in difficulty"* and the D&D-flavoured art.

---

## PART 2 — THE WORK, in the order C → B

_Both remaining tasks live in the same two files and should be one editing pass in one browser
session. Do C first: it is the hard unknown, and B is a ten-minute mechanical change in the same
files._

---

### ✅ TASK A — THE SANCTUM WALL: **DONE 2026-09-14. DO NOT ATTEMPT IT.**
Dan corrected the wall by hand. The register is a Google Sheet (`PuzzleSecret Sanctum Wall`) reached
through a Google Apps Script webhook; it held three rows, and he deleted the two that were his own:

| row | timestamp | initials | |
|---|---|---|---|
| 1 | 9/13/2026 22:20:52 | `DSH` | Dan's own test — **deleted** |
| 2 | 9/13/2026 22:20 | `DSH` | the same carve, **written twice** — deleted |
| 3 | 9/13/2026 22:48 | `GD` | **Glenn Dallas — KEPT. The only name on the wall.** |

🟢 The duplicate `DSH` pair is the defect predicted by the code audit and it is now confirmed in
production data: `carve.js:103` treats a 6-second relay `TimeoutError` as success, so one carve can
append twice. Worth fixing one day; **not this job.**

🔴 **WHAT THIS MEANS FOR YOU, AND IT IS THE MOST IMPORTANT LINE IN THIS SECTION:**
**`GD` is now the only row on that wall, and Dan has promised a reviewer it will stay that way.**
`site/.env` holds the live `SANCTUM_WEBHOOK` and `SANCTUM_AUTH`, so **a local dev server can write
real rows to that production sheet.** If you exercise the Vault IV carve flow while testing, you will
put a test mark back on the wall Dan just cleaned, and it will be on it when Glenn looks.
**Never POST to `/api/carve` — not locally, not against production, not "just to check". Never add a
delete path to `carve.js` or to the Apps Script. Do not touch the sheet.**

---

### 🔴 TASK C — THE LISTENING LOCK: "THE DIAL DIDN'T RESPOND"
**Glenn, verbatim:** *"I wasn't able to make the listening lock puzzle work. No matter what I did,
across two different browsers, the dial didn't respond."*

#### C.1 — There are TWO separate implementations. Test the 3D one FIRST.

| | file | reached by |
|---|---|---|
| **3D vault** | `site/src/scripts/vault3d.js` — `lockRender` ~3084, `openLock` ~3117, `tickLock` ~3139, `wireLock()` IIFE **3159–3175** | **the default** |
| **Painted / point-and-click** | `site/public/js/painted-vault.js` — `openLock()` **783–846** | opt-in only |

⚠️ **v1 WAS WRONG: it told you to start with the painted vault because Glenn mentioned LucasArts.
Start with the 3D vault instead.** `src/components/FlatVault.astro:260` decides the mode:
```js
var want3d = !(qp.get('mode') === 'painted' || qp.get('flat') === '1');
…
if (!webgl) want3d = false;          // painted is ALSO the no-WebGL fallback
```
So `/vault` serves **3D unless the visitor explicitly asks for painted or has no WebGL**. Glenn
enjoying the painted art does not establish that he attempted the *lock* there. Test **3D first, then
painted** — and note the no-WebGL fallback is a third way he could have landed on painted without
choosing it.

🔴 **The two implementations share their CSS.** `.lock-dial` is defined **only** in
`src/components/FlatVault.astro:207`, inside a `<style is:global>` block (line 59). There is no
`.lock-dial` rule in `vault.astro`. **Editing that rule to fix one dial restyles the other.**
They are also two different *games*: the 3D version has a "contrary third tumbler" rule (`lock.dir2`)
that painted does not. Do not assume a shared fix.

#### C.2 — Suspects, re-ranked after an audit that actually simulated the maths

⚠️ **v1 WAS WRONG twice, and both errors would have cost you an hour. Do not chase these:**
- ~~"painted has no ±π wrap normalisation"~~ — **it does**, character-identical to the 3D version
  (`painted-vault.js:833` vs `vault3d.js:3164`).
- ~~"painted has no accumulator, so the dial never steps"~~ — **not updating `lastAngle` on
  sub-threshold moves IS the accumulator.** The reference angle stays anchored at pointerdown and
  `da` grows across events. Simulated over realistic drag traces, the painted dial **does** step
  correctly (a 60° arc → 6 steps; sub-9° jitter → 0 steps; forward-then-reverse returns to 0).

**The real candidates, in the order to check them:**

1. ⭐ **The painted lock has NO proximity readout — this is the leading candidate and it is a
   DESIGN gap, not a maths bug.** The 3D card has a live text band, `lockHeat`
   (`vault.astro:133`, `aria-live="polite"`, updated at `vault3d.js:3096`) showing
   *Cold / Warmer / Close / Right there. Hold still.* **The painted card has no equivalent.** Its
   only feedback is `playTick()` and a ≤3.6px `--shake` — and **every audio function begins
   `if (!audioReady || muted) return;`**. So on painted, with audio not yet unlocked or muted, turning
   the dial changes a number and produces **nothing else**: no way to tell which of 40 positions is
   right. That is indistinguishable from "the dial didn't respond." **Check whether audio was ever
   armed before judging the dial dead.**
2. **The 3D inertness path.** `lockStep()` begins `if (!lock.on) return;` (3100), and `tickLock()`
   does `if (lock.on && lockboxEl.hidden) { lock.on = false; return; }` (3146) — the back-button
   guard. **If the card is ever shown without `openLock()` having run, or that guard fires
   spuriously, the dial is visible and completely inert.** That is precisely the reported symptom, in
   the default implementation.
3. **A reopen bug in painted: `openLock()` never calls `clearTimeout(lock.holdT)`.** The only
   `clearTimeout` is inside `step()` (line 813). A pending 700 ms timer from a previous session can
   fire `fall()` against a fresh lock and drop a tumbler spuriously. ⚠️ v1 blamed `innerHTML`
   re-binding for this — that part is fine, `$('lockDial')` is re-queried after `innerHTML`.
4. **A wrap over-count in painted (`line 835`):**
   `lock.lastAngle += Math.sign(a - lock.lastAngle) * stepAngle` uses the **raw** difference, not the
   normalised `da`. Across the ±π boundary it walks `lastAngle` the wrong way — a simulated 360°
   sweep produced **73 steps instead of 40**. Real bug, but it causes *over-sensitivity*, not
   inertness. Fix it; don't expect it to be the answer.
5. **`setPointerCapture` without `try/catch`** in painted (830) where 3D wraps it (3161). Weak:
   `lock.dragging` and `lastAngle` are both set *before* it, so a throw only skips `preventDefault()`.

**Inputs available:** painted has exactly **two** — drag and arrow keys (`lockBack` is the only
button, line 840). ⚠️ v1 told you to try `lockUp`/`lockDown` buttons in painted; **they do not exist
there.** The 3D version does have them.

#### C.3 — How to actually reach the lock (you do NOT need any answer word)
🔴 **Both implementations ship debug hooks. This is the sanctioned way in, and it is the single
biggest time-saver in this brief.**
- Run it: `npm run dev` from `site/` (port **4321**; there is a `.claude/launch.json` entry named
  `puzzlesecret-site`). Scripts are only `dev` / `build` / `preview`. **There is no test harness** —
  `_qa/` is a voice-over audit, nothing automated.
- **3D:** `window.__vault` (`vault3d.js:3187`) exposes `openLock`, `lockStep`, `lock`, `awardTile`,
  `moveTo`, `tilesHeld`, and `forceDoor(n)` — annotated in the source as *"test-only client force
  (reveals no words)"*.
- **Painted:** `window.__painted` (`painted-vault.js:963`) exposes `enterRoom`, `openLock`,
  `openWordbox`, `startRound`, `awardTile`, `ROOMS`. Use
  `window.__painted.enterRoom('treasure')` then `window.__painted.openLock()`.
- Switch vaults with `?mode=painted` / `?flat=1`, or default for 3D.
🔴 **You never need, and must never obtain or type, an answer word. If you believe you need one,
stop and say so.**

#### C.4 — Bounds on the fix
- Fix the **cause**. Port the 3D version's hardening (`try/catch`, the `sign(da)` correction) into
  `painted-vault.js` **in place**. 🔴 **Do not create a shared module, do not restructure
  `openLock()`, do not restyle the painted vault, and do not touch `vault3d.js` unless the 3D dial
  also demonstrably fails.**
- If the leading candidate holds, **giving painted a proximity readout equivalent to `lockHeat` is
  the right fix** — it makes the game playable without audio. That is a real addition; describe it to
  Dan before shipping it.
- **Verify:** all three tumblers fall, chest opens, tile **III** awarded, `lock.solved` fires.
  Test **mouse drag, keyboard arrows, and touch emulation**. Test **twice in one session** (open →
  step back → reopen) — that is how you catch suspect 3.

---

### ⭐ TASK B — THE WORD BOX ADVERTISES A LENGTH (cause found, mechanical fix)
**Glenn, verbatim:** *"it was a little confusing that the answers are longer than 5 letters and
initially the website only listed five spaces until you started typing."*

**He is exactly right. One expression, duplicated in two files:**
- `site/src/scripts/vault3d.js:2196`
- `site/public/js/painted-vault.js:579`

```js
const shown = Math.min(WORD_LEN, Math.max(5, wbWord.length + 1));
```

`Math.max(5, …)` renders **five empty tiles before a single key is pressed**. Every real answer is
longer, so a solver who decoded *correctly* sees a field that contradicts their answer.

🔴 **The damning detail: `vault3d.js:2192` already reads
`const WORD_LEN = 12;  // the box no longer advertises any word's length`. The intent was already
right. Someone fixed the maximum and left the minimum.**

**The fix — change the floor to 1 in both files:**
```js
const shown = Math.min(WORD_LEN, Math.max(1, wbWord.length + 1));
```

**ONE acceptance criterion:** at zero characters the field must not imply any length, and it must
still read as an input waiting to be typed in. If a single 46px tile looks broken rather than
inviting, make that one tile read as a field (width, caret, placeholder) — 🔴 **but never by
returning to a fixed count.** If you are unsure which way to go, do the `Math.max(1, …)` change,
screenshot it, and ask Dan rather than redesigning.

⚠️ **This fix touches the two vault word boxes ONLY. `index.astro` is Task D and is Dan's decision.**

**Verify in the browser in both vaults** (see C.3 for how to open a word box without a word):
one box at rest, growing per keystroke, capped at 12, and the speak path (`speakBtn`) still fills it.

---

### TASK D — A DECISION FOR DAN, NOT A FIX (not required for "done")
`site/src/pages/index.astro:14` sets `const tiles = 6;` and the homepage renders **six fixed letter
boxes**. The first answer word is exactly six letters — so **the homepage silently tells every
visitor the exact length of the first word.** Same class of problem as Task B, on the highest-traffic
page, and Glenn did not even mention it.

⚠️ **Do not change this unilaterally.** Auto-submit depends on the fixed count
(`index.astro:877`: `if (tileEls.every((x) => x.value)) setTimeout(tryWord, 320)`), so this is a real
UX change, and the six-box row may be a deliberate "this is a word puzzle" affordance. **Raise it
with a recommendation; implement only if Dan says yes.** This task is **excluded from PART 5**.

---

## PART 3 — HARD RULES. VIOLATING ANY OF THESE IS WORSE THAN NOT FIXING THE BUG.

**On honesty and scope**
1. 🔴 **Never assert a fix you have not observed.** "Could not reproduce" is an acceptable and
   expected outcome here. If the lock does not fail across mouse, trackpad and touch emulation,
   **do not ship a speculative rewrite of a working interaction to production.** The safe, defensible
   move is to harden painted to match 3D and **report honestly what was and was not reproduced.**
   🔴 **Never let the word "fixed" reach anything Dan may forward to Glenn without a demonstrated,
   evidenced pass** — a reviewer told "it's fixed" who finds it broken is far worse than the bug.
2. 🔴 **Do not send any email, message or reply to anyone, ever.** Drafting for Dan's review is the
   maximum, and any draft goes through the `pitch-critic` subagent first.
3. 🔴 **Never tie vault rewards to reviews**, and never offer anything in exchange for coverage.
   Glenn is a gifted reviewer; FTC discipline applies to everything written to or about him.

**On secrets**
4. 🔴 **NEVER let an answer word reach the client bundle** — not as a string, a class name, or a
   variable name. After building, scan `dist/client` **and** `.vercel/output/static` for `CLEVER`,
   `SOLVERS`, `TRIUMPH`, `LANTERN` in **both cases** and at **Caesar ±3**. They live server-side as
   salted hashes in `src/pages/api/unlock.js` and stay there.
5. 🔴 **The library's game trigger is a "hooded lamp", NEVER a "lantern".** That word is the hidden
   21st secret. Keep it out of copy, comments and identifiers.
6. 🔴 **`site/.env` holds live production credentials** — `VAULT_SALT`, `SANCTUM_WEBHOOK`,
   `SANCTUM_AUTH`. **Never print them into chat, never commit them, never call the webhook by hand.**
7. 🔴 **`scripts/sudoku_v1_dataset.json` is SECRET.** Never expose it.
8. 🔴 **Do not disturb the guest-key map in `src/pages/api/unlock.js`** (the `MENSA` hash mapped to
   Act I). One key per outlet, never reused, never a book word — and **never mint one to let yourself
   in.**

**On not breaking production**
9. 🔴 **A local `astro dev` uses the REAL `.env`, so `POST /api/carve` writes real rows to the
   production Sanctum sheet** — the very sheet Task A is curating — and fires real Telegram lines.
   **Never exercise the carve flow locally.** Set **`TELEGRAM_DRYRUN=1`** for all local work.
10. 🔴 **Reward PDFs are EARNED.** They live in `site/rewards-src/` and are served only by
    `/api/reward?act=&t=` with a per-act token. **Never move one into `public/`** — that silently
    destroys the entire gating model.
11. 🔴 **If you add, rename or remove ANY telemetry event**, update **all three** copies —
    `src/lib/events.js`, `public/js/events.js`, and the inline copy in `src/scripts/vault3d.js` —
    run `node site/scripts/verify-events.js`, **and in the same commit** update
    `src/pages/privacy.astro` §2 and the matching FAQ answer in `src/pages/faq.astro`. The site is
    marketed as safe for kids; the policy must never lag the code. *(Tasks A–C should need no new
    event. If you think one is needed, say so first.)*
12. 🔴 **Images = Google Gemini ONLY. NEVER Higgsfield or any paid credit generator.** Task B's
    affordance is **CSS, not a generated asset**. A paid image MCP is mounted in this environment;
    do not touch it.
13. ⚠️ **`index.astro` and `vault.astro` do NOT use `Layout.astro`.** Anything site-wide must be
    added to those two pages explicitly.
14. ⚠️ **`/sudoku` is NOT a page** — it is a 301 to `/` in `vercel.json`. The vault entry is the
    **homepage**. Never link a reader to `/sudoku`.
15. ⚠️ **Never delete `site/public/google21dad53b26e04cbe.html`** (Search Console verification).
16. ⚠️ **The Astro dev server serves stale CSS.** Restart it after editing any `.astro` `<style>`
    block before judging what you see.
17. ⚠️ **Do not touch the book, the interior PDF, or the puzzle dataset.** Volume 1 is printed.

**On git**
18. ⚠️ `site/` is **its own git repository** on `main`, and **pushing to main deploys to
    production.** The parent, `R:\Documents\Claude\Projects\PuzzleSecret`, is a **separate repo** —
    the `LISTING-FIXES.md` edit in PART 5 needs **its own commit there**, or it will be left behind.
19. ⚠️ Ship only on an explicit ship-it phrase from Dan ("push", "ship it", "deploy", "update the
    site"). Then: stage the **specific** changed files (never `git add -A`), commit with a real
    message, push. **Never `--no-verify`, never force-push, and if a pull conflicts, STOP and ask.**
20. ⚠️ **`CLAUDE.md`'s warnings that `site/vercel.json` and `how-to-play-sudoku.astro` are
    "UNCOMMITTED" are STALE** — the `site/` tree is clean. Don't chase or defensively stage phantom
    work.

---

## PART 4 — QUESTIONS FOR DAN
1. **Task C:** if the painted lock's real problem is the missing proximity readout, may it be given
   one (matching the 3D `lockHeat` band)?
2. **Task B:** single growing tile, or should it read as one open field?
3. **Task D:** change the homepage's six fixed boxes, yes or no?
4. Does he want Glenn told the moment this is live? *(His draft promises exactly that for the lock —
   but see PART 3 rule 1: only after a demonstrated pass.)*

---

## PART 5 — DONE MEANS ALL OF THIS
1. **Task C:** reproduction attempted across **mouse, keyboard, and touch emulation, in both
   implementations**, and the result stated plainly — fixed, or **honestly not reproduced**. If
   fixed, **evidence**: a screenshot or console trace showing `lock.i` reaching 3, the chest opening,
   and tile III awarded. Tested **twice in one session**.
2. **Task B:** verified visually in **both** vaults, at zero characters and while typing.
3. **The wall is UNCHANGED and still shows `GD` alone** — confirm with
   `GET https://puzzlesecret.com/api/carve` that your testing added nothing. (Reads can be briefly
   inconsistent: `wallCache` is per-lambda and Vercel runs several.)
4. **The leak scan (PART 3 rule 4) run against a fresh build, and reported.**
5. **`marketing/promoter/LISTING-FIXES.md` updated** — flip the three `Status: NOT FIXED` lines to
   reflect reality and append the real root cause of the lock. 🔴 **Touch nothing else in
   `marketing/promoter/` — `PLAYBOOK`, `TRACKER`, `RUNLOG` and `OUTBOX` are an autonomous daily
   robot's brain.** Remember this is the **parent repo** and needs its own commit.
6. A short written summary of **what was actually wrong in each case**. Dan wants the real cause, not
   "fixed it".
7. Deploy only per PART 3 rule 19.

---

## PART 6 — EXPLICITLY NOT THIS TASK (logged so it is not lost)
Glenn's two **book** notes are **Volume 2 build-chain items, not website work.** Recorded in
`marketing/promoter/LISTING-FIXES.md`.

1. **The Keeper's first letter (page 8) undersells 180 puzzles** — it says the Keeper only cares
   about 20 of the 200, which *"immediately predisposes the solver to only look for those."*
   **Volume 1 is printed; Volume 2 copy change only.**
2. 🔴 **Puzzles 28 (key 3) and 61 (key 6) leak their keys.** The shaded cell sits in a column so
   dense with givens that *"I literally only had to place ONE digit before I confirmed the shaded
   box."* **Machine-enforceable, and nothing currently checks it** — `scripts/build_interior.py`
   asserts key cells are blank-in-puzzle and correct-in-solution, which is necessary but not
   sufficient. A future assert should require that a key cell's row/column/box demands real solving
   before it resolves. **Volume 2 generator work, in the parent repo.**
3. He asked for **more Keeper lore**, unprompted, having seen all of it.

# The Keeper's Story — scattered manuscript pages (Phase 1C)

Dan's parked idea, built 2026-07-28: **numbered manuscript pages scattered across all three
vaults.** Click one → it lifts up readable → the Keeper reads it aloud. The numbering forces
you to hunt every room and mentally re-order the story; the story deliberately **spans all
three vaults**, so finishing it means walking the whole crawl.

## Design rules
- **9 pages, 3 per vault** — Study (1,4,7) · Library (2,5,8) · Treasure (3,6,9).
  The numbers are deliberately **out of order per room**: to read the story in sequence you
  must move between rooms, which is the whole point.
- Pages are **not required** for any reward — pure optional lore. Nothing gates the PDFs.
- **NEVER contains a secret word** (CLEVER / SOLVERS / TRIUMPH / LANTERN) — captions ship in
  page source. The story hints at the *acrostic idea* without ever naming the word.
- Reading all 9 unlocks a **10th "final letter"** — the Keeper's sign-off, which teases
  Volume II (The Corsair's Chart) and points at the shop. That's the retention payoff.
- Progress persists in `localStorage` (`ps_story_v1`), so the hunt survives a reload.

## Voice
Generated locally with the locked recipe — Kokoro **`bm_george` @ 0.8×** via
`site/scripts/generate_vo_line.py`. Files: `site/public/audio/vo/vo_page1.wav` … `vo_page9.wav`,
plus `vo_pagefinal.wav`.

---

## The pages

**Page 1** — *Study*
> I was not always a keeper of vaults. I was a maker of puzzles, and a poor one, in a room
> exactly this size.

**Page 2** — *Library*
> My first hundred were rubbish. I burned them. My second hundred were worse, so I kept those
> — a man should remember what bad work looks like.

**Page 3** — *Treasure*
> The trouble with a good puzzle is that it ends. You solve it, you set it down, and the
> solving is gone forever. I wanted one that kept going.

**Page 4** — *Study*
> So I began hiding a second puzzle inside the first. A number here. A shaded square there.
> Nothing a solver would notice — until they noticed everything.

**Page 5** — *Library*
> They told me no one would look. They were right, mostly. But "mostly" is a wonderful word.
> It leaves a door open.

**Page 6** — *Treasure*
> I built this vault for the ones who look twice. Everything in it was locked by a puzzle, and
> every lock was made to be opened — eventually, by somebody stubborn.

**Page 7** — *Study*
> A confession: I hid one more thing than I ever announced. Not in the grids. In the letters.
> In the way a sentence begins.

**Page 8** — *Library*
> Read the openings. That is all the help I will give, and it is more than I gave anyone else.

**Page 9** — *Treasure*
> If you are reading this, you did not simply solve my book. You *searched* it. That is the
> rarer thing, and this vault knows the difference.

**Final letter** (unlocked after all 9)
> Nine pages, and you found every one. Most never look up from the grid.
> So here is the truth of it: the puzzles were never the secret. The *looking* was.
> Keep the habit — I have hidden another chart, another seam, another door. The Corsair's
> Chart is already being drawn, and it will not be kinder than this one.
> — The Keeper

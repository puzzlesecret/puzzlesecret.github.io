# The Keeper — Voice / Caption Script (v1 draft, 2026-07-20; voice LOCKED 2026-07-21)

The Keeper is the narrator of *Sudoku with a Secret*: deep, slow, gravelly, theatrical —
an old vault-keeper who is amused, testing, never cruel. **Every spoken line is also the
on-screen caption** (closed captions always on). **Voice is LOCKED: Kokoro TTS, "Michael"
(US male), 0.65× speed, natural pitch, with an inserted ~0.4s pause at sentence
boundaries** — see "Voice production notes" at the bottom of this file for the exact,
repeatable generation recipe. Every line below must be produced with that same recipe.

Accuracy note: the book is **200 puzzles**; a word is **hidden among them** (you don't solve
them all). The three words are **CLEVER / SOLVERS / TRIUMPH**; the hidden 4th is **LANTERN**
(never named on the site). Never say "doors" for the puzzles.

`[M1]` = needed for **Milestone 1** (the landing). Everything else is Phase 1–2.

---

## Scene 0 — Landing / Vault I door

- **Entry `[M1]`:** "Two hundred puzzles… and hidden among them, a single word.
  If you found my first, speak it now — the vault is listening."
  (Note: never hint the answer word itself — "clever" was removed from this line for that reason.)
- **Correct → Vault I opens:** "Clever. Yes… you are. Take what the first door guarded."

## Wrong word — cinematic fail (reused at every vault; rotate so it never repeats) `[M1 for vault I]`
1. "That is not the word I sealed it with."
2. "Close… or not close at all. I will never tell."
3. (third miss) "Stubborn. Good — but perhaps you need my hints." → gentle link to /hints

## Scene 0b — Antechamber (visitor without the book)
- "No word? Then earn a look."
- (after the free mini-puzzle) "There. A glimpse — no more. Two hundred puzzles, twenty
  hidden keys. Come back with my words."

## Vault I — The Clever Vault (reward)
- On entry: "Clever. Yes… you are. Take what the first door guarded."
- At the chest: "Fifty puzzles, yours — no word, no name, no price. The first door is open."

## Crack II → Vault II — The Solvers Vault (7 letters)
- At the door: "The fire took my second plate. But you read my letter anyway… didn't you?
  Say the word."
- Reward: "One hundred more. You are no ordinary solver."

## Crack III → Vault III — The Grand Vault (7 letters)
- At the door: "Step back three… and step inside."
- Finale: "Clever solvers triumph. The vault is yours… but a Keeper always keeps one
  secret more." ← the ONLY nudge toward the easter egg.

## The Lantern (hidden 4th vault — only after clicking the lantern)
- (screen dims to the flame) "What flickers at the start of every thought?"
- On LANTERN correct: "So. You heard the whole of it. Sit — let me tell you how this began…"
  (→ the Keeper's private epilogue letter, new lore, written at build.)

---

### 🔒 THE TRUE LOCKED VOICE (2026-07-22, fingerprint-verified — supersedes EVERYTHING below)

**Kokoro voice `bm_george` (British "George") at speed 0.8 — NOT "am_michael", NOT 0.65×.**
Acoustic fingerprinting of the Dan-approved `vo_scene0_entry.wav` against all 13 Kokoro male
voices: bm_george distance 0.54 (same-voice floor 3.97, 7× margin; pitch 141Hz vs ref 140Hz) —
am_michael scored 5.88, i.e. audibly a different man. The 2026-07-21 notes recorded the wrong
voice name AND the wrong speed. All 15 site lines regenerated as bm_george@0.8 on 2026-07-22
(lantern riddle at 0.68), every line verified within the same-voice floor (worst 2.75).
Generation: local Kokoro, `KPipeline(lang_code="a")`, `voice="bm_george"`, `speed=0.8`,
+0.35s sentence-boundary pause insertion. Cache-bust `?v=3`.

### ⚠️ (superseded) earlier speed correction 2026-07-22

**The TRUE locked speed is 0.8×, not 0.65×.** The Dan-approved `vo_scene0_entry.wav` measures
10.46s — exactly a raw speed=0.8 Kokoro render (a true 0.65× render of that line is 13.0s).
The "0.65×" in the notes below never actually shipped. Dan's ear confirmed it 2026-07-22: lines
generated at true 0.65× sounded wrong ("different voice"); regenerated at **0.8×** they match.
**Every future line: `am_michael`, `speed=0.8`, + ~0.35s inserted sentence-boundary pauses.**
(One deliberate exception: `vo_fourth.wav` — the lantern riddle — at 0.68× w/ pacing ellipses
for gravitas; all lines verified 83–99% articulation match vs the reference, mean 94%.)

### ✅ GENERATED 2026-07-22 (overnight vault-crawl build) — 12 new lines

All produced with the LOCAL Kokoro script (am_michael, **0.8×** per the correction above) +
automated sentence-boundary pause insertion. Live in
`site/public/audio/vo/` and wired into `/vault` (vault.astro `VO` map) + the landing's
`keeperAudioFiles`: `vo_vault1_entry`, `vo_vault1_reward`, `vo_vault2_door`, `vo_lib_entry`,
`vo_vault2_reward`, `vo_vault3_door`, `vo_v3_entry`, `vo_vault3_finale`, `vo_fourth`,
`vo_fail_1/2/3`.

**⚠️ SECURITY REWRITE (2026-07-22, supersedes the client-facing wording above):** captions ship
in page source, so **no spoken-on-site line may contain a secret word** (brief §2.2). The canon
lines above that contain CLEVER/SOLVERS/TRIUMPH stay book/lore-only; the site uses scrubbed
variants (recorded as such): Vault-I entry = "So… you found my first word. Take what the first
door guarded."; Vault-II reward = "One hundred more. My letter chose its reader well."; finale =
"Three words, three doors — and you spoke them all. The vault is yours… but a Keeper always
keeps one secret more." Also the lantern is referred to on-site only as "the fourth secret"
(never named — naming it would hand over the answer).

### Voice production notes

**LOCKED 2026-07-21 — every Keeper line ships with this exact voice/speed/cadence.**
Kokoro TTS (open-weight, Apache-2.0, 82M params), voice **"Michael" (am_michael)**, **0.65×**,
natural pitch, +~0.4s pause at sentence breaks. Not subject to the Gemini-only image/video rule.

**⭐ PRIMARY METHOD (2026-07-21): Kokoro is now installed LOCALLY on Dan's PC — no rate limit,
no website, works offline.** Use the helper script:
```
"C:\Users\danhe\AppData\Local\Programs\Python\Python312\python.exe" site\scripts\generate_vo_line.py "The line text." out.wav
```
- MUST use the **Python 3.12** interpreter above (Kokoro's numpy pin has no 3.13 wheel and
  fails to build on this machine; 3.12 has prebuilt wheels — installed & verified working).
- Defaults to `am_michael` at `speed=0.65`. First run downloads the model once, then offline.
- Then insert the sentence-boundary pause with the ffmpeg step in the recipe below (step 7).
- The website's first line is already done: `site/public/audio/vo/vo_scene0_entry.wav`.

**FALLBACK METHOD (only if the local install is unavailable):** the free public Hugging Face
Space — **`https://hexgrad-kokoro-tts.hf.space`** (no login/key/cost, but rate-limited after
~3 gens/session, and the whole service had a ~15-min global outage once on 2026-07-21). Steps
for that web path are kept below for reference.
- **Voice:** **Michael** (🇺🇸 male, in the "Voice" dropdown).
- **Speed:** **0.65×** (Kokoro's own Speed slider/number box, range 0.5–2.0, default 1.0).
- **Pitch:** untouched/natural (Dan explicitly picked the non-pitch-shifted take over a
  deeper/pitched variant that was also generated and offered).
- **Extra pause:** Kokoro's own punctuation-driven pacing (periods, ellipses) was not
  enough at sentence boundaries — Dan asked for noticeably more breathing room between
  sentences. Fix: insert a genuine ~0.4s silence gap at each sentence boundary as an
  audio-editing step (not a text/prompt trick) — see recipe below.
- Deliver each line as its own short audio file (so scenes trigger them independently);
  keep captions verbatim.

**Step-by-step recipe for every NEW line (repeat per line in this script):**
1. Open `https://hexgrad-kokoro-tts.hf.space` fresh (reload if reusing a tab that already
   generated a few times this session — see quota note below).
2. Paste the line's plain text into "Input Text" — **no bracket tags** (Kokoro is not the
   Gemini-TTS style engine; `[amused]`/`[slowly]` tags don't apply here). Punctuation
   (`…`, `,`, `—`, `.`) still drives natural micro-pacing, so keep it as written in this doc.
3. Voice dropdown → **Michael** (🇺🇸 🚹). *UI quirk:* this Gradio dropdown sometimes
   doesn't visibly react to a plain click. Reliable method: click the input to focus it,
   then dispatch a `pointerdown`+`mousedown` pair, then (separately) a
   `pointerup`+`mouseup`+`click` pair via JS (`document.querySelector('[aria-label="Voice"]')`),
   checking `aria-expanded` flips to `"true"` before picking the option the same way.
   Verify the selection actually stuck by re-reading the input's `.value` — don't trust a
   single click.
4. Speed number box → **0.65** (both the number input and the range slider must show 0.65;
   setting one should sync the other).
5. Click **Generate** (there are 2–3 DOM buttons named "Generate" — the real submit is the
   large one inside the "Output Audio" tab panel, not the small tab-switcher ones).
6. Wait ~8–15s. A new `gradio_api/file=.../audio.wav` URL appears — download it directly
   (plain HTTPS GET, e.g. via `curl`). **Quota note (confirmed 2026-07-21):** this Space
   runs on a shared free pool — in practice it allowed **~3 generations per session**
   before every further Generate click stopped producing any network request at all (no
   error shown — clicking Generate, even a real trusted click, simply does nothing).
   Tried and confirmed NOT to help: reloading the page, opening a brand-new browser tab,
   switching Hardware from "ZeroGPU 🚀" to "CPU 🐌". This points to a per-IP cooldown, not
   a per-tab/per-session one. **If generation stops responding: stop retrying and come
   back in a later session (the cooldown appears to be at least a couple hours; exact
   reset window unconfirmed).** Batch remaining lines a few at a time across sessions
   rather than trying to do them all at once.
7. **Insert the extra sentence-boundary pause** (ffmpeg, already installed and on PATH):
   ```bash
   # a) find the silence gap(s) in the downloaded line
   ffmpeg -i line.wav -af "silencedetect=noise=-30dB:d=0.15" -f null - 2>&1 | grep silence_

   # b) pick the boundary gap between sentences (the ~0.4-0.6s one right before the
   #    next sentence starts) — call its silence_end timestamp T

   # c) split, build a 0.4s silence clip, and re-join with the extra pause inserted
   ffmpeg -y -i line.wav -t T -c copy part1.wav
   ffmpeg -y -i line.wav -ss T -c copy part2.wav
   ffmpeg -y -f lavfi -i "anullsrc=r=24000:cl=mono" -t 0.4 -c:a pcm_s16le pause.wav
   printf "file 'part1.wav'\nfile 'pause.wav'\nfile 'part2.wav'\n" > list.txt
   ffmpeg -y -f concat -safe 0 -i list.txt -c copy line_final.wav
   ```
   Repeat step (c) once per sentence boundary if a line has more than two sentences.
   If a line is a single sentence with no internal boundary, skip this step entirely.
8. `line_final.wav` is the deliverable — rename to something identifying the scene/line
   (e.g. `vo_scene0_entry.wav`) and drop it wherever the site's audio assets live.

**If Kokoro's own Speed slider is available (no quota block), generate directly at 0.65×
in step 4 and skip any separate tempo-scaling** — the two-stage "generate at 0.8×, then
`ffmpeg atempo=0.8125` to reach 0.65×" approach from the 2026-07-21 session was only a
workaround for a quota-blocked re-generation, not part of the locked recipe itself.

**Rejected alternatives (for reference, don't redo this exploration):**
- Google AI Studio's Gemini TTS models (`gemini-3.1-flash-tts-preview`,
  `gemini-2.5-flash-preview-tts`) — technically excellent (30 voices with trait tags,
  bracket-style emotion tags), but **require a paid, billing-linked API key** even in the
  browser playground; Dan chose not to spend money here. Do not re-attempt without asking
  Dan first (see CLAUDE.md's user rule on flagging paid tools).
- ElevenLabs free tier — excluded, non-commercial license only.
- Kokoro voices tried and rejected before landing on Michael: Onyx (deep but not right),
  Fenrir (grittier texture, not right).

Ambient bed (separate from voice, still to build): low vault drone loop + a deep
BOOM/creak synced to each crack-open + a triumphant swell per vault. Royalty-free library
or generated.

# The key-tile games, inside the 3D vault (built 2026-09-03)

Dan found the passport promising two key-tiles that the default (3D) vault could not award:
both games lived only in the painted vault. Both now exist in the 3D vault too, redesigned
for a first-person room after three critic passes (game design, three.js/mobile engineering,
accessibility/compliance). The painted vault's games are unchanged; both write the same
`ps_tiles_v1` record that `/passport` and the certificate read.

## The Keeper's Round (Vault II, the library) → tile "5"
- Trigger: a **hooded lamp** on an iron stand just inside the library door, left. Label
  "A hooded lamp. Not for light." Closing the Vault II reward card teases it.
  ⚠️ Never call it a lantern anywhere visible: that word is the hidden 21st secret.
- Six unique targets on scraps of **red velvet** (the shelves are full of look-alike props,
  so the velvet is the tell and the Keeper says so): cipher discs and a cryptex on the left
  counter, a puzzle box and a cipher machine on the right counter, a chess set on a side
  table back-left, a brass sphere on a plinth back-right. Hover label: "…, on red velvet".
- Five are called per round: the first is always on a counter (an early success), 2–4
  alternate sides of the aisle, the fifth is a riddle (plain name after 15 s).
- Lights out = ambient 1.15→0.22, hemisphere 0.62→0.12, fog 0.052→0.10, aisle lamps,
  tome light and corridor torch to 0, emissive strips/gold/flames dimmed, all lerped in the
  frame loop (0.8 s in, 1.2 s out). A SpotLight + fill PointLight exist from build time at
  intensity 0 (adding a light later recompiles every material = a freeze on phones).
- The beam follows the mouse (lerped, clamped ±35° from view) or the view centre on touch,
  with a small reticle. Targets gleam faintly inside the beam; the one you are stuck on for
  15 s gleams harder. A wrong click gutters the beam for 1.5 s ("No. Look again."); three in
  a row and the Keeper names the side. Phone taps within 44 px of a target count.
- 75 s clock. At zero the Keeper relights one lamp at 40% and adds 30 s ("A little light.
  I am not cruel."); a second zero opens a card with Try again / Try again, no clock / Step
  back. Best time (no help, timed) in `ps_round3d_best`. Escape or the HUD "Step back" quits.
- On the fifth find the lights surge back and a "5" tile rises from the lamp to your hand,
  then the tile card. A held tile can be replayed for time (card kicker "THE KEEPER NODS").

## The Listening Lock (Vault III, the treasure room) → tile "7"
- Trigger: the small chest on the right pedestal, now with a hinged lid. Label "A small
  chest, locked. It is ticking." It ticks faintly within 2.6 m until solved. The Vault III
  reward card's close line teases it.
- Dial 0–39, three targets ≥7 apart. Ticks rise in volume and pitch as you near the number;
  the rim warms from iron to gold and the number glows; a text band says Cold / Warmer /
  Close / Right there. Hold still 0.7 s on the number and the tumbler falls. Drag, arrow
  buttons (48 px) or arrow keys; `navigator.vibrate` where supported.
- The third tumbler is **contrary**: it only falls when approached turning the opposite way
  from the second ("Dead. Try the other way" / "Come at it from the other side").
- Solved: the lid swings open, a glow and light inside, a "7" tile rises out, then the card.
  A held tile leaves the lid open on every visit.

## Shared
- Tile card: cream tile with the digit, the painted vault's lines, "A keepsake: it opens
  nothing, it proves you were here." Second tile adds "See my passport →". role=dialog,
  focus moves in and back, Escape closes.
- New overlays (`lockbox`, `tilecard`, `roundEnd`) are in the history guard's list and in
  `overlayOpen()`, so Back closes them and arrow keys do not yaw the camera.
- Debug hooks on `window.__vault`: round, startRound, roundHit, endRound, ROUND_DEFS, lock,
  openLock, lockStep, pbLid, awardTile, tilesHeld, darkAmt. Sim stepping: `__vault.step`.
- Copy rules kept: no win/prize/chance language ("The dark kept them that time"), no answer
  words, tiles described as keepsakes only.

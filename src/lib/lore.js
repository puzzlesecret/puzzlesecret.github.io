/* The Keeper's words, in one place.
   Imported by the 3D vault (src/scripts/vault3d.js) and by /the-keeper. The painted vault
   (public/js/painted-vault.js) is a plain file and keeps its own copies of the page texts in
   its VO table; if a line changes here, change it there too.
   Nothing in this file may name, hint at, or spell the fourth word. */

export const PAGE_WORDS = {
  1: 'I was not always a keeper of vaults. I was a maker of puzzles — and a poor one — in a room exactly this size.',
  2: 'My first hundred were rubbish. I burned them. My second hundred were worse, so I kept those — a man should remember what bad work looks like.',
  3: 'The trouble with a good puzzle is that it ends. You solve it, you set it down, and the solving is gone forever. I wanted one that kept going.',
  4: 'So I began hiding a second puzzle inside the first. A number here. A shaded square there. Nothing a solver would notice — until they noticed everything.',
  5: 'They told me no one would look. They were right, mostly. But “mostly” is a wonderful word. It leaves a door open.',
  6: 'I built this vault for the ones who look twice. Everything in it was locked by a puzzle, and every lock was made to be opened — eventually, by somebody stubborn.',
  7: 'A confession: I hid one more thing than I ever announced. Not in the grids. In the letters. In the way a sentence begins.',
  8: 'Read the openings. That is all the help I will give — and it is more than I gave anyone else.',
  9: 'If you are reading this, you did not simply solve my book. You searched it. That is the rarer thing, and this vault knows the difference.',
};

export const FINAL_LETTER =
  'Nine pages, and you found every one. Most never look up from the grid. So here is the truth of it: ' +
  'the puzzles were never the secret — the looking was. Keep the habit. I have hidden another chart, ' +
  'another seam, another door. The Corsair’s Chart is already being drawn, and it will not be kinder than this one. — The Keeper';

/* Which room each page lies in. Used by the vault's "found in this room" count only;
   the public Keeper page deliberately never says which room a page is in. */
export const PAGE_ROOMS = { 1: 'I', 4: 'I', 7: 'I', 2: 'II', 5: 'II', 8: 'II', 3: 'III', 6: 'III', 9: 'III' };

export const NUM_WORD = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];

/* The notebook on his desk: a cover and five leaves. HTML, rendered as-is in the vault's
   notebook card and on /the-keeper. */
export const NOTEBOOK = [
  '<h4>THE KEEPER’S NOTEBOOK</h4><p>Notes I kept while setting two hundred grids. Take what is useful; leave the rest for the next reader.</p><p>Turn the page.</p>',
  '<h4>I · SPOTTING A KEY</h4><p>Twenty of my grids carry one shaded square. It is never a given — it sits empty and waits for you to solve it honestly. The digit that lands in the shade is the key.</p><p>Copy it to the Vault Door Tally (page 210) before you forget. The plates that turn digits into letters are in the back of the book, pages 211 to 213.</p>',
  '<h4>II · SCANNING</h4><p>Pick a digit that already appears often. Run its rows and columns across the grid like beams of light. Where the beams leave exactly one dark cell in a box, that digit lives there.</p><p>It is the fastest way through my easy grids, and it still works on the hard ones.</p>',
  '<h4>III · THE LONELY CANDIDATE</h4><p>When a cell has only one digit left that could fit, write it and move on. When a digit has only one cell left in a row, a column or a box, it goes there — even if that cell could take others.</p><p>The first rule looks at a cell. The second looks at a digit. Learn to switch between them.</p>',
  '<h4>IV · PAIRS</h4><p>Two cells in the same unit that share the same two candidates own those two digits between them. Strike both digits from every other cell in that unit.</p><p>Pencil marks are not cheating. They are how I set the grids in the first place.</p>',
  '<h4>V · WHAT COMES NEXT</h4><img class="sketch" src="/teasers/v2.webp" alt="A pencil sketch of a sea chart" width="480" height="270" loading="lazy" /><p>The Corsair’s Chart. Volume II. Still being drawn, and it will not be kinder than this one.</p><p>When it is finished, it will be where the first one was.</p>',
];

/* What he says when you touch his things in the study. Keyed by the study found-set ids
   (see STUDY_ITEMS in vault3d.js); only the objects that have a spoken line. */
export const OVERHEARD = {
  quill:  { thing: 'the quill and ink',   line: 'Every puzzle I ever set began with that nib. Most of them ended in the fire.' },
  board:  { thing: 'the pinboard',        line: 'Two hundred grids, pinned and re-pinned. Twenty were never quite what they seemed.' },
  shelf:  { thing: 'the shelves',         line: 'Books I solved, and books I never will. A keeper collects both.' },
  sconce: { thing: 'the wall sconce',     line: 'That sconce has burned since before I came. I never asked what feeds it.' },
  chart:  { thing: 'the covered easel',   line: 'Under the cloth, a chart still being drawn — The Corsair’s Chart. Volume II. It will not be kinder than this one.' },
  notebook: { thing: 'his notebook',      line: 'My notebook. Read it, and the rest of my book will go easier.' },
};

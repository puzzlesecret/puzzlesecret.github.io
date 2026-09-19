// Build-time move list for the guided first puzzle on /how-to-play-sudoku and the
// printable sheet. Uses only the two beginner moves ("only one place this number can go"
// and "last gap"), and throws if the puzzle ever needs more — so the page can never
// teach a move it has not explained. Every reason names EVERY blocker, so the sentence
// is true on the grid the reader is looking at.

const BOX_NAMES = ['top-left', 'top-middle', 'top-right', 'middle-left', 'centre', 'middle-right', 'bottom-left', 'bottom-middle', 'bottom-right'];
const rowOf = (i) => Math.floor(i / 9);
const colOf = (i) => i % 9;
const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

const UNITS = [];
for (let n = 0; n < 9; n++) {
  UNITS.push({ t: 'box', n, cells: [...Array(81).keys()].filter((i) => boxOf(i) === n) });
  UNITS.push({ t: 'row', n, cells: [...Array(81).keys()].filter((i) => rowOf(i) === n) });
  UNITS.push({ t: 'col', n, cells: [...Array(81).keys()].filter((i) => colOf(i) === n) });
}
const unitName = (u) => (u.t === 'box' ? `the ${BOX_NAMES[u.n]} box` : u.t === 'row' ? `row ${u.n + 1}` : `column ${u.n + 1}`);
const where = (i) => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;
const an = (d) => (d === 8 ? 'an 8' : 'a ' + d);
const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

function findIn(g, cells, d) { return cells.find((c) => g[c] === d); }

export function buildMoves(givens, solution) {
  const g = givens.split('').map(Number);
  const moves = [];
  const empties = (u) => u.cells.filter((c) => g[c] === 0);

  while (g.includes(0)) {
    let mv = null;

    // 1. Last gap: a box, row or column with eight numbers in it.
    for (const u of UNITS) {
      const e = empties(u);
      if (e.length !== 1) continue;
      const d = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => !u.cells.some((c) => g[c] === x));
      mv = {
        kind: 'last', cell: e[0], digit: d, unit: u.cells, blockers: [],
        ask: `${unitName(u)[0].toUpperCase() + unitName(u).slice(1)} has eight numbers and one gap. Which number is missing?`,
        reason: `${unitName(u)[0].toUpperCase() + unitName(u).slice(1)} already holds every number except ${d}, and it has one empty square left (${where(e[0])}). So that square is ${d}.`,
      };
      break;
    }

    // 2. Only one place: boxes first (fullest box first), then rows, then columns.
    if (!mv) {
      const order = ['box', 'row', 'col'];
      const sorted = [...UNITS].sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t) || empties(a).length - empties(b).length);
      outer: for (const u of sorted) {
        const e = empties(u);
        for (let d = 1; d <= 9; d++) {
          if (u.cells.some((c) => g[c] === d)) continue;
          const blockers = []; const because = new Set(); const open = [];
          for (const c of e) {
            const lines = u.t === 'box'
              ? [['row', rowOf(c)], ['col', colOf(c)]]
              : u.t === 'row' ? [['col', colOf(c)], ['box', boxOf(c)]] : [['row', rowOf(c)], ['box', boxOf(c)]];
            let hit = null;
            for (const [t, n] of lines) {
              const other = UNITS.find((x) => x.t === t && x.n === n);
              const b = findIn(g, other.cells, d);
              if (b !== undefined) { hit = { b, name: unitName(other) }; break; }
            }
            if (hit) { if (!blockers.includes(hit.b)) blockers.push(hit.b); because.add(hit.name); } else open.push(c);
          }
          if (open.length === 1) {
            const names = [...because];
            mv = {
              kind: 'only', cell: open[0], digit: d, unit: u.cells, blockers,
              ask: `Where can the ${d} go in ${unitName(u)}?`,
              reason: names.length
                ? `Where can the ${d} go in ${unitName(u)}? There is already ${an(d)} in ${list(names)}, so those squares are out. Only one empty square is left: ${where(open[0])}. That square is ${d}.`
                : `Where can the ${d} go in ${unitName(u)}? Only one square is empty there that it could use: ${where(open[0])}. That square is ${d}.`,
            };
            break outer;
          }
        }
      }
    }

    if (!mv) throw new Error('guided-solve: puzzle needs a move this page does not teach');
    if (String(mv.digit) !== solution[mv.cell]) throw new Error('guided-solve: wrong digit at ' + mv.cell);
    g[mv.cell] = mv.digit;
    moves.push(mv);
  }
  return moves;
}

export { BOX_NAMES, rowOf, colOf, boxOf };

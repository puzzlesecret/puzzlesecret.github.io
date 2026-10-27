// Secret word-check — SERVER ONLY. The answer words never appear here in
// plaintext (only salted SHA-256 hashes) and never reach the client bundle.
// Client POSTs { word }; we normalize, hash, and look it up. Rate-limited.
export const prerender = false;

import crypto from 'node:crypto';
import { notify, solverTag, place, isBot } from '../../lib/keeper-telegram.js';

// Spoken words are the one place a stranger's typed letters reach Telegram (bare A-Z,
// 4-12 long; a true word only ever echoes one of the hashed words below). A human at a door misses a handful of times; a script at the 25-per-10s
// limit could push ~150 chosen words a minute into the chat. So: the first 8 misses per
// IP in any 10 minutes are relayed, the 9th says the Keeper is going quiet, the rest are
// silent. Unlocks are never muted.
const misses = new Map();
const MISS_WINDOW = 10 * 60 * 1000, MISS_MAX = 8;
function missCount(ip) {
  const now = Date.now();
  const b = misses.get(ip) || { n: 0, t: now };
  if (now - b.t > MISS_WINDOW) { b.n = 0; b.t = now; }
  b.n += 1;
  misses.set(ip, b);
  if (misses.size > 5000) { const k = misses.keys().next(); if (!k.done) misses.delete(k.value); }
  return b.n;
}
import { rewardUrl } from './reward.js';

// Salt lives ONLY in the VAULT_SALT env var (site/.env locally — gitignored;
// a Vercel env var in production). It must NEVER be committed: without it the
// hashes below are uncrackable, which is what makes this file safe to publish.
const SALT = import.meta.env.VAULT_SALT ?? process.env.VAULT_SALT; // .env in dev / Vercel env var in prod

// hash( SALT | NORMALIZED_WORD ) -> reward metadata. No plaintext answers here.
const HASHES = {
  '54cd85880c16e9fdd2e794428ab8cca5e9b9db0dba570914772289495d2fcbee': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10 },
  '09ebb42c1c790c0df466c2594ed1f9412746e5fd1183f047bf5509bf77042376': { act: 'II', reward: '100 bonus Medium puzzles', tier: 'medium', discount: 20 },
  '14931225a6efb6f746b42dd5dc7d068af053a88cd3bcec24c7d21827e558f72a': { act: 'III', reward: '200 bonus Hard puzzles', tier: 'hard', discount: 30 },
  '7009db01f308f2c18da9b71bfcda568213d322a136fd95b8e5a9da5d2b8c5abe': { act: 'IV', reward: "the Keeper's private epilogue", tier: 'unlit', discount: 0, hidden: true },

  // ── GUEST KEYS ───────────────────────────────────────────────────────────
  // A guest key opens Vault I for readers of an outlet that printed one of our
  // puzzles. It is NOT one of the book's four words and never will be: printing
  // a real answer word would let anyone skip an act of the book, and that secret
  // is the one thing a buyer cannot get anywhere else. A guest gets the same
  // vault and the same gift — vault access costs us nothing and a delighted
  // stranger is a warmer prospect than one who never saw the door.
  // `guest` is a label only; it changes the Keeper's Telegram line so Dan can
  // tell WHICH placement sent someone. That is the only attribution this
  // program has. Add one line per outlet; never reuse a key across two.
  '179d3b60d2b445d5ef073dfea5ddc3b401fce6779eceed81a11912de85ce03db': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Magazin Mensa (CZ)' },
  // PinPoint Magazine (UK) — the first GUEST ROOM: the same study, but the story in it is theirs.
  // `room` names a server-side profile below; the client never sees a room it was not handed.
  // Option 1 (letters in order) was retired 2026-09-25: Andy was sent only the scrambled option,
  // and the old word must not let anyone skip the puzzle.
  'cc3add48447d981efee6152fa44a730b97e557880f814e62b9562ac8793f8e52': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'PinPoint (UK), option 2', room: 'pinpoint' },
  // The Aperiodical (UK maths blog) — sample puzzle sent to Katie Steckles 2026-10-08 for a
  // possible article on how the book is built. Plain Vault I, no guest room.
  'c0dadca8c0620466f15274857520fbd3ad3bc7ecb2a584cb3c7d32ac82be118c': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'The Aperiodical (UK)' },
  // Geeks of Doom (US) — sample puzzle for Eve Conte, who asked to see one (2026-10-14). Plain Vault I.
  '1553ce78b5422c4070f0655c9eb82670517afe872eeeec2c379da6ba646ee896': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Geeks of Doom' },
  // PRESS POOL (2026-10-15): one key per outreach email's sample puzzle, each used by exactly ONE outlet.
  // The outlet each number went to is recorded in marketing/guest-puzzles/pool/POOL.md (not in this repo).
  'a93e621de118e1a559776a1ebed267b0abba5123eadc14a0f20e4677319bae9b': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 01' },
  '897672aadfe12f03d80a423ab7ee88ec56e78f7c026c6f7c66268c0843388ad4': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 02' },
  'ec3b0e46773e82e5391c693e98f1105bb7c95319d6dfce15ee677a853b69fecf': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 03' },
  'dac521b29481fb1d7652a48a493575bb58a737108a46672b0409f2208c57e30d': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 04' },
  '8493a3cee36d891be73c0579e276ab68203b92bcd2ec84e9b18e93402fa802d6': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 05' },
  '7b457dba2a7f6592260de853130d786e7a34e37e85347e651f108294ecc5f68a': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 06' },
  'd053193033695ec31bfdb2b92439caa6a11833e14174ca5a688e95e2e6180083': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 07' },
  'bd3fe34485a62ca2c0ecdaa4a8fb24a30e2a59590105a40b949d153eb52089cf': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 08' },
  '05a268a28595b5cd728cc2badb77d681b9ba7f45e9358575d11441b3facef313': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 09' },
  '6ce8dfa83e2e6ddfa8d024bfb744d528a1f3c1d0af29132e7c2fd4d035a83a60': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 10' },
  '40b33cd1184be00744e8fa8097cf1b0253b3207c2899649f1f360da5a4534aa8': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 11' },
  'c23fa99b0ba18462274f6dc0e45be9c35bdd25ff5abeb15c1369c5ff2e7b8e48': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 12' },
  'fa1768d45eed1d1147c7ef20a15aab867ac3119a978449987f27127c60d3e82d': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 13' },
  '8661fe15e06b4e8a4ba38455447adb5cc96eb9cd7317d897e8ac6bc8eae94a7f': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 14' },
  'c49eb6ca6fc7dd9d0de6dce1d758cb3294b12d00fd508b4295790123931ad665': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 15' },
  '3d4dccae2cb42b7c7ddf96dce873eb146165ea5656862f405102e58007935bb0': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 16' },
  '996e0b187209ec507d6ecfe5f1eb057eb00c5b373d9ace6eb5dd5c27ec0eec30': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 17' },
  'dcf2dd523635f6cb3f023ec8015481ff71f0b93481a4342e704ad10a8290d3e5': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 18' },
  '81205b12ed5e833eb7b5ab10854ba1f7a9cc1c5943e0a8ae5151238def8422cc': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 10, guest: 'Press pool 19' },
  // PINTEREST WEEKS (Dan, 2026-10-27): one word per ISO week, printed on every daily Pinterest sudoku as six numbered
  // gold squares + that puzzle's own decoder. PUBLIC BY DESIGN and never expiring (a saved pin resurfaces months later),
  // so discount 0. Built by scripts/daily_keys/ (fit_keys.py, Verifier D = verify_keys.py --require-live); the words
  // live only in scripts/daily_keys/weeks.json. Plan: marketing/pinterest/VAULT-KEY-PINS-PLAN.md.
  'e0358f9603f31500c4a760aec75177db3da63dd73b01c566557e0969364008fb': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W44' },
  '91f508de39f721d5692d1c1c7966e2eb820b326c77a68b4583768dc7ca1f7054': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W45' },
  'f33d30d93926d92b8efef3780217ff709b771fe7ee7d4d08e8c992fe258b26d4': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W46' },
  '8139076df89cd6ed2b868fd90f67ab4765269dbe620c3ededb01ef35f7acafb7': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W47' },
  '8ae12929f96cdd34a359905144e0e9389de7726755b4796665770b0e96ea7c30': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W48' },
  '9aeaca351f11f44ed7499b00e3f65890a18750d6021a3961f5f0c6f711a3dad1': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W49' },
  'a46468257cf64a5b4dfbde5a7752191d539ea788b41bac1c8883ae51bcc9f0fa': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W50' },
  '10a73a745bbfbd7818ef643993e196de6e384c1f34836ef12ae16dea63ed4657': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W51' },
  '82ee6291bf922d9fa1ba4ac92c91778cd440e8fba3bb0c73ce535ce8ebd9e54a': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W52' },
  '3c1a9a4ef572b38a487bd6f1c3ca3635cbf14a17bdfc4c2ac8661944c8a2edb6': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2026-W53' },
  '8c12dc26be589691b096f69fcffab2d3cf81cd8599f91569d647bfba2a22ab61': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W01' },
  '7d97d02fa771add8c4da08ce31084ed73b4c60bedd945c414d85c35d1760c6d8': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W02' },
  '9b64b80b5210279803ffbed2eb0e22fcd6b4cf085f8573261afb0ed1e40063f4': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W03' },
  'cb084379bbf9754fbcdef3a5de5f9114bae8c0c7d08921b100a045b11ed18794': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W04' },
  '2380ae16be311eb57a51e58ec3e4c5d2c9ee23c9dd22cc8cb27109e8a9b26b47': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W05' },
  '4248bd11177d9d9f2e94e07c8e3fcdd0b4bb4e06862fbbe701fd8dfe48499efb': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W06' },
  'b658f6f71a2af6a14e2fdb625e52ce3ea3ff1ed223c69128c031916639877c55': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W07' },
  'a42f3f01157d24b54e73763888d45c91def829ff14d096d860cd350fbe0dbffb': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W08' },
  '50273be0495e6e42bc06c59358d40abf781c69bcf9e4714f8ab316bced68f2fa': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W09' },
  'd82c775fc9fb7b6f9650cd6e698a96b7d3ae3b3a9d9e37c2ec17cd4949aa5c73': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W10' },
  'c7a95abf2e19f5007d84c5452f1c45c77ccb106441c12a1093c0642d68b36f12': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W11' },
  'ccb3933021013ed622aa65c16ba49bc96475b519b4604e772cb386e49d419fb2': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W12' },
  '24caa5288a84ccd31e7d77e07c4cf9f9f5ab271798d444d1276f97826a4cea03': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W13' },
  'e10913be2e6ce86c6cf655bf10fc7d8dfc1ef0e7ce7c8c0e8f00e5e3f4d0ee11': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W14' },
  'ce7d1cb76bcce3f9b6c6d423dce1e9793fffc43e584146ed476693c0e2cd80d5': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W15' },
  'e81a401193a0d7b1ac24c5dc4a0bcfa70525ff60ce4ae3448c13959d22f59c0f': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W16' },
  '005b3c9ff6d7323e119d1457f3c5600b4788baa22a77334cecc57396e1df13df': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W17' },
  '6eae65b879157fe1455523b6b70d7bc90721835fe42eea73b22c08db98268d45': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W18' },
  '4645b6c4e9dac4837e4038cd1bc81df109efabb5b2d2ad92b309c649985ffa91': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W19' },
  '4f71fcd17fbd532bac5b0b1c767a1151919dd57735d9ace237792b04e1261bd8': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W20' },
  'df2d8aa9a89a7d0fc67c8e167fbf6dfcff600c4d00dd9e646fff56e1904ecd84': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W21' },
  'dc89ccce07b08bbcf3398ee6e6ff4780cd8952ca4c077b0ac8cf91a9ed59eefd': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W22' },
  'e5ed9c9af011558b09f372d4fa3a5dd7ccb69a3ca2c2d359b63b8f96c1796ef4': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W23' },
  'f2d446c66e324c70b3ca880c8726987f3a33aa81ea6add63751ab6fd8acd7035': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W24' },
  'e844fae538a49e6caf32eb66af588da37dd447f158e265a06ef10c9fed4337f8': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W25' },
  'f3cce5222245b375aabb8b16e2e294e17c9cc4b398d7eb73dee27395637a9825': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W26' },
  '588f8b991b03dec0adeebeff7ca2a95756f5887faef57c45cad5d7639d4091f3': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W27' },
  '85c9e852e7af860d9ff5cc017fbbed5d13956ee2e0d880b08f60bae064b8c94f': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W28' },
  '5b68890cde788782ada754c57b2b528fa26afbe0130e12dd0d8c3a37cf392df7': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W29' },
  '1dd20bb0183af01de227408caa29b59aa35461db71fabaf1bb99328e09c6e690': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W30' },
  'efc03738731b94df20b906fa321bd6156b0bd1f453c0dd6836c4f2f741b47929': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W31' },
  '728ae6ed6ab777bb6579ac8209cfb90fa4c5effae02c220b107721ad74735f6e': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W32' },
  'a69c5fbfbf7debd24cc2c486a1831a917cf8f3bdf2edf40565be831440c585af': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W33' },
  '482449d0f7863a0e15314f32e7a78b8f181165b4e9ea79cfdc0b73d57931d6df': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W34' },
  '78039af7ebaa73c277f7e74340f35c93c81a365569065b627982ed615cd3472e': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W35' },
  'cdc98d311e19d6779b882927a1d36a3215b8d847761ee6785d2b54703a41a25d': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W36' },
  '6b08604afb68700c3a922151b16bbe8dc4db1e55d504db415e27b3045707af06': { act: 'I', reward: '50 bonus Easy puzzles', tier: 'easy', discount: 0, guest: 'Pinterest 2027-W37' },
};

// ── GUEST ROOMS ──────────────────────────────────────────────────────────
// A guest room is the book's Vault I with a different story in it, built ONLY when the
// unlock response carries `room`. The Keeper's guest lines live here so the 3D and the
// painted vault render the same words and neither bundle needs to know an outlet by name.
// The four position fragments are NOT in this file: this repo is public, so they live in
// an env var (GUEST_ROOM_PINPOINT="N 52° 40.|N …123|W 002° 27.|W …456"), read at request
// time and handed out only on the matching hash — the same rail the Sanctum lines ride.
// A missing or empty var means the place is no longer kept: the room still opens, the
// scraps do not, and the Keeper says so. Never a placeholder that could be mistaken for real.
const GUEST_ROOMS = {
  pinpoint: {
    id: 'pinpoint',
    entry: 'PinPoint sent you, and you are exactly where I meant you to be. I tore a note into four and dropped the pieces on the floor of this study. Find all four and the board on the back wall gives you the cache. Nothing else in here is part of it.',
    scrapLabel: 'A crumpled scrap',
    scrapLine: 'A piece of the note I tore. It pins itself to the board for you: nothing to carry.',
    allFound: 'All four pieces, pinned. Read the final co-ordinates off the board on the back wall, and mind the muggles on your way out.',
    retired: 'PinPoint asked me to keep a place here once. It is no longer kept. The study is still yours to look around.',
    boardEmpty: 'Four empty pins. Every piece you find on the floor is pinned here for you.',
    exit: 'You are leaving with {n} of my four pieces unfound. The corridor will keep; the note will not.',
    door2Kicker: 'THE SECOND DOOR — NOT PART OF THE CACHE',
    door2Line: "This door is not part of PinPoint's cache: every piece of the note is in the study behind you.",
    door2LinkText: "Back to PinPoint's door →",
    door2LinkHref: '/pinpoint',
    // where the room's own exits lead: PinPoint's standalone door, not the book's homepage (2026-10-13,
    // after Groundspeak ruled the homepage commercial — the cache page links /pinpoint)
    home: '/pinpoint',
    env: 'GUEST_ROOM_PINPOINT',
  },
};
// Env vars are read by NAME so Vite can substitute them statically; a dynamic key would be undefined.
const GUEST_ENV = { pinpoint: () => import.meta.env.GUEST_ROOM_PINPOINT ?? process.env.GUEST_ROOM_PINPOINT };
function guestRoom(id) {
  const g = GUEST_ROOMS[id]; if (!g) return undefined;
  const raw = String((GUEST_ENV[id] && GUEST_ENV[id]()) ?? '').trim();
  const frags = raw ? raw.split('|').map((s) => s.trim()).filter(Boolean) : [];
  const { env, ...pub } = g;                             // never ship the var name
  return { ...pub, frags: frags.length === 4 ? frags : [] };
}

// An opaque, unguessable proof that SOMEONE solved the fourth word. Returned only on that
// The seven framed lines in the Sanctum. They leave the server only on a true fourth word,
// so the client bundles never carry the gilded capitals in order.
const LETTERS = [
  'Long before this vault was ever sealed,',
  'A puzzle, I always believed, should not end.',
  'Never did I make an easy thing look hard.',
  'Those who look twice will always find more.',
  'Every shaded square was a choice, not chance.',
  'Remember this: the looking was the secret.',
  'Now you hold what almost no one ever will.',
];
// success, stored by the client, and accepted by /api/carve instead of re-typing the word.
// It reveals nothing (a hash of the salt) and never appears for a non-solver.
const CARVE_TOKEN = SALT ? crypto.createHash('sha256').update(SALT + '|carve-proof-v1').digest('hex') : '';
const norm = (w) => String(w || '').toUpperCase().replace(/[^A-Z]/g, '');
const AT = { door: ' · at the front door', '3d': ' · at the 3D word box', painted: ' · at the painted word box', pinpoint: ' · at the PinPoint door', daily: ' · at a daily puzzle page' };
const hash = (w) => crypto.createHash('sha256').update(SALT + '|' + w).digest('hex');

// Tiny per-IP token bucket (generous for humans, hostile to wordlist scripts).
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 10000) { b.n = 0; b.t = now; } // reset window every 10s
  b.n += 1;
  buckets.set(ip, b);
  return b.n > 25; // >25 guesses / 10s from one IP = throttled
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Which kind of guest a word makes its speaker, so the vault can show a guest (and only a guest) where the book holds
// the other words. 'pinterest' = a Pinterest week key; 'outlet' = any other guest key. A book word returns nothing.
const guestKind = (hit) => (hit.guest ? (String(hit.guest).startsWith('Pinterest ') ? 'pinterest' : 'outlet') : undefined);

export async function POST({ request, clientAddress }) {
  if (!SALT) return json({ ok: false, error: 'vault_offline' }, 503); // env var missing
  let word = '', body = null;
  try { body = await request.json(); word = body.word; } catch { /* ignore */ }
  const w = norm(word);
  const ip = clientAddress || 'unknown';

  if (rateLimited(ip)) return json({ ok: false, error: 'slow_down' }, 429);
  if (w.length < 4 || w.length > 12) return json({ ok: false });

  const hit = HASHES[hash(w)];
  const tag = solverTag(body && body.vid);
  const geo = place(request);
  // Where the word was spoken \u2014 the front door (homepage), the 3D word box, or the painted
  // one. A fixed enum from the client; anything else is dropped, never echoed.
  const atKey = String(body && body.at || '');
  const at = Object.hasOwn(AT, atKey) ? AT[atKey] : '';   // hasOwn: "constructor" / "__proto__" must not resolve
  if (hit) {
    // The word that opened it, as typed and reduced to bare A-Z (the same shape a miss is
    // relayed in). An act can be opened by more than one word (the book's, or any guest key),
    // so Dan sees exactly which one was spoken. Echoed from the request, never from this file.
    const said = `\u201c${w}\u201d`;
    const line = hit.guest
      ? `\u{1F4F0} ${tag} \u00b7 ${geo} \u00b7 GUEST KEY ${said} \u2014 came in from ${hit.guest}${at}`
      : hit.act === 'IV'
        ? `\u{1F56F} ${tag} \u00b7 ${geo} \u00b7 found the FOURTH word ${said} \u2014 the floor opens${at}`
        : `\u{1F513} ${tag} \u00b7 ${geo} \u00b7 opened Vault ${hit.act} with ${said}${at}`;
    await notify(line);
    return json({ ok: true, act: hit.act, reward: hit.reward, tier: hit.tier, discount: hit.discount, hidden: !!hit.hidden, rewardUrl: rewardUrl(hit.act, body && body.vid), carveToken: hit.act === 'IV' ? CARVE_TOKEN : undefined, lines: hit.act === 'IV' ? LETTERS : undefined, room: hit.room ? guestRoom(hit.room) : undefined, guest: guestKind(hit) });
  }
  if (!isBot(request)) {
    const n = missCount(ip);
    if (n <= MISS_MAX) await notify(`\u274C ${tag} \u00b7 ${geo} \u00b7 guessed \u201c${w}\u201d${at}`);
    else if (n === MISS_MAX + 1) await notify(`\u{1F910} ${tag} \u00b7 ${geo} \u00b7 ${MISS_MAX} misses in ten minutes \u2014 the Keeper stops repeating them for a while`);
  }
  return json({ ok: false });
}

// A GET is handy for a health check; never reveals anything.
// `pool` = how many press-pack guest keys are live, so the outreach robot can confirm a deploy without typing a word.
const POOL_LIVE = Object.values(HASHES).filter((h) => String(h.guest || '').startsWith('Press pool')).length;
// `pinterest` = the week labels whose words are live (labels are not secret), so the daily pin robot can confirm the exact
// week is deployed before it posts that week's pins, without typing a word.
const PINTEREST_LIVE = Object.values(HASHES).map((h) => String(h.guest || '')).filter((g) => g.startsWith('Pinterest ')).map((g) => g.slice(10)).sort();
export const GET = () => json({ ok: true, service: 'unlock', ready: true, pool: POOL_LIVE, pinterest: PINTEREST_LIVE });

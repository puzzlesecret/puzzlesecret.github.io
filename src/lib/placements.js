// THE PLACEMENT REGISTRY — every outlet that has been handed a link to puzzlesecret.com, or has
// published about the book. The Keeper uses it two ways:
//   1. NAMING. A visitor whose referrer is one of these hosts (or whose link carries one of these
//      utm tags) is reported by the outlet's `id` — a fixed word, never the hostname. The browser
//      mirror of `hosts` lives in public/js/events.js (PLACEMENT_HOSTS); scripts/verify-events.js
//      fails if the two drift.
//   2. GUESSING. src/lib/traffic-guess.js matches visitors whose link hid itself against outlets that
//      have actually PUBLISHED (`landed`), by country (`audience`) and date.
//
// Keep it in step with marketing/promoter/PLACEMENTS.md: when a placement lands, set `landed`
// (YYYY-MM-DD) and `audience` (ISO country codes whose readers it plausibly reaches).
//   · `linksSite`    — the piece has a clickable link to puzzlesecret.com.
//   · `mentionsSite` — the piece names the site in words, so a reader may TYPE it (no link needed).
//
// `id` must be [a-z]{3,20} — it travels in the arrive extra and is held to a grammar there.
// `short` is ours, printed in Telegram: it must never look like a web address (Telegram would make
// "Example.com" tappable). scripts/verify-events.js enforces both.
// A helper for outlets that have only been PITCHED: nothing published, nothing known about how they
// would link. They are listed so that if one ever links to us — even without telling anyone — the
// Keeper names it instead of saying "another site". Source: marketing/promoter/TRACKER.md, 2026-09-28
// (every row actually contacted; declined, bounced and never-pitched rows are left out).
const pitched = (id, short, hosts, audience = ['US']) => ({ id, short, hosts, utm: [id], landed: '', linksSite: true, mentionsSite: false, audience });

export const PLACEMENTS = Object.freeze([
  // ── Published ──
  { id: 'miowandmolly',       short: "Miow and Molly's gift guide",  hosts: ['miowandmolly.com'],            utm: ['miowandmolly'],                              landed: '2026-09-28', linksSite: true,  mentionsSite: false, audience: ['GB', 'IE', 'AU', 'NZ'] },
  { id: 'mysteriouswritings', short: 'Mysterious Writings',          hosts: ['mysteriouswritings.com'],      utm: ['mysteriouswritings'],                        landed: '2026-09-25', linksSite: false, mentionsSite: false, audience: ['US', 'CA'] },
  { id: 'wordsandpeace',      short: 'Words and Peace',              hosts: ['wordsandpeace.com'],           utm: ['wordsandpeace'],                             landed: '2026-09-13', linksSite: false, mentionsSite: false, audience: ['US', 'FR'] },
  // ── Said yes / in conversation, not published yet ──
  { id: 'sarcasticallyyours', short: 'Sarcastically Yours, Jen',     hosts: ['sarcasticallyyoursjen.com'],   utm: ['sarcasticallyyoursjen', 'sarcasticallyyou'], landed: '',           linksSite: true,  mentionsSite: false, audience: ['US'] },
  { id: 'pinpoint',           short: 'PinPoint Magazine',            hosts: ['pinpointmag.co.uk'],           utm: ['pinpoint'],                                  landed: '',           linksSite: true,  mentionsSite: false, audience: ['GB'] },
  { id: 'geocachingpodcast',  short: 'The Geocaching Podcast',       hosts: ['thegeocachingpodcast.com'],    utm: ['geocachingpodcast'],                         landed: '',           linksSite: true,  mentionsSite: false, audience: ['US'] },
  { id: 'bigpinekey',         short: 'Big Pine Key bulletin',        hosts: ['bigpinekey.com'],              utm: ['bigpinekey'],                                landed: '',           linksSite: true,  mentionsSite: false, audience: ['US'] },
  { id: 'batavianews',        short: 'The Daily News (Batavia)',     hosts: ['thedailynewsonline.com', 'livingstonnews.com', 'thelcn.com'], utm: ['batavianews'], landed: '',        linksSite: true,  mentionsSite: false, audience: ['US'] },
  { id: 'treasureclub',       short: 'Armchair Treasure Hunt Club',  hosts: ['treasureclub.net'],            utm: ['treasureclub'],                              landed: '',           linksSite: true,  mentionsSite: false, audience: ['GB'] },
  { id: 'roomescapeartist',   short: 'Room Escape Artist',           hosts: ['roomescapeartist.com'],        utm: ['roomescapeartist'],                          landed: '',           linksSite: true,  mentionsSite: false, audience: ['US', 'CA', 'GB'] },
  { id: 'escapeeffect',       short: 'The Escape Effect',            hosts: ['theescapeeffect.com'],         utm: ['escapeeffect'],                              landed: '',           linksSite: true,  mentionsSite: false, audience: ['US'] },
  { id: 'escapetheroomers',   short: 'ESCAPETHEROOMers',             hosts: ['escapetheroomers.com'],        utm: ['escapetheroomers'],                          landed: '',           linksSite: true,  mentionsSite: false, audience: ['US', 'CA'] },
  { id: 'cluedinmystery',     short: 'Clued In Mystery',             hosts: ['cluedinmystery.substack.com', 'cluedinmystery.com'], utm: ['cluedinmystery'],    landed: '',           linksSite: true,  mentionsSite: false, audience: ['US'] },
  { id: 'readersfavorite',    short: "Readers' Favorite",            hosts: ['readersfavorite.com'],         utm: ['readersfavorite'],                           landed: '',           linksSite: true,  mentionsSite: false, audience: ['US'] },
  pitched('escapepuzzler',      'The Escape Puzzler',                ['escapepuzzler.com']),
  pitched('escapethereview',    'Escape the Review',                 ['escapethereview.co.uk'], ['GB']),
  pitched('crimefictionlover',  'Crime Fiction Lover',               ['crimefictionlover.com'], ['GB']),
  pitched('americantreasure',   'American Treasure podcast',         []),
  // ── Pitched, no answer yet ──
  pitched('escaperoomer',       'The Escape Roomer',                 ['theescaperoomer.com']),
  pitched('artisanalsudoku',    'Artisanal Sudoku',                  ['artisanalsudoku.substack.com']),
  pitched('escapeauthority',    'Escape Authority',                  ['escapeauthority.com']),
  pitched('geekdad',            'GeekDad',                           ['geekdad.com']),
  pitched('geekyhobbies',       'Geeky Hobbies',                     ['geekyhobbies.com']),
  pitched('brainhealth',        'Virtual Brain Health Center',       ['virtualbrainhealthcenter.com']),
  pitched('dailycaring',        'DailyCaring',                       ['dailycaring.com']),
  pitched('buffalospree',       'Buffalo Spree',                     ['buffalospree.com']),
  pitched('geeksofdoom',        'Geeks of Doom',                     ['geeksofdoom.com']),
  pitched('cinelinx',           'Cinelinx',                          ['cinelinx.com']),
  pitched('thrivinghome',       'Thriving Home',                     ['thrivinghomeblog.com']),
  pitched('beenews',            'Bee Group Newspapers',              ['beenews.com']),
  pitched('analogfamily',       'The Analog Family',                 ['katherinemartinko.ca'], ['CA']),
  pitched('everydayreading',    'Everyday Reading',                  ['everyday-reading.com']),
  pitched('modernmrsdarcy',     'Modern Mrs Darcy',                  ['modernmrsdarcy.com']),
  pitched('rectherapy',         'Rec Therapy Today',                 ['dannypettry.com']),
  pitched('chalkdust',          'Chalkdust Magazine',                ['chalkdustmagazine.com'], ['GB']),
  pitched('aperiodical',        'The Aperiodical',                   ['aperiodical.com'], ['GB']),
  pitched('seniorsafety',       'Senior Safety Advice',              ['seniorsafetyadvice.com']),
  pitched('btpm',               'Buffalo Toronto Public Media',      ['btpm.org'], ['US', 'CA']),
  pitched('atlantaparent',      'Atlanta Parent',                    ['atlantaparent.com']),
  pitched('bookgirlsguide',     "Book Girls' Guide",                 ['bookgirlsguide.com']),
  pitched('ncoa',               'NCOA Adviser',                      ['ncoa.org']),
  pitched('bookreporter',       'Bookreporter',                      ['bookreporter.com']),
  pitched('thesenior',          'The Senior',                        ['thesenior.com', 'thesenior.com.au'], ['AU']),
  pitched('hoppier',            'Hoppier',                           ['hoppier.com']),
  pitched('adventuregames',     'Adventure Games Podcast',           ['adventuregamespodcast.com'], ['GB', 'IE', 'US']),
  pitched('wheniwork',          'When I Work',                       ['wheniwork.com']),
  pitched('pbfingers',          'Peanut Butter Fingers',             ['pbfingers.com']),
  pitched('booksofbrilliance',  'Books of Brilliance',               ['booksofbrilliance.com']),
  pitched('homecentered',       'Home-Centered Learning',            ['homecenteredlearning.com']),
  pitched('bookriot',           'Book Riot',                         ['bookriot.com']),
  pitched('witwhimsy',          'wit and whimsy',                    ['witwhimsy.com']),
  pitched('ptoanswers',         'PTO Answers',                       ['ptoanswers.com']),
  pitched('weareteachers',      'We Are Teachers',                   ['weareteachers.com']),
]);

// Maps, not plain objects: a forged tag like "constructor" or "__proto__" must look up nothing.
const BY_ID = new Map(PLACEMENTS.map((p) => [p.id, p]));
// utm tag as the browser reduces it (lowercase, [a-z0-9_], 16 chars) → placement
const BY_UTM = new Map(PLACEMENTS.flatMap((p) => p.utm.map((u) => [u.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16), p])));
export const placementById = (id) => BY_ID.get(id) || null;
export const placementByUtm = (tag) => BY_UTM.get(tag) || null;

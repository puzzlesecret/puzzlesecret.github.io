/** Public labels only. Word recognition stays in /api/unlock. Add real records, never empty product slots.
 * Gift/mini editions have their own puzzles and words, sharing their parent's roomSetId.
 * Activate a parent family once: register its public route in book-entry.js ROOM_ROUTES
 * and its server resolver allowlist. Further editions of that parent reuse those routes.
 */
export const VOLUMES = Object.freeze([
  { id: 'v1', label: 'Volume I', title: 'The Keeper’s Vault', status: 'available', maxGiftEditions: 5 },
  ...['II', 'III', 'IV', 'V'].map((roman, i) => ({ id: `v${i + 2}`, label: `Volume ${roman}`, status: 'coming-soon', maxGiftEditions: 5 })),
]);
export const BOOKS = Object.freeze([
  { id: 'v1-original', volumeId: 'v1', title: 'Sudoku with a Secret', editionLabel: 'Original · Volume I', editionType: 'original', puzzleCount: 200, cover: '/art/cover-v1-360.webp', helpUrl: '/hints', solutionsUrl: null, roomSetId: 'v1', entryReady: true, publicationStatus: 'published' },
  { id: 'v1-gift-01', volumeId: 'v1', title: 'Sudoku with a Secret', editionLabel: 'Large Print Gift Edition', editionType: 'gift', puzzleCount: 75, cover: '/art/cover-v1-gift-01.webp', helpUrl: '/start?book=v1-gift-01#book-help', solutionsUrl: '/gift/solutions', roomSetId: 'v1', entryReady: true, publicationStatus: 'in-preparation' },
]);
export function getBook(id) { return BOOKS.find((book) => book.id === id); }
export function getBooksForVolume(volumeId, books = BOOKS) { return books.filter((book) => book.volumeId === volumeId && book.entryReady); }

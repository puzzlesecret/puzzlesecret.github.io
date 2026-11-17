import { getBook } from '../data/book-catalog.js';

// Activation is server-owned: a catalog row alone cannot register new routes.
const ENTRY_POLICY = Object.freeze({
  books: {
    'v1-original': { volumeId: 'v1', editionType: 'original' },
    'v1-gift-01': { volumeId: 'v1', editionType: 'gift' },
  },
  parents: {
    v1: { roomSetId: 'v1', destination: '/vault', acts: ['I', 'II', 'III'] },
  },
});
const SOURCES = { original: ['original-book', 'guest'], gift: ['gift-book', 'gift-cover'] };

export function entryContext(hit, lookup = getBook, policy = ENTRY_POLICY) {
  if (!hit || hit.hidden || !['I', 'II', 'III'].includes(hit.act)) return null;
  const inferredId = hit.edition === 'gift' || hit.edition === 'gift-cover'
    ? 'v1-gift-01' : !hit.edition ? 'v1-original' : null;
  if (!inferredId) return null;
  const bookId = hit.bookId ?? inferredId;
  if (!bookId || !Object.hasOwn(policy.books, bookId)) return null;
  const registration = policy.books[bookId];
  if (!Object.hasOwn(policy.parents, registration.volumeId)) return null;
  const route = policy.parents[registration.volumeId];
  // Parent policies explicitly authorize a local route and the public acts.
  if (!/^\/(?!\/)[a-z0-9/-]*$/i.test(route.destination) || !route.acts?.includes(hit.act)) return null;
  const book = lookup(bookId);
  if (!book || book.id !== bookId || book.entryReady !== true || book.volumeId !== registration.volumeId || book.editionType !== registration.editionType || book.roomSetId !== route.roomSetId) return null;
  const source = hit.edition === 'gift-cover' ? 'gift-cover'
    : hit.guest ? 'guest' : hit.edition === 'gift' ? 'gift-book' : 'original-book';
  if (!Object.hasOwn(SOURCES, registration.editionType) || !SOURCES[registration.editionType].includes(source)) return null;
  if ((source === 'guest' || source === 'gift-cover') && hit.act !== 'I') return null;
  if (hit.room && (source !== 'guest' || hit.room !== 'pinpoint')) return null;
  if (hit.volumeId !== undefined && hit.volumeId !== registration.volumeId) return null;
  if (hit.roomSetId !== undefined && hit.roomSetId !== route.roomSetId) return null;
  return {
    bookId: book.id, volumeId: book.volumeId, bookTitle: book.title, source,
    roomSetId: book.roomSetId, destination: route.destination,
  };
}

// Input is a list of literal registration keys, before any object/spread merge.
// Errors intentionally omit the hash and all private registration metadata.
export function assertUniqueRegistrations(registries) {
  const seen = new Set();
  for (const keys of registries) for (const key of keys) {
    if (seen.has(key)) throw new Error('Duplicate unlock registration; activation blocked');
    seen.add(key);
  }
  return true;
}

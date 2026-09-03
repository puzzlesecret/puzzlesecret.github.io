import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// PuzzleSecret vault site. Static-first; the secret word-check runs as an
// on-demand server route (src/pages/api/unlock.js, prerender=false) so the
// answers live only on the server, never in the client bundle.
export default defineConfig({
  site: 'https://puzzlesecret.com',
  server: { host: true },
  adapter: vercel({
    // the reward PDFs ride inside the function bundle; /api/reward reads them from rewards-src/
    includeFiles: ['rewards-src/PuzzleSecret-Vault-I-50-Easy.pdf', 'rewards-src/PuzzleSecret-Vault-II-100-Medium.pdf', 'rewards-src/PuzzleSecret-Vault-III-200-Hard.pdf', 'rewards-src/PuzzleSecret-Secret-Vault-20-Master.pdf'],
  }),
  integrations: [
    sitemap({
      // /vault is the surprise — keep it out of search results so the reveal
      // isn't spoiled by a cold Google visit. API routes aren't pages.
      filter: (page) => !page.includes('/vault'),
    }),
  ],
});

import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// PuzzleSecret vault site. Static-first; the secret word-check runs as an
// on-demand server route (src/pages/api/unlock.js, prerender=false) so the
// answers live only on the server, never in the client bundle.
export default defineConfig({
  site: 'https://puzzlesecret.com',
  server: { host: true },
  adapter: vercel(),
});

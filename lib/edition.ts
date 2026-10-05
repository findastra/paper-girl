// Paper Girl ships in two editions. The full site runs on Cloudflare Workers with a shared D1 article index and a
// shared search history. The static edition (GitHub Pages, built with `npm run build:static`) has no server, so
// lib/browser-library.ts answers the same /api/* requests in the visitor's browser instead.
const env = ((import.meta as unknown as {env?: Record<string, string | undefined>}).env) || {};

export const staticEdition = env.VITE_PAPER_GIRL_STATIC === '1';

/** Where the site is served from: "/" for the full site, "/paper-girl/" on GitHub Pages. */
export const base = env.BASE_URL || '/';

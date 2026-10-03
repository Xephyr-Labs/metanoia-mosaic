# Mosaic assistant starter

This Express service mounts Metanoia Mosaic at `/assistant` and serves its floating widget at `/`. Configure `.env`, install dependencies, and run `npm run dev`. The widget loader is served from the installed package, so this starter needs no CDN or frontend build. Use `@metanoia/client` when building your own interface.

The auth function intentionally returns no user until you connect it to your application's verified session. Implement `src/auth.js` before sending requests. Do not replace it with a user ID from request JSON or an unverified header.

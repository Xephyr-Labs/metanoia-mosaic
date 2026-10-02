# Mosaic assistant starter

This Express service mounts Metanoia Mosaic at `/assistant`. Add a client UI using `@metanoia/widget` or `@metanoia/client` and connect it to that endpoint.

The auth function intentionally returns no user until you connect it to your application's verified session. Implement `src/auth.js` before sending requests. Do not replace it with a user ID from request JSON or an unverified header.

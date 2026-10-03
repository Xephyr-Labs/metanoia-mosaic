# React Native / Expo example

Use an Expo SDK 54+ app with `@metanoia/client`, `expo-image-picker`, and `expo-file-system`. Copy `App.tsx` and `auth.ts` into a blank TypeScript app, set `EXPO_PUBLIC_CHATBOT_URL`, and connect `auth.ts` to your secure access-token refresh flow.

```sh
npx create-expo-app@latest mosaic-mobile --template blank-typescript
cd mosaic-mobile
npm install @metanoia/client
npx expo install expo-image-picker expo-file-system
```

Until the client package is published, install a local tarball produced by `npm pack --workspace @metanoia/client` instead. The server endpoint must be reachable from the device. Use HTTPS for deployed applications.

The example injects [Expo's streaming Fetch](https://docs.expo.dev/versions/latest/sdk/expo/#streaming-fetch) and uploads image bytes using an [`expo-file-system` File](https://docs.expo.dev/versions/latest/sdk/filesystem/#uploading-files). Image attachment appears only when enabled by the server. It displays errors, prevents duplicate submissions, and cancels configuration/turn requests on unmount; the Stop button cancels an active turn.

The headless client also accepts `{ uri, name, type }` native file descriptors for React Native transports that support them. Expo Fetch requires a Blob/File carrying bytes instead. Keep identity verification on the server; send a verified access token. Reset the screen and any stored conversation ID when the authenticated user changes.

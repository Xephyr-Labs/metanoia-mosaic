# React Native / Expo starter

The mobile integration uses the headless `@metanoia/client`; React Native supplies native screens, secure token storage, file pickers, and a streaming-compatible Fetch implementation. Install `@metanoia/client`, `expo-image-picker`, and a compatible React Native SSE Fetch implementation for your Expo SDK.

Use Expo's managed file API with `uploadImage`. Native files are passed as `{ uri, name, type }`, while browsers can pass a `Blob`. The client accepts an injected `fetch` and an async `headers` callback so the app can refresh its bearer token before each request. Pass `AbortSignal` to uploads, transcription, speech, and conversation methods to cancel work when a screen unmounts.

`App.tsx` is a minimal UI pattern for streaming replies and attaching images. Keep identity verification on the server; the mobile app sends its access token, never a user ID. The endpoint must be reachable over HTTPS on device.

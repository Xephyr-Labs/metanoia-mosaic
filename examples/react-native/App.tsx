import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { createChatbotClient } from "@metanoia/client";
import { getFreshAccessToken } from "./auth";

const endpoint = process.env.EXPO_PUBLIC_CHATBOT_URL!;

export default function App() {
  const client = useMemo(() => createChatbotClient({
    endpoint,
    headers: async () => ({ authorization: `Bearer ${await getFreshAccessToken()}` }),
    fetch: expoFetch as typeof globalThis.fetch,
  }), []);
  const conversation = useRef<string | undefined>(undefined);
  const active = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(false);
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagesEnabled, setImagesEnabled] = useState(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void client.config(controller.signal).then(config => {
      if (!controller.signal.aborted) setImagesEnabled(config.capabilities.images);
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load assistant configuration.");
    });
    return () => {
      mounted.current = false;
      controller.abort();
      active.current?.abort();
    };
  }, [client]);

  async function ensureConversation(signal: AbortSignal) {
    if (conversation.current) return conversation.current;
    const created = await client.createConversation(signal);
    conversation.current = created.conversation.id;
    return created.conversation.id;
  }

  async function send(attachImage = false) {
    const content = draft.trim();
    if (active.current || (!attachImage && !content)) return;
    const controller = new AbortController();
    active.current = controller; // Lock immediately, before the picker or a React rerender.
    setBusy(true);
    setError("");
    try {
      let asset: ImagePicker.ImagePickerAsset | undefined;
      if (attachImage) {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
        if (result.canceled || controller.signal.aborted) return;
        asset = result.assets[0];
      }
      const id = await ensureConversation(controller.signal);
      if (controller.signal.aborted) return;
      const mediaIds: string[] = [];
      if (asset) {
        // Expo Fetch expects file bytes, not React Native's proprietary URI descriptor.
        const file = new File(asset.uri);
        const uploaded = await client.uploadImage(id, file, asset.fileName ?? file.name, controller.signal);
        mediaIds.push(uploaded.mediaId);
      }
      if (controller.signal.aborted) return;
      setDraft("");
      setReply("");
      for await (const event of client.sendMessage(id, {
        content: content || "Describe the attached image.", mediaIds, signal: controller.signal,
      })) {
        if (!mounted.current || controller.signal.aborted) break;
        if (event.type === "delta") setReply(value => value + event.data.text);
        if (event.type === "error") { setError(event.data.message); break; }
      }
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "Unable to reach the assistant.");
      }
    } finally {
      if (active.current === controller) active.current = undefined;
      if (mounted.current) setBusy(false);
    }
  }

  return <View style={{ flex: 1, padding: 20, paddingTop: 60, gap: 12 }}>
    <Text accessibilityRole="header">Mosaic assistant</Text>
    <ScrollView accessibilityLiveRegion="polite" style={{ flex: 1 }}><Text>{reply}</Text></ScrollView>
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <TextInput value={draft} onChangeText={setDraft} editable={!busy} placeholder="Message…" accessibilityLabel="Message" />
    <Button title={busy ? "Responding…" : "Send"} disabled={busy} onPress={() => void send()} />
    {imagesEnabled ? <Button title="Attach image" disabled={busy} onPress={() => void send(true)} /> : null}
    {busy ? <Button title="Stop" onPress={() => active.current?.abort()} /> : null}
  </View>;
}

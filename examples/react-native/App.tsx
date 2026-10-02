import { useMemo, useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { createChatbotClient, type NativeUploadFile } from "@metanoia/client";

const endpoint = process.env.EXPO_PUBLIC_CHATBOT_URL!;

export default function App() {
  const client = useMemo(() => createChatbotClient({
    endpoint,
    headers: async () => ({ authorization: `Bearer ${await getFreshAccessToken()}` }),
    fetch: fetch, // provide your platform's streaming Fetch adapter here when required
  }), []);
  const [conversationId, setConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const created = await client.createConversation();
    setConversationId(created.conversation.id);
    return created.conversation.id;
  }

  async function send(content = draft, mediaIds: string[] = []) {
    if (busy || (!content.trim() && mediaIds.length === 0)) return;
    setBusy(true);
    setDraft("");
    setReply("");
    const controller = new AbortController();
    try {
      const id = await ensureConversation();
      for await (const event of client.sendMessage(id, { content: content || "Describe the attached image.", mediaIds, signal: controller.signal })) {
        if (event.type === "delta") setReply(value => value + event.data.text);
        if (event.type === "error") setReply(event.data.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function attachImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    const id = await ensureConversation();
    const file: NativeUploadFile = { uri: asset.uri, name: asset.fileName ?? "image.jpg", type: asset.mimeType ?? "image/jpeg" };
    const uploaded = await client.uploadImage(id, file);
    await send("", [uploaded.mediaId]);
  }

  return <View style={{ flex: 1, padding: 20, paddingTop: 60, gap: 12 }}>
    <Text accessibilityRole="header">Mosaic assistant</Text>
    <ScrollView accessibilityLiveRegion="polite" style={{ flex: 1 }}><Text>{reply}</Text></ScrollView>
    <TextInput value={draft} onChangeText={setDraft} editable={!busy} placeholder="Message…" accessibilityLabel="Message" />
    <Button title={busy ? "Responding…" : "Send"} disabled={busy} onPress={() => void send()} />
    <Button title="Attach image" disabled={busy} onPress={() => void attachImage()} />
  </View>;
}

async function getFreshAccessToken(): Promise<string> {
  // Replace with your app's secure token refresh flow.
  return "replace-with-a-secure-token-provider";
}

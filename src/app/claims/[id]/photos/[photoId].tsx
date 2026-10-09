import { type Href, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ErrorNote, Header, Screen } from "@/components/ui";
import { api, fileUrl } from "@/lib/api";
import type { Photo } from "@/lib/types";
import { colors } from "@/theme";

export default function PhotoScreen() {
  const { id, photoId } = useLocalSearchParams<{ id: string; photoId: string }>();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Photo>(`/api/photos/${photoId}`)
      .then((next) => {
        setPhoto(next);
        setCaption(next.caption);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the photo"));
  }, [photoId]);

  async function saveCaption() {
    const next = await api<Photo>(`/api/photos/${photoId}`, { method: "PATCH", body: JSON.stringify({ caption }) });
    setPhoto(next);
  }

  async function remove() {
    await api(`/api/photos/${photoId}`, { method: "DELETE" });
    router.back();
  }

  return (
    <Screen>
      <Header title={photo?.chip || "Photo"} back={`/claims/${id}` as Href} />
      {error ? <ErrorNote message={error} /> : null}
      {photo ? (
        <ScrollView contentContainerStyle={styles.page}>
          {photo.hasImage ? <Image source={{ uri: fileUrl(photo.id) }} style={styles.image} /> : <View style={styles.image} />}
          <Text style={styles.meta}>{photo.kind} · {photo.syncStatus}</Text>
          {photo.voiceNote?.transcript ? <Text style={styles.note}>{photo.voiceNote.transcript}</Text> : null}
          <TextInput style={styles.input} multiline value={caption} placeholderTextColor={colors.ink} onChangeText={setCaption} onEndEditing={saveCaption} />
          <Pressable onPress={remove}>
            <Text style={styles.danger}>Soft-delete photo</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: 18, gap: 12 },
  image: { width: "100%", height: 240, borderRadius: 12, backgroundColor: colors.navy },
  meta: { color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  note: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 90, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, textAlignVertical: "top" },
  danger: { color: colors.red, fontWeight: "700" },
});

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { colors } from "@/theme";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function AddressField({
  value,
  onPlaceSelected,
}: {
  value: string;
  onPlaceSelected: (address: string, placeId: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [lastQuery, setLastQuery] = useState(value);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (value === query) return;
    setQuery(value);
    setLastQuery(value);
  }, [value, query]);

  const shouldFetch = debouncedQuery.trim().length >= 3 && debouncedQuery !== lastQuery;
  const { data, isLoading, error } = useQuery({
    queryKey: ["google-places", debouncedQuery],
    enabled: shouldFetch,
    queryFn: () =>
      api<{ predictions: { description: string; place_id: string }[] }>(
        `/api/places?query=${encodeURIComponent(debouncedQuery)}`,
      ).then((json) => json.predictions ?? []),
  });

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Risk address</Text>
      <TextInput
        style={styles.input}
        value={query}
        placeholder="Enter address"
        placeholderTextColor={colors.ink}
        onChangeText={(text) => {
          setQuery(text);
          onPlaceSelected(text, "");
        }}
      />
      {isLoading ? <Text style={styles.status}>Searching…</Text> : null}
      {error ? <Text style={styles.error}>{error instanceof Error ? error.message : "Address search failed"}</Text> : null}
      {query !== lastQuery && data && data.length > 0 && !isLoading ? (
        <View style={styles.list}>
          {data.map((item) => (
            <Pressable
              key={item.place_id}
              onPress={() => {
                onPlaceSelected(item.description, item.place_id);
                setQuery(item.description);
                setLastQuery(item.description);
              }}
            >
              <Text style={styles.prediction}>{item.description}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  status: { color: colors.muted, fontSize: 12 },
  error: { color: colors.red, fontSize: 12 },
  list: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: "hidden",
  },
  prediction: { paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 14 },
});

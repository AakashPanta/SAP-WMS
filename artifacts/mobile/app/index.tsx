import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Note = {
  id: string;
  text: string;
  createdAt: string;
};

const STORAGE_KEY = "notes-app-v1";

export default function NotesAppScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as Note[];
        setNotes(parsed);
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const noteCountLabel = useMemo(
    () => `${notes.length} ${notes.length === 1 ? "note" : "notes"}`,
    [notes.length]
  );

  const addNote = () => {
    const text = inputValue.trim();
    if (!text) return;

    const nextNote: Note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: new Date().toISOString(),
    };

    setNotes((current) => [nextNote, ...current]);
    setInputValue("");
  };

  const removeNote = (id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Text style={styles.heading}>Notes</Text>
        <Text style={styles.subheading}>Simple Android-ready notes app</Text>

        <View style={styles.inputRow}>
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Write a note..."
            style={styles.input}
            multiline
          />
          <TouchableOpacity style={styles.addButton} onPress={addNote}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.counter}>{noteCountLabel}</Text>

        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={notes.length === 0 ? styles.emptyList : undefined}
          renderItem={({ item }) => (
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{item.text}</Text>
              <View style={styles.noteFooter}>
                <Text style={styles.noteDate}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
                <TouchableOpacity onPress={() => removeNote(item.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No notes yet.</Text>}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f8fa" },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  heading: { fontSize: 28, fontWeight: "700", color: "#101828" },
  subheading: { fontSize: 14, color: "#667085" },
  inputRow: { gap: 8 },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 12,
    backgroundColor: "white",
    padding: 12,
    textAlignVertical: "top",
  },
  addButton: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addButtonText: { color: "white", fontWeight: "600" },
  counter: { color: "#475467", fontSize: 13 },
  emptyList: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#98a2b3", fontSize: 16 },
  noteCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#eaecf0",
    marginBottom: 10,
  },
  noteText: { color: "#101828", fontSize: 16, marginBottom: 10 },
  noteFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteDate: { color: "#667085", fontSize: 12 },
  deleteText: { color: "#b42318", fontSize: 13, fontWeight: "600" },
});

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInputProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface FormFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  icon?: keyof typeof Feather.glyphMap;
  required?: boolean;
  error?: string;
  onClear?: () => void;
}

export function FormField({
  label,
  hint,
  icon,
  required,
  error,
  value,
  onClear,
  ...props
}: FormFieldProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const borderColor = error
    ? colors.destructive
    : focused
    ? colors.primary
    : colors.border;

  const bgColor = focused ? "#f8faff" : colors.input;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {label}
          {required ? (
            <Text style={{ color: colors.destructive }}> *</Text>
          ) : null}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {hint}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: bgColor,
            shadowColor: focused ? colors.primary : "transparent",
          },
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={18}
            color={focused ? colors.primary : colors.mutedForeground}
            style={styles.icon}
          />
        ) : null}

        <TextInput
          ref={inputRef}
          value={value}
          style={[
            styles.input,
            {
              color: colors.foreground,
              fontFamily: "Inter_400Regular",
              paddingLeft: icon ? 0 : 2,
            },
          ]}
          placeholderTextColor={colors.mutedForeground}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="characters"
          {...props}
        />

        {value && onClear ? (
          <TouchableOpacity
            onPress={onClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearBtn}
          >
            <Feather name="x-circle" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={12} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 52,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: Platform.OS === "web" ? 0 : 0.15,
    shadowRadius: 8,
    elevation: 0,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
    ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}),
  },
  clearBtn: {
    paddingLeft: 8,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});

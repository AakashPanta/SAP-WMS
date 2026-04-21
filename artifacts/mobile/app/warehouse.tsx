@@ -596,60 +596,60 @@ function FieldRow({
   editable,
   onChangeText,
   placeholder,
   colors,
 }: {
   label: string;
   value: string;
   editable: boolean;
   onChangeText: (t: string) => void;
   placeholder: string;
   colors: any;
 }) {
   return (
     <View style={fieldStyles.row}>
       <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>
         {label}
       </Text>
       {editable ? (
         <TextInput
           style={[
             fieldStyles.editInput,
             {
               color: colors.foreground,
               borderColor: colors.primary,
               backgroundColor: "#f0f6ff",
+              ...(Platform.OS === "web"
+                ? ({ outlineStyle: "none" } as any)
+                : {}),
             },
           ]}
           value={value}
           onChangeText={onChangeText}
           placeholder={placeholder}
           placeholderTextColor={colors.mutedForeground}
           autoCapitalize="characters"
-          {...(Platform.OS === "web"
-            ? ({ style: [fieldStyles.editInput, { color: colors.foreground, borderColor: colors.primary, backgroundColor: "#f0f6ff", outlineStyle: "none" } as any] })
-            : {})}
         />
       ) : (
         <Text
           style={[
             fieldStyles.value,
             {
               color: value ? colors.foreground : colors.mutedForeground,
               fontFamily: "Inter_700Bold",
             },
           ]}
         >
           {value || "—"}
         </Text>
       )}
     </View>
   );
 }
 
 const fieldStyles = StyleSheet.create({
   row: {
     flexDirection: "row",
     alignItems: "center",
     justifyContent: "space-between",
     paddingVertical: 12,
   },

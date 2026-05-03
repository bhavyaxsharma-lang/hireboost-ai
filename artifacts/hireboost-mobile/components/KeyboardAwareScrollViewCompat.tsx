import { Platform, ScrollView, ScrollViewProps } from "react-native";

type Props = ScrollViewProps & {
  keyboardShouldPersistTaps?: "always" | "handled" | "never";
};

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  // Lazy require so the native module is never loaded on web
  const { KeyboardAwareScrollView } = require("react-native-keyboard-controller");
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

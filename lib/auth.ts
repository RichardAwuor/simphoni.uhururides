import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.backendUrl ||
  "https://cmxtxz868f7cxmeqqjzqkrqtsw5b4k47.app.specular.dev";

export const BEARER_TOKEN_KEY = "uhurueastafricais_bearer_token";

const getPlugins = () => {
  if (Platform.OS === "web") return [];
  const { expoClient } = require("@better-auth/expo/client");
  return [
    expoClient({
      scheme: "uhurueastafricais",
      storagePrefix: "uhurueastafricais",
      storage: SecureStore,
    }),
  ];
};

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: getPlugins(),
  ...(Platform.OS === "web" && {
    fetchOptions: {
      credentials: "include",
      auth: {
        type: "Bearer" as const,
        token: () => localStorage.getItem(BEARER_TOKEN_KEY) || "",
      },
    },
  }),
});

export async function setBearerToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
  }
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
  }
}

export { API_URL };

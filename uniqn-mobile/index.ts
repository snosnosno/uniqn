import { getRandomValues } from 'expo-crypto';

// React Native에서 Web Crypto API (crypto.getRandomValues) polyfill
if (!globalThis.crypto) {
  globalThis.crypto = { getRandomValues } as unknown as Crypto;
} else if (!globalThis.crypto.getRandomValues) {
  globalThis.crypto.getRandomValues = getRandomValues as Crypto['getRandomValues'];
}

import 'expo-router/entry';

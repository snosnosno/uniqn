import { getRandomValues } from 'expo-crypto';

// React Native에서 Web Crypto API (crypto.getRandomValues) polyfill
if (!globalThis.crypto) {
  globalThis.crypto = { getRandomValues } as unknown as Crypto;
} else if (!globalThis.crypto.getRandomValues) {
  globalThis.crypto.getRandomValues = getRandomValues as Crypto['getRandomValues'];
}

// expo-router 엔트리는 crypto polyfill 이후에 로드되어야 한다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('expo-router/entry');

import { buildRegisterFcmTokenUpdate } from '@/repositories/firebase/NotificationRepository';

function createLegacyTokenKey(token: string): string {
  return token.substring(0, 32).replace(/[^a-zA-Z0-9]/g, '_');
}

describe('NotificationRepository token helpers', () => {
  describe('buildRegisterFcmTokenUpdate', () => {
    it('adds a new token, removes the legacy key, and evicts the oldest token at the limit', () => {
      const token = 'ExponentPushToken[new-device-token]';
      const currentTokens = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
          `existing-${index}`,
          {
            registeredAt: {
              toMillis: () => index + 1,
            },
          },
        ])
      );

      const result = buildRegisterFcmTokenUpdate(currentTokens, token, {
        type: 'expo',
        platform: 'ios',
      });

      const newTokenKey = Object.keys(result).find((key) => key.startsWith('fcmTokens.tk_'));

      expect(newTokenKey).toBeDefined();
      expect(result['fcmTokens.existing-0']).toBeDefined();
      expect(result[`fcmTokens.${createLegacyTokenKey(token)}`]).toBeDefined();
    });

    it('does not evict another token when the same device token is already stored under the legacy key', () => {
      const token = 'ExponentPushToken[already-stored-device]';
      const legacyTokenKey = createLegacyTokenKey(token);
      const currentTokens = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
          `existing-${index}`,
          {
            registeredAt: {
              toMillis: () => index + 1,
            },
          },
        ])
      ) as Record<string, { registeredAt: { toMillis: () => number } }>;

      currentTokens[legacyTokenKey] = {
        registeredAt: {
          toMillis: () => 999,
        },
      };

      const result = buildRegisterFcmTokenUpdate(currentTokens, token, {
        type: 'expo',
        platform: 'android',
      });

      expect(result['fcmTokens.existing-0']).toBeUndefined();
      expect(result[`fcmTokens.${legacyTokenKey}`]).toBeDefined();
    });
  });
});

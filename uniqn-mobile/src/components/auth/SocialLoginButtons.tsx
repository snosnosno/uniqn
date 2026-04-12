import React from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

interface SocialLoginButtonsProps {
  onAppleLogin?: () => Promise<void>;
  isLoading?: boolean;
  loadingProvider?: 'apple' | null;
  disabled?: boolean;
  isAppleAvailable?: boolean;
  availabilityMessage?: string;
}

export function SocialLoginButtons({
  onAppleLogin,
  isLoading = false,
  loadingProvider = null,
  disabled = false,
  isAppleAvailable = true,
  availabilityMessage,
}: SocialLoginButtonsProps) {
  if (Platform.OS !== 'ios' || !onAppleLogin) {
    return null;
  }

  const isButtonLoading = loadingProvider === 'apple';
  const isButtonDisabled = disabled || isLoading;

  if (!isAppleAvailable) {
    return availabilityMessage ? (
      <View className="w-full rounded-lg bg-surface-card p-4 dark:bg-surface">
        <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
          {availabilityMessage}
        </Text>
      </View>
    ) : null;
  }

  return (
    <View className="w-full">
      <View
        style={[
          styles.buttonContainer,
          isButtonDisabled ? styles.buttonDisabled : null,
          { pointerEvents: isButtonDisabled ? 'none' : 'auto' },
        ]}
      >
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={styles.button}
          onPress={onAppleLogin}
          testID="apple-login-button"
        />
        {(isButtonDisabled || isButtonLoading) && (
          <View style={[styles.overlay, { pointerEvents: 'none' }]}>
            {isButtonLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
          </View>
        )}
      </View>
    </View>
  );
}

export default SocialLoginButtons;

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 50,
  },
  buttonContainer: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    justifyContent: 'center',
  },
});

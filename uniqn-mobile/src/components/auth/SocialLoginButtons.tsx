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
      <View className="w-full rounded-lg bg-gray-100 p-4 dark:bg-surface">
        <Text className="text-sm text-gray-600 dark:text-gray-300">{availabilityMessage}</Text>
      </View>
    ) : null;
  }

  return (
    <View className="w-full">
      <View
        pointerEvents={isButtonDisabled ? 'none' : 'auto'}
        style={[styles.buttonContainer, isButtonDisabled ? styles.buttonDisabled : null]}
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
          <View pointerEvents="none" style={styles.overlay}>
            {isButtonLoading ? <ActivityIndicator size="small" color="#ffffff" /> : null}
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

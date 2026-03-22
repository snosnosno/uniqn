import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

interface SocialLoginButtonsProps {
  onAppleLogin?: () => Promise<void>;
  isLoading?: boolean;
  loadingProvider?: 'apple' | null;
  disabled?: boolean;
}

export function SocialLoginButtons({
  onAppleLogin,
  isLoading = false,
  loadingProvider = null,
  disabled = false,
}: SocialLoginButtonsProps) {
  if (Platform.OS !== 'ios' || !onAppleLogin) {
    return null;
  }

  const isButtonLoading = loadingProvider === 'apple';
  const isButtonDisabled = disabled || isLoading;

  return (
    <View className="w-full">
      <Pressable
        onPress={onAppleLogin}
        disabled={isButtonDisabled}
        className={`min-h-[48px] flex-row items-center justify-center rounded-lg px-4 py-3 ${
          isButtonDisabled ? 'bg-gray-700 opacity-50' : 'bg-black'
        }`}
      >
        {isButtonLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text className="text-base font-medium text-white">Apple로 계속하기</Text>
        )}
      </Pressable>
    </View>
  );
}

export default SocialLoginButtons;

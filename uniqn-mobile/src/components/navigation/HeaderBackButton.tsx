import React from 'react';
import { Pressable } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { ChevronLeftIcon } from '@/components/icons';
import { HEADER_CLASSES } from '@/constants';

interface HeaderBackButtonProps {
  tintColor: string;
  fallbackHref?: string;
  className?: string;
}

export function HeaderBackButton({
  tintColor,
  fallbackHref = '/(app)/(tabs)',
  className,
}: HeaderBackButtonProps) {
  const router = useRouter();
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref as never);
  };

  return (
    <Pressable
      onPress={handleBack}
      hitSlop={8}
      className={`-ml-2 rounded-sm p-2 ${HEADER_CLASSES.actionPressed} ${className ?? ''}`.trim()}
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
    >
      <ChevronLeftIcon size={24} color={tintColor} />
    </Pressable>
  );
}

export default HeaderBackButton;

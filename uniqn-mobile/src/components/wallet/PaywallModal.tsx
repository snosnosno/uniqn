/**
 * UNIQN Mobile - PaywallModal
 * @description 공고 게시 잔액 부족 시 노출. 비용/보유잔액/부족분 + 충전 CTA.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal } from '@/components/ui';

export interface PaywallModalProps {
  visible: boolean;
  cost: number;
  currencyHint: string;
  heartBalance: number;
  diamondBalance: number;
  onClose: () => void;
  onCharge: () => void;
}

export function PaywallModal({
  visible,
  cost,
  currencyHint,
  heartBalance,
  diamondBalance,
  onClose,
  onCharge,
}: PaywallModalProps) {
  const symbol = currencyHint === 'heart_first' ? '💖' : '💎';
  const owned = currencyHint === 'heart_first' ? heartBalance + diamondBalance : diamondBalance;
  const short = Math.max(0, cost - owned);

  return (
    <Modal visible={visible} onClose={onClose} title="잔액이 부족해요" position="center">
      <View className="gap-3">
        <Text className="text-sm font-sans text-content-primary dark:text-secondary-100">
          이 공고를 게시하려면 {cost}
          {symbol} 가 필요해요.
        </Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
            보유 잔액
          </Text>
          <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
            💖 {heartBalance} 💎 {diamondBalance}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
            부족분
          </Text>
          <Text className="text-sm font-sans-semibold text-error-600">
            {short}
            {symbol}
          </Text>
        </View>
        <View className="mt-2 flex-row gap-2">
          <Pressable
            testID="paywall-close"
            onPress={onClose}
            className="flex-1 items-center rounded-md bg-secondary-100 py-3 dark:bg-secondary-800"
          >
            <Text className="font-sans-semibold text-content-primary dark:text-secondary-100">
              닫기
            </Text>
          </Pressable>
          <Pressable
            testID="paywall-charge"
            onPress={onCharge}
            className="flex-1 items-center rounded-md bg-primary-600 py-3"
          >
            <Text className="font-sans-semibold text-white">충전하기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

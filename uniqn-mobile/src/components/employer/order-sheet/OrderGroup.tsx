import React from 'react';
import { Text, View } from 'react-native';

export function OrderGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-[11px] font-sans-bold tracking-wide text-content-secondary mb-1.5 ml-1">
        {title}
      </Text>
      <View className="rounded-2xl bg-surface-card border border-secondary-100 dark:border-surface-overlay overflow-hidden">
        {children}
      </View>
    </View>
  );
}

import React from 'react';
import { Text, View } from 'react-native';

export function OrderGroup({
  title,
  caption,
  children,
}: {
  title: string;
  /** 헤더 우측 캡션 — 일정·모집 총원 요약("딜러 8 · 플로어 2") 등(리뷰 Design-L1) */
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1.5 mx-1">
        <Text className="text-[11px] font-sans-bold tracking-wide text-content-secondary">
          {title}
        </Text>
        {caption ? (
          <Text className="text-[11px] text-content-muted font-sans" numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      <View className="rounded-2xl bg-surface-card border border-secondary-100 dark:border-surface-overlay overflow-hidden">
        {children}
      </View>
    </View>
  );
}

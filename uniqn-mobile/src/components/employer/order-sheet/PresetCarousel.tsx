/**
 * PresetCarousel — 프리셋 캐러셀 (주문서 상단)
 *
 * @description "마지막 공고" + 저장된 템플릿을 가로 스크롤 카드로 노출하고, 탭 1번으로 주문서
 * 전체를 그 구성으로 교체한다(onSelect→form.reset). 마지막 카드("＋ 저장")는 현재 구성을
 * 템플릿으로 저장(onSavePress). 프리셋이 없으면 온보딩 안내(빈 상태=온보딩 기회, 디자인 룰 9).
 * fixed·대회 등 주문서로 표현 불가한 공고는 호출부(create.tsx)가 try/catch 로 제외한다.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

export interface OrderSheetPreset {
  id: string;
  title: string;
  subtitle: string;
  values: OrderSheetFormValues;
}

export interface PresetCarouselProps {
  presets: OrderSheetPreset[];
  onSelect: (preset: OrderSheetPreset) => void;
  onSavePress: () => void;
}

export function PresetCarousel({ presets, onSelect, onSavePress }: PresetCarouselProps) {
  if (presets.length === 0) {
    return (
      <View className="mb-3 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3">
        <Text className="text-xs text-content-muted font-sans">
          아직 프리셋이 없어요 — 첫 공고를 등록하면 만들어 드릴게요
        </Text>
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerClassName="gap-2"
    >
      {presets.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onSelect(p)}
          className="min-w-[130px] min-h-[44px] rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-3 py-2.5 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`프리셋 ${p.title} 적용`}
          testID={`order-sheet-preset-${p.id}`}
        >
          <Text className="text-xs font-sans-bold text-content-primary" numberOfLines={1}>
            {p.title}
          </Text>
          <Text className="text-[11px] text-content-muted font-sans" numberOfLines={1}>
            {p.subtitle}
          </Text>
        </Pressable>
      ))}
      {/* "＋ 저장" 카드 — 스펙 §2 캐러셀 3요소(리뷰 M5 복원): 현재 주문서 구성을 템플릿으로 저장 */}
      <Pressable
        onPress={onSavePress}
        className="min-w-[72px] min-h-[44px] rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-3 py-2.5 items-center justify-center active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel="현재 구성을 프리셋으로 저장"
        testID="order-sheet-preset-save"
      >
        <Text className="text-xs text-content-secondary font-sans">＋ 저장</Text>
      </Pressable>
    </ScrollView>
  );
}

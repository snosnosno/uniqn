/**
 * PresetCarousel — 프리셋 캐러셀 (주문서 상단)
 *
 * @description "마지막 공고" + 저장된 템플릿을 가로 스크롤 카드로 노출하고, 탭 1번으로 주문서
 * 전체를 그 구성으로 교체한다(onSelect→form.reset). 마지막 카드("＋ 저장")는 현재 구성을
 * 템플릿으로 저장(onSavePress). 프리셋이 없으면 온보딩 안내(빈 상태=온보딩 기회, 디자인 룰 9).
 * fixed·대회 등 주문서로 표현 불가한 공고는 호출부(create.tsx)가 try/catch 로 제외한다.
 *
 * "관리" 칩은 저장된 프리셋의 이름변경·삭제 진입점이다(PresetManageSheet). 캐러셀이 옛
 * '불러오기 모달'에서 적용 기능만 옮겨 오는 바람에 프리셋을 지우는 픽셀이 앱 전체에 0개였다.
 * 시트는 열릴 때만 마운트한다 — 자체적으로 템플릿 목록을 조회하므로 상시 마운트하면
 * 캐러셀만 렌더하는 화면·테스트까지 쿼리 컨텍스트를 요구하게 된다.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ZapIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { PresetManageSheet } from './sheets/PresetManageSheet';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

export interface OrderSheetPreset {
  id: string;
  title: string;
  /** 'zap' 이면 title 앞에 번개 아이콘("마지막 공고" 강조). 템플릿 프리셋은 미설정. */
  icon?: 'zap';
  subtitle: string;
  values: OrderSheetFormValues;
}

export interface PresetCarouselProps {
  presets: OrderSheetPreset[];
  onSelect: (preset: OrderSheetPreset) => void;
  onSavePress: () => void;
  /** 프리셋 목록을 아직 불러오는 중인지. 로딩과 '없음'을 구분하지 않으면 거짓말이 된다. */
  isLoading?: boolean;
}

export function PresetCarousel({
  presets,
  onSelect,
  onSavePress,
  isLoading = false,
}: PresetCarouselProps) {
  const [isManageOpen, setIsManageOpen] = useState(false);

  // 로딩 중에 '아직 프리셋이 없어요' 를 단정하면 재방문 사장에게 거짓말이 된다 —
  // 잠시 뒤 카드가 나타나면서 안내가 뒤집힌다. 구조를 유지하는 스켈레톤으로 대체(impeccable §16).
  if (isLoading && presets.length === 0) {
    return (
      <View
        className="mb-3 flex-row gap-2"
        accessibilityRole="progressbar"
        accessibilityLabel="프리셋 불러오는 중"
        testID="order-sheet-preset-skeleton"
      >
        <Skeleton width={130} height={52} borderRadius={12} accessible={false} />
        <Skeleton width={130} height={52} borderRadius={12} accessible={false} />
      </View>
    );
  }
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
    <>
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
            <View className="flex-row items-center gap-1">
              {p.icon === 'zap' ? <ZapIcon size={14} /> : null}
              <Text
                className="flex-1 text-xs font-sans-bold text-content-primary"
                numberOfLines={1}
              >
                {p.title}
              </Text>
            </View>
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
        {/* "관리" 칩 — 저장된 프리셋의 이름변경·삭제 진입점(회귀 복구).
            적용 카드와 형제로 두어 <button> 중첩을 피한다. */}
        <Pressable
          onPress={() => setIsManageOpen(true)}
          className="min-w-[72px] min-h-[44px] rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-3 py-2.5 items-center justify-center active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="저장된 프리셋 관리"
          testID="order-sheet-preset-manage"
        >
          <Text className="text-xs text-content-secondary font-sans">관리</Text>
        </Pressable>
      </ScrollView>
      {isManageOpen ? <PresetManageSheet visible onClose={() => setIsManageOpen(false)} /> : null}
    </>
  );
}

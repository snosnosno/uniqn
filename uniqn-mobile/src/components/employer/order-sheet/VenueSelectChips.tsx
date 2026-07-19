/**
 * VenueSelectChips — 공고 작성 시 "이 공고를 어느 지점 배치에 반영할지" 고르는 칩 줄(B5).
 *
 * 지점(운영처) 2개 이상 employer만 노출한다(노출 여부·데이터 패칭은 부모 create.tsx 담당).
 * 순수 props 표현 컴포넌트 — 상태/훅/비즈니스 로직 없음.
 * 스타일은 그리드 VenueSelector 칩 선례를 따른다(Midnight Craft 토큰 리터럴 클래스만 —
 * 동적 className 의 dark: 유실 방지). a11y: 칩은 button role + selected 상태 전달.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

/** VenueContainer 중 칩 렌더에 필요한 최소 형상(부모가 VenueContainer[]를 그대로 넘겨도 호환). */
export interface VenueOption {
  id: string;
  name: string;
}

export interface VenueSelectChipsProps {
  venues: VenueOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function VenueSelectChips({ venues, selectedId, onSelect }: VenueSelectChipsProps) {
  const handleSelect = useCallback((id: string) => () => onSelect(id), [onSelect]);

  return (
    <View
      testID="venue-select-chip"
      className="border-b border-divider bg-surface-page px-4 py-3 dark:bg-surface"
    >
      <Text className="mb-2 text-xs font-sans-medium text-content-muted">지점 선택</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8, alignItems: 'center' }}
      >
        {venues.map((v) => {
          const selected = v.id === selectedId;
          return (
            <Pressable
              key={v.id}
              onPress={handleSelect(v.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`지점 ${v.name}`}
              className={`mr-2 min-h-[40px] justify-center rounded-full px-4 py-2 ${
                selected
                  ? 'bg-primary-500'
                  : 'border border-divider bg-surface-page dark:bg-surface-elevated'
              }`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  selected ? 'text-content-onGold' : 'text-content-secondary'
                }`}
                numberOfLines={1}
              >
                {v.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

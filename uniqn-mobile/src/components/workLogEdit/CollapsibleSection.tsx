/**
 * CollapsibleSection — 제목 + 한 줄 요약으로 접히는 섹션 (통합 편집 시트 공용)
 *
 * D6: 예정·역할은 **기본 접힘**, 실적은 펼침. 홀덤펍 사장이 마감 후 거의 매일 고치는 것은
 * 실제 출퇴근이고 예정·역할·색은 드물다. 한 시트에 다 펼쳐 두면 자주 쓰는 칸이 스크롤 아래로
 * 밀린다 — 시간순 배치를 유지하면서 빈도 문제를 푸는 것이 이 컴포넌트의 존재 이유다.
 *
 * 🔑 상태를 `accessibilityState.expanded` 로만 표현하지 않는다 — react-native-web 0.21.2 는
 *    이 prop 을 처리하지 않아 웹에서 읽히지 않는다(2026-08-06 실측). 접힘/펼침은 ①자식 렌더
 *    여부 ②요약 줄 ③토글 라벨('펼치기'/'접기') ④셰브론 방향으로 **눈에 보이게** 말한다.
 *    `accessibilityState` 는 네이티브를 위해 함께 달되, 그것만으로 상태를 표현하지 않는다.
 *
 * 🔑 접힘은 스타일 숨김이 아니라 **미렌더**다. 자식이 시각 피커·입력을 품을 수 있어, 숨겨 둔
 *    채 마운트하면 보이지 않는 칸이 포커스를 가져가거나 조용히 값을 바꾼다.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface CollapsibleSectionProps {
  /** 섹션 제목. 토글 접근성 라벨('<title> 펼치기')의 앞부분이기도 하다. */
  title: string;
  /** 접혔을 때 보이는 한 줄 요약. 펼치면 아래 실값과 중복이라 감춘다. */
  summary: string;
  /** 기본 false — D6 의 기본은 접힘이다. 실적 섹션만 true 로 연다. */
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  summary,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = useCallback(() => {
    setExpanded((previous) => !previous);
  }, []);

  const Chevron = expanded ? ChevronUpIcon : ChevronDownIcon;

  return (
    <View className="mb-3 overflow-hidden rounded-lg border border-secondary-200 bg-surface-card dark:border-surface-overlay dark:bg-surface">
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        // 라벨이 현재 상태를 말한다 — 고정 문구('토글')면 음성 제어 사용자가 지금 상태를 모른다.
        accessibilityLabel={`${title} ${expanded ? '접기' : '펼치기'}`}
        accessibilityState={{ expanded }}
        className="flex-row items-center justify-between px-4 py-3 active:opacity-80"
      >
        <Text className="font-sans-medium text-content-primary dark:text-off-white">{title}</Text>
        <View className="ml-2 flex-1 flex-row items-center justify-end">
          {expanded ? null : (
            <Text
              numberOfLines={1}
              className="mr-1 font-sans text-sm text-content-secondary dark:text-secondary-400"
            >
              {summary}
            </Text>
          )}
          <Chevron size={20} color={SECONDARY_PALETTE[500]} />
        </View>
      </Pressable>

      {expanded ? <View className="px-4 pb-4">{children}</View> : null}
    </View>
  );
}

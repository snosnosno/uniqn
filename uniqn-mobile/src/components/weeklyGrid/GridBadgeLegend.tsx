/**
 * GridBadgeLegend — 캘린더 셀 뱃지(!N/+N/✓N) 범례(P0-3)
 *
 * 셀의 압축 단일 뱃지(U2)는 글리프만으로 의미 학습을 강요하므로, 그리드 아래 한 줄 범례로
 * 부족/공고/배치의 뜻을 상시 노출한다. 표시 메타는 GRID_BADGE_META(도메인 SSOT)를 CalendarCell 과
 * 공유 — 셀 뱃지와 범례가 어긋날 수 없다. U1: 글리프+라벨 병기 + 통합 a11y 라벨(색상 단독 금지).
 * 플래그 OFF면 상위(weekly-grid 화면)에서 미노출.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { GRID_BADGE_META, GRID_BADGE_ORDER } from '@/domains/weeklyGrid';

export function GridBadgeLegend() {
  const a11yLabel = `뱃지 범례: ${GRID_BADGE_ORDER.map(
    (kind) => `${GRID_BADGE_META[kind].glyph} 표시는 ${GRID_BADGE_META[kind].label}`
  ).join(', ')}`;

  return (
    <View
      accessible
      accessibilityLabel={a11yLabel}
      className="flex-row items-center justify-end gap-3 px-4 py-0.5"
    >
      {GRID_BADGE_ORDER.map((kind) => {
        const meta = GRID_BADGE_META[kind];
        return (
          <View key={kind} className="flex-row items-center gap-1">
            <Text
              className={`rounded-sm px-1.5 py-0.5 text-micro font-sans-medium ${meta.tokenClass}`}
            >
              {meta.glyph}
            </Text>
            <Text className="text-xs text-content-secondary font-sans">{meta.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default GridBadgeLegend;

/**
 * UNIQN Mobile - 당일 운영 요약 스트립 (M4)
 *
 * @description [근무]·공고 상세 상단에서 "오늘 출근 N/M · 노쇼 K"를 탭 전환 없이 보여준다.
 *              오늘 근무 그룹이 없으면 렌더하지 않는다.
 *              구인자 IA S2 — 정산 대기 배지는 없앴다. 앱은 돈을 보내지 않는다.
 */

import React from 'react';
import { View, Text } from 'react-native';
import type { ConfirmedStaffGroup } from '@/types/confirmedStaff';

export interface TodayOpsStripProps {
  /** 오늘 날짜의 확정 스태프 그룹 (grouped.find(g => g.isToday)) */
  todayGroup?: ConfirmedStaffGroup;
}

export function TodayOpsStrip({ todayGroup }: TodayOpsStripProps) {
  // 오늘 근무가 없으면 스트립 자체를 숨긴다 — 당일 운영 요약이 목적
  if (!todayGroup) {
    return null;
  }

  const total = todayGroup.stats.total;
  // 출근 판정은 check_in_ts(checkInTime) 존재 기준 — status 기준(checked_in 단일)과 달리
  // 이미 퇴근/완료 처리된 인원도 "출근함"으로 집계된다 (핸드오프 권장 정의)
  const attended = todayGroup.staff.filter((staff) => Boolean(staff.checkInTime)).length;
  const noShow = todayGroup.stats.noShow;

  const a11yLabel = [
    `오늘 확정 ${total}명 중 ${attended}명 출근`,
    noShow > 0 ? `노쇼 ${noShow}명` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      className="flex-row items-center gap-2 border-b border-divider bg-surface-card px-4 py-2 dark:bg-surface-elevated"
    >
      <Text className="text-xs font-sans-semibold text-content-muted dark:text-secondary-400">
        오늘
      </Text>

      <View className="rounded-sm bg-success-50 px-2 py-0.5 dark:bg-success-900/30">
        <Text className="text-xs font-sans-medium text-success-700 dark:text-success-300">
          출근 {attended}/{total}
        </Text>
      </View>

      {noShow > 0 ? (
        <View className="rounded-sm bg-error-100 px-2 py-0.5 dark:bg-error-900/30">
          <Text className="text-xs font-sans-medium text-error-600 dark:text-error-400">
            노쇼 {noShow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * 자리 채움 요약 — work_logs 축(좌석) 표기의 단일 소스.
 *
 * @description 공고 화면에는 서로 다른 두 축의 숫자가 함께 산다.
 *   - **applications 축**: 지원자 / 검토 대기 / **확정** — `posting.stats` jsonb 파생.
 *   - **work_logs 축**: 채워진 좌석 — `job_postings.filled_positions` 컬럼(트리거 유지).
 *
 *   두 축은 서로 다른 시점에 갱신되므로 같은 순간에도 값이 다를 수 있다
 *   (`facts.ts:resolveFilledPositions` 가 divergence 를 logger.warn 하는 이유).
 *   그런데 종전에는 허브가 좌석을 "배정 현황", 지원자 화면이 **같은 값을 "확정"** 이라 불러
 *   화면을 옮길 때마다 같은 이름의 숫자가 달라 보였다.
 *
 *   그래서 **"확정"은 applications 축 전용 라벨로 못 박고**, 좌석은 어느 화면에서든
 *   이 컴포넌트가 내는 "자리 N/M 채움" 한 가지 표현만 쓴다.
 *
 * @remarks 컨테이너(배경·보더·여백)는 호출부가 정한다 — 허브는 통계 카드 안, 지원자 화면은
 *   헤더 아래 스트립으로 서로 다른 자리에 놓이기 때문이다. 이 컴포넌트는 **문구와 축**만 고정한다.
 */

import React from 'react';
import { Text, View } from 'react-native';

export interface SeatFillSummaryProps {
  /** 채워진 좌석 수 — work_logs 축(`filledPositions`). applications 의 확정 수를 넘기지 말 것. */
  filled: number;
  /** 총 좌석 수 (`totalPositions`) */
  total: number;
}

/** 좌석 축 라벨 — 화면마다 다른 단어를 쓰지 않도록 여기서만 정의한다. */
export const SEAT_FILL_LABEL = '자리';

export function SeatFillSummary({ filled, total }: SeatFillSummaryProps) {
  return (
    <View
      className="flex-row items-center justify-center"
      // 그룹핑이 없으면 스크린리더가 숫자와 라벨을 따로 읽어 "3", "5" 처럼 짝이 끊긴 채 들린다.
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${total}자리 중 ${filled}자리 채움`}
    >
      <Text className="mr-1.5 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
        {SEAT_FILL_LABEL}
      </Text>
      <Text className="text-base font-sans-bold text-content-primary dark:text-off-white">
        {filled}
      </Text>
      <Text className="mx-0.5 text-base text-content-placeholder font-sans">/</Text>
      <Text className="text-base font-sans-bold text-content-muted dark:text-secondary-400">
        {total}
      </Text>
      <Text className="ml-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
        채움
      </Text>
    </View>
  );
}

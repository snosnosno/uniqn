/**
 * AttendanceNotices — 실적 입력에 딸린 총 근무 시간 · 차단 오류 · 익일/장시간 안내
 *
 * 🔴 이 4종은 **폐기될 `WorkTimeEditor` 에만 있던 것**이고 Task 5·6 범위 밖이라 지금 앱
 *    어디에도 없다. 시트가 붙이지 않으면 그대로 기능 후퇴다.
 *
 * 🔑 특히 "출근 == 퇴근" 은 배너가 없으면 **사용자에게 아예 안 보인다.** `previewStatus` 는
 *    checkIn·checkOut 의 존재만 보므로 그 입력에서도 배지는 여전히 '퇴근'으로 뜬다
 *    (`WorkTimeFields.tsx:212-214`). 판정은 있는데 말해 주는 곳이 여기뿐이다.
 *
 * 🔑 색은 삼항으로 고르지 않는다 — 정적 리터럴 className 만 쓰고 배너 종류마다 노드를 나눈다
 *    (NativeWind 는 동적 조립 클래스를 못 본다).
 */
import React from 'react';
import { Text, View } from 'react-native';

import { AlertCircleIcon } from '@/components/icons';
import { STATUS_COLORS } from '@/constants';
import type { AttendanceInsight } from './attendanceInsight';

export interface AttendanceNoticesProps {
  insight: AttendanceInsight;
}

interface NoticeProps {
  /** 아이콘 색. 배너 종류마다 정해진 상태색이라 호출부가 정적으로 넘긴다. */
  iconColor: string;
  /** 배경 className — 정적 리터럴만. */
  containerClassName: string;
  textClassName: string;
  children: string;
}

function Notice({ iconColor, containerClassName, textClassName, children }: NoticeProps) {
  return (
    <View className={`mt-3 flex-row items-center rounded-lg p-3 ${containerClassName}`}>
      <AlertCircleIcon size={16} color={iconColor} />
      <Text className={`ml-2 flex-1 font-sans text-sm ${textClassName}`}>{children}</Text>
    </View>
  );
}

export function AttendanceNotices({ insight }: AttendanceNoticesProps) {
  return (
    <View>
      {/* 총 근무 시간 — 산정 가능할 때만. 계산 못 하는 상태를 '0시간'으로 보여주지 않는다. */}
      {insight.durationLabel ? (
        <View className="mt-3 flex-row items-center justify-between rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
          <Text className="font-sans text-sm text-content-muted dark:text-secondary-400">
            총 근무 시간
          </Text>
          <Text
            testID="work-duration-value"
            className="font-display text-lg text-primary-600 dark:text-primary-400"
          >
            {insight.durationLabel}
          </Text>
        </View>
      ) : null}

      {/* 차단 ① 출근 == 퇴근 */}
      {insight.isEqual ? (
        <Notice
          iconColor={STATUS_COLORS.error}
          containerClassName="bg-error-50 dark:bg-error-900/20"
          textClassName="text-error-600 dark:text-error-400"
        >
          출근과 퇴근 시간이 같아요. 다시 확인해주세요.
        </Notice>
      ) : null}

      {/* 차단 ② 퇴근이 출근보다 이름 — 그대로 저장되면 음수 근무 시간이 된다. */}
      {insight.isReversed ? (
        <Notice
          iconColor={STATUS_COLORS.error}
          containerClassName="bg-error-50 dark:bg-error-900/20"
          textClassName="text-error-600 dark:text-error-400"
        >
          퇴근이 출근보다 이릅니다. 출근 시간을 다시 확인해주세요.
        </Notice>
      ) : null}

      {/* 익일 안내(비차단) — 차단 상태에서는 띄우지 않는다(고칠 것을 두 개로 만들지 않는다). */}
      {insight.isNextDay && !insight.hasBlockingError ? (
        <Notice
          iconColor={STATUS_COLORS.info}
          containerClassName="bg-info-50 dark:bg-info-900/20"
          textClassName="text-info-600 dark:text-info-400"
        >
          익일 퇴근으로 계산돼요.
        </Notice>
      ) : null}

      {/* 12시간 초과(비차단) — 저장은 그대로 가능하다. */}
      {insight.isLongShift ? (
        <Notice
          iconColor={STATUS_COLORS.warning}
          containerClassName="bg-warning-50 dark:bg-warning-900/20"
          textClassName="text-warning-700 dark:text-warning-400"
        >
          {`근무 시간이 ${insight.durationLabel ?? ''}이에요. 맞는지 확인해주세요.`}
        </Notice>
      ) : null}
    </View>
  );
}

/**
 * SlotRoleChips — 현장 직무(StaffRole) 선택 칩 (통합 편집 시트 공용)
 *
 * 🔴 **D7 — 마감된 역할을 차단하지 않는다.** `(마감)` 은 표기일 뿐이고 선택은 열려 있다.
 *    대회 당일 급구처럼 "정원 초과인 걸 알면서 지금 넣어야 하는" 상황이 실재하므로, 정합성보다
 *    현장 진행을 우선한 사용자 결정이다. 서버 `update_work_log_slot` 에도 정원 거부가 없다.
 *    여기에 `disabled` 를 걸면 D7 위반이자 구버전 클라와의 동작 분열이다 — 되살리지 말 것.
 *    (폐기될 `RoleChangeModal` 은 마감 역할을 비활성화했다. D7 이후 그 제약이 풀린다.)
 *
 * 🔑 마감 판정은 `selectPostingRoleAvailability` **하나로만** 한다. `RoleChangeModal.tsx:159-165`
 *    가 쓰던 그 함수라 같은 데이터에서 두 화면의 판정이 갈릴 수 없다. 그 함수는
 *    `remaining = count - filled` 를 계산하므로 정원(`jobPosting`)과 실확정(`filledByRole`)이
 *    **둘 다** 있어야 마감을 안다. 하나라도 없으면 표기를 생략한다 — 진입점이 정원을 계산해
 *    넘길 의무는 없다(설계 §3-2-b).
 *
 * 🔑 선택 상태를 `accessibilityState.selected` 로만 표현하지 않는다 — react-native-web 0.21.2 가
 *    처리하지 않는다(2026-08-06 실측). 색 대비에만 기대지도 않는다(WCAG 1.4.1). 선택된 칩은
 *    체크 표식을 렌더한다.
 */
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { STAFF_ROLES } from '@/constants';
import { selectPostingRoleAvailability } from '@/domains/job-posting';
import type { JobPosting, StaffRole } from '@/types';

export interface SlotRoleChipsProps {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  /**
   * 정원 출처. `filledByRole` 과 **함께** 있어야 마감을 판정할 수 있다 —
   * 정원은 `schedule.requirements[].timeSlots[].roles[].count` 에서만 나온다.
   */
  jobPosting?: JobPosting | null;
  /**
   * 역할키(DB `_posting_role_key`)별 실확정 인원(`aggregateRoleFilledFromSubmap` 결과).
   * 미주입 시 selector 가 dead counter(filled=0)로 떨어져 전 역할이 여유로 보인다 = 마감 표기 생략.
   */
  filledByRole?: Record<string, number>;
  /** 정산 완료 등 서버가 수정을 거부하는 근무 — 마감과는 다른 축이다. */
  readOnly?: boolean;
}

export function SlotRoleChips({
  value,
  onChange,
  jobPosting,
  filledByRole,
  readOnly = false,
}: SlotRoleChipsProps) {
  const roleAvailability = useMemo(
    () =>
      jobPosting
        ? selectPostingRoleAvailability(jobPosting, filledByRole ? { filledByRole } : undefined)
        : undefined,
    [jobPosting, filledByRole]
  );

  /**
   * 마감(remaining 0) 역할키 집합.
   *
   * ⚠️ 공고에 **없는** 역할은 애초에 항목이 없어 이 집합에 들어오지 않는다 — 정원을 모르는 것을
   *    0 으로 단정하면 공고에 안 적힌 역할이 전부 마감으로 보인다.
   * ⚠️ `other` 는 `customRole` 과 짝이라 항목 키가 자유문자(`플로어장` 등)다. 칩은 `other` 하나뿐이라
   *    어느 항목을 뜻하는지 정해지지 않으므로, 이름 붙은 other 는 대응시키지 않는다. 이름 없는
   *    other 항목만 키 `'other'` 로 칩과 1:1 로 만난다.
   */
  const fullRoleKeys = useMemo(
    () =>
      new Set(
        (roleAvailability?.items ?? []).filter((item) => !item.isAvailable).map((item) => item.key)
      ),
    [roleAvailability]
  );

  return (
    <View className="flex-row flex-wrap gap-2">
      {/* STAFF_ROLES 의 key 는 이미 StaffRole 타입이다 — 문자열 분기 없이 그대로 넘긴다.
          (UserRole 의 'staff' 와 같은 글자를 쓰는 값이 있어, 문자열로 갈랐다면 위험한 자리다.) */}
      {STAFF_ROLES.map((option) => {
        const selected = value === option.key;
        const isFull = fullRoleKeys.has(option.key);

        return (
          <Pressable
            key={option.key}
            testID={`role-chip-${option.key}`}
            // 🔴 isFull 은 여기에 절대 들어오지 않는다 (D7).
            onPress={() => onChange(option.key)}
            disabled={readOnly}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: readOnly }}
            accessibilityLabel={`역할 ${option.name}${isFull ? ' (마감)' : ''}`}
            className={`flex-row items-center rounded-full px-3 py-2 ${
              selected
                ? 'border border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                : 'border border-divider bg-surface-card'
            }`}
          >
            <Text
              className={`font-sans text-sm ${
                selected
                  ? 'font-sans-semibold text-primary-700 dark:text-primary-300'
                  : 'text-content-secondary dark:text-content-secondary'
              }`}
            >
              {option.icon} {option.name}
            </Text>
            {/* 보이는 표기 = 접근성 라벨의 꼬리. 어긋나면 음성 제어가 이 칩을 못 부른다. */}
            {isFull ? (
              <Text className="ml-1 font-sans text-xs text-warning-700 dark:text-warning-300">
                (마감)
              </Text>
            ) : null}
            {selected ? (
              <Text
                testID={`role-chip-selected-${option.key}`}
                className="ml-1 font-sans-semibold text-sm text-primary-700 dark:text-primary-300"
              >
                ✓
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

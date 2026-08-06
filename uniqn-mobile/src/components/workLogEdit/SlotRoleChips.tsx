/**
 * SlotRoleChips — 현장 직무 선택 칩 (통합 편집 시트 공용)
 *
 * 표준 직무 6종(`StaffRole`) + **공고가 정의한 커스텀 역할명**(`other` + `customRole`)을 한 줄에
 * 편다. 선택 결과는 언제나 `SlotRoleSelection` 한 쌍이라 `{staffRole:'floor', customRole:'바리스타'}`
 * 같은 모순 조합이 **구조적으로 만들어지지 않는다**(서버 판정표 ③⑤ 는 최후 방어선이지 1차선이
 * 아니다).
 *
 * 🔴 **자유 입력 필드를 열지 않는다.** 이름은 반드시 이 목록 안에서만 고른다. 서버는 이름을
 *    받을 준비만 됐고 **어떤 이름이 유효한지는 검사하지 않으므로**, 자유 입력을 열면 공고에
 *    없는 유령 역할이 `work_logs.custom_role` 에 쌓이고 `_posting_role_key` 매칭이 영영 안 된다
 *    (정원·정산 축이 그 키로 맞물린다). 목록의 출처는 둘뿐이다:
 *      ① 공고가 정의한 `other` 역할들 — 폐기된 `settlementCalc.deriveAvailableRoles` 가 하던 펼침
 *      ② **이 행에 지금 저장돼 있는 이름** — 없으면 `기타` 칩을 스치는 순간 이름이 지워진다
 *         (`customRole:null` 이 실제로 실린다). 되돌릴 칩이 화면에 있어야 한다.
 *
 * 🔴 **D7 — 마감된 역할을 차단하지 않는다.** `(마감)` 은 표기일 뿐이고 선택은 열려 있다.
 *    대회 당일 급구처럼 "정원 초과인 걸 알면서 지금 넣어야 하는" 상황이 실재하므로, 정합성보다
 *    현장 진행을 우선한 사용자 결정이다. 서버 `update_work_log_slot` 에도 정원 거부가 없다.
 *    여기에 `disabled` 를 걸면 D7 위반이자 구버전 클라와의 동작 분열이다 — 되살리지 말 것.
 *
 * 🔑 마감 판정은 `selectPostingRoleAvailability` **하나로만** 한다. 폐기된 `RoleChangeModal` 이
 *    쓰던 그 함수라 같은 데이터에서 두 화면의 판정이 갈릴 수 없다. 그 함수는
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

// ============================================================================
// Types
// ============================================================================

/**
 * 역할 선택 = (표준 직무, 기타 이름) **한 쌍**.
 *
 * 🔴 불변식: `role !== 'other'` 이면 `customRole` 은 반드시 `null` 이다. 이 한 줄이 서버가
 *    거부하는 모순 조합(판정표 ③)을 UI 단계에서 없앤다 — 칩은 이 쌍을 통째로만 만들어 낸다.
 */
export interface SlotRoleSelection {
  role: StaffRole;
  /** `other` 역할의 이름. 표준 직무에서는 항상 null. */
  customRole: string | null;
}

export interface SlotRoleChipsProps {
  value: SlotRoleSelection;
  /**
   * 시트를 **열었을 때의** 선택. `value` 가 아니다.
   *
   * 🔑 두 가지에 쓴다: ① 이 행이 원래 맡고 있던 역할에는 `(마감)` 을 붙이지 않는다(아래 참고),
   *    ② 저장된 커스텀 이름을 칩 목록에 반드시 포함시킨다.
   *    `value` 를 쓰면 고르는 칩마다 `(마감)` 이 사라져 표기가 선택을 따라다닌다.
   */
  current: SlotRoleSelection;
  onChange: (next: SlotRoleSelection) => void;
  /**
   * 정원 출처. `filledByRole` 과 **함께** 있어야 마감을 판정할 수 있고, 커스텀 이름 칩의
   * 출처이기도 하다 — 정원은 `schedule.requirements[].timeSlots[].roles[].count` 에서만 나온다.
   *
   * 🔑 **근무표(VenueDayPanel)에서 이 값이 없는 것은 결함이 아니다.** 그 화면은 하루치 슬롯을
   *    venue 축으로 모으고, `VenueDaySlot` 은 **행마다 다른 `jobPostingId`** 를 들고 있다
   *    (`IWorkScheduleRepository.ts:22`). 게다가 컨테이너 직속 배치(`isContainer`)는
   *    `job_posting_id = venue` 라 대응하는 공고 자체가 없다. 즉 그 경로에는 넘길 단일 공고가
   *    **원리적으로 존재하지 않으므로** 마감 표기도, 공고 유래 이름 칩도 뜨지 않는 것이
   *    정상이고, 설계 §3-2-b 가 "진입점이 정원을 계산해 넘길 의무가 없다"고 정한 그 경우다.
   *    (그 화면에서도 **이미 커스텀 역할인 행**은 자기 이름 칩을 갖는다 — `current` 출처.)
   *    "근무표에서만 마감이 안 뜬다"를 버그로 보고 억지로 채워 넣지 말 것.
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

// ============================================================================
// Pure helpers
// ============================================================================

/** 이름 칩의 아이콘. `기타` 칩과 같은 것을 써서 "이것도 기타의 한 갈래"임을 보인다. */
const OTHER_ICON = STAFF_ROLES.find((option) => option.key === 'other')?.icon ?? '✏️';

/**
 * 선택 → 정원 판정용 역할키. `selectPostingRoleAvailability` 의 `item.key` 와 **같은 축**이다
 * (이름 붙은 other 는 이름 문자열, 그 외는 역할 키).
 */
function roleSelectionKey(selection: SlotRoleSelection): string {
  const custom = (selection.customRole ?? '').trim();
  return selection.role === 'other' && custom !== '' ? custom : selection.role;
}

// ============================================================================
// Sub components
// ============================================================================

interface RoleChipProps {
  testID: string;
  /** a11y 라벨 본문. `(마감)` 꼬리는 이 컴포넌트가 붙인다 — 보이는 표기와 어긋나지 않도록. */
  label: string;
  display: string;
  selected: boolean;
  isFull: boolean;
  readOnly: boolean;
  onPress: () => void;
}

function RoleChip({ testID, label, display, selected, isFull, readOnly, onPress }: RoleChipProps) {
  return (
    <Pressable
      testID={testID}
      // 🔴 isFull 은 여기에 절대 들어오지 않는다 (D7).
      onPress={onPress}
      disabled={readOnly}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: readOnly }}
      accessibilityLabel={`${label}${isFull ? ' (마감)' : ''}`}
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
        {display}
      </Text>
      {/* 보이는 표기 = 접근성 라벨의 꼬리. 어긋나면 음성 제어가 이 칩을 못 부른다. */}
      {isFull ? (
        <Text className="ml-1 font-sans text-xs text-warning-700 dark:text-warning-300">
          (마감)
        </Text>
      ) : null}
      {selected ? (
        <Text
          testID={`${testID}-selected`}
          className="ml-1 font-sans-semibold text-sm text-primary-700 dark:text-primary-300"
        >
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

// ============================================================================
// Component
// ============================================================================

export function SlotRoleChips({
  value,
  current,
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
   */
  const fullRoleKeys = useMemo(
    () =>
      new Set(
        (roleAvailability?.items ?? []).filter((item) => !item.isAvailable).map((item) => item.key)
      ),
    [roleAvailability]
  );

  /**
   * 이름 칩 목록(닫힌 목록). 공고가 정의한 `other` 이름들 + 이 행에 저장된 이름.
   *
   * ⚠️ 이름 없는 `other` 항목은 여기 들어오지 않는다 — 그건 표준 `기타` 칩이 1:1 로 맡는다.
   */
  const customRoleNames = useMemo(() => {
    const names: string[] = [];
    const push = (raw: string | null | undefined) => {
      const name = (raw ?? '').trim();
      if (name === '' || names.includes(name)) return;
      names.push(name);
    };

    (roleAvailability?.items ?? []).forEach((item) => {
      if (item.role === 'other') push(item.customRole);
    });
    // 저장돼 있는 이름은 공고에 없어도(공고 수정·수동 추가) 반드시 보인다 — 없으면 되돌릴 수 없다.
    push(current.customRole);

    return names;
  }, [roleAvailability, current.customRole]);

  /**
   * 🔑 **자기가 이미 맡은 역할에는 `(마감)` 을 붙이지 않는다.** `filled` 에는 이 사람이 포함돼
   *    있으므로, 예외가 없으면 정원 1명짜리 역할을 맡은 사람의 **자기 역할 칩에 상시 `(마감)`**
   *    이 붙어 "내가 있어서 마감"이라는 무의미한 표기가 된다. 폐기된 `RoleChangeModal` 이
   *    `role !== currentRoleKey && fullRoleKeys.has(role)` 로 지키던 규칙이다.
   */
  const currentKey = roleSelectionKey(current);
  const isFullKey = (key: string) => key !== currentKey && fullRoleKeys.has(key);

  return (
    <View className="flex-row flex-wrap gap-2">
      {/* STAFF_ROLES 의 key 는 이미 StaffRole 타입이다 — 문자열 분기 없이 그대로 넘긴다.
          (UserRole 의 'staff' 와 같은 글자를 쓰는 값이 있어, 문자열로 갈랐다면 위험한 자리다.) */}
      {STAFF_ROLES.map((option) => (
        <RoleChip
          key={option.key}
          testID={`role-chip-${option.key}`}
          label={`역할 ${option.name}`}
          display={`${option.icon} ${option.name}`}
          // '기타' 칩은 **이름 없는 기타**다. 이름이 붙은 선택은 아래 이름 칩이 표현한다.
          selected={value.role === option.key && value.customRole === null}
          isFull={isFullKey(option.key)}
          readOnly={readOnly}
          onPress={() => onChange({ role: option.key, customRole: null })}
        />
      ))}

      {customRoleNames.map((name) => (
        <RoleChip
          key={`custom-${name}`}
          testID={`role-chip-custom-${name}`}
          // ⚠️ 표준 칩과 접두사를 달리 한다. 공고가 `other` 이름을 '딜러' 로 지을 수 있어
          //    `역할 딜러` 를 쓰면 두 칩의 라벨이 같아진다(스크린리더·음성제어가 못 가른다).
          label={`기타 역할 ${name}`}
          display={`${OTHER_ICON} ${name}`}
          selected={value.role === 'other' && value.customRole === name}
          isFull={isFullKey(name)}
          readOnly={readOnly}
          onPress={() => onChange({ role: 'other', customRole: name })}
        />
      ))}
    </View>
  );
}

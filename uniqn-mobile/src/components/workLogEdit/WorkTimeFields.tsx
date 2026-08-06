/**
 * WorkTimeFields — 출근 예정 · 실제 출근 · 실제 퇴근 3필드 (통합 편집 시트 공용)
 *
 * 🔴 **예정을 실적 칸에 프리필하지 않는다.** 폐지될 WorkTimeEditor 는 실제 출근 기록이 없으면
 *    예정 시각을 출근 칸에 채우고 '미정=false' 로 뒀다(WorkTimeEditor.tsx:114-121).
 *    그래서 퇴근만 고쳐도 예정 값이 check_in_ts 로 함께 저장돼, 손대지 않은 근태 상태가
 *    '출근'으로 뒤집혔다 — 이번 작업의 사용자 신고 원인이다.
 *    복사는 사용자가 [예정대로 기록] 을 **누른 순간에만** 일어난다. 프리필을 되살리지 말 것.
 *
 * 상태 배지는 저장 후가 아니라 **입력 즉시** 바뀐다. 그 값은 서버 `update_work_log_slot`
 * (마이그 20260806140000 §4)의 파생과 같은 식이어야 하므로 `previewStatus` 한 곳에 모았다.
 *
 * 🔑 피커(TimeWheelPicker)는 이 컴포넌트가 렌더하지 않는다. 부모 시트가 SheetModal 의 overlay
 *    로 단일 렌더하는 것이 이 레포 규약이다(중첩 RN Modal = iOS 터치 먹통). 필드는 탭을
 *    `onOpenPicker` 로 올려보내고, 고른 값의 Date 조립은 `applyPickedTime` 이 책임진다.
 *
 * 🔑 상태를 `accessibilityState` 로만 표현하지 않는다 — react-native-web 0.21.2 는 이 prop 을
 *    처리하지 않아 웹에서 읽히지 않는다(2026-08-06 실측). 모든 상태는 눈에 보이는 텍스트다.
 */
import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CheckIcon, ChevronDownIcon, TrashIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { WorkLogStatus } from '@/shared/status';

// ============================================================================
// Types
// ============================================================================

/** 시각 축 3종. 예정은 'HH:mm' 문자열, 실적은 Date 로 서로 다른 모델임에 주의. */
export type WorkTimeFieldKey = 'scheduled' | 'checkIn' | 'checkOut';

export interface WorkTimeFieldsValue {
  /** 출근 예정 시각 'HH:mm'. null = 값 없음(미정 토글과 함께 본다). */
  scheduledStart: string | null;
  /** 예정 '미정' 명시 선택. */
  scheduledUndecided: boolean;
  /** 실제 출근(check_in_ts). null = 기록 없음 — 예정으로 채우지 않는다. */
  checkIn: Date | null;
  /** 실제 퇴근(check_out_ts). null = 기록 없음. */
  checkOut: Date | null;
}

export interface WorkTimeFieldsProps {
  value: WorkTimeFieldsValue;
  /** 시각 → Date 조립 기준일(근무 날짜). 이 컴포넌트는 이 값을 변형하지 않는다. */
  baseDate: Date;
  onChange: (next: WorkTimeFieldsValue) => void;
  readOnly?: boolean;
  /**
   * 수정 전 work_log.status(선택). 넘기면 배지가 서버 불가침 규칙까지 반영한다 —
   * no_show·cancelled 는 시간을 고쳐도 서버가 상태를 바꾸지 않으므로, 안 넘기면 배지가
   * "저장하면 출근이 됩니다"라고 **거짓말**한다.
   */
  currentStatus?: WorkLogStatus;
  /** 시각 피커 열기 요청. 부모 시트가 overlay 로 피커를 렌더한다. */
  onOpenPicker?: (field: WorkTimeFieldKey) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** 기록 없음 표시. '미정'(WorkTimeDisplay 의 표시 기본값)과 달리 편집 칸의 빈 값이다. */
const EMPTY_MARK = '—';

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * 배지 라벨 — 생애주기 3종은 이 시트의 어휘('출근 예정'/'출근'/'퇴근')를 쓰고,
 * 나머지는 앱 공용 라벨과 같은 말을 쓴다(WORK_LOG_STATUS_LABELS).
 */
const STATUS_LABELS: Record<WorkLogStatus, string> = {
  scheduled: '출근 예정',
  checked_in: '출근',
  checked_out: '퇴근',
  completed: '정산 완료',
  cancelled: '취소',
  no_show: '노쇼',
};

/** NativeWind 는 동적 조립 클래스를 못 본다 — 정적 리터럴만 둔다. */
const STATUS_BADGE_CLASS: Record<WorkLogStatus, string> = {
  scheduled: 'bg-secondary-100 dark:bg-surface',
  checked_in: 'bg-success-100 dark:bg-success-700/30',
  checked_out: 'bg-primary-100 dark:bg-primary-900/30',
  completed: 'bg-primary-100 dark:bg-primary-900/30',
  cancelled: 'bg-secondary-100 dark:bg-surface',
  no_show: 'bg-error-100 dark:bg-error-700/30',
};

const STATUS_TEXT_CLASS: Record<WorkLogStatus, string> = {
  scheduled: 'text-secondary-600 dark:text-secondary-400',
  checked_in: 'text-success-700 dark:text-success-300',
  checked_out: 'text-primary-700 dark:text-primary-300',
  completed: 'text-primary-700 dark:text-primary-300',
  cancelled: 'text-secondary-600 dark:text-secondary-400',
  no_show: 'text-error-600 dark:text-error-400',
};

/** 시간 수정이 status 를 건드려도 되는 상태(근태 생애주기). 서버 §4 IN 목록과 같다. */
const LIFECYCLE_STATUSES: readonly WorkLogStatus[] = [
  'scheduled',
  'checked_in',
  'checked_out',
  'completed',
];

// ============================================================================
// Pure helpers
// ============================================================================

/** 로컬 시각 'HH:mm'. WorkTimeDisplay 의 표시 정본과 같은 24시간 표기다. */
function formatClock(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** 두 Date 가 서로 다른 달력 날짜인가. 시각 비교가 아니라 날짜 비교다(WorkTimeDisplay 와 동일). */
function isLaterCalendarDay(target: Date, base: Date): boolean {
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return targetDay.getTime() > baseDay.getTime();
}

/**
 * 'HH:mm' + 기준 날짜 → Date. 24~47시는 익일로 해석한다(피커의 24+ 표기 계약).
 *
 * ⚠️ `baseDate` 를 복제해서 쓴다 — 인자를 변형하면 호출부의 기준일이 조용히 바뀐다.
 */
function composeTime(time: string, baseDate: Date): Date | null {
  const match = time.match(TIME_RE);
  if (!match) return null;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 47 || minutes < 0 || minutes > 59) return null;

  const next = new Date(baseDate.getTime());
  if (hours >= 24) {
    next.setDate(next.getDate() + 1);
    next.setHours(hours - 24, minutes, 0, 0);
  } else {
    next.setHours(hours, minutes, 0, 0);
  }
  return next;
}

/**
 * 피커에서 고른 'HH:mm' 을 값에 얹는다. 새 객체를 돌려주고 인자는 변형하지 않는다.
 *
 * 🔑 퇴근이 출근보다 이르면(예: 출근 22:00 · 퇴근 02:00) **익일로 올린다.** 안 그러면
 *    check_out_ts < check_in_ts 인 음수 근무시간이 저장돼 정산이 틀어진다.
 *    폐지될 WorkTimeEditor 의 `endTimeForSave` 보정과 같은 규칙이다.
 * 🔑 읽을 수 없는 값이면 원본을 그대로 돌려준다 — 파싱 불가 값이 시각인 척 저장되지 않는다.
 */
export function applyPickedTime(
  value: WorkTimeFieldsValue,
  field: WorkTimeFieldKey,
  picked: string,
  baseDate: Date
): WorkTimeFieldsValue {
  if (field === 'scheduled') {
    if (!TIME_RE.test(picked)) return value;
    return { ...value, scheduledStart: picked, scheduledUndecided: false };
  }

  const composed = composeTime(picked, baseDate);
  if (!composed) return value;

  if (field === 'checkIn') {
    return { ...value, checkIn: composed };
  }

  const needsNextDay = value.checkIn !== null && composed.getTime() <= value.checkIn.getTime();
  if (!needsNextDay) {
    return { ...value, checkOut: composed };
  }

  const bumped = new Date(composed.getTime());
  bumped.setDate(bumped.getDate() + 1);
  return { ...value, checkOut: bumped };
}

/**
 * 저장하면 기록될 status 를 미리 구한다.
 *
 * 서버 `update_work_log_slot`(20260806140000 §4)의 파생과 **같은 분기**여야 한다. 규칙 서술의
 * 정본은 `@/repositories/supabase/workLogTimeStatus` 의 `resolveWorkTimeStatus` 다.
 *   · 출근 O + 퇴근 O → checked_out (단 completed 는 강등하지 않는다)
 *   · 출근 O          → checked_in
 *   · 출근 X          → scheduled
 *   · no_show · cancelled 는 불가침 — 시간 수정이 노쇼를 조용히 유급 근무로 뒤집으면 안 된다.
 */
function previewStatus(
  currentStatus: WorkLogStatus | undefined,
  checkIn: Date | null,
  checkOut: Date | null
): WorkLogStatus {
  if (currentStatus && !LIFECYCLE_STATUSES.includes(currentStatus)) {
    return currentStatus;
  }
  if (checkIn && checkOut) {
    return currentStatus === 'completed' ? 'completed' : 'checked_out';
  }
  if (checkIn) return 'checked_in';
  return 'scheduled';
}

// ============================================================================
// Sub components
// ============================================================================

interface TimeRowProps {
  label: string;
  /** 표시 문자열. 값이 없으면 EMPTY_MARK 를 넘긴다. */
  display: string;
  /** 값 표시 노드의 testID — 테스트와 스크린리더가 함께 보는 자리다. */
  testID: string;
  /** 값이 실제로 들어 있는가(비었으면 흐리게 + 피커만 열림). */
  hasValue: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** 값 오른쪽 보조 액션(지우기·예정대로 기록). readOnly 면 부모가 넘기지 않는다. */
  action?: React.ReactNode;
}

function TimeRow({ label, display, testID, hasValue, disabled, onPress, action }: TimeRowProps) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 font-sans-medium text-content-primary dark:text-off-white">
        {label}
      </Text>
      <View className="flex-row items-center">
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${label} 선택`}
          className="flex-1 flex-row items-center rounded-lg border-2 border-secondary-300 bg-surface-card px-4 py-3 dark:border-surface-overlay dark:bg-surface"
        >
          <Text
            testID={testID}
            // 삼항 분기는 CSS var 토큰을 `dark:` 로 한 번 더 쓴다(nativewind-patterns 규칙 1·3).
            // `dark:text-off-white` 는 삼항 안에서 정적 추출이 안 되고(eslint 4d), 토큰 단독은
            // 포탈 렌더 시 루트 캐스케이드를 못 타 라이트 값이 굳는다 — 둘 다 피하는 형태다.
            className={`flex-1 text-base font-sans ${
              hasValue
                ? 'text-content-primary dark:text-content-primary'
                : 'text-content-placeholder dark:text-content-placeholder'
            }`}
          >
            {display}
          </Text>
          {disabled ? null : <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />}
        </Pressable>
        {action}
      </View>
    </View>
  );
}

interface ClearButtonProps {
  label: string;
  onPress: () => void;
}

/** 실적 지우기 — '미정으로 되돌리기'가 아니라 기록 삭제다(서버는 이때 scheduled 로 내린다). */
function ClearButton({ label, onPress }: ClearButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="ml-2 h-11 w-11 items-center justify-center rounded-lg border border-secondary-300 bg-surface-card active:opacity-80 dark:border-surface-overlay dark:bg-surface"
    >
      <TrashIcon size={18} color={SECONDARY_PALETTE[500]} />
    </Pressable>
  );
}

interface UndecidedToggleProps {
  checked: boolean;
  onToggle: (next: boolean) => void;
}

/** 예정 '미정' 토글. 체크 상태를 체크표시 + 문구로 **눈에 보이게** 표현한다(웹 a11y 실측). */
function UndecidedToggle({ checked, onToggle }: UndecidedToggleProps) {
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel="출근 예정 미정"
      className="flex-row items-center active:opacity-80"
    >
      <View
        className={`mr-1.5 h-5 w-5 items-center justify-center rounded border ${
          checked
            ? 'border-primary-600 bg-primary-600'
            : 'border-secondary-300 bg-surface-card dark:border-surface-overlay'
        }`}
      >
        {checked ? <CheckIcon size={14} color="#FFFFFF" /> : null}
      </View>
      <Text className="font-sans text-sm text-content-secondary dark:text-secondary-400">미정</Text>
    </Pressable>
  );
}

// ============================================================================
// Component
// ============================================================================

export function WorkTimeFields({
  value,
  baseDate,
  onChange,
  readOnly = false,
  currentStatus,
  onOpenPicker,
}: WorkTimeFieldsProps) {
  const { scheduledStart, scheduledUndecided, checkIn, checkOut } = value;

  const status = previewStatus(currentStatus, checkIn, checkOut);

  /** 🔴 예정 → 실적 복사는 오직 여기서만 일어난다. */
  const handleCopyScheduled = useCallback(() => {
    if (!scheduledStart) return;
    onChange(applyPickedTime(value, 'checkIn', scheduledStart, baseDate));
  }, [value, scheduledStart, baseDate, onChange]);

  const handleToggleUndecided = useCallback(
    (next: boolean) => {
      onChange({
        ...value,
        scheduledUndecided: next,
        scheduledStart: next ? null : value.scheduledStart,
      });
    },
    [value, onChange]
  );

  const handleClearCheckIn = useCallback(() => {
    onChange({ ...value, checkIn: null });
  }, [value, onChange]);

  const handleClearCheckOut = useCallback(() => {
    onChange({ ...value, checkOut: null });
  }, [value, onChange]);

  // 퇴근이 기준일보다 뒤면 익일 근무다 — 시각만 보면 02:00 이 이른 새벽인지 알 수 없다.
  const checkOutDisplay = checkOut
    ? `${formatClock(checkOut)}${isLaterCalendarDay(checkOut, baseDate) ? ' (익일)' : ''}`
    : EMPTY_MARK;

  const canCopyScheduled = !readOnly && !scheduledUndecided && Boolean(scheduledStart);

  return (
    <View>
      {/* 저장 후 상태 — 입력 즉시 바뀐다 */}
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-sans text-sm text-content-muted dark:text-secondary-400">
          저장 후 상태
        </Text>
        <View
          testID="status-badge"
          className={`rounded-full px-3 py-1 ${STATUS_BADGE_CLASS[status]}`}
        >
          <Text className={`font-sans-medium text-sm ${STATUS_TEXT_CLASS[status]}`}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      {/* 출근 예정 — time_slot. 실적과 다른 축이라 라벨로 분명히 갈라 둔다. */}
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="font-sans-medium text-content-primary dark:text-off-white">출근 예정</Text>
        {readOnly ? null : (
          <UndecidedToggle checked={scheduledUndecided} onToggle={handleToggleUndecided} />
        )}
      </View>
      <TimeRow
        label="출근 예정"
        display={scheduledUndecided ? '미정' : (scheduledStart ?? EMPTY_MARK)}
        testID="scheduled-start-value"
        hasValue={scheduledUndecided || Boolean(scheduledStart)}
        disabled={readOnly || scheduledUndecided}
        onPress={() => onOpenPicker?.('scheduled')}
      />

      {/* 실제 출근 — 🔴 예정으로 채우지 않는다 */}
      <TimeRow
        label="실제 출근"
        display={checkIn ? formatClock(checkIn) : EMPTY_MARK}
        testID="check-in-value"
        hasValue={Boolean(checkIn)}
        disabled={readOnly}
        onPress={() => onOpenPicker?.('checkIn')}
        action={
          !readOnly && checkIn ? (
            <ClearButton label="실제 출근 지우기" onPress={handleClearCheckIn} />
          ) : null
        }
      />
      {canCopyScheduled ? (
        <Pressable
          onPress={handleCopyScheduled}
          accessibilityRole="button"
          accessibilityLabel="예정대로 출근 기록"
          className="-mt-1 mb-3 self-start rounded-lg bg-primary-50 px-3 py-2 active:opacity-80 dark:bg-primary-900/20"
        >
          {/* 보이는 문구 = a11y 라벨. 어긋나면 음성 제어가 이 버튼을 못 부른다. */}
          <Text className="font-sans-medium text-sm text-primary-700 dark:text-primary-300">
            예정대로 출근 기록
          </Text>
        </Pressable>
      ) : null}

      {/* 실제 퇴근 */}
      <TimeRow
        label="실제 퇴근"
        display={checkOutDisplay}
        testID="check-out-value"
        hasValue={Boolean(checkOut)}
        disabled={readOnly}
        onPress={() => onOpenPicker?.('checkOut')}
        action={
          !readOnly && checkOut ? (
            <ClearButton label="실제 퇴근 지우기" onPress={handleClearCheckOut} />
          ) : null
        }
      />
    </View>
  );
}

/**
 * WorkLogEditSheet — 근무 편집 통합 시트 (근무표 · 스태프관리 · 정산 공용)
 *
 * 예정(time_slot) · 실적(check_in_ts/check_out_ts) · 역할 · 색 · 메모를 **한 창에서** 고치고
 * 서버 RPC `update_work_log_slot` 한 번으로 저장한다. 화면마다 다른 편집기가 서로 다른 축을
 * 건드리던 상태를 없애는 것이 이 컴포넌트의 존재 이유다(설계 §2).
 *
 * 🔴 **안 건드린 축은 패치에 키 자체가 없다**(`resolveWorkLogEditPayload`). 한 시트가 되면
 *    "퇴근만 고치려다 역할 칩을 스쳐 역할까지 저장"이 가능해지는데, 역할은 `role_change_history`
 *    가 남는 축이라 오탐 저장이 이력을 오염시킨다(설계 §8-5). 완화책이 아니라 필수 요건이다.
 *
 * 🔴 **정산 완료 건은 전체 읽기 전용**(D4). 현행 `EditSlotSheet` 는 실적 입구만 막고 예정·역할·
 *    색·메모 저장은 통과시켰으므로 이것은 **의도된 축소**다. 서버는 여전히 정산 완료 건의
 *    비실적 축을 받아 주지만(마이그 20260806140000), 어디를 눌러도 같은 답을 주는 쪽을 택했다.
 *
 * 🔴 **예정 축은 접지 않는다 — 설계 문서와 다르지만 이것이 정본이다(사용자 결정 2026-08-06).**
 *    D6·설계 §3 은 `출근 예정` 과 `역할` 을 각각 접으라고 하지만, 예정만 접으려면
 *    `WorkTimeFields` 를 쪼개야 한다(그 컴포넌트가 배지 + 예정 + 실제 출근 + 실제 퇴근을 한
 *    덩어리로 렌더하고 일부만 그리는 prop 이 없다). 쪼개지 않기로 한 이유 둘:
 *      ① D6 이 풀려던 문제는 "자주 쓰는 실적이 스크롤 아래로 밀린다"인데 **예정은 한 줄**이라
 *         실적을 밀어내지 못한다. 밀어내는 건 역할 6칩 + 색 4스와치 + 메모 인풋이고 그건 접힌다.
 *      ② 접힌 예정 안에서는 **[예정대로 기록] 이 안 보이는 값을 복사**하게 된다. 배지도
 *         3축 파생이라 예정과 실적이 같은 화면에 있어야 뜻이 통한다.
 *    ⚠️ 설계 문서만 보고 "구현이 D6 을 안 지켰다"며 되돌리지 말 것 — 문서보다 이 결정이 뒤다.
 *    (접는 것은 **역할(+구분 색)** 과 **배치 메모** 둘뿐이다.)
 *
 * 🔑 **피커는 이 시트가 소유한다.** 이 레포는 중첩 RN Modal 금지(iOS 터치 먹통)라
 *    `WorkTimeFields` 는 탭만 `onOpenPicker` 로 올려보내고, 단일 `TimeWheelPicker` 를
 *    `SheetModal` 의 overlay 로 렌더한다(`EditSlotSheet.tsx:321-333` 검증본과 같은 패턴).
 *
 * 🔑 시각 조립은 `WorkTimeFields` 가 export 한 `applyPickedTime` 만 쓴다. 여기서 따로 조립하면
 *    익일 보정 규칙이 두 벌로 갈라진다.
 *
 * ⚠️ 푸터는 **[취소] [저장] 둘뿐이다.** "빼기"는 진입 맥락의 것이라 각 화면의 카드 액션에
 *    남는다(설계 §3-4) — 여기에 되살리지 말 것.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ModalFooterButtons } from '@/components/ui/ModalFooterButtons';
import { SheetModal } from '@/components/ui/SheetModal';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { STATUS } from '@/constants';
import { DEFAULT_SLOT_START_TIME, MAX_SLOT_MEMO_LENGTH } from '@/domains/workSchedule';
import { settledLockMessage } from '@/domains/settlement';
import { MAX_WORK_TIME_REASON_LENGTH } from '@/domains/staff';
import { isAppError } from '@/errors';
import { useUpdateSlot } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import type { JobPosting, StaffRole } from '@/types';
import type { WorkLogStatus } from '@/shared/status';
import { formatDate, parseDateString } from '@/utils/date';

import { AttendanceNotices } from './AttendanceNotices';
import { CollapsibleSection } from './CollapsibleSection';
import { SlotColorChips } from './SlotColorChips';
import { SlotRoleChips } from './SlotRoleChips';
import {
  WorkTimeFields,
  applyPickedTime,
  type WorkTimeFieldKey,
  type WorkTimeFieldsValue,
} from './WorkTimeFields';
import { deriveAttendanceInsight } from './attendanceInsight';
import { resolveWorkLogEditPayload, type WorkLogEditAxes } from './workLogEditPayload';
import { buildRoleSummary } from './workLogEditSummary';
import type { StoredSlotColorToken } from '@/domains/workSchedule';

// ============================================================================
// Types
// ============================================================================

/**
 * 시트를 열 때의 값. 진입점 3곳이 각자의 자료구조에서 이 모양으로 맞춰 넘긴다.
 *
 * ⚠️ `status` 는 브리프에 없던 항목이지만 **필수**다. `WorkTimeFields` 의 상태 배지는
 *    "저장하면 기록될 status" 를 약속하는데, 근태 상태를 모르면 노쇼·취소 행에서도
 *    "저장하면 출근이 됩니다"라고 거짓말한다(서버는 그 상태를 건드리지 않는다).
 *    근무표 슬롯 RPC 는 status 를 필터 없이 내려주므로 노쇼 행이 실제로 이 시트에 뜬다.
 */
export interface WorkLogEditInitial {
  /** 출근 예정 시각 'HH:mm'. 읽을 수 없는 레거시 값이면 null + `scheduledUnreadable` 로 넘긴다. */
  scheduledStart: string | null;
  /**
   * 저장된 `time_slot` 에 값은 있는데 **읽을 수 없다**(폐지 전 자유 텍스트 `'저녁 6시'` 등).
   *
   * 🔴 이 구분이 없으면 값이 지워지지 않는다. `scheduledStart === null` 만 보면 '미정'으로
   *    초기화되는데, 그러면 미정 체크가 이미 켜진 상태라 dirty 가 안 잡혀 `timeUndecided` 가
   *    패치에 안 실리고, 사용자에게는 **"고쳤는데 그대로"** 로 보인다.
   *    true 면 미정을 켜지 않은 채 시작해, 미정 선택이 **실제 변경**이 되게 한다.
   *
   * 판정 기준은 폐기될 `EditSlotSheet.tsx:147-152` 그대로다(새로 만들지 말 것):
   *   `Boolean(timeSlot) && !isValidSlotStartTime(parseTimeSlotParts(timeSlot).start)`
   */
  scheduledUnreadable?: boolean;
  checkIn: Date | null;
  checkOut: Date | null;
  role: StaffRole;
  /** `other` 역할의 커스텀 이름. **표시 전용** — RPC 패치에 담을 키가 없다(Task 3 확정). */
  customRole?: string | null;
  color: string | null;
  /** 배치 메모. 저장되는 컬럼은 `work_logs.notes` 다(RPC 키 이름만 `memo`). */
  memo: string;
  /** 근무 날짜 'YYYY-MM-DD'. 시각 → Date 조립의 기준일이다. */
  date: string;
  /** 수정 전 근태 상태. 모르면 null — 그때 배지는 아무것도 약속하지 않는다. */
  status: WorkLogStatus | null;
  payrollStatus: string | null;
  staffName: string | null;
}

export interface WorkLogEditSheetProps {
  visible: boolean;
  onClose: () => void;
  workLogId: string;
  initial: WorkLogEditInitial;
  /**
   * 역할 마감 표기의 정원 출처. `filledByRole` 과 **둘 다** 있어야 `(마감)` 이 뜬다.
   *
   * 🔑 근무표 경로에는 넘길 단일 공고가 **원리적으로 없다**(슬롯마다 `jobPostingId` 가 다르고
   *    컨테이너 직속 배치는 대응 공고가 아예 없다). 거기서 마감 표기가 없는 것은 정상이다
   *    (설계 §3-2-b) — 슬롯별 조회로 억지로 채우지 말 것(N+1 이고 그러고도 못 채운다).
   */
  jobPosting?: JobPosting | null;
  filledByRole?: Record<string, number>;
  editedBy?: string;
  onSaved?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** 피커의 시작 위치. 저장되는 기본값이 아니다(§J — 기본값 주입 금지). */
const PICKER_FALLBACK_TIME = DEFAULT_SLOT_START_TIME;

const PICKER_TITLES: Record<WorkTimeFieldKey, string> = {
  scheduled: '출근 예정 시간',
  checkIn: '실제 출근 시간',
  checkOut: '실제 퇴근 시간',
};

const CLOCK_RE = /^(\d{1,2}):(\d{2})$/;

// ============================================================================
// Pure helpers
// ============================================================================

/**
 * 시트 prop → 패치 비교용 축.
 *
 * '미정'은 예정 시각이 없는 상태와 같은 뜻이다(서버 `time_slot IS NULL`) — **단 읽을 수 없는
 * 레거시 값은 예외**다. 그건 "미정"이 아니라 "지워야 할 값"이라 미정을 켜지 않은 채 시작한다.
 */
function toAxes(initial: WorkLogEditInitial): WorkLogEditAxes {
  return {
    scheduledStart: initial.scheduledStart,
    scheduledUndecided: initial.scheduledStart === null && !initial.scheduledUnreadable,
    checkIn: initial.checkIn,
    checkOut: initial.checkOut,
    role: initial.role,
    color: initial.color,
    memo: initial.memo,
  };
}

/** 로컬 시각 'HH:mm'. Date 를 피커 위치로 되돌릴 때만 쓴다. */
function toClock(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function clockToTimeValue(clock: string): TimeValue {
  const match = clock.match(CLOCK_RE);
  if (!match) return clockToTimeValue(PICKER_FALLBACK_TIME);
  return { hour: Number.parseInt(match[1], 10), minute: Number.parseInt(match[2], 10) };
}

function timeValueToClock(value: TimeValue): string {
  return `${value.hour.toString().padStart(2, '0')}:${value.minute.toString().padStart(2, '0')}`;
}

// ============================================================================
// Component
// ============================================================================

export function WorkLogEditSheet({
  visible,
  onClose,
  workLogId,
  initial,
  jobPosting,
  filledByRole,
  editedBy,
  onSaved,
}: WorkLogEditSheetProps) {
  const updateSlot = useUpdateSlot();
  const toastSuccess = useToastStore((state) => state.success);
  const toastError = useToastStore((state) => state.error);

  /**
   * 시트를 **열었을 때의** 값. prop 을 그대로 비교 기준으로 쓰지 않는 이유는, 편집 중에 상위
   * 쿼리가 재조회되면 기준이 발밑에서 바뀌어 "안 건드린 축"이 dirty 로 보이기 때문이다.
   */
  const [baseline, setBaseline] = useState<WorkLogEditAxes>(() => toAxes(initial));
  const [form, setForm] = useState<WorkLogEditAxes>(() => toAxes(initial));
  const [reason, setReason] = useState('');
  const [activePicker, setActivePicker] = useState<WorkTimeFieldKey | null>(null);

  // 열릴 때 · 대상이 바뀔 때만 초기화한다. `initial` 객체 자체를 의존성에 두면 상위가 매 렌더
  // 새 객체를 만드는 순간 setState → 리렌더 → 초기화가 무한히 반복된다.
  useEffect(() => {
    if (!visible) {
      setActivePicker(null);
      return;
    }
    const axes = toAxes(initial);
    setBaseline(axes);
    setForm(axes);
    setReason('');
    setActivePicker(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열림·대상 전환에만 반응한다(위 주석)
  }, [visible, workLogId]);

  /** 정산 완료 = 전체 읽기 전용(D4). 서버가 허용하는 축까지 클라에서 좁힌 결정이다. */
  const readOnly = initial.payrollStatus === STATUS.PAYROLL.COMPLETED;

  const baseDate = useMemo(() => parseDateString(initial.date) ?? new Date(), [initial.date]);

  const insight = useMemo(
    () => deriveAttendanceInsight(form.checkIn, form.checkOut),
    [form.checkIn, form.checkOut]
  );

  const patch = useMemo(
    () => resolveWorkLogEditPayload(baseline, form, { reason, editedBy }),
    [baseline, form, reason, editedBy]
  );

  /**
   * 읽을 수 없는 레거시 예정값이 **아직 해소되지 않았다** — 시각을 고르지도, 미정을 켜지도 않은 상태.
   *
   * 이때 저장을 막는 것은 폐기될 `EditSlotSheet` 의 `timeGateSatisfied`(:220·:306) 를 옮긴 것이다.
   * 안 막으면 사용자가 퇴근만 고쳐 저장한 뒤에도 `'저녁 6시'` 가 시각인 척 남아 있다.
   *
   * ⚠️ 게이트는 **읽을 수 없는 경우에만** 건다. 원래부터 미정인 행은 이미 해소된 상태라
   *    막으면 안 된다(구 시트는 그 경우도 막았지만, 거기선 '미정'이 명시 선택이라 뜻이 달랐다).
   */
  const scheduledUnresolved =
    Boolean(initial.scheduledUnreadable) &&
    !form.scheduledUndecided &&
    form.scheduledStart === null;

  const hasChanges = Object.keys(patch).length > 0;
  const canSave =
    !readOnly &&
    hasChanges &&
    !insight.hasBlockingError &&
    !scheduledUnresolved &&
    !updateSlot.isPending;

  const roleSummary = buildRoleSummary(form.role, initial.customRole ?? null, form.color);

  /** 이름 없는 '기타' 안내 — 커스텀 이름을 여기서 붙일 수 없으니 최소한 결과를 미리 말한다. */
  const showsUnnamedOtherHint =
    form.role === 'other' && (initial.customRole ?? '').trim() === '' && !readOnly;

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  // `WorkTimeFields` 는 시각 4축만 아는 값을 돌려준다 — 역할·색·메모는 그대로 얹어 둔다.
  const handleTimeChange = useCallback((next: WorkTimeFieldsValue) => {
    setForm((current) => ({ ...current, ...next }));
  }, []);

  const handlePickerConfirm = useCallback(
    (value: TimeValue) => {
      const field = activePicker;
      if (!field) return;
      // 🔑 조립은 전부 applyPickedTime 이 한다 — 익일 보정 규칙을 여기서 다시 쓰지 않는다.
      setForm((current) => ({
        ...current,
        ...applyPickedTime(current, field, timeValueToClock(value), baseDate),
      }));
      setActivePicker(null);
    },
    [activePicker, baseDate]
  );

  const handleRoleChange = useCallback((role: StaffRole) => {
    setForm((current) => ({ ...current, role }));
  }, []);

  const handleColorChange = useCallback((color: string) => {
    setForm((current) => ({ ...current, color }));
  }, []);

  const handleMemoChange = useCallback((memo: string) => {
    setForm((current) => ({ ...current, memo }));
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    updateSlot.mutate(
      { workLogId, input: patch },
      {
        onSuccess: () => {
          toastSuccess('근무 정보를 수정했어요.');
          onSaved?.();
          onClose();
        },
        onError: (error) => {
          // 레포·서버 경계가 던진 검증 실패는 구체 안내(userMessage)를 그대로 보여주고,
          // 그 외(네트워크 등)만 일반 재시도 안내로 떨어뜨린다.
          toastError(
            isAppError(error) ? error.userMessage : '수정에 실패했어요. 잠시 후 다시 시도해주세요.'
          );
        },
      }
    );
  }, [canSave, updateSlot, workLogId, patch, toastSuccess, toastError, onSaved, onClose]);

  // --------------------------------------------------------------------------
  // Picker
  // --------------------------------------------------------------------------

  /** 피커가 열릴 위치. 값이 없으면 예정 시각 → 기본 위치 순으로 떨어진다(저장되는 값 아님). */
  const pickerValue = useMemo<TimeValue>(() => {
    const fallback = form.scheduledStart ?? PICKER_FALLBACK_TIME;
    if (activePicker === 'scheduled') return clockToTimeValue(form.scheduledStart ?? fallback);
    if (activePicker === 'checkIn')
      return clockToTimeValue(form.checkIn ? toClock(form.checkIn) : fallback);
    return clockToTimeValue(form.checkOut ? toClock(form.checkOut) : fallback);
  }, [activePicker, form.scheduledStart, form.checkIn, form.checkOut]);

  const pickerOverlay = (
    <TimeWheelPicker
      visible={activePicker !== null}
      value={pickerValue}
      title={activePicker ? PICKER_TITLES[activePicker] : ''}
      // 예정은 서버가 'HH:mm'(00~23)만 받는다. 실적은 24+ 표기로 익일을 직접 찍을 수 있다.
      minHour={0}
      maxHour={activePicker === 'scheduled' ? 23 : 47}
      minuteInterval={15}
      onConfirm={handlePickerConfirm}
      onClose={() => setActivePicker(null)}
      embedded
    />
  );

  // --------------------------------------------------------------------------
  // Footer
  // --------------------------------------------------------------------------

  // 읽기 전용이면 저장 버튼을 **렌더하지 않는다**. 비활성 버튼만 두면 웹에서 "왜 안 눌리지"가
  // 되고(`accessibilityState` 는 react-native-web 0.21.2 에서 무효다), 취소할 편집도 없다.
  const footer = readOnly ? (
    <Button variant="secondary" onPress={onClose} fullWidth accessibilityLabel="닫기">
      닫기
    </Button>
  ) : (
    <ModalFooterButtons
      onCancel={onClose}
      onSubmit={handleSave}
      isLoading={updateSlot.isPending}
      submitText="저장"
      submitDisabled={!canSave}
    />
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="근무 수정"
      footer={footer}
      isLoading={updateSlot.isPending}
      overlay={pickerOverlay}
    >
      <View className="px-4 pb-2">
        {/* 누구의 어느 날 근무인가 — 여러 행을 오가며 고치는 화면이라 대상 확인이 먼저다. */}
        <View className="mb-3">
          <Text className="font-sans-semibold text-base text-content-primary dark:text-off-white">
            {initial.staffName ?? '이름 없음'}
          </Text>
          <Text className="font-sans text-sm text-content-secondary dark:text-secondary-400">
            {formatDate(baseDate)}
          </Text>
        </View>

        {readOnly ? (
          // 읽기 전용의 **눈에 보이는** 신호. 칩의 `disabled`·`accessibilityState` 는 웹에서
          // 무효라 이 문구와 아래 흐린 처리가 사실상 유일한 표현이다.
          <View className="mb-3 rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20">
            <Text
              testID="settled-notice"
              className="font-sans text-sm text-warning-700 dark:text-warning-400"
            >
              {settledLockMessage('수정할')}
            </Text>
          </View>
        ) : null}

        {/* 읽기 전용이면 편집 영역 전체를 흐리게 — 삼항이 고르는 값은 둘 다 정적 리터럴이다. */}
        <View className={readOnly ? 'opacity-60' : 'opacity-100'}>
          {/* 예정 → 실적 순서(시간축 서사). 배지·[예정대로 기록]이 세 축을 함께 봐야 뜻이 통해
              한 덩어리로 둔다 — 접히는 것은 그 아래 역할·메모다. */}
          <WorkTimeFields
            value={form}
            baseDate={baseDate}
            onChange={handleTimeChange}
            readOnly={readOnly}
            currentStatus={initial.status ?? undefined}
            onOpenPicker={setActivePicker}
          />

          {scheduledUnresolved ? (
            /* 폐지 전 자유 텍스트로 저장된 값 — 시각인 척 보여주는 대신 다시 고르게 한다.
               문구는 `EditSlotSheet.tsx:396-398` 그대로다(같은 상황에 두 가지 말을 만들지 않는다). */
            <Text
              testID="scheduled-unreadable-notice"
              className="mt-2 font-sans text-sm text-content-secondary dark:text-secondary-400"
            >
              저장된 출근 시간을 읽을 수 없어요. 시간을 다시 골라주세요.
            </Text>
          ) : null}

          <AttendanceNotices insight={insight} />

          {/* 수정 사유 — 실적·역할을 바꿀 때만 이력에 실린다(색·메모만 바꾸면 보내지 않는다). */}
          <View className="mt-3">
            <Input
              label="수정 사유"
              value={reason}
              onChangeText={setReason}
              placeholder="예: QR 인식 오류로 실제 출근 시간과 다름 (선택)"
              editable={!readOnly}
              maxLength={MAX_WORK_TIME_REASON_LENGTH}
              accessibilityLabel="수정 사유"
            />
          </View>

          <View className="mt-4">
            <CollapsibleSection title="역할" summary={roleSummary}>
              <SlotRoleChips
                value={form.role}
                onChange={handleRoleChange}
                jobPosting={jobPosting}
                filledByRole={filledByRole}
                readOnly={readOnly}
              />

              {showsUnnamedOtherHint ? (
                <Text className="mt-2 font-sans text-xs text-content-muted dark:text-secondary-400">
                  기타 역할의 이름은 여기서 정할 수 없어요. 이름 없이 저장됩니다.
                </Text>
              ) : null}

              <Text className="mb-2 mt-4 font-sans-medium text-content-primary dark:text-off-white">
                구분 색
              </Text>
              <SlotColorChips
                value={form.color as StoredSlotColorToken | null}
                onChange={handleColorChange}
                readOnly={readOnly}
              />
            </CollapsibleSection>

            <CollapsibleSection title="배치 메모" summary={form.memo || '없음'}>
              <Input
                value={form.memo}
                onChangeText={handleMemoChange}
                placeholder="배치 메모(선택)"
                multiline
                editable={!readOnly}
                maxLength={MAX_SLOT_MEMO_LENGTH}
                accessibilityLabel="배치 메모"
              />
            </CollapsibleSection>
          </View>
        </View>
      </View>
    </SheetModal>
  );
}

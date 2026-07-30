/**
 * EditSlotSheet — 근무표 근무 수정 시트(B2)
 *
 * 한 work_log 의 **출근 예정 시각**(time_slot)·역할(StaffRole)·색상(U3 토큰 칩)·메모(S1 XSS)를 편집하고,
 * 같은 창에서 **실제 출퇴근(실적)** 을 함께 보여준다.
 *
 * 시간 모델(§K 정본) — "출근=약속(사전), 퇴근=실적(사후)":
 * - `time_slot` 은 **출근 예정 시각 단일값 'HH:mm'** 또는 미기록(=미정)이다. **예정 종료는 없다.**
 *   예전엔 이 시트만 범위('18:00 - 02:00')를 저장해 앱 전체에서 혼자 다른 형식을 만들고 있었다.
 * - 실제 출퇴근(`check_in_ts`/`check_out_ts`)은 사유·이력이 남고 정산 금액에 직결되므로
 *   전용 편집기(WorkTimeEditor)가 담당한다. 이 시트는 **표시 + 그리로 가는 입구**만 제공한다
 *   (§D — 두 편집기는 중복이 아니다).
 *
 * 저장 안전장치:
 * - 사용자가 시간 축을 건드리지 않으면 시간을 아예 보내지 않는다(resolveSlotTimePayload).
 *   기본값이 진짜 값처럼 저장되던 경로와, 이미 저장된 값이 조용히 지워지는 경로를 함께 막는다.
 * - 시각이 정해진 적 없는 슬롯은 **시간 선택 또는 '미정' 명시 체크 전까지 저장 비활성**이다(결정 4).
 *
 * 모달 구조: SheetModal + overlay 패턴(WorkTimeEditor 검증본 복제).
 * - 시간은 트리거 필드(Pressable)로 표시하고, 탭 시 단일 TimeWheelPicker 를 SheetModal 의
 *   overlay 로 렌더 → 중첩 RN Modal 회피(iOS 터치먹통 #186/#188 방지).
 * - 색상 칩 className 은 SLOT_COLOR_CHIPS 의 **정적 리터럴만** 사용한다(NativeWind 는 동적으로
 *   조립한 클래스를 빌드 시점에 못 보고 dark: 변형이 통째로 유실된다).
 * - 배치 빼기(P0-1): useDeleteSlot 경유(직접추가/지원확정 분기는 서비스 담당), overlay 확인 패널.
 *
 * 플래그 OFF면 상위에서 미노출(이 시트는 weekly_grid_enabled 뒤에서만 사용).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { timeStringToValue, timeValueToString } from './SlotTimeField';
import { StartTimeField } from './StartTimeField';
import { resolveSlotTimePayload } from './editSlotPayload';
import { STAFF_ROLES } from '@/constants';
import { useToastStore } from '@/stores/toastStore';
import { isAppError } from '@/errors';
import { useDeleteSlot, useUpdateSlot } from '@/hooks/workSchedule';
import {
  SLOT_COLOR_CHIPS,
  DEFAULT_SLOT_START_TIME,
  MAX_SLOT_MEMO_LENGTH,
  isValidSlotStartTime,
  parseTimeSlotParts,
  detectSlotConflicts,
  type SlotColorToken,
} from '@/domains/workSchedule';
import { WorkTimeDisplay, type TimeInput } from '@/shared/time';
import type { StaffRole } from '@/types';
import type { VenueDaySlot } from '@/repositories/workSchedule';

/** 실제 출퇴근(실적) 표시용 입력 — 근무표 상위가 확정 스태프에서 해소해 넘긴다. */
export interface SlotAttendance {
  checkInTime?: TimeInput;
  checkOutTime?: TimeInput;
  /** 정산 완료로 잠긴 근무 — 서버가 수정을 거부하므로 입구 대신 사유를 보여준다. */
  settled?: boolean;
}

export interface EditSlotSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 편집 대상 슬롯(없으면 폼 미초기화·저장 비활성화). */
  slot: VenueDaySlot | null;
  /** YYYY-MM-DD 슬롯 날짜(배치 빼기 입력에 필요 — 슬롯 행에는 날짜가 없다). */
  date: string;
  /** 같은 날 형제 슬롯(중복충돌 경고용). */
  siblingSlots?: readonly VenueDaySlot[];
  /** 수정 행위자(운영자) user id. */
  editedBy?: string;
  /**
   * 실제 출퇴근(실적). 미제공이면 실적 섹션을 렌더하지 않는다 —
   * 공고 스팬 슬롯은 근무표 쪽에서 출퇴근 원본을 해소할 수 없어 표시할 값이 없다.
   */
  attendance?: SlotAttendance | null;
  /**
   * 실제 출퇴근 수정 진입(WorkTimeEditor). 미제공이면 입구를 렌더하지 않는다.
   * ⚠️ 구현 측은 **이 시트를 먼저 닫고** 편집기를 열어야 한다 — 중첩 RN Modal 금지.
   */
  onEditAttendance?: () => void;
  /** 저장 성공 콜백(선택). */
  onSaved?: () => void;
}

/** 휠 피커의 초기 위치. 저장되는 기본값이 아니다(§J — 기본값 주입 금지). */
const PICKER_FALLBACK_TIME = DEFAULT_SLOT_START_TIME;

export function EditSlotSheet({
  visible,
  onClose,
  slot,
  date,
  siblingSlots = [],
  editedBy,
  attendance,
  onEditAttendance,
  onSaved,
}: EditSlotSheetProps) {
  const updateSlot = useUpdateSlot();
  const deleteSlot = useDeleteSlot();
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  /** 원본에 저장돼 있던 출근 예정 시각. **정본 형식('HH:mm')으로 읽히는 값만** 인정한다. */
  const [originalStart, setOriginalStart] = useState<string | null>(null);
  /** 원본 time_slot 에 값은 있는데 읽을 수 없는 경우(폐지 전 자유 텍스트 입력의 잔재). */
  const [originalUnreadable, setOriginalUnreadable] = useState(false);
  /** 이번 편집에서 사용자가 고른 시각. 안 골랐으면 null. */
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  /** '미정' 명시 선택(결정 4 — 미정은 명시 선택으로만 도달한다). */
  const [timeUndecided, setTimeUndecided] = useState(false);
  /** 원본에 예정 종료가 저장돼 있었는가(폐지된 범위 데이터) — 안내 문구용. */
  const [hadLegacyEnd, setHadLegacyEnd] = useState(false);

  /**
   * 이번 편집에서 시간 축을 실제로 건드렸는가 — 저장 전송의 유일한 진실원이다.
   *
   * 상태로 들고 있다가 true 로 굳히면, 미정을 체크했다 **다시 해제한** 사용자에게도 dirty 가 남아
   * 원본(레거시 범위)이 조용히 단일값으로 잘린다. 되돌리기가 되돌리기여야 하므로 파생값으로 둔다.
   */
  const timeDirty = pickedTime !== null || timeUndecided;
  /** 화면에 보여줄 출근 예정 시각(고른 값 우선, 없으면 원본). */
  const displayStart = pickedTime ?? originalStart ?? '';

  const [role, setRole] = useState<StaffRole>('dealer');
  const [color, setColor] = useState<SlotColorToken | null>(null);
  const [memo, setMemo] = useState('');

  // 휠 피커 열림 여부. 중첩 Modal 없이 SheetModal overlay 로 단일 렌더.
  const [pickerOpen, setPickerOpen] = useState(false);

  // 배치 빼기 확인 패널(중첩 RN Modal 금지 — 휠 피커와 같은 overlay 패턴).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // 슬롯 변경 시 폼 초기화(재오픈 시 이전 값 잔존 방지).
  useEffect(() => {
    if (!slot) return;
    // 이미 저장된 범위 데이터도 읽어서 시작만 취한다(읽기 하위호환). 종료는 표시하지 않는다.
    const parts = parseTimeSlotParts(slot.timeSlot);
    const readableStart = isValidSlotStartTime(parts.start) ? parts.start.trim() : null;
    setOriginalStart(readableStart);
    // 값은 있는데 못 읽으면 "정해진 시간"으로 인정하지 않는다 — 그대로 두면 파싱 불가 값이
    // 저장 게이트를 통과하고, 트리거에는 '저녁 6시' 같은 원문이 시각인 척 노출된다.
    setOriginalUnreadable(Boolean(slot.timeSlot) && readableStart === null);
    setHadLegacyEnd(Boolean(parts.end));
    setPickedTime(null);
    setTimeUndecided(false);
    setRole((slot.role as StaffRole) ?? 'dealer');
    setColor((slot.color as SlotColorToken | null) ?? null);
    setMemo(slot.notes ?? '');
  }, [slot]);

  // 시트가 닫히면 열려 있던 피커·확인 패널도 닫는다(재오픈 시 잔존 방지).
  useEffect(() => {
    if (!visible) {
      setPickerOpen(false);
      setConfirmingDelete(false);
    }
  }, [visible]);

  /** 저장 시 서버로 보낼 시간 축(안 건드렸으면 빈 객체 — 기존 값 보존). */
  const timePayload = useMemo(
    () => resolveSlotTimePayload({ startTime: pickedTime, timeUndecided, timeDirty }),
    [pickedTime, timeUndecided, timeDirty]
  );

  // 중복충돌 경고(같은 스태프의 출근 예정 겹침). 차단이 아닌 경고.
  const conflicts = useMemo(() => {
    if (!slot) return [];
    // 미정은 비교할 시각 자체가 없다 — 판정 대상에서 뺀다.
    if (timeUndecided) return [];
    // 사용자가 시간을 바꿨으면 바뀐 값으로, 아니면 원본 표기로 판정한다.
    const effectiveTimeSlot = pickedTime ?? slot.timeSlot;
    if (!effectiveTimeSlot) return [];
    return detectSlotConflicts(
      { workLogId: slot.workLogId, staffId: slot.staffId, timeSlot: effectiveTimeSlot },
      siblingSlots.map((s) => ({
        workLogId: s.workLogId,
        staffId: s.staffId,
        timeSlot: s.timeSlot,
      }))
    );
  }, [slot, siblingSlots, pickedTime, timeUndecided]);

  // 실제 출퇴근 표시(SSOT). 예정 시각은 넘기지 않는다 — 이 섹션은 실적만 말해야 한다.
  const attendanceInfo = useMemo(() => {
    if (!attendance) return null;
    return WorkTimeDisplay.getDisplayInfo({
      checkInTime: attendance.checkInTime,
      checkOutTime: attendance.checkOutTime,
      date,
    });
  }, [attendance, date]);

  // 휠 피커 값('HH:mm' → TimeValue). 아직 안 골랐으면 저녁 운영 기준 위치에서 시작한다.
  const pickerValue = useMemo<TimeValue>(
    () => timeStringToValue(displayStart || PICKER_FALLBACK_TIME),
    [displayStart]
  );

  const handlePickerConfirm = useCallback((timeValue: TimeValue) => {
    setPickedTime(timeValueToString(timeValue));
    // 시각을 고르면 '미정'은 자동 해제된다(둘은 배타 관계).
    setTimeUndecided(false);
    setPickerOpen(false);
  }, []);

  /**
   * 저장 게이트: 시각이 정해진 적 없는 슬롯은 시간 선택 또는 '미정' 명시 체크 전까지 저장 불가.
   * 이미 시각이 있는 슬롯은 그 값이 곧 사용자의 선택이므로 게이트를 걸지 않는다.
   */
  const timeGateSatisfied = originalStart !== null || timeDirty;

  const handleSave = () => {
    if (!slot || !timeGateSatisfied) return;
    updateSlot.mutate(
      {
        workLogId: slot.workLogId,
        input: {
          ...timePayload,
          staffRole: role,
          color: color ?? undefined,
          memo,
          editedBy,
        },
      },
      {
        onSuccess: () => {
          toastSuccess('근무 일정을 수정했어요.');
          onSaved?.();
          onClose();
        },
        onError: (error) => {
          // 레포 경계(assertSlotMemo·assertSlotColor·assertSlotStartTime)가 던진 검증 실패는
          // 구체 안내(userMessage)를 표면화하고, 그 외(네트워크 등)는 일반 재시도 안내를 유지한다(L3).
          toastError(
            isAppError(error) ? error.userMessage : '수정에 실패했어요. 잠시 후 다시 시도해주세요.'
          );
        },
      }
    );
  };

  // 배치 빼기: staffId 없는 슬롯은 서비스 정합검증을 통과할 수 없어 진입 자체를 막는다(가드).
  const canDelete = !!slot?.staffId;
  const isBusy = updateSlot.isPending || deleteSlot.isPending;

  const handleDeleteConfirm = useCallback(() => {
    if (!slot?.staffId) return;
    deleteSlot.mutate(
      {
        workLogId: slot.workLogId,
        jobPostingId: slot.jobPostingId,
        staffId: slot.staffId,
        date,
      },
      {
        onSuccess: () => {
          toastSuccess('근무에서 뺐어요.');
          setConfirmingDelete(false);
          onSaved?.();
          onClose();
        },
        onError: () => {
          toastError('근무 빼기에 실패했어요. 잠시 후 다시 시도해주세요.');
        },
      }
    );
  }, [slot, date, deleteSlot, toastSuccess, toastError, onSaved, onClose]);

  // 하단 고정 액션(빼기/취소/저장) — SheetModal footer 로 이전.
  const footerContent = (
    <View className="flex-row gap-3">
      {canDelete ? (
        <View className="flex-1">
          <Button
            variant="danger"
            onPress={() => setConfirmingDelete(true)}
            fullWidth
            disabled={isBusy}
            accessibilityLabel="근무 빼기"
          >
            빼기
          </Button>
        </View>
      ) : null}
      <View className="flex-1">
        <Button variant="secondary" onPress={onClose} fullWidth disabled={isBusy}>
          취소
        </Button>
      </View>
      <View className="flex-1">
        <Button
          variant="primary"
          onPress={handleSave}
          fullWidth
          loading={updateSlot.isPending}
          disabled={!slot || isBusy || !timeGateSatisfied}
        >
          저장
        </Button>
      </View>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="근무 수정"
      footer={footerContent}
      isLoading={isBusy}
      overlay={
        <>
          <TimeWheelPicker
            visible={pickerOpen}
            value={pickerValue}
            title="출근 예정 시간"
            minHour={0}
            maxHour={23}
            minuteInterval={15}
            onConfirm={handlePickerConfirm}
            onClose={() => setPickerOpen(false)}
            embedded
          />
          {/* 배치 빼기 확인 — 중첩 RN Modal 대신 overlay(absoluteFill) 확인 패널 */}
          {confirmingDelete && slot ? (
            <View
              style={StyleSheet.absoluteFill}
              className="items-center justify-center bg-black/50 px-6"
            >
              <View className="w-full max-w-sm rounded-xl bg-surface-card p-5 dark:bg-surface-elevated">
                <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                  근무 빼기
                </Text>
                <Text className="mt-2 text-sm leading-5 text-content-secondary font-sans dark:leading-6">
                  {slot.staffName ?? '이 인원'}님을 이 날 근무에서 뺄까요? 지원으로 확정된 인원은
                  확정이 해제돼요.
                </Text>
                <View className="mt-4 flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      variant="secondary"
                      onPress={() => setConfirmingDelete(false)}
                      fullWidth
                      disabled={deleteSlot.isPending}
                    >
                      취소
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      variant="danger"
                      onPress={handleDeleteConfirm}
                      fullWidth
                      loading={deleteSlot.isPending}
                      accessibilityLabel="근무 빼기 확정"
                    >
                      빼기
                    </Button>
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </>
      }
    >
      <View className="px-4 pb-2">
        {/* 출근 예정 — 단일 시각 + '미정' 토글(인원 추가 시트와 동일 필드) */}
        <StartTimeField
          label="출근 예정"
          value={displayStart}
          isUndefined={timeUndecided}
          onToggleUndefined={setTimeUndecided}
          onPress={() => setPickerOpen(true)}
        />

        {!timeGateSatisfied ? (
          /* 시각이 정해진 적 없는 슬롯 — 기본값을 실제 값처럼 보여주지 않고 무엇을 해야 하는지 말한다. */
          <Text className="mt-2 text-sm text-content-secondary font-sans">
            출근 시간을 고르거나 &apos;미정&apos;을 선택해야 저장할 수 있어요.
          </Text>
        ) : null}

        {originalUnreadable ? (
          /* 폐지 전 자유 텍스트로 저장된 값 — 시각인 척 보여주는 대신 다시 고르게 한다. */
          <Text className="mt-2 text-sm text-content-secondary font-sans">
            저장된 출근 시간을 읽을 수 없어요. 시간을 다시 골라주세요.
          </Text>
        ) : null}

        {hadLegacyEnd ? (
          /* 폐지된 범위 데이터 — 화면에서 종료가 사라진 이유를 밝힌다(조용한 소실 방지). */
          <Text className="mt-2 text-sm text-content-secondary font-sans">
            {attendanceInfo
              ? '예정 종료 시간은 더 이상 쓰지 않아요. 실제 퇴근은 아래 출퇴근 기록으로 남습니다.'
              : /* 공고 스팬 슬롯은 이 시트에 실적 섹션이 없다 — 있지도 않은 '아래'를 가리키면 안 된다. */
                '예정 종료 시간은 더 이상 쓰지 않아요. 실제 퇴근은 출퇴근 기록으로 남습니다.'}
          </Text>
        ) : null}

        {/* 중복충돌 경고(차단 아님) */}
        {conflicts.length > 0 && (
          <View className="mt-2 rounded-lg bg-warning-50 dark:bg-warning-900/30 px-3 py-2">
            <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-300">
              같은 스태프의 출근 시간이 {conflicts.length}건 겹쳐요. 그대로 저장할 수 있어요.
            </Text>
          </View>
        )}

        {/* 실제 출퇴근(실적) — 표시 + 전용 편집기 입구. 예정과 실적을 한 창에서 본다. */}
        {attendanceInfo ? (
          <View className="mt-4 rounded-lg border border-divider px-3 py-3 dark:border-surface-overlay">
            <Text className="font-sans-medium text-content-primary dark:text-off-white">
              실제 출퇴근
            </Text>
            <View className="mt-2 flex-row">
              <View className="flex-1">
                <Text className="text-xs text-content-secondary font-sans">출근</Text>
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  {attendanceInfo.checkIn}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-content-secondary font-sans">퇴근</Text>
                <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                  {attendanceInfo.isEndNextDay
                    ? `익일 ${attendanceInfo.checkOut}`
                    : attendanceInfo.checkOut}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-content-secondary font-sans">근무 시간</Text>
                <Text className="text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
                  {attendanceInfo.duration}
                </Text>
              </View>
            </View>

            {attendance?.settled ? (
              <Text className="mt-2 text-xs text-content-secondary font-sans">
                정산이 완료돼 출퇴근 시간을 수정할 수 없어요.
              </Text>
            ) : onEditAttendance ? (
              <View className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={onEditAttendance}
                  disabled={isBusy}
                  accessibilityLabel="실제 출퇴근 수정"
                >
                  출퇴근 시간 수정
                </Button>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 역할 */}
        <Text className="mt-4 mb-2 font-sans-medium text-content-primary dark:text-off-white">
          역할
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {STAFF_ROLES.map((opt) => {
            const selected = role === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setRole(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`역할 ${opt.name}`}
                className={`flex-row items-center rounded-full px-3 py-2 ${
                  selected
                    ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-500'
                    : 'bg-surface-card border border-divider'
                }`}
              >
                <Text
                  className={`text-sm font-sans ${
                    selected
                      ? 'text-primary-700 dark:text-primary-300 font-sans-semibold'
                      : 'text-content-secondary'
                  }`}
                >
                  {opt.icon} {opt.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 색상(U3 토큰 팔레트 칩) */}
        <Text className="mt-4 mb-2 font-sans-medium text-content-primary dark:text-off-white">
          색상
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {SLOT_COLOR_CHIPS.map((chip) => {
            const selected = color === chip.token;
            return (
              <Pressable
                key={chip.token}
                onPress={() => setColor(chip.token)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`색상 ${chip.label}`}
                className={`h-9 w-9 rounded-full ${chip.swatchClassName} ${
                  selected ? 'border-2 border-content-primary' : 'border border-divider'
                }`}
              />
            );
          })}
        </View>

        {/* 메모(S1 XSS 검증은 레포 경계) */}
        <View className="mt-4">
          <Input
            label="메모"
            value={memo}
            onChangeText={setMemo}
            placeholder="배치 메모(선택)"
            multiline
            maxLength={MAX_SLOT_MEMO_LENGTH}
            accessibilityLabel="배치 메모"
          />
        </View>
      </View>
    </SheetModal>
  );
}

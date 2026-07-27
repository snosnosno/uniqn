/**
 * EditSlotSheet — 운영처 배치 슬롯 편집 시트(B2)
 *
 * 한 work_log 슬롯의 시간(시작/종료)·역할(StaffRole)·색상(U3 토큰 칩)·메모(S1 XSS)를 편집한다.
 * - 시간 변경 시 같은 스태프의 근무 구간 겹침을 경고(차단 아님).
 * - 쓰기는 useUpdateSlot(→ workLogRepository.updateSlot) 경유. 색상 화이트리스트·메모 XSS 검증은 레포 경계.
 * - 배치 빼기(P0-1): useDeleteSlot 경유(직접추가/지원확정 분기는 서비스 담당), overlay 확인 패널.
 * - 색상 칩 className 은 SLOT_COLOR_CHIPS 의 정적 리터럴만 사용(NativeWind dark: 유실 방지).
 *
 * 모달 구조: SheetModal + overlay 패턴(WorkTimeEditor 검증본 복제).
 * - 시작/종료 시간은 트리거 필드(Pressable)로 표시하고, 탭 시 activePicker 를 세팅.
 * - 단일 TimeWheelPicker 를 SheetModal 의 overlay 로 렌더 → 중첩 RN Modal 회피(iOS 터치먹통 #186/#188 방지).
 *
 * 플래그 OFF면 상위에서 미노출(이 시트는 weekly_grid_enabled 뒤에서만 사용).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { TimeTriggerField, timeStringToValue, timeValueToString } from './SlotTimeField';
import { OvernightPreviewBanner } from './OvernightPreviewBanner';
import { resolveSlotTimePayload } from './editSlotPayload';
import { STAFF_ROLES } from '@/constants';
import { useToastStore } from '@/stores/toastStore';
import { isAppError } from '@/errors';
import { useDeleteSlot, useUpdateSlot } from '@/hooks/workSchedule';
import {
  SLOT_COLOR_CHIPS,
  DEFAULT_SLOT_START_TIME,
  MAX_SLOT_MEMO_LENGTH,
  composeTimeSlot,
  parseTimeSlotParts,
  detectSlotConflicts,
  type SlotColorToken,
} from '@/domains/workSchedule';
import { deriveOvernightPreview } from '@/shared/time';
import type { StaffRole } from '@/types';
import type { VenueDaySlot } from '@/repositories/workSchedule';

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
  /** 저장 성공 콜백(선택). */
  onSaved?: () => void;
}

const DEFAULT_START = DEFAULT_SLOT_START_TIME;
const DEFAULT_END = '02:00';

export function EditSlotSheet({
  visible,
  onClose,
  slot,
  date,
  siblingSlots = [],
  editedBy,
  onSaved,
}: EditSlotSheetProps) {
  const updateSlot = useUpdateSlot();
  const deleteSlot = useDeleteSlot();
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [endTime, setEndTime] = useState(DEFAULT_END);
  /**
   * 사용자가 종료 시각을 실제로 정했는가. `endTime` 은 피커 조작을 위해 항상 유효한 값을
   * 들고 있어야 해서 기본값이 들어가는데, 그걸 저장 신호로 오해하면 없던 8시간이 확정된다.
   */
  const [endTimeSet, setEndTimeSet] = useState(false);
  const [role, setRole] = useState<StaffRole>('dealer');
  const [color, setColor] = useState<SlotColorToken | null>(null);
  const [memo, setMemo] = useState('');

  /**
   * 이 슬롯의 시간이 "정해진 값"인지 여부.
   *
   * 시간 미정 슬롯(time_slot 이 비어 있음)을 열면 startTime/endTime 은 화면을 그리기 위한
   * 기본값(18:00~02:00)으로 채워질 뿐 실제 저장된 값이 아니다. 이걸 그대로 저장하면
   * 색상·메모만 고치려던 사용자가 8시간 근무를 확정시켜 정산 금액까지 오염시킨다.
   * 그래서 미정 상태에서는 저장 payload 에 시간을 싣지 않는다(Repository 는 startTime+endTime
   * 둘 다 있을 때만 time_slot 을 갱신하는 부분 업데이트다). 사용자가 피커로 직접 고르면 true.
   */
  const [timeDecided, setTimeDecided] = useState(false);

  // 휠 피커 상태(시작/종료 구분). 중첩 Modal 없이 SheetModal overlay 로 단일 렌더.
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  // 배치 빼기 확인 패널(중첩 RN Modal 금지 — 휠 피커와 같은 overlay 패턴).
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // 슬롯 변경 시 폼 초기화(재오픈 시 이전 값 잔존 방지).
  useEffect(() => {
    if (!slot) return;
    const parts = parseTimeSlotParts(slot.timeSlot);
    // 둘 다 파싱될 때만 "정해진 시간". 하나라도 비면 미정으로 두고 기본값은 피커 초기 위치로만 쓴다.
    setTimeDecided(Boolean(parts.start && parts.end));
    setStartTime(parts.start || DEFAULT_START);
    setEndTime(parts.end || DEFAULT_END);
    // 원본에 종료가 없으면(단일 시각·미정 슬롯) 기본값은 피커용 초기값일 뿐 저장 대상이 아니다.
    setEndTimeSet(Boolean(parts.end));
    setRole((slot.role as StaffRole) ?? 'dealer');
    setColor((slot.color as SlotColorToken | null) ?? null);
    setMemo(slot.notes ?? '');
  }, [slot]);

  // 시트가 닫히면 열려 있던 피커·확인 패널도 닫는다(재오픈 시 잔존 방지).
  useEffect(() => {
    if (!visible) {
      setActivePicker(null);
      setConfirmingDelete(false);
    }
  }, [visible]);

  // 중복충돌 경고(같은 스태프의 근무 구간 겹침). 차단이 아닌 경고.
  const conflicts = useMemo(() => {
    if (!slot) return [];
    // 미정 시간은 실제 구간이 아니므로 충돌 판정 대상이 아니다(기본값끼리 겹쳤다고 경고하면 오탐).
    if (!timeDecided) return [];
    return detectSlotConflicts(
      {
        workLogId: slot.workLogId,
        staffId: slot.staffId,
        // 종료 미설정이면 저장 시에도 시간을 안 보내므로 원본 표기로 충돌을 판정한다.
        timeSlot: endTimeSet ? composeTimeSlot(startTime, endTime) : slot.timeSlot,
      },
      siblingSlots.map((s) => ({
        workLogId: s.workLogId,
        staffId: s.staffId,
        timeSlot: s.timeSlot,
      }))
    );
    // timeDecided 필수: 사용자가 기본값과 똑같은 시각을 골라 startTime/endTime 이 안 바뀌는
    // 경우에도 "미정 → 확정" 전환은 일어나므로, 이게 빠지면 충돌 경고가 stale 해진다.
  }, [slot, siblingSlots, startTime, endTime, timeDecided]);

  // 입력 중 익일 여부·근무시간 프리뷰(SSOT 파생). end==start 는 저장 차단.
  const timePreview = useMemo(
    () => deriveOvernightPreview(startTime, endTime),
    [startTime, endTime]
  );

  // 현재 활성 피커의 값/제목
  const activePickerValue = useMemo<TimeValue>(() => {
    const source = activePicker === 'end' ? endTime : startTime;
    return timeStringToValue(source);
  }, [activePicker, startTime, endTime]);

  const activePickerTitle = activePicker === 'end' ? '종료 시간' : '시작 시간';

  // 휠 피커 선택 완료 → 'HH:mm' 로 되돌려 반영
  const handlePickerConfirm = useCallback(
    (timeValue: TimeValue) => {
      const next = timeValueToString(timeValue);
      if (activePicker === 'start') {
        setStartTime(next);
      } else if (activePicker === 'end') {
        setEndTime(next);
        setEndTimeSet(true); // 사용자가 직접 고른 순간부터 저장 대상이 된다
      }
      // 사용자가 직접 고른 순간부터 시간은 "정해진 값" — 이제부터 저장 payload 에 실린다.
      setTimeDecided(true);
      setActivePicker(null);
    },
    [activePicker]
  );

  const handleSave = () => {
    if (!slot) return;
    if (endTimeSet && timePreview.isEqual) return; // 시작==종료는 저장 불가(익일 오해석 방지)
    updateSlot.mutate(
      {
        workLogId: slot.workLogId,
        input: {
          // 종료 미설정이면 시간 축을 통째로 생략한다 — 기본값 주입으로 없던 근무가
          // 확정되던 경로 차단(GRID-1). 레포는 startTime+endTime 동시 제공 시에만 갱신한다.
          // ⚠️ `timeDecided` 로 가르면 안 된다 — 시작만 골라도 true 가 되어 종료 기본값이
          // 그대로 실려 나간다. 저장 축의 진실원은 `endTimeSet` 하나다.
          ...resolveSlotTimePayload({ startTime, endTime, endTimeSet }),
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
          // 레포 경계(assertSlotMemo·assertSlotColor)가 던진 검증 실패(XSS 메모·비허용 색상)는
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
          disabled={!slot || isBusy || (endTimeSet && timePreview.isEqual)}
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
            visible={activePicker !== null}
            value={activePickerValue}
            title={activePickerTitle}
            minHour={0}
            maxHour={23}
            minuteInterval={15}
            onConfirm={handlePickerConfirm}
            onClose={() => setActivePicker(null)}
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
        {/* 시간(시작/종료) */}
        {/* 시간 미정 슬롯은 빈 값('시간 선택')으로 보여준다 — 기본값을 실제 값처럼 보여주면
            사용자가 "이미 18:00~02:00 이구나"로 오해하고 그대로 저장해 근무시간이 확정된다. */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TimeTriggerField
              label="시작"
              value={timeDecided ? startTime : ''}
              onPress={() => setActivePicker('start')}
            />
          </View>
          <View className="flex-1">
            {/* 종료는 `timeDecided` 가 아니라 `endTimeSet` 로 가른다 — 시작만 고른 상태에서
                `timeDecided` 를 쓰면 고른 적 없는 기본값('02:00')이 실제 값처럼 표시된다. */}
            <TimeTriggerField
              label="종료"
              value={endTimeSet ? endTime : ''}
              onPress={() => setActivePicker('end')}
            />
          </View>
        </View>

        {endTimeSet ? (
          /* 익일 프리뷰 / 시작==종료 오류 안내(저장 차단은 위 timePreview.isEqual 가드) */
          <OvernightPreviewBanner startTime={startTime} endTime={endTime} />
        ) : (
          /* 종료 미설정이면 근무 길이를 알 수 없으므로 프리뷰를 띄우지 않는다 — 기본값 기준
             "8시간 근무" 라고 알려주면 사용자가 그걸 사실로 믿는다. 대신 미정 상태임을 말한다. */
          <Text className="mt-2 text-sm text-content-secondary font-sans dark:text-content-secondary">
            근무 시간이 아직 정해지지 않았어요. 시간을 고르지 않으면 미정 그대로 저장돼요.
          </Text>
        )}

        {/* 중복충돌 경고(차단 아님) */}
        {conflicts.length > 0 && (
          <View className="mt-2 rounded-lg bg-warning-50 dark:bg-warning-900/30 px-3 py-2">
            <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-300">
              같은 스태프의 근무 시간이 {conflicts.length}건 겹쳐요. 그대로 저장할 수 있어요.
            </Text>
          </View>
        )}

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

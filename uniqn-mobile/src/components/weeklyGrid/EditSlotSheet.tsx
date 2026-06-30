/**
 * EditSlotSheet — 운영처 배치 슬롯 편집 시트(B2)
 *
 * 한 work_log 슬롯의 시간(시작/종료)·역할(StaffRole)·색상(U3 토큰 칩)·메모(S1 XSS)를 편집한다.
 * - 시간 변경 시 같은 스태프 + 같은 시작시각 중복충돌을 경고(차단 아님).
 * - 쓰기는 useUpdateSlot(→ workLogRepository.updateSlot) 경유. 색상 화이트리스트·메모 XSS 검증은 레포 경계.
 * - 색상 칩 className 은 SLOT_COLOR_CHIPS 의 정적 리터럴만 사용(NativeWind dark: 유실 방지).
 *
 * 모달 구조: SheetModal + overlay 패턴(WorkTimeEditor 검증본 복제).
 * - 시작/종료 시간은 트리거 필드(Pressable)로 표시하고, 탭 시 activePicker 를 세팅.
 * - 단일 TimeWheelPicker 를 SheetModal 의 overlay 로 렌더 → 중첩 RN Modal 회피(iOS 터치먹통 #186/#188 방지).
 *
 * 플래그 OFF면 상위에서 미노출(이 시트는 weekly_grid_enabled 뒤에서만 사용).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { ChevronDownIcon } from '@/components/icons';
import { STAFF_ROLES } from '@/constants';
import { useToastStore } from '@/stores/toastStore';
import { useUpdateSlot } from '@/hooks/weeklyGrid';
import {
  SLOT_COLOR_CHIPS,
  MAX_SLOT_MEMO_LENGTH,
  composeTimeSlot,
  parseTimeSlotParts,
  detectSlotConflicts,
  type SlotColorToken,
} from '@/domains/weeklyGrid';
import type { StaffRole } from '@/types';
import type { VenueDaySlot } from '@/repositories/weeklyGrid';

export interface EditSlotSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 편집 대상 슬롯(없으면 폼 미초기화·저장 비활성화). */
  slot: VenueDaySlot | null;
  /** 같은 날 형제 슬롯(중복충돌 경고용). */
  siblingSlots?: readonly VenueDaySlot[];
  /** 수정 행위자(운영자) user id. */
  editedBy?: string;
  /** 저장 성공 콜백(선택). */
  onSaved?: () => void;
}

const DEFAULT_START = '18:00';
const DEFAULT_END = '02:00';

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** 'HH:mm' → TimeValue{hour,minute}. 이 화면은 0~23 표기만 사용(다음날 24+ 미사용). */
function timeStringToValue(time: string): TimeValue {
  const match = time.match(TIME_RE);
  if (!match) return { hour: 0, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = parseInt(match[2], 10);
  return { hour, minute };
}

/** TimeValue{hour,minute} → 'HH:mm'(0패딩). */
function timeValueToString({ hour, minute }: TimeValue): string {
  const h = hour.toString().padStart(2, '0');
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** 'HH:mm' → '오전/오후 H:mm'(TimePicker formatTimeDisplay 동등 포맷). */
function formatTimeDisplay(time: string): string {
  const match = time.match(TIME_RE);
  if (!match) return time || '시간 선택';
  const hour = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}:${minutes}`;
}

/** 시간 트리거 필드 — 탭 시 휠 피커를 연다(TimePicker 트리거 스타일 동등). */
function TimeTriggerField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View>
      <Text className="mb-2 font-sans-medium text-content-primary dark:text-off-white">
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} 시간 선택`}
        accessibilityHint="탭하여 시간을 선택하세요"
        className="flex-row items-center px-4 py-3 rounded-lg border-2 bg-surface-card border-secondary-300 dark:border-surface-overlay"
      >
        <Text className="flex-1 text-base text-content-primary font-sans">
          {formatTimeDisplay(value)}
        </Text>
        <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />
      </Pressable>
    </View>
  );
}

export function EditSlotSheet({
  visible,
  onClose,
  slot,
  siblingSlots = [],
  editedBy,
  onSaved,
}: EditSlotSheetProps) {
  const updateSlot = useUpdateSlot();
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [endTime, setEndTime] = useState(DEFAULT_END);
  const [role, setRole] = useState<StaffRole>('dealer');
  const [color, setColor] = useState<SlotColorToken | null>(null);
  const [memo, setMemo] = useState('');

  // 휠 피커 상태(시작/종료 구분). 중첩 Modal 없이 SheetModal overlay 로 단일 렌더.
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  // 슬롯 변경 시 폼 초기화(재오픈 시 이전 값 잔존 방지).
  useEffect(() => {
    if (!slot) return;
    const parts = parseTimeSlotParts(slot.timeSlot);
    setStartTime(parts.start || DEFAULT_START);
    setEndTime(parts.end || DEFAULT_END);
    setRole((slot.role as StaffRole) ?? 'dealer');
    setColor((slot.color as SlotColorToken | null) ?? null);
    setMemo(slot.notes ?? '');
  }, [slot]);

  // 시트가 닫히면 열려 있던 피커도 닫는다(재오픈 시 잔존 방지).
  useEffect(() => {
    if (!visible) setActivePicker(null);
  }, [visible]);

  // 중복충돌 경고(같은 스태프 + 같은 시작시각). 차단이 아닌 경고.
  const conflicts = useMemo(() => {
    if (!slot) return [];
    return detectSlotConflicts(
      {
        workLogId: slot.workLogId,
        staffId: slot.staffId,
        timeSlot: composeTimeSlot(startTime, endTime),
      },
      siblingSlots.map((s) => ({
        workLogId: s.workLogId,
        staffId: s.staffId,
        timeSlot: s.timeSlot,
      }))
    );
  }, [slot, siblingSlots, startTime, endTime]);

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
      }
      setActivePicker(null);
    },
    [activePicker]
  );

  const handleSave = () => {
    if (!slot) return;
    updateSlot.mutate(
      {
        workLogId: slot.workLogId,
        input: {
          startTime,
          endTime,
          staffRole: role,
          color: color ?? undefined,
          memo,
          editedBy,
        },
      },
      {
        onSuccess: () => {
          toastSuccess('배치 슬롯을 수정했어요.');
          onSaved?.();
          onClose();
        },
        onError: () => {
          toastError('수정에 실패했어요. 입력값을 확인해주세요.');
        },
      }
    );
  };

  // 하단 고정 액션(취소/저장) — SheetModal footer 로 이전.
  const footerContent = (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <Button variant="secondary" onPress={onClose} fullWidth disabled={updateSlot.isPending}>
          취소
        </Button>
      </View>
      <View className="flex-1">
        <Button
          variant="primary"
          onPress={handleSave}
          fullWidth
          loading={updateSlot.isPending}
          disabled={!slot}
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
      title="배치 편집"
      footer={footerContent}
      isLoading={updateSlot.isPending}
      overlay={
        <TimeWheelPicker
          visible={activePicker !== null}
          value={activePickerValue}
          title={activePickerTitle}
          minHour={0}
          maxHour={23}
          minuteInterval={30}
          onConfirm={handlePickerConfirm}
          onClose={() => setActivePicker(null)}
          embedded
        />
      }
    >
      <View className="px-4 pb-2">
        {/* 시간(시작/종료) */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TimeTriggerField
              label="시작"
              value={startTime}
              onPress={() => setActivePicker('start')}
            />
          </View>
          <View className="flex-1">
            <TimeTriggerField label="종료" value={endTime} onPress={() => setActivePicker('end')} />
          </View>
        </View>

        {/* 중복충돌 경고(차단 아님) */}
        {conflicts.length > 0 && (
          <View className="mt-2 rounded-lg bg-warning-50 dark:bg-warning-900/30 px-3 py-2">
            <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-300">
              같은 스태프가 같은 시작시각에 {conflicts.length}건 더 배치돼 있어요. 그대로 저장할 수
              있어요.
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
                    ? 'bg-primary-100 border border-primary-500'
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

export default EditSlotSheet;

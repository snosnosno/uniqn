/**
 * EditSlotSheet — 운영처 배치 슬롯 편집 시트(B2)
 *
 * 한 work_log 슬롯의 시간(시작/종료)·역할(StaffRole)·색상(U3 토큰 칩)·메모(S1 XSS)를 편집한다.
 * - 시간 변경 시 같은 스태프 + 같은 시작시각 중복충돌을 경고(차단 아님).
 * - 쓰기는 useUpdateSlot(→ workLogRepository.updateSlot) 경유. 색상 화이트리스트·메모 XSS 검증은 레포 경계.
 * - 색상 칩 className 은 SLOT_COLOR_CHIPS 의 정적 리터럴만 사용(NativeWind dark: 유실 방지).
 *
 * 플래그 OFF면 상위에서 미노출(이 시트는 weekly_grid_enabled 뒤에서만 사용).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
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

  return (
    <Modal visible={visible} onClose={onClose} title="배치 편집" size="lg" position="bottom">
      <ScrollView showsVerticalScrollIndicator={false} className="px-1">
        {/* 시간(시작/종료) */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TimePicker label="시작" value={startTime} onChange={setStartTime} />
          </View>
          <View className="flex-1">
            <TimePicker label="종료" value={endTime} onChange={setEndTime} />
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

        {/* 액션 */}
        <View className="mt-6 mb-2 flex-row gap-3">
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
      </ScrollView>
    </Modal>
  );
}

export default EditSlotSheet;

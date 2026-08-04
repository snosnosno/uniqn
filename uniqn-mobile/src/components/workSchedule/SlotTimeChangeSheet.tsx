/**
 * SlotTimeChangeSheet — 공고 슬롯 시간 일괄 변경(3-C)
 *
 * 설계: docs/planning/2026-08-03-3c-posting-time-change-design.md §10
 *
 * 한 시각 묶음(공고 × 역할 × 출근 시각)에 배치된 인원의 출근 예정 시각을 한 번에 옮긴다.
 * 근무 기록만이 아니라 **공고 원문의 정원도 같은 수만큼 함께 이동**한다(사용자 결정 ⑤) —
 * 그래서 "옮겼더니 원래 시간대에 자리가 다시 열려 있는" 일이 생기지 않는다.
 *
 * 화면 구성(2단):
 *   1) 묶음 고르기 — 그 날 배치된 시각×역할 묶음 목록
 *   2) 새 시각 + **대상 고르기** — 기본은 전원 체크, 빼고 싶은 사람만 해제한다(결정 ④)
 *
 * ⚠️ **정원 초과 경고를 하지 않는다.** 정원이 배치를 따라 함께 움직이므로 초과 상황 자체가
 *    생기지 않는다. 보여주는 것은 "옮기고 나면 그 시간대가 몇 명이 되는가" 라는 사실뿐이다.
 *
 * ⚠️ 개별 조정으로 다른 시각이 된 사람은 **자기 시각 묶음에 나타난다.** 원래 어느 슬롯으로
 *    뽑혔는지는 work_logs 가 기억하지 않기 때문이다(설계 §10-1). 18:00 묶음을 열면
 *    지금 18:00 인 사람만 보인다.
 *
 * 모달 구조는 EditSlotSheet 검증본을 따른다 — 시간 피커는 중첩 RN Modal 대신 SheetModal 의
 * overlay 로 렌더한다(iOS 터치먹통 #186/#188 방지).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { timeStringToValue, timeValueToString } from './SlotTimeField';
import { StartTimeField } from './StartTimeField';
import { useToastStore } from '@/stores/toastStore';
import { isAppError } from '@/errors';
import { useUpdatePostingSlotTime } from '@/hooks/workSchedule';
import {
  DEFAULT_SLOT_START_TIME,
  UNDECIDED_SLOT_KEY,
  buildSlotTimeChangeGroups,
  countAtDestination,
  workLogSlotKey,
  type SlotTimeChangeGroup,
} from '@/domains/workSchedule';
import { getRoleDisplayName } from '@/types/unified/role';
import type { VenueDaySlot } from '@/repositories/interfaces/IWorkScheduleRepository';

export interface SlotTimeChangeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** YYYY-MM-DD — 변경 대상 날짜. */
  date: string;
  /** 그 날 근무표 슬롯 전량(취소분 포함 — 이 컴포넌트가 걸러낸다). */
  slots: readonly VenueDaySlot[];
  /** 변경 성공 콜백(선택). */
  onChanged?: () => void;
}

/** 휠 피커의 초기 위치. 저장되는 기본값이 아니다. */
const PICKER_FALLBACK_TIME = DEFAULT_SLOT_START_TIME;

/** 묶음 제목 — "18:00 · 딜러 5명" / "시간 미정 · 바리스타 2명". */
function groupTitle(group: SlotTimeChangeGroup): string {
  const time = group.displayTimeSlot ?? '시간 미정';
  const first = group.members[0];
  const roleLabel = getRoleDisplayName(first?.role ?? '', first?.customRole ?? undefined);
  return `${time} · ${roleLabel} ${group.members.length}명`;
}

/** 인원 표기 — 이름이 없으면 닉네임, 둘 다 없으면 '이름 미상'. */
function memberLabel(slot: VenueDaySlot): string {
  return slot.staffName ?? slot.staffNickname ?? '이름 미상';
}

export function SlotTimeChangeSheet({
  visible,
  onClose,
  date,
  slots,
  onChanged,
}: SlotTimeChangeSheetProps) {
  const mutation = useUpdatePostingSlotTime();
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [timeUndecided, setTimeUndecided] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** 체크 해제된 work_log id 들. **선택된 쪽이 아니라 해제된 쪽을 들고 있는다** — 기본이
   *  전원 체크라, 목록이 갱신돼 새 인원이 들어와도 자동으로 체크된 상태가 된다. */
  const [excludedIds, setExcludedIds] = useState<readonly string[]>([]);

  const groups = useMemo(() => buildSlotTimeChangeGroups(slots), [slots]);
  const group = useMemo(() => groups.find((g) => g.key === groupKey) ?? null, [groups, groupKey]);

  // 시트가 닫히면 전부 초기화한다(재오픈 시 이전 선택 잔존 방지).
  useEffect(() => {
    if (!visible) setGroupKey(null);
  }, [visible]);

  /**
   * 🔴 묶음이 바뀌면 시각·대상 선택을 **반드시** 버린다.
   *
   * '뒤로'로 목록에 돌아갔다가 다른 묶음을 고르면, 앞 묶음에서 고른 시각이 그대로 남아
   * 사용자가 의도하지 않은 시각으로 [n명 변경]을 눌러버릴 수 있다. 화면에는 그 시각이
   * 이미 채워져 보이므로 **본인이 고른 값처럼 읽힌다** — 되돌리기 어려운 조용한 오작동이다.
   * 닫힘(`visible`)만으로 리셋하면 이 경로가 열린 채 남는다.
   */
  useEffect(() => {
    setPickedTime(null);
    setTimeUndecided(false);
    setPickerOpen(false);
    setExcludedIds([]);
  }, [groupKey]);

  const selectedMembers = useMemo(
    () => (group ? group.members.filter((m) => !excludedIds.includes(m.workLogId)) : []),
    [group, excludedIds]
  );

  /** 목적지 슬롯 키. 아직 시간을 안 골랐으면 null. */
  const toSlotKey = useMemo(() => {
    if (timeUndecided) return UNDECIDED_SLOT_KEY;
    return pickedTime ? workLogSlotKey(pickedTime) : null;
  }, [pickedTime, timeUndecided]);

  /** 옮긴 뒤 목적지 시간대 인원 = 지금 있는 사람 + 옮길 사람. */
  const destinationAfter = useMemo(() => {
    if (!group || !toSlotKey) return null;
    const current = countAtDestination(slots, {
      jobPostingId: group.jobPostingId,
      roleKey: group.roleKey,
      slotKey: toSlotKey,
    });
    return { current, after: current + selectedMembers.length };
  }, [group, toSlotKey, slots, selectedMembers.length]);

  const sameSlot = toSlotKey !== null && group !== null && toSlotKey === group.slotKey;
  const canSubmit = group !== null && toSlotKey !== null && !sameSlot && selectedMembers.length > 0;

  const toggleMember = useCallback((workLogId: string) => {
    setExcludedIds((prev) =>
      prev.includes(workLogId) ? prev.filter((id) => id !== workLogId) : [...prev, workLogId]
    );
  }, []);

  const handlePickerConfirm = useCallback((value: TimeValue) => {
    setPickedTime(timeValueToString(value));
    // 시각을 고르면 '미정'은 자동 해제된다(둘은 배타 관계 — 서버 우선순위와 같다).
    setTimeUndecided(false);
    setPickerOpen(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!group || !canSubmit) return;
    mutation.mutate(
      {
        jobPostingId: group.jobPostingId,
        date,
        roleKey: group.roleKey,
        fromSlotKey: group.slotKey,
        workLogIds: selectedMembers.map((m) => m.workLogId),
        ...(timeUndecided ? { timeUndecided: true } : { startTime: pickedTime ?? undefined }),
      },
      {
        onSuccess: (result) => {
          // 부분 성공을 숨기지 않는다 — 지원서 동기화를 건너뛴 건이 있으면 사실대로 알린다.
          if (result.skipped.length > 0) {
            toastSuccess(
              `${result.updated}명의 시간을 변경했어요. ${result.skipped.length}명은 지원서 정보가 맞지 않아 지원 내역은 그대로예요.`
            );
          } else {
            toastSuccess(`${result.updated}명의 출근 시간을 변경했어요.`);
          }
          onChanged?.();
          onClose();
        },
        onError: (error) => {
          toastError(
            isAppError(error)
              ? error.userMessage
              : '시간 변경에 실패했어요. 잠시 후 다시 시도해주세요.'
          );
        },
      }
    );
  }, [
    group,
    canSubmit,
    mutation,
    date,
    selectedMembers,
    timeUndecided,
    pickedTime,
    toastSuccess,
    toastError,
    onChanged,
    onClose,
  ]);

  const footerContent = group ? (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <Button
          variant="secondary"
          onPress={() => setGroupKey(null)}
          fullWidth
          disabled={mutation.isPending}
        >
          뒤로
        </Button>
      </View>
      <View className="flex-1">
        <Button
          variant="primary"
          onPress={handleSubmit}
          fullWidth
          loading={mutation.isPending}
          disabled={!canSubmit || mutation.isPending}
          accessibilityLabel="선택한 인원의 시간 변경"
        >
          {selectedMembers.length > 0 ? `${selectedMembers.length}명 변경` : '변경'}
        </Button>
      </View>
    </View>
  ) : (
    <Button variant="secondary" onPress={onClose} fullWidth>
      닫기
    </Button>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={group ? '시간 변경 · 대상 선택' : '시간 일괄 변경'}
      footer={footerContent}
      isLoading={mutation.isPending}
      overlay={
        <TimeWheelPicker
          visible={pickerOpen}
          value={timeStringToValue(pickedTime ?? group?.displayTimeSlot ?? PICKER_FALLBACK_TIME)}
          title="새 출근 예정 시간"
          minHour={0}
          maxHour={23}
          minuteInterval={15}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerOpen(false)}
          embedded
        />
      }
    >
      <View className="px-4 pb-2">
        {!group ? (
          <>
            <Text className="mb-3 text-sm text-content-secondary font-sans">
              시간을 바꿀 묶음을 고르세요. 같은 시각·같은 역할로 배치된 인원이 함께 묶여 있어요.
            </Text>
            {groups.length === 0 ? (
              <Text className="py-6 text-center text-sm text-content-secondary font-sans">
                이 날 배치된 인원이 없어요.
              </Text>
            ) : (
              groups.map((g) => (
                <Pressable
                  key={g.key}
                  onPress={() => setGroupKey(g.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${groupTitle(g)} 시간 변경`}
                  className="mb-2 rounded-lg border border-divider px-4 py-3 dark:border-surface-overlay"
                >
                  <Text className="font-sans-medium text-content-primary dark:text-off-white">
                    {groupTitle(g)}
                  </Text>
                  <Text className="mt-1 text-xs text-content-secondary font-sans" numberOfLines={1}>
                    {g.members.map(memberLabel).join(', ')}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            <View className="mb-3 rounded-lg bg-surface-card px-3 py-2 dark:bg-surface-elevated">
              <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
                {groupTitle(group)}
              </Text>
            </View>

            <StartTimeField
              label="새 출근 예정"
              value={pickedTime ?? ''}
              isUndefined={timeUndecided}
              onToggleUndefined={setTimeUndecided}
              onPress={() => setPickerOpen(true)}
            />

            {sameSlot ? (
              <Text className="mt-2 text-sm text-content-secondary font-sans">
                지금과 같은 시간이에요. 다른 시간을 골라주세요.
              </Text>
            ) : null}

            {destinationAfter && !sameSlot ? (
              <View className="mt-3 rounded-lg bg-primary-50 px-3 py-2 dark:bg-primary-900/30">
                <Text className="text-sm font-sans text-primary-700 dark:text-primary-300">
                  {timeUndecided ? '시간 미정' : pickedTime} 시간대는 지금{' '}
                  {destinationAfter.current}명이고, 옮기면 {destinationAfter.after}명이 돼요. 공고
                  모집 인원도 함께 옮겨져요.
                </Text>
              </View>
            ) : null}

            <Text className="mt-4 mb-2 font-sans-medium text-content-primary dark:text-off-white">
              대상 ({selectedMembers.length}/{group.members.length})
            </Text>
            {group.members.map((m) => {
              const checked = !excludedIds.includes(m.workLogId);
              return (
                <Pressable
                  key={m.workLogId}
                  onPress={() => toggleMember(m.workLogId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`${memberLabel(m)} 대상 ${checked ? '선택됨' : '해제됨'}`}
                  className="mb-1.5 flex-row items-center rounded-lg border border-divider px-3 py-2.5 dark:border-surface-overlay"
                >
                  <View
                    className={`mr-3 h-5 w-5 items-center justify-center rounded border ${
                      checked ? 'border-primary-500 bg-primary-500' : 'border-divider'
                    }`}
                  >
                    {checked ? (
                      <Text className="text-xs font-sans-semibold text-white">✓</Text>
                    ) : null}
                  </View>
                  <Text className="flex-1 text-sm font-sans text-content-primary dark:text-off-white">
                    {memberLabel(m)}
                  </Text>
                </Pressable>
              );
            })}

            {selectedMembers.length === 0 ? (
              <Text className="mt-2 text-sm text-content-secondary font-sans">
                한 명 이상 선택해야 변경할 수 있어요.
              </Text>
            ) : null}

            <Text className="mt-4 text-xs text-content-muted font-sans dark:text-secondary-400">
              변경한 인원에게 바뀐 시간이 알림으로 전달돼요. 시간을 맞추기 어려운 사람은 취소를
              요청할 수 있어요.
            </Text>
          </>
        )}
      </View>
    </SheetModal>
  );
}

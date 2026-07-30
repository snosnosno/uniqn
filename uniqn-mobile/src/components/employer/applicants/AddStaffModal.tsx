/**
 * UNIQN Mobile - 스태프 직접 추가 모달
 *
 * @description 지원 절차 없이 앱 가입자를 스태프로 직접 추가한다.
 *   1단계: 닉네임 검색 → 가입자 선택
 *   2단계: 근무 날짜/역할/출근 예정 시각 입력 → 추가
 *
 * 백엔드 정합(정원 가드/정원 카운트)은 add_direct_staff RPC가 보장한다.
 *
 * @remarks 시간 입력은 **자유 텍스트가 아니라 휠 피커**다. 예전엔 '예: 18:00~02:00' 플레이스홀더의
 *   자유 입력이라 검증 없이 임의 문자열(범위·오타·한글)이 그대로 `time_slot` 으로 들어갔다 —
 *   같은 컬럼을 읽는 QR 대상 선택·정산·표시가 전부 그 문자열을 파싱하는데도. 이제 형제 경로와
 *   동일하게 `buildAddSlotPayload`(TIME_RE·XSS·날짜 정규화)를 거친다(§K 정본: 출근 예정 단일값).
 *
 * @remarks 날짜 선택과 시간 피커는 SheetModal 의 `overlay`(Modal 루트 렌더)로 띄운다.
 *   부모 SheetModal(RN Modal) 안에서 자체 RN Modal 을 임베드하면 iOS 중첩 Modal 터치 먹통이
 *   발생하므로, absoluteFill 오버레이만 사용한다.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CalendarPicker } from '@/components/ui/CalendarPicker';
import { Loading } from '@/components/ui/Loading';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { ChevronDownIcon, UserPlusIcon, XMarkIcon } from '@/components/icons';
import {
  CandidateRow,
  RoleChips,
  NicknameSearchField,
  SearchErrorNotice,
} from '@/components/staffPicker';
// 시간 저장 규약(§K) SSOT — 근무표 화면 전용이 아니라 플래그 밖 이 경로도 공유하는 프리미티브.
import { StartTimeField } from '@/components/workSchedule/StartTimeField';
import { timeStringToValue, timeValueToString } from '@/components/workSchedule/SlotTimeField';
import { buildAddSlotPayload } from '@/components/workSchedule/addSlotPayload';
import { DEFAULT_SLOT_START_TIME } from '@/domains/workSchedule';
import { useStaffNicknameSearch } from '@/hooks/useStaffNicknameSearch';
import { isAppError, toError } from '@/errors';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { isWeb } from '@/utils/platform';
import type { UserNicknameSearchResult } from '@/repositories';
import type { AddDirectStaffInput } from '@/types';

export interface AddStaffModalProps {
  visible: boolean;
  onClose: () => void;
  jobPostingId: string;
  isSubmitting?: boolean;
  onSubmit: (input: AddDirectStaffInput) => Promise<unknown>;
}

const OTHER_ROLE_KEY = 'other';

/** 휠 피커의 초기 위치. 저장되는 기본값이 아니다 — 입력 칸은 빈 값으로 시작한다(결정 4 · §J). */
const PICKER_FALLBACK_TIME = DEFAULT_SLOT_START_TIME;

export function AddStaffModal({
  visible,
  onClose,
  jobPostingId,
  isSubmitting = false,
  onSubmit,
}: AddStaffModalProps) {
  const {
    results,
    isSearching,
    searched,
    search,
    reset,
    error: searchError,
  } = useStaffNicknameSearch();

  const [nickname, setNickname] = useState('');
  const [selected, setSelected] = useState<UserNicknameSearchResult | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [roleKey, setRoleKey] = useState('');
  const [customRole, setCustomRole] = useState('');
  // 출근 예정 시각('HH:mm'). 프리필 없음 — 고른 값만 저장된다.
  const [startTime, setStartTime] = useState('');
  const [isTimeUndefined, setIsTimeUndefined] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const toastError = useToastStore((s) => s.error);

  const resetAll = useCallback(() => {
    reset();
    setNickname('');
    setSelected(null);
    setDate(null);
    setDateOpen(false);
    setRoleKey('');
    setCustomRole('');
    setStartTime('');
    setIsTimeUndefined(false);
    setTimeOpen(false);
  }, [reset]);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [onClose, resetAll]);

  // 모달이 숨겨지면(어떤 닫기 경로든) 입력·검색결과·선택을 비운다.
  // SheetModal(RNModal) 은 visible 토글만 되고 언마운트되지 않아, 재오픈 시 이전 PII 잔존을 방지.
  useEffect(() => {
    if (!visible) {
      resetAll();
    }
  }, [visible, resetAll]);

  // 날짜 오버레이는 자체 Modal이 없어 Android 하드웨어 백을 가로채지 못한다 →
  // 백이 부모 SheetModal로 전파돼 모달 전체가 닫히는 회귀. 오버레이가 열린 동안
  // 백을 소비해 오버레이만 닫는다. (네이티브 전용, TimeWheelPicker embedded 패턴 모사)
  useEffect(() => {
    if (isWeb || !dateOpen) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setDateOpen(false);
      return true; // 이벤트 소비 → 부모 SheetModal onRequestClose 미발화
    });
    return () => sub.remove();
  }, [dateOpen]);

  const handleSearch = useCallback(() => {
    // 키보드를 내려 하단 footer(취소/추가 버튼)가 키보드 뒤/화면 밖으로 밀리지 않게 한다 (iOS).
    Keyboard.dismiss();
    // 재검색 시 이전 선택을 초기화 — 새 결과에 없는 사람이 그대로 제출되는 것을 방지
    setSelected(null);
    void search(nickname);
  }, [nickname, search]);

  const isCustomRole = roleKey === OTHER_ROLE_KEY;
  // 저장 게이트: 시간을 고르거나 '미정'을 명시 체크해야 추가할 수 있다(결정 4 · §J).
  const timeDecided = isTimeUndefined || startTime !== '';
  const canSubmit =
    !!selected &&
    !!date &&
    !!roleKey &&
    (!isCustomRole || customRole.trim().length > 0) &&
    timeDecided &&
    !isSubmitting;

  // 휠 피커 값. 아직 안 골랐으면 저녁 운영 기준 위치에서 시작(입력 칸은 여전히 빈 값).
  const timePickerValue = useMemo<TimeValue>(
    () => timeStringToValue(startTime || PICKER_FALLBACK_TIME),
    [startTime]
  );

  const handleSubmit = useCallback(async () => {
    if (!selected || !date || !roleKey) {
      return;
    }

    let input: AddDirectStaffInput;
    try {
      // write 경계: 형제 경로(근무표 인원 추가)와 동일한 빌더 — 날짜 정규화(E5)·시각 형식(TIME_RE)·
      // XSS(S1) 검증을 여기서 끝낸다. 검증 실패는 RPC 미호출(fail-closed).
      input = buildAddSlotPayload({
        containerId: jobPostingId,
        staffId: selected.uid,
        date,
        role: roleKey,
        customRole: isCustomRole ? customRole : undefined,
        startTime,
        timeUndefined: isTimeUndefined,
      });
    } catch (error) {
      // 평문 캐스팅은 실제 가드(__isAppError 브랜드 검사)를 우회한다 — 형제 시트와 동일하게
      // isAppError 로 판정하고, 아니면 일반 안내로 물러선다.
      logger.error('스태프 직접 추가 입력 검증 실패', toError(error), { jobPostingId });
      toastError(isAppError(error) ? error.userMessage : '스태프 추가에 실패했습니다.');
      return;
    }

    try {
      await onSubmit(input);
      handleClose();
    } catch {
      // 에러 토스트는 호출측(useConfirmedStaff onError)에서 처리한다. 모달은 유지.
    }
  }, [
    selected,
    date,
    roleKey,
    isCustomRole,
    customRole,
    startTime,
    isTimeUndefined,
    jobPostingId,
    onSubmit,
    handleClose,
    toastError,
  ]);

  // 날짜 선택 오버레이 — SheetModal 루트에 렌더(중첩 Modal 회피).
  // absoluteFill 로 전체 화면을 덮어 터치를 정상 수신한다.
  const dateOverlay = dateOpen ? (
    <View style={StyleSheet.absoluteFill} className="justify-end">
      {/* 백드롭 - 콘텐츠 위의 빈 영역만 터치 가능 */}
      <Pressable className="flex-1 bg-black/50" onPress={() => setDateOpen(false)} />
      {/* 콘텐츠 */}
      <View className="bg-surface-card rounded-t-2xl">
        {/* 헤더 */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-divider">
          <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
            날짜 선택
          </Text>
          <Pressable
            onPress={() => setDateOpen(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <XMarkIcon size={24} color={SECONDARY_PALETTE[500]} />
          </Pressable>
        </View>

        {/* 캘린더 */}
        <View className="px-2 pb-8">
          <CalendarPicker
            value={date}
            onChange={(d) => {
              setDate(d);
              setDateOpen(false);
            }}
          />
        </View>
      </View>
    </View>
  ) : null;

  const footer = (
    <View className="flex-row gap-2">
      <Button variant="outline" onPress={handleClose} fullWidth className="flex-1">
        취소
      </Button>
      <Button
        variant="primary"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={isSubmitting}
        icon={<UserPlusIcon size={18} color="#FFFFFF" />}
        fullWidth
        className="flex-1"
      >
        추가
      </Button>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      title="스태프 추가"
      isLoading={isSubmitting}
      footer={footer}
      overlay={
        <>
          {dateOverlay}
          {/* 시간 피커도 같은 오버레이 계층에 둔다 — 중첩 RN Modal 회피(embedded) */}
          <TimeWheelPicker
            visible={timeOpen}
            value={timePickerValue}
            title="출근 예정 시간"
            minHour={0}
            maxHour={23}
            minuteInterval={15}
            onConfirm={(value) => {
              setStartTime(timeValueToString(value));
              setIsTimeUndefined(false);
              setTimeOpen(false);
            }}
            onClose={() => setTimeOpen(false)}
            embedded
          />
        </>
      }
    >
      <View className="p-5">
        {/* 1단계: 닉네임 검색 */}
        <NicknameSearchField
          nickname={nickname}
          onChangeNickname={setNickname}
          onSearch={handleSearch}
          isSearching={isSearching}
        />

        {/* 검색 결과 */}
        {isSearching ? (
          <View className="items-center py-6">
            <Loading size="small" />
          </View>
        ) : searchError ? (
          <SearchErrorNotice error={searchError} />
        ) : searched && results.length === 0 ? (
          <Text className="py-4 text-center text-sm text-content-secondary font-sans">
            일치하는 가입자를 찾을 수 없습니다.
          </Text>
        ) : (
          results.length > 0 && (
            <View className="mt-3 gap-2">
              {results.map((user) => (
                <CandidateRow
                  key={user.uid}
                  name={user.name}
                  nickname={user.nickname ?? undefined}
                  region={user.region ?? undefined}
                  photoURL={user.photoURL ?? undefined}
                  picked={selected?.uid === user.uid}
                  onPress={() => setSelected(user)}
                />
              ))}
            </View>
          )
        )}

        {/* 2단계: 배정 입력 (가입자 선택 후) */}
        {selected ? (
          <View className="mt-4 gap-3 border-t border-secondary-200 pt-4 dark:border-surface-overlay">
            {/* 근무 날짜 트리거 — 탭하면 SheetModal overlay로 캘린더를 띄운다 */}
            <View>
              <Text className="mb-2 font-sans-medium text-content-primary dark:text-off-white">
                근무 날짜
              </Text>
              <Pressable
                onPress={() => setDateOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="근무 날짜 선택"
                accessibilityHint="탭하여 날짜를 선택하세요"
                className="flex-row items-center px-4 py-3 rounded-lg border-2 bg-surface-card border-secondary-300 dark:border-surface-overlay active:opacity-80"
              >
                <Text
                  className={`flex-1 font-sans ${
                    date
                      ? 'text-base text-content-primary'
                      : 'text-sm text-secondary-400 dark:text-secondary-500'
                  }`}
                >
                  {date ? format(date, 'MM월 dd일 (EEE)', { locale: ko }) : '날짜를 선택하세요'}
                </Text>
                <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />
              </Pressable>
            </View>

            <View>
              <Text className="mb-1.5 text-sm font-sans-medium text-content-secondary">역할</Text>
              <RoleChips value={roleKey} onChange={setRoleKey} />
            </View>

            {isCustomRole ? (
              <Input
                label="역할명 직접 입력"
                value={customRole}
                onChangeText={setCustomRole}
                placeholder="예: 칩 러너"
              />
            ) : null}

            {/* 출근 예정 — 자유 텍스트 부활 금지(피커의 0패딩 'HH:mm' 만 통과) */}
            <StartTimeField
              label="출근 예정"
              value={startTime}
              isUndefined={isTimeUndefined}
              onToggleUndefined={setIsTimeUndefined}
              onPress={() => setTimeOpen(true)}
            />
          </View>
        ) : null}
      </View>
    </SheetModal>
  );
}

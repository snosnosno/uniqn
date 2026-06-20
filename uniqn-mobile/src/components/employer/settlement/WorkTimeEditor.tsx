/**
 * UNIQN Mobile - 근무 시간 수정 컴포넌트
 *
 * @description 구인자가 스태프의 출퇴근 시간을 수정할 때 사용
 * @version 1.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useUserProfile } from '@/hooks/useUserProfile';
import { SheetModal } from '@/components/ui/SheetModal';
import { ModalFooterButtons } from '@/components/ui/ModalFooterButtons';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { AlertCircleIcon } from '@/components/icons';
import { formatDate, parseTimeSlotToDate } from '@/utils/date';
import { TimeInputField } from './TimeInputField';
import {
  parseTimestamp,
  parseTimeInput,
  formatTimeForInput,
  formatEndTimeForInput,
  calculateDuration,
} from './timeEditorUtils';
import type { WorkLog } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface WorkTimeEditorProps {
  workLog: WorkLog | null;
  visible: boolean;
  onClose: () => void;
  onSave: (data: { startTime: Date | null; endTime: Date | null; reason: string }) => void;
  isLoading?: boolean;
}

function hasTimeChanged(nextTime: Date | null, previousTime: Date | null): boolean {
  if (!nextTime && !previousTime) {
    return false;
  }

  if (!nextTime || !previousTime) {
    return true;
  }

  return formatTimeForInput(nextTime) !== formatTimeForInput(previousTime);
}

// ============================================================================
// Component
// ============================================================================

export function WorkTimeEditor({
  workLog,
  visible,
  onClose,
  onSave,
  isLoading = false,
}: WorkTimeEditorProps) {
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');
  const [reason, setReason] = useState('');
  // 미정 상태
  const [isStartTimeUndefined, setIsStartTimeUndefined] = useState(false);
  const [isEndTimeUndefined, setIsEndTimeUndefined] = useState(false);

  // 휠 피커 상태 (출근/퇴근 구분)
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: workLog?.staffId,
    enabled: visible,
    fallbackName: workLog?.staffName,
    fallbackNickname: workLog?.staffNickname,
    fallbackPhotoURL: workLog?.staffPhotoURL,
    fallbackPhotoURLBlurhash: workLog?.staffPhotoURLBlurhash,
  });

  // workLog 변경 시 초기값 설정
  React.useEffect(() => {
    if (!visible) {
      setActivePicker(null);
      return;
    }

    if (workLog) {
      // checkInTime/checkOutTime 필드 확인 (확장 타입)
      const workLogWithCheck = workLog as WorkLog & {
        checkInTime?: unknown;
        checkOutTime?: unknown;
        timeSlot?: string;
      };

      // 기준 날짜 (workLog.date) — 익일 퇴근 표시(24+) 및 예정시간 파싱에 사용
      const base = workLog.date ? parseTimestamp(workLog.date) : new Date();

      // 예정시간(timeSlot) 파싱 — 실제 출퇴근 기록이 없을 때 폴백으로 표시
      // (카드/스케줄/프로필 화면과 동일하게 예정시간을 보여줘 "미정" 불일치 방지)
      const scheduled =
        workLogWithCheck.timeSlot && workLog.date
          ? parseTimeSlotToDate(workLogWithCheck.timeSlot, workLog.date)
          : { startTime: null, endTime: null };

      // 출근 시간 초기화: 실제 기록 > 예정시간 > 미정
      const checkInSource = workLogWithCheck.checkInTime;
      if (checkInSource !== null && checkInSource !== undefined) {
        const start = parseTimestamp(checkInSource);
        setStartTimeStr(formatTimeForInput(start));
        setIsStartTimeUndefined(false);
      } else if (scheduled.startTime) {
        // 예정시간이 있으면 채워서 보여줌(미정 아님). 저장 시 실제 출근으로 기록됨.
        setStartTimeStr(formatTimeForInput(scheduled.startTime));
        setIsStartTimeUndefined(false);
      } else {
        setStartTimeStr('');
        setIsStartTimeUndefined(true);
      }

      // 퇴근 시간 초기화: 실제 기록 > 예정시간 > 미정
      const checkOutSource = workLogWithCheck.checkOutTime;
      if (checkOutSource !== null && checkOutSource !== undefined) {
        const end = parseTimestamp(checkOutSource);
        // 기준 날짜와 비교하여 다음날이면 24+ 형식으로 표시
        setEndTimeStr(formatEndTimeForInput(end, base));
        setIsEndTimeUndefined(false);
      } else if (scheduled.endTime) {
        setEndTimeStr(formatEndTimeForInput(scheduled.endTime, base));
        setIsEndTimeUndefined(false);
      } else {
        setEndTimeStr('');
        setIsEndTimeUndefined(true);
      }

      setReason('');
    }
  }, [visible, workLog]);

  // 파싱된 시간
  const baseDate = useMemo(() => {
    if (!workLog?.date) return new Date();
    return parseTimestamp(workLog.date);
  }, [workLog?.date]);

  const startTime = useMemo(() => {
    if (isStartTimeUndefined) return null;
    return parseTimeInput(startTimeStr, baseDate);
  }, [startTimeStr, baseDate, isStartTimeUndefined]);

  const endTime = useMemo(() => {
    if (isEndTimeUndefined) return null;
    return parseTimeInput(endTimeStr, baseDate);
  }, [endTimeStr, baseDate, isEndTimeUndefined]);

  // 원래 시간 (실제 checkInTime/checkOutTime만 사용, timeSlot 폴백 안 함)
  const originalStartTime = useMemo(() => {
    if (!workLog) return null;
    const workLogWithCheck = workLog as WorkLog & { checkInTime?: unknown };
    const source = workLogWithCheck.checkInTime;
    return source ? parseTimestamp(source) : null;
  }, [workLog]);

  const originalEndTime = useMemo(() => {
    if (!workLog) return null;
    const workLogWithCheck = workLog as WorkLog & { checkOutTime?: unknown };
    const source = workLogWithCheck.checkOutTime;
    return source ? parseTimestamp(source) : null;
  }, [workLog]);

  // 원래 미정 상태 확인 (초기화 로직과 일치해야 함)
  const wasStartTimeUndefined = useMemo(() => {
    if (!workLog) return false;
    const workLogWithCheck = workLog as WorkLog & { checkInTime?: unknown };
    const source = workLogWithCheck.checkInTime;
    // checkInTime이 없으면 미정 (timeSlot 폴백 사용 안 함)
    return !source;
  }, [workLog]);

  const wasEndTimeUndefined = useMemo(() => {
    if (!workLog) return false;
    const workLogWithCheck = workLog as WorkLog & { checkOutTime?: unknown };
    const source = workLogWithCheck.checkOutTime;
    return source === null || source === undefined;
  }, [workLog]);

  // 근무 시간 계산
  const duration = useMemo(() => {
    if (!startTime || !endTime || isStartTimeUndefined || isEndTimeUndefined) {
      return '계산 불가';
    }
    return calculateDuration(startTime, endTime);
  }, [startTime, endTime, isStartTimeUndefined, isEndTimeUndefined]);

  // 변경 여부
  const hasChanges = useMemo(() => {
    // 미정 상태 변경 확인
    if (isStartTimeUndefined !== wasStartTimeUndefined) return true;
    if (isEndTimeUndefined !== wasEndTimeUndefined) return true;

    // 시간 값 변경 확인 (미정이 아닌 경우만)
    if (!isStartTimeUndefined && hasTimeChanged(startTime, originalStartTime)) {
      return true;
    }

    if (!isEndTimeUndefined && hasTimeChanged(endTime, originalEndTime)) {
      return true;
    }

    return false;
  }, [
    startTime,
    endTime,
    originalStartTime,
    originalEndTime,
    isStartTimeUndefined,
    isEndTimeUndefined,
    wasStartTimeUndefined,
    wasEndTimeUndefined,
  ]);

  // 시간 형식 유효성 (미정이면 OK, 아니면 형식 검사)
  const isValidTimeFormat = useMemo(() => {
    const startValid = isStartTimeUndefined || parseTimeInput(startTimeStr, baseDate) !== null;
    const endValid = isEndTimeUndefined || parseTimeInput(endTimeStr, baseDate) !== null;
    return startValid && endValid;
  }, [startTimeStr, endTimeStr, baseDate, isStartTimeUndefined, isEndTimeUndefined]);

  // 시간 순서 유효성 (퇴근 > 출근, 새벽은 25:00 형식으로 입력)
  const isValidTimeOrder = useMemo(() => {
    if (isStartTimeUndefined || isEndTimeUndefined) return true;
    if (!startTime || !endTime) return true;
    return endTime > startTime;
  }, [startTime, endTime, isStartTimeUndefined, isEndTimeUndefined]);

  // 전체 유효성 검사
  const isValid = useMemo(() => {
    return hasChanges && isValidTimeFormat && isValidTimeOrder;
  }, [hasChanges, isValidTimeFormat, isValidTimeOrder]);

  // 저장
  const handleSave = useCallback(() => {
    if (!isValid) return;
    onSave({
      startTime: isStartTimeUndefined ? null : startTime,
      endTime: isEndTimeUndefined ? null : endTime,
      reason: reason.trim(),
    });
  }, [isValid, startTime, endTime, reason, onSave, isStartTimeUndefined, isEndTimeUndefined]);

  // 닫기
  const handleClose = useCallback(() => {
    setReason('');
    setActivePicker(null);
    onClose();
  }, [onClose]);

  const handleStartTimeUndefinedChange = useCallback((nextValue: boolean) => {
    setIsStartTimeUndefined(nextValue);
    if (nextValue) {
      setActivePicker((current) => (current === 'start' ? null : current));
    }
  }, []);

  const handleEndTimeUndefinedChange = useCallback((nextValue: boolean) => {
    setIsEndTimeUndefined(nextValue);
    if (nextValue) {
      setActivePicker((current) => (current === 'end' ? null : current));
    }
  }, []);

  // 휠 피커에서 선택 완료
  const handlePickerConfirm = useCallback(
    (timeValue: TimeValue) => {
      const hourStr = timeValue.hour.toString().padStart(2, '0');
      const minuteStr = timeValue.minute.toString().padStart(2, '0');
      const timeStr = `${hourStr}:${minuteStr}`;

      if (activePicker === 'start') {
        setStartTimeStr(timeStr);
        setIsStartTimeUndefined(false);
      } else if (activePicker === 'end') {
        setEndTimeStr(timeStr);
        setIsEndTimeUndefined(false);
      }
      setActivePicker(null);
    },
    [activePicker]
  );

  // 현재 활성 피커의 값
  const activePickerValue = useMemo((): TimeValue => {
    const timeStr = activePicker === 'start' ? startTimeStr : endTimeStr;
    if (!timeStr) {
      return { hour: 9, minute: 0 };
    }
    const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      return {
        hour: parseInt(match[1], 10),
        minute: parseInt(match[2], 10),
      };
    }
    return { hour: 9, minute: 0 };
  }, [activePicker, startTimeStr, endTimeStr]);

  // 현재 활성 피커의 제목
  const activePickerTitle = activePicker === 'start' ? '출근 시간' : '퇴근 시간';

  if (!workLog) return null;

  if (displayName && workLog.staffName !== displayName) {
    workLog = {
      ...workLog,
      staffName: displayName,
    };
  }

  const workDate = workLog.date ? parseTimestamp(workLog.date) : null;

  // Footer 버튼
  const footerContent = (
    <ModalFooterButtons
      onCancel={handleClose}
      onSubmit={handleSave}
      isLoading={isLoading}
      submitText="저장"
      submitDisabled={!isValid}
    />
  );

  return (
    <>
      <SheetModal
        visible={visible}
        onClose={handleClose}
        title="근무 시간 수정"
        footer={footerContent}
        isLoading={isLoading}
        overlay={
          <TimeWheelPicker
            visible={activePicker !== null}
            value={activePickerValue}
            title={activePickerTitle}
            minuteInterval={15}
            onConfirm={handlePickerConfirm}
            onClose={() => setActivePicker(null)}
            embedded
          />
        }
      >
        <View className="px-4">
          {/* 스태프 정보 */}
          <View className="flex-row items-center py-2 px-3 bg-surface-page dark:bg-surface rounded-lg mb-2">
            {/* 프로필 이미지 */}
            <Avatar
              source={profilePhotoURL}
              name={displayName}
              size="md"
              blurhash={profilePhotoURLBlurhash}
            />
            <View className="ml-3 flex-1">
              {/* 이름(닉네임) */}
              <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
                {workLog.staffName || '이름 없음'}
                {displayName ? '' : workLog.staffNickname ? ` (${workLog.staffNickname})` : ''}
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {workDate ? formatDate(workDate) : '날짜 없음'}
              </Text>
            </View>
          </View>

          {/* 시간 편집 카드 */}
          <Card variant="outlined" padding="md" className="mb-4">
            {/* 출근 시간 */}
            <TimeInputField
              label="출근 시간"
              value={startTimeStr}
              originalTime={originalStartTime}
              iconColor="#B8962E"
              isUndefined={isStartTimeUndefined}
              onUndefinedChange={handleStartTimeUndefinedChange}
              onOpenPicker={() => setActivePicker('start')}
            />

            {/* 퇴근 시간 */}
            <TimeInputField
              label="퇴근 시간"
              value={endTimeStr}
              originalTime={originalEndTime}
              iconColor="#DC2626"
              isUndefined={isEndTimeUndefined}
              onUndefinedChange={handleEndTimeUndefinedChange}
              onOpenPicker={() => setActivePicker('end')}
            />

            {/* 시간 선택 안내 */}
            <View className="flex-row items-start p-3 bg-surface-card dark:bg-surface-dark rounded-lg mb-4">
              <View className="mt-0.5">
                <AlertCircleIcon size={16} color={SECONDARY_PALETTE[500]} />
              </View>
              <Text className="ml-2 text-sm text-content-muted dark:text-secondary-400 font-sans">
                탭하여 시간 선택{'\n'}(24시 이상 = 다음날 새벽)
              </Text>
            </View>

            {/* 시간 순서 경고 */}
            {isValidTimeFormat && !isValidTimeOrder && (
              <View className="flex-row items-center p-3 bg-error-50 dark:bg-error-900/20 rounded-lg mb-4">
                <AlertCircleIcon size={16} color="#DC2626" />
                <Text className="ml-2 text-sm text-error-600 dark:text-error-400 font-sans">
                  퇴근 시간이 출근보다 빨라요. 새벽은 25:00 형식으로 입력하세요.
                </Text>
              </View>
            )}

            {/* 근무 시간 */}
            <View className="flex-row items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                총 근무 시간
              </Text>
              <Text className="text-lg font-display text-primary-600 dark:text-primary-400">
                {duration}
              </Text>
            </View>
          </Card>

          {/* 수정 사유 (선택) */}
          <View className="mb-4">
            <Text className="text-sm font-sans-medium text-content-secondary mb-2">수정 사유</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="수정 사유를 입력하세요 (선택)"
              placeholderTextColor={SECONDARY_PALETTE[400]}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              className="p-3 border border-divider rounded-lg bg-surface-card text-content-primary dark:text-off-white min-h-[60px]"
            />
            <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              예: QR 인식 오류로 실제 출근 시간과 다름
            </Text>
          </View>

          {/* 안내 메시지 */}
          <View className="flex-row items-start p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg mb-4">
            <AlertCircleIcon size={16} color="#B8962E" />
            <Text className="ml-2 text-sm text-primary-700 dark:text-primary-300 flex-1 font-sans">
              시간 수정 기록은 이력으로 저장되며, 해당 스태프에게 알림이 발송됩니다.
            </Text>
          </View>
        </View>
      </SheetModal>
    </>
  );
}

export default WorkTimeEditor;

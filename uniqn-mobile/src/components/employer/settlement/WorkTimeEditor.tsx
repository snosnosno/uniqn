/**
 * UNIQN Mobile - 근무 시간 수정 컴포넌트
 *
 * @description 구인자가 스태프의 출퇴근 시간을 수정할 때 사용
 * @version 1.1.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { SheetModal } from '../../ui/SheetModal';
import { ModalFooterButtons } from '../../ui/ModalFooterButtons';
import { Card } from '../../ui/Card';
import { TimeWheelPicker, type TimeValue } from '../../ui/TimeWheelPicker';
import { AlertCircleIcon } from '../../icons';
import { formatDate, parseTimeSlotToDate } from '@/utils/dateUtils';
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

// 편집 필드 타입 (향후 인라인 편집 시 활용)
// export for future use - suppresses unused warning
export type EditingField = 'startTime' | 'endTime' | null;

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

  // workLog 변경 시 초기값 설정
  React.useEffect(() => {
    if (workLog) {
      // checkInTime/checkOutTime 필드 확인 (확장 타입)
      const workLogWithCheck = workLog as WorkLog & {
        checkInTime?: unknown;
        checkOutTime?: unknown;
        timeSlot?: string;
      };

      // 출근 시간 초기화
      const checkInSource = workLogWithCheck.checkInTime;
      if (checkInSource === null || checkInSource === undefined) {
        // timeSlot에서 기본값 파싱
        if (workLogWithCheck.timeSlot && workLog.date) {
          const { startTime: parsedStart } = parseTimeSlotToDate(
            workLogWithCheck.timeSlot,
            workLog.date
          );
          if (parsedStart) {
            setStartTimeStr(formatTimeForInput(parsedStart));
            setIsStartTimeUndefined(false);
          } else {
            setStartTimeStr('');
            setIsStartTimeUndefined(true);
          }
        } else {
          setStartTimeStr('');
          setIsStartTimeUndefined(true);
        }
      } else {
        const start = parseTimestamp(checkInSource);
        setStartTimeStr(formatTimeForInput(start));
        setIsStartTimeUndefined(false);
      }

      // 퇴근 시간 초기화
      const checkOutSource = workLogWithCheck.checkOutTime;
      if (checkOutSource === null || checkOutSource === undefined) {
        setEndTimeStr('');
        setIsEndTimeUndefined(true);
      } else {
        const end = parseTimestamp(checkOutSource);
        // 기준 날짜 (workLog.date)와 비교하여 다음날이면 24+ 형식으로 표시
        const base = workLog.date ? new Date(workLog.date) : new Date();
        setEndTimeStr(formatEndTimeForInput(end, base));
        setIsEndTimeUndefined(false);
      }

      setReason('');
    }
  }, [workLog]);

  // 파싱된 시간
  const baseDate = useMemo(() => {
    if (!workLog?.date) return new Date();
    return new Date(workLog.date);
  }, [workLog?.date]);

  const startTime = useMemo(() => {
    if (isStartTimeUndefined) return null;
    return parseTimeInput(startTimeStr, baseDate);
  }, [startTimeStr, baseDate, isStartTimeUndefined]);

  const endTime = useMemo(() => {
    if (isEndTimeUndefined) return null;
    return parseTimeInput(endTimeStr, baseDate);
  }, [endTimeStr, baseDate, isEndTimeUndefined]);

  // 원래 시간 (checkInTime/checkOutTime 우선, 없으면 timeSlot에서 파싱)
  const originalStartTime = useMemo(() => {
    if (!workLog) return null;
    const workLogWithCheck = workLog as WorkLog & { checkInTime?: unknown; timeSlot?: string };
    const source = workLogWithCheck.checkInTime;
    if (source) {
      return parseTimestamp(source);
    }
    // timeSlot에서 파싱 (초기화 로직과 일치)
    if (workLogWithCheck.timeSlot && workLog.date) {
      const { startTime } = parseTimeSlotToDate(workLogWithCheck.timeSlot, workLog.date);
      return startTime;
    }
    return null;
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
    const workLogWithCheck = workLog as WorkLog & { checkInTime?: unknown; timeSlot?: string };
    const source = workLogWithCheck.checkInTime;
    if (source) return false; // 출근 시간이 있으면 미정 아님
    // timeSlot에서 파싱 시도 (초기화 로직과 일치)
    if (workLogWithCheck.timeSlot && workLog.date) {
      const { startTime } = parseTimeSlotToDate(workLogWithCheck.timeSlot, workLog.date);
      return !startTime; // 파싱 실패하면 미정
    }
    return true; // source도 없고 timeSlot도 없으면 미정
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
    if (!isStartTimeUndefined && originalStartTime && startTime) {
      if (formatTimeForInput(startTime) !== formatTimeForInput(originalStartTime)) {
        return true;
      }
    }
    if (!isEndTimeUndefined && originalEndTime && endTime) {
      if (formatTimeForInput(endTime) !== formatTimeForInput(originalEndTime)) {
        return true;
      }
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

  // 휠 피커에서 선택 완료
  const handlePickerConfirm = useCallback(
    (timeValue: TimeValue) => {
      const hourStr = timeValue.hour.toString().padStart(2, '0');
      const minuteStr = timeValue.minute.toString().padStart(2, '0');
      const timeStr = `${hourStr}:${minuteStr}`;

      if (activePicker === 'start') {
        setStartTimeStr(timeStr);
      } else if (activePicker === 'end') {
        setEndTimeStr(timeStr);
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
      >
        <View className="px-4">
          {/* 스태프 정보 */}
          <View className="flex-row items-center py-2 px-3 bg-gray-50 dark:bg-surface rounded-lg mb-2">
            {/* 프로필 이미지 */}
            {workLog.staffPhotoURL ? (
              <Image
                source={{ uri: workLog.staffPhotoURL }}
                className="h-10 w-10 rounded-full"
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
                <Text className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                  {workLog.staffName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View className="ml-3 flex-1">
              {/* 이름(닉네임) */}
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {workLog.staffName || '이름 없음'}
                {workLog.staffNickname ? ` (${workLog.staffNickname})` : ''}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
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
              iconColor="#9333EA"
              isUndefined={isStartTimeUndefined}
              onUndefinedChange={setIsStartTimeUndefined}
              onOpenPicker={() => setActivePicker('start')}
            />

            {/* 퇴근 시간 */}
            <TimeInputField
              label="퇴근 시간"
              value={endTimeStr}
              originalTime={originalEndTime}
              iconColor="#EF4444"
              isUndefined={isEndTimeUndefined}
              onUndefinedChange={setIsEndTimeUndefined}
              onOpenPicker={() => setActivePicker('end')}
            />

            {/* 시간 선택 안내 */}
            <View className="flex-row items-start p-3 bg-gray-100 dark:bg-surface-dark rounded-lg mb-4">
              <View className="mt-0.5">
                <AlertCircleIcon size={16} color="#6B7280" />
              </View>
              <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                탭하여 시간 선택{'\n'}(24시 이상 = 다음날 새벽)
              </Text>
            </View>

            {/* 시간 순서 경고 */}
            {isValidTimeFormat && !isValidTimeOrder && (
              <View className="flex-row items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
                <AlertCircleIcon size={16} color="#EF4444" />
                <Text className="ml-2 text-sm text-red-600 dark:text-red-400">
                  퇴근 시간이 출근보다 빨라요. 새벽은 25:00 형식으로 입력하세요.
                </Text>
              </View>
            )}

            {/* 근무 시간 */}
            <View className="flex-row items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Text className="text-sm text-gray-600 dark:text-gray-400">총 근무 시간</Text>
              <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {duration}
              </Text>
            </View>
          </Card>

          {/* 수정 사유 (선택) */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              수정 사유
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="수정 사유를 입력하세요 (선택)"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              className="p-3 border border-gray-200 dark:border-surface-overlay rounded-lg bg-white dark:bg-surface text-gray-900 dark:text-white min-h-[60px]"
            />
            <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              예: QR 인식 오류로 실제 출근 시간과 다름
            </Text>
          </View>

          {/* 안내 메시지 */}
          <View className="flex-row items-start p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg mb-4">
            <AlertCircleIcon size={16} color="#9333EA" />
            <Text className="ml-2 text-sm text-primary-700 dark:text-primary-300 flex-1">
              시간 수정 기록은 이력으로 저장되며, 해당 스태프에게 알림이 발송됩니다.
            </Text>
          </View>
        </View>
      </SheetModal>

      {/* 휠 피커 모달 (메인 모달 바깥에서 렌더링) */}
      <TimeWheelPicker
        visible={activePicker !== null}
        value={activePickerValue}
        title={activePickerTitle}
        minuteInterval={15}
        onConfirm={handlePickerConfirm}
        onClose={() => setActivePicker(null)}
      />
    </>
  );
}

export default WorkTimeEditor;

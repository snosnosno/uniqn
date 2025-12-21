/**
 * UNIQN Mobile - 근무 시간 수정 컴포넌트
 *
 * @description 구인자가 스태프의 출퇴근 시간을 수정할 때 사용
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ClockIcon, EditIcon, AlertCircleIcon } from '../icons';
import { formatTime, formatDate } from '@/utils/dateUtils';
import type { WorkLog } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface WorkTimeEditorProps {
  workLog: WorkLog | null;
  visible: boolean;
  onClose: () => void;
  onSave: (data: {
    startTime: Date;
    endTime: Date;
    reason: string;
  }) => void;
  isLoading?: boolean;
}

type EditingField = 'startTime' | 'endTime' | null;

// ============================================================================
// Helpers
// ============================================================================

function parseTimestamp(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  // Firestore Timestamp
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return '0시간 0분';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function formatTimeForInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function parseTimeInput(timeStr: string, baseDate: Date): Date | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// ============================================================================
// Sub-components
// ============================================================================

interface TimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  originalTime?: Date | null;
  currentTime: Date;
  iconColor: string;
}

function TimeInput({
  label,
  value,
  onChange,
  originalTime,
  currentTime,
  iconColor,
}: TimeInputProps) {
  const hasChanged = originalTime && formatTimeForInput(originalTime) !== value;

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
        {label}
      </Text>
      <View className="flex-row items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <ClockIcon size={20} color={iconColor} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="HH:MM"
          placeholderTextColor="#9CA3AF"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          className="ml-2 flex-1 text-lg font-semibold text-gray-900 dark:text-white"
        />
      </View>
      {hasChanged && originalTime && (
        <Text className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
          원래: {formatTime(originalTime)}
        </Text>
      )}
    </View>
  );
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

  // workLog 변경 시 초기값 설정
  React.useEffect(() => {
    if (workLog) {
      const start = parseTimestamp(workLog.actualStartTime);
      const end = parseTimestamp(workLog.actualEndTime);
      setStartTimeStr(formatTimeForInput(start));
      setEndTimeStr(formatTimeForInput(end));
      setReason('');
    }
  }, [workLog]);

  // 파싱된 시간
  const baseDate = useMemo(() => {
    if (!workLog?.date) return new Date();
    return new Date(workLog.date);
  }, [workLog?.date]);

  const startTime = useMemo(() =>
    parseTimeInput(startTimeStr, baseDate) ?? parseTimestamp(workLog?.actualStartTime),
    [startTimeStr, baseDate, workLog?.actualStartTime]
  );

  const endTime = useMemo(() =>
    parseTimeInput(endTimeStr, baseDate) ?? parseTimestamp(workLog?.actualEndTime),
    [endTimeStr, baseDate, workLog?.actualEndTime]
  );

  // 원래 시간
  const originalStartTime = useMemo(() =>
    workLog?.actualStartTime ? parseTimestamp(workLog.actualStartTime) : null,
    [workLog]
  );
  const originalEndTime = useMemo(() =>
    workLog?.actualEndTime ? parseTimestamp(workLog.actualEndTime) : null,
    [workLog]
  );

  // 근무 시간 계산
  const duration = useMemo(() => {
    if (!startTime || !endTime) return '0시간 0분';
    return calculateDuration(startTime, endTime);
  }, [startTime, endTime]);

  // 변경 여부
  const hasChanges = useMemo(() => {
    if (!originalStartTime || !originalEndTime) return false;
    return (
      formatTimeForInput(startTime) !== formatTimeForInput(originalStartTime) ||
      formatTimeForInput(endTime) !== formatTimeForInput(originalEndTime)
    );
  }, [startTime, endTime, originalStartTime, originalEndTime]);

  // 시간 형식 유효성
  const isValidTimeFormat = useMemo(() => {
    const startValid = parseTimeInput(startTimeStr, baseDate) !== null;
    const endValid = parseTimeInput(endTimeStr, baseDate) !== null;
    return startValid && endValid;
  }, [startTimeStr, endTimeStr, baseDate]);

  // 전체 유효성 검사
  const isValid = useMemo(() => {
    return (
      hasChanges &&
      reason.trim().length > 0 &&
      isValidTimeFormat &&
      endTime > startTime
    );
  }, [hasChanges, reason, isValidTimeFormat, startTime, endTime]);

  // 저장
  const handleSave = useCallback(() => {
    if (!isValid || !startTime || !endTime) return;
    onSave({
      startTime,
      endTime,
      reason: reason.trim(),
    });
  }, [isValid, startTime, endTime, reason, onSave]);

  // 닫기
  const handleClose = useCallback(() => {
    setReason('');
    onClose();
  }, [onClose]);

  if (!workLog) return null;

  const workDate = workLog.date ? parseTimestamp(workLog.date) : null;

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title="근무 시간 수정"
      position="center"
    >
      <View className="p-4">
        {/* 스태프 정보 */}
        <View className="flex-row items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
          <View className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 items-center justify-center">
            <Text className="text-lg font-semibold text-primary-600 dark:text-primary-400">
              {workLog.staffId?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              스태프 {workLog.staffId?.slice(-4) || '알 수 없음'}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {workDate ? formatDate(workDate) : '날짜 없음'}
            </Text>
          </View>
        </View>

        {/* 시간 편집 카드 */}
        <Card variant="outlined" padding="md" className="mb-4">
          {/* 출근 시간 */}
          <TimeInput
            label="출근 시간"
            value={startTimeStr}
            onChange={setStartTimeStr}
            originalTime={originalStartTime}
            currentTime={startTime}
            iconColor="#2563EB"
          />

          {/* 퇴근 시간 */}
          <TimeInput
            label="퇴근 시간"
            value={endTimeStr}
            onChange={setEndTimeStr}
            originalTime={originalEndTime}
            currentTime={endTime}
            iconColor="#EF4444"
          />

          {/* 근무 시간 */}
          <View className="flex-row items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              총 근무 시간
            </Text>
            <Text className="text-lg font-bold text-primary-600 dark:text-primary-400">
              {duration}
            </Text>
          </View>
        </Card>

        {/* 시간 형식 안내 */}
        {!isValidTimeFormat && (startTimeStr.length > 0 || endTimeStr.length > 0) && (
          <View className="flex-row items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
            <AlertCircleIcon size={16} color="#D97706" />
            <Text className="ml-2 text-sm text-yellow-700 dark:text-yellow-300">
              시간은 HH:MM 형식으로 입력하세요 (예: 09:00)
            </Text>
          </View>
        )}

        {/* 시간 유효성 경고 */}
        {isValidTimeFormat && endTime <= startTime && (
          <View className="flex-row items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
            <AlertCircleIcon size={16} color="#EF4444" />
            <Text className="ml-2 text-sm text-red-600 dark:text-red-400">
              퇴근 시간은 출근 시간보다 늦어야 합니다.
            </Text>
          </View>
        )}

        {/* 수정 사유 (필수) */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            수정 사유 <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="수정 사유를 입력하세요 (필수)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={2}
            textAlignVertical="top"
            className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[60px]"
          />
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            예: QR 인식 오류로 실제 출근 시간과 다름
          </Text>
        </View>

        {/* 안내 메시지 */}
        <View className="flex-row items-start p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
          <AlertCircleIcon size={16} color="#2563EB" />
          <Text className="ml-2 text-sm text-blue-700 dark:text-blue-300 flex-1">
            시간 수정 기록은 이력으로 저장되며, 해당 스태프에게 알림이 발송됩니다.
          </Text>
        </View>

        {/* 버튼 */}
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            onPress={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            variant="primary"
            onPress={handleSave}
            loading={isLoading}
            disabled={!isValid}
            className="flex-1"
          >
            저장
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default WorkTimeEditor;

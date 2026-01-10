/**
 * UNIQN Mobile - 시간대 카드
 *
 * @description 날짜별 요구사항의 시간대를 표시하고 편집하는 카드
 * @version 2.0.0
 *
 * 주요 기능:
 * - 시작시간 입력 (종료시간 없음)
 * - 시간 미정 토글
 * - 역할별 인원 관리
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, Switch } from 'react-native';
import { XCircleIcon } from '@/components/icons';
import type { TimeSlot, RoleRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

export interface TimeSlotCardProps {
  /** 시간대 데이터 */
  timeSlot: TimeSlot;
  /** 시간대 인덱스 */
  index: number;
  /** 삭제 가능 여부 (최소 1개 유지) */
  canRemove: boolean;
  /** 시간대 업데이트 콜백 */
  onUpdate: (index: number, timeSlot: Partial<TimeSlot>) => void;
  /** 시간대 삭제 콜백 */
  onRemove: (index: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function TimeSlotCard({
  timeSlot,
  index,
  canRemove,
  onUpdate,
  onRemove,
}: TimeSlotCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 시작시간 변경
  const handleStartTimeChange = useCallback(
    (text: string) => {
      onUpdate(index, { startTime: text });
    },
    [index, onUpdate]
  );

  // 시간 미정 토글
  const handleTimeToBeAnnouncedToggle = useCallback(
    (value: boolean) => {
      onUpdate(index, { isTimeToBeAnnounced: value });
    },
    [index, onUpdate]
  );

  // 미정 설명 변경
  const handleTentativeDescriptionChange = useCallback(
    (text: string) => {
      onUpdate(index, { tentativeDescription: text });
    },
    [index, onUpdate]
  );

  return (
    <View className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-3">
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          className="flex-1"
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? '접기' : '펼치기'}
        >
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            시간대 {index + 1}
            {timeSlot.isTimeToBeAnnounced ? ' (시간 미정)' : ` (${timeSlot.startTime})`}
          </Text>
        </Pressable>

        {/* 삭제 버튼 */}
        {canRemove && (
          <Pressable
            onPress={() => onRemove(index)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            accessibilityRole="button"
            accessibilityLabel="시간대 삭제"
          >
            <XCircleIcon size={20} color="#EF4444" />
          </Pressable>
        )}
      </View>

      {/* 내용 */}
      {isExpanded && (
        <View className="gap-3">
          {/* 시간 미정 토글 */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-700 dark:text-gray-300">
              시간 미정
            </Text>
            <Switch
              value={timeSlot.isTimeToBeAnnounced}
              onValueChange={handleTimeToBeAnnouncedToggle}
              trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 시작시간 입력 또는 미정 설명 */}
          {timeSlot.isTimeToBeAnnounced ? (
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                미정 사유 (선택)
              </Text>
              <TextInput
                value={timeSlot.tentativeDescription || ''}
                onChangeText={handleTentativeDescriptionChange}
                placeholder="예: 토너먼트 진행 상황에 따라 결정"
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={200}
              />
            </View>
          ) : (
            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                시작 시간 (HH:mm)
              </Text>
              <TextInput
                value={timeSlot.startTime}
                onChangeText={handleStartTimeChange}
                placeholder="09:00"
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm"
                placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          )}

          {/* 역할 목록 요약 */}
          <View className="pt-2 border-t border-gray-200 dark:border-gray-600">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              필요 인원
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {timeSlot.roles.map((role: RoleRequirement, roleIndex: number) => (
                <View
                  key={role.id || roleIndex}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full"
                >
                  <Text className="text-sm text-blue-700 dark:text-blue-300">
                    {role.role === 'other' && role.customRole
                      ? role.customRole
                      : role.role}{' '}
                    {role.headcount}명
                  </Text>
                </View>
              ))}
            </View>
            {/* TODO: 역할 편집 기능은 RoleRequirementRow 완성 후 추가 */}
          </View>
        </View>
      )}
    </View>
  );
}

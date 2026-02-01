/**
 * UNIQN Mobile - 시간 수정 이력 섹션 컴포넌트
 *
 * @description 시간 수정 이력 접기/펼치기 UI
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { DocumentIcon, ChevronDownIcon, ChevronUpIcon } from '../../icons';
import { ModificationHistoryItem } from './ModificationHistoryItem';
import type { ModificationHistoryItemProps } from './types';

export interface TimeModificationHistoryProps {
  /** 수정 이력 배열 */
  modificationHistory: ModificationHistoryItemProps['modification'][];
  /** 확장 상태 */
  isExpanded: boolean;
  /** 확장 토글 핸들러 */
  onToggle: () => void;
}

/**
 * 시간 수정 이력 섹션
 *
 * @example
 * <TimeModificationHistory
 *   modificationHistory={workLog.modificationHistory}
 *   isExpanded={isTimeHistoryExpanded}
 *   onToggle={() => setIsTimeHistoryExpanded(!isTimeHistoryExpanded)}
 * />
 */
export function TimeModificationHistory({
  modificationHistory,
  isExpanded,
  onToggle,
}: TimeModificationHistoryProps) {
  if (!modificationHistory || modificationHistory.length === 0) {
    return null;
  }

  return (
    <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
      <Pressable
        onPress={onToggle}
        className="flex-row items-center justify-between active:opacity-70"
      >
        <View className="flex-row items-center">
          <DocumentIcon size={18} color="#6B7280" />
          <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
            시간 수정 이력
          </Text>
          <View className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
            <Text className="text-xs text-yellow-700 dark:text-yellow-300">
              {modificationHistory.length}회
            </Text>
          </View>
        </View>
        {isExpanded ? (
          <ChevronUpIcon size={20} color="#6B7280" />
        ) : (
          <ChevronDownIcon size={20} color="#6B7280" />
        )}
      </Pressable>

      {isExpanded && (
        <View className="mt-3 bg-gray-50 dark:bg-surface rounded-lg p-3">
          {modificationHistory.map((mod, idx) => (
            <ModificationHistoryItem
              key={idx}
              modification={mod}
              index={idx}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * UNIQN Mobile - 그룹화된 일정 선택 컴포넌트
 *
 * @description 연속/다중 날짜를 그룹으로 표시하고 선택하는 컴포넌트
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';

import {
  CheckIcon,
  CalendarIcon,
  BriefcaseIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
} from '@/components/icons';

import type { GroupedAssignmentDisplay, IconColors } from '../types';
import type { GroupSelectionState } from '../useAssignmentSelection';
import { createAssignmentKey } from '../utils';
import { formatDateDisplay } from '@/utils/scheduleGrouping';

// Android에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// Types
// ============================================================================

export interface GroupedAssignmentSelectorProps {
  /** 그룹화된 일정 데이터 */
  groupedAssignments: GroupedAssignmentDisplay[];
  /** 선택된 키 Set */
  selectedKeys: Set<string>;
  /** 선택 개수 */
  selectedCount: number;
  /** 전체 개수 */
  totalCount: number;
  /** 다크모드 여부 */
  isDark: boolean;
  /** 아이콘 색상 */
  iconColors: IconColors;
  /** 개별 일정 토글 핸들러 */
  onToggle: (key: string) => void;
  /** 그룹 전체 토글 핸들러 */
  onToggleGroup: (groupId: string) => void;
  /** 그룹 선택 상태 확인 */
  getGroupSelectionState: (groupId: string) => GroupSelectionState;
}

// ============================================================================
// Sub Components
// ============================================================================

interface GroupCheckboxProps {
  state: GroupSelectionState;
  isDark: boolean;
}

/**
 * 그룹 체크박스 (전체 선택/일부 선택/미선택 표시)
 */
function GroupCheckbox({ state, isDark }: GroupCheckboxProps) {
  const isChecked = state === 'all';
  const isIndeterminate = state === 'some';

  return (
    <View
      className={`
        h-5 w-5 rounded border-2 items-center justify-center mr-3
        ${isChecked || isIndeterminate
          ? 'bg-primary-500 border-primary-500'
          : isDark ? 'border-gray-500' : 'border-gray-400'}
      `}
    >
      {isChecked && <CheckIcon size={12} color="#fff" />}
      {isIndeterminate && <MinusIcon size={12} color="#fff" />}
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const GroupedAssignmentSelector = React.memo(function GroupedAssignmentSelector({
  groupedAssignments,
  selectedKeys,
  selectedCount,
  totalCount,
  isDark,
  iconColors,
  onToggle,
  onToggleGroup,
  getGroupSelectionState,
}: GroupedAssignmentSelectorProps) {
  // 그룹별 펼침 상태
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((groupId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  if (groupedAssignments.length === 0) {
    return null;
  }

  return (
    <View className="mb-3">
      {/* 헤더 */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          선택된 일정
        </Text>
        <Text className="text-xs text-primary-500 dark:text-primary-400 font-medium">
          {selectedCount}/{totalCount}개 선택
        </Text>
      </View>

      {/* 그룹 목록 */}
      <View className="gap-2">
        {groupedAssignments.map((group) => {
          const isExpanded = expandedGroups.has(group.groupId);
          const selectionState = getGroupSelectionState(group.groupId);
          const isSingleDay = group.dateRange.totalDays === 1;

          // 단일 날짜인 경우 기존 방식으로 표시
          if (isSingleDay) {
            const item = group.items[0];
            const key = createAssignmentKey(item.date, item.timeSlot, item.role);
            const isChecked = selectedKeys.has(key);

            const bgClass = isChecked
              ? isDark ? 'bg-blue-900 border-blue-700' : 'bg-blue-100 border-blue-300'
              : isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200';

            return (
              <Pressable
                key={group.groupId}
                onPress={() => onToggle(key)}
                className={`flex-row items-center rounded-lg px-3 py-2.5 border active:opacity-70 ${bgClass}`}
              >
                <View className={`
                  h-5 w-5 rounded border-2 items-center justify-center mr-3
                  ${isChecked
                    ? 'bg-primary-500 border-primary-500'
                    : isDark ? 'border-gray-500' : 'border-gray-400'}
                `}>
                  {isChecked && <CheckIcon size={12} color="#fff" />}
                </View>
                <CalendarIcon size={16} color={isChecked ? iconColors.checked : iconColors.unchecked} />
                <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.formattedDate} {item.timeSlotDisplay}
                </Text>
                <View className={`mx-2 h-4 w-px ${isDark ? 'bg-gray-500' : 'bg-gray-300'}`} />
                <BriefcaseIcon size={16} color={isChecked ? iconColors.checked : iconColors.unchecked} />
                <Text className={`ml-1.5 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {item.roleLabel}
                </Text>
              </Pressable>
            );
          }

          // 다중 날짜 그룹
          const hasSelection = selectionState !== 'none';
          const bgClass = hasSelection
            ? isDark ? 'bg-blue-900/50 border-blue-700' : 'bg-blue-50 border-blue-200'
            : isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200';

          return (
            <View
              key={group.groupId}
              className={`rounded-lg border overflow-hidden ${bgClass}`}
            >
              {/* 그룹 헤더 */}
              <Pressable
                onPress={() => onToggleGroup(group.groupId)}
                className="flex-row items-center px-3 py-2.5 active:opacity-70"
              >
                <GroupCheckbox state={selectionState} isDark={isDark} />

                <View className="flex-1">
                  <View className="flex-row items-center">
                    <CalendarIcon
                      size={14}
                      color={hasSelection ? iconColors.checked : iconColors.unchecked}
                    />
                    <Text className={`ml-1.5 text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatDateDisplay(group.dateRange.dates)}
                    </Text>
                  </View>

                  <View className="flex-row items-center mt-1">
                    <ClockIcon size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={`ml-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {group.timeSlotDisplay}
                    </Text>
                    <View className={`mx-1.5 h-3 w-px ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
                    <BriefcaseIcon size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={`ml-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {group.roleLabel}
                    </Text>
                  </View>
                </View>

                {/* 펼침/접힘 버튼 */}
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleExpand(group.groupId);
                  }}
                  className="p-1.5 rounded-full active:bg-gray-200 dark:active:bg-gray-600"
                  accessibilityLabel={isExpanded ? '날짜별 상세 접기' : '날짜별 상세 펼치기'}
                >
                  {isExpanded ? (
                    <ChevronUpIcon size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  ) : (
                    <ChevronDownIcon size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  )}
                </Pressable>
              </Pressable>

              {/* 펼침 상태: 개별 날짜 */}
              {isExpanded && (
                <View className={`border-t ${isDark ? 'border-gray-600' : 'border-gray-200'} px-3 py-2`}>
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    개별 날짜 선택
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {group.items.map((item) => {
                      const key = createAssignmentKey(item.date, item.timeSlot, item.role);
                      const isChecked = selectedKeys.has(key);

                      const itemBgClass = isChecked
                        ? isDark ? 'bg-blue-800 border-blue-600' : 'bg-blue-100 border-blue-300'
                        : isDark ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200';

                      return (
                        <Pressable
                          key={key}
                          onPress={() => onToggle(key)}
                          className={`flex-row items-center px-2.5 py-1.5 rounded-lg border active:opacity-70 ${itemBgClass}`}
                        >
                          <View className={`
                            h-4 w-4 rounded border-2 items-center justify-center mr-1.5
                            ${isChecked
                              ? 'bg-primary-500 border-primary-500'
                              : isDark ? 'border-gray-400' : 'border-gray-400'}
                          `}>
                            {isChecked && <CheckIcon size={10} color="#fff" />}
                          </View>
                          <Text className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {item.formattedDate}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default GroupedAssignmentSelector;

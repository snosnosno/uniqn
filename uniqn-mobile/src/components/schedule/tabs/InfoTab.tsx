/**
 * UNIQN Mobile - 스케줄 상세 모달 정보 탭
 *
 * @description 공고 정보, 장소, 일정 표시
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import {
  DocumentIcon,
  MapIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
} from '@/components/icons';
import type { ScheduleEvent } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface InfoTabProps {
  schedule: ScheduleEvent;
}

// ============================================================================
// Helpers
// ============================================================================

function formatTime(timestamp: Timestamp | null): string {
  if (!timestamp) return '--:--';
  const date = timestamp.toDate();
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatFullDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function calculateDuration(start: Timestamp | null, end: Timestamp | null): string {
  if (!start || !end) return '-';
  const startDate = start.toDate();
  const endDate = end.toDate();
  const diffMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  return `${minutes}분`;
}

// ============================================================================
// Sub Components
// ============================================================================

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center mb-2">
        {icon}
        <Text className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </Text>
      </View>
      <View className="ml-6">{children}</View>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export const InfoTab = memo(function InfoTab({ schedule }: InfoTabProps) {
  const ownerName = schedule.jobPostingCard?.ownerName;

  return (
    <View className="py-2">
      {/* 공고 정보 */}
      <Section icon={<DocumentIcon size={18} color="#6B7280" />} title="공고 정보">
        <Text className="text-base text-gray-900 dark:text-white font-medium">
          {schedule.eventName}
        </Text>
        {ownerName && (
          <View className="flex-row items-center mt-1">
            <UserIcon size={14} color="#9CA3AF" />
            <Text className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">
              구인자: {ownerName}
            </Text>
          </View>
        )}
      </Section>

      {/* 장소 */}
      <Section icon={<MapIcon size={18} color="#6B7280" />} title="장소">
        <Text className="text-base text-gray-900 dark:text-white">
          {schedule.location || '-'}
        </Text>
        {schedule.detailedAddress && (
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {schedule.detailedAddress}
          </Text>
        )}
      </Section>

      {/* 일정 */}
      <Section icon={<CalendarIcon size={18} color="#6B7280" />} title="일정">
        <Text className="text-base text-gray-900 dark:text-white">
          {formatFullDate(schedule.date)}
        </Text>
        <View className="flex-row items-center mt-2">
          <ClockIcon size={14} color="#9CA3AF" />
          <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-400">
            {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
          </Text>
          <Text className="ml-2 text-sm text-gray-500 dark:text-gray-500">
            (예정 {calculateDuration(schedule.startTime, schedule.endTime)})
          </Text>
        </View>
      </Section>

      {/* 메모 */}
      {schedule.notes && (
        <Section icon={<DocumentIcon size={18} color="#6B7280" />} title="메모">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {schedule.notes}
          </Text>
        </Section>
      )}
    </View>
  );
});

export default InfoTab;

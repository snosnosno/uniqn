/**
 * UNIQN Mobile - 신고 카드 컴포넌트
 *
 * @description 관리자 신고 목록에서 사용하는 카드 컴포넌트
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronRightIcon } from '../icons';
import {
  REPORT_STATUS_LABELS,
  REPORT_STATUS_COLORS,
  REPORT_SEVERITY_COLORS,
  EMPLOYEE_REPORT_TYPE_LABELS,
  EMPLOYER_REPORT_TYPE_LABELS,
  type Report,
  type EmployeeReportType,
  type EmployerReportType,
} from '@/types/report';

// ============================================================================
// Types
// ============================================================================

interface ReportCardProps {
  /** 신고 데이터 */
  report: Report;
  /** 카드 클릭 시 콜백 */
  onPress: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 신고 타입 라벨 가져오기
 */
function getReportTypeLabel(report: Report): string {
  if (report.reporterType === 'employer') {
    return EMPLOYEE_REPORT_TYPE_LABELS[report.type as EmployeeReportType] || report.type;
  }
  return EMPLOYER_REPORT_TYPE_LABELS[report.type as EmployerReportType] || report.type;
}

/**
 * 심각도 라벨
 */
const SEVERITY_LABELS: Record<string, string> = {
  critical: '심각',
  high: '높음',
  medium: '보통',
  low: '낮음',
};

// ============================================================================
// Component
// ============================================================================

export const ReportCard = React.memo(function ReportCard({ report, onPress }: ReportCardProps) {
  const typeLabel = getReportTypeLabel(report);
  const statusColor = REPORT_STATUS_COLORS[report.status];
  const severityColor = REPORT_SEVERITY_COLORS[report.severity];

  // 생성 시간 포맷
  const timeAgo = report.createdAt
    ? formatDistanceToNow(
        report.createdAt instanceof Date ? report.createdAt : report.createdAt.toDate(),
        { addSuffix: true, locale: ko }
      )
    : '';

  return (
    <Pressable
      onPress={onPress}
      className="bg-white dark:bg-surface rounded-xl p-4 mb-3 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel} 신고, ${SEVERITY_LABELS[report.severity]} 심각도, ${REPORT_STATUS_LABELS[report.status]} 상태`}
    >
      {/* 상단: 심각도 + 상태 배지 */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <View className="flex-row items-center flex-wrap gap-2 mb-1">
            {/* 심각도 배지 */}
            <View className={`px-2 py-0.5 rounded ${severityColor.bg}`}>
              <Text className={`text-xs font-medium ${severityColor.text}`}>
                {SEVERITY_LABELS[report.severity]}
              </Text>
            </View>
            {/* 상태 배지 */}
            <View className={`px-2 py-0.5 rounded ${statusColor.bg}`}>
              <Text className={`text-xs font-medium ${statusColor.text}`}>
                {REPORT_STATUS_LABELS[report.status]}
              </Text>
            </View>
          </View>
          {/* 신고 유형 */}
          <Text className="font-semibold text-gray-900 dark:text-white">{typeLabel}</Text>
        </View>
        <ChevronRightIcon size={20} color="#9CA3AF" />
      </View>

      {/* 설명 */}
      <View className="mb-2">
        <Text className="text-sm text-gray-600 dark:text-gray-400" numberOfLines={2}>
          {report.description}
        </Text>
      </View>

      {/* 신고자 → 피신고자 */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            <Text className="font-medium">{report.reporterName}</Text>
            <Text> → </Text>
            <Text className="font-medium">{report.targetName}</Text>
          </Text>
        </View>
        <Text className="text-xs text-gray-400 dark:text-gray-500">{timeAgo}</Text>
      </View>

      {/* 관련 공고 (있는 경우) */}
      {report.jobPostingTitle && (
        <View className="mt-2 pt-2 border-t border-gray-100 dark:border-surface-overlay">
          <Text className="text-xs text-gray-400 dark:text-gray-500" numberOfLines={1}>
            공고: {report.jobPostingTitle}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

ReportCard.displayName = 'ReportCard';

export default ReportCard;

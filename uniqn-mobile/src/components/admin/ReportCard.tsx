/**
 * UNIQN Mobile - 신고 카드 컴포넌트
 *
 * @description 관리자 신고 목록에서 사용하는 카드 컴포넌트
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { ChevronRightIcon } from '../icons';
import { toDate } from '@/utils/date';
import { CardStripe, type CardStripeTone } from '@/components/ui';
import {
  REPORT_STATUS_LABELS,
  REPORT_STATUS_COLORS,
  REPORT_SEVERITY_COLORS,
  EMPLOYEE_REPORT_TYPE_LABELS,
  EMPLOYER_REPORT_TYPE_LABELS,
  type Report,
  type ReportStatus,
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

/**
 * 신고 상태 → CardStripe tone
 *  - pending(검토 대기): gold (신규 접수)
 *  - reviewed(검토 중): info (처리중)
 *  - resolved(처리 완료): muted (완료)
 *  - dismissed(기각): warning (반려)
 */
const REPORT_STATUS_TONE: Record<ReportStatus, CardStripeTone> = {
  pending: 'gold',
  reviewed: 'info',
  resolved: 'muted',
  dismissed: 'warning',
};

// ============================================================================
// Component
// ============================================================================

export const ReportCard = React.memo(function ReportCard({ report, onPress }: ReportCardProps) {
  const typeLabel = getReportTypeLabel(report);
  const statusColor = REPORT_STATUS_COLORS[report.status];
  const severityColor = REPORT_SEVERITY_COLORS[report.severity];

  // 생성 시간 포맷
  const createdAt = toDate(report.createdAt);
  const timeAgo = createdAt ? formatDistanceToNow(createdAt, { addSuffix: true, locale: ko }) : '';

  const stripeTone = REPORT_STATUS_TONE[report.status];

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-card rounded-md mb-3 border border-divider active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${typeLabel} 신고, ${SEVERITY_LABELS[report.severity]} 심각도, ${REPORT_STATUS_LABELS[report.status]} 상태`}
    >
      <CardStripe tone={stripeTone}>
        <View className="pl-4 pr-4 py-4">
          {/* 상단: 심각도 + 상태 배지 */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <View className="flex-row items-center flex-wrap gap-2 mb-1">
                {/* 심각도 배지 */}
                <View className={`px-2 py-0.5 rounded ${severityColor.bg}`}>
                  <Text className={`text-xs font-sans-medium ${severityColor.text}`}>
                    {SEVERITY_LABELS[report.severity]}
                  </Text>
                </View>
                {/* 상태 배지 */}
                <View className={`px-2 py-0.5 rounded ${statusColor.bg}`}>
                  <Text className={`text-xs font-sans-medium ${statusColor.text}`}>
                    {REPORT_STATUS_LABELS[report.status]}
                  </Text>
                </View>
              </View>
              {/* 신고 유형 */}
              <Text className="font-sans-semibold text-content-primary dark:text-off-white">
                {typeLabel}
              </Text>
            </View>
            <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
          </View>

          {/* 설명 */}
          <View className="mb-2">
            <Text
              className="text-sm text-content-muted dark:text-secondary-400 font-sans"
              numberOfLines={2}
            >
              {report.description}
            </Text>
          </View>

          {/* 신고자 → 피신고자 */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                <Text className="font-sans-medium">{report.reporterName}</Text>
                <Text className="font-sans"> → </Text>
                <Text className="font-sans-medium">{report.targetName}</Text>
              </Text>
            </View>
            <Text className="text-xs text-content-placeholder font-sans">{timeAgo}</Text>
          </View>

          {/* 관련 공고 (있는 경우) */}
          {report.jobPostingTitle && (
            <View className="mt-2 pt-2 border-t border-secondary-100 dark:border-surface-overlay">
              <Text className="text-xs text-content-placeholder font-sans" numberOfLines={1}>
                공고: {report.jobPostingTitle}
              </Text>
            </View>
          )}
        </View>
      </CardStripe>
    </Pressable>
  );
});

ReportCard.displayName = 'ReportCard';

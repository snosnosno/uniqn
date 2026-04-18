/**
 * UNIQN Mobile - Admin Report Detail
 * 신고 상세 및 처리 페이지
 *
 * @description 관리자용 신고 상세 조회 및 처리
 * @version 1.0.0
 *
 * 기능:
 * - 신고 상세 정보 표시
 * - 처리 폼 (pending 상태일 때만)
 * - 상태 변경 및 메모 입력
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { STATUS } from '@/constants';
import { useReportDetail, useReviewReport } from '@/hooks/useAdminReports';
import { StackHeader } from '@/components/headers';
import { EmptyState, Loading, Button } from '@/components/ui';
import {
  AlertTriangleIcon,
  UserIcon,
  DocumentIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@/components/icons';
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
import { toDate } from '@/utils/date';

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_LABELS: Record<string, string> = {
  critical: '심각',
  high: '높음',
  medium: '보통',
  low: '낮음',
};

const REVIEW_STATUS_OPTIONS: { value: ReportStatus; label: string; description: string }[] = [
  { value: 'reviewed', label: '검토 중', description: '신고 내용을 확인하고 조사 중' },
  { value: 'resolved', label: '처리 완료', description: '조치가 완료됨' },
  { value: 'dismissed', label: '기각', description: '신고 사유 불충분 또는 증거 부족' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getReportTypeLabel(report: Report): string {
  if (report.reporterType === 'employer') {
    return EMPLOYEE_REPORT_TYPE_LABELS[report.type as EmployeeReportType] || report.type;
  }
  return EMPLOYER_REPORT_TYPE_LABELS[report.type as EmployerReportType] || report.type;
}

function formatTimestamp(timestamp: Date | { toDate: () => Date } | undefined): string {
  const date = toDate(timestamp);
  if (!date) return '-';
  return format(date, 'yyyy년 M월 d일 HH:mm', { locale: ko });
}

function formatTimeAgo(timestamp: Date | { toDate: () => Date } | undefined): string {
  const date = toDate(timestamp);
  if (!date) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale: ko });
}

// ============================================================================
// Section Components
// ============================================================================

/**
 * 신고 정보 섹션
 */
function ReportInfoSection({ report }: { report: Report }) {
  const statusColor = REPORT_STATUS_COLORS[report.status];
  const severityColor = REPORT_SEVERITY_COLORS[report.severity];
  const typeLabel = getReportTypeLabel(report);

  return (
    <View className="bg-white dark:bg-surface rounded-md p-4 mx-4 mb-4">
      {/* 상태 및 심각도 배지 */}
      <View className="flex-row items-center gap-2 mb-4">
        <View className={`px-3 py-1 rounded-sm ${severityColor.bg}`}>
          <Text className={`text-xs font-sans-semibold ${severityColor.text}`}>
            {SEVERITY_LABELS[report.severity]}
          </Text>
        </View>
        <View className={`px-3 py-1 rounded-sm ${statusColor.bg}`}>
          <Text className={`text-xs font-sans-semibold ${statusColor.text}`}>
            {REPORT_STATUS_LABELS[report.status]}
          </Text>
        </View>
      </View>

      {/* 신고 유형 */}
      <Text className="text-xl font-display text-content-primary dark:text-off-white mb-2">
        {typeLabel}
      </Text>

      {/* 신고자 정보 */}
      <View className="flex-row items-center mb-3">
        <UserIcon size={16} color={SECONDARY_PALETTE[500]} />
        <Text className="text-sm text-content-muted dark:text-secondary-400 ml-2 font-sans">
          <Text className="font-sans-medium text-content-primary dark:text-off-white">
            {report.reporterName}
          </Text>
          <Text className="font-sans"> → </Text>
          <Text className="font-sans-medium text-content-primary dark:text-off-white">
            {report.targetName}
          </Text>
        </Text>
      </View>

      {/* 신고자 유형 */}
      <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-3 font-sans">
        {report.reporterType === 'employer' ? '구인자가 스태프를 신고' : '구직자가 구인자를 신고'}
      </Text>

      {/* 생성 시간 */}
      <View className="flex-row items-center">
        <ClockIcon size={14} color={SECONDARY_PALETTE[400]} />
        <Text className="text-xs text-content-placeholder ml-1 font-sans">
          {formatTimestamp(report.createdAt)} ({formatTimeAgo(report.createdAt)})
        </Text>
      </View>
    </View>
  );
}

/**
 * 신고 내용 섹션
 */
function ReportContentSection({ report }: { report: Report }) {
  return (
    <View className="bg-white dark:bg-surface rounded-md p-4 mx-4 mb-4">
      <View className="flex-row items-center mb-3">
        <DocumentIcon size={18} color="#D4AF37" />
        <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold ml-2">
          신고 내용
        </Text>
      </View>

      <Text className="text-sm text-content-secondary leading-relaxed font-sans">
        {report.description}
      </Text>

      {/* 관련 공고 */}
      {report.jobPostingTitle && (
        <View className="mt-4 pt-4 border-t border-secondary-100 dark:border-surface-overlay">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
            관련 공고
          </Text>
          <Text className="text-sm text-content-primary dark:text-off-white font-sans">
            {report.jobPostingTitle}
          </Text>
        </View>
      )}

      {/* 근무 날짜 (구인자→스태프 신고만) */}
      {report.workDate && (
        <View className="mt-3">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
            근무 날짜
          </Text>
          <Text className="text-sm text-content-primary dark:text-off-white font-sans">
            {report.workDate}
          </Text>
        </View>
      )}

      {/* 증거 자료 */}
      {report.evidenceUrls && report.evidenceUrls.length > 0 && (
        <View className="mt-4 pt-4 border-t border-secondary-100 dark:border-surface-overlay">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-2 font-sans">
            첨부 자료 ({report.evidenceUrls.length}개)
          </Text>
          {report.evidenceUrls.map((url, index) => (
            <Text
              key={index}
              className="text-sm text-primary-600 dark:text-primary-400 mb-1 font-sans"
              numberOfLines={1}
            >
              {url}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * 처리 이력 섹션 (이미 처리된 경우)
 */
function ReviewHistorySection({ report }: { report: Report }) {
  if (report.status === STATUS.REPORT.PENDING) return null;

  return (
    <View className="bg-white dark:bg-surface rounded-md p-4 mx-4 mb-4">
      <View className="flex-row items-center mb-3">
        <CheckCircleIcon size={18} color="#22C55E" />
        <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold ml-2">
          처리 이력
        </Text>
      </View>

      <View className="space-y-3">
        <View>
          <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
            처리 상태
          </Text>
          <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
            {REPORT_STATUS_LABELS[report.status]}
          </Text>
        </View>

        {report.reviewedAt && (
          <View className="mt-3">
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
              처리 일시
            </Text>
            <Text className="text-sm text-content-primary dark:text-off-white font-sans">
              {formatTimestamp(report.reviewedAt)}
            </Text>
          </View>
        )}

        {report.reviewerNotes && (
          <View className="mt-3">
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
              처리 메모
            </Text>
            <Text className="text-sm text-content-secondary font-sans">{report.reviewerNotes}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * 처리 폼 섹션 (pending 상태일 때만)
 */
function ReviewFormSection({
  report,
  onSubmit,
  isSubmitting,
}: {
  report: Report;
  onSubmit: (status: ReportStatus, notes: string) => void;
  isSubmitting: boolean;
}) {
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | null>(null);
  const [notes, setNotes] = useState('');

  if (report.status !== STATUS.REPORT.PENDING) return null;

  const handleSubmit = () => {
    if (!selectedStatus) return;
    onSubmit(selectedStatus, notes);
  };

  return (
    <View className="bg-white dark:bg-surface rounded-md p-4 mx-4 mb-4">
      <View className="flex-row items-center mb-4">
        <AlertTriangleIcon size={18} color="#D4A017" />
        <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold ml-2">
          신고 처리
        </Text>
      </View>

      {/* 상태 선택 */}
      <Text className="text-sm font-sans-medium text-content-secondary mb-2">처리 결과 선택</Text>
      <View className="space-y-2 mb-4">
        {REVIEW_STATUS_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setSelectedStatus(option.value)}
            className={`p-3 rounded-lg border-2 ${
              selectedStatus === option.value
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                : 'border-secondary-200 dark:border-surface-overlay'
            }`}
          >
            <Text
              className={`font-sans-medium ${
                selectedStatus === option.value
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-secondary-900 dark:text-off-white'
              }`}
            >
              {option.label}
            </Text>
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 mt-0.5 font-sans">
              {option.description}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 처리 메모 */}
      <Text className="text-sm font-sans-medium text-content-secondary mb-2">처리 메모 (선택)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="처리에 대한 메모를 입력하세요"
        placeholderTextColor={SECONDARY_PALETTE[400]}
        multiline
        numberOfLines={4}
        className="bg-surface-card dark:bg-surface rounded-lg p-3 text-sm font-sans text-content-primary dark:text-off-white mb-4"
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      {/* 제출 버튼 */}
      <Button
        onPress={handleSubmit}
        disabled={!selectedStatus || isSubmitting}
        loading={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? '처리 중...' : '신고 처리하기'}
      </Button>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminReportDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportId = id ?? '';

  const { data: report, isLoading, error } = useReportDetail(reportId);
  const { mutateAsync: reviewReport, isPending: isReviewing } = useReviewReport();

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleReview = useCallback(
    async (status: ReportStatus, notes: string) => {
      try {
        await reviewReport({
          reportId,
          status,
          reviewerNotes: notes,
        });
        // 처리 완료 후 목록으로 돌아가기
        router.back();
      } catch {
        // 에러는 useReviewReport 내에서 처리됨
      }
    },
    [reportId, reviewReport]
  );

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="신고 상세" fallbackHref="/(admin)/reports" />
        <View className="flex-1 bg-surface-page items-center justify-center">
          <Loading size="large" message="신고 정보를 불러오는 중..." />
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (error || !report) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page" edges={['top', 'bottom']}>
        <StackHeader title="신고 상세" fallbackHref="/(admin)/reports" />
        <View className="flex-1 bg-surface-page">
          <EmptyState
            title="신고를 찾을 수 없습니다"
            description="해당 신고가 존재하지 않거나 삭제되었습니다."
            icon="error"
            actionLabel="뒤로 가기"
            onAction={handleBack}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-page">
      <StackHeader title="신고 상세" fallbackHref="/(admin)/reports" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 16 }}
        >
          {/* 신고 정보 */}
          <ReportInfoSection report={report} />

          {/* 신고 내용 */}
          <ReportContentSection report={report} />

          {/* 처리 이력 (이미 처리된 경우) */}
          <ReviewHistorySection report={report} />

          {/* 처리 폼 (pending 상태일 때만) */}
          <ReviewFormSection report={report} onSubmit={handleReview} isSubmitting={isReviewing} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

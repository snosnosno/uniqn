import { SECONDARY_PALETTE } from '@/constants/colors';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { FlagOutlineIcon, SearchIcon } from '@/components/icons';
import { CardStripe, type CardStripeTone, EmptyState, Loading, NumericText } from '@/components/ui';
import { useAdminBoardReports } from '@/hooks/useAdminBoardReports';
import {
  BOARD_TYPE_LABELS,
  type BoardAdminReportRecord,
  type BoardReportFilterStatus,
} from '@/types/board';
import { toDate, type DateInput } from '@/utils/date';

const STATUS_OPTIONS: { value: BoardReportFilterStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'resolved', label: '해결' },
  { value: 'dismissed', label: '기각' },
];

function getStatusLabel(status: BoardAdminReportRecord['report']['status']): string {
  switch (status) {
    case 'resolved':
      return '해결';
    case 'dismissed':
      return '기각';
    default:
      return '대기';
  }
}

const REPORT_STATUS_CLASSNAMES = {
  resolved: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  dismissed: 'bg-secondary-100 text-content-muted dark:bg-surface-elevated dark:text-secondary-300',
  pending: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
} as const;

function getStatusClassName(status: BoardAdminReportRecord['report']['status']): string {
  if (status === 'resolved') return REPORT_STATUS_CLASSNAMES.resolved;
  if (status === 'dismissed') return REPORT_STATUS_CLASSNAMES.dismissed;
  return REPORT_STATUS_CLASSNAMES.pending;
}

/**
 * 게시판 신고 상태 → CardStripe tone
 *  - pending(대기): gold (신규 접수)
 *  - resolved(해결): muted (완료)
 *  - dismissed(기각): warning (반려)
 */
function getStripeTone(status: BoardAdminReportRecord['report']['status']): CardStripeTone {
  switch (status) {
    case 'resolved':
      return 'muted';
    case 'dismissed':
      return 'warning';
    default:
      return 'gold';
  }
}

function getTargetLabel(record: BoardAdminReportRecord): string {
  if (record.report.targetType === 'comment') {
    return '댓글';
  }

  return record.post?.boardType === 'schedule' ? '일정 게시글' : '게시글';
}

function formatDateValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function BoardReportCard({ record }: { record: BoardAdminReportRecord }) {
  const stripeTone = getStripeTone(record.report.status);

  return (
    <Pressable
      onPress={() => router.push(`/(admin)/board-reports/${record.report.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${getTargetLabel(record)} 신고 상세`}
      className="mb-3 rounded-md bg-surface-card dark:bg-surface-elevated border border-divider active:opacity-80"
    >
      <CardStripe tone={stripeTone}>
        <View className="pl-4 pr-4 py-4">
          <View className="mb-2 flex-row items-center justify-between gap-3">
            <View className="flex-1 flex-row flex-wrap items-center gap-2">
              <View className="rounded-sm bg-error-50 px-2.5 py-1 dark:bg-error-900/30">
                <Text className="text-xs font-sans-medium text-error-700 dark:text-error-300">
                  {getTargetLabel(record)}
                </Text>
              </View>
              {record.post ? (
                <View className="rounded-sm bg-primary-100 px-2.5 py-1 dark:bg-primary-900/30">
                  <Text className="text-xs font-sans-medium text-primary-700 dark:text-primary-300">
                    {BOARD_TYPE_LABELS[record.post.boardType]}
                  </Text>
                </View>
              ) : null}
              <View
                className={`rounded-sm px-2.5 py-1 ${getStatusClassName(record.report.status)}`}
              >
                <Text className="text-xs font-sans-medium">
                  {getStatusLabel(record.report.status)}
                </Text>
              </View>
            </View>
            <NumericText className="text-xs text-content-placeholder font-sans">
              {formatDateValue(record.report.createdAt)}
            </NumericText>
          </View>

          <Text className="mb-1 text-base font-sans-semibold text-content-primary dark:text-off-white">
            {record.post?.title ?? '원본 게시글을 확인할 수 없습니다.'}
          </Text>
          <Text
            className="mb-3 text-sm text-content-muted dark:text-secondary-400 font-sans"
            numberOfLines={2}
          >
            사유: {record.report.reason}
          </Text>

          <View className="flex-row flex-wrap items-center gap-3">
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              신고자: {record.reporterName}
            </Text>
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
              대상 작성자: {record.targetAuthorName ?? '확인 필요'}
            </Text>
          </View>
        </View>
      </CardStripe>
    </Pressable>
  );
}

export default function AdminBoardReportsPage() {
  const [status, setStatus] = useState<BoardReportFilterStatus>('pending');
  const [query, setQuery] = useState('');
  const { data, isLoading, isRefetching, error, refetch } = useAdminBoardReports(status);

  const filteredReports = useMemo(() => {
    if (!data) {
      return [];
    }

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return data;
    }

    return data.filter((record) => {
      const haystacks = [
        record.report.reason,
        record.report.details ?? '',
        record.reporterName,
        record.targetAuthorName ?? '',
        record.post?.title ?? '',
      ];

      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [data, query]);

  if (isLoading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="게시판 신고" fallbackHref="/(admin)" />
        <View className="flex-1 items-center justify-center bg-surface-page dark:bg-surface">
          <Loading size="large" message="게시판 신고를 불러오는 중..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="게시판 신고" fallbackHref="/(admin)" />
        <View className="flex-1 bg-surface-page dark:bg-surface">
          <EmptyState
            title="게시판 신고를 불러오지 못했습니다"
            description="잠시 후 다시 시도해 주세요."
            icon="error"
            actionLabel="다시 시도"
            onAction={() => refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-page dark:bg-surface">
      <StackHeader title="게시판 신고" fallbackHref="/(admin)" />
      <View className="border-b border-secondary-200 bg-white px-4 py-3 dark:border-surface-overlay dark:bg-surface">
        <View className="flex-row items-center rounded-lg bg-surface-card px-3 py-2 dark:bg-surface-elevated">
          <SearchIcon size={18} color={SECONDARY_PALETTE[400]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="사유, 신고자, 게시글 검색"
            placeholderTextColor={SECONDARY_PALETTE[400]}
            className="ml-2 flex-1 text-base font-sans text-content-primary dark:text-off-white"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View className="border-b border-secondary-200 bg-white dark:border-surface-overlay dark:bg-surface">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4 py-2"
          contentContainerStyle={{ gap: 8, alignItems: 'center' }}
        >
          {STATUS_OPTIONS.map((option) => {
            const isSelected = option.value === status;

            return (
              <Pressable
                key={option.value}
                onPress={() => setStatus(option.value)}
                className={`rounded-sm px-4 py-2 ${
                  isSelected ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-surface-elevated'
                }`}
              >
                <Text
                  className={`text-sm font-sans-medium ${
                    isSelected ? 'text-surface-dark' : 'text-secondary-700 dark:text-secondary-300'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <Text className="mb-3 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
          총 {filteredReports.length}건
        </Text>

        {filteredReports.length === 0 ? (
          <View className="py-20">
            <EmptyState
              title="게시판 신고가 없습니다"
              description="현재 조건에 맞는 신고가 없습니다."
              icon={<FlagOutlineIcon size={40} color={SECONDARY_PALETTE[400]} />}
            />
          </View>
        ) : (
          filteredReports.map((record) => (
            <BoardReportCard key={record.report.id} record={record} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

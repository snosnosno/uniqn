/**
 * UNIQN Mobile - Admin Reports List
 * 신고 관리 목록 페이지
 *
 * @description 관리자용 신고 목록 조회 및 필터링
 * @version 1.0.0
 *
 * 기능:
 * - 신고 목록 조회 (FlashList)
 * - 상태별/심각도별 필터링
 * - 검색 기능 (신고자, 피신고자, 공고명)
 * - Pull-to-refresh
 */

import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useAdminReports, type ReportFilters } from '@/hooks/useAdminReports';
import { ReportCard } from '@/components/admin/ReportCard';
import { EmptyState, Loading } from '@/components/ui';
import { SearchIcon, FilterIcon, AlertTriangleIcon } from '@/components/icons';
import type { Report, ReportStatus } from '@/types/report';

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '검토 대기' },
  { value: 'reviewed', label: '검토 중' },
  { value: 'resolved', label: '처리 완료' },
  { value: 'dismissed', label: '기각' },
];

const SEVERITY_OPTIONS: {
  value: 'low' | 'medium' | 'high' | 'critical' | 'all';
  label: string;
}[] = [
  { value: 'all', label: '전체' },
  { value: 'critical', label: '심각' },
  { value: 'high', label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low', label: '낮음' },
];

// ============================================================================
// Component
// ============================================================================

export default function AdminReportsPage() {
  // 필터 상태
  const [filters, setFilters] = useState<ReportFilters>({
    status: 'pending', // 기본값: 검토 대기
    severity: 'all',
    reporterType: 'all',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 데이터 조회
  const { data: reports, isLoading, isRefetching, error, refetch } = useAdminReports(filters);

  // 검색 필터링 (클라이언트 사이드)
  const filteredReports = useMemo(() => {
    if (!reports) return [];
    if (!searchQuery.trim()) return reports;

    const query = searchQuery.toLowerCase().trim();
    return reports.filter(
      (r) =>
        r.reporterName.toLowerCase().includes(query) ||
        r.targetName.toLowerCase().includes(query) ||
        r.jobPostingTitle?.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query)
    );
  }, [reports, searchQuery]);

  // 핸들러
  const handleReportPress = useCallback((reportId: string) => {
    router.push(`/(admin)/reports/${reportId}`);
  }, []);

  const handleStatusFilter = useCallback((status: ReportStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const handleSeverityFilter = useCallback(
    (severity: 'low' | 'medium' | 'high' | 'critical' | 'all') => {
      setFilters((prev) => ({ ...prev, severity }));
    },
    []
  );

  const handleReporterTypeFilter = useCallback((reporterType: 'employer' | 'employee' | 'all') => {
    setFilters((prev) => ({ ...prev, reporterType }));
  }, []);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: Report }) => (
      <ReportCard report={item} onPress={() => handleReportPress(item.id)} />
    ),
    [handleReportPress]
  );

  const keyExtractor = useCallback((item: Report) => item.id, []);

  // 로딩 상태
  if (isLoading && !reports) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: '신고 관리',
          }}
        />
        <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center">
          <Loading size="large" message="신고 목록을 불러오는 중..." />
        </View>
      </>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: '신고 관리',
          }}
        />
        <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
          <EmptyState
            title="오류 발생"
            description="신고 목록을 불러오는 데 실패했습니다."
            icon="error"
            actionLabel="다시 시도"
            onAction={() => refetch()}
          />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '신고 관리',
        }}
      />
      <SafeAreaView edges={['bottom']} className="flex-1 bg-gray-50 dark:bg-surface-dark">
        {/* 검색바 */}
        <View className="px-4 py-3 bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
          <View className="flex-row items-center bg-gray-100 dark:bg-surface rounded-lg px-3 py-2">
            <SearchIcon size={20} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="신고자, 피신고자, 공고명 검색"
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowFilters(!showFilters)}
              hitSlop={8}
              accessibilityLabel="필터 토글"
            >
              <FilterIcon size={20} color={showFilters ? '#A855F7' : '#9CA3AF'} />
            </Pressable>
          </View>
        </View>

        {/* 상태 필터 */}
        <View className="bg-white dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 py-2"
            contentContainerStyle={{ gap: 8, alignItems: 'center' }}
          >
            {STATUS_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => handleStatusFilter(option.value)}
                className={`px-4 py-2 rounded-full ${
                  filters.status === option.value ? 'bg-primary-600' : 'bg-gray-200 dark:bg-surface'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    filters.status === option.value
                      ? 'text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* 확장 필터 패널 */}
        {showFilters && (
          <View className="px-4 py-3 bg-gray-50 dark:bg-surface border-b border-gray-200 dark:border-surface-overlay">
            {/* 심각도 필터 */}
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              심각도
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {SEVERITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleSeverityFilter(option.value)}
                  className={`px-3 py-1.5 rounded-full ${
                    filters.severity === option.value
                      ? 'bg-primary-600'
                      : 'bg-gray-200 dark:bg-surface'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      filters.severity === option.value
                        ? 'text-white'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* 신고자 유형 필터 */}
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              신고자 유형
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[
                { value: 'all' as const, label: '전체' },
                { value: 'employer' as const, label: '구인자 → 스태프' },
                { value: 'employee' as const, label: '구직자 → 구인자' },
              ].map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleReporterTypeFilter(option.value)}
                  className={`px-3 py-1.5 rounded-full ${
                    filters.reporterType === option.value
                      ? 'bg-primary-600'
                      : 'bg-gray-200 dark:bg-surface'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      filters.reporterType === option.value
                        ? 'text-white'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* 결과 개수 */}
        <View className="px-4 py-2">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            총 {filteredReports.length}건의 신고
          </Text>
        </View>

        {/* 신고 목록 */}
        <FlashList
          data={filteredReports}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
          estimatedItemSize={140}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <AlertTriangleIcon size={48} color="#9CA3AF" />
              <Text className="text-lg font-medium text-gray-900 dark:text-white mt-4">
                신고 없음
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
                해당 조건의 신고가 없습니다.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        />
      </SafeAreaView>
    </>
  );
}

/**
 * UNIQN Mobile - Admin Settings
 * 시스템 설정 페이지
 *
 * @description Feature Flag 현황 및 앱 정보 표시
 * @version 1.0.0
 *
 * 기능:
 * - 점검 모드 상태 표시 (강조)
 * - Feature Flag 목록 표시 (읽기 전용)
 * - 앱 버전 정보 표시
 * - 캐시 새로고침
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useAllFeatureFlags } from '@/hooks/useFeatureFlag';
import { featureFlagService, type FeatureFlagKey } from '@/services/featureFlagService';
import { APP_VERSION, BUILD_NUMBER, ENVIRONMENT } from '@/constants/version';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/stores/toastStore';

// ============================================================================
// Feature Flag 메타데이터
// ============================================================================

interface FlagMetadata {
  label: string;
  description: string;
  critical?: boolean;
}

const FLAG_METADATA: Record<FeatureFlagKey, FlagMetadata> = {
  maintenance_mode: {
    label: '점검 모드',
    description: '앱 전체 점검 모드 활성화',
    critical: true,
  },
  enable_social_login: {
    label: '소셜 로그인',
    description: 'Google/Apple 로그인 기능',
  },
  enable_biometric: {
    label: '생체 인증',
    description: '지문/Face ID 인증 기능',
  },
  enable_push_notifications: {
    label: '푸시 알림',
    description: '푸시 알림 수신 기능',
  },
  enable_qr_checkin: {
    label: 'QR 출퇴근',
    description: 'QR 코드 기반 출퇴근 기능',
  },
  enable_location_search: {
    label: '위치 기반 검색',
    description: '현재 위치 기반 공고 검색',
  },
  enable_new_design: {
    label: '새 디자인 시스템',
    description: '업데이트된 UI 디자인 적용',
  },
  enable_debug_mode: {
    label: '디버그 모드',
    description: '개발자용 디버그 정보 표시',
  },
  enable_offline_mode: {
    label: '오프라인 모드',
    description: '오프라인 상태에서도 앱 사용',
  },
  enable_settlement: {
    label: '정산 기능',
    description: '급여 정산 및 내역 조회',
  },
  enable_advanced_filters: {
    label: '고급 필터',
    description: '공고 검색 고급 필터 옵션',
  },
  enable_notification_grouping: {
    label: '알림 그룹핑',
    description: '알림을 카테고리별로 그룹화',
  },
};

// ============================================================================
// 섹션 컴포넌트
// ============================================================================

/**
 * 점검 모드 섹션 (강조 표시)
 */
function MaintenanceModeSection({ enabled }: { enabled: boolean }) {
  return (
    <View className="mx-4 mt-4">
      <View
        className={`p-4 rounded-xl ${
          enabled
            ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500'
            : 'bg-white dark:bg-surface'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Text className="text-2xl mr-3">{enabled ? '🔴' : '🟢'}</Text>
            <View className="flex-1">
              <Text
                className={`font-semibold text-base ${
                  enabled ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'
                }`}
              >
                점검 모드
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {enabled ? '현재 점검 중입니다' : '앱이 정상 운영 중입니다'}
              </Text>
            </View>
          </View>
          <Badge variant={enabled ? 'error' : 'success'} size="md">
            {enabled ? 'ON' : 'OFF'}
          </Badge>
        </View>
        {enabled && (
          <Text className="text-xs text-red-600 dark:text-red-400 mt-3">
            점검 모드 변경은 Firebase 콘솔에서 설정해주세요.
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Feature Flag 아이템
 */
function FeatureFlagItem({
  value,
  metadata,
  isLast,
}: {
  value: boolean;
  metadata: FlagMetadata;
  isLast: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between p-4 ${
        !isLast ? 'border-b border-gray-100 dark:border-surface-overlay' : ''
      }`}
    >
      <View className="flex-1 mr-4">
        <Text className="font-medium text-gray-900 dark:text-white">{metadata.label}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {metadata.description}
        </Text>
      </View>
      <Badge variant={value ? 'success' : 'secondary'} size="sm">
        {value ? 'ON' : 'OFF'}
      </Badge>
    </View>
  );
}

/**
 * Feature Flag 섹션
 */
function FeatureFlagSection({ flags }: { flags: Record<FeatureFlagKey, boolean> }) {
  const flagKeys = (Object.keys(flags) as FeatureFlagKey[])
    .filter((key) => key !== 'maintenance_mode') // 점검 모드는 별도 섹션
    .sort((a, b) =>
      (FLAG_METADATA[a]?.label || a).localeCompare(FLAG_METADATA[b]?.label || b, 'ko')
    );

  return (
    <View className="mx-4 mt-6">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">기능 플래그</Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Firebase Remote Config에서 관리되는 기능 플래그입니다.
      </Text>
      <View className="bg-white dark:bg-surface rounded-xl overflow-hidden">
        {flagKeys.map((key, index) => (
          <FeatureFlagItem
            key={key}
            value={flags[key]}
            metadata={FLAG_METADATA[key]}
            isLast={index === flagKeys.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * 앱 정보 섹션
 */
function AppInfoSection() {
  return (
    <View className="mx-4 mt-6">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">앱 정보</Text>
      <View className="bg-white dark:bg-surface rounded-xl p-4">
        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-500 dark:text-gray-400">앱 버전</Text>
          <Text className="font-medium text-gray-900 dark:text-white">{APP_VERSION}</Text>
        </View>
        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-500 dark:text-gray-400">빌드 번호</Text>
          <Text className="font-medium text-gray-900 dark:text-white">{BUILD_NUMBER}</Text>
        </View>
        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-500 dark:text-gray-400">플랫폼</Text>
          <Text className="font-medium text-gray-900 dark:text-white">
            {Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-500 dark:text-gray-400">환경</Text>
          <Badge variant={ENVIRONMENT === 'production' ? 'success' : 'warning'} size="sm">
            {ENVIRONMENT === 'production' ? 'Production' : 'Development'}
          </Badge>
        </View>
      </View>
    </View>
  );
}

/**
 * 캐시 관리 섹션
 */
function CacheManagementSection({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <View className="mx-4 mt-6 mb-8">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">캐시 관리</Text>
      <View className="bg-white dark:bg-surface rounded-xl p-4">
        <Text className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Feature Flag 캐시를 초기화하고 최신 설정을 가져옵니다.
        </Text>
        <Pressable
          onPress={onRefresh}
          disabled={isRefreshing}
          className={`flex-row items-center justify-center py-3 px-4 rounded-lg ${
            isRefreshing ? 'bg-gray-200 dark:bg-surface' : 'bg-primary-600 active:bg-primary-700'
          }`}
        >
          <Text
            className={`font-medium ${
              isRefreshing ? 'text-gray-500 dark:text-gray-400' : 'text-white'
            }`}
          >
            {isRefreshing ? '새로고침 중...' : '캐시 새로고침'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export default function AdminSettingsPage() {
  const flags = useAllFeatureFlags();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToast();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      featureFlagService.clearCache();
      await featureFlagService.fetchAndActivate();
      toast.success('설정을 새로고침했습니다');
    } catch {
      toast.error('새로고침에 실패했습니다');
    } finally {
      setIsRefreshing(false);
    }
  }, [toast]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '시스템 설정',
          headerStyle: {
            backgroundColor: undefined, // 테마에 따라 자동
          },
        }}
      />
      <SafeAreaView edges={['bottom']} className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        >
          {/* 점검 모드 섹션 (강조) */}
          <MaintenanceModeSection enabled={flags.maintenance_mode} />

          {/* Feature Flag 섹션 */}
          <FeatureFlagSection flags={flags} />

          {/* 앱 정보 섹션 */}
          <AppInfoSection />

          {/* 캐시 관리 섹션 */}
          <CacheManagementSection onRefresh={handleRefresh} isRefreshing={isRefreshing} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

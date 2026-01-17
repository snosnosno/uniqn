/**
 * UNIQN Mobile - Application Cancel Request Screen
 * 지원 취소 요청 화면 (확정된 지원 취소 요청)
 *
 * @version 1.1.0
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CancellationRequestForm } from '@/components/applications';
import { Button } from '@/components/ui/Button';
import { useApplications } from '@/hooks';
import { useThemeStore } from '@/stores';
import { logger } from '@/utils/logger';
import { getApplicationById } from '@/services/applicationService';
import type { Application } from '@/types';

// ============================================================================
// Loading Component
// ============================================================================

function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
      <ActivityIndicator size="large" color="#6366f1" />
      <Text className="mt-4 text-gray-500 dark:text-gray-400">
        지원 정보를 불러오는 중...
      </Text>
    </View>
  );
}

// ============================================================================
// Error Component
// ============================================================================

function ErrorState({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Text className="text-4xl mb-4">😢</Text>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        오류가 발생했습니다
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
        {message}
      </Text>
      <Button onPress={onBack} variant="outline">
        돌아가기
      </Button>
    </View>
  );
}

// ============================================================================
// Cannot Cancel Component
// ============================================================================

function CannotCancelState({
  reason,
  onBack,
}: {
  reason: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Text className="text-4xl mb-4">⚠️</Text>
      <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        취소 요청 불가
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
        {reason}
      </Text>
      <Button onPress={onBack} variant="outline">
        돌아가기
      </Button>
    </View>
  );
}

// ============================================================================
// Success Component
// ============================================================================

function SuccessState() {
  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Text className="text-6xl mb-4">📨</Text>
      <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        취소 요청 완료
      </Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center">
        구인자가 검토 후 승인/거절합니다.{'\n'}
        결과는 알림으로 안내해드립니다.
      </Text>
      <ActivityIndicator className="mt-6" color="#6366f1" />
    </View>
  );
}

// ============================================================================
// Screen Component
// ============================================================================

export default function CancellationRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDarkMode } = useThemeStore();
  const [showForm, setShowForm] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);

  // 직접 조회한 Application 상태
  const [application, setApplication] = useState<Application | null>(null);
  const [isLoadingApplication, setIsLoadingApplication] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    requestCancellation,
    isRequestingCancellation,
  } = useApplications();

  // Application 직접 조회 (캐시 대신 최신 데이터)
  useEffect(() => {
    async function fetchApplication() {
      if (!id) {
        setLoadError('지원서 ID가 없습니다');
        setIsLoadingApplication(false);
        return;
      }

      try {
        setIsLoadingApplication(true);
        setLoadError(null);

        const result = await getApplicationById(id);

        // 디버깅: Application 상태 로깅
        logger.info('취소 요청 화면 - Application 조회 결과', {
          applicationId: id,
          found: !!result,
          status: result?.status,
          hasCancellationRequest: !!result?.cancellationRequest,
          cancellationRequestStatus: result?.cancellationRequest?.status,
        });

        setApplication(result);
      } catch (error) {
        logger.error('지원서 조회 실패', error as Error, { applicationId: id });
        setLoadError('지원서를 불러오는 중 오류가 발생했습니다');
      } finally {
        setIsLoadingApplication(false);
      }
    }

    fetchApplication();
  }, [id]);

  // 취소 요청 가능 여부
  const canRequestCancel = (() => {
    if (!application) return { allowed: false, reason: '지원서를 찾을 수 없습니다' };

    // 확정 또는 취소 요청 대기 중 상태 확인
    if (application.status !== 'confirmed' && application.status !== 'cancellation_pending') {
      return { allowed: false, reason: '확정된 지원만 취소 요청이 가능합니다' };
    }

    // 이미 취소 요청이 진행 중인 경우
    if (application.status === 'cancellation_pending' || application.cancellationRequest?.status === 'pending') {
      return { allowed: false, reason: '이미 취소 요청이 진행 중입니다' };
    }

    // 이전 취소 요청이 거절된 경우
    if (application.cancellationRequest?.status === 'rejected') {
      return { allowed: false, reason: '이전 취소 요청이 거절되었습니다. 구인자에게 직접 문의해주세요.' };
    }

    return { allowed: true, reason: '' };
  })();

  // 취소 요청 제출 핸들러
  const handleSubmit = useCallback(
    (applicationId: string, reason: string) => {
      logger.info('취소 요청 제출', { applicationId });

      requestCancellation(
        { applicationId, reason },
        {
          onSuccess: () => {
            setShowForm(false);
            setIsSuccess(true);
            // 성공 후 스케줄 페이지로 이동
            setTimeout(() => {
              router.replace('/(app)/(tabs)/schedule');
            }, 2000);
          },
        }
      );
    },
    [requestCancellation]
  );

  // 폼 닫기 핸들러
  const handleClose = useCallback(() => {
    router.back();
  }, []);

  // 로딩 상태
  if (isLoadingApplication) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '취소 요청',
            headerStyle: {
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          }}
        />
        <LoadingState />
      </SafeAreaView>
    );
  }

  // 조회 에러
  if (loadError) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '취소 요청',
            headerStyle: {
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          }}
        />
        <ErrorState
          message={loadError}
          onBack={handleClose}
        />
      </SafeAreaView>
    );
  }

  // 지원서를 찾을 수 없는 경우
  if (!application) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '취소 요청',
            headerStyle: {
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          }}
        />
        <ErrorState
          message="지원서를 찾을 수 없습니다"
          onBack={handleClose}
        />
      </SafeAreaView>
    );
  }

  // 취소 요청 불가능한 경우
  if (!canRequestCancel.allowed) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '취소 요청',
            headerStyle: {
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          }}
        />
        <CannotCancelState
          reason={canRequestCancel.reason}
          onBack={handleClose}
        />
      </SafeAreaView>
    );
  }

  // 성공 상태
  if (isSuccess) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '취소 요청 완료',
            headerStyle: {
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#111827',
          }}
        />
        <SuccessState />
      </SafeAreaView>
    );
  }

  // 폼 표시
  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <CancellationRequestForm
        application={application}
        visible={showForm}
        isSubmitting={isRequestingCancellation}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    </SafeAreaView>
  );
}

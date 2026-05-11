/**
 * Authenticated app layout.
 */

import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationPermissionScreen } from '@/components/onboarding';
import { DeletionScheduledModal } from '@/components/auth/DeletionScheduledModal';
import { NetworkErrorBoundary, Loading } from '@/components/ui';
import { LAYOUT } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
import { useDeletionScheduledGuard } from '@/hooks/useDeletionScheduledGuard';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { useOnboarding } from '@/hooks/useOnboarding';
import { AUTH_ENTRY_ROUTES, getAuthenticatedEntryRoute } from '@/shared/navigation/authRedirect';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { isWeb } from '@/utils/platform';
import { logger } from '@/utils/logger';

export default function AppLayout() {
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { isLoading, profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const segments = useSegments();

  const isTabsRoute = segments[0] === '(app)' && segments.includes('(tabs)');
  const loadingOverlayBottomOffset = isTabsRoute ? LAYOUT.TAB_BAR_HEIGHT + insets.bottom : 0;

  const shouldInitializeNotifications =
    !!profile &&
    getAuthenticatedEntryRoute({
      socialProvider: profile.socialProvider ?? null,
      phoneVerified: profile.phoneVerified ?? null,
      profileCompleted: profile.profileCompleted ?? null,
      identityVerified: profile.identityVerified ?? null,
    }) === AUTH_ENTRY_ROUTES.appHome;

  const {
    needsNotificationOnboarding,
    completeNotificationOnboarding,
    isLoading: isOnboardingLoading,
  } = useOnboarding();

  const {
    isInitialized: isNotificationHandlerInitialized,
    requestPermission,
    openSettings,
    permissionStatus,
    isRequestingPermission,
  } = useNotificationHandler({
    enabled: shouldInitializeNotifications,
    autoInitialize: shouldInitializeNotifications,
    autoRegisterToken: shouldInitializeNotifications,
  });

  const handleRequestPermission = useCallback(async () => {
    try {
      const granted = await requestPermission();

      if (granted) {
        completeNotificationOnboarding();
      }

      return granted;
    } catch (error) {
      logger.error('Notification permission request failed', error as Error, {
        component: 'AppLayout',
        operation: 'handleRequestPermission',
      });
      return false;
    }
  }, [completeNotificationOnboarding, requestPermission]);

  const handleDismiss = useCallback(() => {
    completeNotificationOnboarding();
  }, [completeNotificationOnboarding]);

  useEffect(() => {
    if (
      shouldInitializeNotifications &&
      needsNotificationOnboarding &&
      permissionStatus === 'granted'
    ) {
      completeNotificationOnboarding();
    }
  }, [
    completeNotificationOnboarding,
    needsNotificationOnboarding,
    permissionStatus,
    shouldInitializeNotifications,
  ]);

  const showLoading = isLoading || isOnboardingLoading;
  const showOnboarding =
    !isWeb &&
    shouldInitializeNotifications &&
    !showLoading &&
    needsNotificationOnboarding &&
    isNotificationHandlerInitialized &&
    permissionStatus !== null &&
    permissionStatus !== 'granted';

  // P2 #5 — 탈퇴 grace period 중 재로그인 시 명시적 결정 강제
  const { deletion: pendingDeletion, dismiss: dismissDeletion } = useDeletionScheduledGuard();

  return (
    <NetworkErrorBoundary name="AppLayout">
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            statusBarStyle: 'auto',
            statusBarBackgroundColor: 'transparent',
            contentStyle: {
              backgroundColor: getLayoutColor(isDark, 'content'),
            },
          }}
        >
          <Stack.Screen
            name="home"
            options={{
              presentation: 'card',
            }}
          />
          <Stack.Screen
            name="profile-setup"
            options={{
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              presentation: 'card',
            }}
          />
        </Stack>

        {showLoading && (
          <View
            style={[
              styles.overlay,
              loadingOverlayBottomOffset > 0 && { bottom: loadingOverlayBottomOffset },
            ]}
          >
            <Loading variant="layout" />
          </View>
        )}

        {showOnboarding && (
          <View style={styles.fullscreenOverlay}>
            <NotificationPermissionScreen
              stage={permissionStatus === 'denied' ? 'settings' : 'request'}
              onRequestPermission={handleRequestPermission}
              onOpenSettings={openSettings}
              onDismiss={handleDismiss}
              isLoading={isRequestingPermission}
            />
          </View>
        )}

        {pendingDeletion && (
          <DeletionScheduledModal
            visible
            scheduledFor={pendingDeletion.scheduledDeletionAt}
            onKept={dismissDeletion}
          />
        )}
      </View>
    </NetworkErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  fullscreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});

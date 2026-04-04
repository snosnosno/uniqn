/**
 * Authenticated app layout.
 */

import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationPermissionScreen } from '@/components/onboarding';
import { NetworkErrorBoundary, Loading } from '@/components/ui';
import { LAYOUT } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
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
    }) === AUTH_ENTRY_ROUTES.appTabs;

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

  return (
    <NetworkErrorBoundary name="AppLayout">
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: {
              backgroundColor: getLayoutColor(isDark, 'content'),
            },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="profile-setup"
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              presentation: 'card',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="notices"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="support"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen name="settings" />
          <Stack.Screen
            name="reviews"
            options={{
              headerShown: false,
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

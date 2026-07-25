/**
 * UNIQN Mobile - Settings Screen
 * 설정 메인 화면
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import { useCallback } from 'react';
import { View, Text, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Card, Divider } from '@/components/ui';
import { DangerZone, SettingItem } from '@/components/settings';
import { BellIcon, LockIcon, LogOutIcon, ChevronRightIcon, TrashIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { useModalStore } from '@/stores/modalStore';
import { useToastStore } from '@/stores/toastStore';
import { useAuth } from '@/hooks/useAuth';
import { useIsAppleUser } from '@/hooks/auth/useCurrentUser';
import { useClearCache } from '@/hooks/useClearCache';
import { useAutoLogin, useBiometricAuth, AUTO_LOGIN_HELPER_TEXT } from '@/hooks';
import { signOut } from '@/services/auth';
import { versionInfo } from '@/constants/version';
import { logger } from '@/utils/logger';
import { triggerHaptic } from '@/utils/haptics';

// 태양 아이콘 (다크모드용)
const SunIcon = ({
  size = 24,
  color = SECONDARY_PALETTE[500],
}: {
  size?: number;
  color?: string;
}) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Text className="font-sans" style={{ fontSize: size * 0.7, color }}>
      {''}
    </Text>
  </View>
);

export default function SettingsScreen() {
  const { isAuthenticated } = useAuth();

  // Apple 사용자는 비밀번호가 없어 비밀번호 변경 항목을 숨긴다
  const isAppleUser = useIsAppleUser();

  // 테마 설정
  const { isDarkMode, setTheme } = useThemeStore();

  const addToast = useToastStore((state) => state.addToast);

  // 모달 스토어
  const { showConfirm } = useModalStore();

  // 캐시 삭제
  const { clearCache, isClearing, cacheStats } = useClearCache();

  // 자동 로그인 설정
  const { autoLoginEnabled, setAutoLoginEnabled, isLoading: isAutoLoginLoading } = useAutoLogin();

  // 생체 인증 설정
  const {
    isEnabled: isBiometricEnabled,
    isAvailable: isBiometricAvailable,
    isLoading: isBiometricLoading,
    isAuthenticating: isBiometricAuthenticating,
    biometricTypeName,
    setEnabled: setBiometricEnabled,
    refresh: refreshBiometricState,
  } = useBiometricAuth();

  // 다크모드 토글 (impeccable v2 §17 — 토글은 Light 햅틱)
  const handleDarkModeToggle = (value: boolean) => {
    void triggerHaptic('light');
    setTheme(value ? 'dark' : 'light');
  };

  // 자동 로그인 토글 (§17 — Light)
  const handleAutoLoginToggle = async (value: boolean) => {
    void triggerHaptic('light');
    try {
      await setAutoLoginEnabled(value);
      await refreshBiometricState();
    } catch {
      // 에러 발생 시 이전 상태 유지 (useAutoLogin에서 로깅됨)
    }
  };

  // 생체 인증 토글 (§17 — Light)
  const handleBiometricToggle = async (value: boolean) => {
    void triggerHaptic('light');
    await setBiometricEnabled(value);
  };

  // 캐시 삭제 핸들러
  const handleClearCache = () => {
    showConfirm('캐시 삭제', '저장된 캐시 데이터를 삭제합니다.\n로그인 정보는 유지됩니다.', () => {
      clearCache({ keepAuth: true });
    });
  };

  // 로그아웃 핸들러 (impeccable v2 §17 — 결정 확정 시 Warning 햅틱)
  const handleLogout = useCallback(() => {
    showConfirm(
      '로그아웃',
      '로그아웃 하시겠어요?\n자동 로그인이 켜져 있어도 다시 로그인이 필요합니다.',
      async () => {
        try {
          void triggerHaptic('warning');
          await signOut();
          router.replace('/(auth)/login');
        } catch (error) {
          logger.error('로그아웃 실패', error as Error);
          addToast({
            type: 'error',
            message: '로그아웃에 실패했어요. 잠시 후 다시 시도해주세요.',
          });
        }
      }
    );
  }, [addToast, showConfirm]);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="설정" fallbackHref="/(app)/(tabs)/profile" />
      <ScrollView className="flex-1" contentContainerClassName="p-4">
        {/* 알림 설정 — 전용 화면으로 이동 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            알림
          </Text>
          <SettingItem
            icon={<BellIcon size={22} color={SECONDARY_PALETTE[500]} />}
            label="알림 설정"
            onPress={() => router.push('/(app)/settings/notifications')}
          />
        </Card>

        {/* 계정 설정 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            계정
          </Text>
          {!isAppleUser && (
            <SettingItem
              icon={<LockIcon size={22} color={SECONDARY_PALETTE[500]} />}
              label="비밀번호 변경"
              onPress={() => router.push('/(app)/settings/change-password')}
            />
          )}
          {isAuthenticated && (
            <>
              {!isAppleUser && <Divider spacing="sm" />}
              <SettingItem
                icon={<LockIcon size={22} color={SECONDARY_PALETTE[500]} />}
                label="자동 로그인"
                rightElement={
                  <Switch
                    value={autoLoginEnabled}
                    onValueChange={handleAutoLoginToggle}
                    disabled={isAutoLoginLoading}
                    testID="settings-auto-login-switch"
                    trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
                    thumbColor={autoLoginEnabled ? '#FFFFFF' : SECONDARY_PALETTE[50]}
                  />
                }
              />
              <Text className="ml-[34px] mt-1 text-xs text-content-muted font-sans">
                {AUTO_LOGIN_HELPER_TEXT}
              </Text>
              {isBiometricAvailable && (
                <>
                  <Divider spacing="sm" />
                  <SettingItem
                    icon={<LockIcon size={22} color={SECONDARY_PALETTE[500]} />}
                    label={biometricTypeName}
                    rightElement={
                      <Switch
                        value={isBiometricEnabled}
                        onValueChange={handleBiometricToggle}
                        disabled={
                          isBiometricLoading || isBiometricAuthenticating || !autoLoginEnabled
                        }
                        trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
                        thumbColor={isBiometricEnabled ? '#FFFFFF' : SECONDARY_PALETTE[50]}
                      />
                    }
                  />
                </>
              )}
            </>
          )}
        </Card>

        {/* 앱 설정 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            앱 설정
          </Text>
          <SettingItem
            icon={<SunIcon size={22} color={SECONDARY_PALETTE[500]} />}
            label="다크 모드"
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={handleDarkModeToggle}
                trackColor={{ false: SECONDARY_PALETTE[200], true: '#D4AF37' }}
                thumbColor={isDarkMode ? '#FFFFFF' : SECONDARY_PALETTE[50]}
              />
            }
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<TrashIcon size={22} color={SECONDARY_PALETTE[500]} />}
            label="캐시 삭제"
            value={cacheStats ? `${cacheStats.queryCount}개 항목` : ''}
            onPress={handleClearCache}
            rightElement={
              isClearing ? (
                <ActivityIndicator size="small" color={SECONDARY_PALETTE[500]} />
              ) : (
                <View className="flex-row items-center">
                  {cacheStats && (
                    <Text className="mr-2 text-content-muted font-sans">
                      {cacheStats.queryCount}개 항목
                    </Text>
                  )}
                  <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
                </View>
              )
            }
          />
        </Card>

        {/* 앱 정보 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            정보
          </Text>
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="버전"
            value={versionInfo.displayVersion}
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="이용약관"
            onPress={() => router.push('/(app)/settings/terms')}
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="개인정보처리방침"
            onPress={() => router.push('/(app)/settings/privacy')}
          />
          <Divider spacing="sm" />
          <SettingItem
            icon={<View className="h-[22px] w-[22px]" />}
            label="사업자정보"
            onPress={() => router.push('/(app)/settings/business-info')}
          />
          {isAuthenticated && (
            <>
              <Divider spacing="sm" />
              <SettingItem
                icon={<View className="h-[22px] w-[22px]" />}
                label="내 정보 보기"
                onPress={() => router.push('/(app)/settings/my-data')}
              />
            </>
          )}
        </Card>

        {/* 로그아웃 */}
        {isAuthenticated && (
          <Card className="mb-4">
            <SettingItem
              icon={<LogOutIcon size={22} color={SECONDARY_PALETTE[500]} />}
              label="로그아웃"
              onPress={handleLogout}
            />
          </Card>
        )}

        {/* 위험 영역 - 계정 삭제 */}
        {isAuthenticated && (
          <DangerZone onDeleteAccount={() => router.push('/(app)/settings/delete-account')} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

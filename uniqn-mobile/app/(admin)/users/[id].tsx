/**
 * UNIQN Mobile - Admin User Detail
 *
 * @description 사용자 상세 정보 및 권한 관리 페이지
 * @version 1.0.0
 */

import { SECONDARY_PALETTE, STATUS_COLORS } from '@/constants/colors';
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '@/components/icons';
import { useAdminUserDetail, useUpdateUserRole, useSetUserActive } from '@/hooks/useAdminDashboard';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import { useModal } from '@/stores/modalStore';
import { formatE164ToDisplay } from '@/utils/phone';
import type { UserRole } from '@/types/role';

const ROLE_OPTIONS: { role: UserRole; label: string; description: string }[] = [
  { role: 'staff', label: '스태프', description: '지원 및 스케줄 확인만 가능' },
  { role: 'employer', label: '구인자', description: '공고 등록 및 지원자 관리 가능' },
  { role: 'admin', label: '관리자', description: '모든 기능 접근 가능' },
];

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-center py-3 border-b border-secondary-100 dark:border-surface-overlay">
      <View className="w-10">{icon}</View>
      <View className="flex-1">
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-1 font-sans">
          {label}
        </Text>
        {typeof value === 'string' ? (
          <Text className="text-base text-content-primary dark:text-off-white font-sans">
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export default function AdminUserDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addToast } = useToastStore();
  const { showConfirm } = useModal();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const {
    data: user,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useAdminUserDetail(id ?? '', !!id);

  const updateRoleMutation = useUpdateUserRole();
  const setActiveMutation = useSetUserActive();

  const handleRoleChange = useCallback(async () => {
    if (!id || !selectedRole || selectedRole === user?.role) return;

    showConfirm('역할 변경', '사용자의 역할을 변경하시겠습니까?', async () => {
      try {
        await updateRoleMutation.mutateAsync({
          userId: id,
          newRole: selectedRole,
          reason: '관리자에 의한 역할 변경',
        });
        addToast({ type: 'success', message: '역할이 변경되었습니다.' });
        setSelectedRole(null);
      } catch {
        addToast({ type: 'error', message: '역할 변경에 실패했습니다.' });
      }
    });
  }, [id, selectedRole, user?.role, updateRoleMutation, addToast, showConfirm]);

  const handleToggleActive = useCallback(() => {
    if (!id || !user) return;

    const newStatus = !user.isActive;
    const title = newStatus ? '계정 활성화' : '계정 비활성화';
    const message = newStatus
      ? '이 계정을 활성화하시겠습니까?'
      : '이 계정을 비활성화하시겠습니까? 사용자는 로그인할 수 없게 됩니다.';

    showConfirm(title, message, async () => {
      try {
        await setActiveMutation.mutateAsync({
          userId: id,
          isActive: newStatus,
          reason: '관리자에 의한 상태 변경',
        });
        addToast({
          type: 'success',
          message: newStatus ? '계정이 활성화되었습니다.' : '계정이 비활성화되었습니다.',
        });
      } catch {
        addToast({ type: 'error', message: '상태 변경에 실패했습니다.' });
      }
    });
  }, [id, user, setActiveMutation, addToast, showConfirm]);

  const getRoleBadgeVariant = (role: UserRole): 'error' | 'primary' | 'success' => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'employer':
        return 'primary';
      default:
        return 'success';
    }
  };

  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case 'admin':
        return '관리자';
      case 'employer':
        return '구인자';
      default:
        return '스태프';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="사용자 상세" fallbackHref="/(admin)/users" />
        <View className="flex-1 bg-surface-page dark:bg-surface items-center justify-center">
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400 font-sans">
            사용자 정보를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="사용자 상세" fallbackHref="/(admin)/users" />
        <View className="flex-1 bg-surface-page dark:bg-surface">
          <EmptyState
            title="사용자를 찾을 수 없음"
            description="요청하신 사용자 정보를 찾을 수 없습니다."
            actionLabel="목록으로"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="사용자 상세" fallbackHref="/(admin)/users" />
      <ScrollView
        className="flex-1 bg-surface-page dark:bg-surface"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#D4AF37"
          />
        }
      >
        {/* Profile Header */}
        <View className="bg-white dark:bg-surface px-4 py-6 items-center border-b border-divider">
          {user.photoURL ? (
            <Avatar
              source={user.photoURL}
              name={user.name}
              size="xl"
              className="mb-3"
              blurhash={user.photoURLBlurhash}
            />
          ) : (
            <View className="w-20 h-20 rounded-sm bg-secondary-200 dark:bg-surface items-center justify-center mb-3">
              <UserIcon size={40} color={SECONDARY_PALETTE[400]} />
            </View>
          )}
          <Text className="text-xl font-display text-content-primary dark:text-off-white mb-1">
            {user.name}
          </Text>
          <View className="flex-row items-center">
            <Badge variant={getRoleBadgeVariant(user.role)} size="md">
              {getRoleLabel(user.role)}
            </Badge>
            {!user.isActive && (
              <View className="ml-2 px-2 py-1 bg-error-50 dark:bg-error-900/30 rounded">
                <Text className="text-xs text-error-600 dark:text-error-400 font-sans">비활성</Text>
              </View>
            )}
            {user.isVerified && (
              <View className="ml-2 px-2 py-1 bg-success-50 dark:bg-success-900/30 rounded">
                <Text className="text-xs text-success-600 dark:text-success-400 font-sans">
                  인증됨
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Basic Info */}
        <View className="bg-white dark:bg-surface mt-3 px-4 pt-4 pb-2">
          <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            기본 정보
          </Text>
          <InfoRow
            icon={<EnvelopeIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="이메일"
            value={user.email}
          />
          {user.phone && (
            <InfoRow
              icon={<PhoneIcon size={20} color={SECONDARY_PALETTE[500]} />}
              label="전화번호"
              value={formatE164ToDisplay(user.phone)}
            />
          )}
          <InfoRow
            icon={<CalendarIcon size={20} color={SECONDARY_PALETTE[500]} />}
            label="가입일"
            value={formatDate(user.createdAt)}
          />
          <InfoRow
            icon={
              user.isVerified ? (
                <ShieldCheckIcon size={20} color={STATUS_COLORS.success} />
              ) : (
                <XCircleIcon size={20} color={STATUS_COLORS.error} />
              )
            }
            label="본인인증"
            value={user.isVerified ? '인증 완료' : '미인증'}
          />
        </View>

        {/* Role Management */}
        <View className="bg-white dark:bg-surface mt-3 px-4 pt-4 pb-4">
          <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            역할 관리
          </Text>
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 mb-3 font-sans">
            사용자의 역할을 변경합니다. 역할에 따라 접근 가능한 기능이 달라집니다.
          </Text>
          {ROLE_OPTIONS.map((option) => (
            <Pressable
              key={option.role}
              onPress={() => setSelectedRole(option.role)}
              className={
                'flex-row items-center p-3 rounded-lg mb-2 border ' +
                ((selectedRole ?? user.role) === option.role
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-secondary-200 dark:border-surface-overlay')
              }
            >
              <View
                className={
                  'w-5 h-5 rounded-sm border-2 mr-3 items-center justify-center ' +
                  ((selectedRole ?? user.role) === option.role
                    ? 'border-primary-500'
                    : 'border-secondary-300 dark:border-surface-overlay')
                }
              >
                {(selectedRole ?? user.role) === option.role && (
                  <View className="w-2.5 h-2.5 rounded-sm bg-primary-500" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-sans-medium text-content-primary dark:text-off-white">
                  {option.label}
                </Text>
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  {option.description}
                </Text>
              </View>
            </Pressable>
          ))}
          {selectedRole && selectedRole !== user.role && (
            <Button
              onPress={handleRoleChange}
              loading={updateRoleMutation.isPending}
              className="mt-3"
            >
              역할 변경
            </Button>
          )}
        </View>

        {/* Account Actions */}
        <View className="bg-white dark:bg-surface mt-3 px-4 pt-4 pb-4 mb-8">
          <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            계정 관리
          </Text>
          <View className="mt-3">
            <Pressable
              onPress={handleToggleActive}
              disabled={setActiveMutation.isPending}
              className={
                'py-3 px-4 rounded-lg items-center ' +
                (user.isActive
                  ? 'bg-error-50 dark:bg-error-900/20'
                  : 'bg-success-50 dark:bg-success-900/20')
              }
            >
              {setActiveMutation.isPending ? (
                <ActivityIndicator size="small" color={user.isActive ? '#DC2626' : '#22C55E'} />
              ) : (
                <Text
                  className={
                    user.isActive
                      ? 'text-error-600 dark:text-error-400 font-sans-medium'
                      : 'text-success-600 dark:text-success-400 font-sans-medium'
                  }
                >
                  {user.isActive ? '계정 비활성화' : '계정 활성화'}
                </Text>
              )}
            </Pressable>
            <Text className="text-xs text-secondary-500 dark:text-secondary-400 mt-2 text-center font-sans">
              {user.isActive
                ? '비활성화하면 사용자가 로그인할 수 없습니다.'
                : '활성화하면 사용자가 다시 로그인할 수 있습니다.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

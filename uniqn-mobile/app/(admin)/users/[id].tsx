/**
 * UNIQN Mobile - Admin User Detail
 *
 * @description 사용자 상세 정보 및 권한 관리 페이지
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '@/components/icons';
import {
  useAdminUserDetail,
  useUpdateUserRole,
  useSetUserActive,
} from '@/hooks/useAdminDashboard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import type { UserRole } from '@/types/common';

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
    <View className="flex-row items-center py-3 border-b border-gray-100 dark:border-gray-700">
      <View className="w-10">{icon}</View>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
        {typeof value === 'string' ? (
          <Text className="text-base text-gray-900 dark:text-white">{value}</Text>
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

    Alert.alert(
      '역할 변경',
      '사용자의 역할을 변경하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          onPress: async () => {
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
          },
        },
      ]
    );
  }, [id, selectedRole, user?.role, updateRoleMutation, addToast]);

  const handleToggleActive = useCallback(() => {
    if (!id || !user) return;

    const newStatus = !user.isActive;
    const title = newStatus ? '계정 활성화' : '계정 비활성화';
    const message = newStatus
      ? '이 계정을 활성화하시겠습니까?'
      : '이 계정을 비활성화하시겠습니까? 사용자는 로그인할 수 없게 됩니다.';

    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      {
        text: newStatus ? '활성화' : '비활성화',
        style: newStatus ? 'default' : 'destructive',
        onPress: async () => {
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
        },
      },
    ]);
  }, [id, user, setActiveMutation, addToast]);

  const getRoleBadgeVariant = (role: UserRole): 'error' | 'primary' | 'success' => {
    switch (role) {
      case 'admin': return 'error';
      case 'employer': return 'primary';
      default: return 'success';
    }
  };

  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case 'admin': return '관리자';
      case 'employer': return '구인자';
      default: return '스태프';
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
      <View className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">
          사용자 정보를 불러오는 중...
        </Text>
      </View>
    );
  }

  if (error || !user) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        <EmptyState
          title="사용자를 찾을 수 없음"
          description="요청하신 사용자 정보를 찾을 수 없습니다."
          icon="❌"
          actionLabel="목록으로"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor="#3B82F6"
        />
      }
    >
      {/* Profile Header */}
      <View className="bg-white dark:bg-gray-800 px-4 py-6 items-center border-b border-gray-200 dark:border-gray-700">
        <View className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 items-center justify-center mb-3">
          {user.photoURL ? (
            <Text className="text-3xl">{user.name.charAt(0)}</Text>
          ) : (
            <UserIcon size={40} color="#9CA3AF" />
          )}
        </View>
        <Text className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          {user.name}
        </Text>
        <View className="flex-row items-center">
          <Badge variant={getRoleBadgeVariant(user.role)} size="md">
            {getRoleLabel(user.role)}
          </Badge>
          {!user.isActive && (
            <View className="ml-2 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded">
              <Text className="text-xs text-red-600 dark:text-red-400">비활성</Text>
            </View>
          )}
          {user.isVerified && (
            <View className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded">
              <Text className="text-xs text-green-600 dark:text-green-400">인증됨</Text>
            </View>
          )}
        </View>
      </View>

      {/* Basic Info */}
      <View className="bg-white dark:bg-gray-800 mt-3 px-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white py-4 border-b border-gray-100 dark:border-gray-700">
          기본 정보
        </Text>
        <InfoRow
          icon={<EnvelopeIcon size={20} color="#6B7280" />}
          label="이메일"
          value={user.email}
        />
        {user.phone && (
          <InfoRow
            icon={<PhoneIcon size={20} color="#6B7280" />}
            label="전화번호"
            value={user.phone}
          />
        )}
        <InfoRow
          icon={<CalendarIcon size={20} color="#6B7280" />}
          label="가입일"
          value={formatDate(user.createdAt)}
        />
        {user.lastLoginAt && (
          <InfoRow
            icon={<CalendarIcon size={20} color="#6B7280" />}
            label="최근 로그인"
            value={formatDate(user.lastLoginAt)}
          />
        )}
        <InfoRow
          icon={user.isVerified ? <ShieldCheckIcon size={20} color="#10B981" /> : <XCircleIcon size={20} color="#EF4444" />}
          label="본인인증"
          value={user.isVerified ? '인증 완료' : '미인증'}
        />
      </View>

      {/* Role Management */}
      <View className="bg-white dark:bg-gray-800 mt-3 px-4 pb-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white py-4 border-b border-gray-100 dark:border-gray-700">
          역할 관리
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-3 mb-3">
          사용자의 역할을 변경합니다. 역할에 따라 접근 가능한 기능이 달라집니다.
        </Text>
        {ROLE_OPTIONS.map((option) => (
          <Pressable
            key={option.role}
            onPress={() => setSelectedRole(option.role)}
            className={'flex-row items-center p-3 rounded-lg mb-2 border ' + ((selectedRole ?? user.role) === option.role ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700')}
          >
            <View className={'w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ' + ((selectedRole ?? user.role) === option.role ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600')}>
              {(selectedRole ?? user.role) === option.role && (
                <View className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900 dark:text-white">
                {option.label}
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
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
      <View className="bg-white dark:bg-gray-800 mt-3 px-4 pb-4 mb-8">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white py-4 border-b border-gray-100 dark:border-gray-700">
          계정 관리
        </Text>
        <View className="mt-4">
          <Pressable
            onPress={handleToggleActive}
            disabled={setActiveMutation.isPending}
            className={'py-3 px-4 rounded-lg items-center ' + (user.isActive ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20')}
          >
            {setActiveMutation.isPending ? (
              <ActivityIndicator size="small" color={user.isActive ? '#EF4444' : '#10B981'} />
            ) : (
              <Text className={user.isActive ? 'text-red-600 dark:text-red-400 font-medium' : 'text-green-600 dark:text-green-400 font-medium'}>
                {user.isActive ? '계정 비활성화' : '계정 활성화'}
              </Text>
            )}
          </Pressable>
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            {user.isActive
              ? '비활성화하면 사용자가 로그인할 수 없습니다.'
              : '활성화하면 사용자가 다시 로그인할 수 있습니다.'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

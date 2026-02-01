/**
 * UNIQN Mobile - 사용자 상세 정보 컴포넌트 (관리자용)
 *
 * @description 사용자의 상세 프로필 정보를 표시하는 컴포넌트
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

import { Avatar, Badge, Card, Loading } from '@/components/ui';
import {
  UserIcon,
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  GlobeIcon,
  CheckIcon,
  EditIcon,
  ShieldIcon,
  BriefcaseIcon,
  CreditCardIcon,
  ClockIcon,
  XMarkIcon,
} from '@/components/icons';
import {
  USER_ROLE_LABELS,
  USER_ROLE_BADGE_VARIANT,
  PENALTY_TYPE_LABELS,
  getCountryByCode,
  type AdminUserProfile,
} from '@/types';
import { formatDate, formatRelativeTime } from '@/utils/dateUtils';

// ============================================================================
// Types
// ============================================================================

export interface UserDetailProps {
  user: AdminUserProfile | null;
  isLoading?: boolean;
  onEdit?: (user: AdminUserProfile) => void;
  onPenalty?: (user: AdminUserProfile) => void;
  onClose?: () => void;
}

// ============================================================================
// Sub Components
// ============================================================================

interface InfoRowProps {
  icon?: React.ReactNode;
  label: string;
  value?: string | number | null;
  isMultiline?: boolean;
}

const InfoRow = React.memo(function InfoRow({
  icon,
  label,
  value,
  isMultiline = false,
}: InfoRowProps) {
  return (
    <View className={`flex-row py-2 ${isMultiline ? 'flex-wrap' : 'items-center'}`}>
      {icon && <View className="mr-2">{icon}</View>}
      <Text className="text-sm text-gray-500 dark:text-gray-400 w-20">{label}</Text>
      <Text
        className={`flex-1 text-sm text-gray-900 dark:text-white ${isMultiline ? 'mt-1' : ''}`}
        numberOfLines={isMultiline ? undefined : 1}
      >
        {value || '-'}
      </Text>
    </View>
  );
});

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section = React.memo(function Section({ title, children }: SectionProps) {
  return (
    <Card variant="outlined" padding="md" className="mb-4">
      <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</Text>
      {children}
    </Card>
  );
});

// ============================================================================
// Component
// ============================================================================

export const UserDetail = React.memo(function UserDetail({
  user,
  isLoading = false,
  onEdit,
  onPenalty,
  onClose,
}: UserDetailProps) {
  // 국적 표시
  const nationalityDisplay = useMemo(() => {
    if (!user?.nationality) return null;
    const country = getCountryByCode(user.nationality);
    return country ? `${country.flag} ${country.name}` : user.nationality;
  }, [user?.nationality]);

  // 가입일 표시
  const createdAtDisplay = useMemo(() => {
    if (!user?.createdAt) return '-';
    const date =
      typeof user.createdAt === 'string'
        ? new Date(user.createdAt)
        : user.createdAt instanceof Date
          ? user.createdAt
          : (user.createdAt as { toDate: () => Date }).toDate?.() || new Date();
    return formatDate(date);
  }, [user?.createdAt]);

  // 최근 로그인 표시
  const lastLoginDisplay = useMemo(() => {
    if (!user?.lastLoginAt) return '기록 없음';
    const date =
      typeof user.lastLoginAt === 'string'
        ? new Date(user.lastLoginAt)
        : user.lastLoginAt instanceof Date
          ? user.lastLoginAt
          : (user.lastLoginAt as { toDate: () => Date }).toDate?.() || new Date();
    return formatRelativeTime(date);
  }, [user?.lastLoginAt]);

  // 로딩 상태
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Loading size="large" message="사용자 정보 로딩 중..." />
      </View>
    );
  }

  // 데이터 없음
  if (!user) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-gray-500 dark:text-gray-400">사용자 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-surface-dark"
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* 프로필 헤더 */}
      <View className="bg-white dark:bg-surface px-4 py-6 items-center border-b border-gray-100 dark:border-surface-overlay">
        <Avatar name={user.name} source={user.photoURL} size="xl" className="mb-3" />
        <Text className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</Text>
        {user.nickname && (
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">@{user.nickname}</Text>
        )}
        <View className="flex-row items-center mt-2 gap-2">
          <Badge variant={USER_ROLE_BADGE_VARIANT[user.role]} size="md" dot>
            {USER_ROLE_LABELS[user.role]}
          </Badge>
          {user.isVerified && (
            <Badge variant="success" size="md">
              <CheckIcon size={12} color="#fff" />
              <Text className="text-white text-xs ml-1">인증됨</Text>
            </Badge>
          )}
          {!user.isActive && (
            <Badge variant="error" size="md">
              비활성
            </Badge>
          )}
        </View>

        {/* 통계 */}
        {(user.totalApplications !== undefined || user.completedJobs !== undefined) && (
          <View className="flex-row mt-4 pt-4 border-t border-gray-100 dark:border-surface-overlay">
            <View className="items-center px-6">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">
                {user.totalApplications || 0}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">총 지원</Text>
            </View>
            <View className="items-center px-6 border-l border-gray-200 dark:border-surface-overlay">
              <Text className="text-lg font-bold text-green-600 dark:text-green-400">
                {user.completedJobs || 0}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">완료</Text>
            </View>
            {user.averageRating !== undefined && (
              <View className="items-center px-6 border-l border-gray-200 dark:border-surface-overlay">
                <Text className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {user.averageRating.toFixed(1)}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">평점</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View className="p-4">
        {/* 기본 정보 */}
        <Section title="기본 정보">
          <InfoRow
            icon={<MailIcon size={14} color="#9CA3AF" />}
            label="이메일"
            value={user.email}
          />
          <InfoRow
            icon={<PhoneIcon size={14} color="#9CA3AF" />}
            label="연락처"
            value={user.phone}
          />
          <InfoRow
            icon={<GlobeIcon size={14} color="#9CA3AF" />}
            label="국적"
            value={nationalityDisplay}
          />
          <InfoRow
            icon={<UserIcon size={14} color="#9CA3AF" />}
            label="나이"
            value={user.age ? `${user.age}세` : null}
          />
          <InfoRow
            icon={<CalendarIcon size={14} color="#9CA3AF" />}
            label="가입일"
            value={createdAtDisplay}
          />
          <InfoRow
            icon={<ClockIcon size={14} color="#9CA3AF" />}
            label="최근 로그인"
            value={lastLoginDisplay}
          />
        </Section>

        {/* 경력 정보 */}
        {(user.experience || user.specialties?.length) && (
          <Section title="경력 정보">
            {user.experience && (
              <InfoRow
                icon={<BriefcaseIcon size={14} color="#9CA3AF" />}
                label="경력"
                value={user.experience}
                isMultiline
              />
            )}
            {user.specialties && user.specialties.length > 0 && (
              <View className="py-2">
                <Text className="text-sm text-gray-500 dark:text-gray-400 mb-2">전문 분야</Text>
                <View className="flex-row flex-wrap gap-2">
                  {user.specialties.map((specialty, index) => (
                    <Badge key={index} variant="default" size="sm">
                      {specialty}
                    </Badge>
                  ))}
                </View>
              </View>
            )}
          </Section>
        )}

        {/* 은행 정보 */}
        {(user.bankName || user.bankAccount) && (
          <Section title="정산 정보">
            <InfoRow
              icon={<CreditCardIcon size={14} color="#9CA3AF" />}
              label="은행"
              value={user.bankName}
            />
            <InfoRow label="계좌번호" value={user.bankAccount} />
          </Section>
        )}

        {/* 패널티 정보 */}
        {user.penalties && user.penalties.length > 0 && (
          <Section title="패널티 이력">
            {user.penalties.map((penalty) => (
              <View
                key={penalty.id}
                className="py-2 border-b border-gray-100 dark:border-surface-overlay last:border-b-0"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Badge variant={penalty.isActive ? 'error' : 'default'} size="sm">
                    {PENALTY_TYPE_LABELS[penalty.type]}
                  </Badge>
                  <Text className="text-xs text-gray-400">{formatDate(penalty.createdAt)}</Text>
                </View>
                <Text className="text-sm text-gray-700 dark:text-gray-300">{penalty.reason}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* 관리자 메모 */}
        {user.adminNotes && (
          <Section title="관리자 메모">
            <Text className="text-sm text-gray-700 dark:text-gray-300">{user.adminNotes}</Text>
          </Section>
        )}

        {/* 히스토리 */}
        {user.history && (
          <Section title="히스토리">
            <Text className="text-sm text-gray-700 dark:text-gray-300">{user.history}</Text>
          </Section>
        )}

        {/* 액션 버튼 */}
        <View className="flex-row mt-4 gap-3">
          {onClose && (
            <Pressable
              onPress={onClose}
              className="flex-row items-center justify-center py-3 px-4 bg-gray-200 dark:bg-surface rounded-xl active:opacity-70"
              accessibilityLabel="닫기"
              accessibilityRole="button"
            >
              <XMarkIcon size={18} color="#6B7280" />
              <Text className="ml-2 text-gray-700 dark:text-gray-300 font-semibold">닫기</Text>
            </Pressable>
          )}
          {onEdit && (
            <Pressable
              onPress={() => onEdit(user)}
              className="flex-1 flex-row items-center justify-center py-3 bg-primary-500 rounded-xl active:opacity-70"
            >
              <EditIcon size={18} color="#fff" />
              <Text className="ml-2 text-white font-semibold">정보 수정</Text>
            </Pressable>
          )}
          {onPenalty && (
            <Pressable
              onPress={() => onPenalty(user)}
              className="flex-1 flex-row items-center justify-center py-3 bg-red-500 rounded-xl active:opacity-70"
            >
              <ShieldIcon size={18} color="#fff" />
              <Text className="ml-2 text-white font-semibold">패널티 부여</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
});

export default UserDetail;

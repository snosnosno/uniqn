/**
 * UNIQN Mobile - 스태프 프로필 상세보기 모달
 *
 * @description 확정된 스태프의 상세 프로필 정보를 표시하는 모달
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SheetModal } from '../../ui/SheetModal';
import { Avatar } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import {
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  ClockIcon,
  BriefcaseIcon,
  DocumentIcon,
  UserIcon,
  MapPinIcon,
  StarIcon,
  CheckCircleIcon,
} from '../../icons';
import {
  CONFIRMED_STAFF_STATUS_LABELS,
  type ConfirmedStaff,
  type ConfirmedStaffStatus,
} from '@/types';
import { getRoleDisplayName } from '@/types/unified';
import { formatTime, parseTimeSlotToDate } from '@/utils/dateUtils';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import { useUserProfile } from '@/hooks/useUserProfile';

// ============================================================================
// Types
// ============================================================================

export interface StaffProfileModalProps {
  visible: boolean;
  onClose: () => void;
  staff: ConfirmedStaff | null;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_BADGE_VARIANT: Record<
  ConfirmedStaffStatus,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  scheduled: 'default',
  checked_in: 'success',
  checked_out: 'primary',
  completed: 'success',
  cancelled: 'error',
  no_show: 'warning',
};

const GENDER_LABELS: Record<string, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${year}.${month}.${day}(${dayOfWeek})`;
};

/**
 * TimeInput을 Date로 변환 (TimeNormalizer 위임)
 */
const parseTimestamp = (value: TimeInput): Date | null => {
  return TimeNormalizer.parseTime(value);
};

// ============================================================================
// Sub-components
// ============================================================================

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-surface-overlay">
      <View className="w-6 mt-0.5">{icon}</View>
      <View className="flex-1 ml-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</Text>
        <Text className="text-sm text-gray-900 dark:text-white">{value}</Text>
      </View>
    </View>
  );
}

interface GridInfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function GridInfoItem({ icon, label, value }: GridInfoItemProps) {
  return (
    <View className="flex-row items-center p-3 bg-gray-50 dark:bg-surface rounded-lg">
      <View className="w-8 h-8 rounded-full bg-gray-100 dark:bg-surface items-center justify-center mr-2">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 dark:text-gray-400">{label}</Text>
        <Text className="text-sm font-medium text-gray-900 dark:text-white">{value}</Text>
      </View>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StaffProfileModal({ visible, onClose, staff }: StaffProfileModalProps) {
  // 사용자 프로필 조회 (모달이 열려있고 staff가 있을 때만)
  const { userProfile, isLoading: isProfileLoading, displayName, profilePhotoURL } = useUserProfile({
    userId: staff?.staffId,
    enabled: visible,
    fallbackName: staff?.staffName,
  });

  // 출근 시간 계산
  const startTimeStr = useMemo(() => {
    if (!staff) return '미정';
    if (staff.checkInTime) {
      const date = parseTimestamp(staff.checkInTime);
      return date ? formatTime(date) : '미정';
    }
    if (staff.timeSlot && staff.date) {
      const { startTime } = parseTimeSlotToDate(staff.timeSlot, staff.date);
      return startTime ? formatTime(startTime) : '미정';
    }
    return '미정';
  }, [staff]);

  // 퇴근 시간 계산
  const endTimeStr = useMemo(() => {
    if (!staff) return '미정';
    if (staff.checkOutTime) {
      const date = parseTimestamp(staff.checkOutTime);
      return date ? formatTime(date) : '미정';
    }
    return '미정';
  }, [staff]);

  // 출석 체크 여부
  const isCheckedIn =
    staff?.status === 'checked_in' ||
    staff?.status === 'checked_out' ||
    staff?.status === 'completed';

  if (!staff) return null;

  return (
    <SheetModal visible={visible} onClose={onClose} title="스태프 프로필">
      <View>
        {/* 프로필 헤더 */}
        <View className="items-center py-4 bg-gray-50 dark:bg-surface">
          {isProfileLoading ? (
            <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-surface items-center justify-center mb-2">
              <ActivityIndicator size="small" color="#6B7280" />
            </View>
          ) : (
            <Avatar source={profilePhotoURL} name={displayName} size="xl" className="mb-2" />
          )}
          {/* 이름 + 상태 뱃지 (같은 행) */}
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</Text>
            <Badge variant={STATUS_BADGE_VARIANT[staff.status]} size="sm" dot>
              {CONFIRMED_STAFF_STATUS_LABELS[staff.status]}
            </Badge>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {getRoleDisplayName(staff.role, staff.customRole)}
          </Text>
        </View>

        {/* 근무 정보 */}
        <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            근무 정보
          </Text>

          {/* 근무 날짜 */}
          {staff.date && (
            <InfoRow
              icon={<CalendarIcon size={16} color="#6B7280" />}
              label="근무 날짜"
              value={formatDate(staff.date)}
            />
          )}

          {/* 근무 시간 */}
          <View className="flex-row items-start py-3 border-b border-gray-100 dark:border-surface-overlay">
            <View className="w-6 mt-0.5">
              <ClockIcon size={16} color="#6B7280" />
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">근무 시간</Text>
              <View className="flex-row items-center">
                <Text className="text-sm text-gray-900 dark:text-white">
                  {startTimeStr} ~ {endTimeStr}
                </Text>
                {isCheckedIn && (
                  <View className="ml-2">
                    <CheckCircleIcon size={14} color="#22C55E" />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* 역할 */}
          <InfoRow
            icon={<BriefcaseIcon size={16} color="#6B7280" />}
            label="역할"
            value={getRoleDisplayName(staff.role, staff.customRole)}
          />
        </View>

        {/* 프로필 정보 (사용자가 설정한 정보) */}
        {userProfile && (
          <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              프로필 정보
            </Text>

            {/* 2x2 그리드 레이아웃 */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {userProfile.gender && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<UserIcon size={16} color="#6B7280" />}
                    label="성별"
                    value={GENDER_LABELS[userProfile.gender] || userProfile.gender}
                  />
                </View>
              )}

              {userProfile.birthYear && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<CalendarIcon size={16} color="#6B7280" />}
                    label="출생년도"
                    value={`${userProfile.birthYear}년`}
                  />
                </View>
              )}

              {userProfile.region && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<MapPinIcon size={16} color="#6B7280" />}
                    label="활동 지역"
                    value={userProfile.region}
                  />
                </View>
              )}

              {userProfile.experienceYears !== undefined && userProfile.experienceYears > 0 && (
                <View className="w-[48%]">
                  <GridInfoItem
                    icon={<StarIcon size={16} color="#6B7280" />}
                    label="경력"
                    value={`${userProfile.experienceYears}년`}
                  />
                </View>
              )}
            </View>

            {/* 경력 상세 및 자기소개는 전체 너비 */}
            {userProfile.career && (
              <InfoRow
                icon={<BriefcaseIcon size={16} color="#6B7280" />}
                label="경력 상세"
                value={userProfile.career}
              />
            )}

            {userProfile.note && (
              <InfoRow
                icon={<DocumentIcon size={16} color="#6B7280" />}
                label="자기소개"
                value={userProfile.note}
              />
            )}
          </View>
        )}

        {/* 연락처 정보 */}
        <View className="px-4 py-4">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            연락처 정보
          </Text>

          {(userProfile?.phone || staff.phone) && (
            <InfoRow
              icon={<PhoneIcon size={16} color="#6B7280" />}
              label="전화번호"
              value={userProfile?.phone || staff.phone || ''}
            />
          )}

          {userProfile?.email && (
            <InfoRow
              icon={<MailIcon size={16} color="#6B7280" />}
              label="이메일"
              value={userProfile.email}
            />
          )}
        </View>

        {/* 비고 */}
        {staff.notes && (
          <View className="px-4 pb-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">비고</Text>
            <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
              <Text className="text-sm text-gray-700 dark:text-gray-300">{staff.notes}</Text>
            </View>
          </View>
        )}

        {/* 상태별 추가 정보 */}
        {staff.status === 'no_show' && (
          <View className="px-4 pb-4">
            <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 flex-row items-center">
              <Text className="text-sm text-yellow-700 dark:text-yellow-300">
                노쇼 처리된 스태프입니다
              </Text>
            </View>
          </View>
        )}

        {staff.status === 'cancelled' && (
          <View className="px-4 pb-4">
            <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 flex-row items-center">
              <Text className="text-sm text-red-700 dark:text-red-300">취소된 스태프입니다</Text>
            </View>
          </View>
        )}

        {staff.status === 'completed' && (
          <View className="px-4 pb-4">
            <View className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex-row items-center">
              <CheckCircleIcon size={16} color="#10B981" />
              <Text className="ml-2 text-sm text-green-700 dark:text-green-300">
                근무 완료된 스태프입니다
              </Text>
            </View>
          </View>
        )}

        <View className="h-8" />
      </View>
    </SheetModal>
  );
}

export default StaffProfileModal;

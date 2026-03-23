/**
 * UNIQN Mobile - 스태프 프로필 상세 모달
 *
 * @description 확정된 스태프의 상세 프로필 정보를 표시하는 모달
 */

import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { CONFIRMED_STAFF_STATUS } from '@/constants/statusConfig';
import { SheetModal } from '../../ui/SheetModal';
import { Avatar } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import { CalendarIcon, ClockIcon, BriefcaseIcon, CheckCircleIcon } from '../../icons';
import type { ConfirmedStaff } from '@/types/confirmedStaff';
import { getRoleDisplayName } from '@/types/unified';
import { formatTime } from '@/utils/date';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import { useUserProfile } from '@/hooks/useUserProfile';
import { STATUS } from '@/constants';
import {
  InfoRow,
  ProfileInfoSection,
  ContactInfoSection,
  formatProfileDate,
} from './ProfileInfoSections';

export interface StaffProfileModalProps {
  visible: boolean;
  onClose: () => void;
  staff: ConfirmedStaff | null;
}

const parseTimestamp = (value: TimeInput): Date | null => {
  return TimeNormalizer.parseTime(value);
};

export function StaffProfileModal({ visible, onClose, staff }: StaffProfileModalProps) {
  const {
    userProfile,
    isLoading: isProfileLoading,
    displayName,
    profilePhotoURL,
  } = useUserProfile({
    userId: staff?.staffId,
    enabled: visible,
    fallbackName: staff?.staffName,
  });

  const startTimeStr = useMemo(() => {
    if (!staff) return '미정';
    if (staff.checkInTime) {
      const date = parseTimestamp(staff.checkInTime);
      return date ? formatTime(date) : '미정';
    }
    return '미정';
  }, [staff]);

  const endTimeStr = useMemo(() => {
    if (!staff) return '미정';
    if (staff.checkOutTime) {
      const date = parseTimestamp(staff.checkOutTime);
      return date ? formatTime(date) : '미정';
    }
    return '미정';
  }, [staff]);

  const isCheckedIn =
    staff?.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff?.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff?.status === STATUS.WORK_LOG.COMPLETED;

  if (!staff) return null;

  return (
    <SheetModal visible={visible} onClose={onClose} title="스태프 프로필">
      <View>
        <View className="items-center py-4 bg-gray-50 dark:bg-surface">
          {isProfileLoading ? (
            <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-surface items-center justify-center mb-2">
              <ActivityIndicator size="small" color="#6B7280" />
            </View>
          ) : (
            <Avatar source={profilePhotoURL} name={displayName} size="xl" className="mb-2" />
          )}
          <View className="flex-row items-center gap-2 mb-1">
            <Text className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</Text>
            <Badge variant={CONFIRMED_STAFF_STATUS[staff.status].variant} size="sm" dot>
              {CONFIRMED_STAFF_STATUS[staff.status].label}
            </Badge>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {getRoleDisplayName(staff.role, staff.customRole)}
          </Text>
        </View>

        <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
            근무 정보
          </Text>

          {staff.date && (
            <InfoRow
              icon={<CalendarIcon size={16} color="#6B7280" />}
              label="근무 날짜"
              value={formatProfileDate(staff.date)}
            />
          )}

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

          <InfoRow
            icon={<BriefcaseIcon size={16} color="#6B7280" />}
            label="역할"
            value={getRoleDisplayName(staff.role, staff.customRole)}
          />
        </View>

        <ProfileInfoSection userProfile={userProfile} />

        <ContactInfoSection userProfile={userProfile} fallbackPhone={staff.phone} />

        {staff.notes && (
          <View className="px-4 pb-4">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">비고</Text>
            <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
              <Text className="text-sm text-gray-700 dark:text-gray-300">{staff.notes}</Text>
            </View>
          </View>
        )}

        {staff.status === STATUS.CONFIRMED_STAFF.NO_SHOW && (
          <View className="px-4 pb-4">
            <View className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 flex-row items-center">
              <Text className="text-sm text-yellow-700 dark:text-yellow-300">
                노쇼 처리된 스태프입니다
              </Text>
            </View>
          </View>
        )}

        {staff.status === STATUS.WORK_LOG.CANCELLED && (
          <View className="px-4 pb-4">
            <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 flex-row items-center">
              <Text className="text-sm text-red-700 dark:text-red-300">취소된 스태프입니다</Text>
            </View>
          </View>
        )}

        {staff.status === STATUS.WORK_LOG.COMPLETED && (
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

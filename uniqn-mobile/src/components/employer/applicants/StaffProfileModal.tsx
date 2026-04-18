import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { CONFIRMED_STAFF_STATUS } from '@/constants/statusConfig';
import { useUserProfile } from '@/hooks/useUserProfile';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import { formatTime } from '@/utils/date';
import type { ConfirmedStaff } from '@/types/confirmedStaff';
import { getRoleDisplayName } from '@/types/unified';
import { Avatar } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import { SheetModal } from '../../ui/SheetModal';
import { BriefcaseIcon, CalendarIcon, CheckCircleIcon, ClockIcon } from '../../icons';
import {
  ContactInfoSection,
  formatProfileDate,
  InfoRow,
  ProfileInfoSection,
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
    profilePhotoURLBlurhash,
  } = useUserProfile({
    userId: staff?.staffId,
    enabled: visible,
    fallbackName: staff?.staffName,
    fallbackNickname: staff?.staffNickname,
    fallbackPhotoURL: staff?.staffPhotoURL,
    fallbackPhotoURLBlurhash: staff?.staffPhotoURLBlurhash,
  });

  const startTimeStr = useMemo(() => {
    if (!staff?.checkInTime) {
      return '미정';
    }

    const date = parseTimestamp(staff.checkInTime);
    return date ? formatTime(date) : '미정';
  }, [staff]);

  const endTimeStr = useMemo(() => {
    if (!staff?.checkOutTime) {
      return '미정';
    }

    const date = parseTimestamp(staff.checkOutTime);
    return date ? formatTime(date) : '미정';
  }, [staff]);

  const isCheckedIn =
    staff?.status === STATUS.WORK_LOG.CHECKED_IN ||
    staff?.status === STATUS.WORK_LOG.CHECKED_OUT ||
    staff?.status === STATUS.WORK_LOG.COMPLETED;

  if (!staff) {
    return null;
  }

  return (
    <SheetModal visible={visible} onClose={onClose} title="스태프 프로필">
      <View>
        <View className="items-center bg-surface-page py-4 dark:bg-surface">
          {isProfileLoading ? (
            <View className="mb-2 h-16 w-16 items-center justify-center rounded-sm bg-secondary-200 dark:bg-surface">
              <ActivityIndicator size="small" color={SECONDARY_PALETTE[500]} />
            </View>
          ) : (
            <Avatar
              source={profilePhotoURL ?? undefined}
              name={displayName}
              size="xl"
              className="mb-2"
              blurhash={profilePhotoURLBlurhash}
            />
          )}

          <View className="mb-1 flex-row items-center gap-2">
            <Text className="text-xl font-display text-content-primary dark:text-off-white">
              {displayName}
            </Text>
            <Badge variant={CONFIRMED_STAFF_STATUS[staff.status].variant} size="sm" dot>
              {CONFIRMED_STAFF_STATUS[staff.status].label}
            </Badge>
          </View>

          <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            {getRoleDisplayName(staff.role, staff.customRole)}
          </Text>
        </View>

        <View className="border-b border-secondary-100 px-4 py-4 dark:border-surface-overlay">
          <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
            근무 정보
          </Text>

          {staff.date ? (
            <InfoRow
              icon={<CalendarIcon size={16} color={SECONDARY_PALETTE[500]} />}
              label="근무 날짜"
              value={formatProfileDate(staff.date)}
            />
          ) : null}

          <View className="flex-row items-start border-b border-secondary-100 py-3 dark:border-surface-overlay">
            <View className="mt-0.5 w-6">
              <ClockIcon size={16} color={SECONDARY_PALETTE[500]} />
            </View>
            <View className="ml-2 flex-1">
              <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                근무 시간
              </Text>
              <View className="flex-row items-center">
                <Text className="text-sm text-content-primary dark:text-off-white font-sans">
                  {startTimeStr} ~ {endTimeStr}
                </Text>
                {isCheckedIn ? (
                  <View className="ml-2">
                    <CheckCircleIcon size={14} color="#22C55E" />
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <InfoRow
            icon={<BriefcaseIcon size={16} color={SECONDARY_PALETTE[500]} />}
            label="역할"
            value={getRoleDisplayName(staff.role, staff.customRole)}
          />
        </View>

        <ProfileInfoSection userProfile={userProfile} />
        <ContactInfoSection userProfile={userProfile} fallbackPhone={staff.phone} />

        {staff.notes ? (
          <View className="px-4 pb-4">
            <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
              비고
            </Text>
            <View className="rounded-lg bg-surface-page p-3 dark:bg-surface">
              <Text className="text-sm text-content-secondary font-sans">{staff.notes}</Text>
            </View>
          </View>
        ) : null}

        {staff.status === STATUS.CONFIRMED_STAFF.NO_SHOW ? (
          <View className="px-4 pb-4">
            <View className="flex-row items-center rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20">
              <Text className="text-sm text-warning-700 dark:text-warning-300 font-sans">
                노쇼 처리된 스태프입니다.
              </Text>
            </View>
          </View>
        ) : null}

        {staff.status === STATUS.WORK_LOG.CANCELLED ? (
          <View className="px-4 pb-4">
            <View className="flex-row items-center rounded-lg bg-error-50 p-3 dark:bg-error-900/20">
              <Text className="text-sm text-error-700 dark:text-error-300 font-sans">
                취소된 스태프입니다.
              </Text>
            </View>
          </View>
        ) : null}

        {staff.status === STATUS.WORK_LOG.COMPLETED ? (
          <View className="px-4 pb-4">
            <View className="flex-row items-center rounded-lg bg-success-50 p-3 dark:bg-success-900/20">
              <CheckCircleIcon size={16} color="#22C55E" />
              <Text className="ml-2 text-sm text-success-700 dark:text-success-300 font-sans">
                근무 완료된 스태프입니다.
              </Text>
            </View>
          </View>
        ) : null}

        <View className="h-8" />
      </View>
    </SheetModal>
  );
}

export default StaffProfileModal;

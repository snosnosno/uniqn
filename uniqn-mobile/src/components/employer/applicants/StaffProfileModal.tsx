import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { CONFIRMED_STAFF_STATUS } from '@/constants/statusConfig';
import { useUserProfile } from '@/hooks/useUserProfile';
import { WorkTimeDisplay } from '@/shared/time';
import type { ConfirmedStaff } from '@/types/confirmedStaff';
import { getRoleDisplayName } from '@/types/unified';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { SheetModal } from '@/components/ui/SheetModal';
import { BriefcaseIcon, CalendarIcon, CheckCircleIcon, ClockIcon } from '@/components/icons';
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

  // 근무시간 표시는 WorkTimeDisplay(SSOT)로 통일 — 실제 출퇴근 기록이 없으면
  // 예정시간(timeSlot)을 폴백으로 보여준다(카드/스케줄/시간수정 화면과 일치).
  const timeInfo = useMemo(
    () =>
      WorkTimeDisplay.getDisplayInfo({
        checkInTime: staff?.checkInTime,
        checkOutTime: staff?.checkOutTime,
        timeSlot: staff?.timeSlot,
        date: staff?.date,
      }),
    [staff?.checkInTime, staff?.checkOutTime, staff?.timeSlot, staff?.date]
  );

  const startTimeStr = timeInfo.effectiveStart;
  const endTimeStr = timeInfo.effectiveEnd;
  // 예정시간으로 표시 중인지(실제 기록 없음 + 예정시간 존재)
  const isScheduledOnly = !timeInfo.hasActualTime && startTimeStr !== '미정';

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
        <View className="items-center bg-surface-page dark:bg-surface py-4 dark:bg-surface">
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
              <View className="mb-1 flex-row items-center gap-1.5">
                <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  근무 시간
                </Text>
                {isScheduledOnly ? (
                  <View className="rounded bg-info-100 px-1.5 py-0.5 dark:bg-info-900/30">
                    <Text className="text-[10px] text-info-700 dark:text-info-300 font-sans-semibold">
                      예정
                    </Text>
                  </View>
                ) : null}
              </View>
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
            <View className="rounded-lg bg-surface-page dark:bg-surface p-3 dark:bg-surface">
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

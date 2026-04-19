import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { Text, View } from 'react-native';
import { formatBirthDate } from '@/utils/formatters';
import { toDate } from '@/utils/date';
import type { UserProfile } from '@/services';
import {
  BriefcaseIcon,
  CalendarIcon,
  DocumentIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  UserIcon,
} from '../../icons';

const GENDER_LABELS: Record<string, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function formatProfileDate(dateStr?: string): string {
  if (!dateStr) {
    return '';
  }

  const date = toDate(dateStr);
  if (!date) {
    return dateStr;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_LABELS[date.getDay()];

  return `${year}.${month}.${day}(${weekday})`;
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <View className="flex-row items-start border-b border-secondary-100 py-3 dark:border-surface-overlay">
      <View className="mt-0.5 w-6">{icon}</View>
      <View className="ml-2 flex-1">
        <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {label}
        </Text>
        <Text className="text-sm text-content-primary dark:text-off-white font-sans">{value}</Text>
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
    <View className="flex-row items-center rounded-lg bg-surface-page dark:bg-surface p-3 dark:bg-surface">
      <View className="mr-2 h-8 w-8 items-center justify-center rounded-sm bg-surface-card dark:bg-surface">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {label}
        </Text>
        <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
          {value}
        </Text>
      </View>
    </View>
  );
}

interface ProfileInfoSectionProps {
  userProfile: UserProfile | null | undefined;
}

export function ProfileInfoSection({ userProfile }: ProfileInfoSectionProps) {
  if (!userProfile) {
    return null;
  }

  return (
    <View className="border-b border-secondary-100 px-4 py-4 dark:border-surface-overlay">
      <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
        프로필 정보
      </Text>

      <View className="mb-3 flex-row flex-wrap gap-2">
        {userProfile.gender ? (
          <View className="w-[48%]">
            <GridInfoItem
              icon={<UserIcon size={16} color={SECONDARY_PALETTE[500]} />}
              label="성별"
              value={GENDER_LABELS[userProfile.gender] || userProfile.gender}
            />
          </View>
        ) : null}

        {userProfile.birthDate ? (
          <View className="w-[48%]">
            <GridInfoItem
              icon={<CalendarIcon size={16} color={SECONDARY_PALETTE[500]} />}
              label="생년월일"
              value={formatBirthDate(userProfile.birthDate)}
            />
          </View>
        ) : null}

        {userProfile.region ? (
          <View className="w-[48%]">
            <GridInfoItem
              icon={<MapPinIcon size={16} color={SECONDARY_PALETTE[500]} />}
              label="활동 지역"
              value={userProfile.region}
            />
          </View>
        ) : null}

        {userProfile.experienceYears !== undefined && userProfile.experienceYears > 0 ? (
          <View className="w-[48%]">
            <GridInfoItem
              icon={<StarIcon size={16} color={SECONDARY_PALETTE[500]} />}
              label="경력"
              value={`${userProfile.experienceYears}년`}
            />
          </View>
        ) : null}
      </View>

      {userProfile.career ? (
        <InfoRow
          icon={<BriefcaseIcon size={16} color={SECONDARY_PALETTE[500]} />}
          label="경력 상세"
          value={userProfile.career}
        />
      ) : null}

      {userProfile.note ? (
        <InfoRow
          icon={<DocumentIcon size={16} color={SECONDARY_PALETTE[500]} />}
          label="자기소개"
          value={userProfile.note}
        />
      ) : null}
    </View>
  );
}

interface ContactInfoSectionProps {
  userProfile: UserProfile | null | undefined;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
}

export function ContactInfoSection({
  userProfile,
  fallbackPhone,
  fallbackEmail,
}: ContactInfoSectionProps) {
  const phone = userProfile?.phone || fallbackPhone || '';
  const email = userProfile?.email || fallbackEmail || '';

  return (
    <View className="px-4 py-4">
      <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
        연락처 정보
      </Text>

      {phone ? (
        <InfoRow
          icon={<PhoneIcon size={16} color={SECONDARY_PALETTE[500]} />}
          label="전화번호"
          value={phone}
        />
      ) : null}

      {email ? (
        <InfoRow
          icon={<MailIcon size={16} color={SECONDARY_PALETTE[500]} />}
          label="이메일"
          value={email}
        />
      ) : null}
    </View>
  );
}

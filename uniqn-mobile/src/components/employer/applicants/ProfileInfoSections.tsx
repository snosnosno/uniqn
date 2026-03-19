import React from 'react';
import { View, Text } from 'react-native';
import {
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  BriefcaseIcon,
  DocumentIcon,
  UserIcon,
  MapPinIcon,
  StarIcon,
} from '../../icons';
import type { UserProfile } from '@/services';
import { formatBirthDate } from '@/utils/formatters';

const GENDER_LABELS: Record<string, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
};

export function formatProfileDate(dateStr?: string): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

  return `${year}.${month}.${day}(${dayOfWeek})`;
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function InfoRow({ icon, label, value }: InfoRowProps) {
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

interface ProfileInfoSectionProps {
  userProfile: UserProfile | null | undefined;
}

export function ProfileInfoSection({ userProfile }: ProfileInfoSectionProps) {
  if (!userProfile) {
    return null;
  }

  return (
    <View className="px-4 py-4 border-b border-gray-100 dark:border-surface-overlay">
      <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
        프로필 정보
      </Text>

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

        {userProfile.birthDate && (
          <View className="w-[48%]">
            <GridInfoItem
              icon={<CalendarIcon size={16} color="#6B7280" />}
              label="생년월일"
              value={formatBirthDate(userProfile.birthDate)}
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
      <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        연락처 정보
      </Text>

      {phone ? (
        <InfoRow icon={<PhoneIcon size={16} color="#6B7280" />} label="전화번호" value={phone} />
      ) : null}

      {email ? (
        <InfoRow icon={<MailIcon size={16} color="#6B7280" />} label="이메일" value={email} />
      ) : null}
    </View>
  );
}

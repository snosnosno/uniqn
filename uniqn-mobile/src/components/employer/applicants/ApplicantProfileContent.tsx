/**
 * UNIQN Mobile - 지원자 프로필 본문
 *
 * @description 프로필 정보, 연락처, 지원 메시지, 사전질문, 상태별 정보, 확정 이력 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import {
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  BriefcaseIcon,
  MessageIcon,
  DocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  MapPinIcon,
  StarIcon,
} from '../../icons';
import type { UserProfile } from '@/services';
import type { ApplicantWithDetails } from '@/services';
import { STATUS } from '@/constants';
import { formatBirthDate } from '@/utils/formatters';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantProfileContentProps {
  applicant: ApplicantWithDetails;
  userProfile: UserProfile | null | undefined;
}

// ============================================================================
// Constants
// ============================================================================

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

// ============================================================================
// Internal Sub-components
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
// Component
// ============================================================================

export const ApplicantProfileContent = React.memo(function ApplicantProfileContent({
  applicant,
  userProfile,
}: ApplicantProfileContentProps) {
  return (
    <>
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

        {(userProfile?.phone || applicant.applicantPhone) && (
          <InfoRow
            icon={<PhoneIcon size={16} color="#6B7280" />}
            label="전화번호"
            value={userProfile?.phone || applicant.applicantPhone || ''}
          />
        )}

        {(userProfile?.email || applicant.applicantEmail) && (
          <InfoRow
            icon={<MailIcon size={16} color="#6B7280" />}
            label="이메일"
            value={userProfile?.email || applicant.applicantEmail || ''}
          />
        )}
      </View>

      {/* 지원 메시지 */}
      {applicant.message && (
        <View className="px-4 pb-4">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            지원 메시지
          </Text>
          <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
            <View className="flex-row items-start">
              <MessageIcon size={16} color="#6B7280" />
              <Text className="ml-2 text-sm text-gray-700 dark:text-gray-300 flex-1">
                {applicant.message}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 사전질문 답변 */}
      {applicant.preQuestionAnswers && applicant.preQuestionAnswers.length > 0 && (
        <View className="px-4 pb-4">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            사전질문 답변
          </Text>
          <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
            {applicant.preQuestionAnswers.map((answer, idx) => (
              <View key={idx} className="mb-3 last:mb-0">
                <View className="flex-row items-start mb-1">
                  <DocumentIcon size={14} color="#6B7280" />
                  <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    Q{idx + 1}. {answer.question}
                  </Text>
                </View>
                <Text className="ml-6 text-sm text-gray-700 dark:text-gray-300">
                  {answer.answer}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 상태별 추가 정보 */}
      {applicant.status === STATUS.APPLICATION.REJECTED && applicant.rejectionReason && (
        <View className="px-4 pb-4">
          <View className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 flex-row items-start">
            <XCircleIcon size={16} color="#EF4444" />
            <View className="ml-2 flex-1">
              <Text className="text-xs text-red-500 dark:text-red-400 mb-1">거절 사유</Text>
              <Text className="text-sm text-red-700 dark:text-red-300">
                {applicant.rejectionReason}
              </Text>
            </View>
          </View>
        </View>
      )}

      {applicant.status === STATUS.APPLICATION.CONFIRMED && (
        <View className="px-4 pb-4">
          <View className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex-row items-center">
            <CheckCircleIcon size={16} color="#10B981" />
            <Text className="ml-2 text-sm text-green-700 dark:text-green-300">
              확정된 지원자입니다
            </Text>
          </View>
        </View>
      )}

      {/* 확정 이력 */}
      {applicant.confirmationHistory && applicant.confirmationHistory.length > 0 && (
        <View className="px-4 pb-4">
          <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            확정 이력
          </Text>
          <View className="bg-gray-50 dark:bg-surface rounded-lg p-3">
            {applicant.confirmationHistory.map((entry, idx) => {
              const isCancelled = !!entry.cancelledAt;
              const timestamp = isCancelled
                ? entry.cancelledAt?.toDate?.()?.toISOString?.()?.split('T')[0]
                : entry.confirmedAt?.toDate?.()?.toISOString?.()?.split('T')[0];

              return (
                <View key={idx} className="flex-row items-center mb-2 last:mb-0">
                  <View
                    className={`w-2 h-2 rounded-full mr-2 ${
                      isCancelled ? 'bg-red-500' : 'bg-green-500'
                    }`}
                  />
                  <Text className="text-sm text-gray-700 dark:text-gray-300">
                    {isCancelled ? '취소' : '확정'} - {formatDate(timestamp)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </>
  );
});

export default ApplicantProfileContent;

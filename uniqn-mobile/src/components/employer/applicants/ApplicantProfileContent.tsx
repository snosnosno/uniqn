/**
 * UNIQN Mobile - 지원자 프로필 본문
 *
 * @description 프로필 정보, 연락처, 지원 메시지, 사전질문, 상태 정보, 확정 이력을 표시
 */

import React from 'react';
import { View, Text } from 'react-native';
import { MessageIcon, DocumentIcon, CheckCircleIcon, XCircleIcon } from '../../icons';
import type { UserProfile, ApplicantWithDetails } from '@/services';
import { STATUS } from '@/constants';
import { ProfileInfoSection, ContactInfoSection, formatProfileDate } from './ProfileInfoSections';

export interface ApplicantProfileContentProps {
  applicant: ApplicantWithDetails;
  userProfile: UserProfile | null | undefined;
}

export const ApplicantProfileContent = React.memo(function ApplicantProfileContent({
  applicant,
  userProfile,
}: ApplicantProfileContentProps) {
  return (
    <>
      <ProfileInfoSection userProfile={userProfile} />

      <ContactInfoSection
        userProfile={userProfile}
        fallbackPhone={applicant.applicantPhone}
        fallbackEmail={applicant.applicantEmail}
      />

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
                    {isCancelled ? '취소' : '확정'} - {formatProfileDate(timestamp)}
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

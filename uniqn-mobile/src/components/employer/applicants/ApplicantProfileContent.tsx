import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { Text, View } from 'react-native';
import { STATUS } from '@/constants';
import { toDateString } from '@/utils/date';
import type { ApplicantWithDetails, UserProfile } from '@/services';
import { CheckCircleIcon, DocumentIcon, MessageIcon, XCircleIcon } from '@/components/icons';
import { ContactInfoSection, formatProfileDate, ProfileInfoSection } from './ProfileInfoSections';

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

      {applicant.message ? (
        <View className="px-4 pb-4">
          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            지원 메시지
          </Text>
          <View className="rounded-lg bg-surface-page dark:bg-surface p-3">
            <View className="flex-row items-start">
              <MessageIcon size={16} color={SECONDARY_PALETTE[500]} />
              <Text className="ml-2 flex-1 text-sm text-content-secondary font-sans">
                {applicant.message}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {applicant.preQuestionAnswers && applicant.preQuestionAnswers.length > 0 ? (
        <View className="px-4 pb-4">
          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            사전질문 답변
          </Text>
          <View className="rounded-lg bg-surface-page dark:bg-surface p-3">
            {applicant.preQuestionAnswers.map((answer, index) => (
              <View key={index} className="mb-3 last:mb-0">
                <View className="mb-1 flex-row items-start">
                  <DocumentIcon size={14} color={SECONDARY_PALETTE[500]} />
                  <Text className="ml-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                    Q{index + 1}. {answer.question}
                  </Text>
                </View>
                <Text className="ml-6 text-sm text-content-secondary font-sans">
                  {answer.answer}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {applicant.status === STATUS.APPLICATION.REJECTED && applicant.rejectionReason ? (
        <View className="px-4 pb-4">
          <View className="flex-row items-start rounded-lg bg-error-50 p-3 dark:bg-error-900/20">
            <XCircleIcon size={16} color="#DC2626" />
            <View className="ml-2 flex-1">
              <Text className="mb-1 text-xs text-error-500 dark:text-error-400 font-sans">
                거절 사유
              </Text>
              <Text className="text-sm text-error-700 dark:text-error-300 font-sans">
                {applicant.rejectionReason}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {applicant.status === STATUS.APPLICATION.CONFIRMED ? (
        <View className="px-4 pb-4">
          <View className="flex-row items-center rounded-lg bg-success-50 p-3 dark:bg-success-900/20">
            <CheckCircleIcon size={16} color="#22C55E" />
            <Text className="ml-2 text-sm text-success-700 dark:text-success-300 font-sans">
              확정된 지원자입니다.
            </Text>
          </View>
        </View>
      ) : null}

      {applicant.confirmationHistory && applicant.confirmationHistory.length > 0 ? (
        <View className="px-4 pb-4">
          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            확정 이력
          </Text>
          <View className="rounded-lg bg-surface-page dark:bg-surface p-3">
            {applicant.confirmationHistory.map((entry, index) => {
              const isCancelled = Boolean(entry.cancelledAt);
              const timestamp = toDateString(isCancelled ? entry.cancelledAt : entry.confirmedAt);

              return (
                <View key={index} className="mb-2 flex-row items-center last:mb-0">
                  <View
                    className={`mr-2 h-2 w-2 rounded-sm ${
                      isCancelled ? 'bg-error-500' : 'bg-success-500'
                    }`}
                  />
                  <Text className="text-sm text-content-secondary font-sans">
                    {isCancelled ? '취소' : '확정'} · {formatProfileDate(timestamp)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );
});

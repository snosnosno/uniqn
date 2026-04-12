/**
 * UNIQN Mobile - 연락처 정보 컴포넌트
 *
 * @description 연락처, 지원 메시지, 사전질문 답변 표시
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text } from 'react-native';

import { PhoneIcon, MessageIcon, DocumentIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

interface PreQuestionAnswer {
  question: string;
  answer: string;
}

export interface ContactInfoProps {
  /** 연락처 */
  phone?: string;
  /** 지원 메시지 */
  message?: string;
  /** 사전질문 답변 */
  preQuestionAnswers?: PreQuestionAnswer[];
}

// ============================================================================
// Component
// ============================================================================

export const ContactInfo = React.memo(function ContactInfo({
  phone,
  message,
  preQuestionAnswers,
}: ContactInfoProps) {
  const hasContent = phone || message || (preQuestionAnswers && preQuestionAnswers.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <>
      {/* 연락처 */}
      {phone && (
        <View className="flex-row items-center mb-2">
          <PhoneIcon size={14} color={SECONDARY_PALETTE[400]} />
          <Text className="ml-2 text-sm text-secondary-600 dark:text-secondary-400 font-sans">
            {phone}
          </Text>
        </View>
      )}

      {/* 지원 메시지 */}
      {message && (
        <View className="flex-row items-start mb-2">
          <MessageIcon size={14} color={SECONDARY_PALETTE[400]} />
          <Text
            className="ml-2 text-sm text-secondary-600 dark:text-secondary-400 flex-1 font-sans"
            numberOfLines={3}
          >
            {message}
          </Text>
        </View>
      )}

      {/* 사전질문 답변 */}
      {preQuestionAnswers && preQuestionAnswers.length > 0 && (
        <>
          {preQuestionAnswers.map((answer, idx) => (
            <View key={idx} className="mb-2">
              <View className="flex-row items-center">
                <DocumentIcon size={14} color={SECONDARY_PALETTE[400]} />
                <Text className="ml-2 text-sm text-secondary-600 dark:text-secondary-400 font-sans">
                  Q{idx + 1}. {answer.question}
                </Text>
              </View>
              <View className="flex-row items-start ml-5">
                <Text className="text-secondary-400 dark:text-secondary-500 mr-1 font-sans">↳</Text>
                <Text className="text-sm text-secondary-600 dark:text-secondary-400 flex-1 font-sans">
                  {answer.answer}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </>
  );
});

export default ContactInfo;

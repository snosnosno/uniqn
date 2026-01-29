/**
 * UNIQN Mobile - InquiryCard 컴포넌트
 *
 * @description 문의 목록용 카드
 * @version 1.0.0
 */

// 1. React/React Native
import React from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';

// 2. 외부 라이브러리
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 3. 내부 모듈
import { Card } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';
import { getIconColor } from '@/constants/colors';
import { INQUIRY_CATEGORY_LABELS, toDate } from '@/types';

// 4. 타입
import type { Inquiry } from '@/types';

// 5. 상대 경로
import { InquiryStatusBadge } from './InquiryStatusBadge';

export interface InquiryCardProps {
  inquiry: Inquiry;
  onPress: () => void;
  /** 작성자 정보 표시 (관리자용) */
  showAuthor?: boolean;
  className?: string;
}

export function InquiryCard({
  inquiry,
  onPress,
  showAuthor = false,
  className = '',
}: InquiryCardProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const createdDate = toDate(inquiry.createdAt);
  const formattedDate = createdDate
    ? format(createdDate, 'yyyy.MM.dd HH:mm', { locale: ko })
    : '';

  const categoryLabel = INQUIRY_CATEGORY_LABELS[inquiry.category] || inquiry.category;

  return (
    <Pressable onPress={onPress} className={`active:opacity-80 ${className}`}>
      <Card variant="elevated" padding="md">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            {/* 카테고리 + 상태 */}
            <View className="mb-2 flex-row items-center gap-2">
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {categoryLabel}
              </Text>
              <InquiryStatusBadge status={inquiry.status} size="sm" />
            </View>

            {/* 제목 */}
            <Text
              className="mb-1 text-base font-medium text-gray-900 dark:text-gray-100"
              numberOfLines={2}
            >
              {inquiry.subject}
            </Text>

            {/* 작성자 (관리자용) */}
            {showAuthor && (
              <Text className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                {inquiry.userName} ({inquiry.userEmail})
              </Text>
            )}

            {/* 날짜 */}
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              {formattedDate}
            </Text>

            {/* 답변 여부 */}
            {inquiry.status === 'closed' && inquiry.response && (
              <View className="mt-2 flex-row items-center">
                <View className="mr-1 h-2 w-2 rounded-full bg-green-500" />
                <Text className="text-xs text-green-600 dark:text-green-400">
                  답변 완료
                </Text>
              </View>
            )}
          </View>

          {/* 화살표 아이콘 */}
          <ChevronRightIcon size={20} color={getIconColor(isDarkMode, 'secondary')} />
        </View>
      </Card>
    </Pressable>
  );
}

export default InquiryCard;

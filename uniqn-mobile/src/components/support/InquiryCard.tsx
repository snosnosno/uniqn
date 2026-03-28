/**
 * UNIQN Mobile - InquiryCard 컴포넌트
 * @description 문의 목록에서 사용하는 카드 UI입니다.
 * @version 1.0.0
 */

import React from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Card } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';
import { getIconColor } from '@/constants/colors';
import { STATUS } from '@/constants';
import { INQUIRY_CATEGORY_LABELS, type Inquiry } from '@/types/inquiry';
import { toDate } from '@/utils/date';
import { InquiryStatusBadge } from './InquiryStatusBadge';

export interface InquiryCardProps {
  inquiry: Inquiry;
  onPress: () => void;
  /** 관리자 화면에서만 작성자 정보를 표시합니다. */
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
  const formattedDate = createdDate ? format(createdDate, 'yyyy.MM.dd HH:mm', { locale: ko }) : '';
  const categoryLabel = INQUIRY_CATEGORY_LABELS[inquiry.category] || inquiry.category;

  return (
    <Pressable onPress={onPress} className={`active:opacity-80 ${className}`}>
      <Card variant="elevated" padding="md">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <Text className="text-xs text-gray-500 dark:text-gray-400">{categoryLabel}</Text>
              <InquiryStatusBadge status={inquiry.status} size="sm" />
            </View>

            <Text
              className="mb-1 text-base font-medium text-gray-900 dark:text-gray-100"
              numberOfLines={2}
            >
              {inquiry.subject}
            </Text>

            {showAuthor && (
              <Text className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                {inquiry.userName} ({inquiry.userEmail})
              </Text>
            )}

            <Text className="text-xs text-gray-400 dark:text-gray-500">{formattedDate}</Text>

            {inquiry.status === STATUS.INQUIRY.CLOSED && inquiry.response && (
              <View className="mt-2 flex-row items-center">
                <View className="mr-1 h-2 w-2 rounded-full bg-green-500" />
                <Text className="text-xs text-green-600 dark:text-green-400">응답 완료</Text>
              </View>
            )}
          </View>

          <ChevronRightIcon size={20} color={getIconColor(isDarkMode, 'secondary')} />
        </View>
      </Card>
    </Pressable>
  );
}

export default InquiryCard;

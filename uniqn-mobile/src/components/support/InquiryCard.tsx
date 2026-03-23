/**
 * UNIQN Mobile - InquiryCard 而댄룷?뚰듃
 *
 * @description 臾몄쓽 紐⑸줉??移대뱶
 * @version 1.0.0
 */

// 1. React/React Native
import React from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';

// 2. 외부 라이브러리
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 3. ?대? 紐⑤뱢
import { Card } from '@/components/ui';
import { ChevronRightIcon } from '@/components/icons';
import { getIconColor } from '@/constants/colors';
import { INQUIRY_CATEGORY_LABELS, type Inquiry } from '@/types/inquiry';
import { toDate } from '@/utils/date';
import { STATUS } from '@/constants';

// 5. ?곷? 寃쎈줈
import { InquiryStatusBadge } from './InquiryStatusBadge';

export interface InquiryCardProps {
  inquiry: Inquiry;
  onPress: () => void;
  /** ?묒꽦???뺣낫 ?쒖떆 (愿由ъ옄?? */
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
            {/* 移댄뀒怨좊━ + ?곹깭 */}
            <View className="mb-2 flex-row items-center gap-2">
              <Text className="text-xs text-gray-500 dark:text-gray-400">{categoryLabel}</Text>
              <InquiryStatusBadge status={inquiry.status} size="sm" />
            </View>

            {/* ?쒕ぉ */}
            <Text
              className="mb-1 text-base font-medium text-gray-900 dark:text-gray-100"
              numberOfLines={2}
            >
              {inquiry.subject}
            </Text>

            {/* ?묒꽦??(愿由ъ옄?? */}
            {showAuthor && (
              <Text className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                {inquiry.userName} ({inquiry.userEmail})
              </Text>
            )}

            {/* ?좎쭨 */}
            <Text className="text-xs text-gray-400 dark:text-gray-500">{formattedDate}</Text>

            {/* ?듬? ?щ? */}
            {inquiry.status === STATUS.INQUIRY.CLOSED && inquiry.response && (
              <View className="mt-2 flex-row items-center">
                <View className="mr-1 h-2 w-2 rounded-full bg-green-500" />
                <Text className="text-xs text-green-600 dark:text-green-400">?듬? ?꾨즺</Text>
              </View>
            )}
          </View>

          {/* ?붿궡???꾩씠肄?*/}
          <ChevronRightIcon size={20} color={getIconColor(isDarkMode, 'secondary')} />
        </View>
      </Card>
    </Pressable>
  );
}

export default InquiryCard;

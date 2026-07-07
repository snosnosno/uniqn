/**
 * UNIQN Mobile - InquiryCard 컴포넌트
 * @description 문의 목록에서 사용하는 카드 UI입니다.
 * @version 1.1.0
 */

import React from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Card, CardStripe, NumericText, type CardStripeTone } from '@/components/ui';
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
  /**
   * CardStripe tone — opt-in. 지정 시 좌측 3px 엣지 스트라이프 표시.
   * - 'gold': 접수됨(open) 상태
   * - 'info': 처리중(in_progress) 상태
   * - 'muted': 답변 완료(closed) 상태
   */
  stripeTone?: CardStripeTone;
  className?: string;
}

export function InquiryCard({
  inquiry,
  onPress,
  showAuthor = false,
  stripeTone,
  className = '',
}: InquiryCardProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const createdDate = toDate(inquiry.createdAt);
  const formattedDate = createdDate ? format(createdDate, 'yyyy.MM.dd HH:mm', { locale: ko }) : '';
  const categoryLabel = INQUIRY_CATEGORY_LABELS[inquiry.category] || inquiry.category;

  const cardBody = (
    <Card variant="elevated" padding="md">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="mb-2 flex-row items-center gap-2">
            <Text className="text-xs text-content-muted font-sans">{categoryLabel}</Text>
            <InquiryStatusBadge status={inquiry.status} size="sm" />
          </View>

          <Text
            className="mb-1 text-base font-sans-medium text-content-primary"
            style={{ letterSpacing: -0.32 }}
            numberOfLines={2}
          >
            {inquiry.subject}
          </Text>

          {showAuthor && (
            <Text className="mb-1 text-sm text-content-muted font-sans">
              {inquiry.userName} ({inquiry.userEmail})
            </Text>
          )}

          <NumericText className="text-xs text-content-placeholder font-sans">
            {formattedDate}
          </NumericText>

          {inquiry.status === STATUS.INQUIRY.CLOSED && inquiry.response && (
            <View className="mt-2 flex-row items-center">
              <View className="mr-1 h-2 w-2 rounded-sm bg-success-500" />
              <Text className="text-xs text-success-600 dark:text-success-400 font-sans">
                응답 완료
              </Text>
            </View>
          )}
        </View>

        <ChevronRightIcon size={20} color={getIconColor(isDarkMode, 'secondary')} />
      </View>
    </Card>
  );

  return (
    <Pressable
      onPress={onPress}
      accessible
      focusable
      accessibilityRole="button"
      accessibilityLabel={`${categoryLabel} ${inquiry.subject}`}
      className={`active:opacity-80 ${className}`}
    >
      {stripeTone ? <CardStripe tone={stripeTone}>{cardBody}</CardStripe> : cardBody}
    </Pressable>
  );
}

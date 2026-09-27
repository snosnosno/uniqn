/**
 * 고정 공고 게시 기간 카드 — 만료일을 보여 주고 "7일 연장"을 한 번에 한다.
 *
 * 고정 공고는 게시 7일 뒤 자동 마감된다(방치 공고 방지). 상시로 사람을 구하는 사장이 매주 새로
 * 올리지 않도록, 만료가 다가오면 이 카드에서 한 번 눌러 연장한다. 서버는 만료 24시간 전에
 * 같은 행동을 알림으로도 권한다(fn_notify_fixed_postings_expiring).
 */

import React from 'react';
import { View, Text } from 'react-native';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ClockIcon } from '@/components/icons';
import { STATUS_COLORS, SECONDARY_PALETTE } from '@/constants/colors';
import type { FixedExpiryInfo } from '@/domains/job-posting/fixedExpiry';

interface FixedPostingExpiryCardProps {
  expiry: FixedExpiryInfo;
  onExtend: () => void;
  isExtending: boolean;
}

export function FixedPostingExpiryCard({
  expiry,
  onExtend,
  isExtending,
}: FixedPostingExpiryCardProps) {
  const expiresLabel = format(expiry.expiresAt, 'M/d(EEE) HH:mm', { locale: ko });
  const remainingLabel = expiry.isSoon ? '오늘·내일 마감' : `${expiry.remainingDays}일 남음`;

  return (
    <Card
      variant="outlined"
      padding="md"
      className={
        expiry.isSoon
          ? 'border-warning-500 bg-warning-50 dark:border-warning-500 dark:bg-warning-900/30'
          : undefined
      }
      testID="fixed-posting-expiry-card"
    >
      <View className="flex-row items-center">
        <ClockIcon
          size={18}
          color={expiry.isSoon ? STATUS_COLORS.warning : SECONDARY_PALETTE[400]}
        />
        <View className="ml-2 flex-1">
          <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
            게시 {expiresLabel}까지 · {remainingLabel}
          </Text>
          <Text className="mt-0.5 text-xs text-content-secondary dark:text-secondary-400 font-sans">
            계속 구하신다면 연장해 주세요. 지나면 자동 마감돼요.
          </Text>
        </View>
        <Button
          size="sm"
          variant={expiry.isSoon ? 'primary' : 'outline'}
          onPress={onExtend}
          loading={isExtending}
          disabled={isExtending}
          accessibilityLabel="게시 기간 7일 연장"
          testID="fixed-posting-extend-button"
        >
          7일 연장
        </Button>
      </View>
    </Card>
  );
}

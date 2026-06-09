/**
 * UNIQN Mobile - Wallet Screen
 * 전용 지갑 화면 — 잔액 + 충전 CTA + 만료 임박 하트 + 거래내역(무한스크롤).
 * 충전 동선과 거래 투명성을 한 화면에 통합(프로필 "내 지갑" 카드 → 진입).
 */

import { useCallback, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { StackHeader } from '@/components/headers';
import { Card, EmptyState } from '@/components/ui';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { HeartFilledIcon, GemIcon } from '@/components/icons';
import { PRIMARY_COLORS } from '@/constants/colors';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useWalletLedger } from '@/hooks/useWalletLedger';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';
import { summarizeExpiringHearts } from '@/utils/wallet/expiringHearts';
import { walletReasonLabel } from '@/utils/wallet/walletReasonLabels';
import { formatRelative } from '@/utils/formatters/date';
import type { WalletLedgerRow } from '@/types/wallet';

function BalanceStat({
  label,
  value,
  isHeart,
}: {
  label: string;
  value: string;
  isHeart?: boolean;
}) {
  return (
    <View className="flex-1 items-center gap-1">
      <View className="flex-row items-center gap-1.5">
        {isHeart ? (
          <HeartFilledIcon size={20} />
        ) : (
          <GemIcon size={20} color={PRIMARY_COLORS[500]} />
        )}
        <Text className="text-xl font-sans-bold text-content-primary dark:text-secondary-100">
          {value}
        </Text>
      </View>
      <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">{label}</Text>
    </View>
  );
}

function WalletHeader() {
  const { data, isLoading } = useWalletBalance();
  const openPurchaseSheet = usePurchaseSheetStore((s) => s.open);
  const expiring = data ? summarizeExpiringHearts(data.expiring_lots, new Date()) : null;

  return (
    <View className="px-4 pb-2 pt-4">
      <Card className="mb-6">
        <View className="gap-4">
          <View className="flex-row items-center">
            <BalanceStat
              label="하트"
              isHeart
              value={isLoading ? '—' : String(data?.heart_balance ?? 0)}
            />
            <View className="h-10 w-px bg-border-subtle" />
            <BalanceStat
              label="다이아"
              value={isLoading ? '—' : String(data?.diamond_balance ?? 0)}
            />
          </View>

          {expiring ? (
            <View className="flex-row items-center justify-center gap-1">
              <HeartFilledIcon size={13} />
              <Text className="text-xs font-sans text-warning-600 dark:text-warning-400">
                {expiring.totalAmount}개 D-{expiring.daysUntilExpiry} 만료 예정
              </Text>
            </View>
          ) : null}

          <Pressable
            testID="wallet-charge-button"
            onPress={openPurchaseSheet}
            accessibilityRole="button"
            accessibilityLabel="다이아 충전"
            className="min-h-[44px] flex-row items-center justify-center rounded-xl bg-primary-500 py-3 active:opacity-80 dark:bg-primary-600"
          >
            <Text className="text-sm font-sans-semibold text-white">다이아 충전</Text>
          </Pressable>
        </View>
      </Card>

      <Text className="mb-1 px-1 text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
        거래내역
      </Text>
    </View>
  );
}

function LedgerRow({ item }: { item: WalletLedgerRow }) {
  const isCredit = item.delta >= 0;
  const isHeart = item.currency_type === 'heart';
  return (
    <View className="flex-row items-center justify-between px-5 py-3">
      <View className="flex-1 pr-3">
        <Text
          numberOfLines={1}
          className="text-sm font-sans-medium text-content-primary dark:text-secondary-100"
        >
          {walletReasonLabel(item.reason)}
        </Text>
        <Text className="mt-0.5 text-xs font-sans text-secondary-500 dark:text-secondary-400">
          {formatRelative(item.created_at)}
        </Text>
      </View>
      <View className="flex-row items-center gap-1">
        {isHeart ? (
          <HeartFilledIcon size={15} />
        ) : (
          <GemIcon size={15} color={PRIMARY_COLORS[500]} />
        )}
        <Text
          className={`text-sm font-sans-semibold ${
            isCredit
              ? 'text-success-600 dark:text-success-400'
              : 'text-content-primary dark:text-secondary-100'
          }`}
        >
          {isCredit ? `+${item.delta}` : String(item.delta)}
        </Text>
      </View>
    </View>
  );
}

export default function WalletScreen() {
  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useWalletLedger();

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: WalletLedgerRow }) => <LedgerRow item={item} />,
    []
  );
  const keyExtractor = useCallback((item: WalletLedgerRow) => item.id, []);

  return (
    <SafeAreaView
      className="flex-1 bg-surface-page dark:bg-secondary-900"
      edges={['top', 'bottom']}
    >
      <StackHeader title="내 지갑" fallbackHref="/(app)/(tabs)/profile" />
      <AppFlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={64}
        ListHeaderComponent={<WalletHeader />}
        ItemSeparatorComponent={() => <View className="mx-5 h-px bg-border-subtle" />}
        ListEmptyComponent={
          isLoading ? (
            <View
              className="gap-2 px-4 py-2"
              accessibilityRole="progressbar"
              accessibilityLabel="거래내역 불러오는 중"
            >
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </View>
          ) : isError ? (
            <EmptyState
              variant="error"
              title="거래내역을 불러오지 못했어요"
              description="네트워크를 확인하고 다시 시도해주세요."
              actionLabel="다시 시도"
              onAction={refetch}
              compact
            />
          ) : (
            <EmptyState
              title="아직 거래내역이 없어요"
              description="공고를 게시하거나 다이아를 충전하면 여기에 표시돼요."
              compact
            />
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator className="py-4" color={PRIMARY_COLORS[500]} />
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            tintColor={PRIMARY_COLORS[500]}
            colors={[PRIMARY_COLORS[500]]}
          />
        }
      />
    </SafeAreaView>
  );
}

/**
 * UNIQN Mobile - PurchaseSheet
 * @description 다이아 충전 시트. RC 패키지(가격)+DB 제품(다이아량) 병합 표시 → 구매 → 폴링.
 *   웹/키 미설정 시 "모바일 앱에서 충전 가능" 안내. 폴링 중 "처리 중"으로 이중탭 차단.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { Modal } from '@/components/ui';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { purchasesService } from '@/services/purchases';
import { WalletRepository } from '@/repositories/supabase/WalletRepository';
import { usePurchaseDiamonds } from '@/hooks/usePurchaseDiamonds';
import { useRestorePurchases } from '@/hooks/useRestorePurchases';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';
import { queryKeys } from '@/lib/queryClient';
import { logger } from '@/utils/logger';
import { formatCurrency } from '@/utils/formatters/currency';
import { triggerHaptic } from '@/utils/haptics';

export function PurchaseSheet() {
  const isOpen = usePurchaseSheetStore((s) => s.isOpen);
  const close = usePurchaseSheetStore((s) => s.close);
  const available = purchasesService.isAvailable();
  const { status, purchase, reset } = usePurchaseDiamonds();
  const { restoring, restore } = useRestorePurchases();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  // 충전 UI 원격 킬스위치(app_config monetization.show_purchase_ui).
  // false 면 재배포 없이 충전 노출 차단. 로딩/실패 시 기본 노출(fail-open).
  const monetizationQuery = useQuery({
    queryKey: [...queryKeys.wallet.all, 'monetization'] as const,
    queryFn: () => WalletRepository.getMonetizationConfig(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });
  const showPurchaseUi = monetizationQuery.data?.showPurchaseUi ?? true;

  const productsQuery = useQuery({
    queryKey: [...queryKeys.wallet.all, 'products'] as const,
    queryFn: () => WalletRepository.listProducts(),
    enabled: isOpen && showPurchaseUi,
  });

  useEffect(() => {
    if (!isOpen || !available || !showPurchaseUi) return;
    let active = true;
    purchasesService
      .getDiamondPackages()
      .then((p) => {
        if (active) setPackages(p);
      })
      .catch((error) => {
        // offering 조회 실패는 치명적 아님 — 패키지 빈 목록 유지(버튼 disabled), 로깅만.
        logger.warn('purchaseSheet.getDiamondPackages.failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      active = false;
    };
  }, [isOpen, available, showPurchaseUi]);

  const busy = status === 'purchasing' || status === 'processing';
  // 결제·복원 어느 쪽이든 진행 중이면 상호 배타 — 동시 빌링 트랜잭션·폴링 baseline 오염 차단
  const blocked = busy || restoring;

  // 결제 완료 시 성공 haptic (impeccable rule 17 — 결정적 순간)
  useEffect(() => {
    if (status === 'done') {
      void triggerHaptic('success');
    }
  }, [status]);

  // 원당 단가 최저(가장 이득) 상품 — 보너스 포함 총량 기준
  const bestValueId = useMemo(() => {
    let best: string | null = null;
    let bestRatio = Infinity;
    for (const p of productsQuery.data ?? []) {
      const total = p.diamonds + p.bonus_diamonds;
      if (total <= 0) continue;
      const ratio = p.price_krw / total;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = p.product_id;
      }
    }
    return best;
  }, [productsQuery.data]);

  const handleClose = () => {
    if (blocked) return; // 결제 폴링·복원 중 닫기 차단(이중결제·무관 화면 토스트 방지)
    reset();
    close();
  };

  // 약관/개인정보 — 시트를 닫고 해당 화면으로 이동(결제·복원 진행 중엔 차단)
  const openLegal = (href: '/(app)/settings/terms' | '/(app)/settings/privacy') => {
    if (blocked) return;
    reset();
    close();
    router.push(href);
  };

  // product_id → 다이아량 매핑(표시는 DB 신뢰, 가격은 RC priceString)
  const productMap = useMemo(() => {
    const map = new Map<string, { diamonds: number; bonus: number; priceKrw: number }>();
    for (const p of productsQuery.data ?? []) {
      map.set(p.product_id, {
        diamonds: p.diamonds,
        bonus: p.bonus_diamonds,
        priceKrw: p.price_krw,
      });
    }
    return map;
  }, [productsQuery.data]);

  return (
    <Modal visible={isOpen} onClose={handleClose} title="다이아 충전" position="bottom">
      {!showPurchaseUi ? (
        <View className="py-6">
          <Text className="text-center font-sans text-content-primary dark:text-secondary-100">
            다이아 충전은 현재 준비 중이에요.
          </Text>
          <Text className="mt-1 text-center font-sans text-sm text-secondary-500 dark:text-secondary-400">
            곧 만나보실 수 있어요.
          </Text>
        </View>
      ) : !available ? (
        <View className="py-6">
          <Text className="text-center font-sans text-content-primary dark:text-secondary-100">
            다이아 충전은 모바일 앱에서 가능해요.
          </Text>
        </View>
      ) : productsQuery.isLoading ? (
        <View
          className="gap-2 py-2"
          accessibilityRole="progressbar"
          accessibilityLabel="충전 상품 불러오는 중"
        >
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </View>
      ) : productsQuery.isError ? (
        <View className="py-6">
          <Text className="text-center font-sans text-content-primary dark:text-secondary-100">
            충전 상품을 불러오지 못했어요.
          </Text>
          <Text className="mt-1 text-center font-sans text-sm text-secondary-500 dark:text-secondary-400">
            네트워크를 확인하고 다시 시도해주세요.
          </Text>
          <Pressable
            onPress={() => productsQuery.refetch()}
            className="mt-3 self-center rounded-md bg-surface-card px-4 py-2 dark:bg-secondary-800"
            accessibilityRole="button"
            accessibilityLabel="충전 상품 다시 불러오기"
          >
            <Text className="font-sans-medium text-primary-600 dark:text-primary-400">
              다시 시도
            </Text>
          </Pressable>
        </View>
      ) : (productsQuery.data ?? []).length === 0 ? (
        <View className="py-6">
          <Text className="text-center font-sans text-content-primary dark:text-secondary-100">
            현재 충전 상품이 없어요.
          </Text>
          <Text className="mt-1 text-center font-sans text-sm text-secondary-500 dark:text-secondary-400">
            잠시 후 다시 시도해주세요.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {(productsQuery.data ?? []).map((product) => {
            const meta = productMap.get(product.product_id);
            const pkg = packages.find((p) => p.product?.identifier === product.product_id);
            const diamonds = meta?.diamonds ?? 0;
            const bonus = meta?.bonus ?? 0;
            const total = diamonds + bonus;
            // 가격: RC priceString 우선, 폴백은 DB price_krw를 통화 포맷(미포맷 "1100원" 교정)
            const priceLabel = pkg?.product?.priceString ?? formatCurrency(meta?.priceKrw);
            const isBest = product.product_id === bestValueId;
            return (
              <Pressable
                key={product.product_id}
                testID={`purchase-${product.product_id}`}
                disabled={blocked || !pkg}
                onPress={() => pkg && purchase(pkg)}
                accessibilityRole="button"
                accessibilityLabel={`다이아 ${total}개${bonus > 0 ? ` (보너스 ${bonus} 포함)` : ''}, ${priceLabel}`}
                className="min-h-[44px] flex-row items-center justify-between rounded-md bg-surface-card px-4 py-3 dark:bg-secondary-800"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="font-sans-semibold text-content-primary dark:text-secondary-100">
                    💎 {diamonds}
                  </Text>
                  {bonus > 0 ? (
                    <View className="rounded bg-primary-100 px-1.5 py-0.5 dark:bg-primary-900/30">
                      <Text className="text-xs font-sans-semibold text-primary-700 dark:text-primary-300">
                        +{bonus} 보너스
                      </Text>
                    </View>
                  ) : null}
                  {isBest ? (
                    <View className="rounded bg-primary-500 px-1.5 py-0.5">
                      <Text className="text-xs font-sans-semibold text-white">가장 이득</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="font-sans text-secondary-500 dark:text-secondary-400">
                  {priceLabel}
                </Text>
              </Pressable>
            );
          })}

          {busy ? (
            <View className="mt-2 flex-row items-center justify-center gap-2 py-2">
              <ActivityIndicator />
              <Text className="font-sans text-secondary-500 dark:text-secondary-400">
                {status === 'processing' ? '충전 처리 중이에요…' : '결제 진행 중…'}
              </Text>
            </View>
          ) : null}
          {status === 'done' ? (
            <Text className="mt-2 text-center font-sans-semibold text-success-600">
              충전이 완료됐어요!
            </Text>
          ) : null}
          {status === 'timeout' ? (
            <Text className="mt-2 text-center font-sans text-secondary-500 dark:text-secondary-400">
              충전 반영이 지연되고 있어요. 잠시 후 잔액을 확인해주세요.
            </Text>
          ) : null}
          {status === 'error' ? (
            <Text className="mt-2 text-center font-sans text-error-600">
              결제 중 문제가 발생했어요.
            </Text>
          ) : null}
        </View>
      )}

      {/* IAP 심사 footer — 약관·개인정보 링크 + 구매 복원 (App Store 3.1.1) */}
      <View className="mt-4 flex-row flex-wrap items-center justify-center border-t border-divider pt-1">
        <Pressable
          onPress={() => openLegal('/(app)/settings/terms')}
          disabled={blocked}
          hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
          className={`min-h-[40px] justify-center px-2 ${blocked ? 'opacity-40' : 'active:opacity-70'}`}
          accessibilityRole="link"
          accessibilityLabel="이용약관 보기"
        >
          <Text className="font-sans text-xs text-secondary-500 dark:text-secondary-400">
            이용약관
          </Text>
        </Pressable>
        <Text
          accessible={false}
          importantForAccessibility="no"
          accessibilityElementsHidden
          className="font-sans text-xs text-secondary-300 dark:text-secondary-600"
        >
          ·
        </Text>
        <Pressable
          onPress={() => openLegal('/(app)/settings/privacy')}
          disabled={blocked}
          hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
          className={`min-h-[40px] justify-center px-2 ${blocked ? 'opacity-40' : 'active:opacity-70'}`}
          accessibilityRole="link"
          accessibilityLabel="개인정보처리방침 보기"
        >
          <Text className="font-sans text-xs text-secondary-500 dark:text-secondary-400">
            개인정보처리방침
          </Text>
        </Pressable>
        {available ? (
          <>
            <Text
              accessible={false}
              importantForAccessibility="no"
              accessibilityElementsHidden
              className="font-sans text-xs text-secondary-300 dark:text-secondary-600"
            >
              ·
            </Text>
            <Pressable
              onPress={() => void restore()}
              disabled={blocked}
              hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
              className={`min-h-[40px] min-w-[68px] items-center justify-center px-2 ${busy ? 'opacity-40' : 'active:opacity-70'}`}
              accessibilityRole="button"
              accessibilityLabel="구매 복원"
              accessibilityState={{ disabled: blocked, busy: restoring }}
            >
              {restoring ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text className="font-sans-medium text-xs text-secondary-600 dark:text-secondary-300">
                  구매 복원
                </Text>
              )}
            </Pressable>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

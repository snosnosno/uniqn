/**
 * UNIQN Mobile - PurchaseSheet
 * @description 다이아 충전 시트. RC 패키지(가격)+DB 제품(다이아량) 병합 표시 → 구매 → 폴링.
 *   웹/키 미설정 시 "모바일 앱에서 충전 가능" 안내. 폴링 중 "처리 중"으로 이중탭 차단.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { PurchasesPackage } from 'react-native-purchases';
import { Modal } from '@/components/ui';
import { purchasesService } from '@/services/purchases';
import { WalletRepository } from '@/repositories/supabase/WalletRepository';
import { usePurchaseDiamonds } from '@/hooks/usePurchaseDiamonds';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';
import { queryKeys } from '@/lib/queryClient';

export function PurchaseSheet() {
  const isOpen = usePurchaseSheetStore((s) => s.isOpen);
  const close = usePurchaseSheetStore((s) => s.close);
  const available = purchasesService.isAvailable();
  const { status, purchase, reset } = usePurchaseDiamonds();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  const productsQuery = useQuery({
    queryKey: [...queryKeys.wallet.all, 'products'] as const,
    queryFn: () => WalletRepository.listProducts(),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen || !available) return;
    let active = true;
    purchasesService.getDiamondPackages().then((p) => {
      if (active) setPackages(p);
    });
    return () => {
      active = false;
    };
  }, [isOpen, available]);

  const busy = status === 'purchasing' || status === 'processing';

  const handleClose = () => {
    if (busy) return; // 폴링 중 닫기 차단(이중결제 방지)
    reset();
    close();
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
      {!available ? (
        <View className="py-6">
          <Text className="text-center font-sans text-content-primary dark:text-secondary-100">
            다이아 충전은 모바일 앱에서 가능해요.
          </Text>
        </View>
      ) : (
        <View className="gap-2">
          {(productsQuery.data ?? []).map((product) => {
            const meta = productMap.get(product.product_id);
            const pkg = packages.find((p) => p.product?.identifier === product.product_id);
            const total = (meta?.diamonds ?? 0) + (meta?.bonus ?? 0);
            return (
              <Pressable
                key={product.product_id}
                testID={`purchase-${product.product_id}`}
                disabled={busy || !pkg}
                onPress={() => pkg && purchase(pkg)}
                className="flex-row items-center justify-between rounded-md bg-surface-card px-4 py-3 dark:bg-secondary-800"
              >
                <Text className="font-sans-semibold text-content-primary dark:text-secondary-100">
                  💎 {total}
                </Text>
                <Text className="font-sans text-secondary-500 dark:text-secondary-400">
                  {pkg?.product?.priceString ?? `${meta?.priceKrw ?? 0}원`}
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
    </Modal>
  );
}

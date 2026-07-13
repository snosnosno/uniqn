/**
 * PlaceSheet — 장소 선택 시트 (주문서 기본정보)
 *
 * @description 인라인 3단 모드(list → new → region). 지역 선택은 SheetModal 내부에 REGION_GROUPS/
 * REGIONS_BY_GROUP 를 인라인 렌더 — RegionSelectModal(RN Modal) 을 열지 않는다(중첩 Modal iOS
 * 터치먹통 #186/#243 회피, 브리프 CRITICAL C1). value/onChange 는 OrderSheetFormValues(z.input)
 * 기준 — 장소는 null 허용, 확정값은 non-null.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { CheckIcon, ChevronLeftIcon, PlusIcon } from '@/components/icons';
import { REGION_GROUPS, REGIONS_BY_GROUP } from '@/constants/regions';
import { useThemeStore } from '@/stores/themeStore';
import { PRIMARY_COLORS, SECONDARY_PALETTE } from '@/constants/colors';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

/** 폼 경계(z.input)의 장소 non-null 형태 — PostingLocation 이 아니라 폼 스키마 기준 */
export type OrderSheetLocation = NonNullable<OrderSheetFormValues['location']>;

export interface PlaceSheetProps {
  visible: boolean;
  value: OrderSheetLocation | null;
  /** 최근 장소(부모가 템플릿 location + 현재값으로 계산, 중복 제거) — Task 9 전까지 빈 배열 */
  recentLocations: OrderSheetLocation[];
  onConfirm: (next: OrderSheetLocation) => void;
  onClose: () => void;
}

type Mode = 'list' | 'new' | 'region';

export function PlaceSheet({
  visible,
  value,
  recentLocations,
  onConfirm,
  onClose,
}: PlaceSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [mode, setMode] = useState<Mode>('list');
  const [draft, setDraft] = useState<OrderSheetLocation>({ name: '' });

  // 재오픈 시 초기 모드/드래프트 동기화(최근 장소 있으면 리스트, 없으면 바로 새 입력)
  useEffect(() => {
    if (visible) {
      setMode(recentLocations.length > 0 ? 'list' : 'new');
      setDraft(value ?? { name: '' });
    }
  }, [visible, value, recentLocations.length]);

  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const nameTrimmed = draft.name.trim();

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={mode === 'region' ? '지역 선택' : '어디서 일하나요?'}
      footer={
        mode === 'new' ? (
          <Button
            onPress={() => {
              onConfirm({ ...draft, name: nameTrimmed });
              onClose();
            }}
            disabled={nameTrimmed.length === 0}
          >
            확인
          </Button>
        ) : undefined
      }
    >
      {mode === 'list' && (
        <View className="gap-2">
          {recentLocations.map((loc) => (
            <Pressable
              key={`${loc.name}:${loc.address ?? ''}`}
              onPress={() => {
                onConfirm(loc);
                onClose();
              }}
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={`장소 ${loc.name} 선택`}
            >
              <Text className="text-sm font-sans-medium text-content-primary">{loc.name}</Text>
              {loc.address ? (
                <Text className="text-xs text-content-muted font-sans">{loc.address}</Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable
            onPress={() => setMode('new')}
            className="flex-row items-center justify-center gap-1 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 min-h-[44px] active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="새 장소 입력"
          >
            <PlusIcon size={16} />
            <Text className="text-sm text-content-secondary font-sans">새 장소 입력</Text>
          </Pressable>
        </View>
      )}

      {mode === 'new' && (
        <View className="gap-2">
          {recentLocations.length > 0 && (
            <Pressable
              onPress={() => setMode('list')}
              className="flex-row items-center gap-1 min-h-[44px] justify-center active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="최근 장소 목록으로 돌아가기"
            >
              <ChevronLeftIcon size={16} />
              <Text className="text-xs text-content-secondary font-sans">최근 장소에서 선택</Text>
            </Pressable>
          )}
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
            maxLength={50}
            placeholder="장소명 (예: 라운더스 홀덤펍)"
            placeholderTextColor={placeholderColor}
            testID="order-sheet-place-name"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
          />
          <TextInput
            value={draft.address ?? ''}
            onChangeText={(address) => setDraft((d) => ({ ...d, address }))}
            maxLength={200}
            placeholder="주소"
            placeholderTextColor={placeholderColor}
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
          />
          <Pressable
            onPress={() => setMode('region')}
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="지역 선택"
          >
            <Text className="text-sm text-content-primary font-sans">
              {draft.region ? `지역: ${draft.region}` : '지역 선택 (선택)'}
            </Text>
          </Pressable>
        </View>
      )}

      {mode === 'region' && (
        <View className="gap-3">
          {/* 지역 모드 dead-end 방지 — 선택 없이 새 입력으로 복귀 */}
          <Pressable
            onPress={() => setMode('new')}
            className="flex-row items-center gap-1 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="지역 선택 취소하고 돌아가기"
          >
            <ChevronLeftIcon size={16} />
            <Text className="text-xs text-content-secondary font-sans">뒤로</Text>
          </Pressable>
          {REGION_GROUPS.map((group) => (
            <View key={group}>
              <Text className="text-xs font-sans-bold text-content-secondary mb-1.5">{group}</Text>
              <View className="flex-row flex-wrap gap-2">
                {REGIONS_BY_GROUP[group].map((r) => {
                  const selected = draft.region === r.slug;
                  return (
                    <Pressable
                      key={r.slug}
                      onPress={() => {
                        setDraft((d) => ({ ...d, region: r.slug }));
                        setMode('new');
                      }}
                      className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${
                        selected
                          ? 'border-primary-500 bg-primary-100'
                          : 'border-secondary-200 dark:border-surface-overlay'
                      } active:opacity-80`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${r.label} 지역`}
                    >
                      <View className="flex-row items-center gap-1">
                        {selected ? (
                          <CheckIcon
                            size={14}
                            color={isDarkMode ? PRIMARY_COLORS[400] : PRIMARY_COLORS[600]}
                          />
                        ) : null}
                        <Text
                          className={`text-sm font-sans-medium ${
                            selected
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-content-secondary'
                          }`}
                        >
                          {r.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </SheetModal>
  );
}

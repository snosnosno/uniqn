/**
 * PlaceSheet — 장소 선택 시트 (주문서 기본정보)
 *
 * @description 인라인 3단 모드(list → new → region). 지역 선택은 SheetModal 내부에 공유 2패널
 * RegionTaxonomyBrowser(#254 필터와 동일 본문) 를 인라인 렌더 — RN Modal 을 열지 않는다(중첩 Modal
 * iOS 터치먹통 #186/#243 회피, 브리프 CRITICAL C1). 단일선택: 픽 즉시 확정·복귀. 그룹전체 슬롯
 * 미지정 = 권역 선택 불가(필수 계약). 지역은 확인 게이트 필수(2026-07-15) — 스키마 제출 게이트가
 * 최후 방어. value/onChange 는 OrderSheetFormValues(z.input) 기준 — 장소는 null 허용, 확정값은 non-null.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { ChevronLeftIcon, PlusIcon } from '@/components/icons';
import { getRegionLabel, getRegionOption } from '@/constants/regions';
import { RegionTaxonomyBrowser } from '@/components/region/RegionTaxonomyBrowser';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
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

/** 넓은 화면에서 브라우저가 과하게 길어지지 않게 하는 상한 */
const REGION_BROWSER_MAX_HEIGHT = 520;
/**
 * SheetModal 크롬(헤더 + 본문 패딩) 몫 — 브라우저 높이에서 미리 뺀다.
 * 시트 카드는 뷰포트의 95% 를 넘지 않는데, 브라우저만 0.6H 를 잡으면 저높이 뷰포트에서
 * 크롬과 합쳐 그 예산을 넘겨 리스트 하단이 잘린다(RegionFilterSheet 와 동일 계열, 2026-07-25).
 */
const SHEET_CHROME_HEIGHT = 120;
/** 이 아래로는 2-패널 탐색이 의미를 잃는다 — 그래도 잘리는 것보다는 낫다 */
const REGION_BROWSER_MIN_HEIGHT = 200;

type Mode = 'list' | 'new' | 'region';

export function PlaceSheet({
  visible,
  value,
  recentLocations,
  onConfirm,
  onClose,
}: PlaceSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const { height: windowHeight } = useWindowDimensions();
  // 최초 오픈 플리커 방지: 최근 장소 유무에 따라 lazy init(effect 는 재오픈 동기화 담당)
  const [mode, setMode] = useState<Mode>(() => (recentLocations.length > 0 ? 'list' : 'new'));
  const [draft, setDraft] = useState<OrderSheetLocation>({ name: '' });

  // 재오픈 시 초기 모드/드래프트 동기화 — visible false→true 상승 에지에서만 수행한다.
  // ⚠️ recentLocations.length 는 rising-edge 시점에만 읽는다(상승 에지 가드): 시트가 열려 있는 동안
  // 실데이터 쿼리 해소로 recentLocations 가 0→N 전이해도 편집 중인 draft/mode 를 리셋하지 않는다
  // (Task 9 실데이터 배선이 처음 도달 가능케 한 편집 텍스트 유실 레이스 — 리뷰 Important).
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    const rising = visible && !prevVisibleRef.current;
    prevVisibleRef.current = visible;
    if (rising) {
      setMode(recentLocations.length > 0 ? 'list' : 'new');
      setDraft(value ?? { name: '' });
    }
  }, [visible, value, recentLocations.length]);

  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const nameTrimmed = draft.name.trim();
  const confirmDisabled = nameTrimmed.length === 0 || !draft.region; // 지역 필수(2026-07-15)
  // 브라우저는 flex-1 — SheetModal 인라인이라 명시 높이로 bound(실기기 그라운딩 대상).
  // 시트 카드 95% 예산에서 크롬을 뺀 값을 넘지 않게 조인다 — 넘으면 리스트 하단이 잘린다.
  const regionBrowserHeight = Math.max(
    REGION_BROWSER_MIN_HEIGHT,
    Math.min(
      Math.round(windowHeight * 0.6),
      REGION_BROWSER_MAX_HEIGHT,
      Math.round(windowHeight * 0.95) - SHEET_CHROME_HEIGHT
    )
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={mode === 'region' ? '지역 선택' : '어디서 일하나요?'}
      footer={
        mode === 'new' ? (
          <View className="gap-2">
            {confirmDisabled ? (
              <Text className="text-center text-xs text-content-muted font-sans">
                장소명과 지역을 입력하면 확인할 수 있어요
              </Text>
            ) : null}
            <Button
              onPress={() => {
                // name 은 trim, address 는 trim 후 빈 문자열이면 undefined(canonical 왕복 '' / undefined 혼재 방지)
                onConfirm({
                  ...draft,
                  name: nameTrimmed,
                  address: draft.address?.trim() || undefined,
                });
                onClose();
              }}
              disabled={confirmDisabled}
            >
              확인
            </Button>
          </View>
        ) : undefined
      }
    >
      {mode === 'list' && (
        <View className="gap-2">
          {recentLocations.map((loc) => (
            <Pressable
              key={`${loc.name}:${loc.address ?? ''}`}
              onPress={() => {
                // 하위호환: region 없는 저장 장소는 조용히 통과시키지 않고 지역 완성 유도
                if (!loc.region) {
                  setDraft({ ...loc });
                  setMode('region');
                  return;
                }
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
              {!loc.region ? (
                <Text className="text-xs text-content-muted font-sans">
                  지역 미지정 — 탭해서 지역을 골라주세요
                </Text>
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
              {draft.region ? `지역: ${getRegionLabel(draft.region) ?? draft.region}` : '지역 선택'}
            </Text>
          </Pressable>
        </View>
      )}

      {mode === 'region' && (
        <View className="gap-2" style={{ height: regionBrowserHeight }}>
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
          {/* 필터와 동일 2패널 택소노미(#254) — 단일선택: 픽 즉시 확정·복귀. 그룹전체 슬롯
              미지정 = 권역 선택 불가(필수 계약). 중첩 Modal 금지 — 인라인 렌더(#186/#243) */}
          <RegionTaxonomyBrowser
            selectionMode="single"
            isSelected={(slug) => draft.region === slug}
            onPickSlug={(slug) => {
              setDraft((d) => ({ ...d, region: slug }));
              setMode('new');
            }}
            initialGroup={draft.region ? getRegionOption(draft.region)?.group : undefined}
            searchInputTestID="order-sheet-region-search"
          />
        </View>
      )}
    </SheetModal>
  );
}

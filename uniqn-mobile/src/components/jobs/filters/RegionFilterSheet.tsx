/**
 * UNIQN Mobile - 지역 필터 시트 (브라우즈 멀티선택)
 *
 * @description 2-패널 본문(검색층 + 좌 그룹 탭 + 우 칩 그리드/구 아코디언)은 공유 컴포넌트
 * RegionTaxonomyBrowser 소비 — 이 시트는 멀티 토큰 선택 상태(pending·cap·미리보기 카운트)와
 * 그룹전체 행·바로가기·확인층 슬롯만 소유한다. 선택 모델은 utils/regionSelection 토큰
 * (slug | 'group:서울') — 상호배타·최대 5단위. 공고작성 폼의 단일선택(은퇴)과 별개.
 */

import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { CheckIcon, MapPinIcon, XMarkIcon } from '@/components/icons';
import { PRIMARY_COLORS, SECONDARY_PALETTE } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
import { RegionTaxonomyBrowser } from '@/components/region/RegionTaxonomyBrowser';
import {
  GROUP_ALL_SUPPORTED,
  MAX_REGION_UNITS,
  countRegionTokensByGroup,
  expandRegionTokensToScope,
  groupToken,
  regionTokenGroup,
  regionTokenLabel,
  toggleRegionToken,
  type RegionToken,
} from '@/utils/regionSelection';
import { usePostingTypeCounts } from '@/hooks/usePostingTypeCounts';
import type { StaffRole } from '@/types/role';
import type { SalaryFilter } from '@/stores/jobFilterStore';

/** 넓은 화면에서 시트가 과하게 길어지지 않게 하는 상한 */
const SHEET_MAX_HEIGHT = 640;
/**
 * Modal 카드 크롬(헤더 + 본문 상하 패딩) 몫 — 시트 본문 높이에서 미리 뺀다.
 * Modal 카드는 뷰포트의 90% 를 넘지 않는데, 본문만 0.72H 를 잡으면 크롬과 합쳐
 * 그 예산을 넘겨 하단 "적용" 버튼이 잘렸다(저높이 뷰포트 실측, 2026-07-25).
 */
const MODAL_CHROME_HEIGHT = 96;
/** 이 아래로는 2-패널 탐색이 의미를 잃는다 — 버튼 가시성이 우선이라 본문만 스크롤에 맡긴다 */
const SHEET_MIN_HEIGHT = 200;

export interface RegionFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 현재 적용 중인 토큰 — 시트 오픈 시 초기 선택으로 복사 */
  appliedTokens: RegionToken[];
  onApply: (tokens: RegionToken[]) => void;
  /** 최근 적용 토큰 (바로가기 칩) */
  recentTokens?: RegionToken[];
  /** 프로필 지역에서 유도한 추천 slug */
  suggestedSlug?: string;
  /** 미리보기 카운트 정합용 — 적용 중인 다른 필터 축 (역할 / 급여) */
  appliedRoles?: StaffRole[];
  appliedSalary?: SalaryFilter | null;
}

type SheetBodyProps = Omit<RegionFilterSheetProps, 'visible'>;

/** 선택 체크 골드 — 라이트는 대비 확보용 primary-700 (구 공고작성 폼 단일선택 모달(은퇴) 관례와 동일) */
function useCheckColor(): string {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  return isDarkMode ? PRIMARY_COLORS[500] : PRIMARY_COLORS[700];
}

/** 상단 바로가기 칩 (최근/내 지역) */
function ShortcutChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} 바로 선택`}
      className={`min-h-[36px] flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-70 ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
          : 'border-secondary-300 dark:border-surface-overlay'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${
          selected
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-content-secondary dark:text-secondary-400'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SheetBody({
  onClose,
  appliedTokens,
  onApply,
  recentTokens = [],
  suggestedSlug,
  appliedRoles = [],
  appliedSalary = null,
}: SheetBodyProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [pending, setPending] = useState<RegionToken[]>(() => [...appliedTokens]);
  const [showCapNotice, setShowCapNotice] = useState(false);

  // 서버 쿼리 스코프 — 그룹 토큰은 접두 압축(그룹 4개+ 선택 시 URL 한도 초과 실측 대응).
  const pendingScope = useMemo(() => expandRegionTokensToScope(pending), [pending]);
  const groupCounts = useMemo(() => countRegionTokensByGroup(pending), [pending]);
  const checkColor = useCheckColor();

  // 적용 전 미리보기 카운트 — 목록/칩과 동일 스코프(getTypeCounts + 적용 중 타 필터 포함).
  // keepPreviousCounts: 토글마다 키가 바뀌어도 직전 값을 유지해 버튼 라벨 플리커 방지.
  const { counts, hasCounts } = usePostingTypeCounts({
    regions: pendingScope.slugs,
    regionPrefixes: pendingScope.prefixes,
    roles: appliedRoles,
    salaryType: appliedSalary?.type ?? null,
    salaryMin: appliedSalary?.min ?? null,
    salarySort: appliedSalary?.sort ?? null,
    keepPreviousCounts: true,
  });

  // Modal 카드 90% 예산에서 크롬을 뺀 값을 넘지 않게 — 넘으면 하단 "적용"이 잘린다.
  const sheetHeight = Math.max(
    SHEET_MIN_HEIGHT,
    Math.min(
      Math.round(windowHeight * 0.72),
      SHEET_MAX_HEIGHT,
      Math.round(windowHeight * 0.9) - MODAL_CHROME_HEIGHT
    )
  );

  const handleToggle = (token: RegionToken) => {
    const result = toggleRegionToken(pending, token);
    setShowCapNotice(result.capped);
    if (!result.capped) setPending(result.tokens);
  };

  const handleApply = () => {
    onApply(pending);
    onClose();
  };

  // 바로가기 칩: 최근 + 내 지역 (중복 제거, 내 지역이 최근에 있으면 최근만)
  const shortcuts = useMemo(() => {
    const items: { token: RegionToken; label: string }[] = recentTokens.map((t) => ({
      token: t,
      label: regionTokenLabel(t),
    }));
    if (suggestedSlug && !recentTokens.includes(suggestedSlug)) {
      items.push({ token: suggestedSlug, label: `내 지역 · ${regionTokenLabel(suggestedSlug)}` });
    }
    return items;
  }, [recentTokens, suggestedSlug]);

  const applyLabel = hasCounts ? `공고 ${counts?.total ?? 0}건 보기` : '적용';

  return (
    <View className="-mx-5 -mb-5" style={{ height: sheetHeight }}>
      {/* ①·② 검색층 + 2-패널: 공유 본문(RegionTaxonomyBrowser)이 소유 */}
      <RegionTaxonomyBrowser
        selectionMode="multi"
        isSelected={(slug) => pending.includes(slug)}
        onPickSlug={handleToggle}
        groupBadgeCount={(group) => groupCounts[group]}
        initialGroup={(appliedTokens[0] && regionTokenGroup(appliedTokens[0])) || '서울'}
        searchInputTestID="region-filter-search-input"
        renderBelowSearch={({ isSearching }) =>
          !isSearching && shortcuts.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {shortcuts.map(({ token, label }) => (
                <ShortcutChip
                  key={`shortcut-${token}`}
                  label={label}
                  selected={pending.includes(token)}
                  onPress={() => handleToggle(token)}
                />
              ))}
            </ScrollView>
          ) : null
        }
        renderGroupAllRow={(group) =>
          GROUP_ALL_SUPPORTED.includes(group) ? (
            <Pressable
              onPress={() => handleToggle(groupToken(group))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: pending.includes(groupToken(group)) }}
              accessibilityLabel={`${group} 전체 선택`}
              className={`mb-3 min-h-[44px] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
                pending.includes(groupToken(group))
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay'
              }`}
            >
              <Text
                className={`font-sans-semibold text-sm ${
                  pending.includes(groupToken(group))
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-content-primary'
                }`}
              >
                {group} 전체
              </Text>
              {pending.includes(groupToken(group)) ? (
                <CheckIcon size={16} color={checkColor} />
              ) : null}
            </Pressable>
          ) : null
        }
      />

      {/* ③ 확인층: 선택 트레이 + 적용 */}
      <View className="gap-2 border-t border-secondary-100 px-4 pb-4 pt-3 dark:border-surface-overlay">
        {showCapNotice ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="font-sans text-xs text-error-600 dark:text-error-400"
          >
            지역은 최대 {MAX_REGION_UNITS}개까지 선택할 수 있어요. 먼저 선택을 해제해주세요.
          </Text>
        ) : null}
        {pending.length > 0 ? (
          <View className="flex-row items-center gap-2">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
              className="flex-1"
            >
              {pending.map((token) => (
                <Pressable
                  key={`tray-${token}`}
                  onPress={() => handleToggle(token)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${regionTokenLabel(token)} 선택 해제`}
                  className="min-h-[36px] flex-row items-center gap-1 rounded-full bg-primary-50 px-3 py-1 dark:bg-primary-900/30"
                >
                  <Text className="font-sans-medium text-sm text-primary-700 dark:text-primary-300">
                    {regionTokenLabel(token)}
                  </Text>
                  <XMarkIcon size={14} color={SECONDARY_PALETTE[500]} />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setPending([])}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="지역 선택 모두 해제"
            >
              <Text className="font-sans-medium text-sm text-content-secondary underline dark:text-secondary-400">
                초기화
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <MapPinIcon size={14} color={SECONDARY_PALETTE[400]} />
            <Text className="font-sans text-xs text-content-secondary dark:text-secondary-400">
              선택하지 않으면 전체 지역의 공고를 보여드려요
            </Text>
          </View>
        )}
        <Pressable
          onPress={handleApply}
          accessibilityRole="button"
          accessibilityLabel={applyLabel}
          testID="region-filter-apply"
          className="min-h-[48px] items-center justify-center rounded-lg bg-primary-600 active:opacity-80 dark:bg-primary-700"
        >
          <Text className="font-sans-semibold text-base text-content-onGold">{applyLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const RegionFilterSheet = memo(function RegionFilterSheet({
  visible,
  onClose,
  appliedTokens,
  onApply,
  recentTokens,
  suggestedSlug,
  appliedRoles,
  appliedSalary,
}: RegionFilterSheetProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="지역 필터" position="bottom" showCloseButton>
      {/* visible 시에만 마운트 — 오픈마다 적용값으로 초기화 + 닫힘 상태 쿼리 방지 */}
      {visible ? (
        <SheetBody
          onClose={onClose}
          appliedTokens={appliedTokens}
          onApply={onApply}
          recentTokens={recentTokens}
          suggestedSlug={suggestedSlug}
          appliedRoles={appliedRoles}
          appliedSalary={appliedSalary}
        />
      ) : null}
    </Modal>
  );
});

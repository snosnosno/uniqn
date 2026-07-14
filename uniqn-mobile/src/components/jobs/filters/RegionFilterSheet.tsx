/**
 * UNIQN Mobile - 지역 필터 시트 (브라우즈 멀티선택)
 *
 * @description 2-패널(좌: 그룹 탭 / 우: 칩 그리드) + 검색 + 최근/내 지역 바로가기 + 그룹 전체 선택.
 * 선택 모델은 utils/regionSelection 토큰(slug | 'group:서울') — 상호배타·최대 5단위.
 * 공고작성 폼의 단일선택(RegionSelectModal)과 별개인 브라우즈 전용 시트.
 */

import { Fragment, memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MapPinIcon,
  SearchIcon,
  XMarkIcon,
} from '@/components/icons';
import { PRIMARY_COLORS, SECONDARY_PALETTE } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
import {
  REGION_GROUPS,
  REGIONS_BY_GROUP,
  getRegionChildren,
  getRegionLabel,
  hasRegionChildren,
  searchRegions,
  type RegionGroup,
  type RegionOption,
} from '@/constants/regions';
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

/** 선택 체크 골드 — 라이트는 대비 확보용 primary-700 (RegionSelectModal 관례와 동일) */
function useCheckColor(): string {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  return isDarkMode ? PRIMARY_COLORS[500] : PRIMARY_COLORS[700];
}

/** 우측 그리드 칩 — 2열(48%) */
function RegionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const checkColor = useCheckColor();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label} 지역`}
      className={`min-h-[44px] w-[48%] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
          : 'border-secondary-200 dark:border-surface-overlay'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${
          selected ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? <CheckIcon size={16} color={checkColor} /> : null}
    </Pressable>
  );
}

/**
 * 구(3레벨) 보유 시 칩 — 탭은 선택이 아니라 하위 구 목록 펼침/접힘 토글.
 * 상태 표시: 시 전체 선택 시 selected 스타일, 아니면 선택된 구 개수 배지(그룹 탭 배지와 동일).
 */
function ExpansionChip({
  label,
  selected,
  childCount,
  expanded,
  onPress,
}: {
  label: string;
  /** 시 slug 토큰이 선택됨 = "시 전체" */
  selected: boolean;
  /** 선택된 소속 구 개수 (selected 아닐 때만 배지 노출) */
  childCount: number;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${label} 하위 지역 ${expanded ? '접기' : '펼치기'}`}
      className={`min-h-[44px] w-[48%] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
          : 'border-secondary-200 dark:border-surface-overlay'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${
          selected ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-1">
        {!selected && childCount > 0 ? (
          <View className="rounded-full bg-primary-600 px-1.5 dark:bg-primary-700">
            <Text className="font-sans-semibold text-[10px] text-content-onGold">{childCount}</Text>
          </View>
        ) : null}
        {expanded ? (
          <ChevronDownIcon size={16} color={SECONDARY_PALETTE[400]} />
        ) : (
          <ChevronRightIcon size={16} color={SECONDARY_PALETTE[400]} />
        )}
      </View>
    </Pressable>
  );
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
  const [searchText, setSearchText] = useState('');
  const [activeGroup, setActiveGroup] = useState<RegionGroup>(
    () => (appliedTokens[0] && regionTokenGroup(appliedTokens[0])) || '서울'
  );
  const [showCapNotice, setShowCapNotice] = useState(false);
  // 단일 아코디언 — 한 번에 한 시(市)만 펼침. 그룹 전환·검색 진입 시 null 로 리셋.
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  const trimmedSearch = searchText.trim();
  const isSearching = trimmedSearch.length > 0;
  const searchResults = useMemo(() => searchRegions(trimmedSearch), [trimmedSearch]);

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
    keepPreviousCounts: true,
  });

  const sheetHeight = Math.min(Math.round(windowHeight * 0.72), 640);

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

  // 우측 패널 섹션: subGroup(경기 남부/북부) 있으면 소섹션으로 분리
  const activeSections = useMemo(() => {
    // 그리드는 시-레벨(parentSlug 없는)만 — 구는 부모 시의 인라인 확장에서만 렌더(중복 노출 금지).
    // 데이터 에이전트가 구에 부모와 동일 subGroup 을 부여하므로 subGroup 필터로는 안 걸러진다.
    const topLevel = REGIONS_BY_GROUP[activeGroup].filter((o) => !o.parentSlug);
    // 단일 시 그룹 승격(인천 케이스): 시-레벨이 정확히 1개이고 구를 보유하면
    // 그 시 칩을 숨기고 children 을 최상위 토글 칩으로 승격(서울 25구와 동형).
    // "시 전체"는 그룹 전체 행(group 토큰)이 담당하므로 시 칩이 불필요.
    const soleCity = topLevel.length === 1 ? topLevel[0] : undefined;
    const gridOptions =
      soleCity && hasRegionChildren(soleCity.slug)
        ? [...getRegionChildren(soleCity.slug)]
        : topLevel;
    const subGroups = Array.from(new Set(gridOptions.map((o) => o.subGroup).filter(Boolean)));
    if (subGroups.length === 0) {
      return [{ title: null as string | null, options: gridOptions }];
    }
    return subGroups.map((sub) => ({
      title: sub as string,
      options: gridOptions.filter((o) => o.subGroup === sub),
    }));
  }, [activeGroup]);

  const applyLabel = hasCounts ? `공고 ${counts?.total ?? 0}건 보기` : '적용';

  const renderChip = (option: RegionOption) => (
    <RegionChip
      key={option.slug}
      label={option.label}
      selected={pending.includes(option.slug)}
      onPress={() => handleToggle(option.slug)}
    />
  );

  // 시(市) 셀 렌더 — 구 없는 항목은 일반 칩, 구 보유 항목은 확장 칩 + 펼침 시 인라인 구 그리드.
  const renderRegionCell = (option: RegionOption) => {
    if (!hasRegionChildren(option.slug)) {
      return renderChip(option);
    }
    const children = getRegionChildren(option.slug);
    const selectedChildCount = children.reduce(
      (n, child) => (pending.includes(child.slug) ? n + 1 : n),
      0
    );
    const isExpanded = expandedCity === option.slug;
    const cityAllSelected = pending.includes(option.slug);
    return (
      <Fragment key={option.slug}>
        <ExpansionChip
          label={option.label}
          selected={cityAllSelected}
          childCount={selectedChildCount}
          expanded={isExpanded}
          onPress={() => setExpandedCity((cur) => (cur === option.slug ? null : option.slug))}
        />
        {isExpanded ? (
          <View className="w-full rounded-lg bg-surface-card p-3 dark:bg-surface-elevated">
            <View className="flex-row flex-wrap justify-between gap-y-2">
              <RegionChip
                key={`${option.slug}-all`}
                label={`${option.label} 전체`}
                selected={cityAllSelected}
                onPress={() => handleToggle(option.slug)}
              />
              {children.map(renderChip)}
            </View>
          </View>
        ) : null}
      </Fragment>
    );
  };

  return (
    <View className="-mx-5 -mb-5" style={{ height: sheetHeight }}>
      {/* ① 바로가기층: 검색 + 최근/내 지역 */}
      <View className="gap-2 px-4 pb-3 pt-1">
        <View className="min-h-[44px] flex-row items-center gap-2 rounded-lg border border-secondary-300 px-3 dark:border-surface-overlay">
          <SearchIcon size={18} color={SECONDARY_PALETTE[400]} />
          <TextInput
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
              if (text.trim().length > 0) setExpandedCity(null);
            }}
            placeholder="지역 검색 (예: 강남, 수원)"
            placeholderTextColor={SECONDARY_PALETTE[400]}
            className="flex-1 py-2 font-sans text-base text-content-primary"
            accessibilityLabel="지역 검색"
            testID="region-filter-search-input"
          />
          {isSearching ? (
            <Pressable
              onPress={() => setSearchText('')}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
            >
              <XMarkIcon size={16} color={SECONDARY_PALETTE[400]} />
            </Pressable>
          ) : null}
        </View>
        {!isSearching && shortcuts.length > 0 ? (
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
        ) : null}
      </View>

      {/* ② 탐색층: 검색 결과(플랫) 또는 2-패널 */}
      {isSearching ? (
        <ScrollView
          className="flex-1 border-t border-secondary-100 dark:border-surface-overlay"
          keyboardShouldPersistTaps="handled"
        >
          {searchResults.length === 0 ? (
            <Text className="px-4 py-6 text-center font-sans text-sm text-content-secondary dark:text-secondary-400">
              &apos;{trimmedSearch}&apos; 지역을 찾지 못했어요. 구/시 이름으로 검색해보세요.
            </Text>
          ) : (
            searchResults.map((option) => {
              const selected = pending.includes(option.slug);
              return (
                <Pressable
                  key={option.slug}
                  onPress={() => handleToggle(option.slug)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${option.group} ${option.label} 선택`}
                  className="flex-row items-center justify-between border-b border-secondary-100 px-4 py-3.5 active:opacity-70 dark:border-surface-overlay"
                >
                  <View className="flex-row items-baseline gap-2">
                    <Text className="font-sans text-base text-content-primary">{option.label}</Text>
                    <Text className="font-sans text-xs text-content-muted dark:text-secondary-500">
                      {option.parentSlug
                        ? `${option.group} · ${getRegionLabel(option.parentSlug)}`
                        : option.group}
                    </Text>
                  </View>
                  {selected ? <CheckIcon size={20} color={checkColor} /> : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View className="flex-1 flex-row border-t border-secondary-100 dark:border-surface-overlay">
          {/* 좌: 그룹 탭 — 9그룹 세로 스크롤. grow-0/shrink-0 필수: RN-web ScrollView 는
              기본 flexGrow:1 이라 폭 지정이 flex-basis 로만 작동해 남은 공간을 나눠 갖는다(50/50 버그).
              76px = 2글자 라벨+선택 배지+웹 스크롤바까지 줄바꿈 없이 수용하는 최소 폭(실측) */}
          <ScrollView className="w-[76px] grow-0 shrink-0 bg-surface-card dark:bg-surface-elevated">
            {REGION_GROUPS.map((group) => {
              const isActive = group === activeGroup;
              const count = groupCounts[group];
              return (
                <Pressable
                  key={group}
                  onPress={() => {
                    setActiveGroup(group);
                    setExpandedCity(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${group} 그룹${count > 0 ? `, ${count}개 선택됨` : ''}`}
                  className={`min-h-[48px] flex-row items-center justify-center gap-1 px-2 ${
                    isActive ? 'bg-surface-page dark:bg-surface' : ''
                  }`}
                >
                  <Text
                    className={`font-sans text-sm ${
                      isActive
                        ? 'font-sans-semibold text-content-primary'
                        : 'text-content-secondary dark:text-secondary-400'
                    }`}
                  >
                    {group}
                  </Text>
                  {count > 0 ? (
                    <View className="rounded-full bg-primary-600 px-1.5 dark:bg-primary-700">
                      <Text className="font-sans-semibold text-[10px] text-content-onGold">
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 우: 전체 행 + 칩 그리드 (경기: 남부/북부 소섹션) */}
          <ScrollView className="flex-1 px-3 py-3" keyboardShouldPersistTaps="handled">
            {GROUP_ALL_SUPPORTED.includes(activeGroup) ? (
              <Pressable
                onPress={() => handleToggle(groupToken(activeGroup))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: pending.includes(groupToken(activeGroup)) }}
                accessibilityLabel={`${activeGroup} 전체 선택`}
                className={`mb-3 min-h-[44px] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
                  pending.includes(groupToken(activeGroup))
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-secondary-200 dark:border-surface-overlay'
                }`}
              >
                <Text
                  className={`font-sans-semibold text-sm ${
                    pending.includes(groupToken(activeGroup))
                      ? 'text-primary-700 dark:text-primary-300'
                      : 'text-content-primary'
                  }`}
                >
                  {activeGroup} 전체
                </Text>
                {pending.includes(groupToken(activeGroup)) ? (
                  <CheckIcon size={16} color={checkColor} />
                ) : null}
              </Pressable>
            ) : null}
            {activeSections.map((section) => (
              <View key={section.title ?? 'all'} className="mb-2">
                {section.title ? (
                  <Text className="mb-2 font-sans-semibold text-xs text-content-muted dark:text-secondary-400">
                    {section.title}
                  </Text>
                ) : null}
                <View className="flex-row flex-wrap justify-between gap-y-2">
                  {section.options.map(renderRegionCell)}
                </View>
              </View>
            ))}
            <View className="h-4" />
          </ScrollView>
        </View>
      )}

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

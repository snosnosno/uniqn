/**
 * UNIQN Mobile - 지역 택소노미 브라우저 (공유 본문)
 *
 * @description 2-패널(좌: 그룹 탭 / 우: 칩 그리드 + 구 아코디언) + 검색. Modal 비의존·선택모델
 * 비의존 프레젠테이션 — 하이라이트/픽을 isSelected/onPickSlug 콜백으로 위임한다.
 * 소비처: RegionFilterSheet(멀티 토큰 토글) · PlaceSheet mode:'region'(단일 slug 교체).
 * 그룹 전체("서울 전체")는 renderGroupAllRow 슬롯 — 미지정이면 미노출(단일선택의 권역 배제).
 * 루트는 flex-1: 부모가 높이를 bound 해야 한다.
 */

import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
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

export interface RegionTaxonomyBrowserProps {
  /** a11y role 분기 — multi: checkbox/checked, single: radio/selected */
  selectionMode: 'multi' | 'single';
  /** slug 하이라이트 여부 (단일: slug===region / 멀티: pending 포함 여부) */
  isSelected: (slug: string) => boolean;
  /** slug 픽 — 토글/교체 판단은 caller 책임. 그룹 전체는 renderGroupAllRow 가 담당 */
  onPickSlug: (slug: string) => void;
  /** 좌 그룹 탭 배지 개수 (멀티 필터 전용 — 미지정이면 배지 미노출) */
  groupBadgeCount?: (group: RegionGroup) => number;
  /** 우측 상단 '그룹 전체' 행 (멀티 필터 전용 — 미지정이면 권역 선택 불가) */
  renderGroupAllRow?: (group: RegionGroup) => React.ReactNode;
  /** 검색박스 아래 슬롯 (필터 최근/내 지역 바로가기) */
  renderBelowSearch?: (ctx: { isSearching: boolean }) => React.ReactNode;
  initialGroup?: RegionGroup;
  searchInputTestID?: string;
}

/** 선택 체크 골드 — 라이트는 대비 확보용 primary-700 (구 공고작성 폼 단일선택 모달(은퇴) 관례와 동일) */
function useCheckColor(): string {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  return isDarkMode ? PRIMARY_COLORS[500] : PRIMARY_COLORS[700];
}

type SelectableA11y = { role: 'checkbox' | 'radio'; state: (on: boolean) => object };
const a11yFor = (mode: 'multi' | 'single'): SelectableA11y =>
  mode === 'multi'
    ? { role: 'checkbox', state: (on) => ({ checked: on }) }
    : { role: 'radio', state: (on) => ({ selected: on }) };

/** 우측 그리드 칩 — 2열(48%) */
function RegionChip({
  label,
  selected,
  onPress,
  a11y,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  a11y: SelectableA11y;
}) {
  const checkColor = useCheckColor();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={a11y.role}
      accessibilityState={a11y.state(selected)}
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
 * 상태 표시: 시 전체 선택 시 selected 스타일, 아니면 선택된 구 개수 배지.
 */
function ExpansionChip({
  label,
  selected,
  childCount,
  expanded,
  onPress,
}: {
  label: string;
  selected: boolean;
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

export function RegionTaxonomyBrowser({
  selectionMode,
  isSelected,
  onPickSlug,
  groupBadgeCount,
  renderGroupAllRow,
  renderBelowSearch,
  initialGroup,
  searchInputTestID,
}: RegionTaxonomyBrowserProps) {
  const [searchText, setSearchText] = useState('');
  const [activeGroup, setActiveGroup] = useState<RegionGroup>(initialGroup ?? '서울');
  // 단일 아코디언 — 한 번에 한 시(市)만 펼침. 그룹 전환·검색 진입 시 null 로 리셋.
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  const trimmedSearch = searchText.trim();
  const isSearching = trimmedSearch.length > 0;
  const searchResults = useMemo(() => searchRegions(trimmedSearch), [trimmedSearch]);
  const checkColor = useCheckColor();
  const a11y = a11yFor(selectionMode);

  // 우측 패널 섹션: subGroup(경기 남부/북부) 있으면 소섹션으로 분리
  const activeSections = useMemo(() => {
    // 그리드는 시-레벨(parentSlug 없는)만 — 구는 부모 시의 인라인 확장에서만 렌더(중복 노출 금지).
    const topLevel = REGIONS_BY_GROUP[activeGroup].filter((o) => !o.parentSlug);
    // 단일 시 그룹 승격(인천 케이스): 시-레벨이 정확히 1개이고 구를 보유하면
    // 그 시 칩을 숨기고 children 을 최상위 토글 칩으로 승격(서울 25구와 동형).
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

  const renderChip = (option: RegionOption) => (
    <RegionChip
      key={option.slug}
      label={option.label}
      selected={isSelected(option.slug)}
      onPress={() => onPickSlug(option.slug)}
      a11y={a11y}
    />
  );

  // 시(市) 셀 렌더 — 구 없는 항목은 일반 칩, 구 보유 항목은 확장 칩 + 펼침 시 인라인 구 그리드.
  const renderRegionCell = (option: RegionOption) => {
    if (!hasRegionChildren(option.slug)) {
      return renderChip(option);
    }
    const children = getRegionChildren(option.slug);
    const selectedChildCount = children.reduce(
      (n, child) => (isSelected(child.slug) ? n + 1 : n),
      0
    );
    const isExpanded = expandedCity === option.slug;
    const cityAllSelected = isSelected(option.slug);
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
                onPress={() => onPickSlug(option.slug)}
                a11y={a11y}
              />
              {children.map(renderChip)}
            </View>
          </View>
        ) : null}
      </Fragment>
    );
  };

  return (
    <View className="flex-1">
      {/* ① 검색층 */}
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
            testID={searchInputTestID}
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
        {renderBelowSearch?.({ isSearching })}
      </View>

      {/* ② 탐색층: 검색 결과(플랫) 또는 2-패널 */}
      {isSearching ? (
        <ScrollView
          className="flex-1 border-t border-secondary-100 dark:border-surface-overlay"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {searchResults.length === 0 ? (
            <Text className="px-4 py-6 text-center font-sans text-sm text-content-secondary dark:text-secondary-400">
              &apos;{trimmedSearch}&apos; 지역을 찾지 못했어요. 구/시 이름으로 검색해보세요.
            </Text>
          ) : (
            searchResults.map((option) => {
              const selected = isSelected(option.slug);
              return (
                <Pressable
                  key={option.slug}
                  onPress={() => onPickSlug(option.slug)}
                  accessibilityRole={a11y.role}
                  accessibilityState={a11y.state(selected)}
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
              76px = 2글자 라벨+선택 배지+웹 스크롤바까지 줄바꿈 없이 수용하는 최소 폭(실측).
              nestedScrollEnabled: 외부 세로 ScrollView(SheetModal/Modal) 안에 중첩되므로 Android
              내부 스크롤 무력화 방지 — 아래 검색결과·우측 칩 그리드 ScrollView 동일 이유(iOS/웹 no-op) */}
          <ScrollView
            className="w-[76px] grow-0 shrink-0 bg-surface-card dark:bg-surface-elevated"
            nestedScrollEnabled
          >
            {REGION_GROUPS.map((group) => {
              const isActive = group === activeGroup;
              const count = groupBadgeCount?.(group) ?? 0;
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

          {/* 우: 그룹전체 슬롯 + 칩 그리드 (경기: 남부/북부 소섹션) */}
          <ScrollView
            className="flex-1 px-3 py-3"
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {renderGroupAllRow?.(activeGroup)}
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
    </View>
  );
}

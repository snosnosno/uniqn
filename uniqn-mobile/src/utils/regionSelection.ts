/**
 * UNIQN Mobile - 지역 필터 선택 모델
 *
 * @description 브라우즈 지역 필터의 선택 단위(토큰) 모델.
 * 토큰 = 지역 slug('서울 강남구') 또는 그룹 전체('group:서울').
 * 저장(MMKV persist)·최근 목록·쿼리 확장이 모두 이 토큰 배열을 단일 소스로 사용한다.
 *
 * 불변식:
 * - 같은 그룹의 그룹 토큰과 개별 slug 토큰은 공존하지 않는다(상호배타 — toggleRegionToken 이 강제).
 * - 선택 단위는 최대 MAX_REGION_UNITS 개(그룹 토큰도 1단위).
 */

import {
  REGION_GROUPS,
  REGIONS_BY_GROUP,
  getRegionLabel,
  getRegionOption,
  isRegionSlug,
  type RegionGroup,
} from '@/constants/regions';

export type RegionToken = string;

const GROUP_TOKEN_PREFIX = 'group:';

export const MAX_REGION_UNITS = 5;

/**
 * 그룹 전체 선택을 지원하는 그룹.
 * 광역시는 slug 자체가 시 단위(개별=전체), 기타는 2개뿐이라 제외.
 */
export const GROUP_ALL_SUPPORTED: readonly RegionGroup[] = ['서울', '경기', '제주'];

export function groupToken(group: RegionGroup): RegionToken {
  return `${GROUP_TOKEN_PREFIX}${group}`;
}

export function isGroupToken(token: RegionToken): boolean {
  return token.startsWith(GROUP_TOKEN_PREFIX);
}

export function groupFromToken(token: RegionToken): RegionGroup | undefined {
  if (!isGroupToken(token)) return undefined;
  const group = token.slice(GROUP_TOKEN_PREFIX.length) as RegionGroup;
  return REGION_GROUPS.includes(group) ? group : undefined;
}

export function isValidRegionToken(token: unknown): token is RegionToken {
  if (typeof token !== 'string' || !token) return false;
  if (isGroupToken(token)) return groupFromToken(token) !== undefined;
  return isRegionSlug(token);
}

/** persist 복원/외부 입력 방어 — 유효 토큰만 남기고 중복 제거 */
export function sanitizeRegionTokens(tokens: unknown): RegionToken[] {
  if (!Array.isArray(tokens)) return [];
  const seen = new Set<RegionToken>();
  const result: RegionToken[] = [];
  for (const token of tokens) {
    if (isValidRegionToken(token) && !seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}

/** 토큰이 속한 그룹 (slug 토큰은 지역 상수에서 역참조) */
export function regionTokenGroup(token: RegionToken): RegionGroup | undefined {
  return groupFromToken(token) ?? getRegionOption(token)?.group;
}

export interface ToggleRegionTokenResult {
  tokens: RegionToken[];
  /** 최대 개수 초과로 추가가 거부됨 (tokens 는 원본과 동일 내용) */
  capped: boolean;
}

/**
 * 토큰 토글 — 항상 새 배열 반환.
 * 그룹 토큰 추가 시 같은 그룹의 slug 를 모두 해제하고, slug 추가 시 그 그룹의 그룹 토큰을 해제한다.
 */
export function toggleRegionToken(
  tokens: RegionToken[],
  token: RegionToken
): ToggleRegionTokenResult {
  if (tokens.includes(token)) {
    return { tokens: tokens.filter((t) => t !== token), capped: false };
  }

  const targetGroup = regionTokenGroup(token);
  const withoutConflicts = tokens.filter((t) => {
    if (targetGroup === undefined) return true;
    // 그룹 토큰을 추가하면 같은 그룹의 개별 slug 제거, slug 를 추가하면 같은 그룹의 그룹 토큰 제거
    if (isGroupToken(token)) return regionTokenGroup(t) !== targetGroup || isGroupToken(t);
    return t !== groupToken(targetGroup);
  });

  if (withoutConflicts.length >= MAX_REGION_UNITS) {
    return { tokens: [...tokens], capped: true };
  }

  return { tokens: [...withoutConflicts, token], capped: false };
}

/** 토큰 배열 → 쿼리용 slug 목록 (그룹은 소속 slug 전체로 확장, 중복 제거) */
export function expandRegionTokens(tokens: RegionToken[]): string[] {
  const slugs = new Set<string>();
  for (const token of tokens) {
    const group = groupFromToken(token);
    if (group) {
      for (const option of REGIONS_BY_GROUP[group]) {
        slugs.add(option.slug);
      }
    } else if (isRegionSlug(token)) {
      slugs.add(token);
    }
  }
  return Array.from(slugs);
}

/** 단일 토큰 표시 라벨 — 그룹은 "서울 전체", slug 는 지역 라벨 */
export function regionTokenLabel(token: RegionToken): string {
  const group = groupFromToken(token);
  if (group) return `${group} 전체`;
  return getRegionLabel(token) ?? token;
}

/** 필터 pill 라벨 — 없음: "지역 전체" / 1개: 토큰 라벨 / n개: "강남구 외 2" */
export function formatRegionTokensLabel(tokens: RegionToken[]): string {
  if (tokens.length === 0) return '지역 전체';
  const first = regionTokenLabel(tokens[0]!);
  if (tokens.length === 1) return first;
  return `${first} 외 ${tokens.length - 1}`;
}

/** 그룹 탭 배지용 — 그룹별 선택 단위 수 (그룹 전체 토큰도 1) */
export function countRegionTokensByGroup(tokens: RegionToken[]): Record<RegionGroup, number> {
  const counts = Object.fromEntries(REGION_GROUPS.map((g) => [g, 0])) as Record<
    RegionGroup,
    number
  >;
  for (const token of tokens) {
    const group = regionTokenGroup(token);
    if (group) counts[group] += 1;
  }
  return counts;
}

/**
 * UNIQN Mobile - 지역 필터 선택 모델
 *
 * @description 브라우즈 지역 필터의 선택 단위(토큰) 모델.
 * 토큰 = 지역 slug('서울 강남구') 또는 그룹 전체('group:서울').
 * 시 slug 는 "시 전체" 의미로 오버로드된다 — 별도 city: 토큰 없이 확장 규칙이 3층을 처리
 * (구 도입 전 저장된 '부산' 토큰이 자동으로 "부산 전체"로 승격 = 도입 전 매칭과 동일).
 * 저장(MMKV persist)·최근 목록·쿼리 확장이 모두 이 토큰 배열을 단일 소스로 사용한다.
 *
 * 불변식 (3층 상호배타 — toggleRegionToken 이 강제):
 * - 같은 그룹의 그룹 토큰과 시/구 slug 토큰은 공존하지 않는다.
 * - 시 토큰과 그 시의 구 토큰은 공존하지 않는다(시 ⊃ 구).
 * - 선택 단위는 최대 MAX_REGION_UNITS 개(그룹·시 토큰도 1단위).
 */

import {
  REGION_GROUPS,
  REGIONS_BY_GROUP,
  REGION_GROUP_QUERY_PREFIXES,
  getRegionChildren,
  getRegionLabel,
  getRegionOption,
  hasRegionChildren,
  isRegionSlug,
  type RegionGroup,
} from '@/constants/regions';

export type RegionToken = string;

const GROUP_TOKEN_PREFIX = 'group:';

export const MAX_REGION_UNITS = 5;

/**
 * 그룹 전체 선택을 지원하는 그룹 — 기타(기타/해외 2개뿐)만 제외.
 * 파생으로 두어 그룹 개편 시 자동 추종한다.
 */
export const GROUP_ALL_SUPPORTED: readonly RegionGroup[] = REGION_GROUPS.filter(
  (g) => g !== '기타'
);

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
 * 3층 상호배타: 그룹 추가 → 같은 그룹의 시/구 해제, slug 추가 → 그 그룹의 그룹 토큰 해제,
 * 시 추가 → 그 시의 구 해제, 구 추가 → 부모 시 해제.
 */
export function toggleRegionToken(
  tokens: RegionToken[],
  token: RegionToken
): ToggleRegionTokenResult {
  if (tokens.includes(token)) {
    return { tokens: tokens.filter((t) => t !== token), capped: false };
  }

  const targetGroup = regionTokenGroup(token);
  const targetParent = isGroupToken(token) ? undefined : getRegionOption(token)?.parentSlug;
  const withoutConflicts = tokens.filter((t) => {
    if (targetGroup === undefined) return true;
    // 그룹 토큰을 추가하면 같은 그룹의 개별 slug 제거
    if (isGroupToken(token)) return regionTokenGroup(t) !== targetGroup || isGroupToken(t);
    // slug 를 추가하면 같은 그룹의 그룹 토큰 제거
    if (t === groupToken(targetGroup)) return false;
    // 시를 추가하면 그 시의 구 토큰 제거
    if (getRegionOption(t)?.parentSlug === token) return false;
    // 구를 추가하면 부모 시 토큰 제거
    if (targetParent !== undefined && t === targetParent) return false;
    return true;
  });

  if (withoutConflicts.length >= MAX_REGION_UNITS) {
    return { tokens: [...tokens], capped: true };
  }

  return { tokens: [...withoutConflicts, token], capped: false };
}

/**
 * 토큰 배열 → 쿼리용 slug 목록 (중복 제거).
 * 그룹 → 소속 slug 전체 / 시 → 시 + 소속 구 전체(시 전체 의미) /
 * 구 → 구 + 부모 시(시 단위로만 저장된 "구 미상" 공고도 노출 — recall 우선 제품결정).
 */
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
      for (const child of getRegionChildren(token)) {
        slugs.add(child.slug);
      }
      const parentSlug = getRegionOption(token)?.parentSlug;
      if (parentSlug) {
        slugs.add(parentSlug);
      }
    }
  }
  return Array.from(slugs);
}

export interface RegionQueryScope {
  /** 정확 매칭 slug 목록 (시 토큰=시+구, 구 토큰=구+부모 확장. 접두에 덮이는 slug 는 제거) */
  slugs: string[];
  /** 접두 매칭 목록 — 그룹 토큰 압축 ('경기' → region like '경기%'). URL 길이 폭발 방지 */
  prefixes: string[];
}

/**
 * 토큰 배열 → 서버 쿼리 스코프.
 * 그룹 토큰은 slug 전수 나열 대신 REGION_GROUP_QUERY_PREFIXES 로 압축한다 —
 * 그룹 4개 이상 선택 시 in() 160+ 나열이 게이트웨이 URL 한도를 넘던 실측 결함의 근본 수정.
 * 시/구 slug 토큰은 expandRegionTokens 와 동일 규칙으로 확장하고, 접두에 이미 덮이는
 * slug 는 중복 조건이라 제거한다. 카운트/목록이 같은 스코프를 소비해 정합 유지.
 */
export function expandRegionTokensToScope(tokens: RegionToken[]): RegionQueryScope {
  const prefixes = new Set<string>();
  const slugTokens: RegionToken[] = [];
  for (const token of tokens) {
    const group = groupFromToken(token);
    if (group) {
      for (const prefix of REGION_GROUP_QUERY_PREFIXES[group]) {
        prefixes.add(prefix);
      }
    } else {
      slugTokens.push(token);
    }
  }
  const prefixList = Array.from(prefixes);
  const slugs = expandRegionTokens(slugTokens).filter(
    (slug) => !prefixList.some((prefix) => slug.startsWith(prefix))
  );
  return { slugs, prefixes: prefixList };
}

/** 단일 토큰 표시 라벨 — 그룹은 "서울 전체", 구 보유 시는 "부산 전체"(확장 의미 명시), 그 외 지역 라벨 */
export function regionTokenLabel(token: RegionToken): string {
  const group = groupFromToken(token);
  if (group) return `${group} 전체`;
  const label = getRegionLabel(token) ?? token;
  return hasRegionChildren(token) ? `${label} 전체` : label;
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

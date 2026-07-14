/**
 * 지역 필터 선택 모델 테스트
 */

import {
  GROUP_ALL_SUPPORTED,
  MAX_REGION_UNITS,
  countRegionTokensByGroup,
  expandRegionTokens,
  expandRegionTokensToScope,
  formatRegionTokensLabel,
  groupFromToken,
  groupToken,
  isGroupToken,
  isValidRegionToken,
  regionTokenGroup,
  regionTokenLabel,
  sanitizeRegionTokens,
  toggleRegionToken,
} from '../regionSelection';
import {
  REGIONS_BY_GROUP,
  REGION_GROUP_QUERY_PREFIXES,
  getRegionChildren,
} from '@/constants/regions';

describe('regionSelection 토큰 기본', () => {
  it('그룹 토큰 생성/판별/역파싱이 일관된다', () => {
    const token = groupToken('서울');
    expect(token).toBe('group:서울');
    expect(isGroupToken(token)).toBe(true);
    expect(groupFromToken(token)).toBe('서울');
  });

  it('유효성: 실존 slug 와 실존 그룹만 통과한다', () => {
    expect(isValidRegionToken('서울 강남구')).toBe(true);
    expect(isValidRegionToken('group:경기')).toBe(true);
    expect(isValidRegionToken('group:없는그룹')).toBe(false);
    expect(isValidRegionToken('없는지역')).toBe(false);
    expect(isValidRegionToken('')).toBe(false);
    expect(isValidRegionToken(null)).toBe(false);
  });

  it('sanitize: 비배열/무효/중복을 걸러낸다', () => {
    expect(sanitizeRegionTokens(undefined)).toEqual([]);
    expect(sanitizeRegionTokens('문자열')).toEqual([]);
    expect(
      sanitizeRegionTokens(['서울 강남구', '서울 강남구', 'group:서울', '삭제된지역', 42])
    ).toEqual(['서울 강남구', 'group:서울']);
  });
});

describe('toggleRegionToken', () => {
  it('없으면 추가, 있으면 제거한다 (불변)', () => {
    const base: string[] = [];
    const added = toggleRegionToken(base, '서울 강남구');
    expect(added.tokens).toEqual(['서울 강남구']);
    expect(added.capped).toBe(false);
    expect(base).toEqual([]);

    const removed = toggleRegionToken(added.tokens, '서울 강남구');
    expect(removed.tokens).toEqual([]);
  });

  it('그룹 전체 선택 시 같은 그룹의 개별 slug 를 해제한다', () => {
    const { tokens } = toggleRegionToken(['서울 강남구', '경기 수원시'], groupToken('서울'));
    expect(tokens).toEqual(['경기 수원시', 'group:서울']);
  });

  it('개별 slug 선택 시 같은 그룹의 그룹 토큰을 해제한다', () => {
    const { tokens } = toggleRegionToken([groupToken('서울'), '경기 수원시'], '서울 서초구');
    expect(tokens).toEqual(['경기 수원시', '서울 서초구']);
  });

  it('최대 단위 수를 넘는 추가는 거부하고 capped 를 반환한다', () => {
    const full = ['서울 강남구', '서울 서초구', '서울 송파구', '경기 수원시', '부산'];
    expect(full).toHaveLength(MAX_REGION_UNITS);
    const result = toggleRegionToken(full, '대구');
    expect(result.capped).toBe(true);
    expect(result.tokens).toEqual(full);
    // 가득 찬 상태에서도 제거는 가능
    expect(toggleRegionToken(full, '부산').tokens).toHaveLength(4);
  });

  it('가득 찬 상태에서도 상호배타 치환은 허용된다 (그룹 토큰이 slug 를 흡수)', () => {
    const full = ['서울 강남구', '서울 서초구', '서울 송파구', '서울 마포구', '서울 용산구'];
    const result = toggleRegionToken(full, groupToken('서울'));
    expect(result.capped).toBe(false);
    expect(result.tokens).toEqual(['group:서울']);
  });
});

describe('expandRegionTokens', () => {
  it('그룹 토큰을 소속 slug 전체로 확장한다', () => {
    expect(expandRegionTokens([groupToken('서울')])).toHaveLength(REGIONS_BY_GROUP['서울'].length);
    expect(expandRegionTokens([groupToken('경기')])).toHaveLength(REGIONS_BY_GROUP['경기'].length);
    expect(expandRegionTokens([groupToken('제주')])).toEqual(['제주 제주시', '제주 서귀포시']);
  });

  it('slug 는 그대로 통과하고 그룹 확장과 중복 제거된다', () => {
    const slugs = expandRegionTokens([groupToken('서울'), '서울 강남구', '경기 수원시']);
    // 서울 전체 + 수원시(+소속 구, 강남구는 중복 제거)
    expect(slugs).toHaveLength(
      REGIONS_BY_GROUP['서울'].length + 1 + getRegionChildren('경기 수원시').length
    );
    expect(slugs).toContain('경기 수원시');
  });

  it('빈 선택은 빈 배열(필터 없음)', () => {
    expect(expandRegionTokens([])).toEqual([]);
  });
});

describe('라벨/집계', () => {
  it('토큰 라벨: 그룹은 "N 전체", slug 는 지역 라벨', () => {
    expect(regionTokenLabel(groupToken('서울'))).toBe('서울 전체');
    expect(regionTokenLabel('서울 강남구')).toBe('강남구');
  });

  it('pill 라벨: 없음/1개/다수', () => {
    expect(formatRegionTokensLabel([])).toBe('지역 전체');
    expect(formatRegionTokensLabel([groupToken('서울')])).toBe('서울 전체');
    expect(formatRegionTokensLabel(['서울 강남구', '서울 서초구', '부산'])).toBe('강남구 외 2');
  });

  it('그룹별 선택 수를 집계한다', () => {
    // 부산이 속한 그룹은 택소노미 개편(광역시→경상)과 무관하게 동적으로 조회
    const busanGroup = regionTokenGroup('부산');
    expect(busanGroup).toBeDefined();
    const counts = countRegionTokensByGroup([
      '서울 강남구',
      '서울 서초구',
      groupToken('경기'),
      '부산',
    ]);
    expect(counts['서울']).toBe(2);
    expect(counts['경기']).toBe(1);
    expect(counts[busanGroup!]).toBe(1);
    expect(counts['제주']).toBe(0);
  });
});

describe('3층(그룹>시>구) 모델 — 전국 택소노미', () => {
  it('구 보유 시 토큰은 시+소속 구 전체로 확장된다 (시 전체 의미)', () => {
    const children = getRegionChildren('부산');
    expect(children.length).toBeGreaterThan(0);
    const slugs = expandRegionTokens(['부산']);
    expect(slugs).toHaveLength(1 + children.length);
    expect(slugs).toContain('부산');
    expect(slugs).toContain('부산 해운대구');
  });

  it('구 토큰은 구+부모 시로 확장된다 (시 단위 저장 공고 포함 — 제품결정)', () => {
    expect(expandRegionTokens(['부산 해운대구']).sort()).toEqual(['부산', '부산 해운대구']);
    expect(expandRegionTokens(['경기 수원시 장안구'])).toContain('경기 수원시');
  });

  it('구 없는 시·군 토큰은 자기 자신만 확장된다', () => {
    expect(expandRegionTokens(['강원 원주시'])).toEqual(['강원 원주시']);
  });

  it('시 선택 시 그 시의 구 토큰을 해제한다 (다른 시·타 그룹은 유지)', () => {
    const { tokens } = toggleRegionToken(['부산 해운대구', '대구 수성구', '서울 강남구'], '부산');
    expect(tokens).toEqual(['대구 수성구', '서울 강남구', '부산']);
  });

  it('구 선택 시 부모 시 토큰을 해제한다', () => {
    const { tokens } = toggleRegionToken(['부산', '서울 강남구'], '부산 해운대구');
    expect(tokens).toEqual(['서울 강남구', '부산 해운대구']);
  });

  it('그룹 전체 선택 시 같은 그룹의 시·구 토큰을 모두 해제한다', () => {
    const gyeongsang = regionTokenGroup('부산')!;
    const { tokens } = toggleRegionToken(
      ['부산', '부산 해운대구', '경북 포항시', '서울 강남구'],
      groupToken(gyeongsang)
    );
    expect(tokens).toEqual(['서울 강남구', groupToken(gyeongsang)]);
  });

  it('구 보유 시 토큰 라벨은 "{시} 전체"', () => {
    expect(regionTokenLabel('부산')).toBe('부산 전체');
    expect(regionTokenLabel('경기 수원시')).toBe('수원시 전체');
    expect(regionTokenLabel('강원 원주시')).toBe('원주시');
    expect(regionTokenLabel('부산 해운대구')).toBe('해운대구');
  });

  it('persist 호환: 개편 전 저장 가능했던 토큰 전부 유효 유지', () => {
    const legacyTokens = [
      '서울 강남구',
      '경기 수원시',
      '부산',
      '인천',
      '세종',
      'group:서울',
      'group:경기',
      'group:제주',
      '기타',
      '해외',
    ];
    expect(sanitizeRegionTokens(legacyTokens)).toEqual(legacyTokens);
  });

  it('그룹 전체 선택은 기타를 제외한 전 그룹이 지원한다', () => {
    expect(GROUP_ALL_SUPPORTED).toEqual(expect.arrayContaining(['서울', '경기', '제주']));
    expect(GROUP_ALL_SUPPORTED).not.toContain('기타');
  });
});

describe('expandRegionTokensToScope — 서버 쿼리 스코프 (그룹 접두 압축)', () => {
  it('그룹 토큰은 slug 나열 대신 접두 목록으로 압축된다', () => {
    const gyeongsang = regionTokenGroup('부산')!;
    const scope = expandRegionTokensToScope([groupToken(gyeongsang)]);
    expect(scope.slugs).toEqual([]);
    expect(scope.prefixes.sort()).toEqual(['경남', '경북', '대구', '부산', '울산']);
  });

  it('시/구 slug 토큰은 expandRegionTokens 와 동일하게 확장된다 (접두 없음)', () => {
    const scope = expandRegionTokensToScope(['부산 해운대구', '강원 원주시']);
    expect(scope.prefixes).toEqual([]);
    expect(scope.slugs.sort()).toEqual(['강원 원주시', '부산', '부산 해운대구']);
  });

  it('접두에 덮이는 slug 는 중복 조건이라 제거된다', () => {
    const gyeongsang = regionTokenGroup('부산')!;
    const scope = expandRegionTokensToScope([
      groupToken(gyeongsang),
      '서울 강남구',
      '경북 포항시', // 경상 접두 '경북' 에 덮임
    ]);
    expect(scope.slugs).toEqual(['서울 강남구']);
    expect(scope.prefixes).toContain('경북');
  });

  it('그룹 5개 최악 선택도 조건 수가 상수 수준으로 유지된다 (URL 한도 실측 결함 가드)', () => {
    const groups = ['서울', '경기', '충청', '전라', '경상'] as const;
    const scope = expandRegionTokensToScope(groups.map((g) => groupToken(g)));
    expect(scope.slugs).toEqual([]);
    // 접두 총수 = 각 그룹 접두 합 (서울1+경기1+충청4+전라3+경상5 = 14)
    expect(scope.prefixes.length).toBeLessThanOrEqual(16);
  });

  it('접두 파티션 안전성: 모든 slug 는 자기 그룹의 접두에만 매칭된다', () => {
    for (const [group, options] of Object.entries(REGIONS_BY_GROUP)) {
      for (const option of options) {
        for (const [otherGroup, prefixes] of Object.entries(REGION_GROUP_QUERY_PREFIXES)) {
          const matches = prefixes.some((p) => option.slug.startsWith(p));
          if (otherGroup === group) {
            expect(matches).toBe(true);
          } else if (matches) {
            throw new Error(
              `slug '${option.slug}'(${group})가 타 그룹 ${otherGroup} 접두에 매칭됨`
            );
          }
        }
      }
    }
  });
});

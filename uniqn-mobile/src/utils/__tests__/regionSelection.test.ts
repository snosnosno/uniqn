/**
 * 지역 필터 선택 모델 테스트
 */

import {
  MAX_REGION_UNITS,
  countRegionTokensByGroup,
  expandRegionTokens,
  formatRegionTokensLabel,
  groupFromToken,
  groupToken,
  isGroupToken,
  isValidRegionToken,
  regionTokenLabel,
  sanitizeRegionTokens,
  toggleRegionToken,
} from '../regionSelection';

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
    expect(expandRegionTokens([groupToken('서울')])).toHaveLength(25);
    expect(expandRegionTokens([groupToken('경기')])).toHaveLength(31);
    expect(expandRegionTokens([groupToken('제주')])).toEqual(['제주 제주시', '제주 서귀포시']);
  });

  it('slug 는 그대로 통과하고 그룹 확장과 중복 제거된다', () => {
    const slugs = expandRegionTokens([groupToken('서울'), '서울 강남구', '경기 수원시']);
    expect(slugs).toHaveLength(26); // 서울 25 + 수원시 (강남구는 중복)
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
    const counts = countRegionTokensByGroup([
      '서울 강남구',
      '서울 서초구',
      groupToken('경기'),
      '부산',
    ]);
    expect(counts['서울']).toBe(2);
    expect(counts['경기']).toBe(1);
    expect(counts['광역시']).toBe(1);
    expect(counts['제주']).toBe(0);
  });
});

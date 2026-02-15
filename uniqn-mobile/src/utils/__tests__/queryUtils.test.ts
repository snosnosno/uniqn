/**
 * queryUtils 테스트
 *
 * @description React Query Key 생성 및 비교 유틸리티 테스트
 * - stableFilters: undefined/null 제거 및 키 정렬
 * - areQueryKeysEqual: Query Key 동일성 비교
 */

import { stableFilters, areQueryKeysEqual } from '../queryUtils';

describe('queryUtils', () => {
  // ============================================================================
  // stableFilters 테스트
  // ============================================================================
  describe('stableFilters', () => {
    it('null/undefined 입력 시 빈 객체 반환', () => {
      expect(stableFilters(null)).toEqual({});
      expect(stableFilters(undefined)).toEqual({});
    });

    it('undefined 값 필드 제거', () => {
      const filters = {
        status: 'active',
        role: undefined,
        location: '서울',
      };

      const result = stableFilters(filters);

      expect(result).toEqual({
        location: '서울',
        status: 'active',
      });
      expect(result).not.toHaveProperty('role');
    });

    it('null 값 필드 제거', () => {
      const filters = {
        status: 'active',
        role: null,
      };

      const result = stableFilters(filters);

      expect(result).toEqual({
        status: 'active',
      });
      expect(result).not.toHaveProperty('role');
    });

    it('키를 정렬하여 일관된 결과 보장', () => {
      const filters1 = { b: 2, a: 1, c: 3 };
      const filters2 = { c: 3, a: 1, b: 2 };

      const result1 = stableFilters(filters1);
      const result2 = stableFilters(filters2);

      // 키 순서가 동일해야 함
      expect(Object.keys(result1)).toEqual(['a', 'b', 'c']);
      expect(Object.keys(result2)).toEqual(['a', 'b', 'c']);
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('중첩 객체도 재귀적으로 안정화', () => {
      const filters = {
        status: 'active',
        options: {
          sortBy: 'date',
          nullField: undefined,
        },
      };

      const result = stableFilters(filters);

      expect(result.options).toEqual({ sortBy: 'date' });
    });

    it('배열 값은 그대로 유지', () => {
      const filters = {
        roles: ['dealer', 'floor'],
        status: 'active',
      };

      const result = stableFilters(filters);

      expect(result.roles).toEqual(['dealer', 'floor']);
    });

    it('빈 객체 입력 시 빈 객체 반환', () => {
      expect(stableFilters({})).toEqual({});
    });

    it('숫자, 불리언 값 유지', () => {
      const filters = {
        page: 1,
        isActive: true,
        count: 0,
        flag: false,
      };

      const result = stableFilters(filters);

      expect(result).toEqual({
        count: 0,
        flag: false,
        isActive: true,
        page: 1,
      });
    });
  });

  // ============================================================================
  // areQueryKeysEqual 테스트
  // ============================================================================
  describe('areQueryKeysEqual', () => {
    it('동일한 원시값 배열은 true', () => {
      expect(areQueryKeysEqual(['jobs', 'list'], ['jobs', 'list'])).toBe(true);
    });

    it('다른 원시값 배열은 false', () => {
      expect(areQueryKeysEqual(['jobs', 'list'], ['jobs', 'detail'])).toBe(false);
    });

    it('길이가 다르면 false', () => {
      expect(areQueryKeysEqual(['jobs'], ['jobs', 'list'])).toBe(false);
    });

    it('객체 포함 배열 비교 (동일 내용)', () => {
      expect(
        areQueryKeysEqual(['jobs', { status: 'active' }], ['jobs', { status: 'active' }])
      ).toBe(true);
    });

    it('객체 포함 배열 비교 (다른 내용)', () => {
      expect(
        areQueryKeysEqual(['jobs', { status: 'active' }], ['jobs', { status: 'closed' }])
      ).toBe(false);
    });

    it('빈 배열은 동일', () => {
      expect(areQueryKeysEqual([], [])).toBe(true);
    });

    it('숫자와 문자열 구분', () => {
      expect(areQueryKeysEqual([1, 'a'], [1, 'a'])).toBe(true);
      expect(areQueryKeysEqual([1, 'a'], ['1', 'a'])).toBe(false);
    });
  });
});

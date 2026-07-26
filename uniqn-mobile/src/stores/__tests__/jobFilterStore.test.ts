/**
 * 구인구직 필터 스토어 테스트
 */

import { useJobFilterStore, sanitizeRoleFilters, sanitizeSalaryFilter } from '../jobFilterStore';

describe('jobFilterStore', () => {
  beforeEach(() => {
    useJobFilterStore.setState({
      regionTokens: [],
      recentRegionTokens: [],
      roleFilters: [],
      salaryFilter: null,
    });
  });

  it('applyRegionTokens: 선택을 교체하고 최근 목록에 쌓는다', () => {
    useJobFilterStore.getState().applyRegionTokens(['서울 강남구', 'group:경기']);

    const state = useJobFilterStore.getState();
    expect(state.regionTokens).toEqual(['서울 강남구', 'group:경기']);
    expect(state.recentRegionTokens).toEqual(['서울 강남구', 'group:경기']);
  });

  it('applyRegionTokens: 무효 토큰은 정화되어 저장되지 않는다', () => {
    useJobFilterStore.getState().applyRegionTokens(['서울 강남구', '없는지역', 'group:없는그룹']);

    expect(useJobFilterStore.getState().regionTokens).toEqual(['서울 강남구']);
  });

  it('최근 목록: 중복 제거 + 최대 3개 유지 (최신 우선)', () => {
    const { applyRegionTokens } = useJobFilterStore.getState();
    applyRegionTokens(['서울 강남구']);
    applyRegionTokens(['서울 서초구']);
    applyRegionTokens(['부산']);
    applyRegionTokens(['서울 강남구', '경기 수원시']);

    expect(useJobFilterStore.getState().recentRegionTokens).toEqual([
      '서울 강남구',
      '경기 수원시',
      '부산',
    ]);
  });

  it('빈 선택 적용(전체 보기)은 최근 목록을 훼손하지 않는다', () => {
    const { applyRegionTokens } = useJobFilterStore.getState();
    applyRegionTokens(['서울 강남구']);
    applyRegionTokens([]);

    const state = useJobFilterStore.getState();
    expect(state.regionTokens).toEqual([]);
    expect(state.recentRegionTokens).toEqual(['서울 강남구']);
  });

  it('clearRegionFilter: 선택만 비우고 최근은 유지한다', () => {
    const { applyRegionTokens, clearRegionFilter } = useJobFilterStore.getState();
    applyRegionTokens(['group:서울']);
    clearRegionFilter();

    const state = useJobFilterStore.getState();
    expect(state.regionTokens).toEqual([]);
    expect(state.recentRegionTokens).toEqual(['group:서울']);
  });

  it('applyRoleFilters: 유효 역할만 저장하고 other/무효값은 정화한다', () => {
    useJobFilterStore
      .getState()
      .applyRoleFilters(['dealer', 'other', 'dealer', 'invalid'] as never);

    expect(useJobFilterStore.getState().roleFilters).toEqual(['dealer']);
  });

  it('clearRoleFilter: 역할 선택만 비운다', () => {
    const { applyRoleFilters, clearRoleFilter } = useJobFilterStore.getState();
    applyRoleFilters(['dealer', 'floor']);
    clearRoleFilter();

    expect(useJobFilterStore.getState().roleFilters).toEqual([]);
  });

  it('applySalaryFilter: 유효 조합만 저장, 무효 타입/금액은 null 로 정화한다', () => {
    const { applySalaryFilter } = useJobFilterStore.getState();
    applySalaryFilter({ type: 'hourly', min: 15000, sort: null });
    expect(useJobFilterStore.getState().salaryFilter).toEqual({
      type: 'hourly',
      min: 15000,
      sort: null,
    });

    // 정렬만 선택해도 유효한 필터다(금액 조건 없음)
    applySalaryFilter({ type: 'monthly', min: null, sort: 'high' });
    expect(useJobFilterStore.getState().salaryFilter).toEqual({
      type: 'monthly',
      min: null,
      sort: 'high',
    });

    applySalaryFilter({ type: 'other', min: 15000, sort: null } as never);
    expect(useJobFilterStore.getState().salaryFilter).toBeNull();

    // 금액·정렬이 모두 비면 "급여 조건 없음"과 동치 → null
    applySalaryFilter({ type: 'daily', min: 0, sort: null });
    expect(useJobFilterStore.getState().salaryFilter).toBeNull();

    applySalaryFilter(null);
    expect(useJobFilterStore.getState().salaryFilter).toBeNull();
  });

  it('clearAllFilters: 지역/역할/급여를 모두 비우되 최근 지역은 유지한다', () => {
    const state = useJobFilterStore.getState();
    state.applyRegionTokens(['서울 강남구']);
    state.applyRoleFilters(['dealer']);
    state.applySalaryFilter({ type: 'hourly', min: 15000, sort: 'high' });

    useJobFilterStore.getState().clearAllFilters();

    const after = useJobFilterStore.getState();
    expect(after.regionTokens).toEqual([]);
    expect(after.roleFilters).toEqual([]);
    expect(after.salaryFilter).toBeNull();
    expect(after.recentRegionTokens).toEqual(['서울 강남구']);
  });
});

describe('sanitizeRoleFilters', () => {
  it('배열이 아니면 빈 배열, 유효 역할만 중복 없이 통과한다', () => {
    expect(sanitizeRoleFilters(undefined)).toEqual([]);
    expect(sanitizeRoleFilters('dealer')).toEqual([]);
    expect(sanitizeRoleFilters(['dealer', 'floor', 'dealer', 'other', 42])).toEqual([
      'dealer',
      'floor',
    ]);
  });
});

describe('sanitizeSalaryFilter', () => {
  it('타입이 유효하고 금액·정렬 중 하나는 있어야 통과한다', () => {
    expect(sanitizeSalaryFilter(null)).toBeNull();
    // 금액·정렬이 모두 없으면 조건 없음과 동치
    expect(sanitizeSalaryFilter({ type: 'hourly' })).toBeNull();
    expect(sanitizeSalaryFilter({ type: 'hourly', min: Number.NaN })).toBeNull();
    expect(sanitizeSalaryFilter({ type: 'hourly', min: -1 })).toBeNull();
    expect(sanitizeSalaryFilter({ type: 'hourly', min: 20000 })).toEqual({
      type: 'hourly',
      min: 20000,
      sort: null,
    });
  });

  it('프리셋에 없는 금액은 떨군다 — 프리셋 축소 후 MMKV 에 남은 옛 값 방어', () => {
    // 폐기된 시급 1.1만: 재현·해제 불가한 pill 이 남지 않도록 필터 자체를 접는다
    expect(sanitizeSalaryFilter({ type: 'hourly', min: 11000 })).toBeNull();
    // 정렬이 함께 있으면 금액만 떨구고 정렬은 살린다
    expect(sanitizeSalaryFilter({ type: 'hourly', min: 11000, sort: 'high' })).toEqual({
      type: 'hourly',
      min: null,
      sort: 'high',
    });
    // 월급은 금액 프리셋이 없으므로 어떤 금액도 통과하지 못한다
    expect(sanitizeSalaryFilter({ type: 'monthly', min: 2500000 })).toBeNull();
  });

  it('정렬 값은 high/low 만 통과하고, 무효 정렬은 null 로 떨군다', () => {
    expect(sanitizeSalaryFilter({ type: 'daily', sort: 'high' })).toEqual({
      type: 'daily',
      min: null,
      sort: 'high',
    });
    expect(sanitizeSalaryFilter({ type: 'daily', sort: 'asc' })).toBeNull();
    expect(sanitizeSalaryFilter({ type: 'daily', min: 200000, sort: 'asc' })).toEqual({
      type: 'daily',
      min: 200000,
      sort: null,
    });
  });
});

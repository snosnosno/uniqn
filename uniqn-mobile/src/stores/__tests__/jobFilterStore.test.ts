/**
 * 구인구직 필터 스토어 테스트
 */

import { useJobFilterStore } from '../jobFilterStore';

describe('jobFilterStore', () => {
  beforeEach(() => {
    useJobFilterStore.setState({ regionTokens: [], recentRegionTokens: [] });
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
});

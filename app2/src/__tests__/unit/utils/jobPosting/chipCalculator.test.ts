import { calculateChipCost } from '../../../../utils/jobPosting/chipCalculator';

describe('calculateChipCost', () => {
  describe('고정 공고 (fixed)', () => {
    it('7일 고정 공고는 3칩', () => {
      expect(calculateChipCost('fixed', 7)).toBe(3);
    });

    it('30일 고정 공고는 5칩', () => {
      expect(calculateChipCost('fixed', 30)).toBe(5);
    });

    it('90일 고정 공고는 10칩', () => {
      expect(calculateChipCost('fixed', 90)).toBe(10);
    });

    it('잘못된 기간이면 0칩 반환', () => {
      expect(calculateChipCost('fixed', 15 as any)).toBe(0);
    });

    it('기간 없이 fixed만 전달하면 0칩 반환', () => {
      expect(calculateChipCost('fixed')).toBe(0);
    });
  });

  describe('긴급 공고 (urgent)', () => {
    it('긴급 공고는 5칩 (고정)', () => {
      expect(calculateChipCost('urgent')).toBe(5);
    });

    it('긴급 공고는 기간 파라미터 무시', () => {
      expect(calculateChipCost('urgent', 7)).toBe(5);
      expect(calculateChipCost('urgent', 30)).toBe(5);
      expect(calculateChipCost('urgent', 90)).toBe(5);
    });
  });

  describe('무료 공고 (regular, tournament)', () => {
    it('지원 공고 (regular)는 0칩', () => {
      expect(calculateChipCost('regular')).toBe(0);
    });

    it('대회 공고 (tournament)는 0칩', () => {
      expect(calculateChipCost('tournament')).toBe(0);
    });

    it('지원 공고는 기간 파라미터 무시', () => {
      expect(calculateChipCost('regular', 7)).toBe(0);
    });

    it('대회 공고는 기간 파라미터 무시', () => {
      expect(calculateChipCost('tournament', 30)).toBe(0);
    });
  });

  describe('잘못된 입력값', () => {
    it('잘못된 postingType이면 0칩 반환', () => {
      expect(calculateChipCost('invalid' as any)).toBe(0);
    });

    it('빈 문자열이면 0칩 반환', () => {
      expect(calculateChipCost('' as any)).toBe(0);
    });

    it('null이면 0칩 반환', () => {
      expect(calculateChipCost(null as any)).toBe(0);
    });

    it('undefined이면 0칩 반환', () => {
      expect(calculateChipCost(undefined as any)).toBe(0);
    });
  });

  describe('엣지 케이스', () => {
    it('fixed + 음수 기간은 0칩', () => {
      expect(calculateChipCost('fixed', -1 as any)).toBe(0);
    });

    it('fixed + 0일은 0칩', () => {
      expect(calculateChipCost('fixed', 0 as any)).toBe(0);
    });

    it('fixed + 매우 큰 기간은 0칩', () => {
      expect(calculateChipCost('fixed', 1000 as any)).toBe(0);
    });

    it('대소문자 구분 (소문자만 인식)', () => {
      expect(calculateChipCost('FIXED' as any, 7)).toBe(0);
      expect(calculateChipCost('Fixed' as any, 7)).toBe(0);
    });
  });
});

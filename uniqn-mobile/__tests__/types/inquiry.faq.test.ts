/**
 * FAQ 데이터 정합성 테스트
 *
 * 검증:
 * 1. faq-account-2(회원 탈퇴)가 30일 유예 기간을 반영하는지
 * 2. faq-report-1(신고 처리) 항목이 존재하는지
 * 3. 기존 FAQ id 6개가 그대로 유지되는지 (회귀 방지)
 * 4. 모든 FAQ가 필수 필드를 갖는지
 */

import { FAQ_DATA, filterFAQByCategory } from '@/types/inquiry';

describe('FAQ_DATA', () => {
  describe('회원 탈퇴 FAQ (faq-account-2)', () => {
    const entry = FAQ_DATA.find((f) => f.id === 'faq-account-2');

    it('존재한다', () => {
      expect(entry).toBeDefined();
    });

    it('30일 유예 기간 문구를 포함한다', () => {
      expect(entry?.answer).toContain('30일');
      expect(entry?.answer).toMatch(/유예|철회/);
    });

    it('"복구가 불가능" 단정 문구를 더 이상 포함하지 않는다 (30일 내 철회 가능하므로)', () => {
      // 30일 경과 후의 "복구가 불가능"은 OK (문맥 확인)
      const answer = entry?.answer ?? '';
      const hasConditionalPermanence = /30일이?\s*지나면.*복구/.test(answer);
      const hasUnconditionalPermanence = /탈퇴 시 모든 데이터가 삭제되며 복구가 불가능/.test(
        answer
      );
      expect(hasUnconditionalPermanence).toBe(false);
      expect(hasConditionalPermanence).toBe(true);
    });
  });

  describe('신고 처리 FAQ (faq-report-1)', () => {
    const entry = FAQ_DATA.find((f) => f.id === 'faq-report-1');

    it('존재한다', () => {
      expect(entry).toBeDefined();
    });

    it('category가 "report"이다', () => {
      expect(entry?.category).toBe('report');
    });

    it('허위 신고 경고 문구를 포함한다', () => {
      expect(entry?.answer).toMatch(/허위|악의/);
    });

    it('신고 카테고리 필터링으로 조회 가능하다', () => {
      const reportFaqs = filterFAQByCategory(FAQ_DATA, 'report');
      expect(reportFaqs).toHaveLength(1);
      expect(reportFaqs[0]?.id).toBe('faq-report-1');
    });
  });

  describe('기존 FAQ 회귀 방지', () => {
    const preservedIds = [
      'faq-general-1',
      'faq-general-2',
      'faq-account-1',
      'faq-payment-1',
      'faq-technical-1',
      'faq-technical-2',
      'faq-other-1',
    ];

    it.each(preservedIds)('%s는 그대로 존재한다', (id) => {
      expect(FAQ_DATA.find((f) => f.id === id)).toBeDefined();
    });
  });

  describe('데이터 무결성', () => {
    it('모든 FAQ는 id/category/question/answer/order를 갖는다', () => {
      FAQ_DATA.forEach((item) => {
        expect(item.id).toBeTruthy();
        expect(item.category).toBeTruthy();
        expect(item.question).toBeTruthy();
        expect(item.answer).toBeTruthy();
        expect(typeof item.order).toBe('number');
      });
    });

    it('FAQ id는 고유하다', () => {
      const ids = FAQ_DATA.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

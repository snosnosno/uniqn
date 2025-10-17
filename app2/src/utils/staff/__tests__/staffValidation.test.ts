/**
 * staffValidation.test.ts
 * 스태프 삭제 가능 여부 검증 로직 테스트
 */

import { validateBulkDelete } from '../staffValidation';

// Firebase mocking
jest.mock('../../../firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
}));

describe('staffValidation', () => {
  describe('validateBulkDelete', () => {
    it('빈 배열은 빈 결과를 반환해야 함', async () => {
      const result = await validateBulkDelete('event-1', []);

      expect(result.deletable).toHaveLength(0);
      expect(result.nonDeletable).toHaveLength(0);
    });

    it('날짜가 없는 스태프는 nonDeletable로 분류해야 함', async () => {
      const staffList = [
        {
          staffId: 'user-1',
          staffName: '김철수',
          date: '', // 날짜 없음
        },
      ];

      const result = await validateBulkDelete('event-1', staffList);

      expect(result.deletable).toHaveLength(0);
      expect(result.nonDeletable).toHaveLength(1);
      expect(result.nonDeletable[0]?.reason).toBe('날짜 정보가 없습니다');
    });
  });
});

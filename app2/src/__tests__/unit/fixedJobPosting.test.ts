/**
 * 고정공고 서비스 단위 테스트
 *
 * Phase 4 - 조회수 증가 기능 테스트
 */

import { doc, updateDoc, increment } from 'firebase/firestore';
import { incrementViewCount, viewCountService } from '../../services/fixedJobPosting';
import { logger } from '../../utils/logger';

// Firebase Firestore 모킹
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn((value) => ({ _increment: value })),
}));

// Logger 모킹
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Firebase 모킹
jest.mock('../../firebase', () => ({
  db: {},
}));

describe('fixedJobPosting 서비스', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('incrementViewCount', () => {
    it('정상적으로 조회수를 증가시킨다', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};
      const mockIncrementValue = { _increment: 1 };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (increment as jest.Mock).mockReturnValue(mockIncrementValue);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await incrementViewCount(postingId);

      expect(doc).toHaveBeenCalledWith({}, 'jobPostings', postingId);
      expect(increment).toHaveBeenCalledWith(1);
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        { 'fixedData.viewCount': mockIncrementValue }
      );
      expect(logger.info).toHaveBeenCalledWith('조회수 증가 성공', { postingId });
    });

    it('에러 발생 시 logger.error를 호출하고 throw하지 않는다 (fire-and-forget)', async () => {
      const postingId = 'posting-123';
      const mockError = new Error('Network error');
      (updateDoc as jest.Mock).mockRejectedValue(mockError);

      // fire-and-forget 패턴 - 에러가 throw되지 않아야 함
      await expect(incrementViewCount(postingId)).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '조회수 증가 실패',
        mockError,
        expect.objectContaining({
          postingId,
          errorCode: 'network',
          errorMessage: 'Network error',
        })
      );
    });

    it('permission 에러를 올바르게 분류한다', async () => {
      const postingId = 'posting-123';
      const mockError = new Error('permission denied');
      (updateDoc as jest.Mock).mockRejectedValue(mockError);

      await incrementViewCount(postingId);

      expect(logger.error).toHaveBeenCalledWith(
        '조회수 증가 실패',
        mockError,
        expect.objectContaining({
          postingId,
          errorCode: 'permission',
          errorMessage: 'permission denied',
        })
      );
    });

    it('unknown 에러를 올바르게 처리한다', async () => {
      const postingId = 'posting-123';
      const mockError = new Error('Unexpected error');
      (updateDoc as jest.Mock).mockRejectedValue(mockError);

      await incrementViewCount(postingId);

      expect(logger.error).toHaveBeenCalledWith(
        '조회수 증가 실패',
        mockError,
        expect.objectContaining({
          postingId,
          errorCode: 'unknown',
          errorMessage: 'Unexpected error',
        })
      );
    });

    it('비 Error 객체를 올바르게 처리한다', async () => {
      const postingId = 'posting-123';
      const mockError = 'String error';
      (updateDoc as jest.Mock).mockRejectedValue(mockError);

      await incrementViewCount(postingId);

      expect(logger.error).toHaveBeenCalledWith(
        '조회수 증가 실패',
        undefined,
        expect.objectContaining({
          postingId,
          errorCode: 'unknown',
          errorMessage: 'Unknown error',
        })
      );
    });
  });

  describe('viewCountService', () => {
    it('ViewCountService 인터페이스를 구현한다', () => {
      expect(viewCountService).toHaveProperty('incrementViewCount');
      expect(typeof viewCountService.incrementViewCount).toBe('function');
    });

    it('incrementViewCount 함수를 올바르게 호출한다', async () => {
      const postingId = 'posting-123';
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await viewCountService.incrementViewCount(postingId);

      expect(doc).toHaveBeenCalledWith({}, 'jobPostings', postingId);
      expect(updateDoc).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('조회수 증가 성공', { postingId });
    });
  });
});

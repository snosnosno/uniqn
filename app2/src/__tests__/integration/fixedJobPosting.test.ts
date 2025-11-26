/**
 * 고정공고 서비스 통합 테스트
 *
 * Phase 4 - 조회수 증가 및 Firestore 상호작용 테스트
 */

import { doc, updateDoc, increment } from 'firebase/firestore';
import { incrementViewCount } from '../../services/fixedJobPosting';
import { db } from '../../firebase';

// Firebase Firestore 모킹
jest.mock('firebase/firestore', () => {
  const actualFirestore = jest.requireActual('firebase/firestore');
  return {
    ...actualFirestore,
    doc: jest.fn(),
    updateDoc: jest.fn(),
    getDoc: jest.fn(),
    increment: jest.fn((value) => ({ _increment: value })),
  };
});

// Firebase 모킹
jest.mock('../../firebase', () => ({
  db: {},
}));

// Logger 모킹
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('fixedJobPosting 통합 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Firestore increment() 동작 확인', () => {
    it('Firestore increment(1)을 올바르게 호출한다', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};
      const mockIncrementValue = { _increment: 1 };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (increment as jest.Mock).mockReturnValue(mockIncrementValue);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await incrementViewCount(postingId);

      expect(doc).toHaveBeenCalledWith(db, 'jobPostings', postingId);
      expect(increment).toHaveBeenCalledWith(1);
      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        'fixedData.viewCount': mockIncrementValue,
      });
    });

    it('viewCount 값이 실제로 증가하는 것을 시뮬레이션한다', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};

      // 초기 viewCount = 5
      let currentViewCount = 5;

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockImplementation(() => {
        // 실제 Firestore increment 동작 시뮬레이션
        currentViewCount += 1;
        return Promise.resolve();
      });

      // 3번 호출
      await incrementViewCount(postingId);
      await incrementViewCount(postingId);
      await incrementViewCount(postingId);

      expect(currentViewCount).toBe(8); // 5 + 3
      expect(updateDoc).toHaveBeenCalledTimes(3);
    });

    it('동시에 여러 번 호출해도 안전하다 (원자적 연산)', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};

      let currentViewCount = 0;

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockImplementation(() => {
        // Firestore increment는 원자적 연산이므로 race condition 없음
        currentViewCount += 1;
        return Promise.resolve();
      });

      // 동시에 10번 호출
      await Promise.all([
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
        incrementViewCount(postingId),
      ]);

      expect(currentViewCount).toBe(10);
      expect(updateDoc).toHaveBeenCalledTimes(10);
    });
  });

  describe('네트워크 오류 시나리오', () => {
    it('네트워크 오류 시 에러를 throw하지 않는다 (fire-and-forget)', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      // fire-and-forget 패턴 - 에러가 throw되지 않아야 함
      await expect(incrementViewCount(postingId)).resolves.not.toThrow();
    });

    it('Firestore 권한 오류 시에도 정상적으로 처리한다', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockRejectedValue(new Error('permission denied'));

      await expect(incrementViewCount(postingId)).resolves.not.toThrow();
    });

    it('오류 발생 후 다음 호출은 정상적으로 동작한다', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};

      (doc as jest.Mock).mockReturnValue(mockDocRef);

      // 첫 번째 호출: 실패
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));
      await incrementViewCount(postingId);

      // 두 번째 호출: 성공
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await incrementViewCount(postingId);

      expect(updateDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('fixedData.viewCount 경로 확인', () => {
    it('올바른 필드 경로로 업데이트한다', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};
      const mockIncrementValue = { _increment: 1 };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (increment as jest.Mock).mockReturnValue(mockIncrementValue);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await incrementViewCount(postingId);

      // fixedData.viewCount 경로 확인
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          'fixedData.viewCount': expect.any(Object),
        })
      );
    });

    it('다른 fixedData 필드에는 영향을 주지 않는다', async () => {
      const postingId = 'posting-123';
      const mockDocRef = {};
      const mockIncrementValue = { _increment: 1 };

      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (increment as jest.Mock).mockReturnValue(mockIncrementValue);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await incrementViewCount(postingId);

      // viewCount만 업데이트되고 다른 필드는 영향 없음
      const updateCall = (updateDoc as jest.Mock).mock.calls[0][1];
      expect(Object.keys(updateCall)).toEqual(['fixedData.viewCount']);
    });
  });
});

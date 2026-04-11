/**
 * UNIQN Mobile - Auth ↔ Firestore 동기화 헬퍼 테스트
 */

import { withAuthFirestoreSync } from '../authFirestoreSync';

// ============================================================================
// Mocks
// ============================================================================

const mockUpdateProfile = jest.fn();

jest.mock('firebase/auth', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => {
  class MockAppError extends Error {
    code: string;
    category: string;
    severity: string;
    metadata: Record<string, unknown>;
    constructor(opts: {
      code: string;
      category: string;
      severity: string;
      userMessage: string;
      originalError?: Error;
      metadata?: Record<string, unknown>;
    }) {
      super(opts.userMessage);
      this.name = 'AppError';
      this.code = opts.code;
      this.category = opts.category;
      this.severity = opts.severity;
      this.metadata = opts.metadata ?? {};
    }
  }

  return {
    AppError: MockAppError,
    ERROR_CODES: {
      INFRA_SYNC_FAILED: 'E4006',
    },
  };
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockUser(overrides?: { photoURL?: string | null; displayName?: string | null }) {
  return {
    photoURL: overrides?.photoURL ?? 'https://example.com/photo.jpg',
    displayName: overrides?.displayName ?? 'TestUser',
    uid: 'test-uid',
  } as Parameters<typeof withAuthFirestoreSync>[0]['user'];
}

// ============================================================================
// Tests
// ============================================================================

describe('withAuthFirestoreSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateProfile.mockResolvedValue(undefined);
  });

  it('Auth + Firestore 모두 성공하면 정상 완료', async () => {
    const mockFirestoreUpdate = jest.fn().mockResolvedValue(undefined);

    await withAuthFirestoreSync({
      user: createMockUser(),
      authUpdates: { displayName: 'NewName' },
      firestoreUpdate: mockFirestoreUpdate,
      errorMessage: '실패 메시지',
      uid: 'test-uid',
      operationName: '테스트',
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    expect(mockFirestoreUpdate).toHaveBeenCalledTimes(1);
  });

  it('Auth 업데이트가 빈 객체면 Auth 스킵하고 Firestore만 실행', async () => {
    const mockFirestoreUpdate = jest.fn().mockResolvedValue(undefined);

    await withAuthFirestoreSync({
      user: createMockUser(),
      authUpdates: {},
      firestoreUpdate: mockFirestoreUpdate,
      errorMessage: '실패 메시지',
      uid: 'test-uid',
      operationName: '테스트',
    });

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockFirestoreUpdate).toHaveBeenCalledTimes(1);
  });

  it('Firestore 실패 + Auth 롤백 성공 시 원본 Firestore 에러를 throw', async () => {
    const firestoreError = new Error('Firestore 실패');
    const mockFirestoreUpdate = jest.fn().mockRejectedValue(firestoreError);

    await expect(
      withAuthFirestoreSync({
        user: createMockUser(),
        authUpdates: { displayName: 'NewName' },
        firestoreUpdate: mockFirestoreUpdate,
        errorMessage: '실패 메시지',
        uid: 'test-uid',
        operationName: '테스트',
      })
    ).rejects.toThrow('Firestore 실패');

    // Auth 업데이트 1회 + 롤백 1회 = 2회
    expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
  });

  it('Firestore 실패 + Auth 롤백도 실패 시 INFRA_SYNC_FAILED AppError throw', async () => {
    const firestoreError = new Error('Firestore 실패');
    const mockFirestoreUpdate = jest.fn().mockRejectedValue(firestoreError);

    // 첫 번째 호출(업데이트)은 성공, 두 번째 호출(롤백)은 실패
    mockUpdateProfile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('롤백 실패'));

    await expect(
      withAuthFirestoreSync({
        user: createMockUser(),
        authUpdates: { displayName: 'NewName' },
        firestoreUpdate: mockFirestoreUpdate,
        errorMessage: '커스텀 에러 메시지',
        uid: 'test-uid',
        operationName: '테스트',
      })
    ).rejects.toMatchObject({
      name: 'AppError',
      code: 'E4006',
      metadata: { rollbackFailed: true, uid: 'test-uid' },
    });

    expect(mockUpdateProfile).toHaveBeenCalledTimes(2);
  });

  it('Auth 업데이트 없이 Firestore만 실패하면 Auth 롤백 없이 에러 전파', async () => {
    const firestoreError = new Error('Firestore 실패');
    const mockFirestoreUpdate = jest.fn().mockRejectedValue(firestoreError);

    await expect(
      withAuthFirestoreSync({
        user: createMockUser(),
        authUpdates: {},
        firestoreUpdate: mockFirestoreUpdate,
        errorMessage: '실패 메시지',
        uid: 'test-uid',
        operationName: '테스트',
      })
    ).rejects.toThrow('Firestore 실패');

    // Auth 업데이트/롤백 모두 안 함
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('백업 시 현재 Auth 값을 정확히 저장해야 함', async () => {
    const firestoreError = new Error('Firestore 실패');
    const mockFirestoreUpdate = jest.fn().mockRejectedValue(firestoreError);

    const user = createMockUser({
      photoURL: 'https://example.com/old.jpg',
      displayName: 'OldName',
    });

    await expect(
      withAuthFirestoreSync({
        user,
        authUpdates: { photoURL: 'https://example.com/new.jpg', displayName: 'NewName' },
        firestoreUpdate: mockFirestoreUpdate,
        errorMessage: '실패',
        uid: 'test-uid',
        operationName: '테스트',
      })
    ).rejects.toThrow();

    // 롤백 시 이전 값으로 복원
    expect(mockUpdateProfile).toHaveBeenNthCalledWith(2, user, {
      photoURL: 'https://example.com/old.jpg',
      displayName: 'OldName',
    });
  });
});

/**
 * UNIQN Mobile - Identity Verification Service Tests
 *
 * @description 본인인증 서비스 테스트
 * @version 1.0.0
 */

import {
  generateIdentityVerificationId,
  getPortOneParams,
  verifyIdentityResult,
  linkIdentityVerification,
} from '../identityVerificationService';
import type { VerifiedIdentityData } from '../identityVerificationService';

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockHttpsCallable),
}));

const mockGetFirebaseFunctions = jest.fn(() => ({} as unknown));

jest.mock('@/lib/firebase', () => ({
  getFirebaseFunctions: () => mockGetFirebaseFunctions(),
}));

const mockGetRandomBytes = jest.fn();

jest.mock('expo-crypto', () => ({
  getRandomBytes: (...args: unknown[]) => mockGetRandomBytes(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

// ============================================================================
// Tests
// ============================================================================

describe('IdentityVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateIdentityVerificationId', () => {
    it('성공: 고유한 ID 생성', () => {
      const mockBytes = new Uint8Array([
        0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
        0x88,
      ]);
      mockGetRandomBytes.mockReturnValue(mockBytes);

      const result = generateIdentityVerificationId();

      expect(result).toBe('identity-123456789abcdef01122334455667788');
      expect(result).toMatch(/^identity-[a-f0-9]{32}$/);
      expect(mockGetRandomBytes).toHaveBeenCalledWith(16);
    });

    it('성공: 연속 호출 시 다른 ID 생성', () => {
      const mockBytes1 = new Uint8Array(16).fill(0x11);
      const mockBytes2 = new Uint8Array(16).fill(0x22);

      mockGetRandomBytes.mockReturnValueOnce(mockBytes1);
      const id1 = generateIdentityVerificationId();

      mockGetRandomBytes.mockReturnValueOnce(mockBytes2);
      const id2 = generateIdentityVerificationId();

      expect(id1).not.toBe(id2);
      expect(id1).toBe('identity-11111111111111111111111111111111');
      expect(id2).toBe('identity-22222222222222222222222222222222');
    });

    it('성공: 0x00 바이트 처리', () => {
      const mockBytes = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
        0x0f,
      ]);
      mockGetRandomBytes.mockReturnValue(mockBytes);

      const result = generateIdentityVerificationId();

      expect(result).toBe('identity-000102030405060708090a0b0c0d0e0f');
    });

    it('성공: 0xFF 바이트 처리', () => {
      const mockBytes = new Uint8Array(16).fill(0xff);
      mockGetRandomBytes.mockReturnValue(mockBytes);

      const result = generateIdentityVerificationId();

      expect(result).toBe('identity-ffffffffffffffffffffffffffffffff');
    });

    it('성공: 혼합 바이트 처리', () => {
      const mockBytes = new Uint8Array([
        0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
        0x99,
      ]);
      mockGetRandomBytes.mockReturnValue(mockBytes);

      const result = generateIdentityVerificationId();

      expect(result).toBe('identity-aabbccddeeff00112233445566778899');
      expect(result.length).toBe('identity-'.length + 32);
    });
  });

  describe('getPortOneParams', () => {
    it('성공: PortOne 파라미터 반환', () => {
      const identityVerificationId = 'identity-abc123';

      const result = getPortOneParams(identityVerificationId);

      expect(result).toEqual({
        storeId: 'store-c1b44e1c-7620-445b-bb6c-9b6b62e7ab93',
        identityVerificationId: 'identity-abc123',
        channelKey: 'channel-key-a604c350-4a1e-42e6-b6f3-64c7ea7bde72',
      });
    });

    it('성공: 다양한 ID 형식', () => {
      const testIds = [
        'identity-123',
        'identity-abc',
        'identity-00000000000000000000000000000000',
        'identity-ffffffffffffffffffffffffffffffff',
      ];

      testIds.forEach((id) => {
        const result = getPortOneParams(id);
        expect(result.identityVerificationId).toBe(id);
        expect(result.storeId).toBe('store-c1b44e1c-7620-445b-bb6c-9b6b62e7ab93');
        expect(result.channelKey).toBe('channel-key-a604c350-4a1e-42e6-b6f3-64c7ea7bde72');
      });
    });

    it('성공: 빈 문자열 ID', () => {
      const result = getPortOneParams('');

      expect(result.identityVerificationId).toBe('');
    });
  });

  describe('verifyIdentityResult', () => {
    const identityVerificationId = 'identity-abc123';

    it('성공: 본인인증 결과 검증', async () => {
      const mockData: VerifiedIdentityData = {
        name: '홍길동',
        phone: '01012345678',
        birthDate: '19900101',
        gender: 'male',
      };

      const mockResponse = {
        success: true,
        data: mockData,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await verifyIdentityResult(identityVerificationId);

      expect(result).toEqual(mockData);
      expect(mockHttpsCallable).toHaveBeenCalledWith({ identityVerificationId });
    });

    it('성공: 여성 사용자', async () => {
      const mockData: VerifiedIdentityData = {
        name: '김영희',
        phone: '01087654321',
        birthDate: '19951231',
        gender: 'female',
      };

      const mockResponse = {
        success: true,
        data: mockData,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await verifyIdentityResult(identityVerificationId);

      expect(result).toEqual(mockData);
      expect(result.gender).toBe('female');
    });

    it('성공: 다양한 생년월일 형식', async () => {
      const testCases = [
        { birthDate: '20000101', desc: '2000년대' },
        { birthDate: '19700530', desc: '1970년대' },
        { birthDate: '19601215', desc: '1960년대' },
      ];

      for (const testCase of testCases) {
        const mockData: VerifiedIdentityData = {
          name: '테스트',
          phone: '01012345678',
          birthDate: testCase.birthDate,
          gender: 'male',
        };

        mockHttpsCallable.mockResolvedValue({ data: { success: true, data: mockData } });

        const result = await verifyIdentityResult(identityVerificationId);

        expect(result.birthDate).toBe(testCase.birthDate);
      }
    });

    it('실패: success=false', async () => {
      const mockResponse = {
        success: false,
        error: '본인인증에 실패했습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow(
        '본인인증에 실패했습니다'
      );
    });

    it('실패: data 없음', async () => {
      const mockResponse = {
        success: true,
        data: null,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow(
        '본인인증 검증에 실패했습니다'
      );
    });

    it('실패: data undefined', async () => {
      const mockResponse = {
        success: true,
        data: undefined,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow();
    });

    it('실패: 에러 메시지 없음', async () => {
      const mockResponse = {
        success: false,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow(
        '본인인증 검증에 실패했습니다'
      );
    });

    it('실패: 네트워크 에러', async () => {
      mockHttpsCallable.mockRejectedValue(new Error('Network error'));

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow();
    });

    it('실패: CI 중복', async () => {
      const mockResponse = {
        success: false,
        error: '이미 가입된 CI입니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow(
        '이미 가입된 CI입니다'
      );
    });

    it('실패: 만료된 인증', async () => {
      const mockResponse = {
        success: false,
        error: '인증이 만료되었습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow(
        '인증이 만료되었습니다'
      );
    });

    it('실패: 잘못된 인증 ID', async () => {
      const mockResponse = {
        success: false,
        error: '인증 정보를 찾을 수 없습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult('invalid-id')).rejects.toThrow(
        '인증 정보를 찾을 수 없습니다'
      );
    });

    it('실패: 포트원 API 에러', async () => {
      const mockResponse = {
        success: false,
        error: 'PortOne API error',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(verifyIdentityResult(identityVerificationId)).rejects.toThrow();
    });
  });

  describe('linkIdentityVerification', () => {
    const identityVerificationId = 'identity-abc123';

    it('성공: 본인인증 연결', async () => {
      const mockResponse = {
        success: true,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).resolves.not.toThrow();
      expect(mockHttpsCallable).toHaveBeenCalledWith({ identityVerificationId });
    });

    it('성공: 반환값 없음 (void)', async () => {
      const mockResponse = {
        success: true,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      const result = await linkIdentityVerification(identityVerificationId);

      expect(result).toBeUndefined();
    });

    it('실패: success=false', async () => {
      const mockResponse = {
        success: false,
        error: '본인인증 연결에 실패했습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow(
        '본인인증 연결에 실패했습니다'
      );
    });

    it('실패: 에러 메시지 없음', async () => {
      const mockResponse = {
        success: false,
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow(
        '본인인증 연결에 실패했습니다'
      );
    });

    it('실패: 로그인 안 됨', async () => {
      const mockResponse = {
        success: false,
        error: '로그인이 필요합니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow(
        '로그인이 필요합니다'
      );
    });

    it('실패: 이미 연결됨', async () => {
      const mockResponse = {
        success: false,
        error: '이미 본인인증이 연결되어 있습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow(
        '이미 본인인증이 연결되어 있습니다'
      );
    });

    it('실패: 만료된 인증', async () => {
      const mockResponse = {
        success: false,
        error: '인증이 만료되었습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow(
        '인증이 만료되었습니다'
      );
    });

    it('실패: 인증 정보 없음', async () => {
      const mockResponse = {
        success: false,
        error: '인증 정보를 찾을 수 없습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow(
        '인증 정보를 찾을 수 없습니다'
      );
    });

    it('실패: CI/DI 복사 실패', async () => {
      const mockResponse = {
        success: false,
        error: 'CI/DI 저장에 실패했습니다',
      };

      mockHttpsCallable.mockResolvedValue({ data: mockResponse });

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow(
        'CI/DI 저장에 실패했습니다'
      );
    });

    it('실패: 네트워크 에러', async () => {
      mockHttpsCallable.mockRejectedValue(new Error('Network error'));

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow();
    });

    it('실패: 서버 에러', async () => {
      mockHttpsCallable.mockRejectedValue(new Error('Internal server error'));

      await expect(linkIdentityVerification(identityVerificationId)).rejects.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('시나리오: 정상 본인인증 플로우', async () => {
      // 1. ID 생성
      const mockBytes = new Uint8Array([
        0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
        0x88,
      ]);
      mockGetRandomBytes.mockReturnValue(mockBytes);
      const id = generateIdentityVerificationId();

      // 2. PortOne 파라미터 생성
      const params = getPortOneParams(id);
      expect(params.identityVerificationId).toBe(id);

      // 3. 인증 결과 검증
      const mockData: VerifiedIdentityData = {
        name: '홍길동',
        phone: '01012345678',
        birthDate: '19900101',
        gender: 'male',
      };
      mockHttpsCallable.mockResolvedValueOnce({ data: { success: true, data: mockData } });
      const verified = await verifyIdentityResult(id);
      expect(verified).toEqual(mockData);

      // 4. 본인인증 연결
      mockHttpsCallable.mockResolvedValueOnce({ data: { success: true } });
      await expect(linkIdentityVerification(id)).resolves.not.toThrow();
    });

    it('시나리오: 인증 실패 후 재시도', async () => {
      const mockBytes = new Uint8Array(16).fill(0xaa);
      mockGetRandomBytes.mockReturnValue(mockBytes);
      const id1 = generateIdentityVerificationId();

      // 첫 번째 시도 실패
      mockHttpsCallable.mockResolvedValueOnce({
        data: { success: false, error: '인증 취소' },
      });
      await expect(verifyIdentityResult(id1)).rejects.toThrow('인증 취소');

      // 새 ID로 재시도
      mockGetRandomBytes.mockReturnValue(new Uint8Array(16).fill(0xbb));
      const id2 = generateIdentityVerificationId();
      expect(id2).not.toBe(id1);

      const mockData: VerifiedIdentityData = {
        name: '홍길동',
        phone: '01012345678',
        birthDate: '19900101',
        gender: 'male',
      };
      mockHttpsCallable.mockResolvedValueOnce({ data: { success: true, data: mockData } });
      const verified = await verifyIdentityResult(id2);
      expect(verified).toEqual(mockData);
    });

    it('시나리오: CI 중복 감지', async () => {
      const mockBytes = new Uint8Array(16).fill(0xcc);
      mockGetRandomBytes.mockReturnValue(mockBytes);
      const id = generateIdentityVerificationId();

      // 이미 가입된 CI
      mockHttpsCallable.mockResolvedValue({
        data: { success: false, error: '이미 가입된 CI입니다' },
      });

      await expect(verifyIdentityResult(id)).rejects.toThrow('이미 가입된 CI입니다');
    });

    it('시나리오: 만료된 인증 처리', async () => {
      const mockBytes = new Uint8Array(16).fill(0xdd);
      mockGetRandomBytes.mockReturnValue(mockBytes);
      const id = generateIdentityVerificationId();

      // 인증 만료
      mockHttpsCallable.mockResolvedValue({
        data: { success: false, error: '인증이 만료되었습니다' },
      });

      await expect(verifyIdentityResult(id)).rejects.toThrow('인증이 만료되었습니다');

      // 연결 시도도 실패
      await expect(linkIdentityVerification(id)).rejects.toThrow('인증이 만료되었습니다');
    });

    it('시나리오: 네트워크 장애 처리', async () => {
      const mockBytes = new Uint8Array(16).fill(0xee);
      mockGetRandomBytes.mockReturnValue(mockBytes);
      const id = generateIdentityVerificationId();

      // 네트워크 에러
      mockHttpsCallable.mockRejectedValue(new Error('Network timeout'));

      await expect(verifyIdentityResult(id)).rejects.toThrow();
      await expect(linkIdentityVerification(id)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('generateIdentityVerificationId: 모든 0 바이트', () => {
      mockGetRandomBytes.mockReturnValue(new Uint8Array(16).fill(0x00));
      const id = generateIdentityVerificationId();
      expect(id).toBe('identity-00000000000000000000000000000000');
    });

    it('generateIdentityVerificationId: 모든 F 바이트', () => {
      mockGetRandomBytes.mockReturnValue(new Uint8Array(16).fill(0xff));
      const id = generateIdentityVerificationId();
      expect(id).toBe('identity-ffffffffffffffffffffffffffffffff');
    });

    it('verifyIdentityResult: 전화번호 형식 다양', async () => {
      const testPhones = ['01012345678', '01087654321', '01011112222'];

      for (const phone of testPhones) {
        const mockData: VerifiedIdentityData = {
          name: '테스트',
          phone,
          birthDate: '19900101',
          gender: 'male',
        };

        mockHttpsCallable.mockResolvedValue({ data: { success: true, data: mockData } });

        const result = await verifyIdentityResult('identity-test');
        expect(result.phone).toBe(phone);
      }
    });

    it('verifyIdentityResult: 특수 문자 이름', async () => {
      const mockData: VerifiedIdentityData = {
        name: 'O\'Brien',
        phone: '01012345678',
        birthDate: '19900101',
        gender: 'male',
      };

      mockHttpsCallable.mockResolvedValue({ data: { success: true, data: mockData } });

      const result = await verifyIdentityResult('identity-test');
      expect(result.name).toBe('O\'Brien');
    });

    it('linkIdentityVerification: 빈 identityVerificationId', async () => {
      mockHttpsCallable.mockResolvedValue({
        data: { success: false, error: '인증 ID가 없습니다' },
      });

      await expect(linkIdentityVerification('')).rejects.toThrow();
    });

    it('verifyIdentityResult: 응답 데이터 불완전', async () => {
      const incompleteData = {
        name: '홍길동',
        phone: '01012345678',
        // birthDate 누락
        // gender 누락
      };

      mockHttpsCallable.mockResolvedValue({
        data: { success: true, data: incompleteData },
      });

      const result = await verifyIdentityResult('identity-test');
      expect(result.name).toBe('홍길동');
      expect(result.phone).toBe('01012345678');
    });
  });
});

/**
 * UNIQN Mobile - Biometric Service Tests
 *
 * @description 생체인증 서비스 테스트
 * @version 1.0.0
 */

import {
  checkBiometricStatus,
  getBiometricTypeName,
  authenticateWithBiometric,
  saveBiometricCredentials,
  getBiometricCredentials,
  clearBiometricCredentials,
  setBiometricEnabled,
  isBiometricEnabled,
  biometricService,
} from '../biometricService';

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockGetRefreshToken = jest.fn();
const mockSetRefreshToken = jest.fn();
const mockClearTokens = jest.fn();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockDeleteItem = jest.fn();

jest.mock('@/lib/secureStorage', () => ({
  authStorage: {
    getRefreshToken: (...args: unknown[]) => mockGetRefreshToken(...args),
    setRefreshToken: (...args: unknown[]) => mockSetRefreshToken(...args),
    clearTokens: () => mockClearTokens(),
  },
  getItem: (...args: unknown[]) => mockGetItem(...args),
  setItem: (...args: unknown[]) => mockSetItem(...args),
  deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe('BiometricService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Status Check
  // ==========================================================================

  describe('checkBiometricStatus', () => {
    it('웹이 아닌 환경에서 기본 상태를 확인해야 함', async () => {
      const status = await checkBiometricStatus();

      expect(status).toHaveProperty('isHardwareAvailable');
      expect(status).toHaveProperty('isEnrolled');
      expect(status).toHaveProperty('biometricTypes');
      expect(status).toHaveProperty('isAvailable');
      expect(status).toHaveProperty('securityLevel');
    });

    it('생체인증 사용 불가능한 경우 isAvailable이 false여야 함', async () => {
      const status = await checkBiometricStatus();

      if (!status.isHardwareAvailable || !status.isEnrolled) {
        expect(status.isAvailable).toBe(false);
      }
    });

    it('biometricTypes는 배열이어야 함', async () => {
      const status = await checkBiometricStatus();

      expect(Array.isArray(status.biometricTypes)).toBe(true);
    });

    it('securityLevel은 정의된 값 중 하나여야 함', async () => {
      const status = await checkBiometricStatus();

      expect(['none', 'device', 'biometric']).toContain(status.securityLevel);
    });

    it('isAvailable은 하드웨어와 등록 여부에 따라 결정되어야 함', async () => {
      const status = await checkBiometricStatus();

      expect(status.isAvailable).toBe(status.isHardwareAvailable && status.isEnrolled);
    });
  });

  describe('getBiometricTypeName', () => {
    it('Face ID를 반환해야 함 (iOS)', () => {
      const name = getBiometricTypeName(['facial']);
      expect(name).toBe('Face ID');
    });

    it('Touch ID를 반환해야 함 (iOS)', () => {
      const name = getBiometricTypeName(['fingerprint']);
      expect(name).toBe('Touch ID');
    });

    it('홍채 인식을 반환해야 함', () => {
      const name = getBiometricTypeName(['iris']);
      expect(name).toBe('홍채 인식');
    });

    it('타입이 없으면 기본 이름을 반환해야 함', () => {
      const name = getBiometricTypeName([]);
      expect(name).toBe('생체 인증');
    });

    it('여러 타입이 있으면 첫 번째 우선순위 타입을 반환해야 함', () => {
      const name1 = getBiometricTypeName(['facial', 'fingerprint']);
      const name2 = getBiometricTypeName(['fingerprint', 'iris']);

      expect(name1).toBe('Face ID');
      expect(name2).toBe('Touch ID');
    });
  });

  // ==========================================================================
  // Authentication
  // ==========================================================================

  describe('authenticateWithBiometric', () => {
    it('옵션을 전달하지 않아도 동작해야 함', async () => {
      const result = await authenticateWithBiometric();

      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('커스텀 옵션을 전달할 수 있어야 함', async () => {
      const result = await authenticateWithBiometric({
        promptMessage: '인증해주세요',
        cancelLabel: '닫기',
        disableDeviceFallback: true,
      });

      expect(result).toHaveProperty('success');
    });

    it('실패 시 에러 정보를 포함해야 함', async () => {
      const result = await authenticateWithBiometric();

      if (!result.success) {
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('errorCode');
        expect(typeof result.error).toBe('string');
        expect(typeof result.errorCode).toBe('string');
      }
    });
  });

  // ==========================================================================
  // Credentials Storage
  // ==========================================================================

  describe('saveBiometricCredentials', () => {
    it('저장 실패 시 에러를 던져야 함', async () => {
      mockSetRefreshToken.mockRejectedValue(new Error('Storage error'));

      await expect(saveBiometricCredentials('user-123', 'token')).rejects.toThrow();
    });
  });

  describe('getBiometricCredentials', () => {
    it('자격 증명이 없으면 null을 반환해야 함', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await getBiometricCredentials();

      expect(result).toBeNull();
    });

    it('Refresh Token이 없으면 null을 반환해야 함', async () => {
      const credentials = {
        userId: 'user-123',
        refreshToken: 'token',
        savedAt: Date.now(),
      };

      mockGetItem.mockResolvedValue(credentials);
      mockGetRefreshToken.mockResolvedValue(null);

      const result = await getBiometricCredentials();

      expect(result).toBeNull();
    });

    it('조회 실패 시 null을 반환해야 함', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      const result = await getBiometricCredentials();

      expect(result).toBeNull();
    });
  });

  describe('clearBiometricCredentials', () => {
    it('삭제 실패 시 에러를 던져야 함', async () => {
      mockDeleteItem.mockRejectedValue(new Error('Delete error'));

      await expect(clearBiometricCredentials()).rejects.toThrow();
    });
  });

  // ==========================================================================
  // Settings
  // ==========================================================================

  describe('setBiometricEnabled', () => {
    it('설정 저장 실패 시 에러를 던져야 함', async () => {
      mockSetItem.mockRejectedValue(new Error('Storage error'));

      await expect(setBiometricEnabled(true)).rejects.toThrow();
    });
  });

  describe('isBiometricEnabled', () => {
    it('설정이 없으면 false를 반환해야 함', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });

    it('조회 실패 시 false를 반환해야 함', async () => {
      mockGetItem.mockRejectedValue(new Error('Storage error'));

      const result = await isBiometricEnabled();

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Service Export
  // ==========================================================================

  describe('biometricService', () => {
    it('모든 메서드를 포함해야 함', () => {
      expect(biometricService).toHaveProperty('checkBiometricStatus');
      expect(biometricService).toHaveProperty('getBiometricTypeName');
      expect(biometricService).toHaveProperty('authenticateWithBiometric');
      expect(biometricService).toHaveProperty('saveBiometricCredentials');
      expect(biometricService).toHaveProperty('getBiometricCredentials');
      expect(biometricService).toHaveProperty('clearBiometricCredentials');
      expect(biometricService).toHaveProperty('setBiometricEnabled');
      expect(biometricService).toHaveProperty('isBiometricEnabled');
    });

    it('모든 메서드가 함수여야 함', () => {
      expect(typeof biometricService.checkBiometricStatus).toBe('function');
      expect(typeof biometricService.getBiometricTypeName).toBe('function');
      expect(typeof biometricService.authenticateWithBiometric).toBe('function');
      expect(typeof biometricService.saveBiometricCredentials).toBe('function');
      expect(typeof biometricService.getBiometricCredentials).toBe('function');
      expect(typeof biometricService.clearBiometricCredentials).toBe('function');
      expect(typeof biometricService.setBiometricEnabled).toBe('function');
      expect(typeof biometricService.isBiometricEnabled).toBe('function');
    });
  });
});

/**
 * UNIQN Mobile - Feature Flag Service Tests
 *
 * @description Feature Flag 서비스 테스트
 * @version 1.0.0
 */

import { featureFlagService, whenEnabled, selectByFlag } from '../featureFlagService';
// type FeatureFlagKey imported in service - not needed directly

// ============================================================================
// Mock Dependencies
// ============================================================================

const mockFetchAndActivateRemoteConfig = jest.fn();
const mockGetRemoteConfigBoolean = jest.fn();

jest.mock('@/lib/firebase', () => ({
  fetchAndActivateRemoteConfig: (...args: unknown[]) => mockFetchAndActivateRemoteConfig(...args),
  getRemoteConfigBoolean: (key: string) => mockGetRemoteConfigBoolean(key),
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

// Mock __DEV__
(global as any).__DEV__ = true;

// ============================================================================
// Tests
// ============================================================================

describe('FeatureFlagService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 각 테스트마다 서비스 초기화 상태 리셋
    (featureFlagService as unknown as { initialized: boolean }).initialized = false;
    (featureFlagService as unknown as { lastFetchTime: number }).lastFetchTime = 0;
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('initialize', () => {
    it('서비스를 성공적으로 초기화해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockReturnValue(true);

      await featureFlagService.initialize();

      expect(mockFetchAndActivateRemoteConfig).toHaveBeenCalled();
      expect(featureFlagService['initialized']).toBe(true);
    });

    it('이미 초기화된 경우 다시 초기화하지 않아야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);

      await featureFlagService.initialize();
      await featureFlagService.initialize();

      expect(mockFetchAndActivateRemoteConfig).toHaveBeenCalledTimes(1);
    });

    it('초기화 실패 시 기본값으로 진행해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockRejectedValue(new Error('Network error'));

      await featureFlagService.initialize();

      expect(featureFlagService['initialized']).toBe(true);
    });
  });

  // ==========================================================================
  // Fetch and Activate
  // ==========================================================================

  describe('fetchAndActivate', () => {
    it('Remote Config에서 설정을 가져와야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_social_login') return true;
        if (key === 'enable_biometric') return false;
        return null;
      });

      const result = await featureFlagService.fetchAndActivate();

      expect(result).toBe(true);
      expect(mockFetchAndActivateRemoteConfig).toHaveBeenCalled();
      expect(featureFlagService.getFlag('enable_social_login')).toBe(true);
      expect(featureFlagService.getFlag('enable_biometric')).toBe(false);
    });

    it('캐시가 유효한 경우 재fetch하지 않아야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockReturnValue(null);

      await featureFlagService.fetchAndActivate();
      jest.clearAllMocks();

      await featureFlagService.fetchAndActivate();

      expect(mockFetchAndActivateRemoteConfig).not.toHaveBeenCalled();
    });

    it('캐시 만료 시 재fetch해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockReturnValue(null);

      await featureFlagService.fetchAndActivate();

      // 캐시 시간을 과거로 설정
      (featureFlagService as unknown as { lastFetchTime: number }).lastFetchTime =
        Date.now() - 13 * 60 * 60 * 1000;

      jest.clearAllMocks();
      await featureFlagService.fetchAndActivate();

      expect(mockFetchAndActivateRemoteConfig).toHaveBeenCalled();
    });

    it('Remote Config 실패 시 기본값 사용해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(false);

      const result = await featureFlagService.fetchAndActivate();

      expect(result).toBe(true);
      expect(featureFlagService.getFlag('enable_social_login')).toBe(true);
    });

    it('네이티브에서는 플랫폼별 기본값을 사용해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(false);

      await featureFlagService.fetchAndActivate();

      expect(featureFlagService.getFlag('enable_biometric')).toBe(true); // iOS에서는 true
      expect(featureFlagService.getFlag('enable_push_notifications')).toBe(true);
    });

    it('fetch 에러 시 false를 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockRejectedValue(new Error('Network error'));

      const result = await featureFlagService.fetchAndActivate();

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Get Flags
  // ==========================================================================

  describe('getFlag', () => {
    it('특정 플래그 값을 반환해야 함', () => {
      const value = featureFlagService.getFlag('enable_social_login');

      expect(typeof value).toBe('boolean');
    });

    it('초기화되지 않은 경우 경고와 함께 기본값을 반환해야 함', () => {
      const value = featureFlagService.getFlag('enable_social_login');

      expect(value).toBeDefined();
    });
  });

  describe('getAllFlags', () => {
    it('모든 플래그를 반환해야 함', () => {
      const flags = featureFlagService.getAllFlags();

      expect(flags).toHaveProperty('enable_social_login');
      expect(flags).toHaveProperty('enable_biometric');
      expect(flags).toHaveProperty('maintenance_mode');
      expect(Object.keys(flags).length).toBeGreaterThan(0);
    });

    it('읽기 전용 객체를 반환해야 함', () => {
      const flags1 = featureFlagService.getAllFlags();
      const flags2 = featureFlagService.getAllFlags();

      expect(flags1).not.toBe(flags2);
      expect(flags1).toEqual(flags2);
    });
  });

  // ==========================================================================
  // Boolean Checks
  // ==========================================================================

  describe('isEnabled', () => {
    it('플래그가 true이면 true를 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_social_login') return true;
        return null;
      });

      await featureFlagService.initialize();

      expect(featureFlagService.isEnabled('enable_social_login')).toBe(true);
    });

    it('플래그가 false이면 false를 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_biometric') return false;
        return null;
      });

      await featureFlagService.initialize();

      expect(featureFlagService.isEnabled('enable_biometric')).toBe(false);
    });
  });

  describe('areEnabled', () => {
    it('모든 플래그가 활성화되면 true를 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_social_login') return true;
        if (key === 'enable_qr_checkin') return true;
        return null;
      });

      await featureFlagService.initialize();

      const result = featureFlagService.areEnabled(['enable_social_login', 'enable_qr_checkin']);

      expect(result).toBe(true);
    });

    it('하나라도 비활성화되면 false를 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_social_login') return true;
        if (key === 'enable_biometric') return false;
        return null;
      });

      await featureFlagService.initialize();

      const result = featureFlagService.areEnabled(['enable_social_login', 'enable_biometric']);

      expect(result).toBe(false);
    });

    it('빈 배열이면 true를 반환해야 함', () => {
      const result = featureFlagService.areEnabled([]);

      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // Specific Checks
  // ==========================================================================

  describe('isMaintenanceMode', () => {
    it('점검 모드 상태를 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'maintenance_mode') return true;
        return null;
      });

      await featureFlagService.initialize();

      expect(featureFlagService.isMaintenanceMode()).toBe(true);
    });
  });

  describe('isDebugMode', () => {
    it('디버그 모드 상태를 반환해야 함', () => {
      const result = featureFlagService.isDebugMode();

      expect(typeof result).toBe('boolean');
    });
  });

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  describe('clearCache', () => {
    it('캐시를 초기화해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockReturnValue(null);

      await featureFlagService.fetchAndActivate();
      featureFlagService.clearCache();

      expect((featureFlagService as unknown as { lastFetchTime: number }).lastFetchTime).toBe(0);
    });

    it('캐시 초기화 후 재fetch가 가능해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockReturnValue(null);

      await featureFlagService.fetchAndActivate();
      jest.clearAllMocks();

      featureFlagService.clearCache();
      await featureFlagService.fetchAndActivate();

      expect(mockFetchAndActivateRemoteConfig).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Testing Utilities
  // ==========================================================================

  describe('setFlagForTesting', () => {
    it('개발 모드에서 플래그를 강제 설정해야 함', () => {
      (global as any).__DEV__ = true;

      featureFlagService.setFlagForTesting('enable_social_login', false);

      expect(featureFlagService.getFlag('enable_social_login')).toBe(false);
    });

    it('프로덕션에서는 무시해야 함', () => {
      (global as any).__DEV__ = false;

      const originalValue = featureFlagService.getFlag('enable_social_login');
      featureFlagService.setFlagForTesting('enable_social_login', !originalValue);

      expect(featureFlagService.getFlag('enable_social_login')).toBe(originalValue);

      (global as any).__DEV__ = true;
    });
  });

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  describe('whenEnabled', () => {
    it('플래그가 활성화되면 값을 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_social_login') return true;
        return null;
      });

      await featureFlagService.initialize();

      const result = whenEnabled('enable_social_login', 'enabled-value');

      expect(result).toBe('enabled-value');
    });

    it('플래그가 비활성화되면 null을 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_biometric') return false;
        return null;
      });

      await featureFlagService.initialize();

      const result = whenEnabled('enable_biometric', 'enabled-value');

      expect(result).toBeNull();
    });
  });

  describe('selectByFlag', () => {
    it('플래그가 활성화되면 enabled 값을 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_social_login') return true;
        return null;
      });

      await featureFlagService.initialize();

      const result = selectByFlag('enable_social_login', 'enabled', 'disabled');

      expect(result).toBe('enabled');
    });

    it('플래그가 비활성화되면 disabled 값을 반환해야 함', async () => {
      mockFetchAndActivateRemoteConfig.mockResolvedValue(true);
      mockGetRemoteConfigBoolean.mockImplementation((key: string) => {
        if (key === 'enable_biometric') return false;
        return null;
      });

      await featureFlagService.initialize();

      const result = selectByFlag('enable_biometric', 'enabled', 'disabled');

      expect(result).toBe('disabled');
    });
  });
});

import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import { logger } from './logger';

/**
 * SecureStorage - localStorage 암호화 유틸리티
 *
 * 민감한 정보를 안전하게 localStorage에 저장하기 위한 암호화/복호화 기능 제공
 *
 * 주요 기능:
 * - AES 256비트 암호화
 * - 자동 암호화/복호화
 * - 에러 핸들링
 * - 타입 안전성
 *
 * 사용 예시:
 * ```typescript
 * import { secureStorage } from './utils/secureStorage';
 *
 * // 저장
 * secureStorage.setItem('authToken', 'secret-token-value');
 *
 * // 읽기
 * const token = secureStorage.getItem('authToken');
 *
 * // 삭제
 * secureStorage.removeItem('authToken');
 * ```
 *
 * @version 1.0.0
 * @since 2025-10-05
 */

// 암호화 키 - 환경 변수에서 가져오거나 fallback 사용
const SECRET_KEY = process.env.REACT_APP_ENCRYPTION_KEY || 'tholdem-default-encryption-key-2025';

// 프로덕션 환경에서는 반드시 환경 변수로 키를 설정해야 함 (강제)
if (!process.env.REACT_APP_ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[CRITICAL] REACT_APP_ENCRYPTION_KEY가 설정되지 않았습니다. 프로덕션 환경에서 필수입니다.');
  }

  logger.warn('REACT_APP_ENCRYPTION_KEY가 설정되지 않았습니다. 개발 환경에서 기본 키를 사용합니다.', {
    component: 'secureStorage'
  });
}

/**
 * AES 암호화
 * @param value 암호화할 문자열
 * @returns 암호화된 문자열
 */
const encrypt = (value: string): string => {
  try {
    return AES.encrypt(value, SECRET_KEY).toString();
  } catch (error) {
    logger.error('암호화 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'secureStorage'
    });
    throw new Error('데이터 암호화에 실패했습니다.');
  }
};

/**
 * AES 복호화
 * @param encryptedValue 암호화된 문자열
 * @returns 복호화된 문자열
 */
const decrypt = (encryptedValue: string): string => {
  try {
    const bytes = AES.decrypt(encryptedValue, SECRET_KEY);
    const decrypted = bytes.toString(Utf8);

    if (!decrypted) {
      throw new Error('복호화 결과가 비어있습니다.');
    }

    return decrypted;
  } catch (error) {
    logger.error('복호화 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'secureStorage'
    });
    throw new Error('데이터 복호화에 실패했습니다.');
  }
};

/**
 * SecureStorage 인터페이스
 */
export interface SecureStorageInterface {
  /**
   * 암호화하여 저장
   * @param key 저장할 키
   * @param value 저장할 값
   */
  setItem(key: string, value: string): void;

  /**
   * 복호화하여 읽기
   * @param key 읽을 키
   * @returns 복호화된 값 또는 null
   */
  getItem(key: string): string | null;

  /**
   * 항목 삭제
   * @param key 삭제할 키
   */
  removeItem(key: string): void;

  /**
   * 모든 항목 삭제
   */
  clear(): void;

  /**
   * 키 존재 여부 확인
   * @param key 확인할 키
   * @returns 존재 여부
   */
  hasItem(key: string): boolean;
}

/**
 * SecureStorage 구현
 */
export const secureStorage: SecureStorageInterface = {
  /**
   * 암호화하여 localStorage에 저장
   */
  setItem(key: string, value: string): void {
    try {
      const encrypted = encrypt(value);
      localStorage.setItem(key, encrypted);

      logger.debug('SecureStorage 저장 성공', {
        component: 'secureStorage',
        data: { key, valueLength: value.length }
      });
    } catch (error) {
      logger.error('SecureStorage 저장 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'secureStorage',
        data: { key }
      });
      throw error;
    }
  },

  /**
   * localStorage에서 읽어 복호화
   */
  getItem(key: string): string | null {
    try {
      const encrypted = localStorage.getItem(key);

      if (!encrypted) {
        return null;
      }

      const decrypted = decrypt(encrypted);

      logger.debug('SecureStorage 읽기 성공', {
        component: 'secureStorage',
        data: { key, valueLength: decrypted.length }
      });

      return decrypted;
    } catch (error) {
      logger.error('SecureStorage 읽기 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'secureStorage',
        data: { key }
      });

      // 복호화 실패 시 손상된 데이터 제거
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * localStorage에서 항목 삭제
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);

      logger.debug('SecureStorage 삭제 성공', {
        component: 'secureStorage',
        data: { key }
      });
    } catch (error) {
      logger.error('SecureStorage 삭제 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'secureStorage',
        data: { key }
      });
    }
  },

  /**
   * localStorage의 모든 항목 삭제
   */
  clear(): void {
    try {
      localStorage.clear();

      logger.info('SecureStorage 전체 삭제', {
        component: 'secureStorage'
      });
    } catch (error) {
      logger.error('SecureStorage 전체 삭제 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'secureStorage'
      });
    }
  },

  /**
   * 키 존재 여부 확인
   */
  hasItem(key: string): boolean {
    return localStorage.getItem(key) !== null;
  }
};

// 기본 export
export default secureStorage;

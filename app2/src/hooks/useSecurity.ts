import { useEffect, useCallback, useRef } from 'react';
import { sanitizeHtml, sanitizeText, sanitizeUrl } from '../utils/security/sanitizer';
import { ensureCsrfToken, validateCsrfToken, refreshCsrfToken } from '../utils/security/csrf';
import { logger } from '../utils/logger';

/**
 * 보안 관련 기능을 제공하는 커스텀 Hook
 */
export const useSecurity = () => {
  const csrfTokenRef = useRef<string | null>(null);

  // 컴포넌트 마운트 시 CSRF 토큰 초기화
  useEffect(() => {
    csrfTokenRef.current = ensureCsrfToken();

    // 토큰 갱신 주기 설정 (50분마다)
    const tokenRefreshInterval = setInterval(
      () => {
        csrfTokenRef.current = refreshCsrfToken();
      },
      50 * 60 * 1000
    );

    return () => {
      clearInterval(tokenRefreshInterval);
    };
  }, []);

  /**
   * 안전한 HTML 렌더링을 위한 함수
   */
  const renderSafeHtml = useCallback((html: string) => {
    return { __html: sanitizeHtml(html) };
  }, []);

  /**
   * 안전한 텍스트 처리
   */
  const safeText = useCallback((text: string) => {
    return sanitizeText(text);
  }, []);

  /**
   * 안전한 URL 처리
   */
  const safeUrl = useCallback((url: string, defaultUrl?: string) => {
    return sanitizeUrl(url, defaultUrl);
  }, []);

  /**
   * CSRF 토큰 가져오기
   */
  const getCsrfToken = useCallback(() => {
    if (!csrfTokenRef.current) {
      csrfTokenRef.current = ensureCsrfToken();
    }
    return csrfTokenRef.current;
  }, []);

  /**
   * CSRF 토큰 검증
   */
  const verifyCsrfToken = useCallback((token: string) => {
    return validateCsrfToken(token);
  }, []);

  /**
   * XSS 공격 감지 리스너
   */
  useEffect(() => {
    const detectXSSAttempt = (event: Event) => {
      const target = event.target as HTMLElement;

      // 인라인 스크립트 실행 시도 감지
      if (target && target.tagName === 'SCRIPT') {
        logger.warn('인라인 스크립트 실행 시도가 감지되었습니다', {
          component: 'useSecurity',
          data: {
            script: target.innerHTML.substring(0, 100),
          },
        });
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // 이벤트 리스너 등록
    document.addEventListener('DOMNodeInserted', detectXSSAttempt, true);

    return () => {
      document.removeEventListener('DOMNodeInserted', detectXSSAttempt, true);
    };
  }, []);

  return {
    renderSafeHtml,
    safeText,
    safeUrl,
    getCsrfToken,
    verifyCsrfToken,
  };
};

/**
 * Click-jacking 방지를 위한 Frame Buster Hook
 */
export const useFrameBuster = () => {
  useEffect(() => {
    // iframe 내에서 실행되는지 확인
    if (window.top !== window.self) {
      logger.warn('iframe 내에서 실행이 감지되었습니다', { component: 'useFrameBuster' });

      try {
        // iframe에서 벗어나기 시도
        window.top!.location = window.self.location;
      } catch (e) {
        // Cross-origin으로 인해 실패할 경우
        logger.error('iframe 탈출 실패', e instanceof Error ? e : new Error(String(e)), {
          component: 'useFrameBuster',
        });

        // 페이지 내용 숨기기
        document.body.style.display = 'none';

        // 경고 메시지 표시
        const warning = document.createElement('div');
        warning.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: red;
          z-index: 999999;
        `;
        warning.textContent = '보안상의 이유로 이 페이지는 iframe 내에서 실행될 수 없습니다.';
        document.body.appendChild(warning);
      }
    }
  }, []);
};

/**
 * 안전한 localStorage 사용을 위한 Hook
 */
export const useSecureStorage = () => {
  /**
   * 안전하게 데이터 저장
   */
  const setSecureItem = useCallback((key: string, value: any) => {
    try {
      // XSS 방지를 위해 값을 sanitize
      const sanitizedValue =
        typeof value === 'string' ? sanitizeText(value) : sanitizeText(JSON.stringify(value));

      localStorage.setItem(key, sanitizedValue);

      logger.debug('안전한 스토리지 저장', {
        component: 'useSecureStorage',
        data: { key },
      });
    } catch (error) {
      logger.error(
        '스토리지 저장 오류',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'useSecureStorage',
        }
      );
    }
  }, []);

  /**
   * 안전하게 데이터 가져오기
   */
  const getSecureItem = useCallback((key: string): string | null => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;

      // XSS 패턴 검사
      const xssPatterns = [/<script[^>]*>.*?<\/script>/gi, /javascript:/gi, /on\w+\s*=/gi];

      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          logger.warn('스토리지에서 XSS 패턴이 감지되었습니다', {
            component: 'useSecureStorage',
            data: { key, pattern: pattern.toString() },
          });
          localStorage.removeItem(key);
          return null;
        }
      }

      return value;
    } catch (error) {
      logger.error(
        '스토리지 읽기 오류',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'useSecureStorage',
        }
      );
      return null;
    }
  }, []);

  /**
   * 안전하게 데이터 삭제
   */
  const removeSecureItem = useCallback((key: string) => {
    try {
      localStorage.removeItem(key);
      logger.debug('스토리지 항목 삭제', {
        component: 'useSecureStorage',
        data: { key },
      });
    } catch (error) {
      logger.error(
        '스토리지 삭제 오류',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'useSecureStorage',
        }
      );
    }
  }, []);

  return {
    setSecureItem,
    getSecureItem,
    removeSecureItem,
  };
};

export default useSecurity;

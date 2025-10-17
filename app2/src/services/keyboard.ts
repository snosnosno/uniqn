/**
 * Capacitor Keyboard 관리 서비스
 *
 * 모바일에서 가상 키보드 표시/숨김 이벤트를 처리하여
 * 더 나은 사용자 입력 경험을 제공합니다.
 */

import React from 'react';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { logger } from '../utils/logger';

/**
 * 키보드 이벤트 리스너 타입
 */
export interface KeyboardEventHandler {
  onKeyboardShow?: (info: { keyboardHeight: number }) => void;
  onKeyboardHide?: () => void;
  onKeyboardWillShow?: (info: { keyboardHeight: number }) => void;
  onKeyboardWillHide?: () => void;
}

/**
 * 키보드 서비스 클래스
 */
class KeyboardService {
  private listeners: KeyboardEventHandler[] = [];
  private isInitialized = false;

  /**
   * 키보드 서비스 초기화
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      logger.info('Keyboard: 웹 환경에서는 키보드 서비스를 초기화하지 않습니다');
      return;
    }

    if (this.isInitialized) {
      logger.info('Keyboard: 이미 초기화됨');
      return;
    }

    try {
      logger.info('Keyboard: 키보드 서비스 초기화 시작');

      // 키보드 리사이즈 모드 설정 (콘텐츠가 키보드에 맞춰 리사이즈)
      await Keyboard.setResizeMode({ mode: KeyboardResize.Body });

      // 키보드 접근성 도구 설정
      await Keyboard.setAccessoryBarVisible({ isVisible: true });

      // 스크롤 가능하도록 설정
      await Keyboard.setScroll({ isDisabled: false });

      // 키보드 이벤트 리스너 등록
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Keyboard: 키보드 서비스 초기화 완료');

    } catch (error) {
      logger.error('Keyboard: 초기화 중 오류 발생', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 키보드 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // 키보드 표시 이벤트
    Keyboard.addListener('keyboardWillShow', (info) => {
      logger.debug('Keyboard: 키보드 표시 예정');
      this.notifyListeners('onKeyboardWillShow', info);
    });

    Keyboard.addListener('keyboardDidShow', (info) => {
      logger.debug('Keyboard: 키보드 표시됨');
      this.notifyListeners('onKeyboardShow', info);

      // 키보드가 표시될 때 화면 하단 여백 조정
      this.adjustViewportForKeyboard(info.keyboardHeight);
    });

    // 키보드 숨김 이벤트
    Keyboard.addListener('keyboardWillHide', () => {
      logger.debug('Keyboard: 키보드 숨김 예정');
      this.notifyListeners('onKeyboardWillHide');
    });

    Keyboard.addListener('keyboardDidHide', () => {
      logger.debug('Keyboard: 키보드 숨겨짐');
      this.notifyListeners('onKeyboardHide');

      // 키보드가 숨겨질 때 화면 복원
      this.restoreViewport();
    });
  }

  /**
   * 키보드에 맞춰 뷰포트 조정
   */
  private adjustViewportForKeyboard(keyboardHeight: number): void {
    // CSS 변수로 키보드 높이 설정
    document.documentElement.style.setProperty(
      '--keyboard-height',
      `${keyboardHeight}px`
    );

    // body에 키보드 활성 클래스 추가
    document.body.classList.add('keyboard-visible');
  }

  /**
   * 뷰포트 복원
   */
  private restoreViewport(): void {
    document.documentElement.style.removeProperty('--keyboard-height');
    document.body.classList.remove('keyboard-visible');
  }

  /**
   * 이벤트 리스너에 알림
   */
  private notifyListeners(
    event: keyof KeyboardEventHandler,
    data?: { keyboardHeight: number }
  ): void {
    this.listeners.forEach((listener) => {
      const handler = listener[event];
      if (handler) {
        if (data) {
          (handler as any)(data);
        } else {
          (handler as any)();
        }
      }
    });
  }

  /**
   * 이벤트 리스너 등록
   */
  addListener(handler: KeyboardEventHandler): () => void {
    this.listeners.push(handler);

    // 리스너 제거 함수 반환
    return () => {
      const index = this.listeners.indexOf(handler);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 키보드 강제 숨김
   */
  async hide(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await Keyboard.hide();
      logger.debug('Keyboard: 키보드 강제 숨김');
    } catch (error) {
      logger.error('Keyboard: 키보드 숨김 중 오류', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 키보드 표시 상태 확인 (근사값 - CSS 상태로 판단)
   */
  isOpen(): boolean {
    return document.body.classList.contains('keyboard-visible');
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    if (Capacitor.isNativePlatform()) {
      Keyboard.removeAllListeners();
    }
    this.listeners = [];
    this.isInitialized = false;
    this.restoreViewport();
    logger.info('Keyboard: 키보드 서비스 정리 완료');
  }
}

// 싱글톤 인스턴스
export const keyboardService = new KeyboardService();

/**
 * 키보드 서비스 초기화 함수
 */
export const initializeKeyboard = async (): Promise<boolean> => {
  try {
    await keyboardService.initialize();
    return true;
  } catch (error) {
    logger.error('Keyboard: 키보드 서비스 초기화 실패', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
};

/**
 * React Hook: 키보드 이벤트 처리
 */
export const useKeyboard = (handler: KeyboardEventHandler) => {
  React.useEffect(() => {
    const removeListener = keyboardService.addListener(handler);
    return removeListener;
  }, [handler]);

  return {
    hide: keyboardService.hide.bind(keyboardService),
    isOpen: keyboardService.isOpen.bind(keyboardService),
  };
};
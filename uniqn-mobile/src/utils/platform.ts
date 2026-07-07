/**
 * UNIQN Mobile - 플랫폼 유틸리티
 *
 * @description React Native 플랫폼 분기 처리
 * @version 1.0.0
 */

import { Platform } from 'react-native';

/**
 * 현재 플랫폼 확인
 */
export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isMobile = isIOS || isAndroid;

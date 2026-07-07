/**
 * UNIQN Mobile - 플랫폼 유틸리티
 *
 * @description React Native 플랫폼 분기 처리
 * @version 1.0.0
 */

import { Platform } from 'react-native';

/** 웹 플랫폼 여부 (네이티브 분기는 각 파일에서 Platform.OS 직접 사용) */
export const isWeb = Platform.OS === 'web';

/**
 * 이 실행본이 **무엇인지** 를 말해주는 단일 소스 (감사 testgap-01).
 *
 * ## 왜 필요한가
 * `runtimeVersion = appVersion` 정책이라 하나의 스토어 빌드 위에 여러 OTA 번들이 얹힌다.
 * 그래서 "1.0.6 사용자"라는 말만으로는 **어느 JS 번들을 돌고 있는지** 알 수 없고,
 * 롤아웃이 얼마나 퍼졌는지도 셀 수 없다. 실제로 이 공백 때문에 #407 REVOKE 가
 * "롤아웃 확인 다음"에 묶인 채 계기판이 없어 무기한 대기 중이다.
 *
 * ## 왜 이게 OTA 로 도달하는가
 * 여기서 읽는 값은 전부 **런타임 값**이다 — `expoConfig`(내장 매니페스트)와
 * `expo-updates` 런타임 상태. 빌드타임에 번들에 박아 넣는 설정이 아니므로
 * `eas update` 로 나간 JS 만으로 계측이 켜진다.
 *
 * ## 주의
 * `expo-updates` 는 dev 클라이언트·Expo Go·웹에서 비활성이고, 필드 접근 자체가
 * 던지는 경우가 있다. 계측이 앱을 죽이면 안 되므로 **전부 방어적으로 읽고 null 로 떨어진다**.
 */

import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { APP_VERSION, BUILD_NUMBER, RUNTIME_VERSION } from '@/constants/version';

export interface BuildIdentity {
  /** 스토어 버전 (예: '1.0.6') */
  appVersion: string;
  /** iOS buildNumber / Android versionCode */
  buildNumber: string;
  /** EAS Update 매칭 키 — 현 정책상 appVersion 과 같다 */
  runtimeVersion: string;
  platform: string;
  /** 지금 돌고 있는 OTA 번들 ID. 내장 번들로 부팅했으면 null */
  otaUpdateId: string | null;
  /** eas update 채널 (예: 'production'). 알 수 없으면 null */
  otaChannel: string | null;
  /** 내장 번들로 부팅했는가 = OTA 미적용 상태 */
  isEmbeddedLaunch: boolean;
}

/** expo-updates 필드 하나를 읽되, 어떤 이유로든 실패하면 null 로 떨어진다. */
function readUpdatesField<T>(read: () => T | null | undefined): T | null {
  try {
    return read() ?? null;
  } catch {
    // dev 클라이언트·Expo Go·웹에서는 모듈이 비활성이다. 계측은 절대 throw 금지.
    return null;
  }
}

export function getBuildIdentity(): BuildIdentity {
  return {
    appVersion: APP_VERSION,
    buildNumber: BUILD_NUMBER ?? '1',
    runtimeVersion: String(RUNTIME_VERSION),
    platform: Platform.OS,
    otaUpdateId: readUpdatesField(() => Updates.updateId),
    otaChannel: readUpdatesField(() => Updates.channel),
    // 읽기 실패 시 `true`(내장) 로 떨어뜨린다 — OTA 도달을 과대 보고하지 않기 위해서다.
    isEmbeddedLaunch: readUpdatesField(() => Updates.isEmbeddedLaunch) ?? true,
  };
}

/**
 * Sentry `release` 문자열. `<프로젝트>@<버전>` 은 Sentry 의 관례 형식이라
 * 대시보드의 릴리스별 집계·회귀 탐지가 그대로 붙는다.
 */
export function getSentryRelease(): string {
  return `uniqn@${APP_VERSION}`;
}

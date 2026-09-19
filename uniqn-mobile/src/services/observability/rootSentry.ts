import * as Sentry from '@sentry/react-native';
import {
  applyRedactToBreadcrumb,
  applyRedactToEvent,
  applyRedactToTransaction,
} from './sentryRedact';
import { getBuildIdentity, getSentryRelease } from './buildIdentity';

interface RootSentryOptions {
  dsn: string;
  enabled: boolean;
  environment: string;
}

export function initializeRootSentry({ dsn, enabled, environment }: RootSentryOptions): void {
  const identity = getBuildIdentity();

  Sentry.init({
    dsn,
    enabled,
    environment,
    // release/dist 는 **런타임 값**이라 빌드 설정이 아니다 — OTA 로도 도달한다(testgap-01).
    // 이게 없으면 Sentry 의 모든 이벤트가 릴리스 미상으로 뭉쳐서, 어느 버전에서
    // 회귀가 났는지도 롤아웃이 얼마나 퍼졌는지도 셀 수 없다.
    release: getSentryRelease(),
    dist: identity.buildNumber,
    tracesSampleRate: 0.2,
    enableNativeCrashHandling: enabled,
    enableNative: enabled,
    beforeSend: applyRedactToEvent,
    beforeSendTransaction: applyRedactToTransaction,
    beforeBreadcrumb: applyRedactToBreadcrumb,
  });

  // 스큐 진단 태그 — 같은 스토어 빌드(=같은 release) 위에 여러 OTA 번들이 얹히므로
  // release 만으로는 "어느 JS 를 돌고 있었나"를 가릴 수 없다.
  try {
    Sentry.setTag('runtime_version', identity.runtimeVersion);
    Sentry.setTag('ota_update_id', identity.otaUpdateId ?? 'embedded');
    Sentry.setTag('ota_channel', identity.otaChannel ?? 'unknown');
    Sentry.setTag('ota_embedded', String(identity.isEmbeddedLaunch));
  } catch {
    // 태깅 실패가 앱 부팅을 막아서는 안 된다.
  }
}

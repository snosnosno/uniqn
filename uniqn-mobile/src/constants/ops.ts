/** 라이브 운영(ops) 상수. */
import { getEnv } from '@/lib/env';

/** ops 웹앱 베이스 URL (브릿지 딥링크). env 미설정/예외 시 prod 기본값. */
export function getOpsBaseUrl(): string {
  try {
    return getEnv().EXPO_PUBLIC_OPS_URL ?? 'https://ops.uniqn.app';
  } catch {
    return 'https://ops.uniqn.app';
  }
}

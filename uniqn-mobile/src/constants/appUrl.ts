/**
 * 앱 웹 origin 및 인증 콜백 URL 상수.
 *
 * 배경(2026-07-22): 비밀번호 재설정 메일이 Supabase Site URL(기본값
 * `http://localhost:3000`)로 폴백해 접속 불가 주소로 착지했다. 인증 메일 링크의
 * 착지점은 **항상 클라이언트가 명시**한다 — 대시보드 설정에 의존하지 않는다.
 *
 * 여기서 만든 URL은 Supabase Auth > URL Configuration 의 Redirect URLs
 * 허용목록(`https://uniqn.app/**`)에 포함되어야 한다.
 */
import { Platform } from 'react-native';

/** prod 웹앱 origin (네이티브 폴백 및 최종 방어선). */
export const APP_WEB_ORIGIN = 'https://uniqn.app';

/**
 * 인증 메일 링크가 착지할 웹 origin.
 * 웹은 실제 서빙 origin 우선 — 다만 localhost/개발 origin 은 Supabase 허용목록에
 * 없어 링크가 깨지므로 prod origin 으로 되돌린다(getOpsWebOrigin 과 다른 지점).
 */
export function getAuthRedirectOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;

    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }

  return APP_WEB_ORIGIN;
}

/** 비밀번호 재설정 메일 링크의 착지 URL. */
export function getPasswordResetRedirectUrl(): string {
  return `${getAuthRedirectOrigin()}/reset-password`;
}

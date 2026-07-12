/**
 * UNIQN Mobile - 고객센터 운영시간 단일 소스
 *
 * @description support(고객센터 메뉴) · settings/business-info(사업자정보) 두 화면이
 * 서로 다른 운영시간 문구("09:00 - 18:00" vs "10:00 ~ 18:00")를 각자 하드코딩해
 * 발생한 불일치를 해소하기 위한 단일 소스. 값은 business-info 기준으로 통일했다.
 * 실제 운영시간 확정 필요 — 확정되면 이 파일만 수정하면 두 화면에 동시 반영된다.
 */

export const SUPPORT_HOURS_TEXT = '평일 10:00 ~ 18:00 (점심 12:00 ~ 13:00, 주말/공휴일 휴무)';

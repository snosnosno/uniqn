/**
 * 요일 라벨 상수 — 의존성 0 모듈
 *
 * @description 배럴(@/constants)을 거치지 않는 단독 모듈.
 * 도메인/유틸이 배럴 상수를 모듈 스코프에서 참조하면 순환 require 시
 * undefined가 되는 기지 함정(#245 STATUS.* 재발 클래스)이 있어,
 * 모듈 스코프에서 안전하게 쓸 수 있도록 여기서 직접 export 한다.
 * 배럴의 DATE.WEEKDAYS_KO 도 이 값을 재사용한다.
 */

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

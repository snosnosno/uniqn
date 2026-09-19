/**
 * 사용자 문구 단일 소스
 *
 * @description 소비처는 `@/constants/messages` 로만 들어온다. 최상위 `@/constants`
 * 배럴에는 **재수출하지 않는다** — 문구가 상수 배럴에 얹히면 리프 UI 가 배럴을 끌어와
 * 순환 참조로 모듈스코프 값이 undefined 가 되는 함정이 있다(impeccable 룰 8 주석 참조).
 */
export { loadFailed, notFound, saveFailed, RETRY_HINT } from './failure';

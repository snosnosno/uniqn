/**
 * UNIQN Mobile - 주문서 제출 → 완료 화면 1회성 draft 전달 캐시
 *
 * @description create-success 화면의 "프리셋으로 저장" 은 방금 등록한 공고 구성(draft)이 필요하지만,
 * draft 는 useLocalSearchParams(URL 파라미터)로 넘기기엔 너무 크다. zustand 도입 없이 모듈 레벨
 * 변수로 1회 전달한다(제출 직후 set → 완료 화면 mount 시 snapshot 후 소비).
 *
 * live-binding footgun 회피: `export let` 직접 노출 대신 getter/setter 로 캡슐화한다
 * (Metro/CommonJS interop 은 named import 를 값 복사로 캡처할 수 있어 live-binding 미보장).
 */
import type { JobPostingDraft } from '@/types/jobPostingDraft';

let lastSubmittedDraft: JobPostingDraft | null = null;

/** 제출 성공 시 방금 등록한 draft 를 저장한다(완료 화면 전달용). */
export function setLastSubmittedDraft(draft: JobPostingDraft | null): void {
  lastSubmittedDraft = draft;
}

/** 완료 화면 mount 시 1회 읽는다. 비어 있으면(직접 딥링크 진입 등) null. */
export function getLastSubmittedDraft(): JobPostingDraft | null {
  return lastSubmittedDraft;
}

/** 소비 완료 후 명시적으로 비운다. */
export function clearLastSubmittedDraft(): void {
  lastSubmittedDraft = null;
}

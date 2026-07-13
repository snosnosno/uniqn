/**
 * postingFilledCounts 쿼리키 접두 — usePostingFilledCounts(조회)와 확정 분포를 바꾸는
 * 뮤테이션(useConfirmedStaff의 무효화)이 공유하는 단일 소스.
 *
 * 의존성 0 의 단독 모듈로 둔다: 훅 파일(usePostingFilledCounts)은 `@/repositories` 를 끌고 와
 * 모듈 초기화 순환(hooks → repositories → utils/supabase → errors)을 유발할 수 있다(실측).
 */
export const POSTING_FILLED_COUNTS_QUERY_KEY = 'postingFilledCounts';

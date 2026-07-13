import type { JobPostingStatus } from '@/types';

/**
 * 구직자 브라우즈(목록·타입별 칩 카운트)에 노출하는 공고 상태의 단일 소스.
 *
 * 정원마감(capacity_full)도 "정원 마감" 라벨로 브라우즈에 노출하는 정책의 유일한
 * 정의 위치다. active 만 필터하면 정원이 찬 공고가 목록에서 사라진다
 * (pitfall_enum_divergence_read_disappearance). getList()·getTypeCounts() 양쪽이
 * 이 상수를 공유해, 상태 추가 시 한쪽만 갱신되는 enum 발산 재발을 막는다.
 *
 * 리터럴을 직접 쓰는 이유: `STATUS.JOB_POSTING.*` 참조는 모듈 초기화 시점에 평가되어
 * `@/constants` ↔ 도메인 배럴 간 순환 임포트 시 undefined 를 읽는다(settlement 임포트
 * 체인에서 실측). 타입 단언(satisfies)이 오타·enum 발산을 컴파일 타임에 잡아준다.
 */
export const BROWSABLE_POSTING_STATUSES = [
  'active',
  'capacity_full',
] as const satisfies readonly JobPostingStatus[];

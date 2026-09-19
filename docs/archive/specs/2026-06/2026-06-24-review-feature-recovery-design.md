# 평점/리뷰 기능 복구 + 매끄러운 흐름 — 설계 문서

- 날짜: 2026-06-24
- 브랜치: `feat/review-recovery-hub`
- 상태: 설계 승인됨 (구현 계획 대기)
- 관련: 알림 "평가하기" → 평가 상세 화면 E4002 버그 리포트

## 1. 문제 정의 (증거 기반)

평점/리뷰 기능이 **prod에서 전체 작동 불가** 상태다. `reviews` 테이블은 **0행**(한 번도 정상 생성된 적 없음). Firebase→Supabase 이전 시 "결정적 문서 ID(`{workLogId}_{reviewerType}`)" 패턴이 Supabase uuid 스키마로 번역되지 않고 남은 잔재가 근본 원인.

### 1.1 읽기 경로 — E4002 (리포트된 증상)
- `reviews.id`는 `uuid` 타입, PK, 기본값 `gen_random_uuid()` (`supabase/migrations/20260409000000_base_schema.sql:273-290`).
- 그런데 읽기 코드는 합성 텍스트키로 조회: `.eq('id', '{workLogId}_{reviewerType}')` (`src/repositories/supabase/ReviewRepository.ts:90-101`, 동일 패턴 `:61` `getByWorkLogAndType`).
- uuid 컬럼에 밑줄 포함 문자열 → PostgreSQL **22P02 (invalid input syntax for type uuid)** → `INFRA_NOT_FOUND = E4002`로 매핑 (`src/utils/supabase.ts:66`).
- 0행이어도 WHERE 절 캐스팅 시점에 즉시 발생. **평가 상세(`app/(app)/reviews/[workLogId].tsx`)는 항상 E4002.**

### 1.2 쓰기 경로 — RPC 부재
- `createWithTransaction`이 `runRpc('create_review', {...})` 호출 (`ReviewRepository.ts:204-219`).
- 그러나 `create_review` RPC는 **prod·마이그레이션 어디에도 존재하지 않음** (pg_proc 전수 확인; 리뷰 관련 함수는 알림 트리거 3종 + `review_report`뿐). → 평가 제출은 42883으로 실패. 리뷰 0건의 원인.

### 1.3 알림 라우팅 불일치
- `REVIEW_REQUEST/REMINDER/RECEIVED`는 `workLogId`가 있으면 블라인드 상세 화면(`reviews/detail`)으로 보냄 (`src/shared/deeplink/NotificationRouteMap.ts:107-118`). 개념상 "작성/관리"로 가야 하며, 깨진 읽기 경로와 정확히 맞물려 E4002를 유발.
- 참고: DB 쪽 함수/스케줄은 올바르게 `(work_log_id, reviewer_type)`로 조회 (`migrations/20260417060000_firebase_scheduled_jobs.sql:192`, `20260421190000_*.sql:197`). **클라이언트 읽기 경로만 틀림.**

### 1.4 멱등 제약 부재
- `reviews` PK는 uuid `id`뿐. `(work_log_id, reviewer_type)` UNIQUE 제약이 없어 "한 근무·한 방향 1리뷰" 불변식이 DB에서 강제되지 않음 (합성 PK로 강제하려던 설계가 무력화됨).

## 2. 목표 / 비목표

### 목표
1. 평점 기능을 prod에서 **실제 작동**(읽기·쓰기·집계)하게 복구.
2. "재밌게" = **유저플로우를 매끄럽게**. 발견 → 작성 → 공개 → 평판이 끊김 없이 흐르게.
3. 흩어진 평가 화면을 **하나의 평점관리 허브**로 통합.

### 비목표 (YAGNI)
- 게이미피케이션(레벨/캐릭터/뱃지), 별점제 전환, 새 평판 알고리즘 — 이번 범위 아님.
- 평가 항목/태그셋/감정 모델 변경 — 기존 유지.

## 3. 핵심 결정 (브레인스토밍 합의)
- "재밌게"의 의미 = **매끄러운 유저플로우** (게이미피케이션 아님).
- 화면 구조 = **단일 평점관리 허브** (탭: 미작성·받은·작성한 + 버블점수 헤더).
- 알림/진입 = **항상 평점관리 허브로** 라우팅 (깨지기 쉬운 detail 딥링크 제거, 견고함 우선).

## 4. 설계

### A. 토대 복구 (DB + Repository)

**A1. 읽기 수정** — `ReviewRepository.ts`
- `getReviewsWithBlindCheck`: 내 리뷰/상대 리뷰 조회를 `.eq('id', composite)` → **`.eq('work_log_id', workLogId).eq('reviewer_type', type).maybeSingle()`** 로 변경.
- `getByWorkLogAndType`: 동일하게 `(work_log_id, reviewer_type)` 조회로 변경.
- 블라인드 로직(내 리뷰 작성 후에만 상대 공개)은 그대로 유지.

**A2. 쓰기 수정** — 신규 마이그레이션 `create_review` RPC + `createWithTransaction` 조정
- RPC 계약 (기존 호출부와 정합, `p_review_id` 제거):
  ```
  create_review(
    p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text,
    p_work_date text, p_reviewer_id uuid, p_reviewer_name text,
    p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text,
    p_sentiment review_sentiment, p_tags text[], p_comment text,
    p_bubble_score_change integer
  ) RETURNS uuid  -- 생성된 review id
  ```
- 동작 (원자적):
  1. `INSERT INTO reviews (...) VALUES (...) ON CONFLICT (work_log_id, reviewer_type) DO NOTHING RETURNING id` — `id`는 `gen_random_uuid()` 기본값.
  2. 충돌(이미 존재)이면 기존 id 반환 또는 멱등 에러 처리(중복 작성 차단).
  3. 신규 삽입 시 피평가자 `users.bubble_score`(jsonb) 집계 갱신:
     - `score = clamp(old.score(기본 50.0) + p_bubble_score_change, 0, 100)`, 소수 자리 반올림
     - `totalReviewCount += 1`, sentiment에 따라 `positiveCount/neutralCount/negativeCount += 1`
     - `lastUpdatedAt = now()`
     - **SSOT 주의**: 점수식은 `src/types/review.ts`의 `BUBBLE_SCORE`(INITIAL 50, MIN 0, MAX 100, *_CHANGE)와 일치해야 함. plpgsql 중복 구현이므로 상수를 마이그레이션에 명시 주석하고, 향후 변경 시 양쪽 동기화 필요(분기 위험 known).
- `createWithTransaction`: `p_review_id` 전달 제거. 반환 id 사용.
- **보안**: RPC `SECURITY DEFINER`, `SET search_path = public, extensions, pg_temp`. 생성 직후 `REVOKE EXECUTE ... FROM anon` 명시 (신규 함수 anon default-grant 함정 회피). 호출자 검증: `auth.uid() = p_reviewer_id` 가드(타인 명의 작성 차단).

**A3. 멱등 제약** — 마이그레이션
- `ALTER TABLE public.reviews ADD CONSTRAINT reviews_work_log_reviewer_type_key UNIQUE (work_log_id, reviewer_type);`
- (테이블이 0행이므로 백필/충돌 없음.)

**A4. 잔재 정리**
- `src/types/review.ts`의 `Review` 인터페이스/주석에서 "문서 ID `{workLogId}_{reviewerType}`" 표현 제거. `id: string`(uuid) 추가 검토(읽기 키로는 미사용).
- `ReviewRepository.ts` 상단 주석의 "문서 ID 설계: `{workLogId}_{reviewerType}`" 갱신.

### B. 통합 평점관리 허브

`app/(app)/reviews/history.tsx`를 **"평점관리" 허브**로 확장 (이미 버블점수 헤더 + 탭바 + FlashList 보유).
- 탭 3개: **미작성(pending) · 받은 · 작성한**. 기본 탭 = 미작성(진입 의도가 작성일 때), 그 외 받은.
- 미작성 탭 = `usePendingReviews()` 데이터 + 기존 `PendingReviewCard` 재사용. 항목 탭 → `reviews/write`.
- 받은/작성한 탭 = 기존 동작 유지. 항목 탭 → `reviews/[workLogId]` 상세(이제 A1로 정상).
- 미작성 탭 라벨에 **N건 배지**.
- `app/(app)/reviews/pending.tsx`: 허브 미작성 탭으로 흡수. 기존 `pending` 경로는 허브로 리다이렉트(딥링크 호환).
- 화면 타이틀 "평가 히스토리" → "평점관리".

### C. 알림/진입 라우팅 통일
- `NotificationRouteMap.ts`: `REVIEW_REQUEST/RECEIVED/REMINDER` → **항상 허브**(`reviews` 허브 경로). `workLogId` 유무와 무관하게 detail 딥링크 제거.
- (선택) `workLogId`가 있으면 허브가 미작성 탭에서 해당 항목을 스크롤/하이라이트.
- 프로필 "내 평점·리뷰 이력"(`profile.tsx:189`) → 허브.
- 스케줄 미작성 버튼(`schedule.tsx:614`) → 허브(미작성 탭).
- 블라인드 상세 화면은 **허브에서만** 진입.

### D. 흐름 폴리시 (작게)
- 작성 제출 성공 → 허브 복귀, 항목이 "작성한"으로 이동. 상대가 이미 작성했으면 "상대 평가 공개됨" 노출(블라인드 언락).
- 빈 상태/잠금 상태 문구 명확화 (impeccable-design 룰 9·10).
- 미작성 0건일 때 허브 기본 탭을 받은으로.

## 5. 데이터 흐름

```
근무 완료(checkout) → REVIEW_REQUEST 알림
  → 탭 → 평점관리 허브(미작성 탭)
  → 항목 선택 → 작성 화면(sentiment+tags+comment)
  → 제출 → create_review RPC (원자적 INSERT + bubble_score 갱신)
  → 허브 복귀(작성한 탭), 상대 작성 시 블라인드 공개
  → 상세 화면 = 내 리뷰 + (공개 시) 상대 리뷰
```

## 6. 영향 범위 (파일)
- 마이그레이션(신규): `create_review` RPC + `reviews` UNIQUE 제약 + anon REVOKE.
- `src/repositories/supabase/ReviewRepository.ts` (읽기 2곳 + 쓰기 1곳).
- `src/types/review.ts` (주석/타입 정리).
- `app/(app)/reviews/history.tsx` (허브로 확장).
- `app/(app)/reviews/pending.tsx` (흡수/리다이렉트).
- `src/shared/deeplink/NotificationRouteMap.ts` (라우팅).
- `app/(app)/(tabs)/profile.tsx`, `app/(app)/schedule.tsx` (진입 링크).
- 관련 테스트: `ReviewRepository` zod/단위, `ReviewDetailScreen`/`ReviewWriteScreen`, pending/history.

## 7. 테스트 계획
- **읽기(Red-Green)**: 합성키 조회로 22P02 재현 → A1 수정 후 `(work_log_id, reviewer_type)` 정상 조회 확인.
- **쓰기**: `create_review` RPC 단위 — 신규 작성 시 review 1행 + reviewee `bubble_score` 집계 정확. 동일 (work_log, type) 재호출 시 멱등(중복 미생성).
- **보안**: anon `has_function_privilege` false 실측. `auth.uid() != reviewer_id` 거부.
- **흐름(수동/E2E)**: 알림 → 허브 → 작성 → 제출 → 공개. prod에서 `reviews` 0건 → 실제 1건 생성 확인.
- **회귀**: 기존 `reviews/pending`, `reviews/history` 딥링크가 허브로 정상 도달.

## 8. 롤아웃
- DB: 마이그레이션은 `mcp__supabase__apply_migration` 전용 (db push 금지).
- 앱: JS 변경(화면/repo/라우팅) → **EAS OTA**로 배포 가능(네이티브 변경 없음). 단 OTA 환경 변수/번들 주의(프로젝트 기존 OTA 절차 준수).
- 순서: 마이그레이션(RPC+제약) 먼저 → OTA. (읽기 수정은 RPC 없이도 동작하나, 쓰기까지 한 번에 배포 권장.)

## 9. 결정 보강 (브레인스토밍 2차 — 확정)

**9.1 버블점수 SSOT 중복 → 받아들임. RPC가 권위(authoritative).**
- `create_review` RPC가 `p_sentiment`에서 변화량을 **서버에서 직접 도출**(클라가 보낸 `p_bubble_score_change`는 신뢰하지 않음 — 신뢰 경계, 골든룰 #6). `score = clamp(old(기본 50.0) + change, MIN 0, MAX 100)` 원자적 적용.
- 근거: 클라 계산·전송은 ① 동시 평가 lost update, ② 임의 점수 주입 위험. 서버 권위가 머니/점수 정합 표준(CLAUDE.md).
- `src/types/review.ts`의 `BUBBLE_SCORE`는 **표시 전용**(색 구간 등). 마이그레이션에 상수(INITIAL/MIN/MAX/*_CHANGE) 주석 명시 + **TS↔SQL 상수 동기화 검증 테스트 1개** 추가(분기 방지).

**9.2 D(흐름 폴리시) 범위 → 싼 것은 지금(B에 흡수), 연출만 후속.**
- **이번 범위**: 제출 후 허브 복귀(작성한 탭) · 빈/잠금 상태 문구(impeccable-design 룰 9·10) · 미작성 0건 시 기본 탭=받은. (모두 저비용, "매끄러운 흐름"의 핵심.)
- **후속(별도)**: "상대 평가 공개됨" 블라인드 언락 **연출**(애니메이션/모먼트)만 분리.

**9.3 알림 라우팅 → "항상 허브", `workLogId` 하이라이트 미포함(YAGNI).**
- 모든 `REVIEW_*` 알림 → 허브(미작성 탭). `workLogId` 기반 scroll-to/하이라이트는 **이번 범위 제외**. 비용(param 전달+FlashList scroll-to-index+강조 연출) 대비 이득 낮고, 미작성 리스트가 짧아 수동 탐색 마찰 낮음. 사용자 마찰 보고 시 재검토.

**9.4 구현 단계 확인 항목 (writing-plans에서 해소)**
- 버블점수 plpgsql 식이 `BUBBLE_SCORE` 상수와 정확히 일치(소수 자리·클램프) — 9.1 검증 테스트로 보장.
- 허브 기본 탭 결정 로직 최종 확정(진입 intent param vs 미작성 건수).

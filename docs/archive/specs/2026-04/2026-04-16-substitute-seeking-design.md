# 대타 구인 기능 설계 스펙

> 확정 스태프가 취소 요청 시 자동으로 공고 슬롯이 복원되고, 게시판에서 대타를 구할 수 있는 기능

## 1. 배경

현재 워크플로우:
- 스태프 취소 요청(REQUEST_CANCEL) → cancellation_pending → Employer 승인 → cancelled
- `cancel_application_atomically` RPC가 슬롯 복원 + closed→active 재오픈을 이미 처리

부족한 점:
- 스태프가 능동적으로 대타를 찾을 채널이 없음
- expired 공고도 재오픈될 수 있는 가드 부재
- 인원 충족 마감(`filled >= total`)에 대한 `closed_reason` 미분류

## 2. 핵심 결정 사항

| 결정 | 선택 |
|------|------|
| 대타 구인 주체 | 혼합: 시스템 자동 슬롯 복원 + 스태프 게시판/공유 |
| 취소 승인 시 슬롯 복원 | 항상 (expired/expired_by_work_date 제외) |
| 대타 구인 단위 | 지원서 전체 (부분 날짜 취소 없음) |
| 대타 뱃지/알림 | 없음. 공고 동기화 + 노출만 |
| 게시판 | 기존 boardService에 `substitute` 카테고리 탭 추가 |
| 공유 | 공고 딥링크를 카톡/SMS로 전송 |
| 새 테이블 | 0개 |
| 새 RPC | 0개 |

## 3. 전체 흐름

```
[스태프: 확정 상태]
  "취소 요청" 탭
  → 사유 입력
  → "대타 구해요 글 올리기" 체크박스 (기본 ON)
  → 제출
    ① applications.status → cancellation_pending (기존)
    ② 체크 ON → 게시판에 "대타 구해요" 글 자동 생성
       - boardType: 'substitute'
       - 공고 정보(jobSummary) 자동 첨부
       - 사유 텍스트 본문에 포함
    ③ 공유 링크 버튼 → 딥링크 공유 (카톡/SMS)

[Employer]
  취소 요청 목록 → "취소 승인" 버튼
  → cancel_application_atomically 실행
    → filled_positions 감소
    → closed → active 재오픈 (expired 제외)
  → 안내 문구: "승인 시 공고가 자동 재오픈됩니다"

[다른 스태프]
  게시판 "대타" 탭 → "대타 구해요" 글 확인 → "공고 보기" → 기존 지원 플로우
  OR
  공유 링크 수신 → 딥링크 → 공고 상세 → 지원
```

## 4. 변경 상세

### 4.1 RPC 패치: expired 재오픈 가드

파일: `supabase/migrations/` (신규 마이그레이션)

`cancel_application_atomically` 9단계 수정:

```sql
-- 기존
status = CASE
  WHEN status = 'closed' AND v_new_filled < total_positions THEN 'active'
  ELSE status
END

-- 변경
status = CASE
  WHEN status = 'closed'
    AND v_new_filled < total_positions
    AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date')
  THEN 'active'
  ELSE status
END
```

### 4.2 closed_reason 'filled' 추가

인원 충족으로 자동 마감 시 `closed_reason = 'filled'` 설정.
- `ClosedReason` 타입에 `'filled'` 추가
- 확정(CONFIRM) 시 `filled_positions >= total_positions` 이면 자동 마감하는 로직에 reason 설정
- `filled`는 재오픈 대상 (expired만 차단)

타입 변경:
```typescript
// src/types/jobPosting.ts
export type ClosedReason = 'manual' | 'expired' | 'expired_by_work_date' | 'filled';
```

### 4.3 BoardType 'substitute' 추가

```typescript
// src/types/board.ts
export type BoardType = 'notice' | 'schedule' | 'free' | 'tda' | 'substitute';

// BOARD_TYPE_LABELS
export const BOARD_TYPE_LABELS: Record<BoardType, string> = {
  notice: '공지사항',
  schedule: '일정게시판',
  free: '자유게시판',
  tda: 'TDA 토론',
  substitute: '대타 구인',
};
```

DB: `board_posts.board_type` 컬럼의 CHECK 제약에 `'substitute'` 추가 (마이그레이션)

### 4.4 boardService: 대타 글 자동 생성 함수

```typescript
// src/services/boardService.ts — 신규 함수
async function createSubstitutePost(input: {
  authorId: string;
  applicationId: string;
  jobSummary: BoardJobSummary;
  reason: string;
}): Promise<BoardPost>
```

- `boardType: 'substitute'`
- `title`: `대타 구해요 · ${jobSummary.title}`
- `content`: 사유 + 공고 요약 (날짜/역할/시급)
- `jobSummary`: 기존 `BoardJobSummary` 인터페이스 그대로 활용
- `linkedPostingId`: `jobSummary.jobPostingId`

### 4.5 취소 요청 모달 수정

파일: `src/components/applications/CancellationRequestForm.tsx`

변경:
- "대타 구해요 글 올리기" 체크박스 추가 (기본 ON)
- 안내 문구: "취소 승인 시 해당 자리가 공고에 다시 노출됩니다"
- 제출 시: 기존 취소 요청 + 체크 ON이면 `createSubstitutePost` 호출

### 4.6 공고 상세: 공유 링크 버튼

파일: 공고 상세 화면 (해당 컴포넌트)

변경:
- Share 버튼 추가
- `expo-sharing` 또는 `react-native-share` 활용
- 딥링크: `https://uniqn.app/jobs/{jobPostingId}`
- 메시지: `[대타 급구] {공고제목} · {날짜} · {역할} — UNIQN에서 지원하기`

### 4.7 게시판 UI: 대타 탭

기존 게시판 화면의 탭 목록에 "대타" 탭 추가.
- 필터: `boardType = 'substitute'`
- 카드: 공고 요약 정보가 바로 보이도록 `BoardJobSummary` 렌더링
- "공고 보기" 버튼 → 공고 상세 화면으로 네비게이션

### 4.8 Employer 취소 승인 화면

변경:
- "승인 시 공고가 자동 재오픈됩니다" 안내 문구 추가

## 5. 변경하지 않는 것

- ApplicationStatusMachine: 상태 전이 변경 없음
- 새 DB 테이블: 없음
- 새 RPC: 없음 (기존 RPC 패치만)
- 알림/푸시: 없음
- 뱃지: 없음
- 부분 날짜 취소: 미지원 (MVP 스코프 밖)
- 취소 요청 철회: 미지원 (Employer reject_cancel만 가능)

## 6. 변경 범위 요약

| 영역 | 작업 | 파일 수 |
|------|------|---------|
| DB 마이그레이션 | expired 가드 + filled reason + board_type CHECK | 1 SQL |
| 타입 | `ClosedReason` + `BoardType` 확장 | 2 |
| boardService | `createSubstitutePost` 함수 추가 | 1 |
| 취소 모달 | 체크박스 + 안내 문구 + 서비스 호출 | 1 |
| 공고 상세 | 공유 링크 버튼 | 1 |
| 게시판 UI | 대타 탭 + 카드 렌더링 | 1~2 |
| Employer UI | 취소 승인 안내 문구 | 1 |
| 스키마 | Zod 스키마 closedReason 확장 | 1 |
| **합계** | | **~10 파일** |

## 7. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| expired 공고 취소 승인 | 슬롯 복원하되 status 재오픈 안함 |
| 여러 명 동시 취소 | 각각 슬롯 복원, 게시판에 각각 글 생성 |
| 대타 글 올렸는데 취소 거부됨 | 취소 거부(REJECT_CANCEL) 시 연결된 대타 게시판 글 자동 삭제 (archived) |
| 이미 다른 사람이 지원해서 슬롯 찼을 때 | 기존 지원 마감 로직 그대로 적용 |
| 공고가 삭제된 경우 | 게시판 글의 "공고 보기"에서 "공고를 찾을 수 없습니다" 처리 |

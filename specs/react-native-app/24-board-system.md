# 24. 게시판 시스템 상세 설계

> **최종 업데이트**: 2026-03-15 | **버전**: v0.1.0 | **상태**: 제안
>
> **설계 목표**: 채팅을 도입하지 않고도 공지, 커뮤니티, 토너먼트 룰 토론, 공고별 확정 인원 소통을 안정적으로 지원하는 게시판 시스템을 현재 UNIQN 아키텍처에 맞게 설계한다.

---

## 0. 설계 결론

이 기능은 `채팅 대체용 게시판 시스템`으로 설계한다. 다만 모든 커뮤니케이션을 하나의 범용 게시판으로 합치지 않고, 기존 도메인을 재사용해 역할을 분리한다.

- `공지사항`: 기존 `announcements` 컬렉션과 서비스 유지
- `자유게시판`: 신규 일반 커뮤니티 게시판
- `TDA 룰 게시판`: 신규 토론형 게시판
- `내 공고 게시판`: 공고별 비공개 운영 게시판
- `문의/고객지원`: 기존 `inquiries` 유지

핵심 원칙은 다음과 같다.

- 공지사항은 새 게시판으로 다시 만들지 않는다
- 공고별 소통은 `공고별 전용 private board`로 모델링한다
- private board 접근 권한은 `확정 인원 membership`으로 직접 판별 가능해야 한다
- 게시글/댓글은 평면 구조로 시작하고, 대댓글/첨부/리치텍스트는 제외한다
- 새 기능은 `Presentation -> Hooks -> Service -> Repository -> Firebase` 흐름을 따른다
- Firestore 다중 문서 변경은 기존 규칙대로 `read -> validate -> write` 순서의 트랜잭션으로 처리한다

---

## 1. 범위

### 포함 범위

- 게시판 홈
- 자유게시판 목록/상세/작성/수정/삭제
- TDA 룰 게시판 목록/상세/작성/수정/삭제
- 공고별 private board 진입
- 공고별 기본 스레드와 댓글 소통
- 게시글/댓글 신고
- 게시글/댓글 고정, 잠금, 숨김, soft delete
- 알림 연동
- 관리자/고용주 moderation

### 제외 범위

- 1:1 채팅
- 실시간 타이핑 인디케이터
- 리치 텍스트 에디터
- 파일 첨부/이미지 업로드
- 중첩 댓글
- 해시태그 검색
- full-text search 외부 엔진
- 좋아요/이모지 반응
- 익명 게시판

### 비기능 목표

- 현재 Firebase/Firestore 비용 구조 안에서 저비용 운영
- 현재 보안/에러 처리/테스트 패턴 재사용
- 권한 오판단이 없는 문서 레벨 접근 제어
- 목록은 가볍고, 상세만 조금 더 무겁게 설계
- 통계 필드는 파생 데이터로 관리하고 원본 정합성을 우선

---

## 2. 현재 코드베이스와의 정합성

이 설계는 현재 레포의 다음 패턴을 그대로 따른다.

- Firestore 중심 저장소 구조
- `AnnouncementRepository`, `InquiryRepository` 같은 feature-oriented repository
- `useRealtimeSubscription` 기반 실시간 구독
- `AppError` + `handleServiceError` 기반 에러 정규화
- `xssValidation` 기반 입력 검증
- `logger.info()/warn()/error()` 기반 구조화 로그
- `notificationRepository` 및 기존 알림 라우팅 재사용

즉, 새 기능은 기존 시스템을 대체하지 않는다. 오히려 아래처럼 결합한다.

- `공지사항`: 기존 `announcements` 재사용
- `문의`: 기존 `inquiries` 재사용
- `내 공고 게시판 권한`: 기존 공고/확정 흐름과 연결
- `알림`: 기존 `notifications` 재사용
- `신고`: 기존 `reports` 확장

이렇게 해야 중복 모델, 모순된 라우팅, 중복 운영도구를 피할 수 있다.

---

## 3. 정보 구조

### 3.1 사용자 관점 메뉴 구조

```text
게시판 홈
├─ 공지사항
│  └─ 기존 announcements 화면으로 진입
├─ 자유게시판
├─ TDA 룰 게시판
└─ 내 공고 게시판
   ├─ 내가 확정된 공고 목록
   └─ 공고별 private board
```

### 3.2 보드별 정책

| 구분 | 저장소 | 읽기 권한 | 쓰기 권한 | 댓글 | 비고 |
|------|--------|-----------|-----------|------|------|
| 공지사항 | 기존 `announcements` | 기존 정책 유지 | 관리자/운영자 | 기본 비활성 | 재구현 금지 |
| 자유게시판 | 신규 `boards/free` | 로그인 사용자 | 로그인 사용자 | 가능 | 커뮤니티 |
| TDA 룰 게시판 | 신규 `boards/tda` | 로그인 사용자 | 로그인 사용자 | 가능 | 룰 토론 |
| 내 공고 게시판 | 신규 `boards/job_{jobPostingId}` | 고용주/확정 인원/관리자 | 고용주, 시스템 | 댓글 가능 | 공고 운영용 |

### 3.3 `내 공고 게시판`의 UX 정책

`내 공고 게시판`은 일반 게시판처럼 누구나 여러 개의 글을 만드는 구조로 시작하지 않는다.

Phase 1 정책:

- 공고별 board는 자동 생성 또는 lazy ensure
- 공고별 기본 스레드 1개를 시스템이 생성
- 고용주는 추가 공지성 스레드를 생성할 수 있다
- 확정 인원은 기본적으로 댓글만 작성할 수 있다
- 필요 시 Phase 2에서 `질문 글 생성 허용`으로 확장한다

이 정책을 택하는 이유는 다음과 같다.

- 공고 단위 소통은 대화형에 가깝고 게시글 폭증이 드물다
- 초기에 thread 개수가 많아지면 UI 복잡도와 moderation 비용이 올라간다
- 고용주가 운영 공지 흐름을 통제하기 쉽다

---

## 4. 도메인 모델

### 4.1 신규 타입

```typescript
export type BoardType = 'free' | 'tda' | 'job_private';
export type BoardVisibility = 'authenticated' | 'job_private';
export type BoardStatus = 'active' | 'locked' | 'archived';
export type BoardMembershipStatus = 'active' | 'revoked' | 'archived';
export type BoardPostStatus = 'published' | 'hidden' | 'deleted' | 'archived';
export type BoardCommentStatus = 'published' | 'hidden' | 'deleted';
export type BoardPostKind = 'general' | 'question' | 'notice' | 'rule' | 'job_general' | 'job_notice';
```

### 4.2 Board 문서

경로:

```text
boards/{boardId}
```

예시:

```typescript
interface Board {
  id: string;
  type: BoardType;
  visibility: BoardVisibility;
  status: BoardStatus;

  title: string;
  description?: string;

  // job_private 전용
  jobPostingId?: string;
  jobPostingTitle?: string;
  ownerId?: string;
  ownerName?: string;

  // 정책
  writePolicy: 'authenticated' | 'owner_only';
  commentPolicy: 'authenticated' | 'member_only';
  allowPostsByMembers: boolean;
  allowComments: boolean;

  // 정렬/캐시용 집계
  postCount: number;
  commentCount: number;
  activeMemberCount?: number;
  lastActivityAt?: Timestamp;
  lastPostAt?: Timestamp;

  // 운영
  isPinnedBoard?: boolean;
  archiveReason?: string;
  archivedAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.3 BoardPost 문서

경로:

```text
boards/{boardId}/posts/{postId}
```

예시:

```typescript
interface BoardPost {
  id: string;
  boardId: string;
  boardType: BoardType;
  visibility: BoardVisibility;
  boardStatus: BoardStatus;

  // job_private 권한 체크용 중복 저장
  jobPostingId?: string;
  boardOwnerId?: string;

  kind: BoardPostKind;
  status: BoardPostStatus;

  title: string;
  content: string;

  authorId: string;
  authorName: string;
  authorRole: 'staff' | 'employer' | 'admin';

  isPinned: boolean;
  isLocked: boolean;
  isSystemGenerated: boolean;

  commentCount: number;
  viewCount: number;
  lastCommentAt?: Timestamp;
  lastCommentAuthorName?: string;

  editedAt?: Timestamp;
  deletedAt?: Timestamp;
  hiddenAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.4 BoardComment 문서

경로:

```text
boards/{boardId}/posts/{postId}/comments/{commentId}
```

예시:

```typescript
interface BoardComment {
  id: string;
  boardId: string;
  postId: string;
  boardType: BoardType;
  visibility: BoardVisibility;
  jobPostingId?: string;
  boardOwnerId?: string;

  status: BoardCommentStatus;
  content: string;

  authorId: string;
  authorName: string;
  authorRole: 'staff' | 'employer' | 'admin';

  isSystemGenerated: boolean;
  editedAt?: Timestamp;
  deletedAt?: Timestamp;
  hiddenAt?: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4.5 Membership 문서

경로:

```text
users/{userId}/boardMemberships/{boardId}
```

예시:

```typescript
interface BoardMembership {
  boardId: string;
  boardType: 'job_private';
  status: BoardMembershipStatus;

  jobPostingId: string;
  jobPostingTitle: string;
  ownerId: string;

  joinedAt: Timestamp;
  revokedAt?: Timestamp;
  archivedAt?: Timestamp;
  expiresAt?: Timestamp;

  lastReadAt?: Timestamp;
  unreadCount?: number;
}
```

이 membership 문서는 `내 공고 게시판` 목록 조회와 Firestore Rules의 direct lookup 둘 다를 위해 필요하다.

---

## 5. 컬렉션 설계

### 5.1 신규 컬렉션

```text
boards/
  free
  tda
  job_{jobPostingId}
    posts/
      {postId}
        comments/
          {commentId}

users/
  {userId}
    boardMemberships/
      job_{jobPostingId}
```

### 5.2 기존 컬렉션 재사용

```text
announcements/   // 공지사항 유지
inquiries/       // 문의 유지
notifications/   // 게시판 알림 저장
reports/         // 게시글/댓글 신고로 확장
jobPostings/     // owner, lifecycle 참조
applications/    // 확정 시 membership 생성의 기준 이벤트
workLogs/        // 확정 staff 실데이터와 lifecycle 보강
```

### 5.3 boardId 규칙

| 보드 | boardId |
|------|---------|
| 자유게시판 | `free` |
| TDA 룰 게시판 | `tda` |
| 내 공고 게시판 | `job_{jobPostingId}` |

이 규칙을 고정하면 다음 이점이 있다.

- 직관적인 deep link 생성
- membership direct path 계산 가능
- 중복 생성 방지 쉬움
- server/client 둘 다 idempotent 처리 가능

---

## 6. 권한 설계

### 6.1 역할별 접근 매트릭스

| 액션 | staff | employer | admin |
|------|:-----:|:--------:|:-----:|
| 자유게시판 읽기 | ✅ | ✅ | ✅ |
| 자유게시판 글 작성 | ✅ | ✅ | ✅ |
| 자유게시판 moderation | ❌ | ❌ | ✅ |
| TDA 읽기/작성 | ✅ | ✅ | ✅ |
| TDA moderation | ❌ | ❌ | ✅ |
| 내 공고 게시판 읽기 | 확정 인원만 | 공고 owner만 | ✅ |
| 내 공고 게시판 기본 댓글 | 확정 인원만 | ✅ | ✅ |
| 내 공고 게시판 새 글 작성 | 기본 비활성 | ✅ | ✅ |
| 게시글 고정/잠금/숨김 | ❌ | 자기 공고만 | ✅ |

### 6.2 중요한 보안 원칙

- `job_private` read 권한은 추론이 아니라 membership 문서로 직접 판별한다
- board/post/comment마다 권한 판별용 최소 필드를 중복 저장한다
- owner 권한은 `board.ownerId`로 판별한다
- staff는 자기 membership이 있을 때만 접근한다
- archived board는 기본 read-only다
- deleted 문서는 hard delete 대신 tombstone 형태를 유지한다

### 6.3 권한 판별 우선순위

1. admin
2. board owner
3. active membership
4. archived membership + archived board read only
5. 그 외 deny

---

## 7. 데이터 흐름 설계

### 7.1 아키텍처 레이어

```text
app/ + src/components/
  -> src/hooks/boards/
  -> src/services/boards/
  -> src/repositories/firebase/board/
  -> Firebase Firestore / Functions / Notifications
```

### 7.2 추천 모듈 구조

```text
src/types/
  board.ts

src/schemas/
  board.schema.ts

src/repositories/interfaces/
  IBoardRepository.ts

src/repositories/firebase/board/
  index.ts
  boardQueries.ts
  boardMutations.ts
  boardSubscriptions.ts
  boardParsers.ts

src/services/boards/
  boardService.ts
  jobBoardService.ts
  boardModerationService.ts

src/hooks/boards/
  useBoards.ts
  useBoardPosts.ts
  useBoardPostDetail.ts
  useBoardComments.ts
  useJobBoards.ts
  useBoardMutations.ts

src/components/boards/
  BoardCard.tsx
  BoardPostCard.tsx
  BoardComposer.tsx
  BoardCommentItem.tsx
  BoardEmptyState.tsx
  BoardPermissionGate.tsx
  JobBoardHeader.tsx
```

### 7.3 게시판 목록 조회 흐름

```text
Screen
 -> useBoards(boardType)
 -> boardService.fetchBoards()
 -> boardRepository.getPublicBoards()
 -> Firestore boards/{boardId}
```

설계 원칙:

- 자유/TDA 게시판 목록은 board 정의 문서 + 최신 post 목록으로 분리
- 게시판 홈은 무겁지 않게 유지
- 홈에서 댓글 수, 마지막 활동 정도만 노출

### 7.4 게시글 목록 조회 흐름

```text
Screen
 -> useBoardPosts(boardId, filters)
 -> boardService.fetchPosts()
 -> boardRepository.getPosts(boardId)
 -> Firestore boards/{boardId}/posts
```

설계 원칙:

- 페이지네이션 기본 20개
- pinned 먼저, 그 다음 최근 활동 순
- 삭제/숨김 문서는 기본 필터링
- 상세 진입 전 목록에서 comment preview를 과도하게 싣지 않음

### 7.5 댓글 목록 조회 흐름

```text
Screen
 -> useBoardComments(boardId, postId)
 -> boardService.fetchComments()
 -> boardRepository.getComments(boardId, postId)
 -> Firestore boards/{boardId}/posts/{postId}/comments
```

설계 원칙:

- 기본 페이지 크기 30
- 오름차순 정렬
- nested comment는 제외
- `job_private` 상세만 선택적으로 실시간 구독 허용

### 7.6 내 공고 게시판 진입 흐름

```text
Screen
 -> useJobBoards()
 -> jobBoardService.fetchMyJobBoards(userId)
 -> staff: users/{uid}/boardMemberships
 -> employer: 내가 owner인 job board 목록
```

핵심 결정:

- staff용 목록은 membership 기반
- employer용 목록은 ownerId 기준 board 조회
- membership이 있어도 board 문서가 아직 없을 수 있으므로 서비스가 `ensureBoardExists`를 선행한다

### 7.7 `ensureJobBoardExists` 흐름

```text
jobBoardService.ensureBoard(jobPostingId)
 -> runTransaction
 -> board doc 존재 여부 확인
 -> 없으면 board 생성
 -> 기본 general post 생성
 -> commit
```

이 동작은 lazy 방식으로 시작한다.

- 확인/확정 시점에 membership만 먼저 생성 가능
- board 문서는 첫 진입 시 생성
- 이후 필요 시 Cloud Function trigger로 선생성 가능

이 접근의 장점:

- 현재 확정 로직과 결합도를 낮춤
- 배포 초기 변경 범위를 줄임
- 미사용 공고 board 생성 낭비를 줄임

---

## 8. 데이터 정합성 전략

### 8.1 원본과 파생 데이터 분리

원본 데이터:

- `BoardPost`
- `BoardComment`
- `BoardMembership`

파생 데이터:

- `board.postCount`
- `board.commentCount`
- `board.lastActivityAt`
- `post.commentCount`
- `post.lastCommentAt`
- `membership.unreadCount`

원칙:

- 파생 데이터는 조회 최적화용이다
- 원본 문서가 정답이다
- 파생 데이터가 깨져도 복구 가능해야 한다

### 8.2 카운터 업데이트 규칙

게시글 생성:

- post 문서 생성
- board.postCount +1
- board.lastActivityAt 갱신

댓글 생성:

- comment 문서 생성
- post.commentCount +1
- board.commentCount +1
- post.lastCommentAt 갱신
- board.lastActivityAt 갱신

모든 카운터 변경은 동일 트랜잭션에서 처리한다.

### 8.3 soft delete 규칙

게시글 삭제:

- `status = deleted`
- `content = '삭제된 게시글입니다.'` 형태의 tombstone 유지
- comment는 물리 삭제하지 않음
- 목록에서는 기본 숨김

댓글 삭제:

- `status = deleted`
- `content = '삭제된 댓글입니다.'`

soft delete를 택하는 이유:

- thread 맥락 유지
- 신고/감사 추적 유지
- 롤백과 moderation history 확보

### 8.4 membership 정합성

membership은 확정 상태와 직접 연동한다.

권장 흐름:

- 지원 확정 또는 workLog 생성 시 `status=active` upsert
- 확정 취소 시 `status=revoked`
- 공고 종료 후 retention 기간 경과 시 `status=archived` 또는 `expiresAt` 설정

중요:

- membership 삭제보다 상태 전이를 우선한다
- 이력 보존과 권한 판단이 쉬워진다

### 8.5 lifecycle 동기화

`job_private` board는 공고 lifecycle과 연결한다.

- 공고 active/confirmed 운영 중: `board.status = active`
- 공고 취소/종료 이후: `board.status = locked`
- 정산 완료 + retention 만료 이후: `board.status = archived`

권장 retention:

- 기본 30일 read-only 유지

---

## 9. Firestore 보안 규칙 설계

### 9.1 규칙 설계 원칙

- public board와 private board 규칙을 명확히 분리
- private board 접근은 membership doc direct lookup만 사용
- subcollection rule에서 상위 board를 과도하게 조회하지 않도록 최소 필드 중복 저장
- create/update 시 변경 가능한 필드를 엄격히 제한

### 9.2 helper 함수 개념

```javascript
function isAuthenticated() {
  return request.auth != null;
}

function isAdmin() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

function hasBoardMembership(boardId) {
  return exists(
    /databases/$(database)/documents/users/$(request.auth.uid)/boardMemberships/$(boardId)
  ) &&
  get(
    /databases/$(database)/documents/users/$(request.auth.uid)/boardMemberships/$(boardId)
  ).data.status in ['active', 'archived'];
}
```

### 9.3 board 규칙 개념

- `free`, `tda`
  - read: authenticated
  - create/update/delete: 서비스 정책에 맞는 역할만

- `job_private`
  - read: admin or owner or hasBoardMembership(boardId)
  - write: admin or owner
  - comment write: admin or owner or active membership

### 9.4 post/comment 문서 규칙

post/comment에는 아래 권한 판별 필드를 중복 저장한다.

- `boardType`
- `visibility`
- `jobPostingId`
- `boardOwnerId`

이유:

- 상위 board 문서 `get()` 남발 방지
- 규칙 단순화
- post/comment rule 자체 완결성 확보

### 9.5 입력 제한

규칙에서 추가로 제한할 항목:

- title length
- content length
- 금지된 status 직접 변경
- authorId 위조 금지
- boardId/postId 변경 금지
- owner 관련 필드 수정 금지

---

## 10. 스키마 및 검증 설계

### 10.1 신규 Zod 스키마

```text
src/schemas/board.schema.ts
```

포함 스키마:

- `boardTitleSchema`
- `boardContentSchema`
- `createBoardPostSchema`
- `updateBoardPostSchema`
- `createBoardCommentSchema`
- `updateBoardCommentSchema`
- `boardFilterSchema`

### 10.2 입력 검증 원칙

- `xssValidation` 재사용
- 제목/본문 길이 제한
- 공백만 있는 입력 금지
- private board에서는 policy상 허용되지 않은 `kind` 차단
- job board 일반 멤버는 post 생성 요청 자체를 schema 단계와 service 단계에서 모두 차단

권장 제한:

| 항목 | 제한 |
|------|------|
| 게시글 제목 | 5~80자 |
| 게시글 본문 | 1~5000자 |
| 댓글 본문 | 1~1000자 |
| 줄바꿈 | 허용 |
| HTML/스크립트 | 금지 |

### 10.3 URL/이미지 정책

Phase 1:

- 외부 링크는 텍스트로만 허용
- 이미지/파일 첨부 비활성
- 안전 URL 화이트리스트는 추후 도입

이렇게 해야 moderation과 storage 비용을 동시에 줄일 수 있다.

---

## 11. Repository 설계

### 11.1 인터페이스 방향

`IBoardRepository` 하나를 feature facade로 두고, 내부 구현은 queries/mutations/subscriptions로 나눈다.

```typescript
export interface IBoardRepository {
  getBoard(boardId: string): Promise<Board | null>;
  getPublicBoards(): Promise<Board[]>;
  getJobBoardsByOwner(ownerId: string): Promise<Board[]>;

  getPosts(boardId: string, options?: FetchBoardPostsOptions): Promise<PaginatedBoardPosts>;
  getPost(boardId: string, postId: string): Promise<BoardPost | null>;
  getComments(boardId: string, postId: string, options?: FetchBoardCommentsOptions): Promise<PaginatedBoardComments>;

  ensureJobBoard(input: EnsureJobBoardInput): Promise<string>;
  createPost(input: CreateBoardPostInput): Promise<string>;
  updatePost(input: UpdateBoardPostInput): Promise<void>;
  deletePost(input: DeleteBoardPostInput): Promise<void>;

  createComment(input: CreateBoardCommentInput): Promise<string>;
  updateComment(input: UpdateBoardCommentInput): Promise<void>;
  deleteComment(input: DeleteBoardCommentInput): Promise<void>;

  pinPost(input: PinBoardPostInput): Promise<void>;
  lockPost(input: LockBoardPostInput): Promise<void>;
  hidePost(input: HideBoardPostInput): Promise<void>;

  subscribeComments?(boardId: string, postId: string, callbacks: BoardCommentSubscriptionCallbacks): () => void;
}
```

### 11.2 구현 원칙

- `QueryBuilder` 재사용
- `processPaginatedResults` 재사용
- parse 함수는 schema와 함께 유지
- repository는 Firebase 모듈 API 세부사항을 감춘다
- 서비스는 permission/business rule을 담당하고 repository는 데이터 접근을 담당한다

### 11.3 트랜잭션 대상

- `ensureJobBoard`
- `createComment`
- `deleteComment`
- `pinPost/lockPost/hidePost`
- membership 상태 변경

---

## 12. Service 설계

### 12.1 `boardService`

책임:

- 자유/TDA 게시판 조회
- 게시글/댓글 작성 수정 삭제
- 일반 사용자 권한 검증
- 알림 트리거 호출
- view count 정책 적용

### 12.2 `jobBoardService`

책임:

- `내 공고 게시판` 목록 조회
- board ensure
- 공고 lifecycle 반영
- membership과 접근 정책 검증
- employer/staff 시나리오 분기

### 12.3 `boardModerationService`

책임:

- pin
- lock
- hide
- archive
- 신고 후 moderation action

### 12.4 기존 서비스와의 연계

| 기존 서비스 | 연계 방식 |
|-------------|-----------|
| `announcementService` | 공지사항은 재사용 |
| `inquiryService` | 고객문의는 유지 |
| `confirmedStaffService` | job board membership 업데이트 연계 |
| `notificationService` | 게시판 알림 발송 |
| `reportService` | 게시글/댓글 신고로 확장 |

### 12.5 확정 플로우 연계 지점

membership upsert는 다음 중 하나에서 처리한다.

우선 권장:

- 기존 확정 트랜잭션이 끝난 직후 서비스에서 idempotent upsert

추후 강화안:

- Cloud Function trigger로 secondary sync

이중화 이유:

- 서비스 경로에서 즉시 일관성 확보
- trigger는 복구/보정 용도

---

## 13. Hook 및 캐시 설계

### 13.1 Query key 제안

```typescript
boards: {
  home: ['boards', 'home'],
  public: (type: BoardType) => ['boards', 'public', type],
  detail: (boardId: string) => ['boards', boardId],
  myJobBoards: (userId: string) => ['boards', 'myJobBoards', userId],
},
boardPosts: {
  list: (boardId: string, filters?: object) => ['boardPosts', boardId, filters],
  detail: (boardId: string, postId: string) => ['boardPosts', boardId, postId],
},
boardComments: {
  list: (boardId: string, postId: string) => ['boardComments', boardId, postId],
},
```

### 13.2 캐시 정책

| 데이터 | staleTime | 비고 |
|--------|-----------|------|
| 게시판 홈 | 5분 | 자주 바뀌지 않음 |
| 게시글 목록 | 2분 | 적당한 타협 |
| 게시글 상세 | 1분 | 댓글 진입 전 최신성 보장 |
| 댓글 | 0~30초 또는 실시간 | job board만 실시간 옵션 |
| 내 공고 게시판 목록 | 1분 | membership 변경 반영 필요 |

### 13.3 실시간 전략

기본 원칙:

- 목록은 polling/cached fetch
- 상세만 선택적 realtime
- job_private 댓글만 realtime 우선

이유:

- 읽기 비용 절감
- 구독 수 폭증 방지
- UX상 실시간이 필요한 지점만 좁힘

### 13.4 오프라인 정책

Phase 1:

- 읽기: React Query 캐시 기반 허용
- 쓰기: 오프라인 차단, 재시도 유도
- 작성 중 draft: MMKV 임시 저장 가능

이 정책은 구현 복잡도 대비 UX 손실이 작다.

---

## 14. UI / UX 설계

### 14.1 공통 UI 원칙

- 기존 NativeWind / Tailwind 패턴 유지
- 긴 목록은 `FlashList` 사용
- `dark:` 스타일 포함
- composer는 단순 textarea 스타일
- rich text toolbar 도입 금지

### 14.2 화면 제안

```text
(app)/boards/index.tsx
(app)/boards/free/index.tsx
(app)/boards/tda/index.tsx
(app)/boards/[boardId]/[postId].tsx
(app)/job-boards/index.tsx
(app)/job-boards/[jobPostingId].tsx
(employer)/my-postings/[id]/board.tsx
```

### 14.3 게시판 홈

노출 요소:

- 공지사항 카드
- 자유게시판 카드
- TDA 룰 게시판 카드
- 내 공고 게시판 카드

카드 정보:

- 설명
- unread 여부
- 최근 활동 시간
- 새 글 수는 Phase 2

### 14.4 자유/TDA 게시판 목록 UX

- 상단 고정글 먼저
- 검색보다 카테고리/정렬이 우선
- empty state 명확히 제공
- 새 글 작성 FAB 또는 header action

### 14.5 공고 private board UX

진입 정보:

- 공고 제목
- 일정/시간
- 고용주 이름
- 참여 인원 수
- locked/archive 상태 배너

기본 레이아웃:

- 상단 공고 요약 카드
- pinned notice thread
- general thread
- 댓글 composer

중요:

- 일반 staff에게는 `댓글` UI만 노출
- 새 글 버튼은 owner/admin에게만 노출

### 14.6 알림 UX

알림 정책은 noise를 최소화한다.

기본 정책:

- 자유/TDA: 내 글에 댓글, 내 댓글에 후속 댓글, 멘션만
- job_private: 고용주 공지글/댓글, 내가 참여 중인 스레드 댓글만
- 대량 알림은 owner 공지에 한정

### 14.7 접근성

- 버튼/입력에 role, label 명확화
- pinned/locked/deleted 상태를 색만으로 표현하지 않음
- 본문 글자 크기 최소 14
- 댓글/작성 에러는 toast와 inline error 둘 다 지원

---

## 15. 에러 처리 설계

### 15.1 신규 비즈니스 에러 후보

```text
BoardAccessDeniedError
BoardArchivedError
BoardLockedError
BoardMembershipRequiredError
BoardPostCreationNotAllowedError
BoardCommentNotAllowedError
BoardPostNotFoundError
BoardCommentNotFoundError
BoardContentTooLongError
BoardAlreadyExistsError
```

### 15.2 에러 처리 원칙

- repository는 Firebase 에러를 그대로 던지거나 최소 정규화
- service는 `handleServiceError`로 AppError 변환
- UI는 `toast.error(appError.userMessage)` 우선
- destructive/moderation action은 confirm dialog 사용

### 15.3 재시도 정책

| 동작 | 재시도 |
|------|--------|
| 목록 조회 실패 | 가능 |
| 상세 조회 실패 | 가능 |
| 글 작성 실패 | 가능 |
| 댓글 작성 실패 | 가능 |
| moderation 실패 | 가능하되 중복 제출 방지 |

중복 제출 방지:

- submit 중 버튼 disabled
- mutation pending state 유지
- 네트워크 재시도 시 동일 본문 중복 전송은 Phase 1에서 UI lock으로 제어

---

## 16. 성능 및 비용 설계

### 16.1 비용 관점 핵심 원칙

- 게시판 홈은 realtime 사용 금지
- 댓글 realtime은 private board 상세에만 제한
- view count는 무조건 증가시키지 않고 로컬 throttling 적용
- membership 목록을 별도 유지해 expensive join-like query를 피함
- 첨부파일, 반응, nested comment를 제외해 write amplification 방지

### 16.2 성능 최적화 포인트

1. 게시글 목록과 댓글 목록을 분리 조회
2. 댓글은 flat 구조로 유지
3. `lastActivityAt`, `commentCount`를 denormalize
4. 작성자 프로필 snapshot을 post/comment에 저장
5. 목록 카드에서 추가 사용자 조회 금지
6. 게시판 홈은 board summary만 조회

### 16.3 예상 index

예상 Composite Index:

- `boards`: `type asc, status asc, lastActivityAt desc`
- `boards/{boardId}/posts`: `status asc, isPinned desc, lastCommentAt desc`
- `boards/{boardId}/posts`: `status asc, createdAt desc`
- `users/{userId}/boardMemberships`: `status asc, joinedAt desc`

### 16.4 view count 정책

권장:

- 사용자당 post별 24시간 1회 증가
- client의 MMKV/local cache에 최근 viewed key 저장
- 중요하지 않은 지표라 실패해도 UX 영향 없음

---

## 17. 보안 설계

### 17.1 입력 보안

- 제목/본문 모두 `xssValidation` 적용
- HTML 렌더링 금지
- markdown 렌더링 금지
- URL auto-linking은 추후 도입

### 17.2 권한 보안

- membership 없는 staff는 private board path를 알아도 접근 불가
- owner가 아닌 employer는 타 공고 private board 접근 불가
- client에서 role flag만 믿지 않고 Firestore Rules로 최종 강제

### 17.3 운영 보안

- 게시글/댓글 soft delete
- 신고 로그 보존
- admin moderation action 로깅
- audit용 `hiddenAt`, `deletedAt`, `editedAt` 유지

### 17.4 민감 정보 최소화

- 전화번호, 계좌, 개인 식별 정보 노출 금지
- 댓글에 민감 정보 공유를 허용하지 않는 문구 노출
- 신고 사유 preset 제공

---

## 18. 일관성, 중복, 모순 방지 원칙

### 18.1 일관성

- status 값은 기존 `STATUS` 상수 패턴에 맞춰 정의
- 필드명은 기존 camelCase 유지
- Firestore 필드명은 `FIELDS` 상수에 추가
- logger와 AppError 패턴 재사용

### 18.2 중복 방지

- 공지사항을 새 board entity로 다시 만들지 않음
- 문의를 게시판 댓글로 대체하지 않음
- `job_private`와 별도 채팅방을 동시에 만들지 않음
- 작성자 user profile 조회를 매 화면마다 반복하지 않음

### 18.3 모순 방지

- `내 공고 게시판`은 확정 전 지원자에게 열지 않음
- owner가 잠근 스레드에 일반 staff 댓글 허용하지 않음
- archived board에 write 허용하지 않음
- deleted 문서가 목록 통계에 계속 남는 문제를 서비스 규칙으로 통제

### 18.4 레거시 존중

- 기존 `announcements`, `inquiries`, `notifications`, `reports`는 유지
- 기존 알림 deep link 정책을 확장만 하고 교체하지 않음
- 기존 공고/확정/정산 흐름을 깨지 않도록 board는 부가 기능으로 붙인다

---

## 19. 테스트 전략

### 19.1 단위 테스트

- `board.schema.test.ts`
- `boardService.test.ts`
- `jobBoardService.test.ts`
- `boardModerationService.test.ts`
- `board parser/query helper` 테스트

### 19.2 Repository 테스트

Firestore emulator 기반으로 검증:

- board ensure idempotency
- comment create transaction
- soft delete
- membership 기반 조회
- locked/archived state write 차단

### 19.3 Security Rules 테스트

필수 시나리오:

- 비회원 public board 접근 차단
- membership 없는 staff의 private board 접근 차단
- owner의 private board 관리 허용
- archived board write 차단
- 댓글 authorId 위조 차단

### 19.4 E2E 테스트

- 자유게시판 작성/댓글/삭제
- TDA 게시판 작성/신고
- 확정된 staff만 `내 공고 게시판` 진입 가능
- employer가 공고 board 공지 작성
- 공고 종료 후 read-only

---

## 20. 구현 순서

### Phase 0. 상수/타입/스키마

- `COLLECTIONS.BOARDS`
- `FIELDS.BOARD`, `FIELDS.BOARD_POST`, `FIELDS.BOARD_COMMENT`
- `STATUS.BOARD`, `STATUS.BOARD_POST`, `STATUS.BOARD_COMMENT`
- `src/types/board.ts`
- `src/schemas/board.schema.ts`

### Phase 1. Repository + Service

- board repository facade 구현
- public board CRUD
- private job board ensure
- membership upsert service

### Phase 2. UI

- 게시판 홈
- 자유/TDA 목록 및 상세
- job board 상세
- 작성/댓글 composer

### Phase 3. Moderation + 알림 + 신고

- pin/lock/hide
- report 연동
- notification type 확장

### Phase 4. 성능/운영

- index 정리
- archive 동기화
- view throttling
- observability dashboard

---

## 21. 운영 및 모니터링

### 21.1 로그

주요 로그 이벤트:

- board ensure
- post create/update/delete
- comment create/update/delete
- moderation action
- membership upsert/revoke
- security denied related service error

### 21.2 모니터링 지표

- board별 DAU
- post/comment 생성 수
- private board 활성 공고 수
- 신고 비율
- moderation 처리 시간
- archived board 비율

### 21.3 알림 과다 방지

- 동일 post의 짧은 시간 내 댓글 알림 배치 고려
- owner가 여러 건 연속 공지할 때 rate limit 고려
- 자유게시판은 default opt-in이 아니라 최소 알림 원칙 유지

---

## 22. 의존성 전략

### 22.1 신규 패키지

Phase 1 원칙:

- 신규 패키지 추가 없음

재사용 대상:

- `zod`
- `@tanstack/react-query`
- `@shopify/flash-list`
- `expo-image`
- 기존 Firebase SDK

### 22.2 도입 금지

초기에는 아래를 넣지 않는다.

- rich text editor
- markdown parser
- mention parser
- 외부 search engine
- 외부 채팅 SDK

이유:

- 유지보수 비용 증가
- moderation 복잡도 증가
- 보안면 확대
- 현재 문제를 해결하는 데 과함

---

## 23. 핵심 결정 요약

### 반드시 지킬 결정

1. 공지사항은 기존 `announcements` 재사용
2. `내 공고 게시판`은 `job_private board`로 구현
3. private 권한은 `users/{uid}/boardMemberships/{boardId}`로 판별
4. job board는 초기에는 `owner/system thread + member comments` 구조
5. flat comment만 허용
6. soft delete 사용
7. 실시간은 private board 댓글에만 제한적으로 사용
8. 신규 외부 의존성 도입 없음

### 설계상 가장 중요한 트레이드오프

- 채팅 같은 즉시성은 일부 포기하고, 비용/기록/운영 난이도를 얻는다
- 범용 게시판 엔진보다 `공지 재사용 + 커뮤니티 + private job board` 분리로 일관성을 얻는다
- membership 문서 추가로 데이터 모델은 조금 늘어나지만, 보안 규칙과 목록 조회가 단순해진다

---

## 24. 다음 구현 체크리스트

- [ ] `boards` 관련 타입/상수 정의
- [ ] `board.schema.ts` 추가
- [ ] `IBoardRepository` 및 Firebase 구현 추가
- [ ] `boardService`, `jobBoardService`, `boardModerationService` 추가
- [ ] Firestore rules 업데이트
- [ ] `notification` 타입 확장
- [ ] `report` 대상 타입 확장
- [ ] 게시판 홈/목록/상세 화면 추가
- [ ] employer 공고 상세 진입점 추가
- [ ] membership 연계 로직 추가
- [ ] emulator 테스트 추가
- [ ] feature flag 추가

---

*마지막 업데이트: 2026-03-15*

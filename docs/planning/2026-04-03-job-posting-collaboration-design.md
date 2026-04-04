> 아카이브 문서
>
> 이 문서는 현재 운영 기준이 아니라 기능 설계, 구현 계획, 출시 전 검토용 문서입니다.
> 현재 기준 문서는 `README.md`, `docs/README.md`, `docs/reference/ARCHITECTURE.md`, `docs/reference/DATA_SCHEMA.md`를 우선 확인하세요.

# Job Posting Collaboration Design

Last updated: 2026-04-04  
Status: Proposed  
Target code: `uniqn-mobile/`, `functions/`, `firestore.rules`

## 0. 설계 결론

이 기능은 `공고 단일 owner 유지 + 공동 관리자(editor) 추가` 모델로 설계한다.

핵심 결정:

- `ownerId`는 그대로 유지한다.
- 공고 문서에 `manageableByIds: string[]`를 추가해 owner와 공동 관리자를 함께 표현한다.
- 실제 공동 관리자 메타데이터는 `jobPostings/{postId}/collaborators/{userId}` 문서로 분리한다.
- 초대는 일반 검색 기능이 아니라 `정확한 전화번호 기반 타겟 초대`로 시작한다.
- 초대/수락/거절/회수는 Cloud Functions callable이 권한과 상태 전이를 서버에서 강제한다.
- 공동 관리자는 `공고 편집`, `지원자 관리`, `근무기록/정산 관리`, `QR 운영`까지 가능하게 하고, `공고 삭제`, `공동 관리자 초대/회수`, `소유권 변경`은 owner 전용으로 둔다.
- 리뷰, 신고, draft 공동 편집, 링크형 공개 초대는 v1 범위에서 제외한다.

## 1. 배경과 현재 제약

현재 구현은 공고를 `ownerId` 단일 소유자로 취급한다.

현재 제약이 걸려 있는 대표 지점:

- 타입 계약: `uniqn-mobile/src/types/jobPosting.ts`
- 공고 상세 접근 가드: `uniqn-mobile/app/(employer)/my-postings/[id]/_layout.tsx`
- 내 공고 조회: `uniqn-mobile/src/services/jobs/jobService.ts`
- 공고 수정/삭제/마감/재오픈 트랜잭션: `uniqn-mobile/src/repositories/firebase/jobPosting/jobPostingTransactions.ts`
- 지원자 조회/확정/거절/취소 검토: `uniqn-mobile/src/repositories/firebase/application/applicationEmployer.ts`, `applicationTransactions.ts`, `applicationHistoryTransactions.ts`
- 정산/근무시간 수정: `uniqn-mobile/src/repositories/firebase/SettlementRepository.ts`
- 보안 규칙: `firestore.rules`

즉, 이 기능은 UI 한 군데가 아니라 아래 전체를 같이 바꿔야 한다.

- 데이터 모델
- Zod 스키마와 canonical serializer
- repository/service 권한 체크
- employer 라우트 가드
- Firestore Rules
- Functions callable
- 인덱스
- 마이그레이션
- 테스트

## 2. 목표와 비목표

### 2.1 목표

- 본인 공고를 다른 구인자에게 공유해 함께 운영할 수 있어야 한다.
- 공동 관리자는 owner와 거의 동일한 운영 권한으로 공고를 관리할 수 있어야 한다.
- 권한 판별은 client 추론이 아니라 서버와 Firestore Rules에서 최종 강제되어야 한다.
- 기존 `ownerId` 중심 데이터와 공개 공고 흐름을 최대한 유지해야 한다.
- 기존 문서와의 호환성을 고려한 점진적 롤아웃이 가능해야 한다.

### 2.2 비목표

- 공동 소유자 다중 owner 모델
- 소유권 이전
- 링크를 아는 누구나 수락 가능한 공개 초대
- 채팅/메모/코멘트 시스템
- draft 실시간 공동 편집
- 리뷰/평가 시스템의 공동 관리자 참여
- 신고 시스템 위임

## 3. 사용자 시나리오

### 3.1 owner

- owner는 공고 상세의 `공동 관리` 화면에서 다른 구인자를 초대한다.
- owner는 현재 공동 관리자와 대기 중인 초대를 본다.
- owner는 pending invite를 취소하거나 이미 수락한 공동 관리자를 제거할 수 있다.
- owner는 언제든 공고를 삭제할 수 있다.

### 3.2 invited employer

- 초대 대상 구인자는 알림 또는 초대함에서 초대를 확인한다.
- 초대를 수락하면 해당 공고가 `내 공고` 목록에 `공유받은 공고`로 나타난다.
- 공동 관리자는 공고 수정, 지원자 확정/거절, 정산/근무기록 수정 등을 수행할 수 있다.
- 공동 관리자는 자신이 owner가 아니므로 공유 설정을 바꾸거나 공고를 삭제할 수 없다.

### 3.3 removed collaborator

- 회수 직후부터 공고 상세, 지원자, 정산, QR 등 관련 화면 접근이 차단된다.
- 과거 작업 이력의 `processedBy`, `modifiedBy`, `reviewedBy` 같은 actor 값은 그대로 남는다.

## 4. 권한 모델

### 4.1 역할

공고 단위 역할:

- `owner`
- `editor`

전역 사용자 역할은 기존대로 유지한다.

- `admin`
- `employer`
- `staff`

공고 공유는 전역 역할을 늘리지 않고, `employer` 사용자끼리 공고 단위 권한을 부여하는 방식으로 구현한다.

### 4.2 권한 매트릭스

| 기능 | owner | editor |
|---|---|---|
| 공고 목록/상세 보기 | 가능 | 가능 |
| 공고 본문 수정 | 가능 | 가능 |
| 공고 마감/재오픈 | 가능 | 가능 |
| 지원자 조회/읽음 처리 | 가능 | 가능 |
| 지원 확정/거절/취소 검토 | 가능 | 가능 |
| 근무기록/정산 조회 | 가능 | 가능 |
| 근무시간/정산 수정 | 가능 | 가능 |
| QR 생성/운영 | 가능 | 가능 |
| 공동 관리자 목록 조회 | 가능 | 가능 |
| 공동 관리자 초대 | 가능 | 불가 |
| 공동 관리자 제거 | 가능 | 불가 |
| 초대 회수 | 가능 | 불가 |
| 공고 삭제 | 가능 | 불가 |
| 소유권 이전 | v1 미지원 | v1 미지원 |
| employer 리뷰 작성 | 가능 | 불가 |

### 4.3 owner 전용으로 둔 이유

- 공유/회수는 사람과 권한 범위를 바꾸는 민감한 작업이다.
- 삭제는 회복 비용이 큰 파괴적 작업이다.
- 소유권 이전은 정산, 리뷰, 운영 책임 귀속까지 바꾸므로 v1에서 제외한다.

## 5. 식별자와 초대 방식

### 5.1 채택안

v1 초대 방식은 `정확한 전화번호 기반 타겟 초대`로 설계한다.

이유:

- 현재 코드베이스에는 일반 사용자 검색 API가 없다.
- 공개 검색형 UI는 닉네임/전화번호 존재 여부를 유출하기 쉽다.
- 링크형 초대는 전달/재전달 시 오수락 위험이 크다.
- 전화번호는 현재 가입/본인인증 흐름에서 이미 검증된 식별자다.

### 5.2 동작 방식

- owner가 상대 구인자의 전화번호를 입력한다.
- callable이 서버에서 전화번호를 정규화하고 `users`에서 정확히 1명인지 조회한다.
- 대상 사용자가 `role == employer`이고 활성 상태일 때만 invite를 생성한다.
- invite 생성 후 target user에게 알림을 보낸다.

### 5.3 보안 원칙

- raw phone number는 invite 문서에 저장하지 않는다.
- invite 문서에는 `targetUserId`와 UI 표시에 필요한 최소 snapshot만 저장한다.
- callable 응답은 계정 존재 여부를 과도하게 설명하지 않는다.
- owner가 자기 자신을 초대하는 행위는 금지한다.
- 이미 collaborator인 사용자에게 재초대하는 행위는 금지한다.

## 6. 데이터 모델 설계

## 6.1 `jobPostings/{postId}`

추가 필드:

```ts
{
  ownerId: string;
  manageableByIds?: string[]; // rollout 중 optional, 최종적으로 owner 포함 필수
}
```

규칙:

- `manageableByIds`는 owner를 반드시 포함한다.
- owner는 항상 첫 원소일 필요는 없지만, create 시점에는 `[ownerId]`로 생성한다.
- rollout 완료 후 canonical 문서에서는 필수 필드로 승격한다.

예시:

```ts
{
  id: "job-123",
  ownerId: "employer-owner",
  manageableByIds: ["employer-owner", "employer-editor-1", "employer-editor-2"]
}
```

설계 의도:

- `ownerId`는 법적/운영 책임의 기준값으로 유지한다.
- `manageableByIds`는 화면 접근, 내 공고 목록, Firestore Rules의 관리 권한 판별에 사용한다.

## 6.2 `jobPostings/{postId}/collaborators/{userId}`

새 subcollection:

```ts
{
  userId: string;
  permissionRole: "editor";
  status: "active" | "revoked";
  addedAt: Timestamp;
  addedBy: string; // owner uid
  acceptedAt: Timestamp;
  acceptedInviteId: string;
  revokedAt?: Timestamp;
  revokedBy?: string;
}
```

규칙:

- 문서 id는 collaborator `userId`로 고정한다.
- owner 정보는 여기 저장하지 않는다. owner는 top-level `ownerId`가 source of truth다.
- collaborator 프로필 표시는 `users/{uid}` 배치 조회로 보강한다.

설계 의도:

- array 하나만으로는 `언제 누가 추가했는지`를 추적하기 어렵다.
- UI에서 공동 관리자 목록과 추가 이력을 안정적으로 보여주기 위함이다.

### 협업 상태의 source of truth

이 설계에서 협업 상태는 아래 3층으로 분리한다.

- 권한 source of truth: `jobPostings.ownerId`, `jobPostings.manageableByIds`
- 메타데이터 projection: `jobPostings/{postId}/collaborators/{userId}`
- lifecycle history: `jobPostingInvites/{inviteId}`

원칙:

- Firestore Rules와 목록 query는 top-level `ownerId`, `manageableByIds`만 신뢰한다.
- collaborator subcollection은 UI 표시와 감사 목적의 projection이다.
- invite 문서는 초대 상태 이력이며, invite status만으로는 어떤 권한도 부여하지 않는다.
- callable transaction은 항상 top-level 권한 필드와 projection을 같은 트랜잭션 안에서 갱신한다.
- drift가 발생하면 권한 판별은 top-level 필드를 우선하고, projection은 repair job으로 복구한다.

repair 원칙:

- `manageableByIds`에 uid가 있는데 collaborator 문서가 없으면 degraded metadata로 재생성한다.
- collaborator 문서가 active인데 `manageableByIds`에 uid가 없으면 revoked로 정리한다.

## 6.3 `jobPostingInvites/{inviteId}`

새 root collection:

```ts
{
  jobPostingId: string;
  ownerId: string;
  targetUserId: string;
  permissionRole: "editor";
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  createdAt: Timestamp;
  expiresAt: Timestamp;
  respondedAt?: Timestamp;
  respondedBy?: string;
  revokedAt?: Timestamp;
  revokedBy?: string;
  jobPostingSnapshot: {
    title: string;
    workDate: string;
    locationName?: string;
  };
  ownerSnapshot: {
    name?: string;
  };
  targetSnapshot?: {
    name?: string;
    nickname?: string;
    maskedPhone?: string;
  };
}
```

규칙:

- root collection으로 둔다.
- target user의 초대함 조회가 쉬워야 하므로 `targetUserId` 기준 query가 가능해야 한다.
- 한 공고에서 한 사용자에게는 `pending` invite 1개만 허용한다.
- invite 문서는 권한 부여 source가 아니며, `accepted`만으로 접근 권한이 생기지 않는다.

운영 제한:

- invite 만료 기본값: 7일
- 공고당 active collaborator 최대 5명
- 공고당 pending invite 최대 10개

## 6.4 스키마 버전

이번 변경은 `schemaVersion: 3`을 유지한 상태에서 canonical contract를 확장하는 방식으로 진행한다.

이유:

- 전체 공고 도메인을 다시 버전업할 정도의 구조 변경은 아니다.
- 기존 `V3 canonical` 흐름과 serializer, functions trigger를 최대한 유지하는 편이 안전하다.

단, rollout 동안에는 `manageableByIds`가 없는 기존 문서를 owner-only로 해석하는 read compatibility가 필요하다.

## 6.5 기존 앱/serializer 호환성

이번 변경에서 가장 큰 배포 리스크는 `새 필드 추가` 자체보다 `기존 앱의 parse / write 방식`이다.

현재 코드 특성:

- job posting parser는 strict contract 성격이 강하다.
- `serializeJobPostingV3` 기반 update는 문서를 부분 patch가 아니라 사실상 canonical full replace로 다시 쓴다.
- 따라서 구버전 앱이 새 문서를 읽거나 저장하면 `manageableByIds` 같은 협업 필드를 누락시킬 수 있다.

필수 대응:

- 협업 기능 공개 전에 `manageableByIds`를 읽을 수 있는 compatibility app release를 먼저 배포한다.
- 같은 release에서 공고 update serializer가 협업 필드를 절대 드롭하지 않도록 보강한다.
- employer 쓰기 경로를 열어두는 상태에서 backfill을 먼저 수행하지 않는다.
- 구버전 employer 앱이 여전히 많이 남아 있는 동안에는 collaboration을 enable하지 않는다.

운영 권장:

- collaboration rollout 전 employer minimum supported version을 사실상 올린다.
- 강제 업데이트 체계가 없다면, store rollout + 운영 공지 + feature flag hold로 mixed-version 구간을 최소화한다.

## 7. 권한 판별 규칙

## 7.1 공고 문서 권한 helper

공통 helper 개념:

```ts
isJobPostingOwner(posting, uid)
hasJobPostingManageAccess(posting, uid)
hasJobPostingPermission(posting, uid, permission)
```

권장 규칙:

- `owner`: `posting.ownerId === uid`
- `editor`: owner가 아니면서 `manageableByIds.includes(uid)`
- `manage access`: owner이거나 `manageableByIds.includes(uid)`

## 7.2 서비스/저장소 용어 정리

현재 많은 메서드가 `ownerId` 파라미터 이름을 쓰지만 실제 의미는 `현재 작업자 uid`인 경우가 많다.

공유 기능 도입 후에는 다음 원칙으로 정리한다.

- `ownerId`: 문서의 canonical 소유자 값
- `actorId`: 현재 요청을 수행하는 사용자 uid
- `accessUserId`: 관리 권한 검증용 uid
- `collaboratorUserId`: 공동 관리자 식별 uid

추가 원칙:

- `manager`라는 단어는 legacy user role / staff role과 충돌하므로 새 컬렉션명, 함수명, 타입명에 쓰지 않는다.
- 공유 기능이 닿는 경로에서는 `ownerId`라는 파라미터 이름을 `actorId`, `accessUserId`, `collaboratorUserId`로 바꾸는 편이 안전하다.

## 8. 읽기/쓰기 동작 설계

## 8.1 내 공고 목록

현재:

- `ownerId` 기반 조회

변경:

- `getManagedJobPostings(userId, { status, scope })`
- query는 `manageableByIds array-contains userId`
- `scope`:
  - `all`
  - `owned`
  - `shared`

UI:

- `내 공고` 화면에 `전체 / 내가 만든 공고 / 공유받은 공고` 필터 추가
- 카드에 `소유`, `공동관리` 배지 표시

## 8.2 공고 상세 접근

현재:

- `job.ownerId !== currentUserId`면 강제 이탈

변경:

- `currentUserId`가 `manageableByIds`에 없으면 차단
- owner가 아니더라도 editor는 상세, 지원자, 정산, 편집 화면 접근 가능

## 8.3 공고 수정

현재 edit 화면은 서버 draft 컬렉션이 아니라 로컬 state 기반 편집 후 저장 구조다.

설계:

- 기존 공고 편집은 공동 관리자에게 그대로 허용한다.
- `jobPostingDrafts` 컬렉션은 v1에서 owner 전용 유지한다.
- 생성 화면의 임시저장은 공유 대상이 아니라 owner 개인 draft로 유지한다.

## 8.4 지원자/확정/취소 검토

변경:

- owner 비교를 `manage access` 비교로 바꾼다.
- `processedBy`, `reviewedBy`, confirmation history의 actor는 실제 작업자 uid를 기록한다.
- 단, workLog와 application의 canonical `ownerId`는 posting owner 값을 유지한다.

## 8.5 정산/근무기록

변경:

- 공동 관리자도 공고별 정산, 근무시간 수정, custom settlement를 수행할 수 있다.
- `modifiedBy` 등 actor 필드는 실제 공동 관리자 uid를 기록한다.
- workLog의 `ownerId`는 owner 값을 유지한다.

## 8.6 리뷰

v1에서는 owner-only 유지한다.

이유:

- 현재 review validator는 employer reviewer가 `workLog.ownerId`와 같아야 한다.
- 공동 관리자까지 employer reviewer로 열면 리뷰의 귀속 대상이 owner인지 editor인지 다시 정의해야 한다.

결론:

- shared editor는 리뷰 기능에서 employer reviewer로 취급하지 않는다.
- `usePendingReviews`의 employer-side ownerId 집계 로직도 v1에서는 변경하지 않는다.

## 8.7 전체 정산/집계 화면

현재 일부 경로는 `ownerId` 기반 cross-posting query를 사용한다.

공유 기능 도입 후에는 다음 규칙을 따른다.

- 공고별 화면은 `jobPostingId` 기반 조회를 사용한다.
- 전체 요약 화면은 먼저 `manageableByIds`로 관리 가능한 공고 id 목록을 구한다.
- 그 다음 공고 id 목록을 chunk query로 조회하거나 공고별 집계를 합산한다.

즉, `ownerId` 하나로 전체 employer workspace를 읽는 패턴은 공동 관리자 화면에서 점차 제거한다.

v1 추가 원칙:

- 공고별 운영 화면은 shared editor까지 지원한다.
- owner-wide 대시보드/통계는 즉시 전면 개편하지 않고, shared editor에게는 필요한 범위만 별도 제공한다.
- 예를 들어 `getStatsByOwnerId` 같은 owner 전용 요약은 v1에서 owner-only 유지 후, 추후 `getManagedWorkspaceStats`로 분리하는 편이 안전하다.

## 9. Functions 설계

민감한 공유 lifecycle은 client transaction이 아니라 callable이 담당한다.

## 9.1 새 callable

- `createJobPostingInvite`
- `acceptJobPostingInvite`
- `declineJobPostingInvite`
- `revokeJobPostingInvite`
- `removeJobPostingCollaborator`

선택:

- `resendJobPostingInvite`
- `listMyPendingJobPostingInvites`는 direct Firestore query로 충분하면 callable 생략

## 9.2 `createJobPostingInvite`

입력:

```ts
{
  jobPostingId: string;
  targetPhone: string;
}
```

서버 검증:

- 호출자 authenticated
- 호출자가 해당 공고 owner
- 공고 존재
- self invite 금지
- target phone 정규화
- target user 존재
- target user role이 `employer`
- target user 상태 active
- 이미 active collaborator인지 확인
- 기존 pending invite 중복 여부 확인
- collaborator 수와 invite 수 제한 확인
- 응답 메시지는 `해당 사용자를 초대할 수 없습니다` 수준으로 정규화해 계정 존재 여부를 과도하게 노출하지 않는다.

쓰기:

- `jobPostingInvites` pending 생성
- 대상 사용자 알림 생성

## 9.3 `acceptJobPostingInvite`

입력:

```ts
{
  inviteId: string;
}
```

서버 검증:

- 호출자 authenticated
- 호출자가 invite `targetUserId`
- invite status가 `pending`
- invite 미만료
- 공고 존재
- 호출자 role이 여전히 `employer`
- 이미 collaborator가 아닌지 재검증

쓰기 트랜잭션:

- invite `accepted`
- `jobPostings/{postId}`에 `manageableByIds arrayUnion(targetUserId)`
- `jobPostings/{postId}/collaborators/{targetUserId}` active 문서 생성
- owner에게 수락 알림 생성

## 9.4 `declineJobPostingInvite`

쓰기:

- invite `declined`
- owner에게 거절 알림 생성

## 9.5 `revokeJobPostingInvite`

owner만 가능.

쓰기:

- pending invite를 `revoked`로 업데이트
- target에게 회수 알림 생성

## 9.6 `removeJobPostingCollaborator`

owner만 가능.

쓰기 트랜잭션:

- `manageableByIds`에서 대상 uid 제거
- collaborator subcollection 문서를 `revoked`로 마킹
- 관련 pending invite 정리
- 대상에게 접근 회수 알림 생성

## 9.7 rate limit

기본 제안:

- invite 생성: 분당 5회
- 수락/거절: 분당 10회
- 제거/회수: 분당 10회

`functions/src/middleware/callableGuard.ts` 패턴을 재사용한다.

## 10. 알림 설계

알림은 편의 기능이지 core workflow source가 아니다.

원칙:

- 초대 수락/거절은 반드시 `초대함` 화면과 Firestore query만으로 완료 가능해야 한다.
- push 또는 notification type 누락으로도 핵심 초대 흐름이 막히면 안 된다.
- invite 관련 새 notification type은 compatibility app release가 먼저 배포된 뒤에만 서버에서 생성한다.
- 구버전 앱이 아직 많은 동안에는 invite inbox badge 또는 in-app polling만으로 운영하고, 새 notification type 발송은 hold할 수 있어야 한다.

신규 notification type 제안:

- `job_invite_received`
- `job_invite_accepted`
- `job_invite_declined`
- `job_access_revoked`

분류:

- category: `job`

링크 제안:

- invite received: `/notifications` 또는 `/(employer)/invites`
- accepted/declined: `/(employer)/my-postings/{id}/sharing`
- access revoked: `/notifications`

호환성 주의:

- 모바일 쪽 `NotificationType` enum, schema, category map, label, channel, template, deep link map이 모두 같은 릴리스에서 먼저 배포되어야 한다.
- 그렇지 않으면 새 type 알림 문서를 구버전 앱이 parse하지 못할 수 있다.

영향 파일:

- `uniqn-mobile/src/types/notification.ts`
- `uniqn-mobile/src/schemas/notification.schema.ts`
- `uniqn-mobile/src/constants/notificationTemplates.ts`
- `uniqn-mobile/src/shared/deeplink/NotificationRouteMap.ts`
- `functions/src/utils/notificationUtils.ts`

## 11. Firestore Rules 설계

## 11.1 helper 추가

새 helper 개념:

```rules
function hasPostingManageAccess(postingData) {
  return isAdmin() ||
    request.auth.uid == postingData.ownerId ||
    (
      ('manageableByIds' in postingData) &&
      postingData.manageableByIds is list &&
      postingData.manageableByIds.hasAny([request.auth.uid])
    );
}
```

rollout 중 fallback:

- `manageableByIds`가 없는 문서는 owner-only로 해석한다.

## 11.2 `jobPostings` 규칙

create:

- `ownerId == request.auth.uid`
- `manageableByIds == [request.auth.uid]`

update:

- 일반 공고 수정은 owner 또는 editor 가능
- 단 client update에서는 `ownerId`, `manageableByIds`, sharing metadata 변경 금지
- sharing lifecycle 변경은 callable Admin SDK에서 우회 처리

delete:

- owner 또는 admin만 가능

## 11.3 파생 컬렉션 접근 규칙

영향 컬렉션:

- `applications`
- `workLogs`
- `jobPostings/{postId}/workLogs`
- `jobPostings/{postId}/applications`
- `confirmedStaff`
- `workSessions`
- `attendance`
- `attendanceRecords`
- `eventQRCodes`
- 정산 관련 authoritative update 경로

원칙:

- owner 직접 비교를 `posting manage access` 비교로 치환한다.
- 단 canonical `ownerId` 필드는 그대로 유지한다.
- 공고별 QR, 출결, work session, attendance 계열까지 같은 helper를 공유해야 한다.

## 11.4 invite / collaborator 컬렉션 규칙

`jobPostingInvites`:

- read: owner, targetUserId, admin
- write: client 직접 쓰기 금지

`jobPostings/{postId}/collaborators/{userId}`:

- read: 해당 posting collaborator, owner, admin
- write: client 직접 쓰기 금지

## 11.5 `jobPostingDrafts`

v1에서는 owner-only 유지한다.

공동 관리자에게 draft 컬렉션 write를 열지 않는다.

## 12. 인덱스 설계

추가 인덱스 제안:

- `jobPostings`
  - `manageableByIds ARRAY_CONTAINS`, `status ASC`, `createdAt DESC`
  - 필요 시 `manageableByIds ARRAY_CONTAINS`, `createdAt DESC`
- `jobPostingInvites`
  - `targetUserId ASC`, `status ASC`, `createdAt DESC`
  - `ownerId ASC`, `status ASC`, `createdAt DESC`
  - `jobPostingId ASC`, `status ASC`, `createdAt DESC`

주의:

- `array-contains`와 orderBy가 함께 들어가는 query는 인덱스가 필요하다.

## 13. 클라이언트 구조 변경

## 13.1 타입/스키마

변경 대상:

- `uniqn-mobile/src/types/jobPosting.ts`
- `uniqn-mobile/src/schemas/jobPosting.schema.ts`
- `uniqn-mobile/src/domains/job-posting/serialization.ts`
- `uniqn-mobile/src/types/notification.ts`
- `uniqn-mobile/src/schemas/notification.schema.ts`
- `uniqn-mobile/src/config/env.ts`
- `functions/src/types/jobPosting.ts`

추가 타입 제안:

- `JobPostingInvite`
- `JobPostingCollaborator`
- `PostingManageScope = 'all' | 'owned' | 'shared'`
- `PostingManageRole = 'owner' | 'editor'`
- `FeatureFlags.enableJobPostingCollaboration`
- `FeatureFlags.enableJobPostingCollaborationNotifications`

## 13.2 서비스/저장소

신규 또는 개편 대상:

- `src/services/jobs/jobPostingSharingService.ts`
- `src/hooks/useJobPostingSharing.ts`
- `src/repositories/firebase/jobPosting/*`
- `src/repositories/firebase/application/*`
- `src/repositories/firebase/SettlementRepository.ts`
- `src/repositories/firebase/ConfirmedStaffRepository.ts`
- `src/services/work/settlement/*`

핵심 변경:

- `verifyOwnership` 계열 helper를 `verifyManageAccess`와 `verifyOwnerAccess`로 분리
- `getByOwnerId`에 더해 `getManagedByUserId` 추가
- ownerId 인자명을 actorId로 정리
- `queryClient`, `invalidationStrategy`의 ownerId 기반 query key도 manage scope 기준으로 재설계
- `serializeJobPostingV3`와 transaction update 경로는 collaboration fields를 절대 유실하지 않도록 보강

## 13.3 화면

추가/변경 제안:

- `app/(employer)/my-postings/index.tsx`
  - `전체 / 내가 만든 공고 / 공유받은 공고` 필터
- `app/(employer)/my-postings/[id]/_layout.tsx`
  - owner-only guard 제거, manage access guard로 교체
- `app/(employer)/my-postings/[id]/index.tsx`
  - 공동관리 요약 카드 진입점 추가
- `app/(employer)/my-postings/[id]/sharing.tsx`
  - 새 화면
- `app/(employer)/invites/index.tsx`
  - 내 초대함

UI 요소:

- 공동 관리자 수
- pending invite 수
- 초대 입력 modal
- collaborator 제거 confirm dialog
- `소유` / `공동관리` 배지
- owner-only action 비노출 또는 disabled + 이유 설명

## 14. 마이그레이션 전략

## 14.1 rollout 순서

### Phase 0. compatibility app release

- 앱 파서가 `manageableByIds`를 optional로 읽을 수 있게 배포
- 공고 serializer/update transaction이 collaboration fields를 보존하도록 배포
- notification enum/schema에 invite types를 미리 추가하되, 서버 발송은 아직 막아둔다
- feature flag는 off 유지

### Phase 1. read compatibility on server/rules

- 앱과 rules에서 `manageableByIds` 미존재 문서를 owner-only로 해석
- serializer는 새로 생성하는 공고부터 `manageableByIds: [ownerId]`를 기록

### Phase 2. adoption / minimum version 확인

- employer compatibility release 보급률을 확인한다.
- 구버전 employer 앱이 협업 필드를 덮어쓸 위험이 충분히 낮아질 때까지 backfill과 collaboration enable을 보류한다.
- 강제 업데이트가 가능하면 이 구간에서 minimum supported version을 올린다.

### Phase 3. 데이터 backfill

- 기존 모든 `jobPostings` 문서에 `manageableByIds: [ownerId]` backfill
- 실패 문서는 별도 로그로 남김
- 필요하면 collaborator projection repair job도 함께 준비한다

### Phase 4. rules / functions 배포

- invite callable과 read helpers 배포
- 초대/수락 lifecycle 배포
- invite 알림 type은 아직 운영 플래그로 제어한다

### Phase 5. client UI 공개

- feature flag off 상태로 코드 배포
- 운영에서 backfill/인덱스 완료 확인
- `enable_job_posting_collaboration` 활성화

### Phase 6. strict contract 전환

- rollout 안정화 후 `manageableByIds`를 canonical required field로 승격
- fallback owner-only 해석 제거 검토
- invite notification type 정식 발송 전환

## 14.2 feature flag

새 플래그 제안:

- `enable_job_posting_collaboration`
- `enable_job_posting_collaboration_notifications`

용도:

- UI 노출 제어
- callable 진입 보호
- 점진 배포와 rollback 단순화

구현 권장:

- 정적 env flag와 Remote Config flag를 함께 둔다.
- 최종 유효값은 `env.features.enableJobPostingCollaboration && remoteConfig(enable_job_posting_collaboration)` 형태로 계산한다.
- notification 발송도 별도 플래그로 분리해 mixed-version 구간에 독립적으로 hold 가능하게 한다.

## 15. 테스트 전략

## 15.1 mobile unit / integration

- job posting schema parse with `manageableByIds`
- serialization create/update contract
- old document + new document mixed parse
- list filter `owned/shared/all`
- route guard
- applicant management by editor
- settlement mutation by editor
- invite hooks optimistic/invalidation
- notification type compatibility

## 15.2 repository tests

- `verifyManageAccess`
- `getManagedByUserId`
- editor update allowed, delete denied
- cancellation request query by editor
- confirmed staff mutation by editor
- full replace update가 collaboration fields를 유지하는지 확인

## 15.3 functions tests

- owner can create invite
- non-owner cannot create invite
- self invite rejected
- target not employer rejected
- duplicate pending invite rejected
- accept adds `manageableByIds`
- revoke removes access
- expired invite cannot be accepted
- invite accepted but projection write 실패 시 transaction 전체 rollback
- remove/revoke 동시 실행 시 최종 상태 일관성

## 15.4 Firestore emulator rules tests

- editor can read/update posting
- editor cannot delete posting
- editor can read applications/workLogs/settlements for shared posting
- editor can access QR/attendance/workSessions for shared posting
- removed editor loses access immediately
- invite docs are readable only by owner/target/admin
- collaborator docs are client-write 금지
- `manageableByIds` 없는 legacy posting은 owner-only로 동작

## 16. 운영/감사 고려사항

- invite lifecycle는 반드시 server log를 남긴다.
- 공유/회수는 추후 CS 대응을 위해 invite 문서를 soft status로 남긴다.
- 과거 actor 이력은 지우지 않는다.
- posting 삭제 시 관련 invite/collaborator 문서는 scheduled cleanup 대상으로 정리한다.

계정 상태 변화 대응:

- collaborator가 `employer`가 아니게 되거나 `inactive/suspended/deleted` 상태가 되면 접근을 자동 회수한다.
- user lifecycle trigger 또는 scheduled repair job으로 `manageableByIds`와 collaborator projection을 정리한다.
- owner 계정 상태 변화는 별도 운영 정책이 필요하며, v1에서는 owner transfer 없이 관리자 개입 대상으로 둔다.

운영 도구:

- drift 감지용 admin repair script 또는 scheduled repair job을 둔다.
- repair 결과는 로그와 metrics로 남겨 backfill 이후 이상치를 추적한다.

## 17. 주요 트레이드오프

### 17.1 `ownerId` 유지

장점:

- 기존 도메인과 공개 공고 흐름을 덜 흔든다.
- workLog/application/notification의 기존 책임 귀속이 유지된다.

단점:

- 공동 관리자 작업과 owner 귀속이 분리되므로 actor 필드를 더 신경 써야 한다.

### 17.2 전화번호 기반 타겟 초대

장점:

- 공개 검색 UI 없이 안전하게 시작할 수 있다.
- 정확한 대상 지정이 가능하다.

단점:

- owner가 상대 구인자의 전화번호를 알아야 한다.

### 17.3 리뷰를 owner-only로 유지

장점:

- 기존 review 모델과 평판 귀속을 깨지 않는다.

단점:

- 공동 관리자가 모든 employer-side 운영 행위를 완전히 대신하진 못한다.

### 17.4 권한 인덱스와 projection의 중복

장점:

- 목록 query와 Rules 판별이 단순해진다.
- collaborator UI와 감사 로그를 안정적으로 제공할 수 있다.

단점:

- `manageableByIds`, collaborator subcollection, invite history 사이의 drift 가능성이 생긴다.
- repair job, reconciliation 정책, 추가 write 비용이 필요하다.

### 17.5 mixed-version rollout 비용

장점:

- 안전한 점진 배포가 가능하다.

단점:

- 호환 릴리스, backfill, 플래그 운영, 최소 버전 관리까지 필요해 출시 준비 비용이 커진다.

## 18. 구현 우선순위

P0:

- compatibility app release
- `manageableByIds`
- collaboration field preserving serializer
- manage access guard
- invite callable
- accept/decline/revoke/remove
- applicant/settlement 권한 확장
- rules

P1:

- 내 공고 필터 `owned/shared`
- 초대함 화면
- 알림 deep link
- QR/attendance/workSessions manage access 확장

P2:

- owner activity log
- collaborator별 최근 작업 표시
- owner transfer
- 공개 링크 초대 대안 검토

## 19. 최종 권장안

바로 구현에 들어갈 때의 권장 순서는 아래와 같다.

1. compatibility app release에서 parser / serializer / notification enum을 먼저 준비
2. `jobPostings` read contract에 `manageableByIds` compatibility 추가
3. `getManagedJobPostings`와 manage access guard 도입
4. sharing callable과 invite / collaborator collection 추가
5. applicant / settlement / confirmed staff / QR / attendance 권한을 manage access 기준으로 전환
6. rules / indexes / backfill / repair 도구 적용
7. `enable_job_posting_collaboration` 플래그 아래 UI 공개

이 방식이면 현재 코드 구조를 가장 덜 깨면서도, owner 중심 공고 모델을 유지한 채 `다른 구인자와 같이 관리` 요구를 충족할 수 있다.

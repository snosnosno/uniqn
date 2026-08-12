# Workspace 탭 이전 — 설정센터에서 내 공고/프로필 탭으로

- **작성일**: 2026-05-09
- **상태**: 디자인 승인 (구현 대기)
- **범위**: UNIQN Mobile (`uniqn-mobile/`)
- **배경**: 설정센터의 "공고협업/워크스페이스/받은 초대" 3개 항목을 도메인 컨텍스트에 맞춰 재배치하고, 워크스페이스 가드를 employer role 기반에서 멤버십 기반으로 재설계.

## 문제 정의

### 현재 상태의 비대칭

설정센터(`app/(app)/settings/index.tsx:310-330`)에 "공고협업" 섹션 3개 항목이 employer 조건부로 노출되며, 클릭 시 `/(employer)/workspace*` 경로로 진입한다. 그러나 다음과 같은 비대칭이 존재한다:

1. **라우트 가드 vs 데이터 모델 불일치**
   - `(employer)/_layout.tsx:90-92` 가드는 `hasEmployerRole=false`인 사용자를 즉시 홈으로 redirect
   - 그러나 데이터 모델(`useInviteWorkspaceMember`의 `inviteeUserId`)은 staff 초대를 막지 않음
   - 최근 PR #63, #64에서 `work_logs` / `event_qr_codes` RLS에 workspace 멤버 분기가 추가됨 → staff도 워크스페이스 멤버가 되는 모델로 진화 중
   - `RouteRegistry.ts:118-120`의 workspace 경로들은 `AUTH_REQUIRED_ROUTES`에만 포함, `EMPLOYER_REQUIRED_ROUTES`에는 미포함 — 의도와 실 가드 불일치

2. **staff 발견성 부재**
   - staff가 워크스페이스 초대를 받은 시점에는 아직 멤버가 아니므로 employer 가드에 막힘
   - push notification(`WORKSPACE_INVITATION`)으로 deep link 진입 시도해도 `(employer)` 가드가 차단
   - "내 공고" 탭은 staff에게 NonEmployerView(구인자 등록 유도)만 보여주므로 워크스페이스 컨텍스트 부재

3. **진입점 분산**
   - 워크스페이스 관리 / 공고협업 / 받은 초대가 설정센터 안에서 평면적으로 나열
   - 각 항목이 독립 메뉴로 보이지만 실질적으로 동일한 워크스페이스 도메인의 다른 측면

## 결정사항

### D1: 워크스페이스 멤버십은 employer + staff 모두 허용

이번 리팩토링의 핵심 전제. workspace_members 테이블에 staff role도 멤버로 들어갈 수 있다고 본다 (최근 RLS 분기 작업이 이를 시사). 따라서 모든 가드는 role 기반이 아니라 **멤버십 기반** 또는 **인증만 필요**의 두 단계로 단순화한다.

### D2: 진입점은 두 곳, 도착지는 한 곳

- **employer 진입점**: "내 공고" 탭 본문 카드 (employer가 자기 워크스페이스를 자주 관리)
- **staff 진입점**: 프로필 탭 "커뮤니티" 메뉴 아래 "워크스페이스" 항목 (staff는 멤버십 기반 access)
- **도착지**: `/(app)/workspace` — 동일 화면, 멤버십 상태에 따라 본문 분기

### D3: 받은 초대는 별도 탭 진입점으로 두지 않음

받은 초대 화면은 워크스페이스 화면 헤더 우측 봉투 아이콘으로만 진입. 이유:
- 받은 초대 자체가 "워크스페이스 도메인의 한 측면"이지 독립 도메인 아님
- 메뉴/탭에 별도 카운터 뱃지가 떠있는 형태는 노이즈 — 워크스페이스 들어왔을 때 발견하면 충분
- staff (멤버 0, 초대 N건)인 경우 빈 상태 화면에 골드 CTA로 강조하므로 발견성 확보

### D4: settings 항목 전부 제거

설정센터에서 "공고협업" 섹션 3개 항목 모두 제거. 부분 유지 안 함 — 진입점이 분산되면 사용자 혼란.

## 라우트 구조 변경

### 현재

```
app/(app)/settings/index.tsx              ← "공고협업" 섹션 (employer 조건부)
  ├ → /(employer)/workspace
  ├ → /(employer)/workspace/invite
  └ → /(employer)/workspace/invitations

app/(employer)/_layout.tsx                ← hasEmployerRole 가드 + WorkspaceRevocationGuard
app/(employer)/workspace/
  ├ index.tsx
  ├ invite.tsx
  └ invitations.tsx
```

### 변경 후

```
app/(app)/workspace/                      ← (employer) → (app) 폴더 통째 이동
  ├ _layout.tsx (신규)                    ← Stack + WorkspaceRevocationGuard
  ├ index.tsx                             ← 헤더 우측 봉투 아이콘 + Empty State 분기
  ├ invite.tsx                            ← (owner only — 화면 내부 가드)
  └ invitations.tsx                       ← 인증만 필요 (멤버십 무관)

app/(app)/(tabs)/employer.tsx             ← ListHeaderComponent로 워크스페이스 카드
app/(app)/(tabs)/profile.tsx              ← "커뮤니티" 메뉴 아래 "워크스페이스" 추가
app/(app)/settings/index.tsx              ← "공고협업" 섹션 통째 제거
app/(employer)/_layout.tsx                ← workspace 관련 hook 제거 (다른 employer 화면 가드는 유지)
```

## 가드 재설계

### Layout 레벨 가드

| 라우트 | 가드 |
|--------|------|
| `(app)/_layout.tsx` | 인증 (기존) |
| `(app)/workspace/_layout.tsx` (신규) | 인증 (상위 가드 통과 가정) + WorkspaceRevocationGuard 마운트 |
| `(employer)/_layout.tsx` | hasEmployerRole 유지 (workspace 외 화면용) |

### 화면 레벨 분기

`(app)/workspace/index.tsx`:

```
useActiveWorkspace().workspaces.length === 0
  ├ true  → Empty State (받은 초대 N건 CTA 또는 회색 안내문)
  └ false → 기존 멤버 관리 UI
```

`(app)/workspace/invite.tsx`:
- owner 여부 체크 (활성 워크스페이스 ownerId === currentUserId)
- 화면 내부에서 비-owner는 `Redirect` 또는 안내 메시지

`(app)/workspace/invitations.tsx`:
- 가드 없음 (인증만 통과하면 진입)

### WorkspaceRevocationGuard 이동

현재 `(employer)/_layout.tsx:32-54`에서 활성 워크스페이스 멤버십 회수 감지 → `WorkspaceRevocationModal` + 5초 자동 로그아웃. 이 로직을 `(app)/workspace/_layout.tsx`로 이동한다.

이유:
- staff도 멤버가 될 수 있는 새 모델에서, 회수 감지는 employer 가드가 아니라 워크스페이스 컨텍스트에서 동작해야 함
- (app) 전체 레이아웃에 두면 워크스페이스 무관 화면(공고 둘러보기 등)에서도 모달이 떠 UX 부담

## UI 진입점 명세

### 진입점 A: "내 공고" 탭 본문 카드

위치: `(tabs)/employer.tsx`의 공고 리스트 ListHeaderComponent.

```
┌─────────────────────────────────────────────┐
│ [Building 24px] 워크스페이스         [3] [›] │
│                 멤버 3명 · {활성 ws 이름}    │
└─────────────────────────────────────────────┘
```

- 좌측 아이콘: `Building` (Lucide 24px stroke 2.0 — 프로필 메뉴 진입점과 동일 아이콘으로 일관성 확보)
- 메인 라벨: "워크스페이스" (`text-base font-sans-semibold`)
- 보조 라인: "멤버 N명 · {활성워크스페이스이름}" (`text-sm text-content-secondary`, `numberOfLines=1` ellipsis)
- 우측 카운트 뱃지: 받은 초대 N≥1일 때만 (`bg-gold` + `text-on-gold`)
- chevron-right
- Pressed: `dark:bg-surface-hover` (Impeccable Rule 21 — 다크 밝아짐 방향)
- min-h-[64px] (Rule 5 — 터치 44px+)
- onPress → `router.push('/(app)/workspace')`

### 진입점 B: 프로필 탭 메뉴 항목

`profile.tsx:188-191` "커뮤니티" 항목 바로 아래에 추가:

```tsx
<Divider spacing="sm" />
<MenuItem
  icon={<BuildingIcon size={22} color={SECONDARY_PALETTE[500]} />}
  label="워크스페이스"
  onPress={() => router.push('/(app)/workspace')}
/>
```

기존 MenuItem 패턴 그대로 — 별도 디자인 작업 없음. 받은 초대 카운트는 메뉴에 표시 안 함 (워크스페이스 화면 봉투 아이콘에서 노출).

### 진입점 C: 워크스페이스 화면 헤더 우측 봉투 아이콘

```
┌─────────────────────────────────────────────┐
│ ‹ 워크스페이스                          ✉ ⊙3│
└─────────────────────────────────────────────┘
```

- 아이콘: `MailIcon` 24px stroke 2.0
- 받은 초대 0건이면 봉투만 (`SECONDARY_PALETTE[500/400]`)
- 받은 초대 N≥1이면 우상단 골드 dot 또는 mini 카운트 뱃지 (`bg-gold`, 8~10px)
- `hitSlop={10}` + 시각 24px = 터치 44px (Rule 5)
- `accessibilityRole="button"` + `accessibilityLabel={`받은 초대 ${count}건`}`
- onPress → `router.push('/(app)/workspace/invitations')`

### Empty State (멤버십 0 시 본문)

```
┌─────────────────────────────────────────────┐
│                                             │
│           [BuildingIcon 32px]                │
│                                             │
│      아직 속한 워크스페이스가 없어요          │
│                                             │
│   구인자가 초대하면 함께 공고를 관리할 수     │
│            있어요                            │
│                                             │
│   ┌──────────────────────────┐               │
│   │   초대 3건 확인하기        │ ← N≥1일 때만 │
│   └──────────────────────────┘               │
│                                             │
└─────────────────────────────────────────────┘
```

- Impeccable Rule 9 (인지 + 가치 + 행동) 3단 구성
- CTA는 받은 초대 N≥1일 때만 골드, 아니면 회색 안내문 "구인자에게 초대를 요청해보세요"
- CTA 도착지: `router.push('/(app)/workspace/invitations')` (헤더 봉투 아이콘과 동일)
- 헤더 봉투 아이콘은 그대로 노출 (Empty State CTA와 동일 도착지지만 일관성 우선)

## 데이터 흐름 / Push Notification

```
[FCM/APNs WORKSPACE_INVITATION]
  → src/services/notifications/NotificationRouteMap.ts:121-124
     { name: 'workspace/invitations' }
  → src/utils/route/RouteMapper.ts (1줄 갱신)
     '(employer)/workspace/invitations' → '(app)/workspace/invitations'
  → (app)/_layout.tsx 인증 가드만 통과 (employer 가드 없음)
  → invitations.tsx 렌더 → 사용자 수락
  → workspace_members INSERT (owner가 보낸 초대)
  → useActiveWorkspace cache invalidate
  → 다음 진입 시 자동으로 멤버 관리 모드
```

핵심: **deep link가 employer 가드를 더 이상 통과하지 않으므로 staff도 정상 진입**.

## 마이그레이션 순서 (단일 PR, 커밋 분할)

1. `git mv app/(employer)/workspace app/(app)/workspace` — 파일 이동
2. `app/(app)/workspace/_layout.tsx` 신설 — Stack + WorkspaceRevocationGuard
3. `app/(employer)/_layout.tsx` 정리 — workspace 관련 hook 제거 (hasEmployerRole 가드 유지)
4. `app/(app)/settings/index.tsx:310-330` — "공고협업" 섹션 통째 제거
5. `app/(app)/(tabs)/employer.tsx` — 워크스페이스 카드 컴포넌트 ListHeaderComponent로 추가
6. `app/(app)/(tabs)/profile.tsx` — "커뮤니티" 메뉴 아래 "워크스페이스" MenuItem 추가
7. `app/(app)/workspace/index.tsx` — 헤더 우측 봉투 아이콘 액션 + Empty State 분기 추가
8. `src/utils/route/RouteMapper.ts` — workspace/invitations 매핑 경로 1줄 갱신

`RouteRegistry.ts` 변경 없음 (이미 `EMPLOYER_REQUIRED_ROUTES`에 미포함).

## 검증 체크리스트

### 라우트 / 가드
- [ ] employer (멤버 1+) → 내 공고 탭 카드 → 워크스페이스 멤버 관리 진입
- [ ] staff (멤버 0, 초대 3건) → 프로필 → 워크스페이스 → 빈 상태 + 골드 CTA → 받은 초대 → 수락 → 자동 멤버 관리 모드
- [ ] staff (멤버 0, 초대 0) → 프로필 → 워크스페이스 → 빈 상태 + 회색 안내문 (CTA 없음)
- [ ] 인증 안 된 상태 push deep link → `(auth)/login` → 로그인 후 받은 초대 화면 자동 복원
- [ ] 멤버 회수 시나리오 — `WorkspaceRevocationModal` + 5초 자동 로그아웃 (새 위치에서 동일 동작)

### 진입점 leftover 검증
- [ ] `settings/index.tsx`에 "공고협업" / "워크스페이스" / "받은 초대" 검색 결과 0건
- [ ] 코드베이스 grep `(employer)/workspace` 참조 → `RouteMapper` 외 0건
- [ ] `e2e/tests/p0-critical/rbac-access.spec.ts` — staff가 새 `(app)/workspace` 접근 가능

### Push Notification
- [ ] WORKSPACE_INVITATION 알림으로 진입 시 받은 초대 화면 도달 (앱 cold start / warm start 양쪽)
- [ ] staff 계정으로 push 진입 → employer 가드 차단 없이 정상 도달

## 위험 요소 / 미확정

| 항목 | 위험 | 대응 |
|------|------|------|
| `create_workspace` RPC 자동 호출 시점 (PR #69) | employer 신규 가입 / staff에서 employer 승격 시 자동 생성되는지 미확인 | 구현 단계에서 가입 service 확인 후 결정. Empty State 노출 빈도에 영향 |
| iPad/외부 키보드 focus ring | 봉투 아이콘 헤더 액션은 focus ring 누락 가능 | Impeccable Rule 22 outset ring 패턴 적용 |
| 회수 가드 이동 후 staff 회수 시나리오 | `useWorkspaceRevocationGuard`가 employer 가정으로 짜여 있을 가능성 | 시그니처/구현 검증 + e2e 케이스 추가 |
| settings 외부 진입점 (공유 링크 등) | 외부 문서/공지에 `(employer)/workspace` 참조 가능성 | RouteMapper에 구 경로 → 신 경로 alias 1주일 유지 후 제거 (선택) |

## 참고

- 관련 메모리: `feedback_localhost_dev_production_db.md` — 머지 전 검증 최단 경로 (localhost dev = master + prod DB)
- 관련 PR: #63 (work_logs RLS workspace 분기), #64 (event_qr_codes RLS workspace 분기), #67 (workspace_members publication), #68 (mapWorkspaceRpcError 다중 원인), #69 (create_workspace SECURITY DEFINER RPC)
- Impeccable 디자인 룰: 5(터치 44px), 9(빈 상태), 21(Pressed 역방향), 22(Focus ring), 27(아이콘)

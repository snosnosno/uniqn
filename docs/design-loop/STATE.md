# UI/UX 일관성 루프 — 상태 장부

> 매 회차 시작 시 이 파일을 읽고, 종료 시 갱신한다. 상태: `pending` → `in-progress` → `done` / `deferred`

## 배치 현황

| 배치 | 영역 | 화면 (uniqn-mobile/app/ 기준) | 상태 | 커밋 |
|---|---|---|---|---|
| A | 인증·공개·루트 | `(auth)/login` `(auth)/signup` `(auth)/forgot-password` `(public)/jobs/index` `jobs/index` `jobs/[id]`(공개 alias) `index`(splash) `+not-found` | pending | |
| B | 탭 코어 | `(tabs)/home-jobs` `(tabs)/schedule` `(tabs)/qr` `(tabs)/employer` `(tabs)/_layout` `(app)/home` + TabHeader | pending | |
| C | 게시판 | `(tabs)/board/index` `[boardType]` `write` `edit/[postId]` `post/[postId]` | pending | |
| D | 공고·지원 플로우 | `(app)/jobs/[id]/index` `(app)/jobs/[id]/apply` `applications/[id]/cancel` | pending | |
| E | 리뷰·공지 | `reviews/write` `reviews/[workLogId]` `reviews/pending` `reviews/history` `notices/index` `notices/[id]` | pending | |
| F | 지원센터·알림 | `support/faq` `support/create-inquiry` `support/my-inquiries` `support/inquiry/[id]` `notifications` | pending | |
| G | 설정·프로필 | `settings/profile` `settings/change-password` `settings/my-data` `settings/business-info` `profile-setup` (약관 4종은 레이아웃만 — 본문 금지) | pending | |
| H | 구인자 등록 | `employer-register` `employer-application-status` | pending | |
| I | 구인자 공고관리 | `(employer)/my-postings/create` `[id]/edit` `[id]/applicants` `[id]/settlements` `[id]/collaborators` `[id]/cancellation-requests` | pending | |
| J | 워크스페이스 | `(employer)/workspace/index` `invite` `invitations` `archived` | pending | |
| K | 관리자 1 | `(admin)/index` `announcements/*`(4) `stats` `tournaments` | pending | |
| L | 관리자 2 | `(admin)/reports/*` `board-reports/*` `inquiries/*` `users/*` `employer-applications/*` | pending | |
| M | 공용 컴포넌트 | `src/components/` 버튼·카드·모달·EmptyState·Skeleton·배지·토스트 + 토큰 정합 | pending | |
| W | 지갑 | `(app)/wallet/*` — master에 없음 (`fix/wallet-p1-money-and-ui` 머지 후) | **deferred** | |
| Z | 최종 횡단 패스 | 화면 간 통일 검증 + 전체 jest + quality | pending | |

## 발견·수정 로그

> 형식: `- [배치] P1/P2 | 화면 | 증상 → 조치 (커밋)`

(아직 없음)

## P3 백로그 (기록만, 구현 안 함)

> 형식: `- [배치] 화면 | 제안 | 근거`

(아직 없음)

## 회차 메모

> 다음 회차에 넘길 주의사항·미완 항목

(아직 없음)

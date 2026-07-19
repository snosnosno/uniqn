# "지금" 레인 개선 — 설계 스펙 (공유 신뢰성 · 용어 · 진입점)

> 작성: 2026-07-17 · 상태: 사용자 검토 대기
> 배경: 세 기능(공유·워크스페이스·주간그리드) 통합 개선 보드의 "지금" 레인.
> 자정 근무시간(같은 레인)은 별도 스펙/계획으로 분리 완료 → 본 문서는 나머지 3영역.
> 실측 근거: 본 세션 병렬 감사 2건(OG 서버 주입 경로 / 공유가드·진입점·용어), 전부 파일:라인 실측.

## 0. 범위 — 3 PR

| PR | 영역 | 성격 | 배포 게이트 |
|---|---|---|---|
| **PR-1** | 공유 신뢰성 = ①`canShareJob` 가드 ②OG 미리보기 Function | 클라이언트 + 인프라 | OG는 CF env·배포 사용자 게이트 |
| **PR-2** | 용어 교정(개발자 어휘 → 자연어) | 문자열 전용 | 없음(제로 리스크) |
| **PR-3** | 진입점 통일(설정·배너 → 내 공고 탭 ⋯ 메뉴) | 클라이언트 IA | 없음 |

**비목표(이번 스코프 밖)**: "워크스페이스"→"사업장" 개명(isSolo 숨김과 얽힘, 다음 레인), 공고 대표이미지 업로드 UI(`og_image_url` 채우기), isSolo 적응형 표면, 홈 스트립.

---

## PR-1 공유 신뢰성

### 1A. canShareJob 가드 (클라이언트)

**문제**: 공유 진입점 7곳 중 실질 방어는 상세 2곳(페이지 전체 에러의 부수효과)·create-success 1곳(명시)뿐. 목록 카드 2곳·관리 허브 1곳·지원자 0명 CTA 1곳은 **승인 대기 대회 공고를 그대로 공유** → 수신자는 "승인 대기 중인 공고입니다" 죽은 화면. `useShare.ts`는 상태를 전혀 검사하지 않음(무조건 공유).

**결정**:
- `src/domains/job-posting/approvalGate.ts`에 `canShareJob(posting): boolean` 추가(`isTournamentApprovalBlocked` 옆, 같은 SSOT).
- 로직: `canShareJob = BROWSABLE_POSTING_STATUSES.includes(posting.status) && !isTournamentApprovalBlocked(posting)`
  - `BROWSABLE_POSTING_STATUSES`(`src/domains/job-posting/constants.ts:15-18` = `['active','capacity_full']`) 재사용 → draft/pending/closed/cancelled/expired/rejected/container 전부 공유 차단.
  - 승인 대기 대회(pending tournament)도 함께 차단(fail-closed).
- **호출은 `useShare.ts` `runJobShare` 진입부 한 곳** → 7개 진입점 자동 방어. 차단 시 `toast`로 사유 안내 후 `{ success:false }` 반환(공유 시트 안 뜸).
- `shareJobById`(id만 아는 카드 경로)는 job 재조회 후 동일 검사. 조회 실패 시 기존 에러 처리 유지.
- 순수 함수이므로 UI 조건부 렌더(버튼 비노출)에도 재사용 가능 — 단 이번 PR은 **useShare 단일 게이트**만 필수, 버튼 비노출은 선택(후속).

**리스크**: `capacity_full`은 공유 허용(정원 마감이어도 페이지 유효). `closed`는 차단 — "마감된 공고" 페이지가 뜨긴 하나 공유 가치 없고 혼란 소지라 차단이 맞음.

### 1B. OG 미리보기 Function (인프라)

**문제**: `/jobs/{id}`가 `_redirects` catch-all로 SPA(`index.html`) 폴백 → 카톡/메신저 크롤러가 제목·썸네일 없는 맨 URL로 표시. Expo 웹은 `expo export -p web` 정적 산출물이라 `+html.tsx`로 공고별 동적 메타 불가(이미 같은 이유로 거부 전례 `_headers:49-51`).

**결정**:
- **Cloudflare Pages Function** `uniqn-mobile/functions/jobs/[id].ts` 신설.
  - `functions/`는 `tsconfig.json:47-52`에 이미 exclude 예비 → 메인 타입체크 무충돌. wrangler가 루트 `functions/` 자동 배포 → `scripts/deploy-cloudflare.js` 흐름 무변경.
- 동작:
  1. UA 판별 — 크롤러(kakaotalk-scrap, facebookexternalhit, Twitterbot, Discordbot, Slackbot 등)면 OG HTML, 아니면 정적 자산 패스스루(`env.ASSETS.fetch(request)`).
  2. 크롤러면 PostgREST `fetch`로 `job_postings` 단건 조회(anon key, `select=title,location,compensation,salary_daily_max,work_date,status,postingType,tournamentConfig,og_image_url`).
  3. `canShareJob` 규칙과 동일한 상태 필터 — 공유 불가 상태면 일반 브랜드 OG(공고 정보 없이 "UNIQN 공고")로 폴백(죽은 공고의 상세 메타 노출 방지).
  4. og:title = `{제목} · {역할/급여 요약}`, og:description = `{위치} · {날짜}`, og:image = `og_image_url ?? 정적 브랜드 이미지`. og:url, twitter:card=summary_large_image.
  5. **모든 사용자 입력값(title 등) HTML 이스케이프 필수**(XSS — 공고 title은 사용자 입력).
  6. 본문에 즉시 SPA로 이동하는 `<script>location.replace(...)` (크롤러는 무시, 실수로 크롤러 아닌데 걸린 사용자 구제).
- anon SELECT는 회귀 테스트(`supabase/tests/job_postings_anon_public_select.test.sql`)로 보증 → RLS 변경 없음.

**배포 게이트(사용자)**:
- `SUPABASE_URL`·`SUPABASE_ANON_KEY`(공개값)를 Cloudflare Pages **대시보드 환경변수** 또는 `wrangler.toml [vars]`에 등록. anon key는 공개값이라 커밋 가능하나 대시보드 등록이 깔끔.
- 배포 후 실측: (a) 크롤러 UA(`curl -A "facebookexternalhit"`)로 OG 태그 반환 확인, (b) 일반 UA로 SPA 정상 로드 확인, (c) `_redirects` 우선순위 문제 시에만 `/jobs/*` 예외 라인 추가.

**비목표**: `og_image_url` 채우는 업로드 UI·Storage 정책(dormant 컬럼, 후속).

---

## PR-2 용어 교정 (문자열 전용)

**문제**: 개발자 어휘가 사용자 노출 문자열로 유출("배치 슬롯을 수정했어요" 토스트의 '슬롯' 등).

**결정**: 아래 교정표를 일괄 적용. **"워크스페이스"→"사업장"은 제외**(isSolo와 얽힘). "그리드/슬롯/풀/운영처/목표인원/배치"만 자연어로.

| 현재 (실측) | 파일:라인 | 제안 |
|---|---|---|
| 주간 배치 그리드 | `employer.tsx:327,329` · `weekly-grid.tsx:223` · weeklyGrid 배럴 주석 | **이번 주 근무표** |
| 풀 꽂기 | `AddSlotSheet.tsx:246` | **스태프 추가** |
| "배치 슬롯을 수정했어요" | `EditSlotSheet.tsx:218` | **근무 일정을 수정했어요** |
| 배치 빼기 / 배치 편집 | `EditSlotSheet.tsx:270,299,323,346` | **근무 빼기 / 근무 수정** |
| "이 인원 / 배치에서 뺄까요" | `EditSlotSheet.tsx:326` | **근무에서 뺄까요** |
| 운영처 만들기 / 운영처가 없어요 / 운영처 이름 | `weekly-grid.tsx:269-271` · `VenueCreateSheet.tsx` | **지점** (지점 만들기 / 지점이 없어요 / 지점 이름) |
| 목표 인원 (softTarget UI) | `VenueDayPanel.tsx` | **필요 인원** |
| 배치 확인 알림 | 주간 액션 버튼 | **출근 확인 요청** |
| "이 날 배치된 인원이 없어요" | `VenueDayDetail.tsx:111-113` | **이 날 근무 인원이 없어요** |
| "인원 배치하기" | `VenueDayDetail.tsx:113` | **근무 추가하기** |

**적용 규칙**:
- 화면 문자열(Text·title prop·placeholder·accessibilityLabel·toast)만 교정. 변수명·주석·테스트 픽스처는 불변(코드 안 개념어 유지).
- accessibilityLabel도 함께 교정(스크린리더 일관).
- 구현 시 전수 grep으로 잔여 지점 청소(`주간 배치 그리드`·`풀 꽂기`·`배치 슬롯`·`운영처`·`목표 인원`).
- 기존 테스트가 옛 문구를 assert하면 새 문구로 갱신.

**리스크**: 제로(문자열만). 단 `getByText('배치 빼기')` 같은 테스트 셀렉터가 깨지므로 테스트 동반 수정 필수.

---

## PR-3 진입점 통일

**문제**: 워크스페이스 진입점 3곳 분산 — ①홈 탭 헤더 Users 아이콘(직행) ②설정 "공고 협업" 섹션(워크스페이스/받은 초대) ③워크스페이스 화면 임시 배너. 같은 목적지 문이 3개.

**결정**:
- **내 공고 탭 헤더의 `WorkspaceHeaderAction`을 "⋯" 메뉴로 전환** (`employer.tsx:104-127`).
  - `ActionSheet`(`src/components/ui/ActionSheet.tsx`) + `EllipsisHorizontalIcon`(`components/icons:173`) 조합. 선례: `board/BoardCommentItem.tsx:100-115,273-286` 그대로 이식.
  - 옵션: `[{label:'워크스페이스', value:'workspace'}, {label:'받은 초대' + (N>0 ? ` (${N}건)` : ''), value:'invitations'}]` → `onSelect`로 라우팅. 대기 초대 있으면 트리거 아이콘에 빨간 dot 유지.
- **설정 "공고 협업" 섹션 제거** (`settings/index.tsx:382-401`) — 일(도메인)은 설정(앱 환경)이 아니라 일하는 탭에.
- **워크스페이스 화면 임시 배너 제거** (`workspace/index.tsx:52-74`) — 발견성을 ⋯ 메뉴가 담당하므로 존재 이유 소멸.
- **받은 초대 딥링크 라우트 유지** — `NotificationRouteMap→RouteMapper→RouteRegistry` 체인은 UI 진입점과 독립(`RouteRegistry.ts:70`). 푸시 알림에서 오는 길은 그대로.

**리스크**: 기존 사용자가 설정에서 찾던 습관 → 전환 후 첫 진입 1회 툴팁("워크스페이스가 여기로 왔어요") 선택 적용(후속 가능, 필수 아님). `ActionSheetOption`에 뱃지 카운트는 `label` 문자열에 포함(타입 확장 불필요).

---

## 공통 제약 (Global)

- UI 문자열·커밋·주석 **한글**.
- `console.log` 금지 → `logger`.
- 불변성(스프레드), XSS 이스케이프(OG title), 커밋 컨벤션 `<type>(<scope>): <한글>`.
- **DB·RLS·서버 마이그레이션 변경 없음** (OG는 anon 읽기만, 나머지 클라이언트).
- 기존 마이그레이션 수정 금지, `mcp__supabase__*` 직접 호출 금지.

## 테스트 전략

- PR-1A: `canShareJob` 단위 테스트(상태별·pending 대회) + `useShare` 차단 경로 테스트.
- PR-1B: OG Function은 순수 헬퍼(ogHtml 빌더·이스케이프·UA 판별)를 단위 테스트. 함수 통합은 배포 후 curl 실측(사용자 게이트).
- PR-2: 교정된 문구 렌더 테스트(옛 문구 assert → 새 문구).
- PR-3: ⋯ 메뉴 열림 + 옵션 선택 라우팅 테스트, 설정 협업 섹션 미렌더 테스트.

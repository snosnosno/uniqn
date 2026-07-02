# 설계 — 운영처(venue) 생성 UI

> 작성일: 2026-07-01 · 브랜치: `feat/venue-create-ui`(origin/master 기준) · 워크트리: `T-HOLDEM-weekly-grid`

## 1. 배경 / 문제

주간 배치 그리드(PR #219, 플래그 `weekly_grid_enabled` OFF)의 **QA 중 발견한 출하 차단 결함**: 운영처(venue)를 **만드는 UI가 앱에 없다.**

- 운영처가 0개인 새 워크스페이스(=실제 운영자 첫 상태)에서 그리드 빈 상태는 "운영처를 먼저 만들어주세요"라고 안내하지만, **만들 수 있는 버튼·입력·경로가 어디에도 없다.**
- 운영처가 없으면 그리드의 모든 다운스트림(스태프 추가·슬롯 편집·소프트타깃·QR·정산·지난주 복사)이 불가 → 기능 전체가 막다른 길.
- 백엔드는 완성·검증됨. 생성 RPC `get_or_create_venue_container`는 `apply_migration`으로 PROD/로컬 적용 완료이고, repository 메서드 `getOrCreateVenueContainer(workspaceId, { name, kind, period? })`가 **XSS 검증(`venueContainerNameSchema.refine(xssValidation)`)까지 포함**해 구현돼 있다. **호출하는 UI 배선만 누락**됐다.

근거(코드 실측):
- `VenueSelector`의 props에 생성 콜백 없음, "0개면 안내 텍스트"만.
- `weekly-grid.tsx` 빈 상태는 `EmptyState`(제목/설명)만, 액션 없음.
- `getOrCreateVenueContainer` 호출자 = repository 메서드 정의(`JobPostingRepository.ts`)뿐, **훅·서비스·화면 0건**.
- QA에서 로컬 DB에 RPC를 직접 호출해 운영처 1개를 시드하자 나머지 흐름(그리드·스태프 추가·시간 피커·슬롯 편집·소프트타깃)은 **정상 동작 확인** → 결함은 **생성 UI 배선만**.

## 2. 목표 / 비목표

**목표 (v1)**
- 운영자가 주간 그리드 화면에서 **첫 운영처 및 추가 운영처를 생성**할 수 있다.
- 생성 즉시 목록 갱신 + 새 운영처 자동 선택.

**비목표 (후속)**
- 운영처 이름변경 / 삭제(soft delete) 등 관리 기능.
- 생성 폼의 종류(kind dated/fixed) 토글, 대회 기간(period) 입력. → v1은 **이름만, `kind='dated'` 고정**. 주간 그리드는 날짜 기반 캘린더라 `dated`가 코어 동작의 전제이며, 대회사도 대회 날짜에 인원을 꽂으면 같은 dated 그리드로 운영된다. 종류/기간 분기는 구체적 대회사 요구가 생기면 도입.

## 3. 결정 / 접근법

채택: **전용 생성 시트(`VenueCreateSheet`) + 단일 컴포넌트로 두 진입점 공유.**

| 접근법 | 평가 | 판정 |
|---|---|---|
| **1. 전용 생성 시트 `VenueCreateSheet`** | 앱의 모달 기반 생성 컨벤션·다크모드·키보드 일관. 두 진입점(빈 상태/선택기)이 단일 컴포넌트 공유(유지보수 1곳) | ✅ **채택** |
| 2. 인라인 입력 | 파일 최소이나 인라인 입력이 두 군데라 중복·앱 컨벤션과 덜 일관 | ❌ |
| 3. 범용 프롬프트 모달 | 향후 rename/delete 재사용 가치이나 지금 쓰는 곳 1개 → YAGNI 위반 | ❌ |

## 4. 구성 단위 (파일)

| # | 파일 | 변경 | 역할 / 인터페이스 | 의존 |
|---|---|---|---|---|
| 1 | `src/hooks/weeklyGrid/useCreateVenueContainer.ts` | 신규 | `useCreateVenueContainer(workspaceId)` → `useMutation`. `mutationFn: (name) => jobPostingRepository.getOrCreateVenueContainer(workspaceId, { name, kind: 'dated' })`. `onSuccess: invalidateQueries(queryKeys.weeklyGrid.containers(workspaceId))`. 반환: `VenueContainer`. `useCreateWorkspace` 미러 | repository, queryKeys |
| 2 | `src/components/weeklyGrid/VenueCreateSheet.tsx` | 신규 | `SheetModal`(title "운영처 만들기") + 이름 `TextInput` + footer(취소/만들기). 로컬 name 상태, 제출 시 훅 `mutateAsync(name)`, 성공 시 `onCreated(container)` 콜백 + 닫기. 빈 이름 제출 비활성, `isLoading`/다크모드. ≤120줄 | SheetModal, 훅#1 |
| 3 | `src/components/weeklyGrid/VenueSelector.tsx` | 수정 | 컨테이너 칩 줄 끝에 "+ 운영처 추가" 칩 추가 + `onAddVenue?: () => void` prop. 이 칩은 **항상 노출**(0개일 때 "없어요" 안내와 함께). VenueSelector는 화면 상단에 항상 렌더되므로(weekly-grid.tsx:184) 운영처가 있든 없든 추가 진입점이 됨 | — |
| 4 | `app/(employer)/weekly-grid.tsx` | 수정 | `createSheetVisible` 상태; 빈 상태 `EmptyState`에 `actionLabel="운영처 만들기"` + onAction → 시트 열기; `<VenueCreateSheet>` 렌더; `VenueSelector`에 `onAddVenue` 연결; `onCreated(c)` → `setSelectedVenueId(c.id)`. (0개일 때 선택기 칩 + 빈 상태 버튼 둘 다 노출되나 동일 시트를 열어 무해) | 컴포넌트#2·#3 |
| 5 | `src/components/weeklyGrid/index.ts` | 수정 | `VenueCreateSheet` export | — |
| 6 | `src/hooks/weeklyGrid/__tests__/useCreateVenueContainer.test.ts` | 신규 | 훅이 `kind:'dated'`로 repo 호출·성공 시 invalidate 검증 | — |
| 7 | `src/components/weeklyGrid/__tests__/VenueCreateSheet.test.tsx` | 신규 | 이름 입력→제출→mutation 호출; 빈 이름 제출 비활성 | — |

## 5. 데이터 흐름

```
운영자
  └ "운영처 만들기"(빈 상태) 또는 "+ 운영처 추가"(VenueSelector) 탭
      └ VenueCreateSheet 열림 → 이름 입력 → [만들기]
          └ useCreateVenueContainer.mutateAsync(name)
              └ jobPostingRepository.getOrCreateVenueContainer(workspaceId, { name, kind:'dated' })
                  ├ S1: venueContainerNameSchema(XSS 검증) — 실패 시 ValidationError, RPC 미호출
                  └ rpc('get_or_create_venue_container', { p_workspace_id, p_name, p_kind:'dated' })  ← SECDEF + 워크스페이스 게이트 + ON CONFLICT 멱등
                      └ VenueContainer 반환
                          └ onSuccess: invalidate queryKeys.weeklyGrid.containers(workspaceId)
                              └ useVenueContainers 재조회 → 새 운영처 목록 반영
                                  └ onCreated(c) → setSelectedVenueId(c.id) + 성공 토스트 + 시트 닫힘
```

## 6. 에러 처리

| 케이스 | 처리 |
|---|---|
| 빈/공백 이름 | 제출 버튼 **비활성(클라)** + repo `INVALID_INPUT`(심층 방어) |
| 이름 XSS | repo `ValidationError(SECURITY_XSS_DETECTED)` → `toast.error(userMessage)` |
| 같은 이름 재생성 | **get-or-create 멱등** → 기존 운영처 반환(에러 아님) → 그걸 선택(중복 안 생김) |
| 네트워크/RPC 실패 | AppError 매핑 → `toast.error` |
| 권한 없음(비멤버) | RPC가 `FORBIDDEN` → AppError 매핑 → `toast.error` |

## 7. 테스트 (TDD)

- **훅 단위**(`useCreateVenueContainer.test.ts`): repository를 목 → `mutateAsync('강남펍')` 호출 시 `getOrCreateVenueContainer(ws, { name:'강남펍', kind:'dated' })` 호출 검증(RED→GREEN), 성공 시 `invalidateQueries` 호출 검증.
- **컴포넌트**(`VenueCreateSheet.test.tsx`): 이름 입력 후 제출 → 훅 mutate 호출; 빈 이름이면 제출 버튼 disabled.
- 기존 `src/components/weeklyGrid/__tests__` / `src/hooks/weeklyGrid/__tests__` 패턴 준수.
- `npm run quality`(type-check+lint+format) EXIT0 + 영향 jest 스위트 통과.

## 8. 출하 / 배포

- 본 변경은 **JS만**(네이티브 무변경) → 신규 RPC·마이그 없음(이미 적용됨). 추가 PROD 마이그 **불필요**.
- 플래그 `weekly_grid_enabled`는 이 UI가 들어간 뒤에야 ON 검토(이 결함이 ON 차단 사유였음).
- 후속 핸드오프 문서(QA)에서 "운영처 생성 불가" 차단 항목 해소로 갱신.

## 9. 범위 밖 (명시적 후속)

- 운영처 이름변경 / 삭제(관리 화면).
- kind 토글(상시/대회) · 대회 기간(period) 입력.
- 다중 운영처 정렬/검색(현재 칩 줄로 충분).

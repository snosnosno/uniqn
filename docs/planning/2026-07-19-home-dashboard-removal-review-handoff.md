# 핸드오프 — 홈 대시보드 삭제 PR #276 리뷰 (다음 세션 메인 프롬프트)

> 이 문서를 다음 세션 첫 프롬프트로 그대로 붙여넣으면 된다. 사전 컨텍스트 불필요.

---

## 작업 요청

**PR #276 (`refactor(home): 홈 대시보드 전면 삭제 + 취소요청 알림 딥링크 선행 수정`)을 머지 전 최종 리뷰해줘.**

- PR: https://github.com/snosnosno/uniqn/pull/276
- 브랜치: `feat/home-dashboard-removal` (merge 커밋 `2f5d984a7`, base `master`)
- 워크트리: `C:/Users/user/Desktop/T-HOLDEM-home-removal` (node_modules는 메인에 junction)
- 규모: 86파일 `+1023 / −4711`

---

## 이 PR이 한 일 (요약)

홈 대시보드(`/(app)/home`)를 코드째 삭제하고 로그인 착지를 구인구직 탭(`/(app)/(tabs)/home-jobs`)으로 되돌렸다. 진입점 3개(착지 라우트·헤더 로고 탭·프로필 메뉴)를 먼저 끊고 코드를 지웠다.

**삭제의 전제로 선행 수정 1건**: DB 트리거 `fn_notify_cancellation_request`가 쏘는 `'cancellation_requested'` 알림 타입이 클라이언트 `NotificationType`에 미등록이라 **푸시는 도착하는데 딥링크가 죽어** 있었다. 홈의 취소요청 위젯이 이 결함을 가려주고 있었고, "알림이 커버하니 위젯을 지운다"가 삭제 근거였으므로 최선두 커밋으로 고쳤다. 트리거가 `link` 컬럼을 쓰지 않고 `data.jobPostingId`를 주므로 **클라이언트 라우트맵 추가만으로 해결 — DB 마이그레이션 0건**.

**의도적 손실**: 사장 횡단 집계 3종(새 지원자 합계·정산 합계·주간 요일별 분포) + 스태프 월별 정산. 실사용자 0 + YAGNI, 기존 결정(*"홈 스트립은 사용 신호 후로 유예"*)과 일치.

---

## 이미 끝난 검증 (재실행 불필요 — 시간 낭비 방지)

전부 이전 세션 메인에서 직접 실행한 결과다.

| 항목 | 결과 |
|---|---|
| `npm run quality` | **exit 0** |
| `npx jest` | **exit 0 — 485 스위트 / 5,550 테스트 전량 통과** |
| `npm run knip:gate` | **exit 0** |
| 잔존 참조 grep (`(app)/home`·`components/home`·`home_dashboard_enabled`) | **0** |
| 실브라우저 관찰 (로컬 웹 + playwright) | 로그인 → **URL `/home-jobs`** · 로고가 접근성 트리에서 `generic`(버튼 아님) · 프로필에 "대시보드" 없음 · 콘솔 에러 0 |

SDD 7태스크 각각에 대해 구현 + 독립 리뷰가 이미 끝났고, Important 3건은 인-브랜치에서 수정 후 재리뷰까지 통과했다.

---

## 리뷰가 집중해야 할 곳

앞선 리뷰들이 닫지 못했거나, 새 눈으로 봐야 가치가 있는 지점만 적는다.

### 1. `pointerEvents` 변경의 실기기 안전성 [최우선]
`TabHeader.tsx`의 중앙 로고 오버레이를 `box-none` → `none`으로 바꿨다. `TabHeader`는 **거의 모든 탭 화면에 렌더**되므로 회귀 반경이 넓다. 정적으로는 (a) `none ⊂ box-none` (b) 액션 View의 `zIndex:10` (c) 좌측은 비인터랙티브 `Text` (d) react-native-web `createDOMProps` 소스까지 확인해 양립가설 이중검증을 마쳤고, 웹 브라우저에서는 헤더 액션 버튼이 정상 노출됨을 관찰했다. **네이티브(iOS/Android) 히트테스트는 미관찰.**

### 2. 삭제가 과했는지 재점검
30파일 2,889줄 + 고아 훅 5개 + 수직 슬라이스 4종 + `expo-linear-gradient`를 지웠다. 앞선 리뷰에서 과잉삭제 0건으로 판정됐지만, 되돌리기 어려운 변경이니 새 눈으로 한 번 더 봐줘. 특히:
- **보호 대상**(지우면 안 되는 것): `usePendingReviews`·`useCurrentWorkStatus`·`calculateScheduleStats`/`ScheduleStats` 타입·`HomeIcon`·`weekly_grid_enabled`/`ops_hub_enabled`
- `expo-linear-gradient` 제거는 **네이티브 의존성 변경**이라 tsc/jest로 완전 검증 불가 — EAS 빌드 관점에서 봐줘

### 3. master 재통합 충돌 해소의 정확성
squash 저장소 특성상 merge-base가 오래돼 PR diff가 101파일로 부풀었고, `git merge origin/master`로 재통합해 86파일로 정상화했다. 이때 **충돌 9건**이 났고(예상 5건 초과), 원인은 우리의 死코드 삭제와 master의 *다른* 死코드 삭제(`updateWorkTime` 체인)가 꼬리를 공유한 채 교차한 것이었다. 해소는 "두 삭제의 합집합". **master 쪽 변경이 소실되지 않았는지** 확인해줘 — merge 커밋 `2f5d984a7`의 두 부모(`fb8db5365`, `9cfec82db`) 대조.

### 4. e2e 스펙 정리의 타당성
p1 스펙 3개(테스트 9개)를 삭제했다. 그중 1개는 앞선 리뷰에서 **삭제가 오답**으로 반증돼 `root-boot-landing.spec.ts`로 복원했다. 나머지 8개 삭제가 정말 "검증 대상 소멸"인지, 그리고 수정된 스펙에 **단언 약화**가 없는지 봐줘(앞선 리뷰는 10곳 전수 대조 후 약화 0건 판정).
⚠️ `e2e/pages/app/tabs/home.page.ts`는 **이름과 달리 구인구직 탭 페이지 오브젝트**다. 삭제 금지.

### 5. knip 래칫 조정의 정당성
`knip:gate` 값을 2209 → 2210으로 **올렸다**. 근거: master 기준 실측이 2213이라 게이트 2209는 **이미 red**였고(메인 세션 실측), 이 PR 정리 + master 재통합 후 실측 2210으로 맞춰 green이 됐다. 래칫을 푸는 방향이라 이 근거가 타당한지 판단해줘.

---

## 알려진 미해결 (리뷰에서 새로 지적할 필요 없음 — 이미 인지됨)

- **실기기 QA 2건**: 헤더 우측 액션 4종 터치 / **취소요청 알림 딥링크 실도달**(스태프 취소요청 → 사장 알림 탭 → `cancellation-requests` 도달)
- **p0 e2e 미실행**: `e2e/.env.test`가 **프로덕션 Supabase**를 가리켜 자동 실행하지 않았다. CI에서 확인
- **⚠️ 롤백 수단 소실**: `home_dashboard_enabled` 플래그가 삭제됐다. `weekly_grid_enabled`·`ops_hub_enabled`와 달리 원격 `app_config` 백업이 없어 revert+OTA만 가능 → **OTA 확산 전 착지 실측 필수**
- **Edge Function 재배포는 선택**: `send-push-notification`의 소비부가 fail-open(`if (!category) return false`)이라 재배포 **전**이 오히려 취소요청 푸시에 관대하다. 재배포는 카테고리 음소거를 존중하게 만드는 것이고 BLOCKING 아님
- **후속 별건**: 딥링크 파서 인바운드 variant 미등록(현재 라이브 영향 0) · `home.page.ts` rename · 알림 템플릿 `undefined` 삽입(프로덕션 호출자 0)

---

## 가드레일

- 메인 체크아웃 `C:/Users/user/Desktop/T-HOLDEM`은 **건드리지 마라** — 다른 세션이 쓰고 있고 미커밋 변경이 있다
- **프로덕션 DB 쓰기 금지**. `mcp__supabase__*` 직접 호출 금지. p0 e2e 실행 금지(프로덕션을 가리킴)
- 마이그레이션 생성·수정 금지 (이 PR은 클라이언트 전용, 마이그 0건이 불변식)
- 리뷰 판정은 `model: "fable"` 서브에이전트에 위임 — 한도 시 opus로 폴백하고 다운그레이드를 보고에 명시
- 머지·푸시는 **명시 요청 시에만**

---

## 참고 문서

- 설계 스펙: `docs/superpowers/specs/2026-07-19-home-dashboard-removal-design.md`
- 구현 계획: `docs/superpowers/plans/2026-07-19-home-dashboard-removal.md`
- SDD 진행 원장 + 태스크별 보고서: `.superpowers/sdd/` (gitignore 대상, 워크트리 디스크에만 존재)
- 세션 메모리: `project_home_dashboard_removal_20260719.md`

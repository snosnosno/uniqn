# 핸드오프 — Alert.alert 웹 no-op 패턴 전수 감사 (다음 세션 메인 프롬프트)

> 작성: 2026-07-17. 전 세션(애니메이션 브랜치 QA 중 발견)에서 확인한 사실만 근거로 함. 아래 블록을 새 세션에 그대로 붙여넣는다.

---

`Alert.alert` 웹 no-op 문제를 프로젝트 전체 범위로 감사하고 고쳐줘.

## 배경 (전 세션에서 실측 확인 — 재검증 없이 신뢰 가능)

- **웹은 실제 배포 대상이다.** `scripts/deploy-cloudflare.js`가 `npm run build:web`(=`expo export -p web`)의 `dist/`를 `wrangler pages deploy`로 그대로 배포한다. `uniqn.app` / `uniqn-app.pages.dev`에 이 RN 앱의 웹 빌드가 실제로 떠 있다 — 로컬 개발 편의가 아니라 프로덕션 표면이다.
- **`react-native-web`의 `Alert.alert`는 완전 no-op다.** `node_modules/react-native-web/dist/exports/Alert/index.js`를 직접 읽어 확인: `static alert() {}` — 버튼 개수와 무관하게 아무 것도 하지 않는다. 즉 2버튼 확인 다이얼로그뿐 아니라 **단순 1버튼 에러 안내(`Alert.alert('오류', '...')`)도 웹에서는 완전히 침묵**한다(사용자에게 아무 피드백 없이 그냥 무시됨).
- **이 프로젝트엔 이미 정답 패턴이 있다.** `src/utils/confirmAction.ts`:
  ```ts
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) { runConfirm(); }
    return;
  }
  Alert.alert(title, message, [...]);
  ```
  `src/hooks/useUnsavedChangesGuard.ts`도 동일하게 `Platform.OS === 'web'` 분기로 `window.confirm`을 쓴다. **컨벤션은 "Alert.alert 금지"가 아니라 "확인/취소류는 반드시 웹 분기(confirmAction 경유 또는 동등 처리)를 거쳐야 한다"**는 것.
- **확인된 위반 사례 1건**: `src/components/jobs/ApplicationForm.tsx`의 `handleRequestClose`(라인 ~216-232)가 `confirmAction()`을 거치지 않고 `Alert.alert('작성을 그만할까요?', ..., [...])`를 직접 호출한다. 웹에서 실측 검증(Playwright, `expo start --web` 로컬 스택 대상): 지원하기 시트에 내용을 입력한 뒤 닫기(X) 버튼이나 백드롭을 클릭해도 **아무 일도 일어나지 않는다** — 확인도 안 뜨고 닫히지도 않는 죽은 버튼. (이 파일은 애니메이션 브랜치가 건드린 코드가 아니라 기존 버그.)
- **감사 대상 전수 목록**(전 세션 grep 결과, `src/` 기준 `Alert\.alert\(` 패턴, 18곳/11파일 — 재확인 없이 이 목록으로 시작):
  - `src/components/jobs/ApplicationForm.tsx` (1) — 확인된 버그, 최소 이건 고친다
  - `src/utils/confirmAction.ts` (1) — 참조 구현(올바른 패턴), 손대지 않음
  - `src/hooks/useUnsavedChangesGuard.ts` (1) — 참조 구현(올바른 패턴), 손대지 않음
  - `src/components/ops/StaffTab.tsx` (3)
  - `src/components/ops/RedrawModal.tsx` (1)
  - `src/components/ops/PrizeCorrectSheet.tsx` (1)
  - `src/components/ops/PlayersTab.tsx` (5)
  - `src/components/ops/PlayerClaimButton.tsx` (2)
  - `src/components/support/InquiryAttachmentPicker.tsx` (1)
  - `src/components/auth/PortOneIdentityVerification.web.tsx` (1)
  - `src/components/auth/PortOneIdentityVerification.tsx` (1)

## 조사·수정 절차

1. **웹 도달 가능성부터 판정**: `ops/*` 화면(StaffTab/RedrawModal/PrizeCorrectSheet/PlayersTab/PlayerClaimButton)이 실제로 웹 빌드/배포 라우팅에 포함되는지 먼저 확인(대회 운영은 태블릿/TV 전용일 수 있음 — 라우팅 설정·`app.json`·플랫폼별 진입점 확인). 웹에서 도달 불가능한 화면이면 이번 감사 범위에서 제외하고 그 근거를 기록한다. `PortOneIdentityVerification.web.tsx`처럼 이미 `.web.tsx` 변형이 있는 파일은 웹 전용 분기 로직을 별도로 갖고 있을 가능성이 높으니 먼저 읽어볼 것.
2. **각 호출부 분류**: (a) 확인/취소 2버튼형 → `confirmAction()`으로 교체 (b) 단순 안내(버튼 1개, 정보/에러) → 웹에서는 toast 또는 `window.alert` 등가 처리로 교체 (c) 이미 `Platform.OS==='web'` 분기가 있거나 네이티브 전용 코드 경로 안에 있어 웹에서 도달 불가 → 스킵하고 근거 기록.
3. **`ApplicationForm.tsx`는 최소 확정 수정**: `handleRequestClose`를 `confirmAction()` 경유로 교체(제목/메시지/destructive 스타일은 기존 Alert.alert 인자 그대로 이관).
4. **검증**: 순수 유닛/타입체크로는 이 버그가 안 잡힌다(react-native-web 스텁은 런타임 문제). 전 세션에서 쓴 방법 재사용: 로컬 Docker Supabase 스택(`docker ps`로 `supabase_db_uniqn` 기동 확인, 없으면 `npm run db:start`) 대상으로 `npx expo start --web --clear` 후 Playwright MCP로 실제 화면 진입 → 버튼 클릭 → 웹에선 `page.on('dialog')`(window.confirm 경로) 또는 DOM 스냅샷(toast 경로)으로 실제 피드백이 뜨는지 관찰. 코드 읽고 "될 것 같다"로 완료 주장 금지 — 반드시 브라우저에서 관찰.
   - ⚠️ 로컬 Docker DB에 QA용 fixture(job_posting 등)를 넣어야 화면에 도달하는 경우, **다른 세션이 같은 로컬 스택을 쓰고 있을 수 있으니 삽입 전 사용자에게 확인**하고 끝나면 반드시 삭제한다(전 세션에서 실제로 이렇게 처리한 전례 있음).
   - ⚠️ `expo start --web --clear`는 Windows에서 EMFILE(too many open files)로 첫 기동이 죽을 수 있다(전 세션 실측 — 이 머신에 node.exe 프로세스가 90개 이상 떠 있던 상태에서 발생). 죽으면 한 번 재시도, 그래도 죽으면 진행 중인 다른 세션/프로세스 때문일 가능성을 사용자에게 보고하고 무리하게 프로세스를 죽이지 말 것(다른 세션 작업 파괴 위험).
5. **선택(시간 되면)**: `Alert.alert` 외에 react-native-web에서 no-op이거나 동작이 다른 RN API가 이 앱에 더 있는지 넓게 훑어본다(예: `Vibration`, `Share.share`, `Linking.openURL` 등 — 이번 발견과 같은 "네이티브 API의 조용한 웹 스텁" 클래스의 다른 사례가 있을 수 있음). 없으면 없다고 결론짓고 끝.

## 범위·주의

- 이번 애니메이션 브랜치(`feat/animation-motion-polish`)와 무관한 기존 버그다 — 별도 브랜치/워크트리에서 작업할 것. 메인 트리(`C:\Users\user\Desktop\T-HOLDEM`)가 현재 다른 세션 점유 중일 수 있으니 `git status` 먼저 확인 후 필요시 새 워크트리로 격리.
- 계획 밖 리팩터링 금지 — 발견한 위반 건만 고친다. 완료 주장 전 위 4번 방식으로 실제 관찰한 증거를 보고에 명시.

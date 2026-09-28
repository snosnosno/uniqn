# ops-web 다음 세션 프롬프트 — 로컬 테스트 결과 반영 + 남은 작업 점검 (2026-09-29)

> 아래 "붙여 넣을 프롬프트" 를 새 세션 첫 메시지로 쓴다. 직전 세션(W1~W8 코드 완료) 인계.

---

## 붙여 넣을 프롬프트

```
docs/planning/2026-09-29-ops-web-next-session-prompt.md 를 읽고 그대로 진행해줘.
(워크트리: C:\Users\user\Desktop\T-HOLDEM-ops-web, 브랜치 사슬 끝 = feat/ops-web-w8)
내가 로컬 수동 테스트한 결과(❌ 항목)는 아래에 붙인다. 없으면 "없음".

[수동 테스트 결과]
- (여기에 docs/qa/ops-web-local-manual-test.md 의 ❌ 항목 · 화면 크기 · 브라우저 · 재현 순서)
```

---

## 세션이 할 일 (순서대로)

### 1. 현재 상태 실측 (추측 금지 — 병렬 세션이 상시 활성)

- `git -C C:/Users/user/Desktop/T-HOLDEM-ops-web status` · `git log --oneline -12` — 사슬이 아래와 같은지
  - W1 `0fd251148` → W2 `a6ea2344b` → W3 `5c6c033ac` → W4~W6 `30f3de8c8` → W5 `8feb58f62` + `ee7a9a812` → W7 `15e428314` + `94cb3eb0a` → W8 `7cbc704bc` → (문서·로컬 스크립트 커밋)
  - 브랜치: `feat/ops-web-w1`…`w5`·`w7`·`w8`(모두 **미푸시**)
- `git -C C:/Users/user/Desktop/T-HOLDEM fetch && git log origin/master --oneline -5` — master 가 그새 움직였는지(움직였으면 rebase 필요 여부 판단)
- `gh pr list` — 이미 PR 이 있는지
- `grep -c "⬜" docs/qa/ops-web-parity.md` → 요약표 외 0 이어야 함

### 2. 자동 검증 다시 돌리기 (증거 없이 완료 주장 금지)

```bash
cd C:/Users/user/Desktop/T-HOLDEM-ops-web/ops-web
npm run quality                                   # sync --check + tsc + oxlint + prettier + vitest(397)
node --test ../scripts/__tests__/sync-ops-core.test.mjs   # 19
npm run local                                     # 로컬 서버 4173 (다른 터미널/백그라운드)
for f in w2-auth w3-tournaments w4-console w5-tables w56-console w7-public; do node e2e/$f.mjs; done
cd ../uniqn-mobile && npx jest src/constants      # 155 (W8 모바일 변경)
```
- 실패하면 E2E_VERBOSE=1 로 원인 확인. ⚠️ `w2-auth` 는 owner 비밀번호를 재설정해 **다른 세션을 끊는다** — 방치 검증과 동시에 돌리지 말 것
- 끝나면 로컬 서버 종료 + `netstat -ano | grep LISTENING | grep -E ":(4173|8788)"` 0 확인

### 3. 사용자가 붙인 ❌ 항목 처리

- 항목마다 **재현 → 경쟁 가설 3개 → 원인 → 레드-그린(E2E 또는 vitest) → 수정 → 리뷰(code-reviewer, model opus)** → 슬라이스 브랜치에 fix 커밋
- UI 변경은 1280·768·375(라이트·다크) 스크린샷을 **직접 보고** 확인

### 4. 남은 작업 점검 — 하나씩 "완료/보류/사람 게이트" 로 판정해 표로 보고

**A. 검증 공백 (코드는 있으나 증거 없음)**
1. **66분 방치 realtime**(W4 완료 기준) — 1차는 w2-auth 비밀번호 재설정 간섭, 2차는 메모리 부족 강제 중단. `IDLE_MIN=66 node e2e/w4-idle.mjs` **단독 실행**(백그라운드 + 종료 감시, 그동안 다른 E2E 금지)
2. Safari — 전광판 링크 발급·복사·새 창(리뷰 W7 이 정책상 위험 지적, 토스트 [복사]로 바꿈 — 실기 미확인)
3. 실제 태블릿(768)·TV(1920) 기기에서 손맛 — 사용자 수동 테스트 결과로 판정
4. W8 302 의 **Location** — 로컬 wrangler 는 ops.uniqn.app 을 로컬 주소로 바꿔 보여 줘 증거가 안 된다. prod 배포 후 `curl -sI https://uniqn.app/monitor/x`

**B. 코드 잔여 (결정 필요 또는 작은 작업)**
1. 🆕 **앱 안 테마 전환 버튼 없음** — `src/lib/theme.ts` 의 `setTheme` 는 `/_design` 견본에서만 쓴다. 라이트는 개발자도구로만 켤 수 있다. 사용자 결정: 헤더에 전환 버튼을 둘지(설계 결정은 "다크 기본")
2. SUIT 폰트 서브셋 — 미도입(지금은 시스템 한글 폰트). 도입하려면 **`/oss-vet` 먼저**(fonttools)
3. 새 훅 단위 테스트 없음 — `usePublicPoll`·`useScreenAwake`·`useForceDark`(vitest 환경이 node). jsdom 도입 여부 결정 또는 E2E 로 충분하다고 기록
4. 리뷰 LOW 미반영분: `role="radio"` 그룹 화살표 키 이동(W5·W6) · 닉네임 검색 2~15 경계가 모바일 서비스와 하드코딩 사본(W6) · 1280 전광판 AVG STACK 긴 값 넘침 여지(W7)
5. 모바일 쪽 같은 결함: 공고 변경 시 근태 해석(`staffWorkLogs`) 무효화 없음 — 웹은 고침, 모바일은 그대로(모바일 PR 로 따로)
6. W8 안정화 후: `_redirects` 302 → 301 승격, 모바일 번들의 `app/(public)/monitor`·`live` 화면 삭제 후보 기록
7. `uniqn-mobile/.wrangler/` 가 남아 있으면 모바일 `npm run lint` 가 579건 — 사용자에게 삭제 요청(`rm -rf` 는 권한 설정이 막는다)

**C. 사람 게이트 (사용자에게 한 번에 묻기)**
1. push·PR — 권장: W1~W7 을 PR 1개(`feat/ops-web-w7` → master), W8 은 W7 prod 반영 후 별도 PR
2. Cloudflare Access — ops.uniqn.app 을 운영자 이메일만(개통 때 해제)
3. GitHub Environment `ops-web-production` 시크릿 4종(VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY·CLOUDFLARE_API_TOKEN·CLOUDFLARE_ACCOUNT_ID) + 변수 `OPS_WEB_DEPLOY_ENABLED=true`
4. 개통 순서(설계 §7 — 어기면 공개 뷰어가 깨진다): W7 prod → Access 해제 → Supabase Auth Redirect URLs `https://ops.uniqn.app/**` → W8 머지·모바일 웹 배포 → prod Location curl → `EXPO_PUBLIC_OPS_URL` 설정 → OTA·웹 배포(`/deploy`, 사용자 확인)

### 5. 마무리

- fablize 원장(`python3 ~/.claude/fablize/scripts/goals.py status`, 워크트리 루트): G004 blocked(방치 검증), G005~G008 pending — 증거가 생긴 것만 순서대로 checkpoint
- 메모리 `project_ops_web_split.md`·MEMORY.md 진행 줄 갱신(Edit 도구로만)
- 보고: 결론 먼저 · A/B/C 표 · 이번 세션 검증 증거 · 남은 사람 게이트 — 한글

## 확정 결정 (재논의 금지)

Vite+React Router SPA · Cloudflare Workers 정적 무료 · 같은 Supabase · **새 RPC 0** · 개발 DB=로컬 Supabase · 원격 프리뷰 없음 · 가입은 UNIQN 링크 · 공유=동기화 사본+CI 파리티(`scripts/sync-ops-core.mjs`) · 확인창 유지(Enter/Esc) · 단축키 useHotkey · 다크 기본 · 골드는 상금에만 · magic-mcp 미사용 · 시안: 좌석표 A 행렬표 · 전광판 A′(양옆 배경 없음·제목 가운데) · 플레이어뷰 B(클럭 상단 고정+표)

## 금지

가드 우회 경로 추가 · 운영 빌드에 prod 아닌 URL · 원격 프리뷰에 prod 키 · `git reset --hard`·`worktree remove --force`·`rm -rf`(필요하면 사용자에게) · `console.log` · 하드코딩 색 · 라임 글자를 라이트 바탕에 · 에이전트 "성공" 보고를 그대로 믿기 · push·PR·배포는 사용자 요청 시에만

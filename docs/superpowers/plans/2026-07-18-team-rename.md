# 팀 rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 노출 문자열 "워크스페이스"를 "팀"으로 전역 교체한다(문자열 전용, 계층 팀 ⊃ 지점).

**Architecture:** 진입점 통일 PR(#270) 위에서 동작한다 — #270이 ⋯ 메뉴에 `{ label: '워크스페이스', value: 'workspace' }`를 새로 노출했으므로 그 라벨 포함 전 화면의 "워크스페이스"를 "팀"으로 바꾼다. 라우트(`/workspace/*`)·변수명·함수명·주석은 불변. 문자열 rename은 하나의 리뷰 단위이므로 단일 태스크.

**Tech Stack:** TypeScript strict, React Native/Expo, Jest + @testing-library/react-native, ripgrep.

## Global Constraints

- UI 문자열·커밋·주석 **한글**. (CLAUDE.md)
- **화면 문자열만** 교정 — 변수명·라우트(`/workspace/*`)·함수명·주석·테스트 픽스처의 코드 개념어는 불변.
- accessibilityLabel·placeholder·toast도 함께 교정(스크린리더/일관).
- `console.log` 금지. 커밋 `<type>(<scope>): <한글>`.
- 기존 "팀" 단어가 다른 도메인에서 쓰이면 **보고 후 조정**(신규 충돌 방지).

---

### Task 1: "워크스페이스" → "팀" 일괄 교정

**Files:**
- Modify: 전수 grep으로 확정. 알려진 앵커:
  - `uniqn-mobile/app/(app)/(tabs)/employer.tsx` — ⋯ 메뉴 `label: '워크스페이스'`
  - `uniqn-mobile/app/(employer)/weekly-grid.tsx` — 에러 문구 "워크스페이스를 불러오지 못했어요"
  - `uniqn-mobile/app/(employer)/workspace/index.tsx` — 화면 타이틀·헤더·본문
- Test: 위 화면들의 `__tests__/*` 문구 assert 갱신 + ⋯ 메뉴 렌더 assert

**Interfaces:**
- Consumes: 없음(문자열 전용).
- Produces: 없음.

- [ ] **Step 1: 교체 대상 + 충돌 전수 grep**

Run:
```bash
cd uniqn-mobile && npx --no-install rg -n "워크스페이스" app src
```
→ 화면 문자열 목록 확보(변수명·주석은 제외 판단). 이 목록이 교체 대상의 진실원.

Run(충돌 확인):
```bash
cd uniqn-mobile && npx --no-install rg -n "[\"'\`]팀|>팀|팀<|\s팀\s" app src
```
Expected: 기존 "팀" 화면 사용이 없어야 함(0). 있으면 **여기서 멈추고 보고** — 같은 단어 충돌 시 문맥 구분 필요.

- [ ] **Step 2: 실패 테스트 우선 갱신(대표 1건 — ⋯ 메뉴)**

`app/(app)/(tabs)/__tests__/employer.workspaceMenu.test.tsx`의 옛 문구 기대를 새 문구로 변경:
```tsx
// 기존: expect(getByText('워크스페이스')).toBeTruthy();
expect(getByText('팀')).toBeTruthy();
```

- [ ] **Step 3: 실패 확인**

Run:
```bash
cd uniqn-mobile && npx jest "app/(app)/(tabs)/__tests__/employer.workspaceMenu.test.tsx"
```
Expected: FAIL — 컴포넌트가 아직 '워크스페이스'를 렌더.

- [ ] **Step 4: 화면 문자열 일괄 교체**

Step 1 목록의 각 화면 문자열 `워크스페이스` → `팀`. 앵커 예시:
- `employer.tsx` ⋯ 메뉴: `{ label: '워크스페이스', value: 'workspace' }` → `{ label: '팀', value: 'workspace' }` (**value 불변**)
- `employer.tsx` 접근성: `accessibilityLabel`에 '워크스페이스' 있으면 '팀'으로
- `weekly-grid.tsx`: `'워크스페이스를 불러오지 못했어요'` → `'팀을 불러오지 못했어요'`
- `workspace/index.tsx`: 화면 타이틀/헤더/안내 문자열 `워크스페이스` → `팀`

변수명(`workspaceId` 등)·라우트(`'/(employer)/workspace'`)·주석은 **건드리지 않는다**.

- [ ] **Step 5: 전 테스트 문구 갱신 + 통과**

각 컴포넌트 테스트의 옛 문구 assert/셀렉터 `워크스페이스` → `팀`으로 교체 후:
```bash
cd uniqn-mobile && npx jest "app/(app)" "app/(employer)"
```
Expected: PASS.

- [ ] **Step 6: 잔여 grep 0 확인**

Run:
```bash
cd uniqn-mobile && npx --no-install rg -n "워크스페이스" app src
```
Expected: 화면 문자열 0건(변수명·라우트·주석만 남으면 OK — 목록 육안 확인).

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor(nav): 사용자 노출 '워크스페이스'를 '팀'으로 전역 교체"
```

---

## Self-Review

**Spec coverage:** 스펙 §2(팀 rename) → Task 1 전체. ✓
**Placeholder scan:** 화면 목록은 grep-driven(문자열 rename의 정당한 방법, TBD 아님). 테스트 코드 실물 제공. ✓
**Type consistency:** value·라우트·변수 불변 규칙 일관 — `workspace` value 유지로 라우팅 무회귀. ✓

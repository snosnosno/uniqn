# 미사용 export ~3,000건 단계별 triage 로드맵

> 작성일: 2026-07-05 · 대상: `uniqn-mobile/` · 도구: knip · 성격: 다음 세션이 그대로 집어 실행하는 핸드오프
> 기준 데이터: knip 전체 리포트(2026-07-05 실측). 원본 리포트는 세션 스크래치패드에 보관(아래 §2 인용).
> **이 문서는 계획 전용 — 코드 변경 지침이며, 이 문서 작성 세션에서는 코드를 건드리지 않았다.**
>
> **업데이트(2026-07-05)**: 이 로드맵과 별개로 죽은 OG 공유 미리보기 엣지 인프라(`functions/jobs/[id].ts` + wrangler `OG_KV` 바인딩 + `public/og-default.png`)를 `chore/remove-dead-og-infra` 브랜치에서 제거했다. 여파: ① §4.0 Phase 0의 `functions/**` entry 항목은 이제 대상 파일이 없어 불필요(무해). ② 아래 §2·§4.2의 `@cloudflare/workers-types`는 그 함수 전용이었으므로 **더 이상 오탐이 아니라 실제 미사용** — Phase 2에서 `package.json`에서 제거 가능(단 `package-lock.json` 동기화 위해 `npm install` 필요).

---

## 0. 요약 (결론 먼저)

knip이 보고한 미사용 심볼 ~3,000건 중 **상당수가 오탐(엔트리포인트·배럴 재수출·Zod 추론타입·테스트 인프라)**이므로 일괄 삭제는 prod 붕괴를 부른다. 따라서 **먼저 knip config를 하드닝해 신호를 정화(Phase 0)**하고, 이후 **위험이 낮은 구역부터(중복 export → 죽은 파일 → 리프 유틸 → 컴포넌트 → 고위험 공개 API 계약) 세션 단위로 배치 처리**한다. 각 배치는 `type-check + jest + knip 재측정 + git diff`의 Red-Green 게이트를 통과해야 하고, 실패 시 심볼 단위로 되돌린다.

**핵심 원칙 3가지**

1. **Phase 0가 측정 게이트다.** config 하드닝 후 남는 "진짜 미사용" 수치를 재측정하기 전까지 아래 예상 건수는 상한선(오탐 포함)일 뿐이다. Phase 1 이후 물량은 Phase 0 결과로 재추정한다.
2. **tsc가 잡아주지 않는 구역이 있다.** `tsconfig.json`이 `functions/`·`supabase/functions/`·`e2e/`를 exclude하므로, 이 구역 변경은 `npm run type-check`로 회귀가 안 잡힌다 → 이 구역은 "삭제"가 아니라 "config로 봉인"이 원칙.
3. **삭제 방향은 항상 소비 형태를 확인한 뒤.** 배럴 재수출·named/default 이중수출은 소비자가 어느 경로/형태를 쓰는지 grep으로 확인하지 않으면 깨진다.

---

## 1. 목표와 비목표

### 목표 (Why)

- **knip 신호 정화**: 오탐이 3,000건 섞여 있으면 knip이 미래의 진짜 죽은코드를 가려낼 수 없다. 신호 대 잡음비를 회복해 knip을 CI 게이트로 신뢰 가능하게 만든다.
- **공개 API 표면 축소**: 아무도 안 쓰는 export는 리팩터링 시 "혹시 쓰는 데 있나" 탐색 비용을 늘리고, 잘못된 재사용을 유도한다. 실제로 죽은 것만 걷어내 표면을 좁힌다.
- **번들/타입체크 부수효과**: 죽은 파일·죽은 심볼 제거는 tsc·번들 그래프를 가볍게 한다(부차적).

### 비목표 (Why not 일괄삭제)

- **엔트리포인트 오탐**: Cloudflare Pages Functions(`functions/**`)와 Supabase Edge Functions(`supabase/functions/*/index.ts`) 15종이 "Unused files"로 잡히지만 삭제 시 prod 붕괴. 이들은 런타임 진입점이지 소비되는 모듈이 아니다.
- **공개 API 계약**: `services/`·`repositories/`·`hooks/`·`schemas/`는 레이어 경계(Presentation→Hooks→Service→Repository→Supabase)의 계약이다. 현재 소비처가 없어도 의도적 공개 표면일 수 있다 → 심볼별 판단 필요.
- **동적/타입-포지션 참조**: Zod 추론타입, 배럴 재수출, `React.lazy` 동적 import는 정적 그래프에서 "미사용"으로 보이나 실사용.
- **jscpd 코드중복(2.97%)은 범위 밖**: 건강 수준이라 이 로드맵에서 다루지 않는다(참고만).

---

## 2. 현재 실측 baseline (knip, 2026-07-05)

> 이 수치는 **config 하드닝 이전(오탐 포함)** 상한선이다. Phase 0 후 §4.0 절차로 재측정한다.

| 카테고리              | 총건수 | 구역별 분해                                                                                                                                                                        |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unused exports        | 1,725  | components 317 · schemas 243 · services 221 · hooks 197 · utils 126 · constants 87 · types 67 · errors 61 · domains 59 · stores 51 · shared 44 · lib 43 · repositories 36 · e2e 46 |
| Unused exported types | 977    | schemas 220 · types 177 · components 142 · repositories 91 · services 72 · domains 71 · hooks 53                                                                                   |
| Duplicate exports     | 320    | components 231 (대부분 `Component\|default` 이중수출) · hooks 46 · services 15                                                                                                     |
| Unused files          | 26     | 대부분 엔트리포인트 오탐(functions/supabase-functions/e2e config) + 일부 진짜 죽은 파일                                                                                            |
| Unused (dev)deps      | 5      | expo-modules-core · @cloudflare/workers-types · babel-preset-expo · lint-staged · ts-node                                                                                          |

**현재 knip config** (`package.json:160-166`) — `entry`/`project` 미설정, `ignoreDependencies` 3종만:

```json
"knip": {
  "ignoreDependencies": ["react-native-mmkv", "react-native-nitro-modules", "expo-intent-launcher"]
}
```

→ `entry` 미설정이 엔트리포인트 오탐의 근본 원인. Phase 0에서 여기를 손본다.

**tsconfig exclude** (`tsconfig.json:47-52`): `node_modules`, `functions`, `supabase/functions`, `e2e`. (e2e는 `e2e/tsconfig.json` 별도 보유.)

---

### Phase 0 후 baseline (재측정 — 2026-07-05, `chore/knip-config-harden`)

> **드리프트 정정**: 위 §2 표는 이 로드맵 작성 시점의 config를 기록했으나, 실제로는 로드맵 병합(#224) 직전 커밋 `027a5c5a1 (…knip 오탐 봉인)`이 **파일·의존성 봉인을 이미 완료**한 상태였다. 따라서 §2의 "Unused files 26 / (dev)deps 5"는 stale이며 실측 시점 이미 0이었다. 이번 Phase 0(`chore/knip-config-harden`)는 그 위에 남아 있던 **테스트 인프라 오탐(e2e 43 + `src/__tests__/mocks` 5)과 Unlisted binaries 2**만 추가 봉인했다. 게이트 전부 그린: `type-check` EXIT 0 · `jest` 4,748/4,748 통과 · `npx knip` 재측정.

**적용한 config 변경** (`package.json` knip 블록):

- `ignore`: e2e config 4종을 `e2e/**` blanket으로 대체 + `src/__tests__/mocks/**` 추가
- `ignoreBinaries: ["supabase", "eas"]` 신규 (npm 스크립트 CLI 미선언 오탐 제거)
- `ignoreDependencies` 6종 불변 — mmkv/nitro/intent-launcher는 knip "remove" 힌트가 뜨나 peer dep 보호(`pitfall_knip_falsepositive_build_config`)로 **의도적 유지**(hint 3건 무해)

| 카테고리              | §2 (stale) | 027a5c5a1 후 | **Phase 0 후 (권위)** | 조치                                             |
| --------------------- | ---------- | ------------ | --------------------- | ------------------------------------------------ |
| Unused files          | 26         | 0            | **0**                 | `ignore: supabase/functions/**` 등 (선반영)      |
| Unused (dev)deps      | 5          | 0            | **0**                 | `ignoreDependencies` 6종 (선반영)                |
| Unlisted binaries     | —          | 2            | **0**                 | `ignoreBinaries: [supabase, eas]` 추가           |
| Unused exports        | 1,725      | 1,716        | **1,670**             | `ignore: e2e/**`, `src/__tests__/mocks/**` (−46) |
| Unused exported types | 977        | 970          | **968**               | 〃 (−2)                                          |
| Duplicate exports     | 320        | 313          | **313**               | 불변 (전부 `src/**`, Phase 1 대상)               |
| Configuration hints   | —          | 3            | **3**                 | mmkv/nitro/intent-launcher — 유지                |

**Phase 0 후 구역별 분해** (오탐 제거 후 순수 신호 — 전부 `src/**`):

- **Unused exports 1,670**: components 411 · schemas 243 · services 228 · hooks 194 · utils 126 · constants 87 · types 67 · errors 61 · domains 60 · stores 51 · repositories 47 · shared 44 · lib 43 · config 8
- **Unused exported types 968**: schemas 220 · components 178 · types 177 · repositories 100 · services 76 · domains 68 · hooks 52 · constants 25 · shared 25 · stores 13 · utils 12 · errors 11 · lib 6 · config 4 · features 1
- **Duplicate exports 313**: components 238 · hooks 43 · services 15 · stores 6 · constants 4 · utils 3 · lib 2 · errors 1 · config 1

**Phase 3~5 세션 수 재산정**: config 하드닝은 **테스트 인프라만 봉인**했을 뿐 `src/**` 삭제 대상 물량(총 2,951 심볼)은 사실상 그대로다. 따라서 §6의 21~29 세션 추정은 **상한선으로 유효**. 진짜 감축은 각 Phase에서 심볼별 (b)의도적 공개 API·(d)배럴 재수출·(f)Zod 타입-포지션을 grep으로 걸러낼 때 발생하며, Phase 0 config로는 계량 불가.

| Phase | 대상 구역                                                              | Phase 0 후 물량 | 재산정 세션         |
| ----- | ---------------------------------------------------------------------- | --------------- | ------------------- |
| 1     | Duplicate (components 238 · hooks 43 · services 15 · 기타 17)          | 313             | 2~3 (불변)          |
| 3     | 리프 exports(constants·utils·stores·lib·shared = 351) + types 구역 177 | ~530            | 3~4 (불변)          |
| 4     | components (exports 411 + types 178)                                   | 589             | 4~5 (§2 대비 소폭↑) |
| 5     | services·repos·hooks·schemas·domains·errors (exports 833 + types 527)  | ~1,360          | 10~15 (불변)        |

> 핵심: Phase 0의 순효과는 "신호 정화 완료 — 파일·deps·테스트 인프라·바이너리 0, 남은 2,951건은 전부 `src/**` 진짜 분석 대상"이지 Phase 3~5 모수 축소가 아니다. 모수 축소는 Phase 3~5의 per-symbol 판별에서 나온다.

---

## 3. 오탐 분류 체계 (Taxonomy)

knip이 "미사용"으로 보고한 심볼은 아래 6유형 중 하나다. **삭제 전 반드시 유형부터 판별**한다.

### (a) 진짜 죽은 코드 — 삭제 대상

- **정의**: 정의부와 (있다면) 배럴 재수출을 제외하면 코드베이스 어디서도 참조 0.
- **식별 규칙**:
  ```
  Grep(pattern="\bSYMBOL\b", path="uniqn-mobile", glob="*.{ts,tsx}")
  ```
  결과가 (1)정의 파일 (2)그 심볼을 재수출하는 index.ts 배럴 — 이 둘뿐이고, 그 배럴 자체도 미사용이면 → 죽은 코드.
- **처리**: 배치로 삭제. 삭제 후 knip 재측정에서 카운트가 정확히 감소하고 **새 미사용이 안 생기는지** 확인(배럴 재수출 제거가 원본을 고아로 만들 수 있음).

### (b) 의도적 공개 API — 보존 (또는 `@internal` 표기)

- **정의**: 도메인 배럴(`index.ts`)에서 재수출되고 문서/주석으로 공개 표면임이 드러나는 심볼. 현재 소비처가 없어도 계약일 수 있음.
- **예시 증거**: `src/services/auth/authCoreService.ts`의 `getCurrentUser`·`onAuthStateChanged`가 미사용으로 잡히지만, `src/services/auth/index.ts` 배럴이 이들을 공개 재수출한다. (실제 소비자 `collaboratorService.ts`는 로컬 헬퍼 `getCurrentUserIdOrThrow`를 씀 → 배럴 표면은 현재 미소비.) `getCurrentUser`는 코드 주석에 `Deprecated: use authStore or getCurrentUserAsync()`로 명시 → 이는 **의도적 유예 API**이지 실수로 남은 죽은코드가 아님.
- **식별 규칙**: 정의부 JSDoc/주석에 `@public`·`@deprecated`·버전 태그가 있거나, 도메인 최상위 배럴에서 명시적으로 재수출되면 (b) 후보.
- **처리**: 삭제하지 않는다. deprecated면 별도 마이그레이션 티켓으로 분리. 표면만 정리하려면 배럴에서 재수출만 제거(원본은 남김)하는 선택도 가능하나, 이건 고위험 Phase로.

### (c) 엔트리포인트 오탐 — config로 봉인, 절대 삭제 금지

- **정의**: 런타임/툴이 직접 진입하는 파일. import 그래프상 소비되지 않는 게 정상.
- **대상**:
  - `functions/jobs/[id].ts` — Cloudflare Pages Function 진입점
  - `supabase/functions/*/index.ts` 14종 — Supabase Edge Function 진입점
  - `e2e/playwright.config.ts`·`e2e/global-setup.ts`·`e2e/global-teardown.ts` — Playwright 진입점
  - `babel.config.js` — 빌드 설정 진입점
  - `app/**/*.tsx` — expo-router 파일 기반 라우팅(각 파일이 진입점, default export 필수)
- **처리**: **삭제 절대 금지.** Phase 0에서 knip `entry`에 등록해 리포트에서 제거.
- **연관 함정 메모**: `pitfall_knip_falsepositive_build_config` — babel/expo-modules-core 삭제 금지 확정 이력.

### (d) 배럴 재수출 오탐 — 소비 경로 확인 후 판단

- **정의**: `index.ts`가 형제 모듈을 `export { X } from './sibling'`로 재수출하는데, 소비자가 원본(`./sibling`)에서 직접 import하면 배럴의 재수출이 "미사용"으로 뜸.
- **예시 증거**: `src/utils/assignment/index.ts`가 `selectionCore`·`selectionUtils`를 대량 재수출. `src/services/auth/index.ts`가 4개 서비스 파일을 재수출.
- **식별 규칙**: 심볼이 `export { ... } from './...'` 형태로만 등장하고 정의부는 형제 파일에 있으면 (d). 소비 경로 확인:
  ```
  Grep(pattern="import.*SYMBOL.*from '@/utils/assignment'")   # 배럴 경유 소비
  Grep(pattern="import.*SYMBOL.*from '@/utils/assignment/selectionCore'")  # 원본 직접 소비
  ```
  둘 다 0이면 진짜 죽은 재수출(→ 배럴 라인 제거 후보). 원본 직접 소비만 있으면 재수출은 미사용이나 공개 표면일 수 있음(b와 교차).
- **처리**: 배럴 라인 제거는 **원본 심볼을 삭제하는 게 아니라 재수출 한 줄만 지우는 것**. 저위험이나, 그 배럴이 프로젝트 공개 API 진입점이면 (b)로 승급.

### (e) 테스트 인프라 — 대개 오탐, 봉인

- **정의**: `e2e/factories/**`, `src/__tests__/mocks/**`, 테스트 헬퍼. 테스트에서 쓰이나 knip 스코프 밖이거나 팩토리 배럴 경유라 미사용으로 뜸.
- **대상**: e2e 46건(리포트 상단 다수), `src/__tests__/mocks/factories.ts`의 `createMockApplications` 등.
- **처리**: 삭제하지 말고 knip config에서 테스트 디렉터리를 entry/project 스코프로 명시하거나 무시. e2e는 tsconfig-excluded라 tsc 회귀도 안 잡히니 특히 보수적으로.

### (f) 타입-포지션 / Zod 추론타입 — 정밀 확인

- **정의**: `export type X = z.infer<typeof schema>`처럼 타입 위치에서만 쓰이는 심볼. 값 참조가 없어 미사용처럼 보이나 타입 애노테이션으로 사용됨.
- **규모**: schemas(243 export + 220 type)와 types 구역(177)이 집중. 스키마 객체와 추론 타입이 짝으로 수출됨.
- **식별 규칙**: 값 grep이 아니라 타입 위치까지 확인:
  ```
  Grep(pattern=": *X\b|<X>|\bX\[\]|as X\b|extends X\b|Partial<X>|z\.infer<typeof schema>")
  ```
  타입 애노테이션·제네릭 인자로 등장하면 실사용 → 보존. `tsc`가 대개 잡지만, **배럴로 재수출된 추론타입**은 knip이 놓칠 수 있어 수동 확인 필수.
- **처리**: `type-check`를 1차 안전망으로 신뢰하되(삭제 후 tsc red = 타입-포지션 실사용이었다는 증거 → 즉시 복원), 스키마-타입 짝은 함께 판단.

---

## 4. 배치 로드맵

> 위험 오름차순. 각 Phase는 1~여러 세션. **Phase 0 완료 전에는 Phase 1 이하로 내려가지 않는다.**

### Phase 0 — knip config 하드닝 + baseline 재측정 (선행 필수, 코드 삭제 0건)

**목적**: 실제 정리 전에 신호부터 정화. 엔트리포인트·테스트 오탐을 리포트에서 제거해 "진짜 미사용" 모수를 확정.

**작업**:

1. `package.json`의 `knip` 블록에 `entry`/`project` 추가(초안 — 실행 후 knip 출력으로 반복 조정):
   ```json
   "knip": {
     "entry": [
       "app/**/*.{ts,tsx}",
       "functions/**/*.ts",
       "supabase/functions/*/index.ts",
       "e2e/playwright.config.ts",
       "e2e/global-setup.ts",
       "e2e/global-teardown.ts",
       "babel.config.js",
       "metro.config.js",
       "scripts/**/*.{js,ts}"
     ],
     "project": ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
     "ignoreDependencies": ["react-native-mmkv", "react-native-nitro-modules", "expo-intent-launcher"]
   }
   ```
   > 주의: expo-router가 knip 플러그인으로 자동 인식되지 않을 수 있으므로 `app/**`을 명시적 entry로. 위 초안은 시작점이며, knip 재실행 결과를 보고 경로를 가감한다.
2. 재실행: `npx knip`. 아래가 리포트에서 **사라져야** 정상:
   - `functions/jobs/[id].ts`, `supabase/functions/*/index.ts` 14종, e2e config 3종 → Unused files에서 제거
   - e2e 46건 대부분 → Unused exports에서 제거(테스트 팩토리 배럴 경유분)
3. **재측정 스냅샷 기록**: 남은 카테고리별 건수를 이 문서 §2 표 아래 "Phase 0 후 baseline"으로 추가 기록. 이후 모든 Phase 물량은 이 재측정치로 재추정.

**검증 게이트**: config만 바꾸므로 `npm run type-check`·`npm test`는 변화 없어야 함(그린 유지). `npx knip` 카운트가 유의미하게 감소했는지 확인.
**롤백**: `package.json` knip 블록 되돌리기(1파일).
**커밋**: `chore(knip): 엔트리포인트 등록으로 knip 신호 정화`
**분량**: 1 세션.

---

### Phase 1 — Duplicate exports 정리 (`Component|default` 이중수출, 저위험·준자동)

**대상**: 320건 중 components 231(동일 패턴), hooks 46, services 15.

**패턴 확정**: 각 파일이 `export function Foo`(named)와 `export default Foo`를 동시 수출. 소비자는 named를 씀:

- 증거: `app/(auth)/login.tsx`가 `import { BiometricButton, LoginForm, SocialLoginButtons } from '@/components/auth'`(named). 테스트도 `import { LoginForm } from '../LoginForm'`(named). → **default 절반이 죽은 쪽**.

**안전 자동화 가능성**: 준자동. "default 제거"가 방향이나, **파일별로 default-import 소비자가 없는지** grep 게이트를 반드시 통과해야 함:

```
# 안전 판정(둘 다 0이면 default 제거 안전)
Grep(pattern="import +Foo +from '.*Foo'")          # default import 소비자
Grep(pattern="lazy\(\(\) *=> *import\('.*Foo'\)")   # React.lazy 동적 default 사용
# 배럴의 default 재수출 형태도 확인
Grep(pattern="export \{ default as Foo \}")
```

- 셋 다 0 → `export default Foo` 라인만 제거(named 유지).
- 하나라도 있으면 → 그 파일은 "needs-review" 버킷, 이번 배치 제외.

**필수 가드**:

- **`app/**` 라우트 파일 제외\*\*: expo-router는 화면 파일에 default export 필수. Phase 0에서 app/을 entry로 봉인하면 duplicate 리포트에 안 뜨지만, 혹시 섞이면 무조건 제외.
- 스크립트 없이 read-only grep으로 231개를 "safe/needs-review"로 버킷팅한 뒤, safe만 배치.

**검증 게이트**: `npm run type-check`(그린) + 해당 컴포넌트 jest 스위트 + `npx knip`(Duplicate 카운트가 제거 수만큼 감소, 새 Unused 미발생) + `git diff` 리뷰.
**롤백**: 배치 커밋 단위 `git revert` 또는 커밋 드롭.
**분량**: 준자동이라 세션당 50~100파일. **2~3 세션**(231 components → 3세션 내, hooks/services 61 → 별도 마무리).
**커밋 예**: `refactor(components): 중복 default export 제거(named 단일화) 배치 1/3`

---

### Phase 2 — 죽은 파일 + 죽은 의존성 triage (config 정화 후 잔여만)

**대상**: Phase 0 후에도 남는 Unused files, 그리고 dev deps 5종.

**죽은 파일**: Phase 0가 엔트리포인트 오탐을 제거한 뒤 남는 것만 진짜 후보. 예: `scripts/debug-login-state.js`(디버그 스크립트, 실사용 여부 grep 후 판단). 파일 삭제는 심볼 삭제보다 파급이 크므로 **파일별로 import 참조 0 확인 + git log로 최근 참조 이력 확인** 후.

**죽은 의존성 — 대부분 오탐, uninstall 금지 원칙**:
| 패키지 | 판정 | 근거 |
|---|---|---|
| expo-modules-core | 오탐(보존) | 네이티브 peer. `pitfall_knip_falsepositive_build_config` 확정 이력 |
| babel-preset-expo | 오탐(보존) | `babel.config.js`가 사용(그 config 자체가 Phase 0 전 오탐이었음) |
| ts-node | 오탐 가능 | TS 설정 로딩용. 제거 전 config 로더 의존 확인 |
| lint-staged | 오탐 가능 | git hook(husky) 경유. `.husky/`·package.json scripts 확인 |
| @cloudflare/workers-types | **실미사용(제거 가능)** | OG 엣지함수 전용이었고 그 함수가 2026-07-05 제거됨 → 이제 소비처 0. 제거 시 `npm install`로 lock 동기화 |

- **처리**: uninstall 대신 `knip.ignoreDependencies`에 추가로 봉인. 진짜 미사용이 확실한 것만(참조·hook·config 로더 전부 0 확인 후) 별도 커밋으로 제거.

**검증 게이트**: 파일 삭제 후 `npm run type-check` + `npm test` 그린(단 tsconfig-excluded 구역은 tsc가 안 잡으니 해당 구역은 삭제하지 말 것) + `npx knip`.
**분량**: 1 세션.
**커밋 예**: `chore(deps): knip 오탐 의존성 봉인 + 죽은 스크립트 제거`

---

### Phase 3 — 저위험 리프 구역 (constants·utils·stores·lib·shared·types)

**대상(Phase 0 후 재측정 필요)**: constants 87 · utils 126 · stores 51 · lib 43 · shared 44 + Unused exported types 중 types 구역 177. 이들은 대체로 리프(다른 곳에 계약을 강제하지 않음).

**처리 원칙**:

- 유형 (a)진짜죽음 위주. (d)배럴 재수출과 (f)타입-포지션을 grep으로 걸러낸 뒤 삭제.
- utils/constants는 순수함수·상수라 tsc가 회귀를 잘 잡음 → `type-check` 신뢰도 높음.
- stores(zustand 등)는 selector가 동적으로 참조될 수 있으니 store별 소비 확인.

**검증 게이트**: 구역별 배치마다 `npm run type-check` + 관련 jest 스위트 + `npx knip`(카운트 감소·새 미사용 0) + `git diff`.
**분량**: 구역당 1 세션 내외, **총 3~4 세션**.
**커밋 예**: `refactor(utils): 미사용 export 제거 (구역 batch)`

---

### Phase 4 — 컴포넌트 구역 (UI 리프, 배럴 주의)

**대상(재측정 필요)**: components 317(Unused exports) + 142(Unused exported types). Phase 1에서 default 중복은 이미 처리됐으므로 여기선 진짜 안 쓰이는 컴포넌트/props 타입.

**처리 원칙**:

- 컴포넌트 자체가 미사용이면 (a). 단 `src/components/**/index.ts` 배럴 재수출(d)과 교차 확인 필수 — 배럴만 미사용이고 실제 컴포넌트는 화면에서 직접 import될 수 있음.
- props 타입(`XxxProps`)은 (f) 타입-포지션 — 컴포넌트가 살아있으면 타입도 보존.
- expo-router `app/**` 화면은 Phase 0에서 entry 봉인 → 삭제 후보에 없어야 정상.

**검증 게이트**: `npm run type-check` + 컴포넌트 jest/RTL 스위트 + `npx knip` + `git diff`. UI는 렌더 회귀가 잦으니 삭제 대상 컴포넌트가 어느 화면에도 안 붙는지 grep 재확인.
**분량**: **4~5 세션**(459건 규모).
**커밋 예**: `refactor(components): 미사용 컴포넌트/타입 제거 batch N`

---

### Phase 5 — 고위험 공개 API 계약 구역 (심볼별 판단)

**대상(재측정 필요)**: services(221+72) · repositories(36+91) · hooks(197+53) · schemas(243+220) · domains(59+71) · errors(61). 레이어 경계 계약이라 **배치 자동화 금지, 심볼 단위로 판단**.

**구역별 특이 리스크**:

- **services / repositories**: 레이어 계약(Presentation→Hooks→Service→Repository→Supabase). 현재 소비처 0이어도 (b)의도적 공개 API 다수. 예: authCore 원시함수(§3-b). 삭제 전 도메인 배럴 재수출 여부 + deprecated 주석 확인. TanStack Query 읽기전용이 Repository를 직접 호출하는 경로도 있으니 hooks뿐 아니라 쿼리키 사용처까지 grep.
- **hooks**: 커스텀 훅이 배럴로 재수출되거나 조건부로만 쓰일 수 있음. hooks 46 duplicate(Phase 1과 중복 주의)와 구분.
- **schemas (Zod)**: (f) 타입-포지션 집약 구역. 스키마 객체(`xxxSchema`)와 추론타입(`z.infer`)이 짝. 스키마는 런타임 검증(경계 밸리데이션)에 쓰이므로 값 참조 grep, 타입은 타입 grep 별도. CLAUDE.md: 모든 사용자 입력에 `z.string().refine(xssValidation)` 필수 → 스키마 삭제는 보안 경계 훼손 위험.
- **domains / errors**: AppError(E1~E7) 체계. 에러 클래스/코드는 throw 지점이 흩어져 동적으로 매핑될 수 있음(`pitfall_rls_violation_multi_cause_mapping`). 코드 상수 삭제는 신중.

**처리 원칙**: 심볼 1개당 §3 유형 판별 → (a)만 삭제. 세션당 처리량을 낮게(20~40 심볼) 잡고, 각 심볼 삭제 직후 type-check.
**검증 게이트**: 심볼 배치마다 `npm run type-check` + **광역 jest**(`npm test`, 계약 변경이라 관련 스위트만으론 부족) + `npx knip` + `git diff`. 스키마 삭제 시 해당 입력 경로 e2e/통합 흐름 점검.
**분량**: **10~15 세션**(1,324건 규모, 심볼별 판단).
**커밋 예**: `refactor(services): 확인된 죽은 export 제거 (심볼별 검증)`

---

## 5. 배치 공통 검증 프로토콜 (모든 Phase 필수)

각 배치는 아래 게이트를 **이번 배치에서 직접 실행**해 통과해야 완료로 본다(전역 verification.md 준수 — 이전 실행 결과 재사용 금지).

```
1. 삭제 전: 대상 구역 knip 카운트 스냅샷  (npx knip)
2. 삭제 실행 (심볼/파일)
3. 타입 회귀:  npm run type-check   → exit 0 (0 errors)
   └ red면 그 심볼은 (f)타입-포지션 실사용이었다는 증거 → 즉시 복원
4. 테스트 회귀: npm test (또는 구역 스위트; Phase 5는 전체)  → 0 failures
   └ red면 (b)/(e) 실사용 → 복원
5. knip 재측정:  npx knip
   └ 대상 카운트가 삭제 수만큼 감소했는가?
   └ ★ 새로운 Unused가 생기지 않았는가? (배럴 재수출 제거가 원본을 고아로 만드는 캐스케이드 점검)
6. git diff 리뷰: 의도한 심볼만 지웠는가, 관련 없는 변경 없는가
7. 로컬 커밋 (한글 컨벤션). push는 사용자 지시 전까지 금지.
```

**Red-Green(회귀 없음 증명)**: 죽은 코드 제거는 "지웠는데 그린"이 곧 안전 증명이다. 반대로 3·4에서 red가 나면 그 심볼은 오탐이었다는 신호 → 심볼 단위로 되돌려 Green 복원. `npm run quality`(type-check + lint + format:check)는 배치 마무리 시 1회.

**롤백**: 배치는 항상 **1커밋 = 1배치**. 문제 시 `git revert <sha>` 또는 미push 상태면 커밋 드롭(`git reset`). 심볼 단위 되돌림은 `git restore <file>`.

---

## 6. 세션 수·순서 추정 + 중단/재개

| Phase | 내용                                                       | 위험         | 예상 세션         |
| ----- | ---------------------------------------------------------- | ------------ | ----------------- |
| 0     | knip config 하드닝 + 재측정                                | 없음(설정만) | 1                 |
| 1     | Duplicate `Component\|default` dedup                       | 저           | 2~3               |
| 2     | 죽은 파일 + 죽은 deps 봉인/제거                            | 저           | 1                 |
| 3     | 리프 구역(constants·utils·stores·lib·shared·types)         | 저~중        | 3~4               |
| 4     | 컴포넌트(Unused exports/types)                             | 중           | 4~5               |
| 5     | 공개 API 계약(services·repos·hooks·schemas·domains·errors) | 고           | 10~15             |
| —     | **합계**                                                   |              | **약 21~29 세션** |

> ★ 위 세션 수는 **Phase 0 이전 상한선 모수** 기준이다. Phase 0 재측정에서 오탐이 대량 제거되면(엔트리·배럴·테스트) 실제 Phase 3~5 물량이 크게 줄 수 있다. **Phase 0 종료 시 §2에 재측정치를 적고, Phase 3~5 세션 수를 다시 산정**할 것.

**순서 엄수**: 0 → 1 → 2 → 3 → 4 → 5. 저위험을 먼저 끝내 knip 신호를 계속 깨끗하게 유지해야, 고위험 Phase에서 "이번에 새로 생긴 미사용"을 신뢰성 있게 식별할 수 있다.

**중단/재개 지점**:

- 각 Phase 경계가 자연 중단점(각 Phase는 독립 커밋 묶음).
- Phase 내부는 "구역 배치" 단위로 중단 가능 — 재개 세션은 `npx knip`으로 현재 카운트를 다시 찍고, 이 문서 §2 재측정치와 비교해 남은 구역부터.
- 재개 시 첫 행동: `git status`로 미커밋 잔여 확인(병렬 세션 격리 규칙) + `npx knip` 현재 스냅샷.

---

## 7. 프로젝트 특이 주의사항 (반드시 준수)

- **커밋 메시지 한글**: `<type>(<scope>): <한글 설명>`. type ∈ feat/fix/refactor/style/docs/test/chore/perf. 이 작업은 대부분 `refactor`·`chore`.
- **로컬 커밋만**: 커밋은 사전 승인(매번 묻지 않음). **push/PR은 사용자 명시 지시 전까지 금지.** 기본 브랜치(master)면 feature 브랜치 먼저.
- **병렬 세션 격리**: 착수 전 `git status`. 내가 만들지 않은 미커밋 변경이 있으면 새 워크트리+브랜치로 격리.
- **tsc 사각지대**: `tsconfig.json`이 `functions/`·`supabase/functions/`·`e2e/`를 exclude → 이 구역 변경은 `npm run type-check`로 회귀가 **안 잡힌다**. 이 구역은 삭제 대상이 아니라 config 봉인 대상(Phase 0). e2e는 `e2e/tsconfig.json` 별도 존재.
- **knip 오탐 확정 이력**: `pitfall_knip_falsepositive_build_config`(babel/expo-modules-core 삭제 금지), 현행 `ignoreDependencies`(mmkv/nitro/intent-launcher)는 네이티브 peer 보호 — 건드리지 말 것.
- **레이어 아키텍처 계약**: Presentation→Hooks→Service→Repository→Supabase. Presentation/Hooks의 Supabase 직접 호출 금지, DB 접근은 Service→Repository 경유. Phase 5에서 이 계약 표면을 지울 때 "현재 미소비 = 삭제 가능"으로 단정 금지.
- **보안 경계(Zod)**: 모든 사용자 입력은 `z.string().refine(xssValidation)`. 스키마 삭제는 입력 검증 경계 훼손 가능 → Phase 5에서 값·타입 소비 모두 확인.
- **로깅**: 앱 런타임 `console.log` 금지(`logger.*`). 단 `functions/**`는 예외(삭제 안 하니 무관).

---

## 8. 부록 — 이 로드맵의 증거 로그 (조사 근거, 2026-07-05 실측)

| 발견                                                | 근거 파일 / 위치                                                                                                                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| knip config에 entry 미설정                          | `package.json:160-166` (ignoreDependencies 3종만)                                                                                                                                                                 |
| tsconfig가 functions/supabase-functions/e2e exclude | `tsconfig.json:47-52`                                                                                                                                                                                             |
| 엔트리포인트 오탐(Cloudflare/Supabase/e2e)          | knip 리포트 Unused files 26 중 `functions/jobs/[id].ts`, `supabase/functions/*/index.ts` 14종, e2e config 3종                                                                                                     |
| 인증 원시함수 오탐(배럴 재수출·deprecated)          | `authCoreService.ts:486,521`에 `getCurrentUser`/`onAuthStateChanged` 정의(주석 Deprecated) → `services/auth/index.ts:36,39` 배럴 재수출 → 실소비자 `collaboratorService.ts`는 로컬 `getCurrentUserIdOrThrow` 사용 |
| 배럴 재수출 오탐 표본                               | `src/utils/assignment/index.ts`(selectionCore/selectionUtils 재수출), `src/services/auth/index.ts`(4개 서비스 재수출)                                                                                             |
| Duplicate = `Component\|default`, 소비자는 named    | knip Duplicate exports 320(components 231). `app/(auth)/login.tsx:6` = `import { LoginForm } from '@/components/auth'`(named), 테스트도 named                                                                     |
| Zod 타입-포지션 집약                                | knip Unused exported types 977 중 schemas 220·types 177                                                                                                                                                           |
| deps 5종 대부분 빌드/툴 오탐                        | knip Unused (dev)deps: expo-modules-core·babel-preset-expo·ts-node·lint-staged·@cloudflare/workers-types                                                                                                          |

> 원본 knip 전체 리포트(2742행)는 세션 스크래치패드에 보관. 재측정은 `npx knip`로 갱신하며, Phase 0 후 이 문서 §2에 재측정 스냅샷을 추가 기록할 것.

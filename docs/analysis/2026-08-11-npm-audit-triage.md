# npm audit 21건 분류 (감사 dep-02) — 2026-08-11

> 원장: `docs/planning/2026-08-09-audit-followup-session-prompts.md` 세션6 항목 5
> 실측 시점: 2026-08-11 (react-native 0.83.10 상향 반영 후)

## 결론 먼저

**`npm audit fix` 로 고칠 수 있는 것은 0건이다.** 21건 전부가 Expo SDK 툴체인 안에서
전이(transitive)로 들어오고, npm 이 제안하는 "수정"은 예외 없이 **현재보다 낮은 메이저 버전으로의
다운그레이드**다(`expo@53`, `react-native@0.72`). 적용하면 SDK 55 가 통째로 깨진다.

따라서 이 21건은 **Expo SDK 57 마이그레이션 열차에 편입**한다 —
`eslint-plugin-react-hooks 7.x`(#380)가 기다리는 것과 같은 열차다.

## 실측 (2026-08-11)

| 심각도 | 건수 |
|---|---|
| critical | 0 |
| high | 13 |
| moderate | 8 |
| low / info | 0 |
| **합계** | **21** |

의존성 규모: prod 887 / dev 515 / optional 103.

### 직접 의존성으로 표시된 4건

| 패키지 | 심각도 | npm 제안 | 판정 |
|---|---|---|---|
| `expo` | high | `expo@53.0.27` (MAJOR **하향**) | ❌ 적용 불가 — SDK 55 → 53 다운그레이드 |
| `react-native` | high | `react-native@0.72.17` (MAJOR **하향**) | ❌ 적용 불가 — RN 0.83 → 0.72 다운그레이드 |
| `expo-splash-screen` | moderate | `57.0.6` (MAJOR) | ⏸ SDK 57 동반 |
| `jest-expo` | moderate | `57.0.4` (MAJOR) | ⏸ SDK 57 동반 |

⚠️ `expo`·`react-native` 두 건은 npm 의 advisory 레인지 계산이 만드는 **전형적 오탐 패턴**이다.
취약점은 하위 패키지(`@expo/cli`, `@react-native/community-cli-plugin`)에 있는데,
npm 이 "그 하위 패키지가 안전했던 마지막 상위 버전"을 찾다 보니 과거 메이저를 가리킨다.

### 전이 의존성 high 11건

`@expo/cli` · `@expo/metro` · `@expo/metro-config` · `@react-native/community-cli-plugin` ·
`metro` · `metro-config` · `metro-transform-worker` · `brace-expansion` · `image-size` ·
`js-yaml` · `nanoid`

## 노출면 판정 — 왜 지금 급하지 않은가

위 11건은 **전부 빌드타임/개발 도구 체인**이다:

- `metro`·`@expo/metro*`·`@react-native/community-cli-plugin` — 번들러. 개발자 머신과 CI 에서만 돈다.
- `@expo/cli` — CLI. 배포 산출물에 들어가지 않는다.
- `image-size`(ICNS/JXL/HEIF DoS) · `js-yaml`(quadratic CPU) · `nanoid` · `brace-expansion`(DoS)
  — 전부 위 번들러/CLI 체인 경유다.

즉 **사용자 기기에서 도는 앱 번들에는 도달하지 않는다.** 위협 모델상
"공격자가 우리 CI 나 개발자 머신에 악의적 입력(이미지·YAML)을 먹일 수 있는가"가 관건인데,
현재 빌드 입력은 전부 레포 내부 자산이다.

⚠️ 단, 이 판정은 **각 CVE 의 실제 도달 경로를 개별 검증한 것이 아니라**
패키지의 역할로 추론한 것이다. SDK 57 마이그레이션 때 재확인 대상이다.

## 조치

| 항목 | 조치 | 시점 |
|---|---|---|
| 21건 전량 | Expo SDK 57 마이그레이션에 편입 | SDK 57 열차 |
| `eslint-plugin-react-hooks 7.x`(#380) | 같은 열차 — `eslint.config.js` 플러그인 이중 등록이 7.x 에서 하드 에러 | 동일 |
| `react-native` 0.83.6 → **0.83.10** | ✅ 완료 (SDK 55 기대 패치) | 이번 세션 |

🚫 **하지 말 것**: `npm audit fix --force`. 위 표대로 메이저 하향을 실행해 SDK 55 를 깬다.

## 다음에 이 문서를 볼 때

숫자는 낡는다. 재실측:

```bash
cd uniqn-mobile && npm audit --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s);console.log(a.metadata.vulnerabilities)})"
```

판정이 바뀌는 조건은 하나다 — **런타임 의존성**(앱 번들에 들어가는 패키지)에
취약점이 생기는 것. 그때는 SDK 열차를 기다리지 말고 개별 대응한다.

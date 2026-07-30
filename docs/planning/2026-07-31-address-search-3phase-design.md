# 주소 검색 · 좌표 · 지도 3단계 설계 (2026-07-31)

> 공고 작성의 자유텍스트 주소를 **실제 주소 기반 검색**으로 전환하고, 좌표·지도까지 가는 3단계 설계.
> 이 문서는 **코드 실측이 끝난 착수점**이다. 아래 "이미 확인된 사실"은 재조사하지 말 것.
> 실측 세션: 2026-07-31 · 원안(사용자 프롬프트) 대비 **정정 5건** 포함.

---

## 0. 다음 세션에 붙여넣을 프롬프트

```
docs/planning/2026-07-31-address-search-3phase-design.md 를 읽고 1단계를 구현해줘.

"이미 확인된 사실"은 file:line 까지 검증된 것이다 — 재조사 금지.
§3 "원안 대비 정정" 을 반드시 먼저 읽어라. 원래 프롬프트의 지시 중 5건이 틀렸다.

1단계는 외부 키가 전혀 필요 없고 DB 마이그레이션도 없다.
§5 의 함정 목록을 확인하고, §6 검증 게이트를 통과한 뒤 PR 을 올려줘.
2·3단계는 이번 범위가 아니다.

브랜치: claude/job-posting-address-map-lbrvzd
```

---

## 1. 결론 요약

| 단계 | 내용 | 외부 세팅 | DB | 상태 |
|---|---|---|---|---|
| **1** | 다음 우편번호 검색 + region 자동선택 + 상세주소 UI | **없음** | 없음 | 착수 가능 |
| **2** | 좌표 — EF 지오코딩 + `mapLink` 좌표 승격 | REST 키만 | **새 컬럼** | 키 재발급 후 |
| **3** | 카카오맵 임베드 | JS 키 + 도메인 등록 + CSP 3종 | 없음 | **보류·재평가** |

핵심 판단 2개:

- 🔴 **좌표를 `location` jsonb 에 넣으면 구버전 앱에서 공고가 통째로 사라진다.** 새 컬럼은 안전하다(§2-A).
- 🟡 **3단계의 사용자 가치 대부분은 2단계가 끝나는 순간 이미 도착한다**(§2-G). 임베드 지도는 남는 가치를 보고 다시 판단한다.

---

## 2. 이미 확인된 사실 (재조사 금지 — file:line 검증됨)

### A. 저장 위치가 안전성을 가른다 (가장 중요)

`toJobPosting` 이 **파싱 전에** 클라이언트 자기 버전의 컬럼 화이트리스트로 걸러낸다:

```
src/repositories/supabase/JobPostingRepositoryHelpers.ts:41-42
  if (!ALLOWED_CAMEL_COLUMNS.has(key)) continue;   // 스키마 미등록 컬럼 제외
src/repositories/supabase/JobPostingRepositoryHelpers.ts:45
  return parseJobPostingDocument(clean);           // ← .strict() 파스는 그 뒤
```

| 저장 위치 | 구버전 앱 | 근거 |
|---|---|---|
| `location` jsonb 안 **새 키** | 💥 **공고 증발** | 컬럼 필터를 통과한 뒤 `postingLocationSchema`(`.strict()`)가 거부 → 문서 전체 safeParse 실패 → `parseJobPostingDocument` null |
| **새 DB 컬럼** | ✅ **안전** | 구버전의 `ALLOWED_CAMEL_COLUMNS` 에 없어 파스 전에 제거됨. `select('*')` 경로도 동일 |

- `postingLocationSchema` = `.strict()`, 필드 4개뿐 (`name`/`district`/`region`/`detailedAddress`) — `src/schemas/jobPosting.schema.ts:127-135`
- `postingLocationInputSchema` = `.strict()` — `:137-161`
- `jobPostingDocumentSchema` = `.strict()` — `:464-508`
- **이 실패는 이미 겪었고 코드에 이름이 붙어 있다** — `:474-476`:
  > *"`.strict()` 스키마라 키를 등록하지 않으면 **venue_id 를 select 하는 순간 read 가 증발**하고(#194 클래스), 직렬화에 venueId 가 실리면 assertCanonical 이 throw 한다"*
- 새 컬럼이 안전하다는 실증: `last_work_date` 컬럼이 존재하고 `select('*')`(`JobPostingRepository.ts:295`)에 실려 오지만 문서 스키마에 미등록인데도 아무것도 안 깨진다

### B. `address` 는 이미 저장되지 않는다

폼의 `location.address` 는 저장 직전 `district` 로 **접힌다**:

```
src/domains/job-posting/serialization.ts:157
  const district = normalizeOptionalText(location.district) ?? normalizeOptionalText(location.address);
src/domains/job-posting/serialization.ts:173-174
  ...(district ? { district, address: district } : {})   // 읽을 땐 둘 다로 복원
```

→ **도로명주소와 시군구를 동시에 저장할 자리가 현재 없다.** 하나를 골라야 한다(1단계는 도로명주소 선택).
→ `Location.coordinates`(`src/types/common.ts:83`)가 한 번도 안 채워진 이유도 이것이다 — 채울 수가 없었다.

### C. 지역 자동매핑은 거의 공짜다

다음 우편번호가 돌려주는 값(공식 가이드 실측):

| 필드 | 예시 |
|---|---|
| `sido` | `경기` ← **축약형** |
| `sigungu` | `성남시 분당구` ← **2단계가 한 문자열** |

우리 slug 포맷이 `{시도} {시군} {구}` 이므로 **`` `${sido} ${sigungu}`.trim() `` 이 곧 slug**:

```
서울 + 강남구        → 서울 강남구          ✅
경기 + 성남시 분당구  → 경기 성남시 분당구    ✅
충북 + 청주시 상당구  → 충북 청주시 상당구    ✅
세종 + (빈 문자열)    → 세종                 ✅
```

→ 퍼지 매칭이 아니라 `isRegionSlug()` **직접 조회**로 끝난다.

### D. 매핑 유틸은 이미 있다 — 새로 만들면 4번째 구현체

| 구현 | 위치 |
|---|---|
| TS 원본 | `src/constants/regions.ts:707` `findRegionByAddress` |
| 단위 테스트 20+ | `src/constants/__tests__/regions.test.ts:284-351` |
| SQL 포팅 | `derive_region_slug()` — baseline `20260710000002_baseline_schema_from_prod.sql:1815`, pgTAP `supabase/tests/derive_region_slug.test.sql` |
| 실사용 | `app/(app)/(tabs)/home-jobs.tsx:86` |

이미 "강서구 ⊃ 서구", "경기 광주 vs 광주광역시" 충돌을 처리해 놨다(가장 긴 keyword 우선 정렬).

### E. 웹 CSP 가 다음 우편번호를 차단한다

`public/_headers` 전역 CSP 실측:

- `script-src` 에 `https://t1.daumcdn.net` **없음** → 스크립트 로드 실패
- `frame-src 'self' https://accounts.google.com https://www.google.com` → embed iframe 차단

⚠️ iframe 오리진은 문서에 나오는 `postcode.map.daum.net` 이 아니라 **`https://postcode.map.kakao.com`** 이다
(`postcode.v2.js` 34KB 실물에서 확인한 prod 도메인).

### F. 현재 주소 입력 실태

- 장소명·주소 모두 순수 `TextInput` — `src/components/employer/order-sheet/sheets/PlaceSheet.tsx:173-189`
- 검증은 XSS(`safeText`) + 길이뿐 — `src/schemas/orderSheet.schema.ts:120-140`
- `detailedAddress` 는 **타입·스키마·DB 가 이미 받을 준비 완료, UI 만 없다**
- `region` 은 제출 필수 게이트 — `orderSheet.schema.ts` superRefine (미선택 시 `'지역을 선택해주세요'`)
- 인라인 3단 모드 `'list' | 'new' | 'region'` — `PlaceSheet.tsx:44`
- **중첩 RN Modal 금지** — `PlaceSheet.tsx:4-8` 주석 (#186/#243 iOS 터치먹통)
- 브라우저 높이 bound 계산 — `PlaceSheet.tsx:78-85`

### G. 지도 길찾기는 이미 동작 중이다

```
src/utils/mapLink.ts                            네이버지도/애플지도/카카오맵, expo-linking 만 사용
src/components/schedule/tabs/InfoTab.tsx:144    스태프 스케줄 상세에서 소비
```

`mapLink.ts` 주석이 도입 이유를 적어놨다 — *"처음 가는 홀덤펍에 정시 도착해야 하는 스태프가 앱을 나가 지도 앱에 주소를 손으로 다시 치고 있었다."* **그 문제는 이미 해결돼 있다.**

카카오맵 URL 스킴(공식 가이드)은 좌표만 있으면 정밀 핀을 준다:

```
https://map.kakao.com/link/map/{이름},{위도},{경도}
https://map.kakao.com/link/to/{이름},{위도},{경도}     ← 길찾기 목적지
```

→ **2단계가 끝나면 키 0개·WebView 0개·CSP 0줄·도메인 등록 0건으로 정밀 길찾기가 완성된다.**

### H. WebView 는 이미 프로덕션 가동 중이다

- `react-native-webview@13.16.0` 직접 import 는 `src/`·`app/` 에 **0건**
- 그러나 `@portone/react-native-sdk` 가 `react-native-webview` 를 **peerDependency 로 요구**하고,
  `src/components/auth/PortOneIdentityVerification.tsx:15` 가 그것을 `@/components/ui/Modal` **안에서** 렌더한다
- → **RN Modal 안 WebView 조합은 이 앱에서 이미 검증됐다**
- 웹 분기 선례: `SheetProvider.web.tsx` · `PortOneIdentityVerification.web.tsx` · `QRCodeScanner.web.tsx` · `BottomSheet.web.tsx`
- `SheetModal` 자체가 이미 `WebSheetModal` / `NativeSheetModal` 로 내부 분기돼 있다

### I. e2e 영향은 없다

- `e2e/` 전체에 `order-sheet-place` testID **0건**
- `detailedAddress` 는 11곳에 있으나 전부 **DB 시드 팩토리 데이터**(`e2e/factories/job.factory.ts:128` 등) — UI 변경과 무관
- ⚠️ 그래도 상수·문구를 바꾸면 `e2e/` 는 `npm run quality` 범위 밖이므로 별도 Grep 필요(PR#353 선례)

### J. knip

`package.json` `knip.ignoreDependencies` 에 `react-native-webview` **없음**. 사용처 추가는 이슈를 늘리지 않고 줄이는 방향이므로 래칫(`--max-issues=2189`)에 안전하다.

---

## 3. 원안 대비 정정 (5건)

| # | 원안 | 실제 | 근거 |
|---|---|---|---|
| 1 | 2단계에서 "좌표를 location jsonb 에 저장" | 🔴 **금지** — 구버전 앱 공고 증발. **새 컬럼**에 저장 | §2-A |
| 2 | `src/utils/region/addressToRegion.ts` 신설 | **불필요** — `findRegionByAddress` 이미 존재 + SQL 포팅까지. 구조화 매핑(`sido+sigungu`)을 얹고 기존 함수를 폴백으로 | §2-C, §2-D |
| 3 | "e2e 가 `order-sheet-place-name` testID 참조" | **0건**. `detailedAddress` 는 시드 데이터뿐 | §2-I |
| 4 | "react-native-webview 첫 사용처" | 직접 import 는 0건 맞으나 PortOne 이 peer 로 이미 런타임 사용 중 | §2-H |
| 5 | "region 67개 slug" | 67개는 **레거시 불변 집합**. 현재는 3단계 택소노미(도>시>구) | `regions.ts:1-18` 주석 |

---

## 4. 외부 세팅 상태 (2026-07-31 기준)

### 카카오 개발자 — ✅ 완료

앱 `uniqn` (ID **1384775**, 비즈 앱)

| 항목 | 상태 |
|---|---|
| 카카오맵 사용 설정 | **ON** |
| [카카오맵 무료 쿼터] 뱃지 | **있음** → 계정 첫 번째 활성화 앱 |
| 쿼터 단위 | **일간** |

⚠️ **2026-07-21 정책 변경**: 카카오맵 무료 쿼터는 개발자 계정 기준 **첫 번째로 활성화한 앱에만** 제공되고,
콘솔 안내대로 *"무료 쿼터를 제공받는 앱은 카카오맵 API를 비활성화해도 변경할 수 없다"* — 이 앱에 **영구 귀속**됐다.
웹에 있는 카카오맵 도입 가이드·블로그는 대부분 이 변경 이전 것이므로 참고하지 말 것.

**무료 쿼터 (일간)**

| API | 제공량 | 단계 |
|---|---|---|
| 주소로 좌표 변환 | **100,000건** | 2 |
| 지도 Web(JavaScript) SDK | 300,000건 | 3 |
| 지도 Android/iOS SDK | 300,000건 | 3 |

2단계는 **공고 저장 시 1회** 호출이므로 일 10만 건이면 사실상 무제한.
3단계는 화면을 볼 때마다 소모되므로 일 30만 건이 실제 제약이 된다.

### 남은 세팅

| # | 항목 | 필요 단계 | 담당 |
|---|---|---|---|
| 1 | **REST API 키 재발급** — 평문으로 대화창에 노출됨 | 2 | 사용자 |
| 2 | 웹 플랫폼 도메인 등록 | **3만** | 사용자 |

**키 배선 위치**

| 키 | 성격 | 위치 |
|---|---|---|
| JavaScript 키 | 공개값(도메인 제한으로 보호) | `EXPO_PUBLIC_KAKAO_JS_KEY` — `.env`(gitignore 확인됨: `uniqn-mobile/.gitignore:30-31`) |
| REST API 키 | **시크릿** | Supabase EF 시크릿 `KAKAO_REST_API_KEY`. 선례 = `PORTONE_API_SECRET`(`supabase/functions/verify-portone-identity/index.ts:103`) |
| 네이티브 앱 키 | 공개값 | 이번 작업 불필요(카카오 로그인 SDK용) |

🔴 **REST 키에 `EXPO_PUBLIC_` 접두사 금지** — 붙는 순간 클라이언트 번들에 들어간다.
⚠️ `eas update` 는 **shell env 만 평가**한다 — `app.config` fallback + 명시 export 없으면 OTA 번들에 값이 안 실린다(기존 프로젝트 함정).

**3단계용 등록 도메인** (`wrangler.toml` 실측)

```
https://uniqn.app
https://www.uniqn.app
https://uniqn-app.pages.dev
http://localhost:8081          ← expo web 개발
```

⚠️ Preview 배포는 `<hash>.uniqn-app.pages.dev` 로 해시가 매번 바뀐다. 이 프로젝트는 워크트리에서 배포하면 Preview 로 나가므로, 와일드카드 등록이 안 되면 **Preview 환경에서만 지도가 죽는다**.

---

## 5. 단계별 설계

### 1단계 — 우편번호 검색 (키 0 · 마이그 0)

**필드 배치 (키 추가 0 · 스키마 무변경)**

| 저장 필드 | 채울 값 |
|---|---|
| `district` | `roadAddress` (현행 `address→district` 붕괴 경로 그대로) |
| `region` | `` `${sido} ${sigungu}` `` → slug 자동 |
| `detailedAddress` | 층/호 신규 입력 UI |

시군구는 `getRegionLabel(region)` 으로 파생되므로 별도 저장 불필요.
`JobPostingRepository.ts:396` 의 `location->>district` eq 필터는 의미를 잃지만 **UI 사용처 0건**이라 실질 무해.

**region 자동선택 폴백 사슬**

```
① `${sido} ${sigungu}`.trim() → isRegionSlug() 정확일치
② 마지막 토큰 제거(시 레벨) → 정확일치
③ findRegionByAddress(roadAddress)   ← 기존 퍼지 매칭
④ 실패 → mode:'region' 수동 선택으로 폴백 (조용히 넘어가지 말 것)
```

④가 필수인 이유: `region` 은 제출 필수 게이트다(§2-F).

**UI**

- 주소 `TextInput` → **주소 검색 버튼**으로 교체
- 우편번호 UI 는 **RN Modal 이 아니라 `mode: 'postcode'` 인라인 렌더**
  (중첩 Modal 금지 §2-F. 높이는 `regionBrowserHeight` 와 같은 방식으로 bound)
- 검색으로 채운 주소는 **직접 수정 불가**, 재검색만 허용
- 주소 확정 후 상세주소(층/호) 입력 필드 노출

> 벤더도 같은 방향을 권고한다 — 공식 가이드: *"webview 브라우저에서 position:fixed, inner-scroll 이용 시 가상키보드 터치 불량… 모바일 환경에서는 가급적 '페이지에 끼워넣기' 예제를 추천"*

**플랫폼 분기**

| 플랫폼 | 방식 |
|---|---|
| 네이티브 | `react-native-webview` + 로컬 HTML(스크립트 로드) → `window.ReactNativeWebView.postMessage` 로 결과 회수 |
| 웹 | 다음 우편번호 스크립트 직접 로드 (`.web.tsx` 분기 — 선례 §2-H) |

**CSP** (`public/_headers`, 1·3단계 몫 동시 설계 권장)

```
1단계: script-src += https://t1.daumcdn.net
       frame-src  += https://postcode.map.kakao.com
3단계: script-src  += https://dapi.kakao.com
       connect-src += https://dapi.kakao.com
       img-src     += <타일 도메인 — 키 발급 후 실측>
```

### 2단계 — 좌표

- 지오코딩은 **쓰기 시점 1회**, Edge Function 에서 REST 키로. 읽기 경로에 키가 안 붙는다
- 입력은 우편번호가 준 **정규 도로명주소**라 정확도가 사실상 100%
- 저장은 **새 컬럼**(`geo_lat`/`geo_lng` 또는 `geo jsonb`). `location` jsonb 금지(§2-A)
- 🔴 새 컬럼은 **3곳에 동시 등록**:
  1. `TABLE_COLUMNS` — `JobPostingRepositoryHelpers.ts:18-19`
  2. `ALLOWED_CAMEL_COLUMNS` — 위에서 자동 파생(`:22-26`)
  3. `jobPostingDocumentSchema` — `jobPosting.schema.ts:464-508`

  한 곳만 빠져도 read 증발 또는 `assertCanonical` throw (#194 클래스, §2-A)
- 런타임 `PostingLocation.coordinates` 는 **파스 성공 이후** 서비스 레이어에서 주입 — 스키마 무관
- 지오코딩 실패 시 NULL 허용 → 기존 텍스트 검색 폴백 (fail-open 금지)
- **`mapLink.ts` 좌표 승격**: `link/search/{주소텍스트}` → `link/to/{이름},{lat},{lng}`
  → 여기서 사용자 가치 대부분이 도착한다(§2-G)
- 마이그레이션은 **MCP `apply_migration` 전용**(`db push` 금지). 컬럼만 추가이므로 prod 파리티(함수 183 / 정책 111) 불변

### 3단계 — 임베드 지도 (보류·재평가)

2단계 후 남는 가치는 "앱 안에서 지도가 보인다"뿐이다. 그에 드는 비용:

| 항목 | 내용 |
|---|---|
| 도메인 등록 **필수** | *"등록된 사이트 도메인에서만 지도API를 사용할 수 있기 때문에 반드시 등록해주세요"* — `apis.map.kakao.com/web/guide` |
| 네이티브 WebView | origin 이 없어 도메인 검증 실패 → `source={{ html, baseUrl }}` 우회. **문서화되지 않은 우회**라 SDK 업데이트로 깨질 수 있음 |
| 웹 CSP | script-src / connect-src / img-src 3종 추가 |
| 쿼터 | 읽기마다 소모 (일 300,000건) |

타깃(단발 알바 스태프)이 필요한 것은 *가는 것*이지 *보는 것*이 아니다. 2단계 완료 후 실제 요구를 보고 판단한다.

---

## 6. 함정 목록

| # | 함정 | 대응 |
|---|---|---|
| 1 | `location` jsonb 새 키 = 구버전 공고 증발 | 새 컬럼만 사용. §2-A |
| 2 | 새 컬럼 3곳 등록 중 1곳 누락 = read 증발 | §5 2단계 체크리스트 |
| 3 | 중첩 RN Modal = iOS 터치먹통 재발 | `mode: 'postcode'` 인라인. `PlaceSheet.tsx:4-8` |
| 4 | CSP 위반은 **에러 없이 빈 화면** | 브라우저 콘솔로 직접 관찰. 정적 검사 불충분 |
| 5 | iframe 오리진 오등록 | `postcode.map.kakao.com` (문서의 `daum.net` 아님) |
| 6 | region 자동매핑 실패를 조용히 통과 | 반드시 `mode:'region'` 수동 폴백 — 제출 필수 게이트 |
| 7 | REST 키 클라 노출 | `EXPO_PUBLIC_` 금지. EF 시크릿만 |
| 8 | `eas update` 가 env 를 못 읽음 | `app.config` fallback + 명시 export |
| 9 | `e2e/` 는 `npm run quality` 범위 밖 | 상수·문구 변경 시 별도 Grep |
| 10 | 행정구역 개편 시차 | 인천 신설 구·화성시 4구가 우편번호 API 에 반영됐는지 실측 필요 |

---

## 7. 검증 게이트

1. `npm run quality` (css-vars-sync + check:rpc-migrations + type-check + lint + format:check)
2. `npm test` — region 매핑 유닛 테스트 신규 추가(`sido+sigungu` 조합 케이스)
3. `e2e/` Grep — 장소 입력 관련 셀렉터·문구 변경 여부
4. 🔴 **렌더러 관찰** (정적 검사로 대체 불가):
   - 웹: 브라우저에서 실제로 우편번호 검색이 뜨는지 + 콘솔에 CSP 위반 없는지
   - 네이티브: 실기기에서 시트 안 WebView 가 뜨고 결과가 회수되는지, 키보드가 가리지 않는지
5. code-reviewer 디스패치 (구현 직후)

---

## 8. 미확인 항목

- 행정구역 개편 반영 여부 — 인천 2026-07 구 개편(제물포구·영종구·서해구·검단구), 화성시 4구
- 카카오맵 타일 이미지 도메인 (3단계 CSP `img-src` — 키 발급 후 브라우저 네트워크 탭 실측)
- Cloudflare Pages Preview 도메인 와일드카드 등록 가능 여부 (3단계)
- 웹 CSP 를 연 뒤 iframe 이 실제로 렌더되는지 — **브라우저 실행 전까지 미확정**

---

## 부록 — 다음 우편번호 서비스 사실 확인

공식 가이드(`postcode.map.daum.net/guide`) 실측:

- **API 키 불필요 · 도메인 등록 불필요**
- *"사용량에 대한 제한이 없습니다. 기업용이든 상업적 용도이든 상관없이 무료로 사용 가능합니다."*
- 주요 반환 필드: `zonecode` · `roadAddress` · `jibunAddress` · `address` · `addressType` · `userSelectedType` · `sido` · `sigungu` · `sigunguCode` · `bname` · `buildingName`
- 스크립트: `//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js`
- embed iframe 오리진: `https://postcode.map.kakao.com`

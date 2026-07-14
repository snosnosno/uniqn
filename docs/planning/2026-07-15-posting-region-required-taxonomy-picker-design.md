# 공고작성 지역선택 필수화 + 2패널 택소노미 피커 재사용 — 설계 (2026-07-15)

## 결론

공고작성(주문서) 장소의 **지역(region)을 필수**로 만들고, 지역 선택 UI를 구인구직탭
필터(#254, `RegionFilterSheet`)와 **동일한 2패널 택소노미 구조**로 바꾼다. 이를 위해
필터의 2패널 **본문**(검색 + 좌 그룹 사이드바 + 우 그리드/아코디언)을 Modal 비의존
프레젠테이션 컴포넌트 `RegionTaxonomyBrowser`로 추출해, 필터(멀티선택)와 공고작성
(단일선택)이 **단일 소스**로 공유한다.

## 확정된 제품 결정

| 결정 | 값 | 근거 |
|------|-----|------|
| 선택 방식(공고작성) | **단일선택** | 공고 1건 = 1장소 도메인 |
| 지역 단계 | **구/시 단위까지** | 필터(구/시/권역 전교배열) 매칭 정합 |
| 시 전체 허용 | **시 전체·구 둘 다 허용, 권역만 배제** | 필터 아코디언(시전체/구)과 동형·양방향 recall |
| 재사용 전략 | **공유 본문 추출** | 취약 렌더링(RN-web 폭 버그 등) 단일 소스·중복 제거 |

## 현재 구조 (실측)

- **필터 시트**: `src/components/jobs/filters/RegionFilterSheet.tsx` — `Modal position="bottom"`
  래핑. 내부 `SheetBody`가 3단(①검색+바로가기 ②2패널/검색결과 ③트레이+적용). 멀티선택은
  `utils/regionSelection.ts`의 `RegionToken[]`(slug | `group:서울`). 아코디언은 단일 확장
  (`expandedCity`).
- **택소노미 데이터**: `src/constants/regions.ts` — `RegionGroup`(9그룹), `RegionOption`
  (`slug`·`parentSlug`·`subGroup`), `REGIONS_BY_GROUP`, `getRegionChildren`/`hasRegionChildren`/
  `searchRegions`/`isRegionSlug`/`getRegionOption`. **권역(예: "서울")은 slug가 아니라
  `RegionGroup`** — `isRegionSlug`는 시/군/구 slug만 통과시키므로 권역-단독은 이미 자동 배제.
- **공고작성 장소 시트**: `src/components/employer/order-sheet/sheets/PlaceSheet.tsx` —
  `SheetModal` 안에서 `mode: 'list' | 'new' | 'region'` 인라인 3단. **중첩 Modal iOS
  터치먹통(#186/#243) 회피가 인라인 렌더의 이유** → 2패널도 반드시 인라인 본문으로 넣는다
  (또 다른 Modal 금지). 현재 `mode:'region'`은 `REGION_GROUPS` flat 라디오 + "선택 안 함".
- **스키마**: `src/schemas/orderSheet.schema.ts` — `orderSheetLocationSchema.region`은
  `isRegionSlug` refine + `.optional()`. `location` 객체 자체는 제출 시 필수(`refine v!==null`).
- **매퍼**: `src/utils/job-posting/draftAdapter.ts`(location 4매퍼) + `src/utils/order-sheet/
  mappers.ts`. region을 이미 그대로 통과 → 필수화로 인한 매퍼 로직 변경 없음.

## 아키텍처 — 컴포넌트 경계

```
regions.ts (데이터·순회 유틸)
   │
   ├─ RegionTaxonomyBrowser  (신규·Modal 비의존 프레젠테이션 본문)
   │     검색 + 좌 사이드바 + 우 그리드/아코디언 + 검색결과 flat
   │     selection-agnostic: isSelected(slug) / onPickSlug(slug)
   │        │
   │        ├─ RegionFilterSheet (멀티선택 caller)
   │        │     Modal + 그룹전체 행 + 그룹배지 + 바로가기 + 트레이 + 적용카운트
   │        │
   │        └─ PlaceSheet mode:'region' (단일선택 caller)
   │              SheetModal 인라인 + 뒤로 + 픽 즉시 확정
   │
   └─ regionSelection.ts (멀티선택 토큰 모델 — 필터 전용, 변경 없음)
```

### 신규: `src/components/region/RegionTaxonomyBrowser.tsx`

크로스피처(jobs 필터 + employer 주문서) 공유이므로 중립 위치에 둔다.

**책임**: 검색박스 + 검색상태 + 좌 그룹 사이드바 + 우 그룹전체행 슬롯 + 시-레벨 그리드 +
구 아코디언(`ExpansionChip` + 인라인 구 그리드) + 검색결과 flat 리스트. `activeGroup`/
`searchText`/`expandedCity` 내부 state 소유. `activeSections`(subGroup 남부/북부 소섹션 +
단일시 그룹 승격[인천]) 로직 이관.

**선택 모델 비의존** — 하이라이트/픽만 콜백으로 위임(토큰·단일 slug 판단은 caller):

```ts
export interface RegionTaxonomyBrowserProps {
  /** slug 하이라이트 여부 (단일: slug===region / 멀티: pending.includes(slug)) */
  isSelected: (slug: string) => boolean;
  /** slug 픽 — caller가 토글/교체 결정. 그룹전체 행은 renderGroupAllRow가 담당 */
  onPickSlug: (slug: string) => void;
  /** 좌 그룹 탭 배지 개수 (멀티 필터 전용; 없으면 배지 미표시) */
  groupBadgeCount?: (group: RegionGroup) => number;
  /** 우 상단 '그룹 전체' 행 (멀티 필터만; 단일 공고작성은 omit → 권역 배제) */
  renderGroupAllRow?: (group: RegionGroup) => React.ReactNode;
  /** 검색박스 아래 슬롯 (필터 바로가기 칩; isSearching 시 caller가 숨김 판단) */
  renderBelowSearch?: (ctx: { isSearching: boolean }) => React.ReactNode;
  /** 초기 활성 그룹 (기본 '서울'; 공고작성은 기존 region의 group) */
  initialGroup?: RegionGroup;
}
```

- 아코디언 childCount 배지는 `isSelected`로 파생(`children.filter(c => isSelected(c.slug)).length`)
  — 별도 prop 불필요.
- a11y: 칩/검색결과 행의 `accessibilityRole`은 `selectionMode: 'multi' | 'single'` prop으로
  checkbox(멀티)/radio(단일) 분기 — 현재 필터 하드코딩 checkbox를 그대로 단일선택에 쓰면 오표기.
- "시 전체" 픽은 아코디언 안 `RegionChip(label="○○ 전체", selected=isSelected(citySlug),
  onPress=onPickSlug(citySlug))`. 시 전체·구 둘 다 허용 결정과 일치.
- **레이아웃**: 검색박스=고정 높이, 메인 패널=`flex-1`. 컴포넌트는 부모가 높이를 bound한다고
  가정(`flex-1` 자체 확장). RN-web `ScrollView` 기본 `flexGrow:1` 폭 버그 → 사이드바
  `w-[76px] grow-0 shrink-0` **필수 유지**(#254 실측 함정).

### 변경: `RegionFilterSheet.tsx` (멀티선택 caller)

`SheetBody`의 ②탐색층(검색 + 2패널 + 검색결과)을 `<RegionTaxonomyBrowser>`로 교체. ①바로가기·
③트레이/적용은 유지하되 검색·바로가기 배치는 browser 슬롯으로 이관:

- `isSelected={(s) => pending.includes(s)}`
- `onPickSlug={(s) => handleToggle(s)}` (기존 토큰 토글)
- `groupBadgeCount={(g) => groupCounts[g]}`
- `renderGroupAllRow={(g) => GROUP_ALL_SUPPORTED.includes(g) ? <그룹전체 Pressable> : null}`
- `renderBelowSearch={({isSearching}) => !isSearching && shortcuts.length ? <바로가기 ScrollView> : null}`
- `initialGroup`: 기존 로직 유지.

트레이·적용카운트(`usePostingTypeCounts`)·cap notice는 caller에 그대로. **기존
`RegionFilterSheet.test.tsx` 전량 그린 유지 = 패리티 증거**(추출 후 회귀 0 확인).

### 변경: `PlaceSheet.tsx` (단일선택 caller)

**`mode:'region'`** — flat 라디오·"선택 안 함" 제거 → browser 인라인:

```tsx
{mode === 'region' && (
  <View className="gap-2" style={{ height: regionBrowserHeight }}>
    <BackAffordance onPress={() => setMode('new')} />  {/* 뒤로 유지 */}
    <RegionTaxonomyBrowser
      isSelected={(s) => draft.region === s}
      onPickSlug={(s) => { setDraft((d) => ({ ...d, region: s })); setMode('new'); }}
      initialGroup={draft.region ? getRegionOption(draft.region)?.group : undefined}
    />
  </View>
)}
```

- `renderGroupAllRow` omit → 권역 배제 자동 달성.
- 픽 즉시 `mode:'new'` 복귀(단일선택). 트레이/적용버튼 없음.
- `SheetModal` 본문은 고정 높이 열이 아니므로 **명시 높이 필요**: `regionBrowserHeight =
  min(round(windowHeight*0.6), 520)`(실기기 그라운딩으로 확정).

**`mode:'new'`** — 지역 필수화:

- 지역 버튼 라벨: `draft.region ? '지역: ${getRegionLabel}' : '지역 선택'` (기존 "(선택)"
  접미 제거). 미선택 시 필수 시그널(빨간 별표/보더 아님 — v1 룰10 문구 톤).
- 확인 버튼 `disabled`: `nameTrimmed.length === 0 || !draft.region`.
- 미선택 시 버튼 아래 힌트 "장소명과 지역을 선택해주세요"(무엇+어떻게, 룰10).

**하위호환(`mode:'list'`)** — 저장된 최근 장소에 region 없을 때:

```tsx
onPress={() => {
  if (!loc.region) { setDraft(loc); setMode('region'); }  // region 강제 완성
  else { onConfirm(loc); onClose(); }
}}
```

region 없는 최근 장소를 고르면 조용히 통과시키지 않고 지역 스텝으로 유도(제출 침묵 실패 방지).

### 변경: `orderSheet.schema.ts`

```ts
// 같은 파일 location nullable 관례와 동형: z.input 은 관용(optional), refine 프레디킷이
// z.output 에서만 undefined 를 제거한다(orderSheet.schema.ts:93-94 주석 참조·TS5.5 추론).
region: z
  .string()
  .refine((s) => isRegionSlug(s), '지역 값이 올바르지 않습니다')
  .optional()
  .refine((v) => v !== undefined, '지역을 선택해주세요'),
```

- **z.input(폼 상태)은 region optional 유지 → 타입 파급 0**: `OrderSheetLocation`(=z.input
  location) 불변이라 PlaceSheet draft·`recentLocations`·mappers(`draftToValues`의 레거시
  region-less draft 통과)가 전부 무수정 컴파일. z.output(제출 결과)만 `region: string`.
- 런타임은 undefined 를 '지역을 선택해주세요'(path `['location','region']`)로 거부 —
  제출 게이트는 동일하게 강제.

- `isRegionSlug`가 권역(비-slug)·잘못된 값 배제. 시 전체·구 slug는 통과 → "권역만 배제" 결정 충족.
- **서울·인천 특례(실측)**: 서울은 시-레벨 slug 없이 25개 구 flat(`regions.ts:138-140` — slug
  `서울 강남구` 형태만 존재, `isRegionSlug('서울')`=false). 인천은 단일 시 그룹 승격으로 시 칩이
  숨겨짐. 그룹전체 행을 omit하는 공고작성 피커에서는 두 그룹 모두 **구 선택이 사실상 강제** —
  "권역 배제" 결정과 정합(서울은 권역==시)이며 의도된 동작. 부산·대구 등 다도시 그룹은
  아코디언의 "○○ 전체"로 시 전체 선택 가능.
- `location` 객체가 null이면 region 요건 미적용(장소 자체가 optional 상태) → `location.refine
  (v!==null)`이 최종 게이트. 장소 객체 존재 시 region 필수.

**타입 파급: 없음(개정)** — z.input 이 region optional 을 유지하므로 `OrderSheetLocation`
불변. PlaceSheet draft·`recentLocations`(둘 다 z.input 기준)·mappers 전부 무수정. 확인
게이트(`!draft.region`)는 UX 1차 차단, zod 제출 게이트가 최후 방어. 레거시 draft/posting의
region 없는 location 은 로드·편집 관용, 제출 시 reject → 지역 추가 유도(읽기 증발 아님).

**행 배지·unset 판정 정렬(H5)**: `orderRowMeta.getRowState('place')`의 unset 판정을
`location === null || !location.region`으로 확장 — zod 통과 가능성과 정렬(어긋나면 "이대로
등록인데 무반응" 죽은 버튼 재발). `errorMessageForRow`에 place 분기 추가(`errors.location.
region` 중첩 메시지 워킹). `firstUnsetRow`는 getRowState 파생이라 자동 추종.

**테스트 파급(실측)**: `orderSheet.schema.test.ts:19`의 `validInput.location`이 region 없음 —
전 성공 케이스가 이 픽스처를 스프레드하므로 `region: '서울 강남구'` 추가 1곳으로 일괄 해소.
OrderSheetScreen 계열 테스트 픽스처도 동일 스위프 필요.

> **구현 일탈(2026-07-15 승인)**: zod v4는 부재(absent) optional 키의 필드 refine을 건너뛰므로,
> 위 필드 레벨 `.optional().refine(...)`으로는 region 없는 제출을 막지 못한다(실측). 실제 구현은
> 필수 게이트를 **객체 레벨 `.superRefine`**(path `['location','region']`, 동일 메시지)으로 배선했다.
> 따라서 z.output의 region 타입은 `string | undefined`로 유지되며(런타임 필수는 보장), "z.output만
> region: string" 서술은 타입 레벨로는 성립하지 않는다.

## 데이터 흐름

```
PlaceSheet(single) ─ onPickSlug(slug) ─▶ draft.region = slug ─ 확인 ─▶ onConfirm(location)
   ▲                                                                        │
   └──────────────── RegionTaxonomyBrowser (isSelected/onPickSlug) ─────────┘
                          ▲
RegionFilterSheet(multi) ─ onPickSlug(slug)=toggleRegionToken ─▶ pending[] ─ 적용 ─▶ onApply(tokens)
```

매퍼는 무변경: `draftAdapter`(toCanonical/toCreateInput/toUpdateInput/toForm) + order-sheet
`mappers`가 region을 그대로 왕복. 필수화는 스키마 게이트로만 강제.

## 에러 처리

- 지역 미선택 제출: zod `required_error` "지역을 선택해주세요" → `location` 경로 배지.
- PlaceSheet 확인 게이트가 UX 1차 차단(버튼 disabled), 스키마가 최후 게이트(대칭 — 주문서 폼 관례).
- 잘못된 slug(외부/레거시 오염): `isRegionSlug` refine "지역 값이 올바르지 않습니다".

## 테스트 계획

| 대상 | 케이스 |
|------|--------|
| `orderSheet.schema` | region 없음→reject("지역을 선택해주세요") · 유효 slug→pass · 권역 문자열→reject · 잘못된 slug→reject |
| `RegionTaxonomyBrowser` | 단일선택 하이라이트(picked slug만) · 아코디언 펼침 시 구+"시 전체" 노출 · onPickSlug 인자 정확 · 검색 필터 · renderGroupAllRow 있을 때만 그룹전체 행 |
| `PlaceSheet` | region 미선택→확인 disabled · name+region→enabled · 픽 후 mode:'new' 복귀·draft.region 세팅 · region 없는 최근 장소 픽→mode:'region' 유도 |
| `OrderSheetScreen` 에러 표면 | region 중첩 에러(`errors.location.region`)가 장소 행 배지에 노출되는지 — 기존 행 배지가 `errors.location?.message`(null refine)만 읽으면 레거시 draft의 region 결핍이 침묵 실패(스토어 계약 false-green 함정 재발 방지) |
| `RegionFilterSheet` | **기존 테스트 전량 그린 유지**(추출 패리티) — 멀티 토글·그룹전체·트레이·적용카운트 |

## 검증(Exit Proof) — 렌더 산출물 그라운딩

정적 파싱·타입체크는 well-formed 확인일 뿐. 완료 전 **실제 렌더러 관찰** 필수:

1. `npm run quality`(tsc+lint+format) 0 에러.
2. `jest` — 위 4스위트 그린(카운트 실측).
3. **실기기/웹 렌더 관찰**: 공고작성→장소→지역에서 2패널 렌더·단일선택 동작·미선택 시 확인
   비활성·시 전체/구 픽·검색 관찰. 필터 화면 2패널 회귀 0 관찰. (관찰 1회 깨끗하면 충분.)

## 범위 밖 (YAGNI)

- 필터의 멀티선택 토큰 모델(`regionSelection.ts`) 변경 — 무변경.
- 공고작성에 최근-지역 바로가기·미리보기 카운트 — 필터 전용 유지.
- 기존 공고 대량 백필(region 없는 레거시) — 편집 시 개별 유도로 충분.
- `RegionSelectModal`(레거시 job-form 경로) 정리 — 별개 사안.

## 리스크

| 리스크 | 완화 |
|--------|------|
| #254 필터(QA 전) 추출 회귀 | 기존 `RegionFilterSheet.test.tsx` 그린 게이트 + 렌더 관찰 |
| RN-web 사이드바 50/50 폭 버그 재발 | `grow-0 shrink-0 w-[76px]` 본문에 보존, 스냅샷/관찰 |
| SheetModal 인라인 높이 붕괴 | 명시 높이 prop + 실기기 그라운딩 |
| region 필수화가 레거시 편집 차단 | 의도된 데이터 품질 게이트 + list-mode 유도 |
```

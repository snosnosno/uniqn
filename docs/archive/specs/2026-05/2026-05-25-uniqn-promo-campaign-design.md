# UNIQN 홍보 캠페인 — 설계 문서

- 작성일: 2026-05-25
- 도구: higgsfield CLI (`@higgsfield/cli@0.1.40`) — 인증됨 (`tmdgh2qn@gmail.com`, plus plan, 약 353 크레딧)
- 상태: 설계 합의 완료 → 1차 범위 = **히어로 샘플 이미지 1장**

## 1. 목적

UNIQN(포커룸 스태프 관리 앱)의 **브랜드 인지도** 홍보물 제작. 구인자(매장/대회 운영자)와
스태프(딜러/플로어/서빙) **양쪽 모두**에게 통하는 톤으로, 인스타 피드(1:1) 중심 배포.

최종 산출물은 **홍보 이미지 세트 + 숏폼 영상**이지만, 본 1차 작업은 컨셉 검증을 위한
**샘플 이미지 1장**만 생성한다. 검증 통과 후 세트/영상으로 확장한다.

## 2. 크리에이티브 방향

- **핵심 메시지(태그라인 방향)**: "편리함 / 올인원" — *구인부터 출퇴근·정산까지, 한 앱에서*.
  - 카피(한글 텍스트)는 생성 이미지에 직접 넣지 않고 **후반 오버레이**로 처리한다.
    (생성 모델의 한글 텍스트 렌더링은 불안정)
- **비주얼 컨셉**: 앱 + 실사 하이브리드(제품샷). 밝고 활기찬 **홀덤 대회장**을 배경으로,
  스태프/딜러가 UNIQN 앱이 켜진 폰을 든 시네마틱 제품샷.
- **분위기**: 어두운 프리미엄룸 ❌ → **밝은 홀덤 대회장**(이벤트·스케일). 여러 포커 테이블,
  대회 배너/무대 조명, 사람 많고 활기찬 사교적 분위기.
- **브랜드 컬러**: Black & Gold. 배경을 어둡게 깔지 않고 **골드(`#D4AF37`)를 액센트**로만 사용.
- **인물**: 등장 O(장면마다 다양). 동일 인물 유지(soul-id) 불필요. 얼굴 클로즈업은 지양(초상권).

## 3. 폰 안 "앱 화면" 처리 — 실제 UI 합성

- higgsfield는 **장면 + 폰(빈/골드 글로우 화면)**까지만 생성한다.
- 실제 UNIQN UI는 **후반 합성**(스크린샷을 폰 화면 자리에 합성)으로 넣는다 → 정확도 최우선.
- 샘플 단계에서는 합성하지 않고 **화면 자리만 확보**(정면·충분히 큰 화면 구도)한다.

## 4. 샘플 1장 스펙

| 항목 | 값 |
|------|-----|
| 장면 | 밝은 홀덤 대회장(여러 테이블·대회 배너·무대 조명), 분주한 딜러/스태프, 한 스태프가 폰을 든 손 |
| 폰 화면 | 빈 / 골드 글로우 상태로 생성 (실제 UI는 추후 합성, 오늘은 미합성) |
| 비율 | **1:1** (인스타 피드) |
| 모델(1순위) | **Seedream 4.5** (`seedream_v4_5`) — 실사+인물 강함 |
| 모델(대안) | Nano Banana Pro (`nano_banana_2`) / Soul Cinematic (`soul_cinematic`) |
| 명령 | `higgsfield generate create seedream_v4_5 --prompt "<영문 프롬프트>" --aspect_ratio 1:1 --wait` |
| 참고 입력 | (선택) 앱 아이콘 `uniqn-mobile/assets/1024.png` 를 `--image`로 — 골드 톤 가이드 |
| 출력 | `marketing/uniqn-campaign/sample-01/` 에 결과 이미지 저장 |
| count | 1 (필요 시 1~3 variant) |

### 프롬프트 방향 (영문, 후반 작성 확정)
- bright modern Hold'em poker tournament hall, multiple felt tables, tournament banners, stage lighting
- lively crowd, dealers and staff working, candid energy
- a poker room staff member holding a smartphone with a clean glowing screen (screen blank/gold glow for later compositing)
- warm bright lighting with subtle gold accents, premium but approachable, photoreal, cinematic, shallow depth of field
- square 1:1 composition, phone held front-facing and large enough to composite a real app UI later

## 5. 생산 파이프라인 (전체 캠페인 확장 시)

```
[1] higgsfield 장면 생성 (폰 화면 = 빈 골드 글로우)
 → [2] 실제 앱 스크린샷 합성 (폰 화면 자리)
 → [3] 한글 카피 오버레이 ("구인부터 정산까지, 한 앱에서")
 → [4] 1:1 최종 export
영상: [1] 이미지를 start frame 으로 image→video (Veo 3.1 / Kling 등), 1:1
```
- 샘플 단계는 **[1]만** 실행. [2]~[4]는 검증 후 진행.

## 6. 검증 기준 (샘플로 확인할 것)

- [ ] 밝은 홀덤 대회장 분위기 + 골드 액센트가 브랜드와 맞는가
- [ ] 폰/손 구도가 실제 UI 합성에 적합한가 (정면·충분히 큼)
- [ ] 인물 톤(프리미엄 vs 캐주얼)이 의도와 맞는가
- [ ] 1:1 비율·해상도가 인스타 피드용으로 충분한가

## 7. 크레딧/비용

- 이미지 1장: 대략 1~5 크레딧 추정(모델별 상이). 353 크레딧 대비 무시 수준.
- 영상(확장 단계): Veo/Kling 등 클립당 수십 크레딧 → 확장 시 별도 견적.

## 8. 범위 밖 (YAGNI — 이번 작업 제외)

- 실제 UI 합성·카피 오버레이·최종 export
- 이미지 세트 확장(여러 컷), 숏폼 영상 생성
- 앱스토어 스크린샷, 오프라인 인쇄물
- soul-id 인물 학습

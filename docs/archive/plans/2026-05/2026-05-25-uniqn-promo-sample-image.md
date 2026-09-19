# UNIQN 홍보 샘플 이미지 1장 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** higgsfield CLI로 "밝은 홀덤 대회장 + UNIQN 앱 폰을 든 스태프" 컨셉의 1:1 홍보 샘플 이미지 1장을 생성하고 검증한다.

**Architecture:** higgsfield `generate create` 로 Seedream 4.5 이미지 모델을 호출해 장면+폰(빈 골드 글로우 화면)을 생성한다. 실제 UI 합성·카피 오버레이·영상은 범위 밖. 결과는 `marketing/uniqn-campaign/sample-01/`에 저장하고 육안 검증 후 확장 여부를 판단한다.

**Tech Stack:** higgsfield CLI (`@higgsfield/cli@0.1.40`), bash. 코드 변경 없음 — 산출물은 이미지 파일 + 프롬프트 기록.

---

## File Structure

- `marketing/uniqn-campaign/sample-01/prompt.txt` — 사용한 영문 프롬프트 기록 (재현·반복용)
- `marketing/uniqn-campaign/sample-01/sample-01.png` — 생성된 샘플 이미지
- `marketing/uniqn-campaign/sample-01/job.json` — higgsfield job 응답(URL/메타) 원본

검증은 별도 테스트 코드 없이 **CLI 출력 + 파일 존재 + 육안 확인**으로 수행한다.

---

## 사전 확인 (이미 충족됨)

- higgsfield 인증됨: `higgsfield account status` → `tmdgh2qn@gmail.com — plus plan, ~353 credits`
- 출력 디렉토리 존재: `marketing/uniqn-campaign/sample-01/`
- 작업 브랜치: `docs/uniqn-promo-campaign`

---

### Task 1: 프롬프트 확정 및 기록

**Files:**
- Create: `marketing/uniqn-campaign/sample-01/prompt.txt`

- [ ] **Step 1: 영문 프롬프트를 파일로 기록**

`marketing/uniqn-campaign/sample-01/prompt.txt` 에 아래 내용을 저장:

```
Bright modern Texas Hold'em poker tournament hall, multiple green felt poker tables in rows, tournament banners and overhead stage lighting, lively crowd of players and staff, candid energetic atmosphere. In the foreground, a poker room staff member (no clear face, three-quarter or side angle) holds a modern smartphone front-facing toward the camera; the phone screen is blank with a soft warm gold glow (leave the screen empty for later UI compositing). Bright clean lighting with subtle gold accents, premium but approachable, photorealistic, cinematic, shallow depth of field, high detail. Square 1:1 composition, the phone held large and unobstructed in frame.
```

- [ ] **Step 2: 기록 확인**

Run: `cat marketing/uniqn-campaign/sample-01/prompt.txt`
Expected: 위 프롬프트가 그대로 출력됨.

- [ ] **Step 3: Commit**

```bash
git add marketing/uniqn-campaign/sample-01/prompt.txt
git commit -m "docs(marketing): 샘플 이미지 영문 프롬프트 확정"
```

---

### Task 2: 모델 비용 사전 확인 (선택, 안전)

**Files:** 없음 (조회만)

- [ ] **Step 1: 생성 전 비용 추정 조회**

Run: `higgsfield generate cost seedream_v4_5 --prompt "$(cat marketing/uniqn-campaign/sample-01/prompt.txt)" 2>&1 | head -20`
Expected: 예상 크레딧 비용 출력. (서브커맨드가 다르면 `higgsfield generate --help`로 확인 후 해당 명령 사용. 비용 조회 불가 시 이 Task는 생략하고 Task 3 진행.)

- [ ] **Step 2: 비용이 10 크레딧 미만인지 확인**

Expected: 한 자릿수 크레딧. 만약 예상치 못하게 높으면(>20) 중단하고 사용자에게 보고.

---

### Task 3: 샘플 이미지 생성

**Files:**
- Create: `marketing/uniqn-campaign/sample-01/job.json`

- [ ] **Step 1: higgsfield 로 이미지 생성 (JSON 응답 저장)**

```bash
cd "/c/Users/user/Desktop/T-HOLDEM"
higgsfield generate create seedream_v4_5 \
  --prompt "$(cat marketing/uniqn-campaign/sample-01/prompt.txt)" \
  --aspect_ratio 1:1 \
  --wait --wait-timeout 10m \
  --json 2>&1 | tee marketing/uniqn-campaign/sample-01/job.json
```

Expected: job 이 완료(`completed`/`succeeded`)되고 결과 이미지 URL 이 JSON 에 포함됨.

- [ ] **Step 2: 실패 시 분기 처리**

- `--aspect_ratio 1:1` 이 거부되면: `higgsfield generate create seedream_v4_5 --help` 로 지원 파라미터 확인 후 올바른 비율 파라미터로 재시도.
- 모델이 거부/오류면: 대안 모델 `nano_banana_2` 로 동일 명령 재시도.
- 위 분기로도 실패하면 중단하고 CLI 에러 전문을 사용자에게 보고.

- [ ] **Step 3: 결과 URL 확인**

Run: `grep -oE 'https?://[^"]+\.(png|jpg|jpeg|webp)' marketing/uniqn-campaign/sample-01/job.json | head -5`
Expected: 최소 1개의 이미지 URL 출력.

---

### Task 4: 이미지 다운로드 및 저장

**Files:**
- Create: `marketing/uniqn-campaign/sample-01/sample-01.png`

- [ ] **Step 1: 결과 이미지 다운로드**

```bash
cd "/c/Users/user/Desktop/T-HOLDEM"
URL=$(grep -oE 'https?://[^"]+\.(png|jpg|jpeg|webp)' marketing/uniqn-campaign/sample-01/job.json | head -1)
curl -L -o marketing/uniqn-campaign/sample-01/sample-01.png "$URL"
```

Expected: `sample-01.png` 다운로드 완료 (curl 종료코드 0).

- [ ] **Step 2: 파일 유효성 확인**

Run: `ls -la marketing/uniqn-campaign/sample-01/sample-01.png && file marketing/uniqn-campaign/sample-01/sample-01.png`
Expected: 0바이트 아님, `PNG/JPEG image data` 로 인식, 가급적 정사각형 해상도.

---

### Task 5: 육안 검증 (검증 기준 대조)

**Files:** 없음 (검토)

- [ ] **Step 1: 이미지를 열어 검증 기준 대조**

`marketing/uniqn-campaign/sample-01/sample-01.png` 를 Read 도구로 열어 아래 체크:
- [ ] 밝은 홀덤 대회장 분위기 + 골드 액센트가 브랜드와 맞는가
- [ ] 폰/손 구도가 실제 UI 합성에 적합한가 (정면·충분히 큼·가림 없음)
- [ ] 인물 톤(프리미엄 vs 캐주얼)이 의도와 맞는가, 얼굴 클로즈업 회피됐는가
- [ ] 1:1 비율·해상도가 인스타 피드용으로 충분한가

- [ ] **Step 2: 검증 결과 요약을 사용자에게 보고**

이미지를 보여주고 4개 기준 통과 여부를 한 줄씩 요약. 미흡 항목이 있으면 프롬프트 조정안 제시.

---

### Task 6: 산출물 커밋

**Files:** 모두 (sample-01 디렉토리)

- [ ] **Step 1: 산출물 커밋**

```bash
cd "/c/Users/user/Desktop/T-HOLDEM"
git add marketing/uniqn-campaign/sample-01/
git commit -m "feat(marketing): UNIQN 홍보 샘플 이미지 1장 생성 (밝은 홀덤 대회장)"
```

Expected: prompt.txt / job.json / sample-01.png 커밋됨.

> 참고: `.png`/`.json` 이 `.gitignore` 로 무시되면 `git add -f` 사용 또는 사용자에게 자산 보관 위치 확인.

---

## 검증 후 분기 (범위 밖 — 별도 계획)

샘플이 통과하면 사용자 결정에 따라 확장:
- 이미지 세트(여러 컷, count 늘리기 / variant)
- 실제 UI 합성 + 한글 카피 오버레이 + 최종 export
- 숏폼 영상 (이 이미지를 start frame 으로 image→video, Veo 3.1 / Kling)

이들은 본 계획 범위 밖이며, 검증 통과 후 신규 spec/plan 으로 진행한다.

---

## Self-Review

- **Spec 커버리지:** 스펙 §4(샘플 스펙)=Task 1~4, §6(검증 기준)=Task 5, §2~3(컨셉/앱화면)=Task 1 프롬프트에 반영(빈 골드 글로우 화면). §7(크레딧)=Task 2. §8(범위 밖)=계획 말미 분기에 명시. 갭 없음.
- **Placeholder 스캔:** 프롬프트 전문·명령어·예상 출력 모두 구체값. TBD 없음.
- **일관성:** 모델명 `seedream_v4_5`(1순위)/`nano_banana_2`(대안), 경로 `marketing/uniqn-campaign/sample-01/`, 파일명 `prompt.txt`/`job.json`/`sample-01.png` 전 Task 동일.
- **불확실 지점:** `generate cost` 서브커맨드 존재 여부와 `--aspect_ratio` 정확 표기는 CLI 실측이 필요 → Task 2/3에 실패 시 `--help` 확인 분기를 명시해 대응.

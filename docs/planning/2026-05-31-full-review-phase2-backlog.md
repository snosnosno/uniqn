# 전체리뷰 2단계 백로그 (UX/도메인 갭)

> 작성: 2026-05-31 | 기준 SSOT: `docs/analysis/uniqn-pub-tourney-gap-2026-05-28.md` (37건 + 우선순위 매트릭스)
> 타깃 시장: 홀덤펍 사장(단발 알바) + 대회사 운영팀(D-7~D-day 집중 인력) — 메모리 `project_target_market_pivot`

## 배경
- **1단계 (정확성/구조 축)** = 멀티에이전트 코드리뷰 백로그 C1~C9 + U9(800줄 분할). ✅ **PR #156 머지 완료** (2026-05-31, `499590fcf`).
- **#155 capacity e2e 선행 부채** = ✅ **PR #157** (`9b62b1a2d`): Fix1(cancellation-lifecycle:482 stale 기대값 `'active'`→`'capacity_full'`) + Fix2(posting-capacity-recovery employer-탭 UI 단언 `test.fixme` 격리, DB 검증 유지).
- **2단계 (UX/도메인 축)** = 본 문서. 1단계와 다른 축이며 미착수.
- ⚠️ **미배포**: #156·#155·#137 등 다수 머지됐으나 웹 Cloudflare 재배포 + 모바일 EAS OTA 미반영.

---

## Tier 0 — 인프라/부채 (이번 세션 발견, 선행)

| ID | 항목 | 근거/메모 |
|----|------|----------|
| **T0-1** | **employer-탭 e2e role 하이드레이션** (P1). e2e `review-employer`가 `employer.tsx:422 useHasRole('employer')=false` → NonEmployerView 렌더 → 모든 employer-UI e2e 차단. 시드는 role=employer지만 storageState 세션복원 후 프로필 role 미인식. | `pitfall_e2e_employer_tab_nonemployer_hydration` |
| **T0-2** | `posting-capacity-recovery.spec.ts`의 employer-UI 단언 `test.fixme` **복구** (T0-1 해결 후). | #157 |
| **T0-3** | **미배포 적체 배포** — 웹 Cloudflare 재배포 + EAS OTA. | 다수 메모리 |

---

## Tier 1 — H/S (즉시, 비용 최소·정합 회복)

| ID | 항목 | 위치 |
|----|------|------|
| 1.1-E3 | `role.ts` "포커룸" 주석 잔존 → 타깃시장 정렬 | `role.ts:14,89,98` |
| **F1** | schedule discriminator `kind`(문서) ↔ `type`(정규화) 통일 | `unified/schedule.ts:31,47` |
| 1.1-E1 | Fixed 공고 취소 차단 **사유 안내** (현재 버튼 미렌더, 설명 0) | `jobs/[id]/index.tsx:157` |
| **G2/F3** | 자정 넘는 시간대 `crossesMidnight` (18:00~익일04:00 야간영업) | `unified/timeSlot.ts:25` |

## Tier 2 — H/M (1차 스프린트, 즉효)

| ID | 항목 | 강도 | 위치 |
|----|------|------|------|
| **G6/Path5** | 지원자 **일괄 승인/거절** UI (현재 1명씩 모달) | 홀덤펍↑↑ | `applicants.tsx:79` |
| **G1** | **테이블 수 기반 정원** (`tableCount`+`perTableRatio`) | 홀덤펍 전용 | `jobPosting.ts:80` |
| 1.1-P1 | **지역/거리 필터** (`district` 존재·UI 미사용) | 홀덤펍 근거리 | `home-jobs.tsx:40` |
| **F2** | 일자별 다른 시간대 입력 UI (스키마 지원·UI 미반영) | 대회사 다일정 | `DateRangeCard.tsx` |

## Tier 3 — H/L (대회사 전용, 사양 분리 별도 트랙)

| ID | 항목 |
|----|------|
| **G7** | 토너먼트 단계(예선/본선/파이널) phase 모델 (`tournamentConfig.phases[]`) |
| **G10** | 사전등록 명단 **일괄 import** (CSV → `bulkCreateApplications` Edge Function) |

## Tier 4 — M (검증 후 진입)

1.1-P2 같은 시간 공고 충돌 사전감지 · 1.1-P3 "곧 시작" 푸시·우선 점프 · 1.1-E2 더블탭 가드 fetchQuery 시점 보강 · 1.2-P4 PostingType별 폼 분기 명확화 · 1.2-E5 부분근무(조퇴/지각) 정산 공제 규칙 · 1.2-E6 취소요청 응답 진입 통합 · G4 스팟/반복 타입 분리 · G9 토너먼트 역할 카탈로그 · G11 D-7 서지 메타(`expiresAt`·푸시 부스트) · F4 역할별 시간차(`startTimeOverride`) · F6 일자별 capacity 표시 정합

## Tier 5 — L (시장 검증 후) + 보류

- 1.3-E7 토너먼트 employer self-service · G5 매장 프로필(영업시간/테이블/주차) · **G8/G12 상금풀·결과·사후정산 모듈** · F5 shiftPattern(딜러 로테이션, G3 연계)
- **StorageRepository** (1단계 보류) — `storageService.ts` supabase.storage 직접 4곳(L114/130/133/158) Service→Repo 우회. InquiryRepo 선례=신설(A) / authService 예외 선례=문서화(B). 비용 human~2-3.5h(테스트 마이그 70%+)·위험 낮음·호출부 0. 단독 ROI 낮음 → 다른 storageService 작업과 묶을 때.
- apply 정원 overfill(4-1)은 '의도된 모델'로 **제외 확정** (재론 금지).

---

## 권장 실행 순서
1. **T0-1** (employer-탭 e2e) — 다른 employer-UI 작업·T0-2의 선행조건.
2. **T0-3** (적체 배포) — 이미 머지된 개선들을 사용자에게 반영.
3. **Tier 1 H/S 4건** — 정합/신뢰 즉시 회복.
4. **Tier 2 H/M 4건** — 홀덤펍(일괄승인·지역필터·테이블정원) + 대회사(일자별 시간대) 즉효.
5. 대회사 트랙(G7/G10)은 사양 분리 후 별도.

## 참조
- 상세 현황/갭/제안: `docs/analysis/uniqn-pub-tourney-gap-2026-05-28.md`
- 메모리: `project_full_review_backlog_phase1`, `pitfall_e2e_employer_tab_nonemployer_hydration`, `project_target_market_pivot`, `project_schedule_schema_unification_sp1`, `project_schedule_counter_unification_sp2_sp3`

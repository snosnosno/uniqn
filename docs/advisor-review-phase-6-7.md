# Codex 어드바이저 리뷰 — Phase 6-7 알고리즘 (2026-04-17)

## 결론
**YES** — `total_positions`를 "총 슬롯 수"가 아니라 "역할별로 재사용 가능한 최소 필요 고유 인원 수"로 **재정의**할 때만 의미가 일관됨.

## 실무 엣지케이스 (3개)
1. **업주가 "매일 다른 사람"을 원하는 경우**: 반복근무 허용 가정이 깨져 과소계산됨. 향후 isGrouped 플래그 확장 또는 "반복근무 가능" 체크박스 검토 필요.
2. **같은 dealer라도 숙련도/게임종류/VIP 대응 차이로 대체 불가인 경우**: 역할 키가 거칠면 과소계산. 현재 정책은 "역할 단위 대체 가능"을 가정.
3. **슬롯 겹침/연속근무 현실성**: 단순 MAX보다 실제 overlap/휴게 규칙 기반이 더 정확하나 비용 대비 효익 낮음. 추후 feedback 기반 재평가.

## TS ⇔ SQL 의미 동등성 체크리스트

| 항목 | TS (stats.ts) | SQL (migration) | 동등성 |
|------|---------------|-----------------|--------|
| role='other' + customRole 분리 | `other:${customRole}` | `'other:' \|\| COALESCE(customRole,'')` | ✅ |
| role='other' + customRole 없음 | `other:` | `other:` | ✅ |
| customRole trim/lowercase | 적용 안 함 | 적용 안 함 | ✅ |
| count null/빈 문자열 | `role.count > previous` 비교에서 NaN → skip | `NULLIF('','')::int` → NULL → MAX 제외 | ✅ |
| **role 필드 빈/누락** | **`!role.role` → skip** | **`COALESCE(..,'')` → `''` 키 집계 포함** | ❌ → **수정 필요** |
| fixed + roleRequirements 없음 | `(?? []).reduce` → 0 | `LEFT JOIN LATERAL` + `COALESCE(SUM(..),0)` → 0 | ✅ |
| dated + requirements 없음/빈 | 코드 구조상 forEach skip → 0 | 별도 UPDATE로 0 보정 | ✅ |

## 수정 사항 (커밋)
SQL WHERE 절에 `NULLIF(role_elem->>'role','') IS NOT NULL` 추가해 TS의 "빈 role 스킵" 규칙과 맞춤.

## 업주 UX 커뮤니케이션 한 줄
> "표시 기준이 총 슬롯 수에서 **최소 필요 인원 수**로 바뀌었습니다: 기존 30명 표시는 이제 반복근무 가능 기준으로 3명처럼 보일 수 있습니다."

Phase 6-추가 UI 업데이트에서 이 문구를 안내문에 반영.

## 출처
`codex exec` 2026-04-17 (session 019d9bad-4976-7810-967d-cd48f9a9dc68), 22516 tokens.

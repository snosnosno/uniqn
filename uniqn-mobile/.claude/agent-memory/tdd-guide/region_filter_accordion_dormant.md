---
name: region-filter-accordion-dormant
description: RegionFilterSheet 3층 아코디언 테스트 패턴 — 실데이터 착지 완료, 그룹탭 네비 + getAllByText 승격 검증
metadata:
  type: project
---

RegionFilterSheet.tsx 의 3층(그룹>시>구) 아코디언(`ExpansionChip`/`renderRegionCell`)은 이제 실데이터로
활성화됐다. regions.ts 에 전국 3단계 택소노미 착지 완료(총 277 slug, 그룹 9종: 서울·경기·인천·강원·충청·
전라·경상·제주·기타). 부산 등 구 보유 시 실존, 인천은 단일 시 그룹(승격 발동), 강원은 구 없는 시.

전용 테스트 `__tests__/RegionFilterSheet.test.tsx` 작성 완료(7케이스, 15/15 그린).

**How to apply (검증된 테스트 패턴):**

- **실데이터 사용**(regions/regionSelection mock 금지) — mock 은 usePostingTypeCounts·themeStore·Modal 3개만
  (RoleFilterSheet 패턴 동일). themeStore 는 useCheckColor 때문에 필수.
- **그룹 진입은 그룹 탭 텍스트 press**(`fireEvent.press(getByText('경상'))`) — activeGroup 초기값은 서울.
  그룹명은 좌측 탭에만 유일하게 존재('경상 전체' 그룹행은 별 문자열이라 exact match 안 걸림).
- **확장 칩 펼침 검증**: 시 칩 press 후 구 칩(getByText('해운대구')) 노출 + apply→onApply([]) (선택 아님 증명).
- **승격(인천) 검증**: `getAllByText('인천')` 이 정확히 1개(그룹 탭만) — 시 확장 칩이 있으면 2개. 구 칩
  getByText('부평구') 는 최상위 노출. (queryByLabelText 대신 getAllByText 로 견고하게.)
- **검색 병기**: `fireEvent.changeText(getByTestId('region-filter-search-input'), '해운대')` → getByText('경상 · 부산')
  (구분자는 U+00B7 middot, 소스와 동일 문자 사용).
- **그룹 전환 리셋**: 부산 펼침 → 서울 탭 → 경상 복귀 후 queryByText('해운대구')===null.

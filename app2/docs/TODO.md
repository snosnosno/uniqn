> 아카이브 문서
>
> 이 문서는 `app2/` 개발 중단 시점의 작업 메모를 재정리한 기록입니다. 현재 운영 기준은 `uniqn-mobile/`, `functions/`이며, `app2` 재개 기준은 `../README.md`, `../DORMANT_PRODUCT.md`, `../RESTART_GUIDE.md`를 먼저 확인하세요.

# app2 Historical TODO Snapshot

## 문서 성격

이 문서는 현재 backlog가 아니라 `app2`가 멈춘 시점에 어떤 정리 과제가 남아 있었는지를 보여주는 역사 문서입니다. 여기 있는 우선순위나 일정 표현은 현재 계획으로 간주하지 않습니다.

현재 재개 기본 전략은 `app2` 직접 확장이 아니라 `tournament-web/` successor 추출입니다. 따라서 옛 TODO 목록은 "그대로 수행할 작업표"가 아니라 "무엇을 버리고 무엇을 다시 판단해야 하는지"를 보는 자료로 사용합니다.

## 지금 기준에서 먼저 볼 것

- [`../README.md`](../README.md)
- [`../DORMANT_PRODUCT.md`](../DORMANT_PRODUCT.md)
- [`../RESTART_GUIDE.md`](../RESTART_GUIDE.md)

## 역사적으로 남아 있던 작업 축

2025-10-04 snapshot 기준으로는 총 14개 TODO가 3개 묶음으로 정리돼 있었습니다. 아래는 현재 저장소에 없는 파일명을 새 기준 문서에 다시 박아 넣지 않기 위해, 원문 3개 묶음을 현재 해석에 맞게 5개 축으로 풀어 쓴 기록입니다.

### 1. 범용 운영 계층 정리

과거 TODO의 상당수는 `UnifiedData` 계층, 범용 상태 관리, 미사용 타입 정리와 관련되어 있었습니다. 이 축은 successor에서 직접 승계하지 않을 가능성이 높으므로, 재개 시에는 "정리"보다 "제외" 후보로 먼저 검토합니다.

대표 범주:
- `UnifiedData` options 전달 로직
- 미사용 타입과 유틸리티 정리
- 범용 운영 데이터 접근 구조 정리

역사 snapshot 세부 항목:
- 대량 선택, 가상화, 대량 작업, 대량 메시지, 대량 상태 변경을 위한 준비 코드 메모
- `UnifiedDataContext` 옵션 전달 로직 보강 메모

### 2. 미래 기능 준비 메모

과거 문서에는 대량 작업, 가상화, 메시지, 상태 변경 같은 확장 메모가 남아 있었습니다. 이 항목들은 당시 제품 범위를 기준으로 적힌 것으로, 토너먼트 전용 successor v1 범위에는 자동 포함되지 않습니다.

현재 해석:
- 토너먼트 전용 제품과 직접 관련 없으면 보류
- 범용 스태프 운영 기능은 successor v1 범위에서 제외

### 3. 역할/권한 확인 로직

일부 TODO는 실제 사용자 역할 확인 로직, 권한 시스템 보강 같은 항목이었습니다. 이 부분은 successor를 다시 열 때도 중요할 수 있지만, 현재 문서에 적힌 파일명과 우선순위를 그대로 믿기보다는 새 제품의 인증/권한 설계에 맞춰 다시 정의해야 합니다.

역사 snapshot 세부 항목:
- 실제 사용자 역할 확인 로직 2건
- 미사용 데이터 변환 유틸리티 정리 메모
- emulator `where` 필터링 확장 메모

### 4. 레거시 타입 정리 메모

과거 snapshot에는 과거 shape와 미래 확장 타입이 뒤섞여 남아 있었습니다. 이 묶음은 successor 설계에서 특히 제거 대상인지, 토너먼트 전용 타입으로 축소할지 판단해야 합니다.

역사 snapshot 세부 항목:
- 미사용 legacy application 타입 정리 메모
- 미래 급여 정보용 payroll 타입 메모
- 단일 지원 시간대 표시 컴포넌트 정리 메모

### 5. 테스트 유틸리티 확장

테스트 보조 코드와 emulator 유틸리티 관련 메모도 남아 있었습니다. 재개 시에는 옛 TODO를 복원하기보다, 빌드 체인 복구 후 필요한 테스트 범위를 새로 다시 잡는 편이 안전합니다.

현재 트리에서 확인되는 TODO 흔적:
- `src/__tests__/e2e/fixedJobDetail.spec.ts`의 실제 로그인 플로우 추가 메모
- `src/__tests__/e2e/fixedJobDetail.spec.ts`의 빈 역할 목록 테스트 데이터 설정 메모

현재 트리에서 이어지는 관련 파일군:
- `src/hooks/useUnifiedData.ts`
- `src/stores/unifiedDataStore.ts`
- `src/types/unifiedData.ts`
- `src/stores/__tests__/unifiedDataStore.integration.test.ts`
- `src/stores/__tests__/unifiedDataStore.benchmark.test.ts`

## 과거 우선순위 기록

과거 snapshot의 우선순위 분류도 의미는 남겨둘 가치가 있습니다. 다만 일정명과 버전명은 현재 계획이 아니라는 점을 전제로 읽어야 합니다.

- 높음: 역할 확인 로직 같은 권한 정확성 이슈
- 중간: `UnifiedData` 옵션 전달과 미사용 코드 정리
- 낮음: 대량 작업 확장, 레거시 타입 정리, 테스트 유틸리티 확장

## 지금 기준에서 버릴 것과 살릴 것

버릴 가능성이 큰 축:
- 범용 운영 TODO
- `eventId` 기반 구인/지원/출석 흐름 정리 메모
- 알림/공지/문의/일반 설정 쪽 잔여 메모

재평가할 가치가 있는 축:
- 토너먼트 상태 관리
- 참가자/테이블 운영 UX
- 토너먼트 전용 데이터 흐름

## 재개 시 적용 방식

이 문서를 볼 때는 아래 원칙을 적용합니다.

- 옛 TODO의 우선순위를 그대로 따르지 않습니다.
- 파일명에 적힌 작업을 곧바로 복구하지 않습니다.
- 먼저 `RESTART_GUIDE.md` 순서대로 부팅 가능 상태를 만들고, 그다음 토너먼트 전용 범위만 다시 선별합니다.
- 현재 트리에 남아 있는 TODO와 2025 snapshot 메모를 분리해서 읽습니다.

## 관련 문서

- [`../README.md`](../README.md)
- [`../DORMANT_PRODUCT.md`](../DORMANT_PRODUCT.md)
- [`../RESTART_GUIDE.md`](../RESTART_GUIDE.md)
- [`../../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md`](../../docs/planning/2026-04-04-app2-tournament-web-revival-plan.md)

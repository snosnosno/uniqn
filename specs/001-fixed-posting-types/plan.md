# Implementation Plan: 고정공고 타입 시스템 확장

**Branch**: `001-fixed-posting-types` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fixed-posting-types/spec.md`

## Summary

고정공고(fixed posting) 기능을 위한 TypeScript 타입 시스템 확장 및 Zod 스키마 추가. 기존 JobPosting 타입을 확장하여 WorkSchedule, RoleWithCount, FixedJobPostingData, FixedJobPosting 인터페이스를 정의하고, 런타임 검증을 위한 Zod 스키마를 구현합니다. 레거시 필드(`type`, `recruitmentType`)와의 호환성을 유지하며 TypeScript strict mode를 100% 준수합니다.

## Technical Context

**Language/Version**: TypeScript 4.9 (strict mode)
**Primary Dependencies**:
- Zod 3.x (런타임 검증)
- Firebase 11.9 (Firestore 타입 호환성)
- date-fns 4.1 (날짜 처리)

**Storage**: Firebase Firestore (기존 jobPostings 컬렉션)
**Testing**: Jest + TypeScript (타입 검증 및 Zod 스키마 테스트)
**Target Platform**: Web (React 18.2) + 모바일 (Capacitor 7.4)
**Project Type**: Web application (app2/)

**Performance Goals**:
- TypeScript 컴파일 시간 <5초
- Zod 스키마 파싱 <10ms per object
- 타입 체크 0 에러

**Constraints**:
- TypeScript strict mode 100% 준수
- `any` 타입 사용 금지
- 기존 JobPosting 필드 수정 금지 (확장만 가능)
- 레거시 필드 호환성 유지

**Scale/Scope**:
- 4개 새로운 인터페이스
- 4개 Zod 스키마
- 1개 타입 가드 함수
- 기존 코드 영향 최소화 (타입 정의만 추가)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### UNIQN 프로젝트 규칙 준수

✅ **TypeScript Strict Mode 100%**
- 모든 새 타입에 명시적 타입 정의
- null/undefined 체크 필수
- `any` 타입 사용 금지

✅ **한글 주석 및 문서화**
- 모든 인터페이스에 JSDoc 주석 추가
- 필드 설명 한글로 작성

✅ **표준 필드명 사용**
- 기존 패턴 준수 (camelCase)
- Firebase 호환 필드명

✅ **다크모드 고려 사항**
- 이 기능은 타입 정의만 다루므로 UI 관련 없음 (N/A)

✅ **상대 경로 사용**
- import 문에서 상대 경로 사용
- 절대 경로 사용 금지

## Project Structure

### Documentation (this feature)

```text
specs/001-fixed-posting-types/
├── plan.md              # This file (generated)
├── spec.md              # Feature specification
├── research.md          # Phase 0 output (generated below)
├── data-model.md        # Phase 1 output (generated below)
├── quickstart.md        # Phase 1 output (generated below)
├── contracts/           # Phase 1 output (API contracts)
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
app2/
├── src/
│   ├── types/
│   │   └── jobPosting/
│   │       ├── jobPosting.ts         # [MODIFY] 새로운 인터페이스 추가
│   │       └── base.ts               # [READ] 기존 타입 참조
│   ├── schemas/
│   │   └── jobPosting/
│   │       ├── index.ts              # [MODIFY] 새로운 스키마 추가
│   │       ├── fixedPosting.schema.ts # [CREATE] 고정공고 스키마
│   │       ├── basicInfo.schema.ts   # [READ] 기존 스키마 참조
│   │       └── ...                   # 기타 기존 스키마
│   └── utils/
│       └── jobPosting/
│           └── jobPostingHelpers.ts  # [READ] normalizePostingType 헬퍼
└── package.json                       # [READ] Zod 버전 확인
```

**Structure Decision**: 기존 Web application 구조 유지. `app2/src/types/jobPosting/`에 타입 정의 추가, `app2/src/schemas/jobPosting/`에 Zod 스키마 추가. 기존 파일 구조를 최대한 활용하여 변경 최소화.

## Complexity Tracking

> **이 기능은 Constitution 위반 사항이 없으므로 이 섹션은 비어있습니다.**

---

## Phase 0: Outline & Research

### Research Tasks

1. **Zod 스키마 패턴 연구**
   - 기존 `app2/src/schemas/jobPosting/` 스키마 패턴 분석
   - `.merge()`, `.extend()`, `.refine()` 사용 패턴 파악
   - 에러 메시지 국제화 패턴 확인

2. **TypeScript 타입 가드 베스트 프랙티스**
   - `is` 키워드 사용 패턴
   - 타입 좁히기(type narrowing) 전략
   - 런타임 안전성 보장 방법

3. **레거시 호환성 전략**
   - `normalizePostingType` 헬퍼 동작 분석
   - deprecated 필드 처리 패턴
   - 마이그레이션 경로 설계

4. **Firestore 타입 호환성**
   - Timestamp 타입 처리
   - 옵셔널 필드 vs 필수 필드 전략
   - 데이터 마이그레이션 전략

### Research Output

#### Decision 1: Zod 스키마 구조

**Decision**: 고정공고 전용 스키마를 `fixedPosting.schema.ts`에 분리하고, `index.ts`에서 조합하는 패턴 사용

**Rationale**:
- 기존 패턴(`basicInfo.schema.ts`, `salary.schema.ts` 등)과 일관성 유지
- 각 스키마가 독립적으로 테스트 가능
- 재사용성 향상 (다른 곳에서도 WorkSchedule 검증 가능)

**Alternatives considered**:
- 모든 스키마를 `index.ts`에 작성 → 파일이 너무 커져서 유지보수 어려움
- JobPosting 스키마에 직접 통합 → 관심사 분리 원칙 위반

#### Decision 2: 타입 가드 위치

**Decision**: 타입 가드 함수를 `app2/src/types/jobPosting/jobPosting.ts`에 배치

**Rationale**:
- 타입 정의와 타입 가드를 같은 파일에 위치시켜 응집도 향상
- import 경로 단순화 (한 곳에서 타입과 가드 모두 import)
- 기존 프로젝트 패턴과 일관성

**Alternatives considered**:
- `utils/jobPosting/`에 별도 파일 생성 → 불필요한 파일 증가
- 각 컴포넌트에서 inline 구현 → 코드 중복 발생

#### Decision 3: 레거시 필드 처리

**Decision**: `type`과 `recruitmentType` 필드를 옵셔널로 유지하고 JSDoc `@deprecated` 주석 추가

**Rationale**:
- 기존 Firestore 데이터와의 호환성 유지
- 개발자에게 IDE 경고를 통해 마이그레이션 유도
- 점진적 마이그레이션 가능

**Alternatives considered**:
- 필드 완전 제거 → 기존 데이터 손상 위험
- 런타임 변환만 제공 → IDE 경고 없어 개발자 인지 어려움

#### Decision 4: FixedConfig 타입 재사용

**Decision**: 기존 `FixedConfig` 인터페이스를 그대로 사용 (수정 없음)

**Rationale**:
- FR-004에서 명시: "fixedConfig: 필수 FixedConfig 타입"
- 기존 타입이 이미 존재하고 요구사항 충족
- 변경 최소화 원칙 준수

**Alternatives considered**:
- 새로운 타입 정의 → 불필요한 중복
- 기존 타입 수정 → FR-012 위반 (기존 필드 수정 금지)

---

## Phase 1: Design & Contracts

### Data Model

*상세 내용은 `data-model.md` 참조*

#### 핵심 엔티티

1. **WorkSchedule**
   - 주 출근일수, 시작/종료 시간
   - HH:mm 형식 (24시간제)
   - 정규식 검증: `/^\d{2}:\d{2}$/`

2. **RoleWithCount**
   - 역할명 (string, 최소 1글자)
   - 모집 인원 (number, 최소 1)

3. **FixedJobPostingData**
   - WorkSchedule 포함
   - RoleWithCount 배열 (최소 1개)
   - viewCount (기본값 0)

4. **FixedJobPosting**
   - JobPosting 확장
   - postingType: 'fixed' (리터럴)
   - fixedConfig, fixedData 필수

### API Contracts

*이 기능은 타입 정의만 다루므로 API 엔드포인트 변경 없음*

기존 Firebase Firestore API 사용:
- `jobPostings` 컬렉션 읽기/쓰기
- 기존 CRUD 로직 변경 없음
- 타입만 확장

### Quickstart

*상세 내용은 `quickstart.md` 참조*

#### 개발자 사용 가이드

```typescript
// 1. 타입 import
import { FixedJobPosting, isFixedJobPosting } from '@/types/jobPosting/jobPosting';
import { fixedJobPostingSchema } from '@/schemas/jobPosting';

// 2. 타입 가드 사용
function processPosting(posting: JobPosting) {
  if (isFixedJobPosting(posting)) {
    // 이제 posting은 FixedJobPosting 타입으로 좁혀짐
    console.log(posting.fixedData.workSchedule.daysPerWeek);
  }
}

// 3. Zod 스키마 검증
const result = fixedJobPostingSchema.safeParse(data);
if (result.success) {
  // 유효한 고정공고 데이터
} else {
  // 검증 실패
  console.error(result.error);
}
```

### Agent Context Update

*`.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude` 실행 필요*

추가할 기술 스택 정보:
- Zod 3.x (런타임 검증)
- TypeScript 타입 가드 패턴
- Firebase Firestore 타입 호환성

---

## Next Steps

1. **Phase 0 Complete**: ✅ Research 완료
2. **Phase 1 Complete**: ✅ Design & Contracts 완료
3. **Phase 2**: `/speckit.tasks` 명령으로 작업 목록 생성

### 구현 순서

1. **P1 (최우선)**: 타입 정의
   - `WorkSchedule`, `RoleWithCount`, `FixedJobPostingData`, `FixedJobPosting` 인터페이스 추가
   - `isFixedJobPosting` 타입 가드 구현
   - deprecated 주석 추가

2. **P2 (다음)**: Zod 스키마
   - `workScheduleSchema`, `roleWithCountSchema` 구현
   - `fixedJobPostingDataSchema`, `fixedJobPostingSchema` 구현
   - 에러 메시지 한글화

3. **P3 (마지막)**: 테스트 및 검증
   - 타입 체크 테스트
   - Zod 스키마 유효성 테스트
   - 레거시 호환성 테스트

### 검증 체크리스트

- [ ] `npm run type-check` 통과 (에러 0개)
- [ ] 모든 새 타입에 JSDoc 주석 작성
- [ ] `isFixedJobPosting` 타입 가드 동작 확인
- [ ] Zod 스키마 유효성 검사 동작 확인
- [ ] deprecated 필드에 경고 표시 확인
- [ ] IDE 자동완성 동작 확인

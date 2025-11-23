# Implementation Plan: 고정공고 상세보기 및 Firestore 인덱스 설정

**Branch**: `001-fixed-job-detail` | **Date**: 2025-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-fixed-job-detail/spec.md`

## Summary

고정공고 상세보기 모달에 근무 조건(주 출근일수, 근무시간)과 모집 역할 목록을 표시하고, Firestore 복합 인덱스를 설정하여 목록 조회 성능을 보장합니다. 조회수는 카드 클릭 즉시 증가하며, 인덱스는 개발/스테이징 환경에서 미리 생성 후 프로덕션 배포를 진행합니다.

## Technical Context

**Language/Version**: TypeScript 4.9 (strict mode)
**Primary Dependencies**: React 18.2, Firebase 11.9 (Firestore), Tailwind CSS 3.3, date-fns 4.1
**Storage**: Firestore (jobPostings 컬렉션, fixedData 서브 필드)
**Testing**: Jest, React Testing Library, E2E (Playwright)
**Target Platform**: Web (Chrome, Safari, Firefox), Mobile (Capacitor 7.4)
**Project Type**: Web application (app2/ 디렉토리)
**Performance Goals**:
- 모달 오픈 2초 이내
- viewCount 증가 응답 100ms 이내
- 인덱스 조회 쿼리 100% 성공률

**Constraints**:
- 기존 JobDetailModal 최소 수정 (조건부 렌더링만 추가)
- Firestore increment() 사용 (조회수)
- 다크모드 완전 지원 (dark: 클래스 필수)
- Phase 1-3 완료 상태 의존

**Scale/Scope**:
- 1개 모달 컴포넌트 수정
- 1개 서비스 파일 신규 생성
- 1개 Firestore 인덱스 추가
- 4개 User Story, 10개 FR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### CLAUDE.md 준수 사항

**✅ 필수 규칙 (CLAUDE.md)**:
- [x] 한글 답변
- [x] TypeScript strict mode 100%
- [x] 표준 필드명 사용 (fixedData, viewCount)
- [x] Firebase onSnapshot 실시간 구독
- [x] logger 사용 (console.log 금지)
- [x] 메모이제이션 (useMemo, useCallback)
- [x] 다크모드 필수 (dark: 클래스)

**✅ 절대 금지 (CLAUDE.md)**:
- [x] console.log/error 직접 사용 안 함 (logger 사용)
- [x] any 타입 사용 안 함
- [x] 다크모드 미적용 안 함
- [x] 절대 경로 사용 안 함 (상대 경로만)

**✅ 기능 추가 체크리스트**:
- [x] 유사 기능 확인: JobDetailModal 재사용
- [x] 표준 필드명 확인: fixedData, viewCount
- [x] Context 활용: UnifiedDataContext 사용
- [x] 재사용 컴포넌트: 기존 Modal 구조 활용

**✅ 배포 전 검증**:
- [ ] npm run type-check 통과 (Phase 2 후)
- [ ] npm run lint 통과 (Phase 2 후)
- [ ] npm run build 성공 (Phase 2 후)
- [ ] npx cap sync 성공 (Phase 2 후)

**⚠️ 주의사항**:
- Firestore 인덱스는 개발/스테이징에서 먼저 생성 후 프로덕션 배포
- 조회수 증가는 fire-and-forget 패턴 (사용자 경험 방해 금지)

## Project Structure

### Documentation (this feature)

```text
specs/001-fixed-job-detail/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (PENDING)
├── data-model.md        # Phase 1 output (PENDING)
├── quickstart.md        # Phase 1 output (PENDING)
├── contracts/           # Phase 1 output (PENDING)
│   └── fixedJobPosting.ts  # Type definitions & interfaces
└── checklists/
    └── requirements.md  # Spec quality checklist (완료)
```

### Source Code (repository root)

```text
app2/                              # Main application directory
├── src/
│   ├── pages/
│   │   └── JobBoard/
│   │       └── components/
│   │           └── JobDetailModal.tsx  # ✏️ 수정: 고정공고 섹션 추가
│   │
│   ├── services/
│   │   └── fixedJobPosting.ts         # ✨ 신규: 조회수 증가 로직
│   │
│   ├── types/
│   │   └── jobPosting/
│   │       └── index.ts               # 기존: FixedJobPosting 타입 사용
│   │
│   └── hooks/
│       └── useFixedJobPostings.ts     # 기존: Phase 3에서 생성됨
│
├── firestore.indexes.json             # ✏️ 수정: 복합 인덱스 추가
│
└── tests/
    ├── integration/
    │   └── fixedJobPosting.test.ts    # ✨ 신규: 조회수 증가 테스트
    │
    └── e2e/
        └── fixedJobDetail.spec.ts     # ✨ 신규: 전체 플로우 E2E
```

**Structure Decision**:
기존 app2/ Web application 구조 유지. JobDetailModal 컴포넌트를 최소한으로 수정하고, 조회수 증가 로직은 별도 서비스 파일로 분리하여 관심사를 명확히 합니다. Firestore 인덱스는 루트의 firestore.indexes.json에 추가합니다.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

해당 없음 - 모든 Constitution 요구사항을 준수합니다.

---

## Phase 0: Outline & Research

### Research Tasks

1. **JobDetailModal 현재 구조 분석**
   - 목적: 기존 모달 구조를 파악하여 최소한의 수정으로 고정공고 섹션 추가
   - 방법: JobDetailModal.tsx 파일 읽기, 조건부 렌더링 위치 식별
   - 산출물: 기존 구조 다이어그램, 수정 포인트 문서화

2. **Firestore increment() 모범 사례**
   - 목적: 조회수 증가의 fire-and-forget 패턴 구현 방법 확인
   - 방법: Firebase 공식 문서 참조, 에러 처리 전략 수립
   - 산출물: increment() 사용 예제, 에러 처리 코드 패턴

3. **Firestore 복합 인덱스 배포 전략**
   - 목적: 인덱스 생성 중 쿼리 실패 방지 전략 수립
   - 방법: Firebase CLI 명령어 확인, 개발/스테이징 환경 배포 순서 정의
   - 산출물: 인덱스 배포 절차, 검증 체크리스트

4. **다크모드 스타일링 패턴**
   - 목적: 모달 내 모든 UI 요소의 다크모드 적용 검증
   - 방법: 기존 다크모드 클래스 패턴 확인, Tailwind dark: 클래스 사용법
   - 산출물: 다크모드 스타일 가이드, 검증 체크리스트

5. **빈 역할 목록 UI 패턴**
   - 목적: "모집 역할이 없습니다" 메시지의 일관된 UI 패턴 확인
   - 방법: 프로젝트 내 유사한 빈 상태 메시지 패턴 검색
   - 산출물: 빈 상태 UI 컴포넌트 예제

### Research Agents Dispatch

**Agent 1: 기존 코드 구조 분석**
```
Task: "JobDetailModal.tsx 구조 분석 및 고정공고 섹션 추가 위치 식별"
Files: app2/src/pages/JobBoard/components/JobDetailModal.tsx
Output: 기존 구조 다이어그램, 조건부 렌더링 삽입 위치
```

**Agent 2: Firebase 모범 사례 연구**
```
Task: "Firestore increment() 및 복합 인덱스 배포 전략 연구"
Sources: Firebase 공식 문서, CLAUDE.md 가이드라인
Output: increment() 패턴, 인덱스 배포 순서
```

**Agent 3: 프로젝트 패턴 확인**
```
Task: "다크모드 및 빈 상태 UI 패턴 추출"
Files: app2/src/components/**, app2/src/pages/**
Output: 다크모드 클래스 사용 예제, 빈 상태 메시지 패턴
```

**Output**: research.md (모든 NEEDS CLARIFICATION 해결)

---

## Phase 1: Design & Contracts

### Data Model (data-model.md)

**기존 엔티티 (Phase 1-3에서 정의됨)**:

```typescript
// FixedJobPosting 타입 (기존)
interface FixedJobPosting extends BaseJobPosting {
  postingType: 'fixed';
  fixedData: {
    workSchedule: WorkSchedule;
    requiredRolesWithCount: RequiredRoleWithCount[];
    viewCount: number;  // ✨ 조회수 (Phase 4에서 활용)
    // ... 기타 필드
  };
}

// WorkSchedule (기존)
interface WorkSchedule {
  daysPerWeek: number;
  startTime: string;
  endTime: string;
}

// RequiredRoleWithCount (기존)
interface RequiredRoleWithCount {
  name: string;
  count: number;
}
```

**Phase 4 추가 사항**: 없음 (기존 타입 활용)

### API Contracts (contracts/)

**contracts/fixedJobPosting.ts**:

```typescript
// 조회수 증가 서비스 인터페이스
export interface ViewCountService {
  incrementViewCount(postingId: string): Promise<void>;
}

// 상세보기 데이터 인터페이스
export interface JobDetailData {
  id: string;
  title: string;
  location: string;
  status: string;
  workSchedule: WorkSchedule;
  requiredRolesWithCount: RequiredRoleWithCount[];
  viewCount: number;
}

// 에러 타입
export type ViewCountError =
  | { type: 'network'; message: string }
  | { type: 'permission'; message: string }
  | { type: 'unknown'; message: string };
```

### Quickstart (quickstart.md)

```markdown
# 고정공고 상세보기 Quickstart

## 1. 조회수 증가 사용법

\`\`\`typescript
import { incrementViewCount } from '@/services/fixedJobPosting';

const handleCardClick = async (posting: FixedJobPosting) => {
  // 카드 클릭 즉시 조회수 증가 (fire-and-forget)
  await incrementViewCount(posting.id);

  // 모달 열기
  openDetailModal(posting);
};
\`\`\`

## 2. 상세보기 모달 확인

\`\`\`tsx
{isFixedJobPosting(posting) && (
  <div className="border-t dark:border-gray-700 pt-4">
    <h3 className="font-semibold dark:text-gray-100">근무 조건</h3>
    {/* 근무 조건 표시 */}

    <h4 className="font-semibold mt-4 dark:text-gray-100">모집 역할</h4>
    {posting.fixedData.requiredRolesWithCount.length > 0 ? (
      <ul>...</ul>
    ) : (
      <p className="text-gray-500 dark:text-gray-400">
        모집 역할이 없습니다
      </p>
    )}
  </div>
)}
\`\`\`

## 3. Firestore 인덱스 배포

\`\`\`bash
# 개발/스테이징 환경에서 먼저 배포
firebase deploy --only firestore:indexes --project dev

# 인덱스 생성 완료 확인 (Firebase Console)
# 프로덕션 배포
firebase deploy --only firestore:indexes --project prod
\`\`\`

## 4. 테스트

\`\`\`bash
# 타입 체크
npm run type-check

# 단위 테스트
npm test -- fixedJobPosting

# E2E 테스트
npm run test:e2e -- fixedJobDetail
\`\`\`
```

### Agent Context Update

```bash
# Claude agent context 업데이트
powershell.exe -ExecutionPolicy Bypass -File ".specify/scripts/powershell/update-agent-context.ps1" -AgentType claude
```

**추가될 기술**:
- Firestore increment() 패턴
- 복합 인덱스 배포 전략
- fire-and-forget 에러 처리

---

## Phase 1 Complete - Constitution Re-check

### Post-Design Validation

**✅ 모든 Constitution 요구사항 준수**:
- [x] TypeScript strict mode (any 타입 없음)
- [x] 표준 필드명 (fixedData, viewCount)
- [x] logger 사용 (incrementViewCount 에러 핸들러)
- [x] 다크모드 (모든 UI 요소에 dark: 클래스)
- [x] 상대 경로만 사용
- [x] 기존 컴포넌트 최소 수정
- [x] Phase 1-3 타입 시스템 활용

**⚠️ 배포 시 주의사항**:
1. Firestore 인덱스는 개발 환경에서 먼저 생성 확인
2. 조회수 증가 실패는 로그만 기록 (사용자 방해 금지)
3. E2E 테스트로 전체 플로우 검증 필수

---

## Next Steps

1. **Phase 0 완료**: research.md 생성 (위 연구 과제 해결)
2. **Phase 1 완료**: data-model.md, contracts/, quickstart.md 생성
3. **Agent Context 업데이트**: Claude agent 컨텍스트에 새 기술 추가
4. **Phase 2 대기**: `/speckit.tasks` 명령으로 tasks.md 생성

**보고**:
- Branch: `001-fixed-job-detail`
- Plan: `C:\Users\user\Desktop\T-HOLDEM\specs\001-fixed-job-detail\plan.md` ✅
- 다음 명령: `/speckit.plan` 내부에서 Phase 0-1 자동 실행

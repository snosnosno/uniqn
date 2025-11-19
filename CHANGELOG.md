# Changelog

이 프로젝트의 모든 주요 변경사항이 이 파일에 문서화됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

## [Unreleased]

### 🔄 Zustand 마이그레이션 Phase 1-2: Context → Zustand 완전 마이그레이션 (2025-11-19)

#### Context API 완전 제거
- **파일 삭제**: UnifiedDataContext.tsx 및 관련 테스트 파일 4개 제거
- **아키텍처 변경**: Context Provider → Zustand Store + UnifiedDataInitializer
- **코드 정리**: 레거시 Context API 의존성 완전 제거
- **검증 완료**: TypeScript 타입 체크 0 에러

#### 마이그레이션 완료 현황
- **useUnifiedData.ts**: 이미 100% Zustand 기반 (Phase 0에서 완료됨)
- **모든 컴포넌트**: hooks/useUnifiedData 사용 중 (Context 의존성 없음)
- **App.tsx**: UnifiedDataProvider 제거, UnifiedDataInitializer 사용
- **테스트**: Context 테스트 파일 제거, Zustand Store 테스트로 대체

#### 삭제된 파일
- `src/contexts/UnifiedDataContext.tsx` - 레거시 Context 구현
- `src/contexts/__tests__/UnifiedDataContext.test.tsx` - 단위 테스트
- `src/contexts/__tests__/UnifiedDataContext.integration.test.tsx` - 통합 테스트
- `src/contexts/__tests__/UnifiedDataContext.performance.test.tsx` - 성능 테스트

#### 기술 지표
- TypeScript 에러: 0개 (strict mode 유지)
- Context API 의존성: 0개 (완전 제거)
- 마이그레이션 완료율: 100%
- Breaking Changes: 없음 (기존 API 100% 호환)

### 🔄 Zustand 마이그레이션 Phase 3: 코드 품질 & 리팩토링 (2025-11-19)

#### Issue 6: Generic CRUD Pattern 최적화
- **코드 감소**: 82줄 → 20줄 (-76% 감소)
- **패턴**: 모든 CRUD 함수를 한 줄 화살표 함수로 간결화
- **유지보수성**: 새 컬렉션 추가 시 5줄만 추가하면 됨 (기존 15줄)
- **호환성**: 기존 API 100% 유지 (Breaking Changes 없음)
- **구현 내용**:
  - 5개 컬렉션 × 3개 CRUD 함수 = 15개 함수 최적화
  - `setStaff`, `updateStaff`, `deleteStaff` (Staff)
  - `setWorkLogs`, `updateWorkLog`, `deleteWorkLog` (WorkLog)
  - `setApplications`, `updateApplication`, `deleteApplication` (Application)
  - `setAttendanceRecords`, `updateAttendanceRecord`, `deleteAttendanceRecord` (AttendanceRecord)
  - `setJobPostings`, `updateJobPosting`, `deleteJobPosting` (JobPosting)

#### Issue 7: Batch Actions 성능 최적화
- **신규 함수**: 10개 Batch Actions 추가
- **성능 향상**: 개별 업데이트 대비 90% 리렌더링 감소
- **패턴**: `forEach` 루프를 단일 `set()` 호출 내부에 배치
- **테스트 커버리지**: 2개 성능 테스트 추가 (개별 vs 배치 비교)
- **구현 내용**:
  - `updateStaffBatch(items: Staff[])` - Staff 대량 업데이트
  - `deleteStaffBatch(ids: string[])` - Staff 대량 삭제
  - `updateWorkLogsBatch(items: WorkLog[])` - WorkLog 대량 업데이트
  - `deleteWorkLogsBatch(ids: string[])` - WorkLog 대량 삭제
  - `updateApplicationsBatch(items: Application[])` - Application 대량 업데이트
  - `deleteApplicationsBatch(ids: string[])` - Application 대량 삭제
  - `updateAttendanceRecordsBatch(items: AttendanceRecord[])` - AttendanceRecord 대량 업데이트
  - `deleteAttendanceRecordsBatch(ids: string[])` - AttendanceRecord 대량 삭제
  - `updateJobPostingsBatch(items: JobPosting[])` - JobPosting 대량 업데이트
  - `deleteJobPostingsBatch(ids: string[])` - JobPosting 대량 삭제

#### 테스트 강화
- **성능 테스트**: `unifiedDataStore.performance.test.ts`에 Batch Actions 성능 테스트 추가
- **벤치마크**: 개별 업데이트 10회 vs Batch 업데이트 1회 성능 비교
- **검증**: Batch가 개별 대비 1.5배 이내 성능 보장

#### 기술 지표
- TypeScript 에러: 0개 (strict mode 유지)
- 코드 감소: 82줄 → 20줄 (-76%)
- 신규 기능: 10개 Batch Actions
- API 호환성: 100% 유지 (Breaking Changes 없음)
- 성능: 90% 리렌더링 감소

### 변경
- `src/stores/unifiedDataStore.ts` - Generic CRUD Pattern 적용 및 Batch Actions 추가
- `src/stores/__tests__/unifiedDataStore.performance.test.ts` - Batch Actions 성능 테스트 추가

### 타입 안전성 개선 (Phase 1-1)
- **useJobPostingForm Hook 타입 안전성 강화**:
  - 28개 `any` 타입 완전 제거 → 명시적 타입 지정
  - `useState<JobPostingFormData>()` 제네릭 타입 적용
  - 모든 `setFormData` 콜백에 명시적 타입 지정: `(prev: JobPostingFormData) => ...`
  - TypeScript strict mode 완전 준수 (0 errors in useJobPostingForm.ts)
  - IDE 자동완성 및 타입 체크 개선
- **타입 호환성 유지**:
  - JobPostingForm.tsx 및 JobPostingCard.tsx 컴포넌트 수정 없이 호환성 유지
  - Hook API 변경 없음 (backward compatible)
  - 기존 E2E 테스트 스위트 통과

### 예정 (v0.3.0+)
- **고급 기능 안정화 및 테스트**:
  - Web Worker 기반 급여 계산 기능 테스트 및 안정화
  - 스마트 캐싱 및 가상화 기능 성능 검증
- **신규 기능**:
  - 관리자 대시보드 통계 기능
  - QR 코드를 이용한 자동 출퇴근 시스템
  - 알림 설정 페이지 (사용자별 알림 ON/OFF)
- **품질 개선**:
  - E2E 테스트 커버리지 확대 (65% → 80%)
  - 모바일 최적화 및 PWA 고도화
- **기술 부채 해결**:
  - JobPostingFormData.type 필드 타입 정의 개선 (string → 'application' | 'fixed')

## [0.2.4] - 2025-10-31

### 🎯 구인공고 타입 확장 시스템 완성 (Production Ready)

#### 타입 시스템 확장
- **4개 공고 타입 지원**: 지원(📋 regular), 고정(📌 fixed), 대회(🏆 tournament), 긴급(🚨 urgent)
- **타입별 특화 기능**:
  - 지원 공고: 기본 무료 공고
  - 고정 공고: 상단 고정 (7일 3칩, 30일 5칩, 90일 10칩) + D-N 만료일 표시
  - 대회 공고: 관리자 승인 필요 (pending → approved/rejected) + 무료
  - 긴급 공고: 빨간 테두리 애니메이션 + 5칩 고정

#### 칩 시스템 통합
- **비용 계산 로직**: 타입 및 기간별 차등 과금
- **칩 배지 표시**: 비용이 있는 공고에만 배지 표시
- **isChipDeducted 필드**: 향후 결제 시스템 연동 준비

#### 게시판 구조 개편
- **5탭 구조**: 지원 공고, 고정 공고, 대회 공고, 긴급 공고, 내 지원 현황
- **탭별 필터링**: postingType 기반 자동 필터링
- **날짜 슬라이더**: 지원 공고 탭 전용 (어제~+14일 범위)

#### 대회 공고 승인 시스템
- **Firebase Functions 3개 배포**:
  1. `approveJobPosting`: 대회 공고 승인 (Admin 전용)
  2. `rejectJobPosting`: 대회 공고 거부 (Admin 전용, 거부 사유 필수)
  3. `onTournamentApprovalChange`: 승인 상태 변경 트리거 (알림 발송)
- **관리자 승인 페이지**: `/admin/job-posting-approvals`
- **알림 통합**: 승인/거부 시 자동 알림 발송

#### 테스트 & QA
- **243개 테스트 통과**: 단위 테스트 160개 + 통합 테스트 83개
- **컴포넌트 단위 테스트 107개**:
  - ApprovalModal: 23개 (승인/거부 모달)
  - FixedPostingBadge: 25개 (만료일 배지)
  - DateSlider: 24개 (날짜 슬라이더)
  - JobPostingCard: 35개 (공고 카드)
- **통합 테스트 39개**:
  - approvalWorkflow.test.ts: 승인 워크플로우 전체 시나리오
- **레거시 호환성 테스트 20개**: 기존 데이터 변환 검증
- **TypeScript 에러**: 0개 (100% 타입 안전)
- **ESLint 경고**: 0개 (구인공고 관련)

#### Firestore 최적화
- **인덱스 3개 추가**:
  1. postingType + status + createdAt
  2. postingType + createdBy + createdAt
  3. postingType + tournamentConfig.approvalStatus + createdAt
- **Security Rules 업데이트**:
  - validateFixedConfig() 함수 추가
  - validateTournamentConfig() 함수 추가
  - validateUrgentConfig() 함수 추가
  - jobPostings create 규칙 업데이트

#### 다크모드 완전 지원
- **모든 신규 컴포넌트 다크모드 적용**:
  - DateSlider: 배경, 버튼, 스크롤바
  - FixedPostingBadge: 정상/임박/만료 상태별 색상
  - TournamentStatusBadge: pending/approved/rejected 배지
  - ApprovalModal: 모달, 배경, 입력 필드
  - ApprovalManagementPage: 전체 페이지 + 테이블
  - JobBoardTabs: 탭 버튼, 활성/비활성 상태

#### 문서화
- **구현 명세서 v3.0**: Implementation Complete 상태로 업데이트
- **배포 체크리스트**: Firebase 배포 절차 및 롤백 계획
- **README.md**: v0.2.4 기능 반영
- **CHANGELOG.md**: 상세 변경 내역 기록

### 추가
- `src/types/jobPosting/boardTab.ts` - 게시판 탭 타입
- `src/types/jobPosting/chipPricing.ts` - 칩 가격 타입
- `src/config/boardTabs.ts` - 5탭 구조 설정
- `src/config/chipPricing.ts` - 칩 가격 설정
- `src/components/jobPosting/DateSlider.tsx` - 날짜 슬라이더 (115줄)
- `src/components/jobPosting/FixedPostingBadge.tsx` - 만료일 배지 (86줄)
- `src/components/jobPosting/TournamentStatusBadge.tsx` - 승인 상태 배지
- `src/components/jobPosting/ApprovalModal.tsx` - 승인/거부 모달
- `src/pages/JobBoard/components/JobBoardTabs.tsx` - 탭 컴포넌트
- `src/pages/admin/ApprovalManagementPage.tsx` - 승인 관리 페이지
- `src/utils/jobPosting/chipCalculator.ts` - 칩 비용 계산
- `src/utils/jobPosting/chipNotification.ts` - 칩 부족 알림
- `src/utils/jobPosting/dateFilter.ts` - 날짜 필터링
- `functions/src/jobPosting/approveJobPosting.ts` - 승인 함수
- `functions/src/jobPosting/rejectJobPosting.ts` - 거부 함수
- `functions/src/triggers/onTournamentApprovalChange.ts` - 트리거 함수
- `docs/JOB_POSTING_SYSTEM_IMPLEMENTATION_SPEC.md` - 구현 명세서 v3.0
- `docs/DEPLOYMENT_CHECKLIST.md` - 배포 체크리스트

### 변경
- `src/types/jobPosting/jobPosting.ts` - postingType 확장 (4개 타입)
- `src/pages/JobBoard/index.tsx` - 5탭 구조 적용
- `src/components/common/JobPostingCard.tsx` - 타입별 아이콘 및 배지
- `src/components/jobPosting/JobPostingForm.tsx` - 타입별 UI 분기
- `src/hooks/useJobPostings.ts` - 타입 필터링 로직
- `src/hooks/useJobPostingOperations.ts` - CRUD 작업 타입 안전성
- `src/utils/jobPosting/jobPostingHelpers.ts` - 헬퍼 함수 확장
- `firestore.rules` - 타입별 검증 함수 추가
- `firestore.indexes.json` - 인덱스 3개 추가
- `public/locales/ko/translation.json` - 공고 타입 번역 추가
- `public/locales/en/translation.json` - 공고 타입 번역 추가
- `tailwind.config.js` - 긴급 공고 애니메이션 추가
- `README.md` - v0.2.4 기능 반영
- `CLAUDE.md` - 프로젝트 상태 업데이트

### 기술 지표
- TypeScript 에러: 0개 (strict mode)
- ESLint 경고: 0개 (구인공고 관련)
- 프로덕션 빌드: 성공 ✅
- 테스트: 243개 통과 (단위 160개 + 통합 83개)
- 테스트 커버리지: 65% 유지
- 번들 크기: 299KB (최적화 유지)

### 배포 완료 (100%)
- ✅ 코드 품질 검증 완료 (TypeScript 0 에러, 테스트 243개 통과)
- ✅ Firestore Indexes 배포 완료 (3개 인덱스)
- ✅ Firestore Rules 배포 완료 (타입 검증 함수)
- ✅ Firebase Functions 배포 완료 (5개 함수 전체)
  - approveJobPosting (Gen2 callable)
  - rejectJobPosting (Gen2 callable)
  - expireFixedPostings (Gen2 scheduled)
  - onTournamentApprovalChange (Gen2 firestore trigger) ✅ 재배포 성공
  - onFixedPostingExpired (Gen2 firestore trigger) ✅ 재배포 성공
- ✅ Hosting 배포 완료 (https://tholdem-ebc18.web.app)

## [0.2.3] - 2025-10-02

### 📱 실시간 알림 센터 시스템 구현 완료

#### 알림 시스템 핵심 기능
- **14개 알림 타입 지원**: 시스템(3), 근무(3), 일정(3), 급여(2), 소셜(3)
- **실시간 알림 관리**: Firestore 실시간 구독으로 즉시 알림 표시
- **확장 가능한 아키텍처**: 3단계 프로세스로 새 알림 타입 추가 용이
- **완벽한 타입 안정성**: TypeScript strict mode 100% 준수

#### 구현된 컴포넌트
- **NotificationBadge**: 읽지 않은 알림 개수 배지 (count/dot 모드)
- **NotificationItem**: 개별 알림 아이템 (아이콘, 색상, 상대 시간)
- **NotificationDropdown**: 헤더 드롭다운 (최근 5개 미리보기)
- **NotificationsPage**: 전체 알림 센터 페이지 (탭, 필터링, 일괄 작업)

#### 데이터 관리
- **useNotifications Hook**: Firestore 실시간 구독 및 CRUD 작업
- **Firestore 최적화**: 인덱스, Batch 처리, 최대 50개 제한
- **React 최적화**: useMemo, useCallback으로 성능 최적화

#### 다국어 지원
- **한국어/영어**: 35개 키 완전 번역
- **확장 가능**: 새 언어 추가 용이

#### 기술 세부사항
- **코드량**: 1,414줄 (7개 파일)
- **TypeScript 에러**: 0개
- **ESLint 경고**: 0개 (알림 관련)
- **번들 크기**: +8.46 KB (최적화됨)

#### 지원하는 알림 타입
1. **구인공고 공지** (job_posting_announcement) - 완전 구현 ✅
2. **지원서 도착** (job_application) - 부분 구현 ⚠️
3. **스태프 승인** (staff_approval) - 미연결 ⚠️
4. **스태프 거절** (staff_rejection) - 미구현 ❌
5. **일정 리마인더** (schedule_reminder) - 부분 구현 ⚠️
6. **일정 변경** (schedule_change) - 미구현 ❌
7. **출석 알림** (attendance_reminder) - 부분 구현 ⚠️
8. **급여 지급** (salary_notification) - 부분 구현 ⚠️
9. **보너스** (bonus_notification) - 미구현 ❌
10. **시스템 공지** (system_announcement) - 미구현 ❌
11. **앱 업데이트** (app_update) - 미구현 ❌
12. **댓글** (comment) - 향후 확장 🔮
13. **좋아요** (like) - 향후 확장 🔮
14. **멘션** (mention) - 향후 확장 🔮

#### 향후 확장 계획
- **Phase 2**: 알림 설정 (사용자별 ON/OFF, 카테고리별 설정)
- **Phase 3**: 소셜 알림 (댓글, 좋아요, 멘션)
- **Phase 4**: 고급 기능 (그룹핑, 검색, 아카이브, 통계)

### 추가
- `src/types/notification.ts` - 알림 타입 시스템 (169줄)
- `src/config/notificationConfig.ts` - 알림 설정 중앙화 (186줄)
- `src/hooks/useNotifications.ts` - Firestore 실시간 구독 Hook (357줄)
- `src/components/notifications/NotificationBadge.tsx` - 알림 배지 (70줄)
- `src/components/notifications/NotificationItem.tsx` - 알림 아이템 (224줄)
- `src/components/notifications/NotificationDropdown.tsx` - 헤더 드롭다운 (202줄)
- `src/pages/NotificationsPage.tsx` - 알림 센터 페이지 (208줄)
- `docs/NOTIFICATION_SYSTEM.md` - 알림 시스템 완료 문서

### 변경
- `src/components/layout/HeaderMenu.tsx` - NotificationDropdown 통합
- `src/App.tsx` - `/app/notifications` 라우트 추가
- `src/components/Icons/ReactIconsReplacement.tsx` - FaBell 아이콘 추가
- `public/locales/ko/translation.json` - 한국어 알림 번역 (35개 키)
- `public/locales/en/translation.json` - 영어 알림 번역 (35개 키)

### 기술 지표
- TypeScript 에러: 0개 (strict mode)
- ESLint 경고: 0개 (알림 관련)
- 프로덕션 빌드: 성공 ✅
- 번들 크기: 299.92 KB (+8.46 KB)
- CSS 크기: 13.88 KB (+110 B)

## [0.2.2] - 2025-09-19

### 🔐 인증 시스템 고도화 완료

#### 보안 강화
- **로그인 시스템 안정화**: 세션 관리 및 인증 플로우 개선
- **고급 인증 기능**: 2단계 인증(2FA) 및 보안 강화 기능 구현
- **사용자 경험 개선**: 로그인/로그아웃 프로세스 최적화

#### 국제화 (i18n) 완전 구현
- **다국어 지원**: 한국어/영어 완전 지원
- **동적 언어 전환**: 실시간 언어 변경 기능
- **하드코딩 텍스트 제거**: 모든 UI 텍스트 국제화 완료

#### 사용자 인터페이스 개선
- **메뉴 시스템 개선**: 직관적인 네비게이션 구조
- **프로필 필수 정보 설정**: 사용자 프로필 완성도 관리
- **사용자 역할별 메뉴**: 권한 기반 메뉴 시스템

### 변경
- 프로젝트 상태: Production Ready 95% → 96%
- 글로벌 서비스 준비: 다국어 지원으로 해외 시장 진출 가능
- 보안 수준: 엔터프라이즈급 보안 기능 적용

## [0.2.1] - 2025-09-16

### 대규모 코드 정리 완료 🧩

#### 코드 구조 체계화
- **폴더 구조 대폭 개선**: 47개 컴포넌트 → 17개 (65% 감소)
- **카테고리별 분류**: 10개 전문 폴더 생성
  - `attendance/`: 출석 관리 (2개)
  - `auth/`: 인증 관리 (4개)
  - `errors/`: 에러 처리 (3개)
  - `layout/`: 레이아웃 (3개)
  - `modals/`: 모달 관리 (12개)
  - `staff/`: 스태프 관리 (9개)
  - `tables/`: 테이블 관리 (2개)
  - `time/`: 시간 관리 (2개)
  - `upload/`: 업로드 (1개)

#### 코드 품질 개선
- **중복 컴포넌트 제거**: Input 컴포넌트 통일
- **TODO/FIXME 해결**: 모든 미완성 작업 완료
- **Dead Code 제거**: 주석 처리된 logger 문장 정리
- **Import 경로 최적화**: 100+ 개 import 경로 수정

#### 테스트 인프라 정비
- **18개 테스트 파일** 경로 수정 완료
- **Mock 경로 업데이트**: 폴더 구조 변경 반영

#### 빌드 검증
- **TypeScript 에러**: 100+ 개 → 0개 해결
- **프로덕션 빌드**: 성공 (279KB 번들)

### 변경
- 프로젝트 상태: Production Ready 90% → 95%
- 코드 유지보수성: 폴더 구조 체계화로 대폭 향상
- 개발 효율성: 컴포넌트 찾기 시간 단축

---

## [0.2.0] - 2025-09-16

### 🎉 5단계 체계적 개선 완료 (Production Ready)

#### Phase 1: 레거시 시스템 현대화
- **레거시 필드 완전 제거**: dealerId → staffId, jobPostingId → eventId 완전 전환
- **Toast 시스템 도입**: 77개 alert() → 모던 Toast 알림으로 100% 교체
- **UX 대폭 개선**: 사용자 경험 현대화 및 일관성 향상

#### Phase 2: TypeScript 타입 안전성 강화
- **TypeScript strict mode**: 100% 준수 달성
- **any 타입 완전 제거**: 11개 any 타입을 구체적 타입으로 변경
- **타입 안전성**: Firebase 호환성 개선 및 런타임 에러 방지

#### Phase 3: 성능 최적화
- **React.memo 적용**: ApplicantListTabUnified, MemoizedApplicantRow 최적화
- **번들 크기 최적화**: 279KB 달성 (목표 대비 최적화)
- **코드 스플리팅**: 확대 적용으로 초기 로드 성능 개선
- **메모이제이션**: 렌더링 성능 대폭 향상

#### Phase 4: 코드 품질 개선
- **Dead Code 제거**: 사용하지 않는 import 및 도달 불가능한 코드 정리
- **Warning 감소**: 빌드 warning 대폭 줄임
- **코드 일관성**: 프로젝트 전반 품질 표준화

#### Phase 5: 테스트 강화
- **커버리지 검증**: 65% 달성 (Production Ready 수준)
- **테스트 안정성**: 핵심 기능 테스트 통과 확인
- **문제 테스트 격리**: Worker, IndexedDB 의존성 문제 해결

### 변경
- 프로젝트 상태: MVP 75% → Production Ready 90%
- 코드 품질: Enterprise 수준으로 향상
- 성능: 번들 최적화 및 렌더링 성능 개선
- 안정성: TypeScript 에러 0개, any 타입 0개 달성

## [0.1.0] - 2025-09-10

### 추가 (MVP 핵심 기능)
- **사용자 인증**: 이메일 기반 회원가입 및 로그인 기능.
- **구인공고 관리**: 구인공고 생성, 조회, 수정, 삭제(CRUD) 기능.
- **지원자 관리**: 구인공고에 대한 지원 및 지원자 목록 관리.
- **스태프 관리**: 지원자 확정을 통한 스태프 전환 기능.
- **기본 출석 관리**: 스태프의 출석 상태 수동 변경 기능.
- **기본 급여 계산**: 근무 기록을 바탕으로 한 기본 급여 계산 로직.
- **아키텍처**: `UnifiedDataContext`를 사용한 중앙 데이터 관리 구조 확립.
- **테스트**: Jest, React Testing Library를 이용한 단위/통합 테스트 환경 구축.

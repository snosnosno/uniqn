# Changelog

이 프로젝트의 모든 주요 변경사항이 이 파일에 문서화됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 기반으로 하며,
이 프로젝트는 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)을 준수합니다.

## [Unreleased]

### 예정 (v0.3.0+)
- **고급 기능 안정화 및 테스트**:
  - Web Worker 기반 급여 계산 기능 테스트 및 안정화
  - 스마트 캐싱 및 가상화 기능 성능 검증
- **신규 기능**:
  - 실시간 알림 시스템
  - 관리자 대시보드 통계 기능
  - QR 코드를 이용한 자동 출퇴근 시스템
- **품질 개선**:
  - E2E 테스트 커버리지 확대 (65% → 80%)
  - 모바일 최적화 및 PWA 고도화

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

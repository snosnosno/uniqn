# UNIQN 프로젝트 문서

UNIQN (구 T-HOLDEM) 프로젝트의 모든 개발 문서 모음입니다.

**마지막 업데이트**: 2025년 11월 27일
**프로젝트 버전**: v0.2.4 (Production Ready)
**총 문서 수**: 46개 (13개 폴더)

---

## 문서 구조

```
docs/
├── README.md              # 문서 인덱스 (이 파일)
├── core/                  # 핵심 개발 가이드
├── features/              # 기능별 가이드
│   └── payment/           # 결제/칩 시스템
├── guides/                # 운영 가이드
├── operations/            # 운영 문서
├── reference/             # 참조 문서
├── user/                  # 사용자 가이드
├── landing/               # 랜딩 페이지
├── planning/              # 기획/분석 문서
├── releases/              # 릴리스 문서
└── archived/              # 완료된 작업 보고서
```

---

## [core/](core/) - 핵심 개발 가이드

개발에 필수적인 핵심 가이드 문서

| 문서 | 설명 |
|------|------|
| [DEVELOPMENT_GUIDE.md](core/DEVELOPMENT_GUIDE.md) | 개발 가이드라인, 코딩 규칙, 프로젝트 구조 |
| [TESTING_GUIDE.md](core/TESTING_GUIDE.md) | 테스트 작성 가이드 (65% 커버리지) |
| [CAPACITOR_MIGRATION_GUIDE.md](core/CAPACITOR_MIGRATION_GUIDE.md) | Capacitor 마이그레이션 가이드 |

---

## [features/](features/) - 기능별 가이드

### 주요 기능

| 문서 | 설명 |
|------|------|
| [FEATURE_FLAG_GUIDE.md](features/FEATURE_FLAG_GUIDE.md) | Feature Flag 시스템 사용법 |
| [MULTI_TENANT_STATUS.md](features/MULTI_TENANT_STATUS.md) | 멀티테넌트 아키텍처 현황 |
| [NOTIFICATION_IMPLEMENTATION_STATUS.md](features/NOTIFICATION_IMPLEMENTATION_STATUS.md) | 알림 시스템 구현 상태 |
| [ACCOUNT_MANAGEMENT_SYSTEM.md](features/ACCOUNT_MANAGEMENT_SYSTEM.md) | 계정 관리 시스템 |
| [PERMISSION_SYSTEM.md](features/PERMISSION_SYSTEM.md) | 권한 시스템 전체 정리 |

### [features/payment/](features/payment/) - 결제/칩 시스템

| 문서 | 설명 |
|------|------|
| [MODEL_B_CHIP_SYSTEM_FINAL.md](features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md) | 칩 기반 크레딧 시스템 최종 설계 |
| [CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md](features/payment/CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md) | 칩 시스템 구현 가이드 |
| [REVENUE_MODEL_ANALYSIS.md](features/payment/REVENUE_MODEL_ANALYSIS.md) | 수익 모델 분석 |
| [PAYMENT_SYSTEM_DEVELOPMENT.md](features/payment/PAYMENT_SYSTEM_DEVELOPMENT.md) | 결제 시스템 개발 문서 |

---

## [guides/](guides/) - 운영 가이드

배포, 성능, 국제화 등 운영 관련 가이드

| 문서 | 설명 |
|------|------|
| [DEPLOYMENT.md](guides/DEPLOYMENT.md) | 배포 가이드 |
| [ROLLBACK_PROCEDURES.md](guides/ROLLBACK_PROCEDURES.md) | 배포 롤백 절차 가이드 🆕 |
| [I18N_GUIDE.md](guides/I18N_GUIDE.md) | 국제화(i18n) 가이드 |
| [MIGRATION_GUIDE.md](guides/MIGRATION_GUIDE.md) | 마이그레이션 가이드 |
| [PERFORMANCE.md](guides/PERFORMANCE.md) | 성능 최적화 가이드 |

---

## [operations/](operations/) - 운영 문서

모니터링, 보안, 트러블슈팅 등 운영 관련 문서

| 문서 | 설명 |
|------|------|
| [MONITORING.md](operations/MONITORING.md) | 모니터링 가이드 |
| [NOTIFICATION_OPERATIONS.md](operations/NOTIFICATION_OPERATIONS.md) | 알림 시스템 운영 가이드 🆕 |
| [SECURITY.md](operations/SECURITY.md) | 보안 가이드 |
| [TROUBLESHOOTING.md](operations/TROUBLESHOOTING.md) | 트러블슈팅 가이드 |
| [PAYMENT_OPERATIONS.md](operations/PAYMENT_OPERATIONS.md) | 결제 시스템 운영 가이드 |

---

## [reference/](reference/) - 참조 문서

아키텍처, API, 데이터 스키마 등 참조 문서

| 문서 | 설명 |
|------|------|
| [ARCHITECTURE.md](reference/ARCHITECTURE.md) | 시스템 아키텍처 |
| [API_REFERENCE.md](reference/API_REFERENCE.md) | API 레퍼런스 |
| [AUTHENTICATION.md](reference/AUTHENTICATION.md) | 인증 시스템 |
| [DATA_SCHEMA.md](reference/DATA_SCHEMA.md) | 데이터 스키마 |
| [BUSINESS_CASE.md](reference/BUSINESS_CASE.md) | 비즈니스 케이스 |

---

## [user/](user/) - 사용자 가이드

사용자 및 관리자를 위한 매뉴얼

| 문서 | 설명 |
|------|------|
| [ADMIN_GUIDE.md](user/ADMIN_GUIDE.md) | 관리자 가이드 |
| [ONBOARDING.md](user/ONBOARDING.md) | 온보딩 가이드 |
| [USER_MANUAL.md](user/USER_MANUAL.md) | 사용자 매뉴얼 |

---

## [landing/](landing/) - 랜딩 페이지

| 문서 | 설명 |
|------|------|
| [LANDING_PAGE.md](landing/LANDING_PAGE.md) | 랜딩페이지 구현 문서 |

---

## [planning/](planning/) - 기획/분석 문서

프로젝트 기획 및 분석 문서

| 문서 | 설명 |
|------|------|
| [REFACTORING_PLAN.md](planning/REFACTORING_PLAN.md) | 프로젝트 리팩토링 계획 (6주 로드맵) |
| [CRITICAL_ANALYSIS_V2.md](planning/CRITICAL_ANALYSIS_V2.md) | 프로젝트 비판적 분석 보고서 v2.0 |
| [SPECKIT_PROMPTS.md](planning/SPECKIT_PROMPTS.md) | SpecKit 워크플로우 프롬프트 모음 |

---

## [releases/](releases/) - 릴리스 문서

배포 및 릴리스 관련 문서

| 문서 | 설명 |
|------|------|
| [APP_RELEASE_CHECKLIST.md](releases/APP_RELEASE_CHECKLIST.md) | 📱 **앱스토어 출시 체크리스트** 🆕 |
| [DEPLOYMENT_CHECKLIST.md](releases/DEPLOYMENT_CHECKLIST.md) | v0.2.4 기능 배포 체크리스트 |
| [DEPLOYMENT_SUMMARY_v0.2.4.md](releases/DEPLOYMENT_SUMMARY_v0.2.4.md) | v0.2.4 배포 요약 |
| [PRODUCTION_TEST_GUIDE_v0.2.4.md](releases/PRODUCTION_TEST_GUIDE_v0.2.4.md) | v0.2.4 프로덕션 테스트 가이드 |

---

## [archived/](archived/) - 완료된 작업 보고서

과거 리팩토링 및 완료된 프로젝트 보고서

| 문서 | 설명 |
|------|------|
| [REFACTORING_REPORT_2025-01-21.md](archived/REFACTORING_REPORT_2025-01-21.md) | useTables Hook 리팩토링 |
| [REFACTORING_REPORT_PHASE1_2025-01-23.md](archived/REFACTORING_REPORT_PHASE1_2025-01-23.md) | applicantHelpers 모듈화 |
| [PHASE_3-3_COMPLETION_REPORT.md](archived/PHASE_3-3_COMPLETION_REPORT.md) | Firestore Hook Library 마이그레이션 |
| [tournament/COMPLETION_REPORT_2025-10-17.md](archived/tournament/COMPLETION_REPORT_2025-10-17.md) | 토너먼트 시스템 완성 보고서 |

---

## 빠른 시작 가이드

### 신규 개발자
1. [DEVELOPMENT_GUIDE.md](core/DEVELOPMENT_GUIDE.md) - 개발 환경 설정
2. [ARCHITECTURE.md](reference/ARCHITECTURE.md) - 시스템 구조 이해
3. [TESTING_GUIDE.md](core/TESTING_GUIDE.md) - 테스트 작성법

### 기능 개발
1. [FEATURE_FLAG_GUIDE.md](features/FEATURE_FLAG_GUIDE.md) - Feature Flag 사용
2. [PERMISSION_SYSTEM.md](features/PERMISSION_SYSTEM.md) - 권한 시스템 이해
3. [DATA_SCHEMA.md](reference/DATA_SCHEMA.md) - 데이터 구조 확인

### 배포 및 운영
1. [DEPLOYMENT.md](guides/DEPLOYMENT.md) - 배포 절차
2. [MONITORING.md](operations/MONITORING.md) - 모니터링 설정
3. [TROUBLESHOOTING.md](operations/TROUBLESHOOTING.md) - 문제 해결

### 결제/칩 시스템 개발
1. [MODEL_B_CHIP_SYSTEM_FINAL.md](features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md) - 시스템 설계
2. [CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md](features/payment/CHIP_SYSTEM_IMPLEMENTATION_GUIDE.md) - 구현 가이드
3. [PAYMENT_OPERATIONS.md](operations/PAYMENT_OPERATIONS.md) - 운영 가이드

---

## 주요 프로젝트 정보

### 기술 스택
- **Frontend**: React 18 + TypeScript (Strict Mode)
- **State**: Context API + Zustand
- **Styling**: Tailwind CSS
- **Backend**: Firebase v11 (Auth, Firestore, Functions)
- **Testing**: Jest + React Testing Library (65% 커버리지)
- **Mobile**: Capacitor 7.4

### 프로젝트 상태
| 기능 | 상태 | 완성도 |
|------|------|--------|
| 인증 시스템 | Production | 100% (2FA, 세션 관리) |
| 알림 시스템 | Production | 100% (5개 Functions 배포) |
| 멀티테넌트 | Production | 100% (Phase 1-6) |
| 토너먼트 시스템 | Production | 100% |
| 국제화(i18n) | Production | 100% (한국어/영어) |
| 결제/칩 시스템 | Development | 57% (토스페이먼츠 연동 중) |

### 최근 업데이트
- **v0.2.4** (2025-10-31): 기능 확장 및 안정화
- **v0.2.3** (2025-10-18): 알림/멀티테넌트/테이블 관리 고도화
- **v0.2.2** (2025-09-19): 인증 시스템 고도화 완료

---

## 주제별 문서 찾기

### 아키텍처 & 설계
- [ARCHITECTURE.md](reference/ARCHITECTURE.md) - 전체 시스템 아키텍처
- [DATA_SCHEMA.md](reference/DATA_SCHEMA.md) - Firestore 데이터 스키마
- [MULTI_TENANT_STATUS.md](features/MULTI_TENANT_STATUS.md) - 멀티테넌트 구조
- [REFACTORING_PLAN.md](planning/REFACTORING_PLAN.md) - 리팩토링 계획

### 인증 & 권한
- [AUTHENTICATION.md](reference/AUTHENTICATION.md) - 인증 시스템
- [PERMISSION_SYSTEM.md](features/PERMISSION_SYSTEM.md) - 권한 시스템
- [ACCOUNT_MANAGEMENT_SYSTEM.md](features/ACCOUNT_MANAGEMENT_SYSTEM.md) - 계정 관리

### 결제 시스템
- [MODEL_B_CHIP_SYSTEM_FINAL.md](features/payment/MODEL_B_CHIP_SYSTEM_FINAL.md) - 칩 시스템 설계
- [PAYMENT_SYSTEM_DEVELOPMENT.md](features/payment/PAYMENT_SYSTEM_DEVELOPMENT.md) - 개발 문서
- [PAYMENT_OPERATIONS.md](operations/PAYMENT_OPERATIONS.md) - 운영 가이드
- [REVENUE_MODEL_ANALYSIS.md](features/payment/REVENUE_MODEL_ANALYSIS.md) - 수익 분석

### 테스트 & 품질
- [TESTING_GUIDE.md](core/TESTING_GUIDE.md) - 테스트 작성 가이드
- [PERFORMANCE.md](guides/PERFORMANCE.md) - 성능 최적화
- [CRITICAL_ANALYSIS_V2.md](planning/CRITICAL_ANALYSIS_V2.md) - 품질 분석

### 배포 & 운영
- [DEPLOYMENT.md](guides/DEPLOYMENT.md) - 배포 절차
- [MONITORING.md](operations/MONITORING.md) - 모니터링
- [SECURITY.md](operations/SECURITY.md) - 보안
- [TROUBLESHOOTING.md](operations/TROUBLESHOOTING.md) - 문제 해결

---

## 문서 작성 규칙

### 파일명 규칙
- 대문자 사용: `FEATURE_NAME.md`
- 밑줄 사용: 단어 구분 시 `_` 사용
- 날짜 포함: 보고서는 `YYYY-MM-DD` 형식
- 버전 포함: 릴리스 문서는 `_v0.2.4` 형식

### 표준 헤더 형식
```markdown
# 문서 제목

**최종 업데이트**: 2026년 1월 20일
**버전**: v0.2.3 (Production Ready)
**상태**: ✅ **Production Ready** (또는 적절한 상태)

---

## 목차
...
```

### 상태 이모지 가이드
- ✅ Production Ready / 완료
- 🔧 개발 중
- 📋 계획 수립 / 준비
- 📁 Archived (역사 기록용)
- 📊 분석 완료

### Markdown 스타일
- 제목: `#`, `##`, `###` 계층 구조
- 코드 블록: 언어 명시 (```typescript, ```bash)
- 강조: **굵게**, *기울임*
- 체크박스: `- [ ]` 또는 `- [x]`
- 테이블: 가독성을 위해 적극 활용

---

## 문의 및 기여

- **이슈 등록**: GitHub Issues
- **문서 개선 제안**: Pull Request
- **개발 가이드**: [CLAUDE.md](../CLAUDE.md)

---

*이 문서는 프로젝트의 모든 개발 문서를 정리한 인덱스입니다.*
*자세한 내용은 각 문서를 참조하세요.*

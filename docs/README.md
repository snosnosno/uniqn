# 📚 UNIQN 프로젝트 문서

UNIQN (구 T-HOLDEM) 프로젝트의 모든 개발 문서 모음입니다.

**마지막 업데이트**: 2025년 10월 30일
**프로젝트 버전**: v0.2.3 (Production Ready)

---

## 🗂️ 문서 구조

### 📘 [core/](core/) - 핵심 개발 가이드
개발에 필수적인 핵심 가이드 문서

- **[DEVELOPMENT_GUIDE.md](core/DEVELOPMENT_GUIDE.md)** - 개발 가이드라인, 코딩 규칙, 프로젝트 구조
- **[TESTING_GUIDE.md](core/TESTING_GUIDE.md)** - 테스트 작성 가이드 (65% 커버리지)
- **[CAPACITOR_MIGRATION_GUIDE.md](core/CAPACITOR_MIGRATION_GUIDE.md)** - Capacitor 마이그레이션 가이드

### 🎯 [features/](features/) - 기능별 가이드
주요 기능의 구현 현황 및 가이드

- **[FEATURE_FLAG_GUIDE.md](features/FEATURE_FLAG_GUIDE.md)** - Feature Flag 시스템 사용법
- **[MULTI_TENANT_STATUS.md](features/MULTI_TENANT_STATUS.md)** - 멀티테넌트 아키텍처 현황
- **[NOTIFICATION_IMPLEMENTATION_STATUS.md](features/NOTIFICATION_IMPLEMENTATION_STATUS.md)** - 알림 시스템 구현 상태
- **[ACCOUNT_MANAGEMENT_SYSTEM.md](features/ACCOUNT_MANAGEMENT_SYSTEM.md)** - 계정 관리 시스템
- **[PERMISSION_SYSTEM.md](features/PERMISSION_SYSTEM.md)** - 권한 시스템 전체 정리

### 📖 [guides/](guides/) - 운영 가이드
배포, 성능, 국제화 등 운영 관련 가이드

- **[DEPLOYMENT.md](guides/DEPLOYMENT.md)** - 배포 가이드
- **[I18N_GUIDE.md](guides/I18N_GUIDE.md)** - 국제화(i18n) 가이드
- **[MIGRATION_GUIDE.md](guides/MIGRATION_GUIDE.md)** - 마이그레이션 가이드
- **[PERFORMANCE.md](guides/PERFORMANCE.md)** - 성능 최적화 가이드

### 🔧 [operations/](operations/) - 운영 문서
모니터링, 보안, 트러블슈팅 등 운영 관련 문서

- **[MONITORING.md](operations/MONITORING.md)** - 모니터링 가이드
- **[SECURITY.md](operations/SECURITY.md)** - 보안 가이드
- **[TROUBLESHOOTING.md](operations/TROUBLESHOOTING.md)** - 트러블슈팅 가이드

### 📚 [reference/](reference/) - 참조 문서
아키텍처, API, 데이터 스키마 등 참조 문서

- **[ARCHITECTURE.md](reference/ARCHITECTURE.md)** - 시스템 아키텍처
- **[API_REFERENCE.md](reference/API_REFERENCE.md)** - API 레퍼런스
- **[AUTHENTICATION.md](reference/AUTHENTICATION.md)** - 인증 시스템
- **[DATA_SCHEMA.md](reference/DATA_SCHEMA.md)** - 데이터 스키마
- **[BUSINESS_CASE.md](reference/BUSINESS_CASE.md)** - 비즈니스 케이스

### 👥 [user/](user/) - 사용자 가이드
사용자 및 관리자를 위한 매뉴얼

- **[ADMIN_GUIDE.md](user/ADMIN_GUIDE.md)** - 관리자 가이드
- **[ONBOARDING.md](user/ONBOARDING.md)** - 온보딩 가이드
- **[USER_MANUAL.md](user/USER_MANUAL.md)** - 사용자 매뉴얼

### 📦 [archived/](archived/) - 완료된 작업 보고서
과거 리팩토링 및 완료된 프로젝트 보고서

- **[REFACTORING_REPORT_2025-01-21.md](archived/REFACTORING_REPORT_2025-01-21.md)** - useTables Hook 리팩토링
- **[REFACTORING_REPORT_PHASE1_2025-01-23.md](archived/REFACTORING_REPORT_PHASE1_2025-01-23.md)** - applicantHelpers 모듈화
- **[tournament/COMPLETION_REPORT_2025-10-17.md](archived/tournament/COMPLETION_REPORT_2025-10-17.md)** - 토너먼트 시스템 완성 보고서

---

## 🚀 빠른 시작

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

---

## 📌 주요 프로젝트 정보

### 기술 스택
- **Frontend**: React 18 + TypeScript (Strict Mode)
- **State**: Context API + Zustand
- **Styling**: Tailwind CSS
- **Backend**: Firebase v11 (Auth, Firestore, Functions)
- **Testing**: Jest + React Testing Library (65% 커버리지)

### 프로젝트 상태
- ✅ **인증 시스템**: 100% 완성 (2FA, 세션 관리)
- ✅ **알림 시스템**: 100% 완성 (5개 Functions 배포)
- ✅ **멀티테넌트**: 100% 완성 (Phase 1-6)
- ✅ **토너먼트 시스템**: 100% 완성
- ✅ **국제화(i18n)**: 100% 완성 (한국어/영어)
- ✅ **성능 최적화**: 100% 완성 (번들 279KB)

### 최근 업데이트
- **v0.2.3** (2025-10-18): 알림/멀티테넌트/테이블 관리 고도화
- **v0.2.2** (2025-09-19): 인증 시스템 고도화 완료
- **v0.2.0** (2025-09-16): 5단계 개선 완성

---

## 🔍 문서 찾기

### 주제별 문서

**아키텍처 & 설계**
- [ARCHITECTURE.md](reference/ARCHITECTURE.md)
- [DATA_SCHEMA.md](reference/DATA_SCHEMA.md)
- [MULTI_TENANT_STATUS.md](features/MULTI_TENANT_STATUS.md)

**인증 & 권한**
- [AUTHENTICATION.md](reference/AUTHENTICATION.md)
- [PERMISSION_SYSTEM.md](features/PERMISSION_SYSTEM.md)
- [ACCOUNT_MANAGEMENT_SYSTEM.md](features/ACCOUNT_MANAGEMENT_SYSTEM.md)

**알림 & 이벤트**
- [NOTIFICATION_IMPLEMENTATION_STATUS.md](features/NOTIFICATION_IMPLEMENTATION_STATUS.md)

**테스트 & 품질**
- [TESTING_GUIDE.md](core/TESTING_GUIDE.md)
- [PERFORMANCE.md](guides/PERFORMANCE.md)

**배포 & 운영**
- [DEPLOYMENT.md](guides/DEPLOYMENT.md)
- [MONITORING.md](operations/MONITORING.md)
- [SECURITY.md](operations/SECURITY.md)

---

## 💡 문서 작성 규칙

### 파일명 규칙
- 대문자 사용: `FEATURE_NAME.md`
- 밑줄 사용: 단어 구분 시 `_` 사용
- 날짜 포함: 보고서는 `YYYY-MM-DD` 형식

### 문서 구조
```markdown
# 제목

**마지막 업데이트**: YYYY-MM-DD
**작성자**: 이름 (선택)

## 목차
...

## 본문
...

---
*마지막 업데이트: YYYY년 MM월 DD일*
```

### Markdown 스타일
- 제목: `#`, `##`, `###` 계층 구조
- 코드 블록: 언어 명시 (```typescript, ```bash)
- 강조: **굵게**, *기울임*
- 체크박스: `- [ ]` 또는 `- [x]`
- 이모지: 적절히 사용 (📚, ✅, ⚠️, etc.)

---

## 📞 문의 및 기여

- **이슈 등록**: GitHub Issues
- **문서 개선 제안**: Pull Request
- **개발 가이드**: [CLAUDE.md](../CLAUDE.md)

---

*이 문서는 프로젝트의 모든 개발 문서를 정리한 인덱스입니다.*
*자세한 내용은 각 문서를 참조하세요.*

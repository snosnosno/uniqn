# 📚 T-HOLDEM 문서 센터

**버전**: v4.3 | **업데이트**: 2025년 9월 8일 | **상태**: 🏆 Production Ready

## 🎯 빠른 시작

### 👨‍💻 개발자용 (3단계)

1. **🛠️ 개발 환경**: **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 환경 설정 및 코딩 가이드 *(필독)*
2. **🏗️ 아키텍처**: **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 시스템 구조 및 데이터 흐름
3. **🔧 문제 해결**: **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - 이슈 해결 가이드

### 🏢 관리자용 (2단계)

1. **📋 제품 이해**: **[../CLAUDE.md](../CLAUDE.md)** - 프로젝트 개요 및 기능 설명
2. **🚀 배포 가이드**: **[DEPLOYMENT.md](./DEPLOYMENT.md)** - 프로덕션 배포 방법

### 🔍 참조 문서 (필요시)

- **📊 데이터 스키마**: **[DATA_SCHEMA.md](./DATA_SCHEMA.md)**
- **🔌 API 레퍼런스**: **[API_REFERENCE.md](./API_REFERENCE.md)**

## 📂 새로운 문서 구조 (2025.09.08 개편)

### 🎯 핵심 문서 (5개)
| 문서 | 설명 | 대상 | 중요도 |
|------|------|------|-------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | 🏗️ 아키텍처 + 데이터 흐름 통합 | 개발자 | ⭐⭐⭐⭐⭐ |
| **[DEVELOPMENT.md](./DEVELOPMENT.md)** | 💻 개발 가이드 + 코딩 규칙 통합 | 개발자 | ⭐⭐⭐⭐⭐ |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | 🚀 배포 가이드 (기존 유지) | 관리자 | ⭐⭐⭐⭐ |
| **[../CHANGELOG.md](../CHANGELOG.md)** | 📝 버전 히스토리 (루트 위치) | 전체 | ⭐⭐⭐ |
| **[../CLAUDE.md](../CLAUDE.md)** | 🎯 프로젝트 개요 (루트 위치) | 전체 | ⭐⭐⭐⭐ |

### 📚 참조 문서 (3개)
| 문서 | 설명 | 용도 | 업데이트 |
|------|------|------|----------|
| **[API_REFERENCE.md](./API_REFERENCE.md)** | 🔌 Firebase API 및 Functions | 개발 참조 | 🆕 신규 |
| **[DATA_SCHEMA.md](./DATA_SCHEMA.md)** | 📊 Firebase 컬렉션 스키마 | 개발 참조 | 🆕 신규 |
| **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** | 🔧 이슈 해결 종합 가이드 | 문제 해결 | 🆕 신규 |

### 📁 아카이브 폴더
```
docs/archive/
└── 2025-01/           # 기존 아카이브 (유지)
```

## 🎉 문서 개편 성과

### ✅ 통합 완료
- **20개 → 8개 문서**로 60% 감소
- **중복 내용 100% 제거**
- **데이터 흐름 중심 재구성**

### 🔄 주요 통합 내용

#### 🏗️ ARCHITECTURE.md (신규)
**통합된 문서들** (모두 삭제됨 ✅):
- ~~FIREBASE_DATA_FLOW.md~~ → 데이터 흐름 섹션
- ~~DATA_USAGE_MAPPING.md~~ → 페이지별 데이터 사용
- ~~SCHEDULE_PAGE_RENOVATION_PLAN.md~~ → 아키텍처 설계 부분

**핵심 내용**:
- UnifiedDataContext 중심 아키텍처 
- Firebase → Service → Context → Component 데이터 흐름
- 성능 최적화 (Web Workers, 가상화, 캐싱)
- 페이지별 데이터 사용 매핑

#### 💻 DEVELOPMENT.md (신규)
**통합된 문서들** (모두 삭제됨 ✅):
- ~~TECHNICAL_DOCUMENTATION.md~~ → 기술 스택 & 최적화
- ~~PROJECT_STRUCTURE.md~~ → 프로젝트 구조
- 테스트 가이드 내용 추가

**핵심 내용**:
- 개발 환경 설정 (Node.js, Firebase CLI)
- TypeScript 코딩 규칙 (표준 필드명, 메모이제이션)
- UnifiedDataContext 사용법
- 성능 최적화 가이드 (Web Workers, React Window)
- 테스트 전략 (Jest, Playwright E2E)

#### 🔧 TROUBLESHOOTING.md (신규)
**통합된 문서들** (모두 삭제됨 ✅):
- ~~SYNCHRONIZATION_BUG_FIX_REPORT.md~~ → 해결된 이슈
- ~~DATA_DISPLAY_CONSISTENCY_FIX_REPORT.md~~ → 해결된 이슈
- ~~STAFF_TAB_ANALYSIS.md~~ → 이슈 분석 부분

**핵심 내용**:
- ✅ 해결된 주요 이슈 (WorkLog 중복 생성, 동기화 문제)
- 자주 발생하는 문제 및 해결법
- Firebase 관련 이슈
- 긴급 상황 대응 가이드

#### 📊 DATA_SCHEMA.md (신규)
**통합된 문서들** (모두 삭제됨 ✅):
- ~~PERSONS_SCHEMA_STANDARD.md~~ → 스키마 표준화
- 기존 문서들의 스키마 정보 통합

**핵심 내용**:
- Firebase 컬렉션 상세 스키마
- TypeScript 인터페이스 정의
- 데이터 변환 함수 명세
- 표준 필드명 vs 레거시 필드 매핑

#### 🔌 API_REFERENCE.md (신규)
**기존 문서 개선** (기존 문서 삭제됨 ✅):
- ~~API_DOCUMENTATION.md~~ → 최신 아키텍처 반영

**핵심 내용**:
- Firebase Authentication & Functions
- Firestore API 사용법
- 보안 규칙 및 에러 처리
- 실시간 구독 패턴

## 📊 프로젝트 현황 (v4.3)

### 🏆 달성 성과
```
📈 성능: 번들 278KB | 로딩 1.2초 | 캐시 92% | E2E 100%
✅ 품질: TypeScript 에러 0개 | 테스트 통과율 100%
🚀 상태: Production Ready | 주요 이슈 모두 해결 완료
🎨 최적화: Web Workers | 가상화 | 스마트 캐싱
📦 버전: v4.3 (2025-09-08 docs 개편)
🔒 보안: Firebase 키 완전 보호 | 표준 필드명 통일
```

### 🔥 최신 해결 이슈
- ✅ **WorkLog 중복 생성 문제 100% 해결** (2025-09-07)
- ✅ **출석상태 UI 실시간 동기화** (Optimistic Update 적용)
- ✅ **데이터 표시 일관성** (지원자탭 ↔ 내 지원현황탭)
- ✅ **무한 로딩 문제 해결** (loading.initial 사용)

## 🗺️ 문서 탐색 가이드

### 🚀 처음 시작하는 경우
1. **[../CLAUDE.md](../CLAUDE.md)** - 프로젝트 전체 이해
2. **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 개발 환경 설정
3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 데이터 흐름 이해

### 🛠️ 개발 중인 경우
- **코딩 규칙**: [DEVELOPMENT.md → 코딩 규칙](./DEVELOPMENT.md#-코딩-규칙)
- **데이터 사용법**: [DEVELOPMENT.md → UnifiedDataContext](./DEVELOPMENT.md#-unifieddatacontext-사용법)
- **문제 해결**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### 📊 데이터 작업 시
- **스키마 확인**: [DATA_SCHEMA.md](./DATA_SCHEMA.md)
- **API 사용법**: [API_REFERENCE.md](./API_REFERENCE.md)
- **데이터 흐름**: [ARCHITECTURE.md → 데이터 흐름](./ARCHITECTURE.md#-데이터-흐름)

### 🚨 문제 발생 시
1. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - 해결된 이슈 확인
2. **GitHub Issues** 검색 - 유사 문제 확인
3. **로그 분석** - Sentry, Firebase Console 확인

## 📋 문서 관리 원칙

### ✅ 새로운 원칙 (2025.09.08 적용)
1. **중복 제거**: 모든 정보는 한 곳에만 존재
2. **데이터 중심**: 데이터 흐름을 중심으로 구성
3. **실용성**: 3단계 이내로 필요 정보 접근
4. **최신성**: 해결된 이슈는 해결 완료로 표시
5. **통합성**: 관련 정보를 하나의 문서에 통합

### 🔄 업데이트 정책
- **주요 기능 추가**: ARCHITECTURE.md, DEVELOPMENT.md 업데이트
- **버그 해결**: TROUBLESHOOTING.md의 해결된 이슈에 추가
- **API 변경**: API_REFERENCE.md, DATA_SCHEMA.md 업데이트
- **배포 변경**: DEPLOYMENT.md 업데이트

## 💡 추천 읽기 순서

### 🥇 개발자 (신규)
1. **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 개발 환경 & 코딩 규칙
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 아키텍처 & 데이터 흐름
3. **[DATA_SCHEMA.md](./DATA_SCHEMA.md)** - 스키마 & 타입 정의
4. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - 문제 해결 가이드

### 🥈 개발자 (기존)
1. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - 최신 해결 이슈 확인
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - 변경된 아키텍처 파악
3. **[API_REFERENCE.md](./API_REFERENCE.md)** - API 변경사항 확인

### 🥉 관리자/기획자
1. **[../CLAUDE.md](../CLAUDE.md)** - 프로젝트 전체 현황
2. **[../CHANGELOG.md](../CHANGELOG.md)** - 최신 변경사항
3. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - 배포 상태 & 방법

---

## 🔍 검색 팁

### 빠른 검색 키워드
- **`staffId`** - 표준 필드명 관련 정보
- **`UnifiedDataContext`** - 데이터 관리 관련
- **`Firebase`** - Firebase 관련 설정/이슈
- **`WorkLog`** - 근무 기록 관련
- **`Application`** - 지원서 관련
- **`실시간`** - 실시간 동기화 관련
- **`성능`** - 성능 최적화 관련

### 자주 찾는 정보
- **환경 설정**: [DEVELOPMENT.md → 개발 환경 설정](./DEVELOPMENT.md#-개발-환경-설정)
- **데이터 사용법**: [DEVELOPMENT.md → UnifiedDataContext](./DEVELOPMENT.md#-unifieddatacontext-사용법)
- **에러 해결**: [TROUBLESHOOTING.md → 자주 발생하는 문제](./TROUBLESHOOTING.md#-자주-발생하는-문제)
- **배포 방법**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

*문서 개편 완료: 중복 제거 | 데이터 흐름 중심 | 실용성 향상 | 60% 문서 수 감소*  
*마지막 업데이트: 2025년 9월 8일 - 문서 구조 전면 개편*
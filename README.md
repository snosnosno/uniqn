# T-HOLDEM 토너먼트 관리 플랫폼

[![Status](https://img.shields.io/badge/status-In%20Development-orange.svg)](./CHANGELOG.md)

**T-HOLDEM**은 홀덤 포커 토너먼트 운영의 모든 과정을 디지털화하여, 운영 효율성을 극대화하는 것을 목표로 하는 종합 관리 플랫폼입니다.

---

## 🚀 현재 상태 (v0.2.0)

- **버전**: `0.2.0` (Production Ready)
- **상태**: **Production Ready (90% 완성)**
- **핵심 성과**: 체계적인 5단계 개선을 통해 Enterprise 수준의 코드 품질과 성능 최적화를 달성.

### ✅ 구현된 주요 기능 (v0.2.0)

- **사용자 인증**: 이메일 기반 회원가입 및 로그인
- **구인공고 관리**: 구인공고 CRUD 기능
- **지원자 관리**: 공고 지원 및 지원자 목록 관리
- **스태프 관리**: 지원자 확정을 통한 스태프 전환
- **기본 출석 관리**: 출석 상태 수동 변경
- **기본 급여 계산**: 근무 기록 기반 급여 계산 로직
- **핵심 아키텍처**: `UnifiedDataContext`를 사용한 중앙 데이터 관리 구조
- **코드 품질**: TypeScript strict mode 100% 준수, any 타입 0개
- **성능 최적화**: React.memo 적용, 번들 크기 279KB 달성
- **현대화**: 레거시 필드 제거, Toast 시스템 도입

### 🚀 향후 로드맵 (v0.3.0+)

- **고급 기능 안정화**: Web Worker 기반 급여 계산, 스마트 캐싱 등 이미 코드가 구현된 기능들의 테스트 및 안정화
- **신규 기능 개발**: 실시간 알림, QR코드 출퇴근, 관리자 대시보드 통계 기능
- **품질 개선**: E2E 테스트 커버리지 확대 (65% → 80%), 모바일 최적화 및 PWA 고도화

## 🛠️ 기술 스택

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend & DB**: Firebase (Authentication, Firestore, Functions)
- **State Management**: Context API, Zustand
- **Testing**: Jest, React Testing Library

## 🚀 시작하기

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd T-HOLDEM/app2

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행 (Firebase 에뮬레이터와 함께)
npm run dev
```

더 자세한 개발 환경 설정은 `docs/DEVELOPMENT.md` 문서를 참고하세요.

## 📚 문서

프로젝트의 모든 상세 문서는 `docs/` 폴더에서 관리됩니다.

### 🎯 **핵심 문서**
- **프로젝트 현황**: `docs/PROJECT_STATUS.md` (최신 개선 현황)
- **아키텍처**: `docs/ARCHITECTURE.md`
- **개발 가이드**: `docs/DEVELOPMENT.md`
- **테스트 가이드**: `docs/TESTING_GUIDE.md`

### 📖 **참고 문서**
- **API 명세**: `docs/API_REFERENCE.md`
- **데이터베이스 스키마**: `docs/DATA_SCHEMA.md`
- **배포 가이드**: `docs/DEPLOYMENT.md`
- **문제 해결 가이드**: `docs/TROUBLESHOOTING.md`

## 🤝 기여하기

이 프로젝트에 기여하고 싶으신가요? `CONTRIBUTING.md` 파일을 참고하여 기여 규칙을 확인해주세요.

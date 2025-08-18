# T-HOLDEM Tournament Management Platform

## 🎯 프로젝트 개요

**T-HOLDEM**은 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼입니다.

- **프로젝트 ID**: tholdem-ebc18
- **배포 URL**: https://tholdem-ebc18.web.app
- **상태**: Production Ready 🚀
- **버전**: 2.0.0

## ✨ 주요 기능

### 🃏 토너먼트 관리
- 참가자 관리 (CSV 업로드, 칩 카운트)
- 테이블 자동 배치 알고리즘
- 실시간 칩 추적 및 블라인드 관리

### 👥 스태프 관리
- QR 코드 출퇴근 시스템
- 실시간 출석 상태 관리
- 교대 스케줄 및 급여 자동 계산

### 📢 구인공고 시스템
- 역할별 시급 설정
- 지원자 관리
- 확정 스태프 자동 연동

### 📊 관리자 대시보드
- 실시간 운영 현황
- 통계 분석 및 리포트
- 성능 모니터링 (Web Vitals)

## 🛠️ 기술 스택

### Frontend
- **React** 18 + **TypeScript** (Strict Mode)
- **Tailwind CSS** 3.3
- **Zustand** (상태 관리)
- **@tanstack/react-table** (테이블)
- **@heroicons/react** (아이콘)
- **date-fns** (날짜 처리)

### Backend
- **Firebase** 11.9
  - Firestore (실시간 DB)
  - Authentication (인증)
  - Functions (서버리스)
  - Storage (파일)
  - Performance (모니터링)

### 개발 도구
- **Jest** + React Testing Library
- **Sentry** (에러 추적)
- **GitHub Actions** (CI/CD)

## 🚀 빠른 시작

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/T-HOLDEM.git
cd T-HOLDEM

# 2. 의존성 설치
cd app2
npm install

# 3. 환경 변수 설정 (.env 파일)
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id

# 4. 개발 서버 실행
npm start

# 5. 빌드 및 배포
npm run build
npm run deploy:all
```

## 📊 성능 지표

| 지표 | 현재 | 개선율 |
|------|------|--------|
| **번들 크기** | 272.8KB | 83% ↓ |
| **초기 로딩** | 2.0초 | 43% ↓ |
| **Lighthouse** | 91점 | 34% ↑ |
| **TypeScript** | 100% | ✅ |
| **의존성** | 43개 | 69% ↓ |

## 📁 프로젝트 구조

```
T-HOLDEM/
├── app2/                   # React 애플리케이션
│   ├── src/
│   │   ├── components/    # UI 컴포넌트
│   │   ├── pages/        # 페이지 컴포넌트
│   │   ├── hooks/        # 커스텀 훅
│   │   ├── stores/       # Zustand 스토어
│   │   ├── types/        # TypeScript 타입
│   │   └── utils/        # 유틸리티
│   └── public/           # 정적 파일
├── docs/                 # 프로젝트 문서
├── scripts/              # 스크립트
│   └── firebase-migration/  # 마이그레이션
├── functions/            # Firebase Functions
└── SHRIMP/              # 태스크 관리
```

## 📚 주요 문서

- [개발 가이드](./CLAUDE.md) - Claude Code 가이드
- [프로젝트 구조](./docs/PROJECT_STRUCTURE.md) - 상세 구조
- [기능 명세서](./docs/T-HOLDEM_기능명세서.md) - 전체 기능
- [Firebase 구조](./docs/FIREBASE_DATA_FLOW.md) - 데이터 흐름
- [기술 문서](./docs/TECHNICAL_DOCUMENTATION.md) - 기술 상세

## 🔄 최근 업데이트 (2025-01-18)

### 완료된 작업
- ✅ Firebase 마이그레이션 (dealerId → staffId)
- ✅ 번들 크기 최적화 (1.6MB → 272.8KB)
- ✅ TypeScript Strict Mode 100% 준수
- ✅ 레거시 코드 제거
- ✅ 구인공고 역할별 시급 기능 추가

### 진행 중인 작업
- 🔄 ESLint 경고 해결 (약 70개)
- 🔄 테스트 커버리지 확대 (10% → 70%)
- 🔄 모바일 반응형 UI 개선

## 🤝 기여

PR과 이슈는 언제나 환영합니다!

## 📄 라이선스

MIT License

---

**최종 업데이트**: 2025년 1월 18일  
**버전**: 2.0.0  
**문의**: [이메일 주소]
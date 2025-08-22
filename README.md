# T-HOLDEM Tournament Management Platform

## 🎯 프로젝트 개요

**T-HOLDEM**은 홀덤 포커 토너먼트 운영을 위한 종합 관리 플랫폼입니다.

- **프로젝트 ID**: tholdem-ebc18
- **배포 URL**: https://tholdem-ebc18.web.app
- **상태**: Production Ready 🚀
- **버전**: 2.1.0

## ✨ 주요 기능

### 🃏 토너먼트 관리
- 참가자 관리 (CSV 업로드, 칩 카운트)
- 테이블 자동 배치 알고리즘
- 실시간 칩 추적 및 블라인드 관리
- 드래그 앤 드롭 테이블 재배치

### 👥 스태프 관리
- QR 코드 출퇴근 시스템
- 실시간 출석 상태 관리
- 교대 스케줄 및 급여 자동 계산
- 역할별 급여 설정 (시급/일급/월급)

### 📢 구인공고 시스템
- 다중 역할 및 시간대 지원
- 지원자 통합 관리
- 확정 스태프 자동 연동
- 사전 질문 시스템

### 📊 관리자 대시보드
- 실시간 운영 현황
- 통계 분석 및 리포트
- 성능 모니터링 (Web Vitals)
- 급여 정산 시스템

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
- **Sentry** (에러 모니터링)
- **Jest** + **React Testing Library** (테스팅)
- **ESLint** + **Prettier** (코드 품질)

## 🚀 시작하기

### 필수 요구사항
- Node.js 18.0.0 이상
- npm 9.0.0 이상
- Firebase CLI 13.0.0 이상

### 설치
```bash
# 의존성 설치
cd app2
npm install

# Firebase CLI 설치 (전역)
npm install -g firebase-tools
```

### 개발 서버 실행
```bash
# 개발 서버 시작
npm start

# Firebase 에뮬레이터와 함께 실행
npm run dev
```

### 빌드 및 배포
```bash
# 프로덕션 빌드
npm run build

# Firebase 배포
npm run deploy:all
```

## 📁 프로젝트 구조

```
T-HOLDEM/
├── app2/                 # React 애플리케이션
│   ├── src/
│   │   ├── components/   # UI 컴포넌트
│   │   ├── hooks/       # 커스텀 React 훅
│   │   ├── pages/       # 페이지 컴포넌트
│   │   ├── stores/      # Zustand 스토어
│   │   ├── types/       # TypeScript 타입 정의
│   │   └── utils/       # 유틸리티 함수
│   └── public/          # 정적 파일
├── functions/           # Firebase Functions
├── docs/               # 프로젝트 문서
└── scripts/            # 유틸리티 스크립트
```

## 📊 현재 상태

| 항목 | 상태 | 설명 |
|------|------|------|
| 빌드 | ✅ | Production 빌드 성공 |
| TypeScript | ✅ | 컴파일 에러 0개 |
| 번들 크기 | ✅ | 273KB (gzipped) |
| 테스트 | ⚠️ | 커버리지 ~10% |
| ESLint | ⚠️ | 9개 에러 (테스트 파일) |

## 🔒 환경 변수

`.env` 파일 생성:
```env
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-auth-domain
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-storage-bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

## 📝 주요 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm start` | 개발 서버 시작 |
| `npm run build` | 프로덕션 빌드 |
| `npm run test` | 테스트 실행 |
| `npm run lint` | ESLint 실행 |
| `npm run type-check` | TypeScript 타입 체크 |
| `npm run deploy:all` | Firebase 전체 배포 |

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

## 📞 연락처

프로젝트 관련 문의사항은 이슈 트래커를 이용해주세요.

---

*마지막 업데이트: 2025년 1월 29일*
# T-HOLDEM Tournament Management Platform

## 🎯 프로젝트 개요

**T-HOLDEM**은 홀덤 토너먼트 운영을 위한 종합 관리 플랫폼입니다.  
React 18 + TypeScript + Firebase로 구축된 실시간 웹 애플리케이션입니다.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](/)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)](/)
[![License](https://img.shields.io/badge/license-MIT-green)](/)

## ✨ 주요 기능

### 🃏 토너먼트 관리
- **참가자 관리**: CSV 업로드, 대량 추가/삭제
- **테이블 자동 배치**: 칩/인원 균형 알고리즘
- **실시간 칩 추적**: 테이블별 칩 카운트
- **블라인드 관리**: 레벨별 자동 진행

### 👥 스태프 관리  
- **QR 출퇴근**: 실시간 출석 체크
- **교대 스케줄**: 시간별 근무 관리
- **급여 계산**: 시간 × 시급 자동 계산
- **역할 권한**: Admin/Manager/Staff

### 📊 관리자 대시보드
- **실시간 현황**: 토너먼트 진행 상태
- **통계 분석**: 매출, 비용, 출석률
- **성능 모니터링**: Web Vitals 추적\n\n## 🛠️ 기술 스택

### Frontend
- **React** 18.3.1 + **TypeScript** 5.7.2 (Strict Mode)
- **Tailwind CSS** 3.4.17 + DaisyUI
- **Zustand** 5.0.2 (상태 관리)
- **@tanstack/react-table** 8.21.3
- **@heroicons/react** 2.2.0
- **date-fns** 4.1.0

### Backend  
- **Firebase** 11.2.0
  - Firestore (실시간 DB)
  - Authentication (인증)
  - Functions (서버리스)
  - Storage (파일)\n\n## 🚀 빠른 시작

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
```\n\n## 📊 성능 지표

| 지표 | 목표 | 현재 | 상태 |
|------|------|------|------|
| 번들 크기 | <1MB | 890KB | ✅ |
| 초기 로딩 | <3초 | 2.0초 | ✅ |
| Lighthouse | >90 | 91 | ✅ |
| TypeScript | 100% | 100% | ✅ |

## 📁 프로젝트 구조

```
T-HOLDEM/
├── app2/                    # React 애플리케이션
│   ├── src/
│   │   ├── components/     # UI 컴포넌트
│   │   ├── pages/         # 페이지 컴포넌트  
│   │   ├── hooks/         # 커스텀 훅
│   │   ├── utils/         # 유틸리티
│   │   └── stores/        # Zustand 스토어
│   └── docs/              # 기술 문서
├── functions/             # Firebase Functions
├── SHRIMP/               # 태스크 관리
└── docs/                 # 프로젝트 문서
```

## 📚 문서

- [프로젝트 현황](./PROJECT_STATUS.md) - 전체 현황 및 로드맵
- [개발 가이드](./CLAUDE.md) - AI 개발 가이드라인
- [기술 문서](./app2/docs/) - 상세 기술 문서

## 🤝 기여

PR과 이슈는 언제나 환영합니다!

## 📄 라이선스

MIT License

---

**최종 업데이트**: 2025년 1월 8일  
**버전**: 2.0.0  
**상태**: Production Ready 🚀"
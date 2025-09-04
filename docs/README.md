# 📚 T-HOLDEM 문서 센터

**버전**: 5.0.0 | **업데이트**: 2025년 2월 4일 | **상태**: 🏆 프로젝트 100% 완성

## 🎯 빠른 시작 (3단계)

### 1️⃣ 개발 시작
**[CLAUDE.md](../CLAUDE.md)** - Claude Code 개발 가이드 *(필독)*

### 2️⃣ 제품 이해
**[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)** - 통합 제품 사양서

### 3️⃣ 변경 이력
**[CHANGELOG.md](../CHANGELOG.md)** - 버전별 변경사항

## 📂 핵심 문서 (5개)

| 문서 | 설명 | 대상 |
|------|------|------|
| **[CLAUDE.md](../CLAUDE.md)** | 개발 가이드 & 코딩 규칙 | 개발자 |
| **[CHANGELOG.md](../CHANGELOG.md)** | 버전 히스토리 & 릴리스 노트 | 전체 |
| **[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)** | 기능, 워크플로우, 요구사항 통합 | 전체 |
| **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** | 디렉토리 구조 & 파일 설명 | 개발자 |
| **[FIREBASE_DATA_FLOW.md](./FIREBASE_DATA_FLOW.md)** | 데이터베이스 구조 & 흐름 | 개발자 |

## 🔧 기술 문서

- **[TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)** - 아키텍처 & 기술 스택
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - 배포 가이드
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - 테스트 전략
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - API 명세
- **[Firebase 마이그레이션](../scripts/firebase-migration/README.md)** - 데이터 마이그레이션

## 📊 프로젝트 현황 (Week 4 완료)

```
📈 성능: 번들 279KB | 로딩 1.2초 | Lighthouse 91점 | 캐시 히트율 92%
✅ 품질: TypeScript 에러 0개 | 테스트 커버리지 85%
🚀 상태: Production Ready | 성능 최적화 완료
🎨 UI: 가상화 구현 | Web Workers | 스마트 캐싱
📦 버전: 5.0.0 (2025-02-04 완성)
🔒 보안: Firebase 키 완전 보호 | gitignore 강화
```

## 🗂️ 문서 구조

```
T-HOLDEM/
├── README.md              # 프로젝트 소개
├── CLAUDE.md              # 개발 가이드
├── CHANGELOG.md           # 변경 이력
└── docs/
    ├── README.md          # 문서 인덱스 (현재 파일)
    ├── PRODUCT_SPEC.md    # 통합 제품 사양
    ├── PROJECT_STRUCTURE.md
    ├── FIREBASE_DATA_FLOW.md
    ├── TECHNICAL_DOCUMENTATION.md
    ├── DEPLOYMENT.md      # 배포 가이드 ✨
    ├── TESTING_GUIDE.md   # 테스트 가이드 ✨
    ├── API_DOCUMENTATION.md # API 문서 ✨
    └── archive/           # 완료된 문서 보관
        └── 2025-01/       # 7개 문서 보관

```

## 📝 문서 관리 원칙

1. **간결성**: 핵심만 명확하게
2. **단일성**: 중복 없이 한 곳에만
3. **최신성**: 변경사항 즉시 반영
4. **접근성**: 3단계 이내 도달
5. **이력 관리**: 모든 변경사항 CHANGELOG에 기록

## 🔄 최근 업데이트 (Week 4 완성)

- ✅ **성능 최적화**: Web Workers, 가상화, 스마트 캐싱 완료
- ✅ **무한 로딩 해결**: UnifiedDataContext 로딩 상태 관리 수정
- ✅ **보안 강화**: Firebase Admin SDK 키 완전 보호, gitignore 강화
- ✅ **문서 정리**: TODO 주석 정리, 중복 내용 제거
- ✅ **코드 정리**: 마이그레이션 스크립트 아카이브, package.json 정리

---

*문서 정리 완료: 불필요한 폴더 삭제 | 아카이브 구조 생성 | CHANGELOG 추가*
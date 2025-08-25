# 📚 T-HOLDEM 문서 센터

**버전**: 2.1.0 | **업데이트**: 2025년 1월 29일 오후 7시

## 🎯 빠른 시작 (3단계)

### 1️⃣ 개발 시작
**[CLAUDE.md](../CLAUDE.md)** - Claude Code 개발 가이드 *(필독)*

### 2️⃣ 제품 이해
**[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)** - 통합 제품 사양서

### 3️⃣ 기술 구조
**[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - 프로젝트 구조

## 📂 핵심 문서 (4개)

| 문서 | 설명 | 대상 |
|------|------|------|
| **[CLAUDE.md](../CLAUDE.md)** | 개발 가이드 & 코딩 규칙 | 개발자 |
| **[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)** | 기능, 워크플로우, 요구사항 통합 | 전체 |
| **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** | 디렉토리 구조 & 파일 설명 | 개발자 |
| **[FIREBASE_DATA_FLOW.md](./FIREBASE_DATA_FLOW.md)** | 데이터베이스 구조 & 흐름 | 개발자 |

## 🔧 기술 문서

- **[TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)** - 아키텍처 & 기술 스택
- **[Firebase 마이그레이션](../scripts/firebase-migration/README.md)** - 데이터 마이그레이션

## 📊 프로젝트 현황

```
📈 성능: 번들 273.66KB | 로딩 2.0초 | Lighthouse 91점
✅ 품질: TypeScript 에러 0개 | ESLint 경고 40개
🚀 상태: Production Ready
🎨 UI: 날짜 형식 한글화 완료 | 반응형 최적화
```

## 🗂️ 문서 구조

```
T-HOLDEM/
├── README.md              # 프로젝트 소개
├── CLAUDE.md              # 개발 가이드 (156줄)
└── docs/
    ├── README.md          # 문서 인덱스 (현재 파일)
    ├── PRODUCT_SPEC.md    # 통합 제품 사양 (NEW)
    ├── PROJECT_STRUCTURE.md
    ├── FIREBASE_DATA_FLOW.md
    └── TECHNICAL_DOCUMENTATION.md
```

## 📝 문서 관리 원칙

1. **간결성**: 핵심만 명확하게
2. **단일성**: 중복 없이 한 곳에만
3. **최신성**: 변경사항 즉시 반영
4. **접근성**: 3단계 이내 도달

---

*문서 통합 완료: 기능명세서 + PRD + 워크플로우 → PRODUCT_SPEC.md*
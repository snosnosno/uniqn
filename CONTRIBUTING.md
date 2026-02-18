# Contributing to UNIQN

UNIQN 프로젝트에 기여해 주셔서 감사합니다!

**버전**: v0.2.3 (모바일앱 중심)
**최종 업데이트**: 2026년 2월 18일

## 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/your-org/t-holdem.git
cd t-holdem/uniqn-mobile  # 📱 모바일앱 (주력)

# 의존성 설치
npm install

# Expo 개발 서버 시작
npm start

# 플랫폼별 실행
npx expo run:ios      # iOS 시뮬레이터
npx expo run:android  # Android 에뮬레이터
```

## 코드 스타일

### TypeScript
- Strict mode 100% 준수
- `any` 타입 사용 금지
- 표준 필드명 사용: `staffId`, `eventId`

### React
- 함수형 컴포넌트 사용
- 메모이제이션 활용 (`useMemo`, `useCallback`)
- 다크모드 필수 적용 (`dark:` 클래스)

### 로깅
- `console.log` 대신 `logger` 사용
- 에러는 `logger.error()`로 기록

## 커밋 컨벤션

```
<타입>: <제목>

feat: 새로운 기능
fix: 버그 수정
refactor: 리팩토링
style: 스타일 (다크모드 등)
docs: 문서 수정
test: 테스트 추가/수정
chore: 기타 변경
```

## Pull Request 가이드

1. `feature/기능명` 브랜치 생성
2. 코드 작성 및 테스트
3. `npm run type-check` 통과 확인
4. `npm run lint` 통과 확인
5. PR 생성 및 리뷰 요청

## 테스트

```bash
npm run test           # 단위 테스트
npm run test:coverage  # 커버리지 확인
npm run test:e2e       # E2E 테스트
```

## 문서

- [개발 가이드](docs/core/DEVELOPMENT_GUIDE.md)
- [테스트 가이드](docs/core/TESTING_GUIDE.md)
- [아키텍처](docs/reference/ARCHITECTURE.md)

## 문의

질문이나 제안사항은 GitHub Issues를 통해 등록해 주세요.

---

*마지막 업데이트: 2026년 2월*

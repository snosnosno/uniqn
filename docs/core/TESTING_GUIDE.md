# UNIQN 종합 테스트 가이드

**최종 업데이트**: 2026년 2월 1일
**버전**: v1.0.0 (모바일앱 중심 + PortOne 결제 연동)
**상태**: ✅ **모바일앱 테스트 커버리지 14%+ (MVP 기준)**

> **모바일앱 테스트**: uniqn-mobile/은 Jest + React Native Testing Library를 사용합니다.
> ```bash
> cd uniqn-mobile
> npm test              # 테스트 실행
> npm run test:coverage # 커버리지 리포트
> ```

---

UNIQN 프로젝트의 모든 부분을 테스트하기 위한 종합 가이드입니다.

## 📋 테스트 개요

### 테스트 유형
- **단위 테스트**: Jest + React Testing Library (커버리지 목표: 80%)
- **E2E 테스트**: Playwright (멀티유저 시나리오)
- **성능 테스트**: Lighthouse + 커스텀 성능 측정
- **보안 테스트**: 권한 시스템 검증
- **실시간 동기화 테스트**: Firebase 실시간 업데이트 검증

### 테스트 커버리지

> **참고**: 아래 커버리지는 레거시 웹앱(app2/) 기준입니다.
> 모바일앱(uniqn-mobile/)은 현재 **14% (MVP 기준)** → **목표: 60%** 입니다.

- **[레거시 웹앱]**: 65% 달성
- **[모바일앱]**: 14% MVP → 60% 목표
- **E2E 시나리오**: 모바일앱 Detox 테스트 예정

## 🚀 빠른 시작

### 1. 종합 테스트 실행 (권장)
```bash
# 모든 테스트를 순차적으로 실행
npm run test:comprehensive

# 또는 직접 스크립트 실행
chmod +x scripts/run-comprehensive-tests.sh
./scripts/run-comprehensive-tests.sh
```

### 2. 개별 테스트 실행
```bash
# 단위 테스트만
npm run test:coverage

# E2E 테스트만
npm run test:e2e

# 린트 + 타입 체크
npm run quality
```

## 🧪 테스트 시나리오

### 멀티유저 E2E 테스트

#### 1. 구인공고 플로우 (`multi-user-jobposting.spec.ts`)
- 관리자가 구인공고 생성
- 3명의 지원자가 동시 지원
- 관리자가 지원자 승인/거절
- 승인된 스태프가 스케줄 확인
- **예상 소요 시간**: 8-10분

#### 2. 동시 출석 관리 (`concurrent-attendance.spec.ts`)
- 5명의 스태프가 동시 로그인
- 순차적 체크인/체크아웃
- 관리자의 실시간 모니터링
- 출석 상태 수정 및 급여 계산
- **예상 소요 시간**: 6-8분

#### 3. 급여 정산 플로우 (`payroll-calculation.spec.ts`)
- 여러 스태프의 근무 기록 생성
- 관리자의 급여 일괄 계산
- 스태프들의 개별 급여 확인
- 이의제기 및 정산 완료
- **예상 소요 시간**: 10-12분

#### 4. 권한 시스템 검증 (`permission-testing.spec.ts`)
- 4개 역할별 접근 권한 테스트
- 권한 우회 시도 차단 검증
- API 권한 및 보안 헤더 확인
- **예상 소요 시간**: 5-7분

#### 5. 실시간 동기화 (`realtime-sync.spec.ts`)
- Firebase 실시간 데이터 동기화
- 네트워크 지연 상황 처리
- 오프라인/온라인 상태 변화
- 동시 수정 충돌 해결
- **예상 소요 시간**: 8-10분

### 단위 테스트 커버리지 향상

#### 새로 추가된 테스트
1. **ProfilePage.test.tsx**: 프로필 관리 기능
2. **AttendancePage.test.tsx**: 출석 관리 기능
3. **기존 테스트 24개**: 컴포넌트, 훅, 유틸리티

#### 테스트 커버리지 현황

> **참고**: 아래는 레거시 웹앱(app2/) 기준입니다. 모바일앱은 14% MVP 커버리지입니다.

**[레거시 웹앱]**:
```
File                    | % Stmts | % Branch | % Funcs | % Lines
=====================================================
All files              |   65.2  |   58.4   |   62.1  |   64.8
```

**[모바일앱 목표]**:
| 영역 | MVP | 출시 기준 |
|------|-----|----------|
| 전체 | 14% | 60%+ |
| services/ | 40% | 70%+ |
| Shared 모듈 | 80% | 90%+ |

## 📊 성능 테스트

### 성능 기준
- **페이지 로드**: < 3초 (3G 네트워크)
- **번들 크기**: < 2MB (총합)
- **메모리 사용**: < 100MB
- **API 응답**: < 500ms
- **동시 사용자**: 100명 처리 가능

### 성능 측정 도구
1. **Lighthouse**: Core Web Vitals 측정
2. **커스텀 도구**: `performanceTest.ts`
3. **Playwright**: 실제 사용자 시나리오 성능

## 🔧 테스트 환경 설정

### 필수 요구사항
```bash
# Node.js 16+
node --version

# Firebase CLI (E2E 테스트용)
npm install -g firebase-tools

# Playwright 브라우저 설치
npx playwright install
```

### Firebase Emulator 설정
```bash
# 프로젝트 루트에서
firebase emulators:start --only auth,firestore
```

### 환경 변수
```bash
# .env.test.local
REACT_APP_USE_FIREBASE_EMULATOR=true
REACT_APP_FIREBASE_PROJECT_ID=demo-project
```

## 📈 테스트 데이터

### 자동 생성되는 테스트 데이터
- **사용자**: 관리자 1명, 스태프 10명, 지원자 5명
- **구인공고**: 5개 (다양한 지역/역할)
- **지원서**: 20개 (랜덤 배정)
- **출석 기록**: 최근 7일간 5명 스태프 기록

### 테스트 데이터 초기화
```typescript
import { setupTestData } from './src/test-utils/setupEmulator';

// 테스트 시작 전 데이터 설정
const result = await setupTestData();
console.log(`${result.userCount}명 사용자, ${result.jobPostingIds.length}개 구인공고 생성`);
```

## 🎯 CI/CD 통합

### GitHub Actions 연동 예시
```yaml
name: Comprehensive Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:comprehensive
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## 📝 테스트 리포트

### 자동 생성되는 리포트
- **HTML 커버리지 리포트**: `coverage/lcov-report/index.html`
- **Playwright 테스트 리포트**: `playwright-report/index.html`
- **종합 테스트 리포트**: `test-results/comprehensive_test_report_YYYYMMDD_HHMMSS.md`

### 리포트 내용
- ✅ 테스트 통과/실패 현황
- 📊 커버리지 통계
- ⚡ 성능 메트릭
- 🔍 실패한 테스트 상세 정보
- 💡 개선 권장 사항

## 🚨 문제 해결

### 자주 발생하는 문제

#### 1. Firebase Emulator 연결 실패
```bash
# 포트 충돌 확인
lsof -i :9099 -i :8080

# 기존 프로세스 종료
pkill -f "firebase.*emulators"

# 재시작
firebase emulators:start --only auth,firestore
```

#### 2. Playwright 브라우저 설치 문제
```bash
# 브라우저 재설치
npx playwright install --force

# 시스템 의존성 설치 (Linux)
npx playwright install-deps
```

#### 3. 메모리 부족 오류
```bash
# Node.js 힙 메모리 증가
export NODE_OPTIONS="--max-old-space-size=4096"
npm run test:e2e
```

#### 4. 테스트 타임아웃
```javascript
// playwright.config.ts에서 타임아웃 조정
timeout: 60000, // 60초
```

### 디버깅 도구
```bash
# E2E 테스트 디버그 모드
npm run test:e2e:debug

# Playwright UI 모드
npm run test:e2e:ui

# 단위 테스트 watch 모드
npm run test:watch
```

## 📚 추가 자료

### 테스트 모범 사례
1. **AAA 패턴**: Arrange, Act, Assert
2. **독립성**: 각 테스트는 독립적으로 실행 가능
3. **반복성**: 동일한 결과를 보장
4. **가독성**: 명확한 테스트 이름과 구조

### 유용한 명령어
```bash
# 특정 테스트 파일만 실행
npm test -- ProfilePage.test.tsx

# 특정 E2E 테스트만 실행
npm run test:e2e -- --grep "구인공고"

# 커버리지 리포트 열기
open coverage/lcov-report/index.html

# 테스트 결과 정리
rm -rf test-results/ coverage/ playwright-report/
```

## 🎉 성공 기준

### 모든 테스트 통과 기준
- ✅ ESLint 검사 0 에러
- ✅ TypeScript 타입 검사 0 에러
- ✅ 단위 테스트 80% 이상 커버리지
- ✅ E2E 테스트 100% 통과
- ✅ 빌드 성공
- ✅ 성능 기준 충족

### 품질 메트릭
- **코드 품질**: A등급 (ESLint + TypeScript)
- **테스트 신뢰성**: 99% 이상 성공률
- **성능**: Lighthouse 90점 이상
- **보안**: 권한 검증 100% 통과

---

**마지막 업데이트**: 2026년 2월 1일
**테스트 환경**: Node.js 18+, Jest + React Native Testing Library (모바일앱)
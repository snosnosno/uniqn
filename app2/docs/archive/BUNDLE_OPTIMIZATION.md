# 번들 최적화 가이드

## 번들 분석 도구 설치

번들 크기를 분석하고 최적화하기 위해 다음 도구들을 사용합니다:

### 1. source-map-explorer 설치
```bash
npm install --save-dev source-map-explorer
```

### 2. webpack-bundle-analyzer 설치
```bash
npm install --save-dev webpack-bundle-analyzer
```

## 번들 분석 명령어

### 기본 번들 분석
```bash
npm run analyze:bundle
```
- 빌드된 JavaScript 파일들의 크기를 시각적으로 보여줍니다
- 어떤 라이브러리가 가장 많은 공간을 차지하는지 확인할 수 있습니다

### 인터랙티브 번들 분석
```bash
npm run analyze:bundle:interactive
```
- 웹 브라우저에서 인터랙티브한 트리맵으로 번들을 분석합니다
- 각 모듈의 크기와 의존성을 자세히 확인할 수 있습니다

## 현재 최적화 현황

### ✅ 이미 적용된 최적화
1. **Code Splitting**: 44개 라우트에 React.lazy() 적용
2. **Tree Shaking**: production 빌드 시 자동 적용
3. **Memoization**: 239회 useMemo/useCallback 사용
4. **가상화**: React Window로 대용량 리스트 처리

### 🎯 추가 최적화 대상

#### 1. 대용량 라이브러리 교체 검토
- **FullCalendar** (약 150KB)
  - 대안: `@tanstack/react-table` + 커스텀 캘린더 뷰
  - 예상 절감: 100KB+

- **react-data-grid** (약 200KB)
  - 대안: 경량 테이블 컴포넌트 자체 구현
  - 예상 절감: 150KB+

#### 2. 이미지 최적화
- WebP 포맷 사용
- 이미지 lazy loading 적용
- 적절한 이미지 크기 사용

#### 3. 폰트 최적화
- 사용하는 폰트 글리프만 포함
- font-display: swap 적용

## 최적화 체크리스트

- [ ] 번들 분석 도구로 현재 상태 파악
- [ ] 대용량 라이브러리 사용 검토
- [ ] 중복 의존성 제거
- [ ] Dynamic imports 추가 적용
- [ ] 이미지 최적화
- [ ] 폰트 최적화
- [ ] Service Worker 캐싱 전략 개선

## 목표 지표

- **초기 번들 크기**: < 500KB (gzipped)
- **Largest Contentful Paint**: < 2.5초
- **First Input Delay**: < 100ms
- **Cumulative Layout Shift**: < 0.1

## 측정 방법

1. Chrome DevTools의 Lighthouse 사용
2. Web Vitals 라이브러리로 실시간 측정
3. 번들 분석 도구로 주기적 확인
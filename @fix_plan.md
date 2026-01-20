# UNIQN Fix Plan

> Ralph가 참조하는 우선순위 작업 목록입니다.
> 작업 완료 시 [x]로 표시하고, 새 작업은 적절한 우선순위에 추가하세요.

## 🔴 High Priority (긴급)

### uniqn-mobile 타입/린트 오류 수정
- [ ] TypeScript 타입 에러 전체 수정 (`npm run type-check`)
- [ ] ESLint 에러 전체 수정 (`npm run lint`)
- [ ] 빌드 오류 수정 (`npm run build:web`)

### 핵심 기능 안정화
- [ ] 인증 플로우 안정화 (로그인/회원가입/소셜로그인)
- [ ] 구인공고 목록/상세 화면 완성
- [ ] 지원하기 기능 완성 (트랜잭션 적용)

## 🟡 Medium Priority (중요)

### 구인자(Employer) 기능
- [ ] 공고 생성/수정/삭제 기능
- [ ] 지원자 관리 (확정/거절)
- [ ] 정산 기능 구현

### 스태프 기능
- [ ] 내 스케줄 화면 완성
- [ ] QR 출퇴근 기능
- [ ] 알림 시스템

### UI/UX 개선
- [ ] 다크모드 전체 적용 확인
- [ ] 로딩/에러/빈 상태 처리
- [ ] 접근성(accessibilityLabel) 적용

## 🟢 Low Priority (개선)

### 성능 최적화
- [ ] FlashList 적용 (긴 리스트)
- [ ] 이미지 최적화 (expo-image)
- [ ] 메모이제이션 검토

### 코드 품질
- [ ] 중복 코드 제거
- [ ] 타입 정의 정리
- [ ] 서비스 레이어 리팩토링

### 테스트
- [ ] 핵심 서비스 유닛 테스트
- [ ] E2E 테스트 시나리오

## ✅ Completed (완료)

- [x] Ralph 설정 파일 생성 (PROMPT.md, @fix_plan.md, @AGENT.md)
- [x] 프로젝트 초기 설정

## 📝 Notes

### 작업 규칙
1. **한 번에 하나의 작업**에 집중
2. 작업 전 `npm run type-check` 실행하여 현재 상태 파악
3. 작업 후 반드시 타입/린트 체크
4. 커밋은 작은 단위로 자주

### 우선순위 기준
- 🔴 High: 빌드 실패, 핵심 기능 미완성
- 🟡 Medium: 주요 기능, UX 개선
- 🟢 Low: 최적화, 리팩토링, 테스트

### 현재 상태
- **주 개발 대상**: `uniqn-mobile/` (React Native + Expo)
- **유지보수 모드**: `app2/` (기존 웹앱)

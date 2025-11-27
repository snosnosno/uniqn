# 배포 체크리스트 - 구인공고 타입 확장 시스템

**최종 업데이트**: 2025년 11월 27일
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)
**상태**: ✅ **배포 완료**
**프로젝트**: UNIQN (T-HOLDEM)
**배포일**: 2025-10-31

---

## 📋 배포 전 체크리스트

### 1. 코드 품질 검증 ✅

- [x] **TypeScript 타입 체크 통과**
  ```bash
  cd app2 && npm run type-check
  # 결과: 에러 0개 ✅
  ```

- [x] **ESLint 검사 통과**
  ```bash
  cd app2 && npm run lint
  # 결과: 경고만 존재, 에러 0개 ✅
  ```

- [x] **프로덕션 빌드 성공**
  ```bash
  cd app2 && npm run build
  # 결과: 빌드 성공 ✅
  ```

- [x] **테스트 통과**
  - 단위 테스트: 160개 ✅
  - 통합 테스트: 83개 ✅
  - 총 243개 테스트 통과 ✅

### 2. Firebase 배포 준비 ⏳

#### 2.1 Firestore Indexes

- [ ] **인덱스 배포**
  ```bash
  firebase deploy --only firestore:indexes
  ```

  **추가된 인덱스 (3개)**:
  1. `jobPostings` - postingType + status + createdAt
  2. `jobPostings` - postingType + createdBy + createdAt
  3. `jobPostings` - postingType + tournamentConfig.approvalStatus + createdAt

#### 2.2 Firestore Security Rules

- [ ] **Rules 배포**
  ```bash
  firebase deploy --only firestore:rules
  ```

  **주요 변경사항**:
  - `validateFixedConfig()` 함수 추가
  - `validateTournamentConfig()` 함수 추가
  - `validateUrgentConfig()` 함수 추가
  - `jobPostings` create 규칙 업데이트

#### 2.3 Firebase Functions

- [ ] **Functions 배포**
  ```bash
  cd functions && npm run deploy
  ```

  **배포할 함수 (3개)**:
  1. `approveJobPosting` - 대회 공고 승인 (Admin 전용)
  2. `rejectJobPosting` - 대회 공고 거부 (Admin 전용)
  3. `onTournamentApprovalChange` - 승인 상태 변경 트리거

### 3. 프론트엔드 배포 ⏳

- [ ] **Hosting 배포**
  ```bash
  firebase deploy --only hosting
  ```

  **배포 URL**: https://tholdem-ebc18.web.app

### 4. 모바일 앱 동기화 ⏳

- [ ] **Capacitor 동기화**
  ```bash
  cd app2 && npx cap sync
  ```

---

## 🔍 배포 후 검증

### 1. 기능 검증 체크리스트

#### 1.1 공고 타입별 생성

- [ ] **지원 공고 (regular)** 생성 가능
  - 비용: 0칩
  - 게시판: "지원 공고" 탭에 표시
  - 아이콘: 📋

- [ ] **고정 공고 (fixed)** 생성 가능
  - 7일: 3칩
  - 30일: 5칩
  - 90일: 10칩
  - 게시판: "고정 공고" 탭에 표시
  - 아이콘: 📌
  - 만료일 배지: D-N 형식

- [ ] **대회 공고 (tournament)** 생성 가능
  - 비용: 0칩
  - 초기 상태: pending (승인 대기)
  - 게시판: "대회 공고" 탭에 표시
  - 아이콘: 🏆
  - 승인 후: approved 상태로 변경

- [ ] **긴급 공고 (urgent)** 생성 가능
  - 비용: 5칩 (고정)
  - 게시판: "긴급 공고" 탭에 표시
  - 아이콘: 🚨
  - 스타일: 빨간색 깜빡이는 테두리

#### 1.2 게시판 구조

- [ ] **5탭 구조** 정상 작동
  1. 지원 공고 (regular)
  2. 고정 공고 (fixed)
  3. 대회 공고 (tournament)
  4. 긴급 공고 (urgent)
  5. 내 지원 현황

- [ ] **날짜 슬라이더** (지원 공고 탭)
  - 어제 ~ +14일 범위
  - 오늘/어제 라벨
  - 전체 버튼

#### 1.3 대회 공고 승인 시스템

- [ ] **Admin 승인 페이지** 접근 가능
  - URL: `/admin/job-posting-approvals`
  - Admin만 접근 가능

- [ ] **승인 처리**
  - 승인 버튼 클릭 → approved 상태
  - 알림 발송: "대회 공고 승인"

- [ ] **거부 처리**
  - 거부 사유 10자 이상 필수
  - 거부 버튼 클릭 → rejected 상태
  - 알림 발송: "대회 공고 거부 (사유 포함)"

#### 1.4 칩 시스템

- [ ] **칩 비용 표시**
  - 고정 공고: 3/5/10 칩 배지
  - 긴급 공고: 5 칩 배지
  - 무료 공고: 배지 없음

- [ ] **`isChipDeducted` 필드** 존재
  - 초기값: false
  - 향후 결제 시스템 연동 준비

#### 1.5 다크모드

- [ ] **모든 신규 컴포넌트** 다크모드 지원
  - DateSlider
  - FixedPostingBadge
  - TournamentStatusBadge
  - ApprovalModal
  - ApprovalManagementPage
  - JobBoardTabs

### 2. 성능 검증

- [ ] **Lighthouse 점수**
  - Performance: 90+ 목표
  - Accessibility: 90+ 목표
  - Best Practices: 90+ 목표
  - SEO: 90+ 목표

- [ ] **Firestore 쿼리 성능**
  - 인덱스 사용 확인
  - 쿼리 응답 시간 < 500ms

- [ ] **Firebase Functions 성능**
  - 승인/거부 함수 실행 시간 < 2초
  - 트리거 함수 실행 시간 < 1초

### 3. 보안 검증

- [ ] **Firestore Rules**
  - Non-admin 사용자: 승인/거부 차단
  - Admin 사용자: 승인/거부 허용
  - 데이터 검증 함수 작동 확인

- [ ] **Firebase Functions**
  - Admin 권한 체크
  - 입력 값 검증

### 4. 레거시 데이터 호환성

- [ ] **기존 공고 정상 표시**
  - `type: 'application'` → regular로 표시
  - `type: 'fixed'` → fixed로 표시
  - `recruitmentType` 필드 정상 변환

- [ ] **기존 공고 수정 가능**
  - 레거시 필드 유지하며 동작

---

## 🚨 롤백 계획

### 롤백 조건
다음 중 하나라도 발생 시 즉시 롤백:
1. 기존 공고가 표시되지 않음
2. 공고 생성/수정 실패율 > 10%
3. Firebase Functions 오류율 > 5%
4. Firestore 쿼리 실패
5. 사용자 불만 급증

### 롤백 절차

#### 1. Hosting 롤백
```bash
# 이전 버전으로 롤백
firebase hosting:rollback
```

#### 2. Functions 롤백
```bash
# 이전 버전 확인
firebase functions:log

# 특정 버전으로 롤백 (수동)
cd functions
git checkout <previous-commit>
npm run deploy
```

#### 3. Firestore Rules 롤백
```bash
# 이전 Rules로 복원
git checkout <previous-commit> -- firestore.rules
firebase deploy --only firestore:rules
```

#### 4. Firestore Indexes 롤백
```bash
# 인덱스는 삭제 불필요 (기존 쿼리 영향 없음)
# 필요 시 Firebase Console에서 수동 삭제
```

### 롤백 후 조치
1. 팀 전체에 롤백 공지
2. 원인 분석 및 문서화
3. 수정 후 재배포 일정 수립

---

## 📊 모니터링 설정

### 1. Firebase Console 모니터링

- [ ] **Functions 로그 확인**
  ```bash
  firebase functions:log
  ```

  **모니터링 대상**:
  - `approveJobPosting` 호출 횟수
  - `rejectJobPosting` 호출 횟수
  - `onTournamentApprovalChange` 실행 횟수
  - 에러 발생률

- [ ] **Firestore 사용량**
  - 읽기 횟수 증가 추이
  - 쓰기 횟수 증가 추이
  - 인덱스 사용 확인

### 2. 애플리케이션 로그

- [ ] **Console 에러 모니터링**
  - Browser Console에서 에러 확인
  - Sentry/LogRocket 연동 고려

### 3. 사용자 피드백 수집

- [ ] **사용자 문의 모니터링**
  - 고객센터 문의 내용 확인
  - 버그 리포트 수집

---

## 📝 배포 후 작업

### 1. 문서 업데이트

- [x] `JOB_POSTING_SYSTEM_IMPLEMENTATION_SPEC.md` 완료 상태로 업데이트 ✅
- [ ] `README.md` 업데이트 (새 기능 설명 추가)
- [ ] `CHANGELOG.md` 업데이트 (v0.2.4 변경사항 기록)

### 2. 팀 공지

- [ ] 개발팀 배포 완료 공지
- [ ] QA 팀 테스트 요청
- [ ] 운영팀 기능 소개

### 3. 사용자 가이드

- [ ] Admin 사용자 가이드 작성
  - 대회 공고 승인 방법
  - 거부 사유 작성 가이드

- [ ] 일반 사용자 가이드 작성
  - 새로운 공고 타입 소개
  - 칩 시스템 안내

---

## ✅ 최종 승인

### 배포 승인자

- [ ] **개발 리드**: ___________________ (날짜: _______)
- [ ] **QA 리드**: ___________________ (날짜: _______)
- [ ] **프로젝트 매니저**: ___________________ (날짜: _______)

### 배포 실행자

- [ ] **배포 담당자**: ___________________ (날짜: _______)
- [ ] **배포 시간**: ___________________
- [ ] **배포 결과**: [ ] 성공 / [ ] 실패 / [ ] 롤백

---

**문서 버전**: 1.0
**최종 수정일**: 2025-10-31

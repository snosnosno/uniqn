# Firebase 데이터 마이그레이션 가이드

## 📋 개요

이 문서는 T-HOLDEM 프로젝트의 Firebase Firestore 데이터를 최신 필드 구조로 마이그레이션하는 방법을 안내합니다.

## 🔄 마이그레이션 내용

### 필드 변경 사항
1. **dealerId → staffId**: 모든 컬렉션에서 dealerId를 staffId로 통일
2. **checkInTime/checkOutTime → actualStartTime/actualEndTime**: 시간 필드 표준화
3. **assignedTime → scheduledStartTime/scheduledEndTime**: 예정 시간 필드 분리

### 영향받는 컬렉션
- `workLogs`
- `attendanceRecords`
- `staff`

## 🚀 실행 가이드

### 1. 사전 준비

#### 필수 패키지 설치
```bash
cd app2
npm install -D ts-node @types/node dotenv
```

#### 환경 변수 설정
`.env` 파일에 Firebase 설정이 있는지 확인:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### 2. 데이터 백업 (필수!)

전체 데이터 백업:
```bash
npm run backup:firestore
```

특정 컬렉션만 백업:
```bash
npm run backup:firestore -- --collections=workLogs,attendanceRecords,staff
```

백업 위치 지정:
```bash
npm run backup:firestore -- --output=./my-backup
```

백업 파일은 기본적으로 `backup/YYYY-MM-DD` 폴더에 저장됩니다.

### 3. 마이그레이션 실행

#### Dry Run (테스트 실행)
실제 변경 없이 어떤 작업이 수행될지 확인:
```bash
npm run migrate:dry-run
```

#### 실제 마이그레이션
```bash
npm run migrate:fields
```

배치 크기 조정 (기본: 500):
```bash
npm run migrate:fields -- --batch-size=100
```

### 4. 데이터 복원 (필요시)

문제 발생 시 백업에서 복원:
```bash
npm run restore:firestore -- --backup=./backup/2025-01-15
```

특정 컬렉션만 복원:
```bash
npm run restore:firestore -- --backup=./backup/2025-01-15 --collections=workLogs
```

Dry Run으로 확인:
```bash
npm run restore:firestore -- --backup=./backup/2025-01-15 --dry-run
```

## 📊 스크립트 상세

### backup-firestore.ts
- **목적**: Firestore 데이터를 JSON 파일로 백업
- **출력**: 각 컬렉션별 JSON 파일 + 메타데이터
- **특징**: Timestamp 직렬화, 중첩 객체 지원

### migrate-fields.ts
- **목적**: 필드 구조 마이그레이션
- **기능**:
  - 통계 정보 출력 (마이그레이션 전/후)
  - 배치 처리로 대량 데이터 안전 처리
  - Dry Run 모드 지원
  - 상세한 로그 출력

### restore-firestore.ts
- **목적**: 백업 데이터 복원
- **기능**:
  - JSON에서 Firestore 형식으로 역직렬화
  - 선택적 컬렉션 복원
  - 사용자 확인 프롬프트

## ⚠️ 주의사항

### 실행 전 체크리스트
- [ ] 모든 사용자에게 유지보수 공지
- [ ] 최신 코드 배포 완료 (필드 호환성 레이어 포함)
- [ ] 백업 완료 및 검증
- [ ] 개발 환경에서 테스트 완료

### 권장 실행 시간
- 새벽 2시 ~ 5시 (트래픽 최소 시간대)
- 예상 소요 시간: 10-30분 (데이터 양에 따라 다름)

### 롤백 계획
1. 문제 발생 즉시 작업 중단
2. `restore:firestore` 스크립트로 백업 복원
3. 애플리케이션 재시작
4. 데이터 무결성 검증

## 🔍 검증 방법

### 마이그레이션 후 확인사항
1. **통계 확인**: 스크립트 출력의 통계 정보 확인
2. **샘플 테스트**: Firebase Console에서 몇 개 문서 직접 확인
3. **애플리케이션 테스트**:
   - 스태프 관리 페이지 정상 작동
   - 출석 체크 기능 정상 작동
   - 구인공고 정산 기능 정상 작동

### 성공 지표
- 모든 문서에 `staffId` 필드 존재
- `actualStartTime/actualEndTime` 필드 정상 마이그레이션
- 애플리케이션 에러 없음
- 사용자 리포트 없음

## 📞 문제 발생 시

1. 즉시 작업 중단
2. 에러 로그 수집
3. 백업에서 복원
4. 개발팀 연락

## 📝 로그 예시

### 성공적인 마이그레이션
```
[INFO] Starting workLogs migration...
[INFO]   - Migrating dealerId → staffId for doc ABC123
[INFO]   - Migrating checkInTime → actualStartTime for doc ABC123
✅ [SUCCESS] Committed batch of 500 updates
✅ [SUCCESS] workLogs migration complete. Updated 1523 documents.
```

### Dry Run 출력
```
[INFO] Mode: DRY RUN
[INFO]   [DRY RUN] Would update doc ABC123 with: { staffId: 'staff123' }
⚠️ [WARN] This was a DRY RUN. No actual changes were made.
```

## 🎯 마이그레이션 완료 후

1. **모니터링**: 24시간 동안 시스템 모니터링
2. **사용자 피드백**: 이슈 리포트 수집
3. **성능 확인**: 쿼리 성능 개선 확인
4. **백업 보관**: 최소 30일간 백업 파일 보관

## 📚 관련 문서

- [Firebase 데이터 구조 문서](../../docs/FIREBASE_STRUCTURE.md)
- [타입 정의 문서](../../app2/src/types/README.md)
- [개발 가이드](../../CLAUDE.md)
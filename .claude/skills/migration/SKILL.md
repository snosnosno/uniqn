---
name: migration
description: DB 마이그레이션 가이드. 마이그레이션, 스키마 변경, 데이터 이전, DB 변경 요청 시 활성화
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# DB 마이그레이션 스킬

Firestore 스키마 변경과 데이터 마이그레이션을 안전하게 수행합니다.

## 마이그레이션 원칙

1. **무중단**: 서비스 중단 없이 마이그레이션
2. **롤백 가능**: 문제 시 이전 상태로 복구 가능
3. **점진적**: 작은 단위로 나누어 실행
4. **검증**: 각 단계마다 데이터 무결성 확인

## 마이그레이션 유형

### 1. 필드 추가 (가장 안전)
```typescript
// 기존 코드: 영향 없음
// 새 코드: 새 필드 사용

// 마이그레이션 스크립트
async function addNewField() {
  const snapshot = await getDocs(collection(db, 'users'));
  const batch = writeBatch(db);

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      newField: 'defaultValue',
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
```

### 2. 필드 이름 변경 (주의 필요)
```typescript
// 단계 1: 새 필드 추가 + 기존 필드 유지
interface UserV1 { userName: string; }
interface UserV2 { userName: string; name: string; }  // 둘 다 유지

// 단계 2: 코드에서 새 필드 사용
const name = user.name ?? user.userName;

// 단계 3: 마이그레이션 완료 후 기존 필드 제거
interface UserV3 { name: string; }
```

### 3. 필드 타입 변경 (위험)
```typescript
// 예: string → number
// 단계 1: 새 필드로 추가
interface DataV1 { count: string; }
interface DataV2 { count: string; countNum: number; }

// 단계 2: 마이그레이션
async function migrateCountField() {
  const snapshot = await getDocs(collection(db, 'data'));
  const batch = writeBatch(db);

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    batch.update(doc.ref, {
      countNum: parseInt(data.count, 10) || 0,
    });
  });

  await batch.commit();
}

// 단계 3: 코드 업데이트 후 기존 필드 제거
```

### 4. 컬렉션 구조 변경 (복잡)
```typescript
// 예: 서브컬렉션 → 최상위 컬렉션
// users/{userId}/orders → orders (userId 필드 추가)

async function flattenOrders() {
  const usersSnapshot = await getDocs(collection(db, 'users'));

  for (const userDoc of usersSnapshot.docs) {
    const ordersSnapshot = await getDocs(
      collection(db, `users/${userDoc.id}/orders`)
    );

    const batch = writeBatch(db);
    ordersSnapshot.docs.forEach(orderDoc => {
      const newRef = doc(collection(db, 'orders'));
      batch.set(newRef, {
        ...orderDoc.data(),
        userId: userDoc.id,
        migratedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }
}
```

## 마이그레이션 프로세스

### 1단계: 분석
```markdown
## 마이그레이션 계획

### 변경 사항
- 현재 스키마: [설명]
- 목표 스키마: [설명]
- 영향 받는 문서 수: [예상 수]

### 영향도 분석
- 영향 받는 코드: [파일 목록]
- 영향 받는 쿼리: [쿼리 목록]
- Security Rules 변경 필요: [예/아니오]
```

### 2단계: 백업
```bash
# Firestore 내보내기 (Firebase 콘솔 또는 CLI)
gcloud firestore export gs://bucket-name/backup-$(date +%Y%m%d)
```

### 3단계: 마이그레이션 스크립트 작성
```typescript
// functions/src/migrations/migration-001-add-status.ts
import { firestore } from 'firebase-admin';

export async function migrate() {
  const db = firestore();
  const batchSize = 500;  // Firestore 배치 제한
  let processed = 0;

  const snapshot = await db.collection('items').get();
  const batches: firestore.WriteBatch[] = [];
  let currentBatch = db.batch();
  let operationCount = 0;

  for (const doc of snapshot.docs) {
    currentBatch.update(doc.ref, {
      status: 'active',
      migratedAt: firestore.FieldValue.serverTimestamp(),
    });

    operationCount++;
    processed++;

    if (operationCount === batchSize) {
      batches.push(currentBatch);
      currentBatch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    batches.push(currentBatch);
  }

  // 순차 실행
  for (const batch of batches) {
    await batch.commit();
    console.log(`Processed ${processed} documents`);
  }

  return { processed };
}
```

### 4단계: 테스트 (개발 환경)
```bash
# 개발 환경에서 먼저 실행
firebase use development
npx ts-node migrations/migration-001.ts
```

### 5단계: 프로덕션 실행
```bash
# 프로덕션 실행 (주의!)
firebase use production
npx ts-node migrations/migration-001.ts
```

### 6단계: 검증
```typescript
// 마이그레이션 검증 스크립트
async function verifyMigration() {
  const snapshot = await getDocs(collection(db, 'items'));

  const results = {
    total: snapshot.size,
    migrated: 0,
    failed: 0,
    failedDocs: [] as string[],
  };

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status && data.migratedAt) {
      results.migrated++;
    } else {
      results.failed++;
      results.failedDocs.push(doc.id);
    }
  });

  console.log('Migration verification:', results);
  return results;
}
```

## 롤백 전략

### 필드 추가 롤백
```typescript
async function rollbackAddField() {
  const snapshot = await getDocs(collection(db, 'items'));
  const batch = writeBatch(db);

  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      newField: deleteField(),
    });
  });

  await batch.commit();
}
```

### 데이터 복원
```bash
# Firestore 가져오기
gcloud firestore import gs://bucket-name/backup-20240101
```

## 체크리스트

### 마이그레이션 전
- [ ] 스키마 변경 사항 문서화
- [ ] 영향 받는 코드 파악
- [ ] 백업 완료
- [ ] 개발 환경에서 테스트

### 마이그레이션 중
- [ ] 배치 크기 적절 (500 이하)
- [ ] 진행 상황 로깅
- [ ] 에러 핸들링

### 마이그레이션 후
- [ ] 데이터 무결성 검증
- [ ] 코드 업데이트 배포
- [ ] Security Rules 업데이트
- [ ] 모니터링

## 출력 형식

```markdown
## 마이그레이션 계획

### 개요
- 이름: [마이그레이션 이름]
- 대상: [컬렉션/필드]
- 예상 문서 수: [N개]

### 변경 사항
| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 필드명 | ... | ... |

### 실행 계획
1. [ ] 백업 생성
2. [ ] 개발 환경 테스트
3. [ ] 프로덕션 실행
4. [ ] 검증
5. [ ] 코드 배포

### 롤백 계획
[롤백 방법 설명]
```

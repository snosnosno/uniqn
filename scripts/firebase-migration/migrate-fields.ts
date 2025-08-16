/**
 * Firebase 필드 마이그레이션 스크립트
 * 
 * 이 스크립트는 Firebase Firestore의 데이터를 최신 필드 구조로 마이그레이션합니다.
 * 
 * 주요 마이그레이션:
 * 1. dealerId → staffId
 * 2. checkInTime/checkOutTime → actualStartTime/actualEndTime
 * 3. assignedTime → scheduledStartTime/scheduledEndTime
 * 
 * 실행 방법:
 * npm run migrate:fields [--dry-run] [--batch-size=500]
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  writeBatch,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { parseAssignedTime } from '../../app2/src/utils/workLogUtils';

// 환경 변수 로드
dotenv.config();

// Firebase 설정
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const BATCH_SIZE = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 500;

// 로깅 헬퍼
const log = {
  info: (msg: string, data?: any) => {
    console.log(`[INFO] ${msg}`, data || '');
  },
  success: (msg: string, data?: any) => {
    console.log(`✅ [SUCCESS] ${msg}`, data || '');
  },
  error: (msg: string, error?: any) => {
    console.error(`❌ [ERROR] ${msg}`, error || '');
  },
  warn: (msg: string, data?: any) => {
    console.warn(`⚠️ [WARN] ${msg}`, data || '');
  }
};

/**
 * workLogs 컬렉션 마이그레이션
 */
async function migrateWorkLogs() {
  log.info('Starting workLogs migration...');
  
  const workLogsRef = collection(db, 'workLogs');
  const snapshot = await getDocs(workLogsRef);
  
  let batch = writeBatch(db);
  let batchCount = 0;
  let totalUpdated = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const updates: any = {};
    let needsUpdate = false;
    
    // dealerId → staffId
    if (data.dealerId && !data.staffId) {
      updates.staffId = data.dealerId;
      needsUpdate = true;
      log.info(`  - Migrating dealerId → staffId for doc ${docSnap.id}`);
    }
    
    // checkInTime → actualStartTime
    if (data.checkInTime && !data.actualStartTime) {
      updates.actualStartTime = data.checkInTime;
      needsUpdate = true;
      log.info(`  - Migrating checkInTime → actualStartTime for doc ${docSnap.id}`);
    }
    
    // checkOutTime → actualEndTime
    if (data.checkOutTime && !data.actualEndTime) {
      updates.actualEndTime = data.checkOutTime;
      needsUpdate = true;
      log.info(`  - Migrating checkOutTime → actualEndTime for doc ${docSnap.id}`);
    }
    
    // assignedTime → scheduledStartTime/scheduledEndTime
    if (data.assignedTime && typeof data.assignedTime === 'string' && 
        (!data.scheduledStartTime || !data.scheduledEndTime)) {
      const parsed = parseAssignedTime(data.assignedTime);
      if (parsed.startTime) {
        const date = data.date || new Date().toISOString().split('T')[0];
        const startDateTime = new Date(`${date}T${parsed.startTime}`);
        updates.scheduledStartTime = Timestamp.fromDate(startDateTime);
        
        if (parsed.endTime) {
          const endDateTime = new Date(`${date}T${parsed.endTime}`);
          updates.scheduledEndTime = Timestamp.fromDate(endDateTime);
        }
        needsUpdate = true;
        log.info(`  - Migrating assignedTime → scheduled times for doc ${docSnap.id}`);
      }
    }
    
    if (needsUpdate) {
      if (isDryRun) {
        log.info(`  [DRY RUN] Would update doc ${docSnap.id} with:`, updates);
      } else {
        batch.update(doc(db, 'workLogs', docSnap.id), updates);
        batchCount++;
        totalUpdated++;
        
        // Commit batch when it reaches the size limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          log.success(`Committed batch of ${batchCount} updates`);
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
  }
  
  // Commit remaining updates
  if (batchCount > 0 && !isDryRun) {
    await batch.commit();
    log.success(`Committed final batch of ${batchCount} updates`);
  }
  
  log.success(`workLogs migration complete. Updated ${totalUpdated} documents.`);
}

/**
 * attendanceRecords 컬렉션 마이그레이션
 */
async function migrateAttendanceRecords() {
  log.info('Starting attendanceRecords migration...');
  
  const attendanceRef = collection(db, 'attendanceRecords');
  const snapshot = await getDocs(attendanceRef);
  
  let batch = writeBatch(db);
  let batchCount = 0;
  let totalUpdated = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const updates: any = {};
    let needsUpdate = false;
    
    // dealerId → staffId
    if (data.dealerId && !data.staffId) {
      updates.staffId = data.dealerId;
      needsUpdate = true;
      log.info(`  - Migrating dealerId → staffId for doc ${docSnap.id}`);
    }
    
    // checkInTime → actualStartTime
    if (data.checkInTime && !data.actualStartTime) {
      updates.actualStartTime = data.checkInTime;
      needsUpdate = true;
      log.info(`  - Migrating checkInTime → actualStartTime for doc ${docSnap.id}`);
    }
    
    // checkOutTime → actualEndTime
    if (data.checkOutTime && !data.actualEndTime) {
      updates.actualEndTime = data.checkOutTime;
      needsUpdate = true;
      log.info(`  - Migrating checkOutTime → actualEndTime for doc ${docSnap.id}`);
    }
    
    if (needsUpdate) {
      if (isDryRun) {
        log.info(`  [DRY RUN] Would update doc ${docSnap.id} with:`, updates);
      } else {
        batch.update(doc(db, 'attendanceRecords', docSnap.id), updates);
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          log.success(`Committed batch of ${batchCount} updates`);
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
  }
  
  if (batchCount > 0 && !isDryRun) {
    await batch.commit();
    log.success(`Committed final batch of ${batchCount} updates`);
  }
  
  log.success(`attendanceRecords migration complete. Updated ${totalUpdated} documents.`);
}

/**
 * staff 컬렉션 마이그레이션
 */
async function migrateStaff() {
  log.info('Starting staff migration...');
  
  const staffRef = collection(db, 'staff');
  const snapshot = await getDocs(staffRef);
  
  let batch = writeBatch(db);
  let batchCount = 0;
  let totalUpdated = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const updates: any = {};
    let needsUpdate = false;
    
    // dealerId → staffId (staff 문서의 ID를 staffId로 설정)
    if (!data.staffId) {
      updates.staffId = docSnap.id;
      needsUpdate = true;
      log.info(`  - Adding staffId for doc ${docSnap.id}`);
    }
    
    if (needsUpdate) {
      if (isDryRun) {
        log.info(`  [DRY RUN] Would update doc ${docSnap.id} with:`, updates);
      } else {
        batch.update(doc(db, 'staff', docSnap.id), updates);
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          log.success(`Committed batch of ${batchCount} updates`);
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
  }
  
  if (batchCount > 0 && !isDryRun) {
    await batch.commit();
    log.success(`Committed final batch of ${batchCount} updates`);
  }
  
  log.success(`staff migration complete. Updated ${totalUpdated} documents.`);
}

/**
 * 통계 정보 출력
 */
async function printStatistics() {
  log.info('Gathering statistics...');
  
  const collections = ['workLogs', 'attendanceRecords', 'staff'];
  
  for (const collName of collections) {
    const collRef = collection(db, collName);
    const snapshot = await getDocs(collRef);
    
    let oldFieldCount = 0;
    let newFieldCount = 0;
    
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      
      // Old fields
      if (data.dealerId) oldFieldCount++;
      if (data.checkInTime) oldFieldCount++;
      if (data.checkOutTime) oldFieldCount++;
      if (data.assignedTime) oldFieldCount++;
      
      // New fields
      if (data.staffId) newFieldCount++;
      if (data.actualStartTime) newFieldCount++;
      if (data.actualEndTime) newFieldCount++;
      if (data.scheduledStartTime) newFieldCount++;
    });
    
    log.info(`${collName} statistics:`, {
      totalDocs: snapshot.size,
      oldFields: oldFieldCount,
      newFields: newFieldCount
    });
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    log.info('='.repeat(50));
    log.info('Firebase Field Migration Script');
    log.info(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    log.info(`Batch Size: ${BATCH_SIZE}`);
    log.info('='.repeat(50));
    
    // 통계 출력
    await printStatistics();
    
    log.info('='.repeat(50));
    
    // 마이그레이션 실행
    await migrateWorkLogs();
    await migrateAttendanceRecords();
    await migrateStaff();
    
    log.info('='.repeat(50));
    
    // 마이그레이션 후 통계
    if (!isDryRun) {
      log.info('Post-migration statistics:');
      await printStatistics();
    }
    
    log.success('Migration completed successfully!');
    
    if (isDryRun) {
      log.warn('This was a DRY RUN. No actual changes were made.');
      log.info('To perform the actual migration, run without --dry-run flag.');
    }
    
  } catch (error) {
    log.error('Migration failed:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch(error => {
  log.error('Unexpected error:', error);
  process.exit(1);
});
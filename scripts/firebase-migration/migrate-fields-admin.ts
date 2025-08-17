/**
 * Firebase 필드 마이그레이션 스크립트 (Admin SDK 버전)
 * 
 * 이 스크립트는 Firebase Admin SDK를 사용하여 Firestore의 데이터를 최신 필드 구조로 마이그레이션합니다.
 * 
 * 주요 마이그레이션:
 * 1. dealerId → staffId
 * 2. checkInTime/checkOutTime → actualStartTime/actualEndTime
 * 3. assignedTime → scheduledStartTime/scheduledEndTime
 * 
 * 실행 방법:
 * npm run migrate:admin [--dry-run] [--batch-size=500]
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 환경 변수 로드 (app2/.env 파일에서)
dotenv.config({ path: path.resolve(__dirname, '../../app2/.env') });

// parseAssignedTime 함수 (workLogUtils에서 가져오기 대신 직접 구현)
function parseAssignedTime(assignedTime: string): { startTime: string | null; endTime: string | null } {
  if (!assignedTime || assignedTime === '미정') {
    return { startTime: null, endTime: null };
  }
  
  const timePattern = /^(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})$/;
  const match = assignedTime.match(timePattern);
  
  if (match) {
    return {
      startTime: match[1] + ':00',
      endTime: match[2] + ':00'
    };
  }
  
  return { startTime: null, endTime: null };
}

// Firebase Admin 초기화
// 서비스 계정 키 파일 경로
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
  path.resolve(__dirname, '../t-holdem-firebase-adminsdk-v4p2h-17b0754402.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account key file not found at: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

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
  
  const workLogsRef = db.collection('workLogs');
  const snapshot = await workLogsRef.get();
  
  let batch = db.batch();
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
        updates.scheduledStartTime = admin.firestore.Timestamp.fromDate(startDateTime);
        
        if (parsed.endTime) {
          const endDateTime = new Date(`${date}T${parsed.endTime}`);
          updates.scheduledEndTime = admin.firestore.Timestamp.fromDate(endDateTime);
        }
        needsUpdate = true;
        log.info(`  - Migrating assignedTime → scheduled times for doc ${docSnap.id}`);
      }
    }
    
    if (needsUpdate) {
      if (isDryRun) {
        log.info(`  [DRY RUN] Would update doc ${docSnap.id} with:`, updates);
      } else {
        batch.update(workLogsRef.doc(docSnap.id), updates);
        batchCount++;
        totalUpdated++;
        
        // Commit batch when it reaches the size limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          log.success(`Committed batch of ${batchCount} updates`);
          batch = db.batch();
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
  
  const attendanceRef = db.collection('attendanceRecords');
  const snapshot = await attendanceRef.get();
  
  let batch = db.batch();
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
        batch.update(attendanceRef.doc(docSnap.id), updates);
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          log.success(`Committed batch of ${batchCount} updates`);
          batch = db.batch();
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
  
  const staffRef = db.collection('staff');
  const snapshot = await staffRef.get();
  
  let batch = db.batch();
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
        batch.update(staffRef.doc(docSnap.id), updates);
        batchCount++;
        totalUpdated++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          log.success(`Committed batch of ${batchCount} updates`);
          batch = db.batch();
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
    const collRef = db.collection(collName);
    const snapshot = await collRef.get();
    
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
    log.info('Firebase Field Migration Script (Admin SDK)');
    log.info(`Project: ${serviceAccount.project_id}`);
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
    
    // Admin SDK 정리
    await admin.app().delete();
    
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
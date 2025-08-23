/**
 * 서브컬렉션 구조로 마이그레이션 스크립트
 * Phase 2: 구조 최적화
 * 
 * 실행 방법:
 * node scripts/migrate-to-subcollections.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// 서비스 계정 키 파일 경로
const serviceAccountPath = path.join(__dirname, 't-holdem-firebase-adminsdk-v4p2h-17b0754402.json');

// Firebase Admin 초기화
if (!admin.apps.length) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// 명령행 인자 파싱
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// 통계
let stats = {
  jobPostings: { total: 0, migrated: 0, errors: 0 },
  confirmedStaff: { total: 0, migrated: 0, errors: 0 },
  workLogs: { total: 0, migrated: 0, errors: 0 },
  startTime: new Date(),
};

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = isDryRun ? '[DRY-RUN] ' : '';
  
  switch(type) {
    case 'success':
      console.log(`${colors.green}✓${colors.reset} ${prefix}${message}`);
      break;
    case 'error':
      console.log(`${colors.red}✗${colors.reset} ${prefix}${message}`);
      break;
    case 'warning':
      console.log(`${colors.yellow}⚠${colors.reset} ${prefix}${message}`);
      break;
    case 'info':
      console.log(`${colors.cyan}ℹ${colors.reset} ${prefix}${message}`);
      break;
    default:
      console.log(`  ${prefix}${message}`);
  }
}

/**
 * 백업 생성
 */
async function createBackup() {
  log('백업 생성 시작...', 'info');
  
  const backupDir = path.join(__dirname, '..', 'backup', `migration-${Date.now()}`);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // JobPostings 백업
  const jobPostings = await db.collection('jobPostings').get();
  const jobPostingsData = jobPostings.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  fs.writeFileSync(
    path.join(backupDir, 'jobPostings.json'),
    JSON.stringify(jobPostingsData, null, 2)
  );
  
  // WorkLogs 백업
  const workLogs = await db.collection('workLogs').get();
  const workLogsData = workLogs.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  fs.writeFileSync(
    path.join(backupDir, 'workLogs.json'),
    JSON.stringify(workLogsData, null, 2)
  );
  
  log(`백업 완료: ${backupDir}`, 'success');
  return backupDir;
}

/**
 * confirmedStaff 배열을 staff 서브컬렉션으로 마이그레이션
 */
async function migrateConfirmedStaff(jobPosting) {
  const eventId = jobPosting.id;
  const confirmedStaff = jobPosting.confirmedStaff || [];
  
  if (confirmedStaff.length === 0) {
    return;
  }
  
  log(`  이벤트 ${eventId}: ${confirmedStaff.length}명의 스태프 마이그레이션`, 'info');
  
  for (const staff of confirmedStaff) {
    try {
      stats.confirmedStaff.total++;
      
      // userId 결정 (userId 우선, 없으면 applicantId 사용)
      const userId = staff.userId || staff.applicantId;
      if (!userId) {
        log(`    스태프 ${staff.name}: userId 없음, 건너뜀`, 'warning');
        stats.confirmedStaff.errors++;
        continue;
      }
      
      // 서브컬렉션 문서 데이터
      const staffData = {
        userId: userId,
        name: staff.name || '이름 없음',
        email: staff.email || '',
        phone: staff.phone || '',
        role: staff.role || staff.roles?.[0] || 'dealer',
        roles: staff.roles || [staff.role || 'dealer'],
        
        // 할당 정보
        assignedDate: staff.date || staff.assignedDate || '',
        assignedTime: staff.timeSlot || staff.assignedTime || '',
        assignedAt: staff.confirmedAt || admin.firestore.Timestamp.now(),
        
        // 상태
        status: 'confirmed',
        
        // 지원 정보
        applicationId: staff.applicationId || null,
        appliedAt: staff.appliedAt || null,
        
        // 메타데이터
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      };
      
      if (!isDryRun) {
        // 실제 저장
        await db
          .collection('jobPostings')
          .doc(eventId)
          .collection('staff')
          .doc(userId)
          .set(staffData);
      }
      
      stats.confirmedStaff.migrated++;
      log(`    스태프 ${staff.name} (${userId}) 마이그레이션 완료`, 'success');
      
    } catch (error) {
      stats.confirmedStaff.errors++;
      log(`    스태프 ${staff.name} 마이그레이션 실패: ${error.message}`, 'error');
    }
  }
}

/**
 * workLogs를 서브컬렉션으로 마이그레이션
 */
async function migrateWorkLogs() {
  log('WorkLogs 마이그레이션 시작...', 'info');
  
  const workLogsSnapshot = await db.collection('workLogs').get();
  
  // eventId별로 그룹화
  const workLogsByEvent = {};
  workLogsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const eventId = data.eventId;
    if (!eventId) return;
    
    if (!workLogsByEvent[eventId]) {
      workLogsByEvent[eventId] = [];
    }
    workLogsByEvent[eventId].push({
      id: doc.id,
      ...data
    });
  });
  
  // 각 이벤트별로 마이그레이션
  for (const [eventId, workLogs] of Object.entries(workLogsByEvent)) {
    log(`  이벤트 ${eventId}: ${workLogs.length}개 WorkLog 마이그레이션`, 'info');
    
    for (const workLog of workLogs) {
      try {
        stats.workLogs.total++;
        
        // 서브컬렉션 문서 데이터
        const workLogData = {
          id: workLog.id,
          userId: workLog.staffId || workLog.userId || '',
          staffName: workLog.staffName || '',
          role: workLog.role || 'dealer',
          date: workLog.date || '',
          
          // 시간 정보
          scheduledStartTime: workLog.scheduledStartTime || null,
          scheduledEndTime: workLog.scheduledEndTime || null,
          actualStartTime: workLog.actualStartTime || null,
          actualEndTime: workLog.actualEndTime || null,
          
          // 계산된 값
          scheduledHours: workLog.scheduledHours || 0,
          actualHours: workLog.actualHours || 0,
          hoursWorked: workLog.hoursWorked || 0,
          
          // 상태
          status: workLog.status || 'scheduled',
          
          // 메타데이터
          createdAt: workLog.createdAt || admin.firestore.Timestamp.now(),
          updatedAt: workLog.updatedAt || admin.firestore.Timestamp.now(),
        };
        
        if (!isDryRun) {
          // 실제 저장
          await db
            .collection('jobPostings')
            .doc(eventId)
            .collection('workLogs')
            .doc(workLog.id)
            .set(workLogData);
        }
        
        stats.workLogs.migrated++;
        log(`    WorkLog ${workLog.id} 마이그레이션 완료`, 'success');
        
      } catch (error) {
        stats.workLogs.errors++;
        log(`    WorkLog ${workLog.id} 마이그레이션 실패: ${error.message}`, 'error');
      }
    }
  }
}

/**
 * JobPostings 문서 정리 (confirmedStaff 필드 제거)
 */
async function cleanupJobPostings() {
  log('JobPostings 정리 시작...', 'info');
  
  const jobPostingsSnapshot = await db.collection('jobPostings').get();
  
  for (const doc of jobPostingsSnapshot.docs) {
    const data = doc.data();
    
    // confirmedStaff 필드가 있으면 제거
    if (data.confirmedStaff) {
      if (!isDryRun) {
        await doc.ref.update({
          confirmedStaff: FieldValue.delete(),
          updatedAt: admin.firestore.Timestamp.now()
        });
      }
      log(`  JobPosting ${doc.id}: confirmedStaff 필드 제거`, 'success');
    }
  }
}

/**
 * 메인 마이그레이션 함수
 */
async function migrate() {
  console.log(`\n${colors.bright}========================================${colors.reset}`);
  console.log(`${colors.bright}   서브컬렉션 구조 마이그레이션 시작${colors.reset}`);
  console.log(`${colors.bright}========================================${colors.reset}\n`);
  
  if (isDryRun) {
    console.log(`${colors.yellow}⚠️  DRY-RUN 모드: 실제 변경 없이 시뮬레이션만 수행${colors.reset}\n`);
  }
  
  try {
    // 1. 백업 생성
    if (!isDryRun) {
      await createBackup();
    }
    
    // 2. JobPostings 조회
    log('JobPostings 조회 중...', 'info');
    const jobPostingsSnapshot = await db.collection('jobPostings').get();
    stats.jobPostings.total = jobPostingsSnapshot.size;
    
    // 3. 각 JobPosting별로 마이그레이션
    for (const doc of jobPostingsSnapshot.docs) {
      const jobPosting = {
        id: doc.id,
        ...doc.data()
      };
      
      log(`\n이벤트 처리: ${jobPosting.title} (${jobPosting.id})`, 'info');
      
      // confirmedStaff 마이그레이션
      await migrateConfirmedStaff(jobPosting);
      
      stats.jobPostings.migrated++;
    }
    
    // 4. WorkLogs 마이그레이션
    await migrateWorkLogs();
    
    // 5. JobPostings 정리 (confirmedStaff 필드 제거)
    if (!isDryRun) {
      await cleanupJobPostings();
    }
    
    // 완료
    const endTime = new Date();
    const duration = (endTime - stats.startTime) / 1000;
    
    console.log(`\n${colors.bright}========================================${colors.reset}`);
    console.log(`${colors.bright}         마이그레이션 완료${colors.reset}`);
    console.log(`${colors.bright}========================================${colors.reset}\n`);
    
    console.log('📊 통계:');
    console.log(`  JobPostings: ${stats.jobPostings.migrated}/${stats.jobPostings.total} 처리`);
    console.log(`  ConfirmedStaff: ${stats.confirmedStaff.migrated}/${stats.confirmedStaff.total} 마이그레이션 (${stats.confirmedStaff.errors} 오류)`);
    console.log(`  WorkLogs: ${stats.workLogs.migrated}/${stats.workLogs.total} 마이그레이션 (${stats.workLogs.errors} 오류)`);
    console.log(`  소요 시간: ${duration.toFixed(2)}초`);
    
    if (isDryRun) {
      console.log(`\n${colors.yellow}⚠️  DRY-RUN 완료. 실제 실행하려면 --dry-run 옵션 없이 다시 실행하세요.${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✅ 마이그레이션이 성공적으로 완료되었습니다!${colors.reset}`);
    }
    
  } catch (error) {
    console.error(`\n${colors.red}❌ 마이그레이션 실패: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 실행
migrate().then(() => {
  process.exit(0);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
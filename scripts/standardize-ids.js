/**
 * ID 표준화 마이그레이션 스크립트
 * 
 * 목적:
 * 1. applications 컬렉션: postId → eventId
 * 2. confirmedStaff: 모든 ID를 userId로 통일
 * 3. workLogs: staffId 정리 (접미사 제거)
 * 
 * 실행 방법:
 * node scripts/standardize-ids.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://tholdem-ebc18.firebaseio.com`
});

const db = admin.firestore();

// 통계
let stats = {
  applications: { total: 0, updated: 0, errors: 0 },
  workLogs: { total: 0, updated: 0, errors: 0 },
  confirmedStaff: { total: 0, updated: 0, errors: 0 }
};

/**
 * applications 컬렉션 마이그레이션
 * postId → eventId 변경
 */
async function migrateApplications() {
  console.log('\n📋 applications 컬렉션 마이그레이션 시작...');
  
  try {
    const snapshot = await db.collection('applications').get();
    stats.applications.total = snapshot.size;
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // postId가 있고 eventId가 없는 경우만 업데이트
      if (data.postId && !data.eventId) {
        batch.update(doc.ref, {
          eventId: data.postId,
          postId: admin.firestore.FieldValue.delete() // postId 필드 삭제
        });
        
        batchCount++;
        stats.applications.updated++;
        
        // 500개씩 배치 처리 (Firestore 제한)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✅ ${batchCount}개 문서 업데이트 완료`);
          batchCount = 0;
        }
      }
    }
    
    // 남은 배치 커밋
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✅ ${batchCount}개 문서 업데이트 완료`);
    }
    
    console.log(`  ✅ applications 완료: ${stats.applications.updated}/${stats.applications.total} 업데이트됨`);
    
  } catch (error) {
    console.error('  ❌ applications 마이그레이션 실패:', error);
    stats.applications.errors++;
  }
}

/**
 * workLogs 컬렉션 정리
 * staffId 접미사 제거 및 정리
 */
async function cleanupWorkLogs() {
  console.log('\n📋 workLogs 컬렉션 정리 시작...');
  
  try {
    const snapshot = await db.collection('workLogs').get();
    stats.workLogs.total = snapshot.size;
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      let needsUpdate = false;
      const updates = {};
      
      // staffId에 접미사가 있는 경우 제거
      if (data.staffId && data.staffId.includes('_')) {
        const baseId = data.staffId.split('_')[0];
        updates.staffId = baseId;
        needsUpdate = true;
      }
      
      // dealerId가 남아있으면 제거
      if (data.dealerId) {
        updates.dealerId = admin.firestore.FieldValue.delete();
        needsUpdate = true;
      }
      
      // jobPostingId가 있고 eventId가 없으면 변경
      if (data.jobPostingId && !data.eventId) {
        updates.eventId = data.jobPostingId;
        updates.jobPostingId = admin.firestore.FieldValue.delete();
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        batch.update(doc.ref, updates);
        batchCount++;
        stats.workLogs.updated++;
        
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✅ ${batchCount}개 문서 업데이트 완료`);
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✅ ${batchCount}개 문서 업데이트 완료`);
    }
    
    console.log(`  ✅ workLogs 완료: ${stats.workLogs.updated}/${stats.workLogs.total} 업데이트됨`);
    
  } catch (error) {
    console.error('  ❌ workLogs 정리 실패:', error);
    stats.workLogs.errors++;
  }
}

/**
 * jobPostings의 confirmedStaff 정리
 * applicantId → userId 통일
 */
async function cleanupConfirmedStaff() {
  console.log('\n📋 confirmedStaff 정리 시작...');
  
  try {
    const snapshot = await db.collection('jobPostings').get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      if (data.confirmedStaff && Array.isArray(data.confirmedStaff)) {
        stats.confirmedStaff.total += data.confirmedStaff.length;
        
        const updatedStaff = data.confirmedStaff.map(staff => {
          // applicantId를 userId로 변경
          if (staff.applicantId && !staff.userId) {
            stats.confirmedStaff.updated++;
            return {
              ...staff,
              userId: staff.applicantId,
              applicantId: undefined // 제거
            };
          }
          return staff;
        }).filter(staff => staff.userId); // userId가 없는 항목 제거
        
        // 중복 제거
        const uniqueStaff = Array.from(
          new Map(updatedStaff.map(s => [s.userId, s])).values()
        );
        
        if (uniqueStaff.length !== data.confirmedStaff.length) {
          await doc.ref.update({
            confirmedStaff: uniqueStaff
          });
          console.log(`  ✅ ${doc.id}: ${data.confirmedStaff.length} → ${uniqueStaff.length} 스태프`);
        }
      }
    }
    
    console.log(`  ✅ confirmedStaff 완료: ${stats.confirmedStaff.updated} 항목 업데이트됨`);
    
  } catch (error) {
    console.error('  ❌ confirmedStaff 정리 실패:', error);
    stats.confirmedStaff.errors++;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('🚀 ID 표준화 마이그레이션 시작');
  console.log('====================================');
  
  const startTime = Date.now();
  
  // 각 컬렉션 순차 처리
  await migrateApplications();
  await cleanupWorkLogs();
  await cleanupConfirmedStaff();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // 최종 통계 출력
  console.log('\n====================================');
  console.log('📊 마이그레이션 완료 통계');
  console.log('====================================');
  console.log(`⏱️  소요 시간: ${duration}초`);
  console.log('\napplications:');
  console.log(`  - 전체: ${stats.applications.total}`);
  console.log(`  - 업데이트: ${stats.applications.updated}`);
  console.log(`  - 오류: ${stats.applications.errors}`);
  console.log('\nworkLogs:');
  console.log(`  - 전체: ${stats.workLogs.total}`);
  console.log(`  - 업데이트: ${stats.workLogs.updated}`);
  console.log(`  - 오류: ${stats.workLogs.errors}`);
  console.log('\nconfirmedStaff:');
  console.log(`  - 전체: ${stats.confirmedStaff.total}`);
  console.log(`  - 업데이트: ${stats.confirmedStaff.updated}`);
  console.log(`  - 오류: ${stats.confirmedStaff.errors}`);
  
  const totalErrors = stats.applications.errors + stats.workLogs.errors + stats.confirmedStaff.errors;
  
  if (totalErrors === 0) {
    console.log('\n✅ 모든 마이그레이션이 성공적으로 완료되었습니다!');
  } else {
    console.log(`\n⚠️  ${totalErrors}개의 오류가 발생했습니다. 로그를 확인하세요.`);
  }
  
  process.exit(0);
}

// 실행
main().catch((error) => {
  console.error('❌ 마이그레이션 실패:', error);
  process.exit(1);
});
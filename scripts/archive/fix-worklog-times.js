/**
 * WorkLog 시간 데이터 수정 스크립트
 * 스태프탭의 실제 시간으로 Firebase WorkLog 컬렉션 업데이트
 */

const admin = require('firebase-admin');
const serviceAccount = require('../app2/src/firebase-adminsdk.json');

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tholdem-ebc18'
});

const db = admin.firestore();

async function fixWorkLogTimes() {
  console.log('🔍 WorkLog 시간 데이터 수정 시작...');
  
  try {
    const jobPostingId = 'jVMSkq5BIYYvlrgyk0am';
    const staffId = 'tURgdOBmtYfO5Bgzm8NyGKGtbL12';
    
    // 수정할 WorkLog 데이터 정의 (스태프탭에서 확인한 실제 시간)
    const fixData = [
      {
        id: `${jobPostingId}_${staffId}_2025-08-21`,
        scheduledStartTime: admin.firestore.Timestamp.fromDate(new Date('2025-08-21T14:00:00+09:00')),
        scheduledEndTime: admin.firestore.Timestamp.fromDate(new Date('2025-08-21T18:00:00+09:00')),
        date: '2025-08-21',
        role: 'dealer',
        description: '08-21 dealer 14:00-18:00 (4시간) - 스태프탭 실제 시간으로 수정'
      },
      {
        id: `${jobPostingId}_${staffId}_2025-08-22`,
        scheduledStartTime: admin.firestore.Timestamp.fromDate(new Date('2025-08-22T13:00:00+09:00')),
        scheduledEndTime: admin.firestore.Timestamp.fromDate(new Date('2025-08-22T18:00:00+09:00')),
        date: '2025-08-22',
        role: 'floor',
        description: '08-22 floor 13:00-18:00 (5시간) - 스태프탭 실제 시간으로 수정'
      },
      {
        id: `${jobPostingId}_${staffId}_2025-08-23`,
        scheduledStartTime: admin.firestore.Timestamp.fromDate(new Date('2025-08-23T13:00:00+09:00')),
        scheduledEndTime: admin.firestore.Timestamp.fromDate(new Date('2025-08-23T18:00:00+09:00')),
        date: '2025-08-23',
        role: 'dealer',
        description: '08-23 dealer 13:00-18:00 (5시간) - 스태프탭 실제 시간으로 수정'
      }
    ];
    
    console.log('📊 수정할 WorkLog 데이터:', fixData.length, '건');
    
    // 각 WorkLog 업데이트
    for (const data of fixData) {
      const docRef = db.collection('workLogs').doc(data.id);
      
      try {
        // 기존 문서 확인
        const doc = await docRef.get();
        if (!doc.exists) {
          console.log(`⚠️ WorkLog 문서를 찾을 수 없음: ${data.id}`);
          continue;
        }
        
        const existingData = doc.data();
        console.log(`\n🔍 기존 데이터 (${data.date} ${data.role}):`);
        console.log('  - 기존 시작:', existingData.scheduledStartTime?.toDate?.()?.toLocaleString('ko-KR') || 'null');
        console.log('  - 기존 종료:', existingData.scheduledEndTime?.toDate?.()?.toLocaleString('ko-KR') || 'null');
        console.log('  - 새 시작:', data.scheduledStartTime.toDate().toLocaleString('ko-KR'));
        console.log('  - 새 종료:', data.scheduledEndTime.toDate().toLocaleString('ko-KR'));
        
        // 업데이트 데이터 준비
        const updateData = {
          scheduledStartTime: data.scheduledStartTime,
          scheduledEndTime: data.scheduledEndTime,
          updatedAt: admin.firestore.Timestamp.now(),
          // 메모 추가
          fixNote: data.description
        };
        
        await docRef.update(updateData);
        console.log(`✅ 업데이트 완료: ${data.id}`);
        
      } catch (error) {
        console.error(`❌ 업데이트 실패 ${data.id}:`, error.message);
      }
    }
    
    console.log('\n🎉 WorkLog 시간 데이터 수정 완료!');
    
    // 수정 결과 확인
    console.log('\n📋 수정 결과 확인:');
    const workLogsRef = db.collection('workLogs')
      .where('eventId', '==', jobPostingId)
      .where('staffId', '==', staffId);
    
    const snapshot = await workLogsRef.get();
    snapshot.forEach(doc => {
      const data = doc.data();
      const start = data.scheduledStartTime?.toDate?.()?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || 'null';
      const end = data.scheduledEndTime?.toDate?.()?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) || 'null';
      console.log(`  - ${data.date}: ${start}-${end} (역할: ${data.role || 'unknown'})`);
    });
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  fixWorkLogTimes()
    .then(() => {
      console.log('스크립트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('스크립트 오류:', error);
      process.exit(1);
    });
}

module.exports = { fixWorkLogTimes };
const admin = require('firebase-admin');
const serviceAccount = require('./t-holdem-firebase-adminsdk-v4p2h-17b0754402.json');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function restoreOriginalDates() {
  console.log('🔍 WorkLog 날짜를 원래 공고 날짜로 복원 중...');
  
  try {
    // 1/21로 변경했던 workLogs 찾기
    const workLogsRef = db.collection('workLogs');
    const snapshot = await workLogsRef.where('date', '==', '2025-01-21').get();
    
    if (snapshot.empty) {
      console.log('2025-01-21 날짜의 workLog가 없습니다');
      
      // 모든 workLog 확인
      const allSnapshot = await workLogsRef.limit(10).get();
      console.log('\n현재 workLogs (최대 10개):');
      allSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: date=${data.date}, role=${data.role}`);
      });
      return;
    }
    
    console.log(`찾은 workLog 수: ${snapshot.size}개`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docId = doc.id;
      
      console.log(`\n처리 중: ${docId}`);
      console.log('현재 데이터:', {
        date: data.date,
        staffName: data.staffName,
        role: data.role
      });
      
      // ID에서 원래 날짜 추출 (ID 형식: eventId_staffId_date)
      // 예: jVMSkq5BIYYvlrgyk0am_tURgdOBmtYfO5Bgzm8NyGKGtbL12_2025-08-21
      const idParts = docId.split('_');
      const originalDate = idParts[idParts.length - 1]; // 마지막 부분이 날짜
      
      if (originalDate && originalDate.includes('2025-')) {
        // 원래 날짜로 복원
        console.log(`날짜 복원: ${data.date} → ${originalDate}`);
        
        // 날짜 업데이트
        batch.update(doc.ref, {
          date: originalDate
        });
        
        // 시간도 해당 날짜에 맞게 업데이트 (필요한 경우)
        if (data.scheduledStartTime && data.scheduledEndTime) {
          const [year, month, day] = originalDate.split('-').map(Number);
          
          // 기존 시간 정보 유지하면서 날짜만 변경
          const oldStart = data.scheduledStartTime.toDate();
          const oldEnd = data.scheduledEndTime.toDate();
          
          const newStartTime = admin.firestore.Timestamp.fromDate(
            new Date(year, month - 1, day, oldStart.getHours(), oldStart.getMinutes(), 0)
          );
          const newEndTime = admin.firestore.Timestamp.fromDate(
            new Date(year, month - 1, day, oldEnd.getHours(), oldEnd.getMinutes(), 0)
          );
          
          batch.update(doc.ref, {
            scheduledStartTime: newStartTime,
            scheduledEndTime: newEndTime
          });
          
          console.log('시간 업데이트:', {
            startTime: `${oldStart.getHours()}:${oldStart.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${oldEnd.getHours()}:${oldEnd.getMinutes().toString().padStart(2, '0')}`
          });
        }
        
        updateCount++;
      } else {
        console.log('ID에서 날짜를 찾을 수 없음, 건너뜀');
      }
    }
    
    if (updateCount > 0) {
      // 배치 커밋
      await batch.commit();
      console.log(`\n✅ ${updateCount}개의 workLog 날짜가 원래대로 복원되었습니다`);
      
      // 변경 확인
      console.log('\n🔍 복원 결과 확인...');
      const verifySnapshot = await workLogsRef.where('date', '==', '2025-08-21').get();
      
      console.log(`2025-08-21 날짜의 workLog: ${verifySnapshot.size}개`);
      verifySnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n복원된 workLog: ${doc.id}`);
        console.log('데이터:', {
          date: data.date,
          staffName: data.staffName,
          role: data.role,
          scheduledStartTime: data.scheduledStartTime?.toDate?.()?.toLocaleString('ko-KR'),
          scheduledEndTime: data.scheduledEndTime?.toDate?.()?.toLocaleString('ko-KR')
        });
      });
    } else {
      console.log('\n복원할 데이터가 없습니다');
    }
    
  } catch (error) {
    console.error('날짜 복원 중 오류:', error);
  } finally {
    process.exit();
  }
}

// 실행
restoreOriginalDates();
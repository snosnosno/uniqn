// 정산탭에서 브라우저 콘솔에 붙여넣을 디버깅 코드

// Firebase Firestore에서 직접 WorkLog 데이터 조회
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

async function debugWorkLogs() {
  try {
    const workLogsRef = collection(db, 'workLogs');
    const snapshot = await getDocs(workLogsRef);
    
    console.log('=== WorkLog 데이터 디버깅 ===');
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`\n🔥 WorkLog ID: ${doc.id}`);
      console.log('Raw data:', data);
      
      if (data.scheduledStartTime) {
        console.log('scheduledStartTime:', data.scheduledStartTime);
        console.log('scheduledStartTime type:', typeof data.scheduledStartTime);
        console.log('scheduledStartTime constructor:', data.scheduledStartTime.constructor.name);
        
        if (data.scheduledStartTime.toDate) {
          try {
            const date = data.scheduledStartTime.toDate();
            console.log('toDate() result:', date);
          } catch (error) {
            console.error('toDate() error:', error);
          }
        }
        
        if (data.scheduledStartTime.seconds) {
          console.log('seconds property:', data.scheduledStartTime.seconds);
        }
      }
      
      if (data.scheduledEndTime) {
        console.log('scheduledEndTime:', data.scheduledEndTime);
        console.log('scheduledEndTime type:', typeof data.scheduledEndTime);
        console.log('scheduledEndTime constructor:', data.scheduledEndTime.constructor.name);
      }
    });
  } catch (error) {
    console.error('WorkLog 데이터 조회 실패:', error);
  }
}

// 실행
debugWorkLogs();
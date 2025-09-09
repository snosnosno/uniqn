// Firebase Admin SDK로 Firestore의 workLogs 컬렉션 확인
const admin = require('firebase-admin');

// Firebase Admin SDK 초기화 (로컬 emulator 사용)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'tholdem-ebc18'
  });
  
  // Firestore 에뮬레이터 설정 (로컬 개발용)
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

const db = admin.firestore();

async function checkWorkLogs() {
  try {
    console.log('🔍 workLogs 컬렉션 확인 중...\n');
    
    // workLogs 컬렉션의 모든 문서 조회
    const workLogsSnapshot = await db.collection('workLogs').limit(10).get();
    
    if (workLogsSnapshot.empty) {
      console.log('❌ workLogs 컬렉션에 문서가 없습니다.');
      console.log('   지원자 확정을 통해 WorkLog를 생성해보세요.');
    } else {
      console.log(`✅ workLogs 컬렉션에 ${workLogsSnapshot.size}개 문서 발견:`);
      console.log('='.repeat(50));
      
      workLogsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`📄 문서 ID: ${doc.id}`);
        console.log(`   staffId: ${data.staffId}`);
        console.log(`   eventId: ${data.eventId}`);
        console.log(`   staffName: ${data.staffName}`);
        console.log(`   date: ${data.date}`);
        console.log(`   status: ${data.status}`);
        console.log(`   staffInfo: ${data.staffInfo ? '있음' : '없음'}`);
        console.log(`   assignmentInfo: ${data.assignmentInfo ? '있음' : '없음'}`);
        console.log(`   생성시간: ${data.createdAt ? data.createdAt.toDate() : '미설정'}`);
        console.log('   ' + '-'.repeat(30));
      });
    }
    
    // 추가: 다른 컬렉션들도 확인
    console.log('\n🔍 다른 컬렉션들도 확인해보겠습니다...\n');
    
    // jobPostings 컬렉션 확인
    const jobPostingsSnapshot = await db.collection('jobPostings').limit(5).get();
    console.log(`📋 jobPostings: ${jobPostingsSnapshot.size}개 문서`);
    
    // applications 컬렉션 확인
    const applicationsSnapshot = await db.collection('applications').limit(5).get();
    console.log(`📝 applications: ${applicationsSnapshot.size}개 문서`);
    
    // users 컬렉션 확인
    const usersSnapshot = await db.collection('users').limit(5).get();
    console.log(`👤 users: ${usersSnapshot.size}개 문서`);
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    
    if (error.code === 'unavailable') {
      console.log('\n💡 해결 방법:');
      console.log('1. Firebase 에뮬레이터가 실행 중인지 확인하세요');
      console.log('2. 또는 실제 Firebase 프로덕션 데이터베이스에 연결하려면');
      console.log('   Service Account 키가 필요합니다');
    }
  } finally {
    process.exit(0);
  }
}

console.log('🚀 T-HOLDEM Firestore 데이터 확인 도구');
console.log('='.repeat(40));
checkWorkLogs();
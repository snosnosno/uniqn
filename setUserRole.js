const admin = require('firebase-admin');

// Firebase Admin SDK 초기화
const serviceAccount = {
  // Firebase Console -> Project Settings -> Service Accounts에서 키 생성 필요
  // 여기서는 환경변수나 키 파일 사용
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'tholdem-ebc18'
  });
}

async function listUsers() {
  try {
    console.log('📋 현재 등록된 사용자 목록:');
    const listUsersResult = await admin.auth().listUsers(10);
    
    listUsersResult.users.forEach((userRecord) => {
      console.log(`\n🔍 사용자 정보:`);
      console.log(`  UID: ${userRecord.uid}`);
      console.log(`  Email: ${userRecord.email}`);
      console.log(`  Name: ${userRecord.displayName || '미설정'}`);
      console.log(`  Custom Claims:`, userRecord.customClaims || '없음');
    });
  } catch (error) {
    console.error('❌ 사용자 목록 조회 실패:', error);
  }
}

async function setUserRole(email, role) {
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log(`\n🎯 사용자 ${email}에 role '${role}' 설정 중...`);
    
    // Custom Claims 설정
    await admin.auth().setCustomUserClaims(userRecord.uid, { role });
    
    // Firestore의 users 컬렉션에도 업데이트
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      role,
      email,
      name: userRecord.displayName || email.split('@')[0],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    console.log(`✅ 성공: ${email}의 role이 '${role}'로 설정되었습니다.`);
    
    // 확인
    const updatedUser = await admin.auth().getUser(userRecord.uid);
    console.log(`🔍 확인: Custom Claims =`, updatedUser.customClaims);
    
  } catch (error) {
    console.error(`❌ Role 설정 실패:`, error);
  }
}

// 사용법
console.log('🚀 T-HOLDEM 사용자 Role 설정 도구');
console.log('='.repeat(40));

// 먼저 사용자 목록 확인
listUsers().then(() => {
  console.log('\n📝 사용자 role 설정 방법:');
  console.log('  node setUserRole.js set your-email@example.com admin');
  console.log('  node setUserRole.js set your-email@example.com manager');
  
  // 명령행 인수 확인
  const args = process.argv.slice(2);
  if (args.length === 3 && args[0] === 'set') {
    const [action, email, role] = args;
    if (['admin', 'manager', 'staff'].includes(role)) {
      setUserRole(email, role).then(() => {
        console.log('\n🏁 작업 완료!');
        process.exit(0);
      });
    } else {
      console.log('❌ 올바른 role을 입력하세요: admin, manager, staff');
      process.exit(1);
    }
  }
});
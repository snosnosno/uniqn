/**
 * 독립 에뮬레이터 시딩 스크립트
 *
 * 로컬에서 Firebase Emulator에 테스트 데이터를 시딩할 때 사용:
 *   npx ts-node e2e/scripts/seed-emulator.ts
 *
 * 전제: firebase emulators:start가 이미 실행 중이어야 합니다.
 */
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { TEST_ACCOUNTS, createTestProfile } from '../fixtures/test-accounts';

const EMULATOR_PROJECT_ID = 'tholdem-ebc18';

async function seedEmulator() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

  const app = initializeApp({ projectId: EMULATOR_PROJECT_ID });
  const adminAuth = getAuth(app);
  const adminDb = getFirestore(app);

  // 에뮬레이터 연결 확인
  try {
    await adminAuth.listUsers(1);
  } catch (error) {
    console.error('Firebase Emulator에 연결할 수 없습니다.');
    console.error('먼저 에뮬레이터를 시작하세요: firebase emulators:start');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const [roleName, account] of Object.entries(TEST_ACCOUNTS)) {
    try {
      await adminAuth.getUser(account.uid);
      console.log(`[SKIP] ${roleName} (${account.email}) — 이미 존재`);
      skipped++;
    } catch {
      await adminAuth.createUser({
        uid: account.uid,
        email: account.email,
        password: account.password,
        displayName: account.displayName,
        phoneNumber: account.phoneNumber,
        emailVerified: true,
      });
      console.log(`[CREATE] ${roleName} (${account.email})`);
      created++;
    }

    await adminAuth.setCustomUserClaims(account.uid, { role: account.role });

    const profile = createTestProfile(account);
    await adminDb.collection('users').doc(account.uid).set(profile, { merge: true });
    console.log(`[PROFILE] ${roleName} Firestore 프로필 시딩 완료`);
  }

  console.log(`\n시딩 완료: ${created}개 생성, ${skipped}개 스킵`);

  await deleteApp(app);
}

seedEmulator().catch((error) => {
  console.error('시딩 실패:', error);
  process.exit(1);
});

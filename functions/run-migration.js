/**
 * Phase 2 마이그레이션 실행 스크립트
 *
 * 사용법:
 * 1. cd functions
 * 2. node run-migration.js verify     # 검증
 * 3. node run-migration.js dryrun     # 테스트 실행
 * 4. node run-migration.js migrate    # 실제 실행
 */

const admin = require('firebase-admin');
const { migrateEventIdToJobPostingId, verifyMigration } = require('./lib/migrations/migrateEventIdToJobPostingId');

// Firebase Admin 초기화
// 방법 1: Service Account Key 파일 사용 (권장)
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   projectId: 'tholdem-ebc18'
// });

// 방법 2: gcloud auth application-default login 후 실행
// gcloud auth application-default login --project=tholdem-ebc18

// 방법 3: Firebase Emulator 사용 (로컬 테스트)
// 환경변수: FIRESTORE_EMULATOR_HOST=localhost:8080

admin.initializeApp({
  projectId: 'tholdem-ebc18',
  credential: admin.credential.applicationDefault()
});

async function run() {
  const command = process.argv[2] || 'verify';

  console.log('='.repeat(60));
  console.log(`Phase 2 Migration: eventId → jobPostingId`);
  console.log(`Command: ${command}`);
  console.log('='.repeat(60));
  console.log();

  try {
    switch (command) {
      case 'verify':
        console.log('마이그레이션 현황 확인 중...\n');
        const verifyResult = await verifyMigration();

        console.log('결과:');
        console.log(`  workLogs:`);
        console.log(`    - 전체: ${verifyResult.workLogs.total}개`);
        console.log(`    - jobPostingId 있음: ${verifyResult.workLogs.withJobPostingId}개`);
        console.log(`    - 마이그레이션 필요: ${verifyResult.workLogs.missing}개`);
        console.log(`  eventQRCodes:`);
        console.log(`    - 전체: ${verifyResult.eventQRCodes.total}개`);
        console.log(`    - jobPostingId 있음: ${verifyResult.eventQRCodes.withJobPostingId}개`);
        console.log(`    - 마이그레이션 필요: ${verifyResult.eventQRCodes.missing}개`);
        console.log();
        console.log(verifyResult.success
          ? '✅ 모든 문서가 마이그레이션 완료되었습니다.'
          : '⚠️  마이그레이션이 필요합니다. "node run-migration.js dryrun" 으로 테스트하세요.');
        break;

      case 'dryrun':
        console.log('DRY RUN 모드로 마이그레이션 테스트 중...\n');
        const dryRunResult = await migrateEventIdToJobPostingId(true, 500);

        console.log('DRY RUN 결과:');
        console.log(`  workLogs: ${dryRunResult.workLogs.totalUpdated}개 업데이트 예정`);
        console.log(`  eventQRCodes: ${dryRunResult.eventQRCodes.totalUpdated}개 업데이트 예정`);
        console.log(`  소요 시간: ${dryRunResult.totalDuration}ms`);
        console.log();
        console.log('실제 마이그레이션을 실행하려면 "node run-migration.js migrate" 를 실행하세요.');
        break;

      case 'migrate':
        console.log('⚠️  실제 마이그레이션을 실행합니다...\n');
        const migrateResult = await migrateEventIdToJobPostingId(false, 500);

        console.log('마이그레이션 결과:');
        console.log(`  성공: ${migrateResult.success}`);
        console.log(`  workLogs:`);
        console.log(`    - 처리: ${migrateResult.workLogs.totalProcessed}개`);
        console.log(`    - 업데이트: ${migrateResult.workLogs.totalUpdated}개`);
        console.log(`    - 스킵: ${migrateResult.workLogs.totalSkipped}개`);
        console.log(`    - 에러: ${migrateResult.workLogs.errors.length}개`);
        console.log(`  eventQRCodes:`);
        console.log(`    - 처리: ${migrateResult.eventQRCodes.totalProcessed}개`);
        console.log(`    - 업데이트: ${migrateResult.eventQRCodes.totalUpdated}개`);
        console.log(`    - 스킵: ${migrateResult.eventQRCodes.totalSkipped}개`);
        console.log(`    - 에러: ${migrateResult.eventQRCodes.errors.length}개`);
        console.log(`  소요 시간: ${migrateResult.totalDuration}ms`);
        console.log();
        console.log(migrateResult.success
          ? '✅ 마이그레이션이 완료되었습니다!'
          : '❌ 마이그레이션 중 에러가 발생했습니다.');
        break;

      default:
        console.log('사용법:');
        console.log('  node run-migration.js verify   - 마이그레이션 현황 확인');
        console.log('  node run-migration.js dryrun   - 테스트 실행 (실제 변경 없음)');
        console.log('  node run-migration.js migrate  - 실제 마이그레이션 실행');
    }
  } catch (error) {
    console.error('에러 발생:', error);
    process.exit(1);
  }

  process.exit(0);
}

run();

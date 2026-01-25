/**
 * Firestore 직접 마이그레이션 (Firebase CLI 토큰 사용)
 *
 * eventId → jobPostingId 필드 복사
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'tholdem-ebc18';

function getFirebaseToken() {
  const possiblePaths = [
    path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
  ];

  for (const configPath of possiblePaths) {
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.tokens && config.tokens.access_token) {
          return config.tokens.access_token;
        }
      }
    } catch (e) {
      // continue
    }
  }
  return null;
}

function makeRequest(method, url, accessToken, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getDocuments(collectionId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=1000`;
  const result = await makeRequest('GET', url, accessToken);
  return result.data.documents || [];
}

async function updateDocument(docPath, updates, accessToken) {
  // docPath: projects/tholdem-ebc18/databases/(default)/documents/workLogs/xxx
  const url = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=jobPostingId`;

  const body = {
    fields: {
      jobPostingId: updates.jobPostingId
    }
  };

  return makeRequest('PATCH', url, accessToken, body);
}

async function migrateCollection(collectionId, accessToken, dryRun) {
  console.log(`\n${collectionId} 컬렉션 마이그레이션 ${dryRun ? '(DRY RUN)' : '(실제 실행)'}...`);

  const docs = await getDocuments(collectionId, accessToken);
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of docs) {
    const docId = doc.name.split('/').pop();
    const fields = doc.fields || {};

    // 이미 jobPostingId가 있으면 스킵
    if (fields.jobPostingId) {
      skipped++;
      continue;
    }

    // eventId가 없으면 스킵
    if (!fields.eventId) {
      console.log(`  [스킵] ${docId}: eventId 없음`);
      skipped++;
      continue;
    }

    const eventIdValue = fields.eventId.stringValue;

    if (dryRun) {
      console.log(`  [DRY RUN] ${docId}: eventId(${eventIdValue}) → jobPostingId`);
      updated++;
    } else {
      try {
        const result = await updateDocument(doc.name, {
          jobPostingId: { stringValue: eventIdValue }
        }, accessToken);

        if (result.status === 200) {
          console.log(`  [완료] ${docId}: jobPostingId = ${eventIdValue}`);
          updated++;
        } else {
          console.log(`  [에러] ${docId}: ${JSON.stringify(result.data)}`);
          errors++;
        }
      } catch (e) {
        console.log(`  [에러] ${docId}: ${e.message}`);
        errors++;
      }
    }
  }

  return { total: docs.length, updated, skipped, errors };
}

async function main() {
  const dryRun = process.argv[2] !== 'migrate';

  console.log('='.repeat(60));
  console.log('Phase 2 마이그레이션: eventId → jobPostingId');
  console.log(dryRun ? '모드: DRY RUN (실제 변경 없음)' : '모드: 실제 마이그레이션');
  console.log('='.repeat(60));

  const token = getFirebaseToken();
  if (!token) {
    console.log('\nFirebase CLI 토큰을 찾을 수 없습니다.');
    console.log('firebase login 후 다시 시도하세요.');
    return;
  }

  console.log('\n토큰 확인됨, 마이그레이션 시작...');

  // workLogs 마이그레이션
  const workLogsResult = await migrateCollection('workLogs', token, dryRun);

  // eventQRCodes 마이그레이션
  const qrResult = await migrateCollection('eventQRCodes', token, dryRun);

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('마이그레이션 결과 요약');
  console.log('='.repeat(60));
  console.log(`\nworkLogs:`);
  console.log(`  총 문서: ${workLogsResult.total}`);
  console.log(`  업데이트: ${workLogsResult.updated}`);
  console.log(`  스킵: ${workLogsResult.skipped}`);
  console.log(`  에러: ${workLogsResult.errors}`);

  console.log(`\neventQRCodes:`);
  console.log(`  총 문서: ${qrResult.total}`);
  console.log(`  업데이트: ${qrResult.updated}`);
  console.log(`  스킵: ${qrResult.skipped}`);
  console.log(`  에러: ${qrResult.errors}`);

  if (dryRun) {
    console.log('\n실제 마이그레이션을 실행하려면:');
    console.log('  node run-migration-direct.js migrate');
  } else {
    console.log('\n마이그레이션 완료!');
  }
}

main().catch(console.error);

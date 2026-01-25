/**
 * Firebase Cloud Functions 호출 스크립트
 * Firebase CLI 로그인 상태에서 실행
 */

const { execSync } = require('child_process');
const https = require('https');

const PROJECT_ID = 'tholdem-ebc18';
const REGION = 'us-central1';

async function getAccessToken() {
  try {
    // Firebase CLI에서 access token 가져오기
    const result = execSync('npx firebase-tools login:ci --no-localhost 2>/dev/null || echo ""', {
      encoding: 'utf8',
      timeout: 5000
    });
    return result.trim();
  } catch {
    return null;
  }
}

async function callFunction(functionName, data = {}) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ data });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const command = process.argv[2] || 'verify';

  console.log('='.repeat(60));
  console.log('Phase 2 Migration via Cloud Functions');
  console.log(`Command: ${command}`);
  console.log('='.repeat(60));
  console.log();

  try {
    switch (command) {
      case 'verify':
        console.log('verifyEventIdMigrationStatus 호출 중...');
        const verifyResult = await callFunction('verifyEventIdMigrationStatus');
        console.log('결과:', JSON.stringify(verifyResult, null, 2));
        break;

      case 'dryrun':
        console.log('runEventIdMigration (dryRun=true) 호출 중...');
        const dryRunResult = await callFunction('runEventIdMigration', { dryRun: true, batchSize: 500 });
        console.log('결과:', JSON.stringify(dryRunResult, null, 2));
        break;

      case 'migrate':
        console.log('runEventIdMigration (dryRun=false) 호출 중...');
        const migrateResult = await callFunction('runEventIdMigration', { dryRun: false, batchSize: 500 });
        console.log('결과:', JSON.stringify(migrateResult, null, 2));
        break;

      default:
        console.log('Usage: node call-migration.js [verify|dryrun|migrate]');
    }
  } catch (error) {
    console.error('에러:', error.message);
  }
}

main();

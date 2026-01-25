/**
 * Firestore 직접 조회 (Firebase CLI 토큰 사용)
 */

const { execSync } = require('child_process');
const https = require('https');

const PROJECT_ID = 'tholdem-ebc18';

function getFirebaseToken() {
  const fs = require('fs');
  const path = require('path');

  // 가능한 경로들
  const possiblePaths = [
    path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
  ];

  for (const configPath of possiblePaths) {
    try {
      if (fs.existsSync(configPath)) {
        console.log('설정 파일 찾음:', configPath);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.tokens && config.tokens.access_token) {
          return config.tokens.access_token;
        }
      }
    } catch (e) {
      console.error('파일 읽기 실패:', configPath, e.message);
    }
  }
  return null;
}

async function queryFirestore(collectionId, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionId}?pageSize=1000`;

  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ error: body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('Firestore 마이그레이션 현황 확인');
  console.log('='.repeat(60));
  console.log();

  const token = getFirebaseToken();
  if (!token) {
    console.log('Firebase CLI 토큰을 찾을 수 없습니다.');
    console.log('firebase login 후 다시 시도하세요.');
    return;
  }

  console.log('토큰 확인됨, Firestore 조회 중...\n');

  // workLogs 조회
  console.log('workLogs 컬렉션 확인...');
  const workLogsResult = await queryFirestore('workLogs', token);

  if (workLogsResult.error) {
    console.log('workLogs 조회 에러:', workLogsResult.error);
  } else {
    const docs = workLogsResult.documents || [];
    let withJobPostingId = 0;
    let withEventId = 0;

    for (const doc of docs) {
      if (doc.fields?.jobPostingId) withJobPostingId++;
      if (doc.fields?.eventId) withEventId++;
    }

    console.log(`  총 문서: ${docs.length}`);
    console.log(`  jobPostingId 있음: ${withJobPostingId}`);
    console.log(`  eventId 있음: ${withEventId}`);
    console.log(`  마이그레이션 필요: ${withEventId - withJobPostingId}`);
  }

  console.log();

  // eventQRCodes 조회
  console.log('eventQRCodes 컬렉션 확인...');
  const qrResult = await queryFirestore('eventQRCodes', token);

  if (qrResult.error) {
    console.log('eventQRCodes 조회 에러:', qrResult.error);
  } else {
    const docs = qrResult.documents || [];
    let withJobPostingId = 0;
    let withEventId = 0;

    for (const doc of docs) {
      if (doc.fields?.jobPostingId) withJobPostingId++;
      if (doc.fields?.eventId) withEventId++;
    }

    console.log(`  총 문서: ${docs.length}`);
    console.log(`  jobPostingId 있음: ${withJobPostingId}`);
    console.log(`  eventId 있음: ${withEventId}`);
    console.log(`  마이그레이션 필요: ${withEventId - withJobPostingId}`);
  }
}

main().catch(console.error);

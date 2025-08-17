/**
 * Firebase Firestore 백업 스크립트 (Admin SDK 버전)
 * 
 * 이 스크립트는 Firebase Admin SDK를 사용하여 Firestore의 모든 데이터를 JSON 파일로 백업합니다.
 * 서비스 계정 키 파일이 필요합니다.
 * 
 * 실행 방법:
 * npm run backup:admin [--collections=staff,workLogs] [--output=./backup]
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 환경 변수 로드 (app2/.env 파일에서)
dotenv.config({ path: path.resolve(__dirname, '../../app2/.env') });

// Firebase Admin 초기화
// 서비스 계정 키 파일 경로
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
  path.resolve(__dirname, '../t-holdem-firebase-adminsdk-v4p2h-17b0754402.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌ Service account key file not found at: ${serviceAccountPath}`);
  console.error('Please download the service account key from Firebase Console:');
  console.error('1. Go to Project Settings > Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save the file as firebase-service-account.json in the project root');
  console.error('4. Add to .gitignore to prevent committing sensitive data');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const collectionsArg = args.find(arg => arg.startsWith('--collections='));
const outputArg = args.find(arg => arg.startsWith('--output='));

// 백업할 컬렉션 목록
const COLLECTIONS = collectionsArg 
  ? collectionsArg.split('=')[1].split(',')
  : [
    'staff',
    'workLogs',
    'attendanceRecords',
    'jobPostings',
    'applications',
    'users',
    'jobPostingTemplates',
    'tables',
    'participants',
    'tournaments',
    'events',
    'payrollCalculations',
    'ratings'
  ];

// 백업 출력 디렉토리
const OUTPUT_DIR = outputArg 
  ? outputArg.split('=')[1]
  : path.join(__dirname, '../../backup', new Date().toISOString().split('T')[0]);

// 로깅 헬퍼
const log = {
  info: (msg: string, data?: any) => {
    console.log(`[INFO] ${msg}`, data || '');
  },
  success: (msg: string, data?: any) => {
    console.log(`✅ [SUCCESS] ${msg}`, data || '');
  },
  error: (msg: string, error?: any) => {
    console.error(`❌ [ERROR] ${msg}`, error || '');
  },
  warn: (msg: string, data?: any) => {
    console.warn(`⚠️ [WARN] ${msg}`, data || '');
  }
};

/**
 * Timestamp를 문자열로 변환
 */
function serializeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (data._seconds !== undefined && data._nanoseconds !== undefined) {
    // Firestore Timestamp
    return {
      _type: 'timestamp',
      value: new Date(data._seconds * 1000 + data._nanoseconds / 1000000).toISOString()
    };
  }
  
  if (data instanceof Date) {
    // JavaScript Date
    return {
      _type: 'date',
      value: data.toISOString()
    };
  }
  
  if (Array.isArray(data)) {
    // 배열
    return data.map(item => serializeData(item));
  }
  
  if (typeof data === 'object') {
    // 중첩된 객체
    const serialized: any = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeData(value);
    }
    return serialized;
  }
  
  // 기본 타입
  return data;
}

/**
 * 컬렉션 백업
 */
async function backupCollection(collectionName: string): Promise<number> {
  try {
    log.info(`Backing up collection: ${collectionName}`);
    
    const collRef = db.collection(collectionName);
    const snapshot = await collRef.get();
    
    const documents: any[] = [];
    
    snapshot.forEach(doc => {
      const data = serializeData(doc.data());
      documents.push({
        id: doc.id,
        data: data
      });
    });
    
    // 백업 디렉토리 생성
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    // JSON 파일로 저장
    const filePath = path.join(OUTPUT_DIR, `${collectionName}.json`);
    fs.writeFileSync(
      filePath, 
      JSON.stringify(documents, null, 2),
      'utf-8'
    );
    
    log.success(`Backed up ${documents.length} documents from ${collectionName} to ${filePath}`);
    return documents.length;
    
  } catch (error) {
    log.error(`Failed to backup ${collectionName}:`, error);
    throw error;
  }
}

/**
 * 백업 메타데이터 생성
 */
function createBackupMetadata(results: any): void {
  const metadata = {
    timestamp: new Date().toISOString(),
    projectId: serviceAccount.project_id,
    collections: results,
    totalDocuments: Object.values(results).reduce((sum: number, count: any) => sum + count, 0)
  };
  
  const metadataPath = path.join(OUTPUT_DIR, 'backup-metadata.json');
  fs.writeFileSync(
    metadataPath,
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );
  
  log.success(`Backup metadata saved to ${metadataPath}`);
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    log.info('='.repeat(50));
    log.info('Firebase Firestore Backup Script (Admin SDK)');
    log.info(`Project: ${serviceAccount.project_id}`);
    log.info(`Output Directory: ${OUTPUT_DIR}`);
    log.info(`Collections to backup: ${COLLECTIONS.join(', ')}`);
    log.info('='.repeat(50));
    
    const results: any = {};
    
    // 각 컬렉션 백업
    for (const collectionName of COLLECTIONS) {
      try {
        const docCount = await backupCollection(collectionName);
        results[collectionName] = docCount;
      } catch (error) {
        log.warn(`Skipping ${collectionName} due to error`);
        results[collectionName] = 0;
      }
    }
    
    // 백업 메타데이터 생성
    createBackupMetadata(results);
    
    log.info('='.repeat(50));
    log.success('Backup completed successfully!');
    log.info('Backup Summary:');
    
    for (const [collection, count] of Object.entries(results)) {
      log.info(`  - ${collection}: ${count} documents`);
    }
    
    log.info(`\nBackup saved to: ${OUTPUT_DIR}`);
    
    // Admin SDK 정리
    await admin.app().delete();
    
  } catch (error) {
    log.error('Backup failed:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch(error => {
  log.error('Unexpected error:', error);
  process.exit(1);
});
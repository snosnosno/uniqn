/**
 * Firebase Firestore 복원 스크립트
 * 
 * 이 스크립트는 백업된 JSON 파일에서 Firestore 데이터를 복원합니다.
 * 마이그레이션 실패 시 롤백용으로 사용합니다.
 * 
 * 실행 방법:
 * npm run restore:firestore --backup=./backup/2025-01-15 [--collections=staff,workLogs]
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc,
  setDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 환경 변수 로드 (app2/.env 파일에서)
dotenv.config({ path: path.resolve(__dirname, '../../app2/.env') });

// Firebase 설정
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 명령줄 인자 파싱
const args = process.argv.slice(2);
const backupArg = args.find(arg => arg.startsWith('--backup='));
const collectionsArg = args.find(arg => arg.startsWith('--collections='));
const isDryRun = args.includes('--dry-run');

if (!backupArg) {
  console.error('❌ Backup directory is required. Use --backup=./backup/YYYY-MM-DD');
  process.exit(1);
}

const BACKUP_DIR = backupArg.split('=')[1];
const BATCH_SIZE = 500;

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
 * JSON 데이터를 Firestore 형식으로 역직렬화
 */
function deserializeData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (typeof data === 'object') {
    // Timestamp 복원
    if (data._type === 'timestamp' && data.value) {
      return Timestamp.fromDate(new Date(data.value));
    }
    
    // Date 복원
    if (data._type === 'date' && data.value) {
      return new Date(data.value);
    }
    
    // 배열 처리
    if (Array.isArray(data)) {
      return data.map(item => deserializeData(item));
    }
    
    // 중첩된 객체 처리
    const deserialized: any = {};
    for (const [key, value] of Object.entries(data)) {
      deserialized[key] = deserializeData(value);
    }
    return deserialized;
  }
  
  return data;
}

/**
 * 컬렉션 복원
 */
async function restoreCollection(collectionName: string): Promise<void> {
  try {
    const filePath = path.join(BACKUP_DIR, `${collectionName}.json`);
    
    if (!fs.existsSync(filePath)) {
      log.warn(`Backup file not found: ${filePath}`);
      return;
    }
    
    log.info(`Restoring collection: ${collectionName}`);
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const documents = JSON.parse(fileContent);
    
    if (isDryRun) {
      log.info(`[DRY RUN] Would restore ${documents.length} documents to ${collectionName}`);
      return;
    }
    
    let batch = writeBatch(db);
    let batchCount = 0;
    let totalRestored = 0;
    
    for (const docData of documents) {
      const { id, data } = docData;
      const deserializedData = deserializeData(data);
      
      const docRef = doc(collection(db, collectionName), id);
      batch.set(docRef, deserializedData);
      batchCount++;
      
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        totalRestored += batchCount;
        log.info(`  Restored ${totalRestored}/${documents.length} documents...`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
    
    // 남은 문서 커밋
    if (batchCount > 0) {
      await batch.commit();
      totalRestored += batchCount;
    }
    
    log.success(`Restored ${totalRestored} documents to ${collectionName}`);
    
  } catch (error) {
    log.error(`Failed to restore ${collectionName}:`, error);
    throw error;
  }
}

/**
 * 백업 메타데이터 읽기
 */
function readBackupMetadata(): any {
  const metadataPath = path.join(BACKUP_DIR, 'backup-metadata.json');
  
  if (!fs.existsSync(metadataPath)) {
    log.warn('Backup metadata not found');
    return null;
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  return metadata;
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    log.info('='.repeat(50));
    log.info('Firebase Firestore Restore Script');
    log.info(`Backup Directory: ${BACKUP_DIR}`);
    log.info(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    log.info('='.repeat(50));
    
    // 백업 디렉토리 확인
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error(`Backup directory not found: ${BACKUP_DIR}`);
    }
    
    // 백업 메타데이터 읽기
    const metadata = readBackupMetadata();
    if (metadata) {
      log.info('Backup Information:');
      log.info(`  - Created: ${metadata.timestamp}`);
      log.info(`  - Project: ${metadata.projectId}`);
      log.info(`  - Total Documents: ${metadata.totalDocuments}`);
    }
    
    // 복원할 컬렉션 결정
    let collections: string[];
    
    if (collectionsArg) {
      collections = collectionsArg.split('=')[1].split(',');
    } else if (metadata && metadata.collections) {
      collections = Object.keys(metadata.collections);
    } else {
      // 백업 디렉토리의 JSON 파일 기반
      collections = fs.readdirSync(BACKUP_DIR)
        .filter(file => file.endsWith('.json') && file !== 'backup-metadata.json')
        .map(file => file.replace('.json', ''));
    }
    
    log.info(`Collections to restore: ${collections.join(', ')}`);
    
    if (!isDryRun) {
      const confirm = await new Promise<boolean>((resolve) => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        readline.question(
          '\n⚠️  WARNING: This will overwrite existing data. Continue? (yes/no): ',
          (answer: string) => {
            readline.close();
            resolve(answer.toLowerCase() === 'yes');
          }
        );
      });
      
      if (!confirm) {
        log.info('Restore cancelled by user');
        return;
      }
    }
    
    log.info('');
    
    // 각 컬렉션 복원
    for (const collectionName of collections) {
      try {
        await restoreCollection(collectionName);
      } catch (error) {
        log.error(`Failed to restore ${collectionName}, continuing with others...`);
      }
    }
    
    log.info('='.repeat(50));
    
    if (isDryRun) {
      log.warn('This was a DRY RUN. No actual changes were made.');
      log.info('To perform the actual restore, run without --dry-run flag.');
    } else {
      log.success('Restore completed successfully!');
    }
    
  } catch (error) {
    log.error('Restore failed:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main().catch(error => {
  log.error('Unexpected error:', error);
  process.exit(1);
});
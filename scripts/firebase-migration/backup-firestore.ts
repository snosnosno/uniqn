/**
 * Firebase Firestore 백업 스크립트
 * 
 * 이 스크립트는 Firestore의 모든 데이터를 JSON 파일로 백업합니다.
 * 마이그레이션 전 필수로 실행해야 합니다.
 * 
 * 실행 방법:
 * npm run backup:firestore [--collections=staff,workLogs] [--output=./backup]
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs,
  DocumentData
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

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
  : path.join(process.cwd(), 'backup', new Date().toISOString().split('T')[0]);

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
function serializeData(data: DocumentData): any {
  const serialized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (value.toDate && typeof value.toDate === 'function') {
      // Firestore Timestamp
      serialized[key] = {
        _type: 'timestamp',
        value: value.toDate().toISOString()
      };
    } else if (value instanceof Date) {
      // JavaScript Date
      serialized[key] = {
        _type: 'date',
        value: value.toISOString()
      };
    } else if (Array.isArray(value)) {
      // 배열
      serialized[key] = value.map(item => 
        typeof item === 'object' ? serializeData(item) : item
      );
    } else if (typeof value === 'object') {
      // 중첩된 객체
      serialized[key] = serializeData(value);
    } else {
      // 기본 타입
      serialized[key] = value;
    }
  }
  
  return serialized;
}

/**
 * 컬렉션 백업
 */
async function backupCollection(collectionName: string): Promise<void> {
  try {
    log.info(`Backing up collection: ${collectionName}`);
    
    const collRef = collection(db, collectionName);
    const snapshot = await getDocs(collRef);
    
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
    projectId: firebaseConfig.projectId,
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
    log.info('Firebase Firestore Backup Script');
    log.info(`Output Directory: ${OUTPUT_DIR}`);
    log.info(`Collections to backup: ${COLLECTIONS.join(', ')}`);
    log.info('='.repeat(50));
    
    const results: any = {};
    
    // 각 컬렉션 백업
    for (const collectionName of COLLECTIONS) {
      try {
        await backupCollection(collectionName);
        
        // 백업된 문서 수 기록
        const filePath = path.join(OUTPUT_DIR, `${collectionName}.json`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        results[collectionName] = data.length;
        
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
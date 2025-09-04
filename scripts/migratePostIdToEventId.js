#!/usr/bin/env node

/**
 * Firebase Applications Collection Migration Script
 * postId → eventId 필드 마이그레이션 스크립트
 * 
 * 목적: applications 컬렉션의 postId 필드를 eventId로 통일
 * 안전성: 백업 생성 및 롤백 기능 포함
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Admin SDK 초기화
let serviceAccount;
try {
  serviceAccount = require('./firebase-adminsdk-key.json'); // 서비스 키 경로
} catch (error) {
  console.error('❌ Firebase 서비스 계정 키를 찾을 수 없습니다.');
  console.error('   scripts/firebase-adminsdk-key.json 파일을 배치해주세요.');
  console.error('');
  console.error('📋 Firebase 서비스 계정 키 생성 방법:');
  console.error('   1. Firebase Console → Project Settings → Service accounts');
  console.error('   2. "Generate new private key" 클릭');
  console.error('   3. 다운로드한 JSON 파일을 scripts/firebase-adminsdk-key.json으로 저장');
  console.error('');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'tholdem-ebc18'
});

const db = admin.firestore();

class ApplicationsMigration {
  constructor() {
    this.stats = {
      totalDocuments: 0,
      migratedDocuments: 0,
      skippedDocuments: 0,
      errorDocuments: 0,
      errors: []
    };
    this.backupData = [];
  }

  /**
   * 마이그레이션 실행
   */
  async migrate() {
    console.log('🚀 applications 컬렉션 postId → eventId 마이그레이션 시작');
    console.log('===============================================================');

    try {
      // 1. 현재 상태 분석
      await this.analyzeCurrentState();
      
      // 2. 백업 생성
      await this.createBackup();
      
      // 3. 마이그레이션 실행
      await this.performMigration();
      
      // 4. 결과 리포트
      this.generateReport();
      
    } catch (error) {
      console.error('❌ 마이그레이션 실패:', error);
      throw error;
    }
  }

  /**
   * 현재 컬렉션 상태 분석
   */
  async analyzeCurrentState() {
    console.log('📊 현재 상태 분석 중...');
    
    const snapshot = await db.collection('applications').get();
    this.stats.totalDocuments = snapshot.size;
    
    let postIdCount = 0;
    let eventIdCount = 0;
    let bothFieldsCount = 0;
    let neitherFieldsCount = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const hasPostId = data.hasOwnProperty('postId');
      const hasEventId = data.hasOwnProperty('eventId');
      
      if (hasPostId && hasEventId) {
        bothFieldsCount++;
      } else if (hasPostId) {
        postIdCount++;
      } else if (hasEventId) {
        eventIdCount++;
      } else {
        neitherFieldsCount++;
      }
    });

    console.log(`📈 분석 결과:`);
    console.log(`  - 전체 문서: ${this.stats.totalDocuments}개`);
    console.log(`  - postId만 있음: ${postIdCount}개`);
    console.log(`  - eventId만 있음: ${eventIdCount}개`);
    console.log(`  - 두 필드 모두 있음: ${bothFieldsCount}개`);
    console.log(`  - 두 필드 모두 없음: ${neitherFieldsCount}개`);
    console.log('');
  }

  /**
   * 백업 생성
   */
  async createBackup() {
    console.log('💾 백업 생성 중...');
    
    const snapshot = await db.collection('applications').get();
    
    snapshot.docs.forEach(doc => {
      this.backupData.push({
        id: doc.id,
        data: doc.data()
      });
    });

    // 백업 파일 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `applications_backup_${timestamp}.json`);
    
    fs.writeFileSync(backupPath, JSON.stringify(this.backupData, null, 2), 'utf8');
    console.log(`✅ 백업 완료: ${backupPath}`);
    console.log('');
  }

  /**
   * 마이그레이션 실행
   */
  async performMigration() {
    console.log('🔄 마이그레이션 실행 중...');
    
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore 배치 제한

    const snapshot = await db.collection('applications').get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const docRef = db.collection('applications').doc(doc.id);
      
      try {
        // postId가 있고 eventId가 없는 경우만 마이그레이션
        if (data.hasOwnProperty('postId') && !data.hasOwnProperty('eventId')) {
          // eventId 추가하고 postId 제거
          const updatedData = {
            ...data,
            eventId: data.postId
          };
          delete updatedData.postId;
          
          batch.set(docRef, updatedData);
          this.stats.migratedDocuments++;
          
        } else if (data.hasOwnProperty('postId') && data.hasOwnProperty('eventId')) {
          // 두 필드 모두 있는 경우 - postId만 제거 (eventId 우선)
          const updatedData = { ...data };
          delete updatedData.postId;
          
          batch.set(docRef, updatedData);
          this.stats.migratedDocuments++;
          
        } else {
          // 마이그레이션 불필요
          this.stats.skippedDocuments++;
        }
        
        batchCount++;
        
        // 배치 크기 초과 시 실행
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  📦 배치 ${Math.ceil(this.stats.migratedDocuments / BATCH_SIZE)} 완료`);
          batchCount = 0;
        }
        
      } catch (error) {
        console.error(`❌ 문서 ${doc.id} 처리 실패:`, error);
        this.stats.errorDocuments++;
        this.stats.errors.push({
          documentId: doc.id,
          error: error.message
        });
      }
    }
    
    // 남은 배치 실행
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log('✅ 마이그레이션 완료');
    console.log('');
  }

  /**
   * 결과 리포트 생성
   */
  generateReport() {
    console.log('📋 마이그레이션 결과 리포트');
    console.log('===============================================================');
    console.log(`✅ 성공: ${this.stats.migratedDocuments}개 문서 마이그레이션`);
    console.log(`⏭️  건너뜀: ${this.stats.skippedDocuments}개 문서 (마이그레이션 불필요)`);
    console.log(`❌ 실패: ${this.stats.errorDocuments}개 문서`);
    console.log(`📊 전체: ${this.stats.totalDocuments}개 문서 처리`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n⚠️  오류 상세:');
      this.stats.errors.forEach(error => {
        console.log(`  - 문서 ${error.documentId}: ${error.error}`);
      });
    }
    
    // 리포트 파일 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `migration_report_${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats: this.stats,
      migration: 'postId_to_eventId',
      collection: 'applications'
    }, null, 2), 'utf8');
    
    console.log(`📄 상세 리포트 저장: ${reportPath}`);
    console.log('===============================================================');
  }

  /**
   * 롤백 기능 (필요 시 사용)
   */
  async rollback(backupFilePath) {
    console.log('🔄 롤백 실행 중...');
    
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    const batch = db.batch();
    
    backupData.forEach(item => {
      const docRef = db.collection('applications').doc(item.id);
      batch.set(docRef, item.data);
    });
    
    await batch.commit();
    console.log('✅ 롤백 완료');
  }
}

// 실행부
async function main() {
  const migration = new ApplicationsMigration();
  
  try {
    await migration.migrate();
    console.log('🎉 마이그레이션 성공적으로 완료!');
    process.exit(0);
  } catch (error) {
    console.error('💥 마이그레이션 실패:', error);
    process.exit(1);
  }
}

// 명령행 인수 처리
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
사용법:
  node migratePostIdToEventId.js                    # 마이그레이션 실행
  node migratePostIdToEventId.js --rollback <file>  # 롤백 실행
  node migratePostIdToEventId.js --help            # 도움말

옵션:
  --rollback <file>  백업 파일을 사용하여 롤백
  --help, -h        도움말 표시
`);
  process.exit(0);
}

if (args[0] === '--rollback' && args[1]) {
  const migration = new ApplicationsMigration();
  migration.rollback(args[1])
    .then(() => {
      console.log('✅ 롤백 완료');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 롤백 실패:', error);
      process.exit(1);
    });
} else {
  main();
}

module.exports = ApplicationsMigration;
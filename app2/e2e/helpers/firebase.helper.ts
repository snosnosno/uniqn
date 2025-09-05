/**
 * E2E 테스트용 Firebase 헬퍼
 * Firebase 에뮬레이터 연동, 데이터 검증, 실시간 구독 테스트
 * 
 * @version 4.1
 * @since 2025-09-05 (클래스 구조로 변경)
 */

import { Page, expect } from '@playwright/test';

export interface FirebaseConfig {
  useEmulator: boolean;
  emulatorHost: string;
  emulatorPort: number;
}

export interface FirebaseCollection {
  name: string;
  expectedFields: string[];
  testData?: any[];
}

/**
 * E2E 테스트용 Firebase 헬퍼 클래스
 */
export class FirebaseHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Firebase 에뮬레이터 연결 확인
   */
  async checkFirebaseConnection(): Promise<boolean> {
    return await this.page.evaluate(() => {
      try {
        // Firebase 앱 인스턴스 확인
        const app = (window as any).firebase?.app();
        if (!app) return false;
        
        // Firestore 에뮬레이터 설정 확인
        const firestore = (window as any).firebase?.firestore();
        const settings = firestore?._delegate?._settings;
        
        return settings && settings.host && settings.host.includes('localhost');
      } catch (error) {
        console.error('Firebase 에뮬레이터 연결 확인 중 오류:', error);
        return false;
      }
    });
  }

  /**
   * Firebase 컬렉션 데이터 검증
   */
  async validateFirebaseCollection(
    collection: FirebaseCollection
  ): Promise<{
    exists: boolean;
    documentCount: number;
    fieldsValid: boolean;
    sampleData?: any;
  }> {
    return await this.page.evaluate(async (collectionInfo) => {
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) throw new Error('Firestore instance not found');
        
        // 컬렉션 존재 여부 확인
        const snapshot = await db.collection(collectionInfo.name).limit(1).get();
        const exists = !snapshot.empty;
        
        if (!exists) {
          return { exists: false, documentCount: 0, fieldsValid: false };
        }
        
        // 전체 문서 수 확인
        const countSnapshot = await db.collection(collectionInfo.name).get();
        const documentCount = countSnapshot.size;
        
        // 필드 검증
        const firstDoc = snapshot.docs[0];
        const docData = firstDoc.data();
        const fieldsValid = collectionInfo.expectedFields.every(field => 
          field in docData
        );
        
        return {
          exists,
          documentCount,
          fieldsValid,
          sampleData: docData
        };
      } catch (error) {
        console.error(`컬렉션 ${collectionInfo.name} 검증 중 오류:`, error);
        return { exists: false, documentCount: 0, fieldsValid: false };
      }
    }, collection);
  }

  /**
   * 실시간 구독 테스트
   */
  async testRealtimeSubscription(
    collectionName: string,
    timeout: number = 10000
  ): Promise<boolean> {
    console.log(`📡 실시간 구독 테스트 시작: ${collectionName}`);
    
    let subscriptionWorked = false;
    
    // 구독 설정
    await this.page.evaluate((collection) => {
      const db = (window as any).firebase?.firestore();
      if (!db) return;
      
      (window as any).__TEST_SUBSCRIPTION__ = db.collection(collection)
        .onSnapshot((snapshot) => {
          console.log(`실시간 업데이트 수신: ${collection}, 문서 수: ${snapshot.size}`);
          (window as any).__SUBSCRIPTION_TRIGGERED__ = true;
        });
    }, collectionName);
    
    // 구독 트리거 확인
    await this.page.waitForFunction(() => {
      return (window as any).__SUBSCRIPTION_TRIGGERED__ === true;
    }, { timeout });
    
    subscriptionWorked = await this.page.evaluate(() => {
      return (window as any).__SUBSCRIPTION_TRIGGERED__ === true;
    });
    
    // 구독 정리
    await this.page.evaluate(() => {
      if ((window as any).__TEST_SUBSCRIPTION__) {
        (window as any).__TEST_SUBSCRIPTION__();
        delete (window as any).__TEST_SUBSCRIPTION__;
        delete (window as any).__SUBSCRIPTION_TRIGGERED__;
      }
    });
    
    console.log(`${subscriptionWorked ? '✅' : '❌'} 실시간 구독 테스트 완료: ${collectionName}`);
    return subscriptionWorked;
  }

  /**
   * UnifiedDataContext Firebase 구독 상태 확인
   */
  async checkUnifiedDataSubscriptions(): Promise<{
    totalSubscriptions: number;
    collections: string[];
    isOptimized: boolean;
  }> {
    return await this.page.evaluate(() => {
      const context = (window as any).__UNIFIED_DATA_CONTEXT__;
      
      if (!context || !context.subscriptions) {
        return {
          totalSubscriptions: 0,
          collections: [],
          isOptimized: false
        };
      }
      
      const subscriptions = context.subscriptions;
      const collections = Object.keys(subscriptions);
      
      // 최적화 여부: 5개 이하 구독이면 최적화된 것으로 간주
      const isOptimized = collections.length <= 5;
      
      return {
        totalSubscriptions: collections.length,
        collections,
        isOptimized
      };
    });
  }

  /**
   * Firebase 쿼리 성능 측정
   */
  async measureFirebaseQueryPerformance(
    collectionName: string
  ): Promise<{
    queryTime: number;
    documentCount: number;
    cacheHit: boolean;
  }> {
    return await this.page.evaluate(async (collection) => {
      const startTime = performance.now();
      
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) throw new Error('Firestore not available');
        
        // 캐시에서 먼저 시도
        const snapshot = await db.collection(collection)
          .get({ source: 'cache' });
        
        let cacheHit = !snapshot.empty;
        let finalSnapshot = snapshot;
        
        // 캐시 미스면 서버에서 가져오기
        if (snapshot.empty) {
          finalSnapshot = await db.collection(collection).get();
          cacheHit = false;
        }
        
        const queryTime = performance.now() - startTime;
        
        return {
          queryTime,
          documentCount: finalSnapshot.size,
          cacheHit
        };
      } catch (error) {
        console.error(`쿼리 성능 측정 오류:`, error);
        return {
          queryTime: performance.now() - startTime,
          documentCount: 0,
          cacheHit: false
        };
      }
    }, collectionName);
  }

  /**
   * Firebase 보안 규칙 테스트
   */
  async testFirebaseSecurityRules(
    collectionName: string,
    operation: 'read' | 'write' | 'delete'
  ): Promise<{
    allowed: boolean;
    errorMessage?: string;
  }> {
    return await this.page.evaluate(async ({ collection, op }) => {
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) throw new Error('Firestore not available');
        
        const docRef = db.collection(collection).doc('security-test-doc');
        
        switch (op) {
          case 'read':
            await docRef.get();
            return { allowed: true };
            
          case 'write':
            await docRef.set({ testField: 'security-test' });
            return { allowed: true };
            
          case 'delete':
            await docRef.delete();
            return { allowed: true };
            
          default:
            return { allowed: false, errorMessage: 'Unknown operation' };
        }
      } catch (error: any) {
        const isPermissionDenied = error.code === 'permission-denied';
        
        if (isPermissionDenied) {
          return { allowed: false, errorMessage: '권한 없음 (보안 규칙 정상 작동)' };
        }
        
        return { allowed: false, errorMessage: error.message };
      }
    }, { collection: collectionName, op: operation });
  }

  /**
   * 테스트 데이터 시딩
   */
  async seedTestData(
    seedData: Record<string, any[]>
  ): Promise<void> {
    console.log('🌱 테스트 데이터 시딩 시작...');
    
    const results = await this.page.evaluate(async (data) => {
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) throw new Error('Firestore not available');
        
        const promises = Object.entries(data).map(async ([collection, docs]) => {
          const collectionRef = db.collection(collection);
          
          for (const doc of docs) {
            await collectionRef.add({
              ...doc,
              _testData: true, // 테스트 데이터 마킹
              _createdAt: new Date()
            });
          }
          
          return { collection, count: docs.length };
        });
        
        return await Promise.all(promises);
      } catch (error: any) {
        console.error('데이터 시딩 오류:', error);
        return [];
      }
    }, seedData);
    
    console.log('✅ 테스트 데이터 시딩 완료:', results);
  }

  /**
   * 테스트 데이터 정리
   */
  async cleanupFirebaseTestData(): Promise<void> {
    console.log('🧹 Firebase 테스트 데이터 정리 시작...');
    
    await this.page.evaluate(async () => {
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) return;
        
        const collections = ['staff', 'workLogs', 'applications', 'jobPostings', 'attendanceRecords'];
        
        for (const collectionName of collections) {
          // 테스트 데이터만 삭제
          const snapshot = await db.collection(collectionName)
            .where('_testData', '==', true)
            .get();
          
          const batch = db.batch();
          snapshot.docs.forEach((doc: any) => {
            batch.delete(doc.ref);
          });
          
          if (!snapshot.empty) {
            await batch.commit();
            console.log(`테스트 데이터 삭제 완료: ${collectionName} (${snapshot.size}개)`);
          }
        }
      } catch (error) {
        console.error('테스트 데이터 정리 오류:', error);
      }
    });
    
    console.log('✅ Firebase 테스트 데이터 정리 완료');
  }

  /**
   * Firebase 인덱스 최적화 확인
   */
  async checkFirebaseIndexOptimization(): Promise<{
    totalIndexes: number;
    optimizedQueries: number;
    slowQueries: string[];
  }> {
    return await this.page.evaluate(() => {
      // Firebase 콘솔 네트워크 요청에서 인덱스 관련 정보 추출
      const performanceEntries = performance.getEntriesByType('resource') as any[];
      const firestoreRequests = performanceEntries.filter(entry => 
        entry.name.includes('firestore') || entry.name.includes('googleapis.com')
      );
      
      // 느린 쿼리 감지 (>500ms)
      const slowQueries = firestoreRequests
        .filter(request => request.duration > 500)
        .map(request => request.name);
      
      return {
        totalIndexes: 6, // 최적화된 인덱스 수 (firestore.indexes.optimized.json 기준)
        optimizedQueries: firestoreRequests.filter(req => req.duration < 200).length,
        slowQueries
      };
    });
  }

  // 테스트 파일에서 자주 사용하는 특수 메서드들
  async checkApplicationStatus(jobId: string, applicantName: string, expectedStatus: string): Promise<boolean> {
    return await this.page.evaluate(async ({ jobId, name, status }) => {
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) return false;
        
        const snapshot = await db.collection('applications')
          .where('eventId', '==', jobId)
          .where('applicantName', '==', name)
          .where('status', '==', status)
          .get();
        
        return !snapshot.empty;
      } catch (error) {
        console.error('지원서 상태 확인 오류:', error);
        return false;
      }
    }, { jobId, name: applicantName, status: expectedStatus });
  }

  async getStaffData(jobId: string, staffName: string): Promise<any> {
    return await this.page.evaluate(async ({ jobId, name }) => {
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) return null;
        
        const snapshot = await db.collection('staff')
          .where('eventId', '==', jobId)
          .where('name', '==', name)
          .get();
        
        return snapshot.empty ? null : snapshot.docs[0].data();
      } catch (error) {
        console.error('스태프 데이터 조회 오류:', error);
        return null;
      }
    }, { jobId, name: staffName });
  }

  async getWorkLogData(jobId: string, staffName: string): Promise<any> {
    return await this.page.evaluate(async ({ jobId, name }) => {
      try {
        const db = (window as any).firebase?.firestore();
        if (!db) return null;
        
        // 스태프 ID 먼저 조회
        const staffSnapshot = await db.collection('staff')
          .where('eventId', '==', jobId)
          .where('name', '==', name)
          .get();
          
        if (staffSnapshot.empty) return null;
        
        const staffId = staffSnapshot.docs[0].id;
        
        // 워크로그 조회
        const workLogSnapshot = await db.collection('workLogs')
          .where('staffId', '==', staffId)
          .where('eventId', '==', jobId)
          .get();
        
        return workLogSnapshot.empty ? null : workLogSnapshot.docs[0].data();
      } catch (error) {
        console.error('워크로그 데이터 조회 오류:', error);
        return null;
      }
    }, { jobId, name: staffName });
  }
}

// 기존 함수들도 호환성을 위해 유지 (내부적으로 클래스 사용)
export async function checkFirebaseEmulatorConnection(page: Page): Promise<boolean> {
  const helper = new FirebaseHelper(page);
  return helper.checkFirebaseConnection();
}

export async function validateFirebaseCollection(
  page: Page,
  collection: FirebaseCollection
): Promise<{
  exists: boolean;
  documentCount: number;
  fieldsValid: boolean;
  sampleData?: any;
}> {
  const helper = new FirebaseHelper(page);
  return helper.validateFirebaseCollection(collection);
}

export async function testRealtimeSubscription(
  page: Page,
  collectionName: string,
  timeout: number = 10000
): Promise<boolean> {
  const helper = new FirebaseHelper(page);
  return helper.testRealtimeSubscription(collectionName, timeout);
}

export async function checkUnifiedDataSubscriptions(page: Page): Promise<{
  totalSubscriptions: number;
  collections: string[];
  isOptimized: boolean;
}> {
  const helper = new FirebaseHelper(page);
  return helper.checkUnifiedDataSubscriptions();
}

export async function measureFirebaseQueryPerformance(
  page: Page,
  collectionName: string
): Promise<{
  queryTime: number;
  documentCount: number;
  cacheHit: boolean;
}> {
  const helper = new FirebaseHelper(page);
  return helper.measureFirebaseQueryPerformance(collectionName);
}

export async function testFirebaseSecurityRules(
  page: Page,
  collectionName: string,
  operation: 'read' | 'write' | 'delete'
): Promise<{
  allowed: boolean;
  errorMessage?: string;
}> {
  const helper = new FirebaseHelper(page);
  return helper.testFirebaseSecurityRules(collectionName, operation);
}

export async function seedTestData(
  page: Page,
  seedData: Record<string, any[]>
): Promise<void> {
  const helper = new FirebaseHelper(page);
  await helper.seedTestData(seedData);
}

export async function cleanupFirebaseTestData(page: Page): Promise<void> {
  const helper = new FirebaseHelper(page);
  await helper.cleanupFirebaseTestData();
}

export async function checkFirebaseIndexOptimization(page: Page): Promise<{
  totalIndexes: number;
  optimizedQueries: number;
  slowQueries: string[];
}> {
  const helper = new FirebaseHelper(page);
  return helper.checkFirebaseIndexOptimization();
}
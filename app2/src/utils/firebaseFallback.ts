import { collection, getDocs, query, where, DocumentData } from 'firebase/firestore';

import { db } from '../firebase';

// Firebase 연결 상태 관리
class FirebaseFallbackManager {
  private isConnected = true;
  private retryAttempts = 0;
  private maxRetries = 3;
  private fallbackData = new Map<string, any[]>();

  // Firebase 연결 상태 확인
  public async checkConnection(): Promise<boolean> {
    try {
      // 간단한 쿼리로 연결 테스트
      const testQuery = query(collection(db, 'users'), where('__test__', '==', 'test'));
      await getDocs(testQuery);
      this.isConnected = true;
      this.retryAttempts = 0;
      return true;
    } catch (error) {
      console.warn('Firebase connection check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  // 폴백 데이터 설정
  public setFallbackData(collectionName: string, data: any[]): void {
    this.fallbackData.set(collectionName, data);
  }

  // 폴백 데이터 가져오기
  public getFallbackData(collectionName: string): any[] {
    return this.fallbackData.get(collectionName) || [];
  }

  // 안전한 데이터 가져오기 (Firebase 실패 시 폴백 사용)
  public async safeGetDocs(collectionName: string, filters?: any[]): Promise<any[]> {
    if (!this.isConnected || this.retryAttempts >= this.maxRetries) {
      console.log(`Using fallback data for ${collectionName}`);
      return this.getFallbackData(collectionName);
    }

    try {
      const collectionRef = collection(db, collectionName);
      
      // 필터 적용
      const snapshot = filters && filters.length > 0 
        ? await getDocs(query(collectionRef, ...filters))
        : await getDocs(collectionRef);
        
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 성공 시 폴백 데이터 업데이트
      this.setFallbackData(collectionName, data);
      this.retryAttempts = 0;
      
      return data;
    } catch (error) {
      console.error(`Firebase query failed for ${collectionName}:`, error);
      this.retryAttempts++;
      
      // 폴백 데이터 반환
      return this.getFallbackData(collectionName);
    }
  }

  // 연결 재설정
  public async resetConnection(): Promise<void> {
    console.log('🔄 Resetting Firebase connection...');
    this.retryAttempts = 0;
    
    // 페이지 새로고침으로 완전한 재초기화
    window.location.reload();
  }

  // 연결 상태 확인
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// 싱글톤 인스턴스
export const firebaseFallback = new FirebaseFallbackManager();

// 안전한 데이터 가져오기 함수
export const safeGetDocs = async (collectionName: string, filters?: any[]): Promise<any[]> => {
  return firebaseFallback.safeGetDocs(collectionName, filters);
};

// 연결 상태 확인 함수
export const checkFirebaseConnection = async (): Promise<boolean> => {
  return firebaseFallback.checkConnection();
};

// 폴백 데이터 설정 함수
export const setFallbackData = (collectionName: string, data: any[]): void => {
  firebaseFallback.setFallbackData(collectionName, data);
}; 
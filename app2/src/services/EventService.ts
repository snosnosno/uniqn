/**
 * EventService - 이벤트(공고) 데이터 중앙 관리 서비스
 * Phase 2: 구조 최적화
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as limitQuery,
  onSnapshot,
  Timestamp,
  writeBatch,
  Unsubscribe,
  QueryConstraint,
  DocumentData,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import {
  EventInfo,
  EventStaff,
  EventWorkLog,
  COLLECTION_PATHS,
  SubcollectionQueryOptions,
  BatchOperationOptions
} from '../types/subcollection';

/**
 * 캐시 엔트리 타입
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  unsubscribe?: Unsubscribe;
}

/**
 * EventService 싱글톤 클래스
 */
export class EventService {
  private static instance: EventService;
  
  // 캐시 저장소
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분
  
  // 실시간 구독 관리
  private subscriptions: Map<string, Unsubscribe> = new Map();
  
  private constructor() {
    logger.info('EventService 초기화', { component: 'EventService' });
  }
  
  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }
  
  // ================== 캐시 관리 ==================
  
  /**
   * 캐시 키 생성
   */
  private getCacheKey(type: string, eventId: string, subKey?: string): string {
    return subKey ? `${type}:${eventId}:${subKey}` : `${type}:${eventId}`;
  }
  
  /**
   * 캐시에서 데이터 가져오기
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // TTL 체크
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * 캐시에 데이터 저장
   */
  private setCache<T>(key: string, data: T, unsubscribe?: Unsubscribe): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    };
    
    if (unsubscribe) {
      entry.unsubscribe = unsubscribe;
    }
    
    this.cache.set(key, entry);
  }
  
  /**
   * 캐시 무효화
   */
  public invalidateCache(eventId?: string): void {
    if (eventId) {
      // 특정 이벤트의 캐시만 삭제
      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        if (key.includes(eventId)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => {
        const entry = this.cache.get(key);
        if (entry?.unsubscribe) {
          entry.unsubscribe();
        }
        this.cache.delete(key);
      });
    } else {
      // 전체 캐시 삭제
      this.cache.forEach(entry => {
        if (entry.unsubscribe) {
          entry.unsubscribe();
        }
      });
      this.cache.clear();
    }
  }
  
  // ================== Event Info 관리 ==================
  
  /**
   * 이벤트 기본 정보 조회
   */
  public async getEventInfo(eventId: string, realtime = false): Promise<EventInfo | null> {
    const cacheKey = this.getCacheKey('info', eventId);
    
    // 캐시 확인
    if (!realtime) {
      const cached = this.getFromCache<EventInfo>(cacheKey);
      if (cached) return cached;
    }
    
    try {
      const docRef = doc(db, 'jobPostings', eventId);
      
      if (realtime) {
        // 실시간 구독
        return new Promise((resolve) => {
          const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = { id: snapshot.id, ...snapshot.data() } as EventInfo;
              this.setCache(cacheKey, data, unsubscribe);
              resolve(data);
            } else {
              resolve(null);
            }
          });
          this.subscriptions.set(cacheKey, unsubscribe);
        });
      } else {
        // 일회성 조회
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = { id: snapshot.id, ...snapshot.data() } as EventInfo;
          this.setCache(cacheKey, data);
          return data;
        }
        return null;
      }
    } catch (error) {
      logger.error('이벤트 정보 조회 실패', error as Error, {
        component: 'EventService',
        data: { eventId }
      });
      throw error;
    }
  }
  
  // ================== Staff 관리 ==================
  
  /**
   * 이벤트 스태프 목록 조회
   */
  public async getEventStaff(
    eventId: string,
    options?: Partial<SubcollectionQueryOptions>
  ): Promise<EventStaff[]> {
    const cacheKey = this.getCacheKey('staff', eventId);
    
    // 캐시 확인
    const cached = this.getFromCache<EventStaff[]>(cacheKey);
    if (cached && !options) return cached;
    
    try {
      const constraints: QueryConstraint[] = [];
      
      // 정렬
      if (options?.orderBy) {
        constraints.push(orderBy(options.orderBy.field, options.orderBy.direction));
      } else {
        constraints.push(orderBy('assignedAt', 'desc'));
      }
      
      // 제한
      if (options?.limit) {
        constraints.push(limitQuery(options.limit));
      }
      
      // 조건
      if (options?.where) {
        options.where.forEach(condition => {
          constraints.push(where(condition.field, condition.operator, condition.value));
        });
      }
      
      const q = query(
        collection(db, COLLECTION_PATHS.eventStaff(eventId)),
        ...constraints
      );
      
      const snapshot = await getDocs(q);
      const staff = snapshot.docs.map(doc => ({
        userId: doc.id,
        ...doc.data()
      } as EventStaff));
      
      // 캐시 저장 (옵션 없는 기본 조회만)
      if (!options) {
        this.setCache(cacheKey, staff);
      }
      
      return staff;
    } catch (error) {
      logger.error('스태프 목록 조회 실패', error as Error, {
        component: 'EventService',
        data: { eventId }
      });
      throw error;
    }
  }
  
  /**
   * 스태프 정보 조회 (개별)
   */
  public async getStaffById(
    eventId: string,
    userId: string
  ): Promise<EventStaff | null> {
    const cacheKey = this.getCacheKey('staff', eventId, userId);
    
    // 캐시 확인
    const cached = this.getFromCache<EventStaff>(cacheKey);
    if (cached) return cached;
    
    try {
      const docRef = doc(db, COLLECTION_PATHS.staffDoc(eventId, userId));
      const snapshot = await getDoc(docRef);
      
      if (snapshot.exists()) {
        const staff = {
          userId: snapshot.id,
          ...snapshot.data()
        } as EventStaff;
        this.setCache(cacheKey, staff);
        return staff;
      }
      return null;
    } catch (error) {
      logger.error('스태프 정보 조회 실패', error as Error, {
        component: 'EventService',
        data: { eventId, userId }
      });
      throw error;
    }
  }
  
  /**
   * 스태프 추가/업데이트
   */
  public async upsertStaff(
    eventId: string,
    userId: string,
    data: Partial<EventStaff>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_PATHS.staffDoc(eventId, userId));
      
      const staffData: any = {
        ...data,
        userId,
        updatedAt: serverTimestamp()
      };
      
      // 새 문서인지 확인
      const existing = await getDoc(docRef);
      if (!existing.exists()) {
        staffData.createdAt = serverTimestamp();
        staffData.assignedAt = staffData.assignedAt || serverTimestamp();
      }
      
      await setDoc(docRef, staffData, { merge: true });
      
      // 캐시 무효화
      this.invalidateCache(eventId);
      
      logger.info('스태프 정보 저장 완료', {
        component: 'EventService',
        data: { eventId, userId }
      });
    } catch (error) {
      logger.error('스태프 정보 저장 실패', error as Error, {
        component: 'EventService',
        data: { eventId, userId }
      });
      throw error;
    }
  }
  
  // ================== WorkLog 관리 ==================
  
  /**
   * WorkLog 목록 조회
   */
  public async getEventWorkLogs(
    eventId: string,
    options?: Partial<SubcollectionQueryOptions>
  ): Promise<EventWorkLog[]> {
    const cacheKey = this.getCacheKey('workLogs', eventId);
    
    // 캐시 확인 (옵션 없는 경우만)
    if (!options) {
      const cached = this.getFromCache<EventWorkLog[]>(cacheKey);
      if (cached) return cached;
    }
    
    try {
      const constraints: QueryConstraint[] = [];
      
      // 정렬
      if (options?.orderBy) {
        constraints.push(orderBy(options.orderBy.field, options.orderBy.direction));
      } else {
        constraints.push(orderBy('date', 'desc'));
      }
      
      // 제한
      if (options?.limit) {
        constraints.push(limitQuery(options.limit));
      }
      
      // 조건
      if (options?.where) {
        options.where.forEach(condition => {
          constraints.push(where(condition.field, condition.operator, condition.value));
        });
      }
      
      const q = query(
        collection(db, COLLECTION_PATHS.eventWorkLogs(eventId)),
        ...constraints
      );
      
      const snapshot = await getDocs(q);
      const workLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EventWorkLog));
      
      // 캐시 저장 (옵션 없는 기본 조회만)
      if (!options) {
        this.setCache(cacheKey, workLogs);
      }
      
      return workLogs;
    } catch (error) {
      logger.error('WorkLog 목록 조회 실패', error as Error, {
        component: 'EventService',
        data: { eventId }
      });
      throw error;
    }
  }
  
  /**
   * WorkLog 생성
   */
  public async createWorkLog(
    eventId: string,
    data: Omit<EventWorkLog, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      // ID 생성 (userId_date 형식)
      const workLogId = `${data.userId}_${data.date}`;
      const docRef = doc(db, COLLECTION_PATHS.workLogDoc(eventId, workLogId));
      
      const workLogData: any = {
        ...data,
        id: workLogId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(docRef, workLogData);
      
      // 캐시 무효화
      this.invalidateCache(eventId);
      
      logger.info('WorkLog 생성 완료', {
        component: 'EventService',
        data: { eventId, workLogId }
      });
      
      return workLogId;
    } catch (error) {
      logger.error('WorkLog 생성 실패', error as Error, {
        component: 'EventService',
        data: { eventId }
      });
      throw error;
    }
  }
  
  /**
   * WorkLog 업데이트
   */
  public async updateWorkLog(
    eventId: string,
    workLogId: string,
    updates: Partial<EventWorkLog>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_PATHS.workLogDoc(eventId, workLogId));
      
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      // 캐시 무효화
      this.invalidateCache(eventId);
      
      logger.info('WorkLog 업데이트 완료', {
        component: 'EventService',
        data: { eventId, workLogId }
      });
    } catch (error) {
      logger.error('WorkLog 업데이트 실패', error as Error, {
        component: 'EventService',
        data: { eventId, workLogId }
      });
      throw error;
    }
  }
  
  // ================== 정산 관련 ==================
  
  /**
   * 정산 계산
   */
  public async calculatePayroll(
    eventId: string,
    dateRange?: { from: string; to: string }
  ): Promise<{
    staff: Array<{
      userId: string;
      name: string;
      totalHours: number;
      totalPay: number;
      details: EventWorkLog[];
    }>;
    summary: {
      totalStaff: number;
      totalHours: number;
      totalPay: number;
    };
  }> {
    try {
      // WorkLog 조회
      const options: Partial<SubcollectionQueryOptions> = {};
      if (dateRange) {
        options.where = [
          { field: 'date', operator: '>=', value: dateRange.from },
          { field: 'date', operator: '<=', value: dateRange.to }
        ];
      }
      const workLogs = await this.getEventWorkLogs(eventId, options);
      
      // 스태프별 그룹화
      const staffMap = new Map<string, EventWorkLog[]>();
      workLogs.forEach(log => {
        const logs = staffMap.get(log.userId) || [];
        logs.push(log);
        staffMap.set(log.userId, logs);
      });
      
      // 정산 계산
      const staff = Array.from(staffMap.entries()).map(([userId, logs]) => {
        const totalHours = logs.reduce((sum, log) => sum + (log.hoursWorked || 0), 0);
        const totalPay = logs.reduce((sum, log) => sum + (log.payroll?.totalPay || 0), 0);
        const name = logs[0]?.staffName || '이름 없음';
        
        return {
          userId,
          name,
          totalHours,
          totalPay,
          details: logs
        };
      });
      
      // 요약
      const summary = {
        totalStaff: staff.length,
        totalHours: staff.reduce((sum, s) => sum + s.totalHours, 0),
        totalPay: staff.reduce((sum, s) => sum + s.totalPay, 0)
      };
      
      return { staff, summary };
    } catch (error) {
      logger.error('정산 계산 실패', error as Error, {
        component: 'EventService',
        data: { eventId, dateRange }
      });
      throw error;
    }
  }
  
  // ================== 배치 작업 ==================
  
  /**
   * 배치 작업 실행
   */
  public async executeBatchOperation<T>(
    operations: Array<() => Promise<T>>,
    options?: BatchOperationOptions
  ): Promise<T[]> {
    const batchSize = options?.batchSize || 500;
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
      
      if (options?.onProgress) {
        options.onProgress(Math.min(i + batchSize, operations.length), operations.length);
      }
    }
    
    return results;
  }
  
  // ================== 정리 ==================
  
  /**
   * 모든 구독 정리
   */
  public cleanup(): void {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
    this.invalidateCache();
    logger.info('EventService 정리 완료', { component: 'EventService' });
  }
}

// 싱글톤 인스턴스 export
export const eventService = EventService.getInstance();
# 🔌 T-HOLDEM 모바일 API 명세서

**최종 업데이트**: 2025년 9월 10일  
**버전**: v0.1.0 (개발 단계)  
**상태**: 🚧 **설계 중 - MVP 기준**

> [!NOTE]
> **안내**: 이 문서는 모바일 앱의 최종 버전을 기준으로 한 API 명세 초안입니다. 현재 MVP(v0.1.0) 단계에서는 실제 구현 시 변경될 수 있습니다.

## 📋 목차

1. [API 개요](#-api-개요)
2. [인증 시스템](#-인증-시스템)
3. [모바일 전용 엔드포인트](#-모바일-전용-엔드포인트)
4. [Firebase Functions API](#-firebase-functions-api)
5. [실시간 동기화](#-실시간-동기화)
6. [오프라인 지원](#-오프라인-지원)
7. [푸시 알림](#-푸시-알림)
8. [에러 처리](#-에러-처리)

## 🎯 API 개요

T-HOLDEM 모바일 앱을 위한 최적화된 API 명세서입니다. 웹 버전과 동일한 Firebase 백엔드를 사용하되, 모바일 환경에 최적화된 데이터 구조와 엔드포인트를 제공합니다.

### 기본 정보
- **Base URL**: `https://us-central1-tholdem-ebc18.cloudfunctions.net/api/mobile/v1`
- **프로토콜**: HTTPS
- **데이터 형식**: JSON
- **인증**: Firebase ID Token
- **버전**: v1 (2025-09-10)

### 응답 형식
```json
{
  "success": true,
  "data": {}, 
  "message": "Success",
  "timestamp": "2025-09-10T12:00:00Z",
  "version": "v1"
}
```

### 에러 응답 형식
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "필수 필드가 누락되었습니다",
    "details": {
      "field": "staffId",
      "expected": "string"
    }
  },
  "timestamp": "2025-09-10T12:00:00Z"
}
```

## 🔐 인증 시스템

### Firebase ID Token 인증

```typescript
// 헤더 설정
const headers = {
  'Authorization': `Bearer ${idToken}`,
  'Content-Type': 'application/json',
  'X-Client-Version': '4.1.0',
  'X-Platform': 'mobile'
};
```

### 토큰 갱신
```typescript
// 토큰 자동 갱신
const refreshToken = async (): Promise<string> => {
  const user = auth().currentUser;
  if (!user) throw new Error('User not authenticated');
  
  return await user.getIdToken(true); // force refresh
};
```

### 권한 레벨
- **ADMIN**: 모든 데이터 접근 및 수정
- **MANAGER**: 이벤트 및 스태프 관리
- **STAFF**: 본인 관련 데이터만 조회/수정
- **USER**: 지원서 및 개인 정보만 접근

## 📱 모바일 전용 엔드포인트

### 1. 구인공고 API

#### GET `/jobs` - 구인공고 목록 (페이지네이션)
```typescript
interface JobListRequest {
  limit?: number;        // 기본값: 20, 최대: 50
  lastDoc?: string;      // 마지막 문서 ID (페이지네이션)
  status?: 'open' | 'closed' | 'all';  // 기본값: 'open'
  location?: string;     // 위치 필터
  dateFrom?: string;     // YYYY-MM-DD
  dateTo?: string;       // YYYY-MM-DD
}

interface JobListResponse {
  success: true;
  data: {
    jobs: JobPostingMobile[];
    hasMore: boolean;
    lastDoc: string | null;
    totalCount: number;
  };
}

interface JobPostingMobile {
  id: string;
  title: string;
  description: string;
  location: string;
  status: 'open' | 'closed';
  createdAt: string;
  dateRange: {
    startDate: string;    // YYYY-MM-DD
    endDate: string;      // YYYY-MM-DD
    totalDays: number;
  };
  requiredStaff: {
    totalSlots: number;
    filledSlots: number;
    availableSlots: number;
  };
  salary: {
    type: 'hourly' | 'daily';
    amount: string;
    currency: 'KRW';
  };
  tags: string[];         // ['홀덤', '강남', '주말']
  thumbnail?: string;     // 이미지 URL
}
```

#### GET `/jobs/:id` - 구인공고 상세
```typescript
interface JobDetailResponse {
  success: true;
  data: {
    job: JobPostingMobile & {
      dateSpecificRequirements: DateSpecificRequirement[];
      preQuestions: PreQuestion[];
      benefits: {
        meals: boolean;
        transportation: boolean;
        accommodation: boolean;
        insurance: boolean;
        other?: string;
      };
      requirements: {
        experience: string;
        skills: string[];
        languages: string[];
      };
      companyInfo: {
        name: string;
        description: string;
        contactInfo: string;
      };
    };
  };
}

interface DateSpecificRequirement {
  date: string;           // YYYY-MM-DD
  timeSlots: TimeSlot[];
}

interface TimeSlot {
  id: string;
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  roles: Role[];
  status: 'open' | 'full' | 'closed';
}

interface Role {
  name: string;           // 'dealer', 'server', 'manager'
  required: number;
  confirmed: number;
  hourlyRate?: number;
}
```

### 2. 지원서 API

#### POST `/applications` - 지원서 제출
```typescript
interface ApplicationRequest {
  eventId: string;
  assignments: Assignment[];
  answers?: PreQuestionAnswer[];
  notes?: string;
}

interface Assignment {
  date: string;           // YYYY-MM-DD
  timeSlotId: string;
  role: string;
  checkMethod?: 'group' | 'individual';
}

interface ApplicationResponse {
  success: true;
  data: {
    applicationId: string;
    status: 'pending' | 'confirmed' | 'rejected';
    submittedAt: string;
    estimatedResponse: string; // "24시간 이내"
  };
}
```

#### GET `/my-applications` - 내 지원서 목록
```typescript
interface MyApplicationsResponse {
  success: true;
  data: {
    applications: ApplicationMobile[];
    stats: {
      total: number;
      pending: number;
      confirmed: number;
      rejected: number;
    };
  };
}

interface ApplicationMobile {
  id: string;
  eventId: string;
  eventTitle: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  submittedAt: string;
  assignments: Assignment[];
  totalDays: number;
  estimatedEarnings: {
    amount: number;
    currency: 'KRW';
  };
  nextAction?: {
    type: 'check_in' | 'complete_profile' | 'wait_approval';
    message: string;
    dueDate?: string;
  };
}
```

### 3. 스케줄 API

#### GET `/my-schedule` - 내 스케줄
```typescript
interface MyScheduleRequest {
  dateFrom: string;       // YYYY-MM-DD
  dateTo: string;         // YYYY-MM-DD
}

interface MyScheduleResponse {
  success: true;
  data: {
    schedules: ScheduleItem[];
    summary: {
      totalDays: number;
      totalHours: number;
      estimatedEarnings: number;
    };
  };
}

interface ScheduleItem {
  id: string;
  eventId: string;
  eventTitle: string;
  date: string;           // YYYY-MM-DD
  timeSlot: {
    startTime: string;    // HH:mm
    endTime: string;      // HH:mm
    duration: number;     // minutes
  };
  role: string;
  status: 'scheduled' | 'checked_in' | 'checked_out' | 'completed';
  location: {
    name: string;
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  earnings: {
    hourlyRate: number;
    expectedHours: number;
    expectedAmount: number;
    actualAmount?: number;
  };
  checkIn?: {
    time: string;         // ISO timestamp
    location: string;
    method: 'qr' | 'manual';
  };
  checkOut?: {
    time: string;
    location: string;
    method: 'qr' | 'manual';
  };
}
```

### 4. 출석 API

#### POST `/attendance/check-in` - 출근 체크
```typescript
interface CheckInRequest {
  eventId: string;
  staffId: string;
  date: string;           // YYYY-MM-DD
  qrData?: string;        // QR 코드 데이터
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  photo?: string;         // Base64 인코딩된 사진 (선택사항)
}

interface CheckInResponse {
  success: true;
  data: {
    workLogId: string;
    checkInTime: string;  // ISO timestamp
    status: 'checked_in';
    message: string;      // "출근 체크가 완료되었습니다"
    nextCheckOut: string; // 예상 퇴근 시간
  };
}
```

#### POST `/attendance/check-out` - 퇴근 체크
```typescript
interface CheckOutRequest {
  workLogId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  notes?: string;         // 업무 메모
  rating?: number;        // 1-5 업무 만족도
}

interface CheckOutResponse {
  success: true;
  data: {
    workLogId: string;
    checkOutTime: string;
    totalWorkHours: number;
    earnings: {
      basePay: number;
      overtimePay: number;
      totalPay: number;
    };
    status: 'completed';
  };
}
```

## 🔥 Firebase Functions API

### 구현 예시

```typescript
// functions/src/mobile/jobs.ts
import { https } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { validateAuth } from '../middleware/auth';

const db = getFirestore();

export const getJobs = https.onRequest(async (req, res) => {
  try {
    // CORS 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    // 인증 확인
    const user = await validateAuth(req);
    
    // 쿼리 파라미터 파싱
    const { 
      limit = 20, 
      lastDoc, 
      status = 'open',
      location,
      dateFrom,
      dateTo 
    } = req.query;
    
    // Firestore 쿼리 구성
    let query = db.collection('jobPostings')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit as string));
    
    // 필터 적용
    if (location) {
      query = query.where('location', '==', location);
    }
    
    if (dateFrom && dateTo) {
      query = query.where('dateRange.startDate', '>=', dateFrom)
                   .where('dateRange.endDate', '<=', dateTo);
    }
    
    // 페이지네이션
    if (lastDoc) {
      const lastDocRef = await db.doc(`jobPostings/${lastDoc}`).get();
      query = query.startAfter(lastDocRef);
    }
    
    const snapshot = await query.get();
    
    // 모바일 최적화 데이터 변환
    const jobs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description?.substring(0, 200) + '...',  // 요약
        location: data.location,
        status: data.status,
        createdAt: data.createdAt?.toISOString(),
        dateRange: {
          startDate: data.dateSpecificRequirements?.[0]?.date,
          endDate: data.dateSpecificRequirements?.slice(-1)[0]?.date,
          totalDays: data.dateSpecificRequirements?.length || 0,
        },
        requiredStaff: calculateRequiredStaff(data.dateSpecificRequirements),
        salary: {
          type: data.salaryType || 'hourly',
          amount: data.salaryAmount || '0',
          currency: 'KRW',
        },
        tags: generateTags(data),
        thumbnail: data.thumbnail,
      };
    });
    
    res.json({
      success: true,
      data: {
        jobs,
        hasMore: snapshot.docs.length === parseInt(limit as string),
        lastDoc: snapshot.docs[snapshot.docs.length - 1]?.id || null,
        totalCount: jobs.length,
      },
      timestamp: new Date().toISOString(),
      version: 'v1',
    });
    
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// 유틸리티 함수
function calculateRequiredStaff(requirements: any[]): any {
  if (!requirements) return { totalSlots: 0, filledSlots: 0, availableSlots: 0 };
  
  let totalSlots = 0;
  let filledSlots = 0;
  
  requirements.forEach(req => {
    req.timeSlots?.forEach((slot: any) => {
      slot.roles?.forEach((role: any) => {
        totalSlots += role.required || 0;
        filledSlots += role.confirmed || 0;
      });
    });
  });
  
  return {
    totalSlots,
    filledSlots,
    availableSlots: totalSlots - filledSlots,
  };
}

function generateTags(data: any): string[] {
  const tags = [];
  
  if (data.location) tags.push(data.location);
  if (data.title?.includes('홀덤')) tags.push('홀덤');
  if (data.title?.includes('주말')) tags.push('주말');
  if (data.salaryType === 'daily') tags.push('일급');
  
  return tags;
}
```

## ⚡ 실시간 동기화

### Firestore 실시간 구독 (React Native)

```typescript
// hooks/useRealtimeJobPostings.ts
import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';

export const useRealtimeJobPostings = () => {
  const [jobs, setJobs] = useState<JobPostingMobile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('jobPostings')
      .where('status', '==', 'open')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(
        (snapshot) => {
          const jobList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // 모바일 최적화 변환
          })) as JobPostingMobile[];
          
          setJobs(jobList);
          setLoading(false);
        },
        (err) => {
          console.error('Firestore error:', err);
          setError(err.message);
          setLoading(false);
        }
      );
    
    // 정리 함수
    return () => unsubscribe();
  }, []);
  
  return { jobs, loading, error };
};
```

### 내 스케줄 실시간 동기화

```typescript
// hooks/useRealtimeSchedule.ts
export const useRealtimeSchedule = (userId: string) => {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  
  useEffect(() => {
    if (!userId) return;
    
    const unsubscribe = firestore()
      .collection('workLogs')
      .where('staffId', '==', userId)
      .where('date', '>=', new Date().toISOString().split('T')[0])
      .orderBy('date', 'asc')
      .onSnapshot((snapshot) => {
        const scheduleItems = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            eventId: data.eventId,
            eventTitle: data.eventTitle || '이벤트',
            date: data.date,
            timeSlot: {
              startTime: data.scheduledStartTime?.toDate().toTimeString().substr(0, 5),
              endTime: data.scheduledEndTime?.toDate().toTimeString().substr(0, 5),
              duration: calculateDuration(data.scheduledStartTime, data.scheduledEndTime),
            },
            role: data.role,
            status: data.status,
            // ... 기타 필드
          };
        });
        
        setSchedule(scheduleItems);
      });
    
    return () => unsubscribe();
  }, [userId]);
  
  return schedule;
};
```

## 📶 오프라인 지원

### 데이터 캐싱 전략

```typescript
// services/CacheService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export class CacheService {
  private static readonly CACHE_PREFIX = 'tholdem_cache_';
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24시간
  
  static async set(key: string, data: any): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        version: '4.1.0',
      };
      
      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${key}`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      
      // 만료 확인
      if (Date.now() - cacheData.timestamp > this.CACHE_EXPIRY) {
        await this.delete(key);
        return null;
      }
      
      return cacheData.data as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  static async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }
  
  static async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}
```

### 오프라인 큐잉 시스템

```typescript
// services/OfflineQueue.ts
interface QueueItem {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  timestamp: number;
  retryCount: number;
}

export class OfflineQueue {
  private static readonly QUEUE_KEY = 'offline_queue';
  private static readonly MAX_RETRIES = 3;
  
  static async addToQueue(item: Omit<QueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const queueItem: QueueItem = {
      ...item,
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    const queue = await this.getQueue();
    queue.push(queueItem);
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
  }
  
  static async processQueue(): Promise<void> {
    const queue = await this.getQueue();
    const processedItems: string[] = [];
    
    for (const item of queue) {
      try {
        await this.executeQueueItem(item);
        processedItems.push(item.id);
      } catch (error) {
        if (item.retryCount >= this.MAX_RETRIES) {
          processedItems.push(item.id); // 최대 재시도 초과 시 제거
        } else {
          item.retryCount += 1;
        }
      }
    }
    
    // 처리된 아이템 제거
    const updatedQueue = queue.filter(item => !processedItems.includes(item.id));
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(updatedQueue));
  }
  
  private static async getQueue(): Promise<QueueItem[]> {
    try {
      const queue = await AsyncStorage.getItem(this.QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }
  
  private static async executeQueueItem(item: QueueItem): Promise<void> {
    // 실제 API 호출 로직
    const response = await fetch(`${API_BASE_URL}${item.endpoint}`, {
      method: item.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getIdToken()}`,
      },
      body: item.data ? JSON.stringify(item.data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  }
}
```

## 🔔 푸시 알림

### Firebase Cloud Messaging 설정

```typescript
// services/PushNotificationService.ts
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class PushNotificationService {
  static async initialize(): Promise<void> {
    // 권한 요청
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      await this.getFCMToken();
      this.setupMessageHandlers();
    }
  }
  
  static async getFCMToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      await AsyncStorage.setItem('fcm_token', token);
      
      // 서버에 토큰 등록
      await this.registerTokenOnServer(token);
      
      return token;
    } catch (error) {
      console.error('FCM Token error:', error);
      return null;
    }
  }
  
  private static setupMessageHandlers(): void {
    // 포그라운드 메시지 처리
    messaging().onMessage(async remoteMessage => {
      console.log('Foreground message:', remoteMessage);
      
      // 로컬 알림 표시
      await this.showLocalNotification(remoteMessage);
    });
    
    // 백그라운드 메시지 처리
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Background message:', remoteMessage);
      
      // 백그라운드에서 데이터 동기화 등 수행
      await this.handleBackgroundMessage(remoteMessage);
    });
    
    // 알림 탭 처리
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open:', remoteMessage);
      
      // 특정 화면으로 내비게이션
      this.handleNotificationNavigation(remoteMessage);
    });
  }
  
  private static async registerTokenOnServer(token: string): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/notifications/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getIdToken()}`,
        },
        body: JSON.stringify({ 
          token,
          platform: 'mobile',
          deviceId: await DeviceInfo.getUniqueId(),
        }),
      });
    } catch (error) {
      console.error('Token registration error:', error);
    }
  }
}
```

### 알림 메시지 타입

```typescript
interface NotificationPayload {
  type: 'job_match' | 'application_update' | 'schedule_reminder' | 'payment_ready';
  title: string;
  body: string;
  data: {
    eventId?: string;
    applicationId?: string;
    workLogId?: string;
    deepLink?: string;
    action?: string;
  };
  priority: 'high' | 'normal';
  badge?: number;
  sound?: string;
}

// 사용 예시
const jobMatchNotification: NotificationPayload = {
  type: 'job_match',
  title: '새로운 구인공고',
  body: '강남구 홀덤 딜러 모집 - 시급 15,000원',
  data: {
    eventId: 'job_12345',
    deepLink: 'tholdem://job/12345',
    action: 'view_job',
  },
  priority: 'high',
  sound: 'default',
};
```

## ❌ 에러 처리

### 에러 코드 체계

```typescript
enum ErrorCode {
  // 인증 에러 (1000-1099)
  UNAUTHORIZED = 'AUTH_1001',
  INVALID_TOKEN = 'AUTH_1002', 
  TOKEN_EXPIRED = 'AUTH_1003',
  INSUFFICIENT_PERMISSION = 'AUTH_1004',
  
  // 검증 에러 (1100-1199)
  VALIDATION_ERROR = 'VALID_1101',
  MISSING_REQUIRED_FIELD = 'VALID_1102',
  INVALID_FIELD_FORMAT = 'VALID_1103',
  FIELD_LENGTH_EXCEEDED = 'VALID_1104',
  
  // 비즈니스 로직 에러 (1200-1299)
  JOB_NOT_FOUND = 'BIZ_1201',
  APPLICATION_ALREADY_EXISTS = 'BIZ_1202',
  JOB_POSITION_FULL = 'BIZ_1203',
  SCHEDULE_CONFLICT = 'BIZ_1204',
  
  // 시스템 에러 (1900-1999)
  INTERNAL_ERROR = 'SYS_1901',
  DATABASE_ERROR = 'SYS_1902',
  EXTERNAL_SERVICE_ERROR = 'SYS_1903',
  RATE_LIMIT_EXCEEDED = 'SYS_1904',
}
```

### 에러 처리 미들웨어

```typescript
// middleware/errorHandler.ts
import { https } from 'firebase-functions';

export const errorHandler = (
  error: Error,
  req: https.Request,
  res: https.Response
) => {
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString(),
  });
  
  // 에러 타입별 처리
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
        details: (error as any).details,
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: '인증이 필요합니다',
      },
      timestamp: new Date().toISOString(),
    });
  }
  
  // 기본 에러 응답
  res.status(500).json({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: '서버 오류가 발생했습니다',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    },
    timestamp: new Date().toISOString(),
  });
};
```

### 클라이언트 에러 처리

```typescript
// utils/apiClient.ts
export class ApiClient {
  private static async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    
    if (!response.ok) {
      throw new ApiError(
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || '알 수 없는 오류가 발생했습니다',
        response.status,
        data.error?.details
      );
    }
    
    if (!data.success) {
      throw new ApiError(
        data.error?.code || 'API_ERROR',
        data.error?.message || 'API 호출이 실패했습니다',
        response.status,
        data.error?.details
      );
    }
    
    return data.data;
  }
  
  static async get<T>(endpoint: string, params?: any): Promise<T> {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (params) {
      Object.keys(params).forEach(key => 
        url.searchParams.append(key, params[key])
      );
    }
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: await this.getHeaders(),
    });
    
    return this.handleResponse<T>(response);
  }
  
  private static async getHeaders(): Promise<Record<string, string>> {
    const token = await getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Client-Version': '4.1.0',
      'X-Platform': 'mobile',
    };
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## 📞 참고 문서

- **웹 API**: [API_REFERENCE.md](../API_REFERENCE.md) - Firebase API 기본 사용법
- **데이터 스키마**: [DATA_SCHEMA.md](../DATA_SCHEMA.md) - 데이터 구조 정의
- **모바일 개발**: [MOBILE_DEVELOPMENT.md](./MOBILE_DEVELOPMENT.md) - 모바일 앱 개발 가이드
- **Firebase 문서**: https://firebase.google.com/docs - 공식 Firebase 문서

---

*모바일 API 관련 문의사항은 GitHub Issues를 통해 제기해 주세요.*
# 📊 T-HOLDEM 시스템 모니터링 가이드

**최종 업데이트**: 2025년 9월 10일  
**상태**: 🚧 **작성 중 - MVP 기준**  
**버전**: v0.1.0

> [!NOTE]
> **안내**: 이 문서는 최종 프로덕션 운영을 기준으로 작성되었습니다. 현재 MVP(v0.1.0) 단계에서는 기본적인 에러 및 성능 모니터링 위주로 적용됩니다.

## 📋 목차

1. [모니터링 개요](#모니터링-개요)
2. [성능 모니터링](#성능-모니터링)
3. [Firebase 모니터링](#firebase-모니터링)
4. [시스템 메트릭](#시스템-메트릭)
5. [알림 시스템](#알림-시스템)
6. [로깅 시스템](#로깅-시스템)
7. [대시보드](#대시보드)
8. [문제 해결](#문제-해결)

## 🎯 모니터링 개요

### 핵심 모니터링 지표
- **가용성**: 99.9% 업타임 유지
- **응답 시간**: API 응답 <200ms, 페이지 로드 <3초
- **에러율**: <0.1% (Firebase 함수, 클라이언트 에러)
- **Firebase 비용**: 월 $100 이내 유지
- **동시 사용자**: 실시간 모니터링

### 모니터링 스택
```typescript
// 사용 중인 모니터링 도구
Firebase Performance Monitoring  // 웹 성능
Firebase Analytics              // 사용자 행동
Firebase Crashlytics           // 에러 추적
Google Cloud Monitoring        // 인프라 메트릭
실시간 성능 훅 (useSystemPerformance)
```

## ⚡ 성능 모니터링

### 웹 성능 메트릭 (Core Web Vitals)

#### 실시간 모니터링 코드
```typescript
// src/hooks/useSystemPerformance.ts
export const useSystemPerformance = () => {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    renderTime: 0
  });

  useEffect(() => {
    // Performance Observer로 실시간 메트릭 수집
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          setMetrics(prev => ({
            ...prev,
            loadTime: entry.loadEventEnd - entry.loadEventStart
          }));
        }
      });
    });

    observer.observe({ entryTypes: ['navigation', 'measure'] });
    return () => observer.disconnect();
  }, []);

  return metrics;
};
```

#### 성능 임계값
| 메트릭 | 목표 | 경고 | 위험 |
|--------|------|------|------|
| **First Contentful Paint (FCP)** | <1.8s | >1.8s | >3.0s |
| **Largest Contentful Paint (LCP)** | <2.5s | >2.5s | >4.0s |
| **First Input Delay (FID)** | <100ms | >100ms | >300ms |
| **Cumulative Layout Shift (CLS)** | <0.1 | >0.1 | >0.25 |
| **Time to Interactive (TTI)** | <3.8s | >3.8s | >7.3s |

#### Firebase Performance 설정
```javascript
// Firebase Performance 초기화
import { getPerformance } from 'firebase/performance';

const perf = getPerformance(app);

// 커스텀 트레이스 추가
const trace = perf.trace('staff_load_time');
trace.start();
// 스태프 데이터 로딩
trace.stop();
```

### 번들 크기 모니터링

#### 현재 번들 분석
```bash
# 번들 크기 확인
npm run analyze:bundle

# 목표 크기
Initial bundle: < 300KB (현재: 278.56KB) ✅
Total bundle: < 2MB
```

#### 번들 최적화 체크포인트
- React lazy loading 적용 상태
- Code splitting 효과성
- Tree shaking 동작 확인
- 외부 라이브러리 크기 모니터링

## 🔥 Firebase 모니터링

### Firestore 성능 모니터링

#### 쿼리 성능 추적
```typescript
// 쿼리 성능 모니터링 래퍼
const monitoredQuery = async (queryName: string, queryFn: () => Promise<any>) => {
  const startTime = performance.now();
  
  try {
    const result = await queryFn();
    const duration = performance.now() - startTime;
    
    // 성능 로깅
    logger.info('Query Performance', {
      queryName,
      duration: `${duration.toFixed(2)}ms`,
      success: true,
      timestamp: new Date().toISOString()
    });
    
    // 임계값 확인 (200ms)
    if (duration > 200) {
      logger.warn('Slow Query Detected', {
        queryName,
        duration: `${duration.toFixed(2)}ms`
      });
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error('Query Failed', {
      queryName,
      duration: `${duration.toFixed(2)}ms`,
      error: error.message
    });
    throw error;
  }
};
```

#### Firebase 비용 모니터링
```typescript
// 일일 Firebase 사용량 추적
const trackFirebaseUsage = () => {
  // Firestore 읽기/쓰기 추적
  let dailyReads = 0;
  let dailyWrites = 0;
  
  const incrementReads = (count = 1) => {
    dailyReads += count;
    if (dailyReads > 20000) { // 일일 한도 20K
      logger.warn('High Firestore read usage', { dailyReads });
    }
  };
  
  const incrementWrites = (count = 1) => {
    dailyWrites += count;
    if (dailyWrites > 5000) { // 일일 한도 5K
      logger.warn('High Firestore write usage', { dailyWrites });
    }
  };
  
  return { incrementReads, incrementWrites };
};
```

### Functions 모니터링

#### Cloud Functions 성능
```javascript
// functions/index.js - 함수 성능 추적
const functions = require('firebase-functions');

exports.processStaffData = functions.firestore
  .document('staff/{staffId}')
  .onUpdate(async (change, context) => {
    const startTime = Date.now();
    
    try {
      // 비즈니스 로직 처리
      await processStaffUpdate(change.after.data(), context.params.staffId);
      
      const duration = Date.now() - startTime;
      console.log('Function completed', {
        functionName: 'processStaffData',
        duration: `${duration}ms`,
        staffId: context.params.staffId
      });
      
      // 5초 이상 걸리면 경고
      if (duration > 5000) {
        console.warn('Slow function execution', {
          functionName: 'processStaffData',
          duration: `${duration}ms`
        });
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Function failed', {
        functionName: 'processStaffData',
        duration: `${duration}ms`,
        error: error.message
      });
      throw error;
    }
  });
```

## 📊 시스템 메트릭

### 실시간 메트릭 수집

#### 메모리 사용량 모니터링
```typescript
// 메모리 사용량 추적
const useMemoryMonitoring = () => {
  const [memoryInfo, setMemoryInfo] = useState(null);
  
  useEffect(() => {
    const checkMemoryUsage = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const memoryMB = {
          used: Math.round(memory.usedJSHeapSize / 1048576),
          total: Math.round(memory.totalJSHeapSize / 1048576),
          limit: Math.round(memory.jsHeapSizeLimit / 1048576)
        };
        
        setMemoryInfo(memoryMB);
        
        // 메모리 사용률 80% 이상시 경고
        if (memoryMB.used / memoryMB.limit > 0.8) {
          logger.warn('High memory usage detected', memoryMB);
        }
      }
    };
    
    const interval = setInterval(checkMemoryUsage, 30000); // 30초마다
    checkMemoryUsage(); // 초기 실행
    
    return () => clearInterval(interval);
  }, []);
  
  return memoryInfo;
};
```

#### 캐시 성능 모니터링
```typescript
// 캐시 히트율 추적 (목표: 92%)
const useCacheMonitoring = () => {
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    hitRate: 0
  });
  
  const recordCacheHit = () => {
    setCacheStats(prev => {
      const newStats = {
        hits: prev.hits + 1,
        misses: prev.misses,
        hitRate: ((prev.hits + 1) / (prev.hits + prev.misses + 1)) * 100
      };
      
      // 히트율이 85% 미만이면 경고
      if (newStats.hitRate < 85) {
        logger.warn('Low cache hit rate', newStats);
      }
      
      return newStats;
    });
  };
  
  const recordCacheMiss = () => {
    setCacheStats(prev => {
      const newStats = {
        hits: prev.hits,
        misses: prev.misses + 1,
        hitRate: (prev.hits / (prev.hits + prev.misses + 1)) * 100
      };
      return newStats;
    });
  };
  
  return { cacheStats, recordCacheHit, recordCacheMiss };
};
```

## 🚨 알림 시스템

### 에러 알림 설정

#### 클라이언트 에러 추적
```typescript
// 글로벌 에러 경계
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Firebase Crashlytics로 에러 전송
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        custom_map: {
          stack_trace: error.stack,
          component_stack: errorInfo.componentStack
        }
      });
    }
    
    // 심각한 에러는 즉시 알림
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      logger.error('Critical Error: Chunk loading failed', {
        error: error.message,
        stack: error.stack,
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }
  }
}
```

#### 성능 임계값 알림
```typescript
// 성능 임계값 모니터링
const usePerformanceAlerts = () => {
  useEffect(() => {
    const checkPerformance = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      
      // 로드 타임 5초 이상시 알림
      if (loadTime > 5000) {
        logger.error('Performance Alert: Slow page load', {
          loadTime: `${loadTime}ms`,
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
      }
    };
    
    // 페이지 로드 완료 후 체크
    if (document.readyState === 'complete') {
      checkPerformance();
    } else {
      window.addEventListener('load', checkPerformance);
    }
    
    return () => window.removeEventListener('load', checkPerformance);
  }, []);
};
```

### Firebase Functions 알림
```javascript
// functions/monitoring.js
const nodemailer = require('nodemailer');

// 관리자 이메일 알림
const sendAlert = async (severity, message, details) => {
  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.ADMIN_EMAIL_PASSWORD
    }
  });
  
  const mailOptions = {
    from: process.env.ADMIN_EMAIL,
    to: 'admin@tholdem.com',
    subject: `[T-HOLDEM ${severity}] System Alert`,
    html: `
      <h3>${severity} Alert</h3>
      <p><strong>Message:</strong> ${message}</p>
      <p><strong>Details:</strong></p>
      <pre>${JSON.stringify(details, null, 2)}</pre>
      <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    `
  };
  
  await transporter.sendMail(mailOptions);
};

// 에러 발생시 자동 알림
exports.errorHandler = functions.firestore
  .document('logs/{logId}')
  .onCreate(async (snap, context) => {
    const logData = snap.data();
    
    if (logData.level === 'error' && logData.critical) {
      await sendAlert('CRITICAL', logData.message, {
        error: logData.error,
        context: logData.context,
        timestamp: logData.timestamp
      });
    }
  });
```

## 📋 로깅 시스템

### 구조화된 로깅

#### 로그 레벨 및 형식
```typescript
// src/utils/logger.ts - 확장된 로깅 시스템
interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  sessionId: string;
  userId?: string;
  component?: string;
  critical?: boolean;
}

class Logger {
  private sessionId: string;
  private userId?: string;
  
  constructor() {
    this.sessionId = this.generateSessionId();
  }
  
  private async logToFirestore(entry: LogEntry) {
    if (entry.level === 'error' || entry.critical) {
      try {
        await addDoc(collection(db, 'logs'), {
          ...entry,
          processed: false
        });
      } catch (error) {
        console.error('Failed to log to Firestore', error);
      }
    }
  }
  
  error(message: string, context?: Record<string, any>, critical = false) {
    const entry: LogEntry = {
      level: 'error',
      message,
      context,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      critical
    };
    
    console.error(`[ERROR] ${message}`, context);
    this.logToFirestore(entry);
  }
  
  warn(message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      level: 'warn',
      message,
      context,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId
    };
    
    console.warn(`[WARN] ${message}`, context);
    
    // 중요한 경고는 Firestore에 저장
    if (context?.important) {
      this.logToFirestore(entry);
    }
  }
  
  info(message: string, context?: Record<string, any>) {
    console.info(`[INFO] ${message}`, context);
  }
}

export const logger = new Logger();
```

#### 로그 집계 및 분석
```javascript
// functions/logAnalysis.js
exports.analyzeErrorTrends = functions.pubsub
  .schedule('0 */6 * * *') // 6시간마다
  .onRun(async (context) => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    const logsQuery = admin.firestore()
      .collection('logs')
      .where('timestamp', '>=', sixHoursAgo.toISOString())
      .where('level', '==', 'error');
    
    const snapshot = await logsQuery.get();
    const errorCounts = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const errorType = data.message.split(':')[0]; // 에러 타입 추출
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
    });
    
    // 에러 급증 감지 (10개 이상)
    for (const [errorType, count] of Object.entries(errorCounts)) {
      if (count >= 10) {
        await sendAlert('HIGH', `Error spike detected: ${errorType}`, {
          errorType,
          count,
          timeRange: '6 hours'
        });
      }
    }
  });
```

## 📊 대시보드

### 실시간 모니터링 대시보드

#### 성능 대시보드 컴포넌트
```typescript
// components/admin/MonitoringDashboard.tsx
const MonitoringDashboard: React.FC = () => {
  const systemMetrics = useSystemPerformance();
  const memoryInfo = useMemoryMonitoring();
  const cacheStats = useCacheMonitoring();
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* 성능 메트릭 */}
      <MetricCard
        title="페이지 로드 시간"
        value={`${systemMetrics.loadTime}ms`}
        status={systemMetrics.loadTime < 3000 ? 'good' : 'warning'}
        target="< 3000ms"
      />
      
      <MetricCard
        title="메모리 사용량"
        value={`${memoryInfo?.used || 0}MB`}
        status={memoryInfo?.used / memoryInfo?.limit < 0.8 ? 'good' : 'warning'}
        target={`< ${memoryInfo?.limit * 0.8 || 0}MB`}
      />
      
      <MetricCard
        title="캐시 히트율"
        value={`${cacheStats.hitRate.toFixed(1)}%`}
        status={cacheStats.hitRate > 85 ? 'good' : 'warning'}
        target="> 85%"
      />
      
      {/* Firebase 메트릭 */}
      <FirebaseMetrics />
      
      {/* 에러 현황 */}
      <ErrorSummary />
      
      {/* 사용자 활동 */}
      <UserActivityChart />
    </div>
  );
};
```

#### Google Cloud Monitoring 연동
```typescript
// Google Cloud Monitoring 커스텀 메트릭
const sendMetricToGCP = async (metricType: string, value: number) => {
  try {
    const response = await fetch(`https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timeSeries: [{
          metric: {
            type: `custom.googleapis.com/t-holdem/${metricType}`,
            labels: {
              environment: 'production'
            }
          },
          resource: {
            type: 'global'
          },
          points: [{
            interval: {
              endTime: new Date().toISOString()
            },
            value: {
              doubleValue: value
            }
          }]
        }]
      })
    });
  } catch (error) {
    logger.error('Failed to send metric to GCP', { metricType, value, error });
  }
};
```

## 🔧 문제 해결

### 일반적인 문제 해결 절차

#### 성능 저하 문제
```bash
# 1. 번들 크기 확인
npm run analyze:bundle

# 2. 네트워크 요청 확인 (개발자 도구)
- Slow 3G 시뮬레이션으로 테스트
- 불필요한 API 호출 식별
- 이미지 최적화 확인

# 3. 메모리 누수 확인
- Performance 탭에서 메모리 프로파일링
- useEffect cleanup 함수 확인
- 이벤트 리스너 해제 확인
```

#### Firebase 연결 문제
```typescript
// Firebase 연결 상태 모니터링
const useFirebaseConnectionStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  
  useEffect(() => {
    const connectedRef = ref(database, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val() === true;
      setIsConnected(connected);
      
      if (!connected) {
        logger.warn('Firebase connection lost', {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });
      }
    });
    
    return unsubscribe;
  }, []);
  
  return isConnected;
};
```

#### 메모리 누수 디버깅
```typescript
// 메모리 누수 감지 및 정리
const useMemoryLeakDetection = () => {
  useEffect(() => {
    const checkMemoryGrowth = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = memory.usedJSHeapSize / 1048576;
        
        // 메모리 사용량이 계속 증가하는지 확인
        if (usedMB > 200) { // 200MB 임계값
          logger.warn('Potential memory leak detected', {
            usedMemory: `${usedMB.toFixed(2)}MB`,
            totalMemory: `${(memory.totalJSHeapSize / 1048576).toFixed(2)}MB`,
            location: window.location.pathname
          });
        }
      }
    };
    
    const interval = setInterval(checkMemoryGrowth, 60000); // 1분마다 체크
    return () => clearInterval(interval);
  }, []);
};
```

### 응급 상황 대응

#### 시스템 다운 대응 절차
```yaml
1단계: 즉시 확인
  - Firebase Console에서 Functions 상태 확인
  - Google Cloud Status 페이지 확인
  - 네트워크 연결 상태 확인

2단계: 로그 분석
  - Firebase Console > Functions > Logs
  - Chrome DevTools > Console 에러 확인
  - Network 탭에서 실패한 요청 확인

3단계: 긴급 조치
  - 캐시 무효화: localStorage.clear()
  - 서비스 워커 업데이트
  - Firebase 재배포 (필요시)

4단계: 사용자 안내
  - 상태 페이지 업데이트
  - 사용자 공지사항 게시
  - 예상 복구 시간 안내
```

## 📈 모니터링 체크리스트

### 일일 체크리스트 ✅
- [ ] Firebase Console에서 에러 로그 확인
- [ ] 성능 메트릭 검토 (로드 시간, 메모리 사용량)
- [ ] 캐시 히트율 확인 (목표: >85%)
- [ ] 사용자 활동 패턴 분석
- [ ] Firebase 비용 사용량 확인

### 주간 체크리스트 📅
- [ ] 성능 트렌드 분석 (지난 7일)
- [ ] 에러 패턴 분석 및 해결
- [ ] 번들 크기 변화 확인
- [ ] Firebase 인덱스 최적화 검토
- [ ] 보안 이벤트 검토

### 월간 체크리스트 🗓️
- [ ] 전체 시스템 성능 보고서 작성
- [ ] Firebase 비용 분석 및 최적화
- [ ] 모니터링 임계값 재조정
- [ ] 장애 대응 절차 검토
- [ ] 백업 및 복구 테스트

---

**🚨 긴급 연락처**
- **시스템 관리자**: admin@tholdem.com
- **개발팀**: dev@tholdem.com
- **Firebase 지원**: Firebase Console > Support

**📊 모니터링 도구 링크**
- [Firebase Console](https://console.firebase.google.com/project/tholdem-ebc18)
- [Google Cloud Monitoring](https://console.cloud.google.com/monitoring)
- [Performance Dashboard](https://tholdem-ebc18.web.app/admin/monitoring)

*이 문서는 시스템 안정성 유지를 위한 핵심 가이드입니다. 정기적으로 업데이트하여 최신 상태를 유지하세요.*
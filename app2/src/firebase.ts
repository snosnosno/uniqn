// Firebase 초기??�??�증/DB ?�스?�스 export
import { initializeApp } from "firebase/app";
import { logger } from './utils/logger';
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, doc, collection, getDocs, writeBatch, query, where, orderBy, limit, startAfter, Timestamp, Query, connectFirestoreEmulator } from "firebase/firestore";
// Storage와 Functions는 동적 import를 위해 직접 import하지 않음

import type { JobPostingFilters } from './hooks/useJobPostings';
import type { QueryConstraint as FirestoreQueryConstraint, DocumentSnapshot } from 'firebase/firestore';
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || ''
};

const app = initializeApp(firebaseConfig);
export { app }; // Export app for Firebase Performance
export const auth = getAuth(app);
export const db = getFirestore(app); // Export db as a named export

// Storage와 Functions는 동적 로딩을 위해 별도 유틸리티 사용
// firebase-dynamic.ts의 getStorageLazy(), getFunctionsLazy() 사용

// Connect to Firebase Emulators for local development
const isEmulator = process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true';

if (isEmulator) {
  // logger.debug('Firebase Emulators 연결 중...', { component: 'firebase' });
  
  try {
    // Connect Auth Emulator with additional security options
    connectAuthEmulator(auth, 'http://localhost:9099', { 
      disableWarnings: true,
      // Force emulator mode to bypass token endpoint issues
    });
    // logger.debug('Firebase Auth emulator 연결됨', { component: 'firebase' });
    
    // Set additional emulator-specific settings
    if (typeof window !== 'undefined') {
      // Disable token refresh for emulator mode
      (window as any).__FIREBASE_DEFAULTS__ = {
        ...((window as any).__FIREBASE_DEFAULTS__ || {}),
        emulatorHosts: {
          auth: 'localhost:9099',
          firestore: 'localhost:8080'
        }
      };
    }
  } catch (error) {
    // logger.debug('Auth emulator 이미 연결됨 또는 사용 불가', { component: 'firebase' });
  }
  
  try {
    // Connect Firestore Emulator
    connectFirestoreEmulator(db, 'localhost', 8080);
    // logger.debug('Firebase Firestore emulator 연결됨', { component: 'firebase' });
  } catch (error) {
    // logger.debug('Firestore emulator 이미 연결됨 또는 사용 불가', { component: 'firebase' });
  }
  
  // Functions 에뮬레이터는 동적 로딩 시 연결
  // firebase-dynamic.ts에서 처리
  // logger.debug('Functions emulator는 첫 사용 시 연결됨', { component: 'firebase' });
  
  // logger.debug('모든 Firebase 서비스가 emulator에 연결됨', { component: 'firebase' });
} else {
  // logger.debug('프로덕션 Firebase 서비스 사용 중', { component: 'firebase' });
}

export const setupTestData = async () => {
  const tablesCollectionRef = collection(db, 'tables');
  const snapshot = await getDocs(tablesCollectionRef);

  if (!snapshot.empty) {
    // logger.debug('Test data already exists. Skipping setup.', { component: 'firebase' });
    return 'SKIPPED';
  }

  const batch = writeBatch(db);

  // Create 10 tables
  for (let i = 1; i <= 10; i++) {
    const tableRef = doc(collection(db, 'tables'));
    batch.set(tableRef, {
      tableNumber: i,
      seats: Array(9).fill(null),
    });
  }

  // Create 80 participants
  for (let i = 1; i <= 80; i++) {
    const participantRef = doc(collection(db, 'participants'));
    batch.set(participantRef, {
      name: `Participant ${i}`,
      chips: 10000,
      buyInStatus: 'paid',
      status: 'active',
    });
  }

  try {
    await batch.commit();
    // logger.debug('Test data successfully written to Firestore.', { component: 'firebase' });
    return 'SUCCESS';
  } catch (error) {
    logger.error('Error writing test data: ', error instanceof Error ? error : new Error(String(error)), { component: 'firebase' });
    return 'ERROR';
  }
};

// 🚫 DEPRECATED: promoteToStaff 함수 완전 비활성화
// persons 컬렉션은 WorkLog의 staffInfo 필드로 완전히 통합되었습니다.
// 이 함수는 더 이상 사용되지 않으며, WorkLog 생성은 useApplicantActions에서 직접 처리됩니다.
export const promoteToStaff = async (
  documentId: string, 
  userName: string, 
  jobRole: string, 
  postingId: string, 
  managerId: string, 
  assignedRole?: string, 
  assignedTime?: string,
  email?: string,
  phone?: string,
  assignedDate?: string,
  actualUserId?: string
) => {
  // 🚫 함수 완전 비활성화 - 더 이상 사용하지 않음
  logger.warn('⚠️ promoteToStaff 함수는 deprecated되었습니다. WorkLog 생성은 useApplicantActions에서 직접 처리됩니다.', {
    component: 'firebase',
    data: { documentId, postingId }
  });
  
  // 더 이상 WorkLog를 생성하지 않고 즉시 반환
  return Promise.resolve();
};

interface PaginationOptions {
  limit?: number;
  startAfterDoc?: DocumentSnapshot;
}

// Build filtered query for job postings - COMPREHENSIVE INDEX VERSION
export const buildFilteredQuery = (
  filters: JobPostingFilters, 
  pagination?: PaginationOptions
): Query => {
  const jobPostingsRef = collection(db, 'jobPostings');
  const queryConstraints: FirestoreQueryConstraint[] = [];
  
  // logger.debug('Building query with filters:', { component: 'firebase', data: filters });
  
  // Always filter for open status
  queryConstraints.push(where('status', '==', 'open'));
  
  // Handle search queries with location/type support
  if (filters.searchTerms && filters.searchTerms.length > 0) {
    // logger.debug('Search mode activated with terms:', { component: 'firebase', data: filters.searchTerms });
    queryConstraints.push(where('searchIndex', 'array-contains-any', filters.searchTerms));
    
    // Add location filter if specified (has index: status + searchIndex + location + createdAt)
    if (filters.location && filters.location !== 'all') {
      // logger.debug('Search + Location filter applied:', { component: 'firebase', data: filters.location });
      queryConstraints.push(where('location', '==', filters.location));
    }
    // Add type filter if specified and no location (has index: status + searchIndex + type + createdAt)
    else if (filters.type && filters.type !== 'all') {
      // logger.debug('Search + Type filter applied:', { component: 'firebase', data: filters.type });
      queryConstraints.push(where('type', '==', filters.type));
    }
    
    // Always use createdAt ordering for search results
    queryConstraints.push(orderBy('createdAt', 'desc'));
  } 
  // Handle date-based queries (prioritized because of range query limitations)
  else if (filters.startDate) {
    // logger.debug('Date filter applied:', { component: 'firebase', data: filters.startDate });
    
    // Create date at start of day to match job postings
    const filterDate = new Date(filters.startDate);
    filterDate.setHours(0, 0, 0, 0);
    const startDateTimestamp = Timestamp.fromDate(filterDate);
    // logger.debug('Converted date to Timestamp:', { component: 'firebase', data: startDateTimestamp });
    
    queryConstraints.push(where('startDate', '>=', startDateTimestamp));
    
    // Priority: Role filter first (if specified), then location/type
    // Note: Firebase doesn't allow inequality + array-contains in same query
    // So we prioritize role filter and do client-side filtering for others
    if (filters.role && filters.role !== 'all') {
      // logger.debug('Date + Role filter applied (prioritized):', { component: 'firebase', data: filters.role });
      queryConstraints.push(where('requiredRoles', 'array-contains', filters.role));
      // Note: location/type will be filtered client-side
    }
    // Add location filter if no role filter (has index: status + location + startDate)
    else if (filters.location && filters.location !== 'all') {
      // logger.debug('Date + Location filter applied:', { component: 'firebase', data: filters.location });
      queryConstraints.push(where('location', '==', filters.location));
    }
    // Add type filter if no role/location filter (has index: status + type + startDate)
    else if (filters.type && filters.type !== 'all') {
      // logger.debug('Date + Type filter applied:', { component: 'firebase', data: filters.type });
      queryConstraints.push(where('type', '==', filters.type));
    }
    
    // Use startDate ordering for date-filtered queries
    queryConstraints.push(orderBy('startDate', 'asc'));
  }
  // Handle non-date queries
  else {
    // Add location filter
    if (filters.location && filters.location !== 'all') {
      // logger.debug('Location filter applied:', { component: 'firebase', data: filters.location });
      queryConstraints.push(where('location', '==', filters.location));
    }
    
    // Add type filter
    if (filters.type && filters.type !== 'all') {
      // logger.debug('Type filter applied:', { component: 'firebase', data: filters.type });
      queryConstraints.push(where('type', '==', filters.type));
    }
    
    // Add role filter
    if (filters.role && filters.role !== 'all') {
      // logger.debug('Role filter applied:', { component: 'firebase', data: filters.role });
      queryConstraints.push(where('requiredRoles', 'array-contains', filters.role));
    }
    
    // Use createdAt ordering for non-date queries
    queryConstraints.push(orderBy('createdAt', 'desc'));
  }
  
  // Add startAfter for pagination if provided
  if (pagination?.startAfterDoc) {
    queryConstraints.push(startAfter(pagination.startAfterDoc));
  }
  
  // Add limit (default 20 for regular queries, customizable for infinite scroll)
  queryConstraints.push(limit(pagination?.limit || 20));
  
  // logger.debug('Final query constraints count:', { component: 'firebase', data: queryConstraints.length });
  // logger.debug('Query constraints:', { component: 'firebase', data: queryConstraints.map((c, i) => `${i}: ${c.type || 'unknown'}`)});
  
  return query(jobPostingsRef, ...queryConstraints);
};

// Migration function to add searchIndex to existing job postings
export const migrateJobPostingsSearchIndex = async (): Promise<void> => {
  // logger.debug('Starting searchIndex migration for job postings...', { component: 'firebase' });
  
  try {
    const jobPostingsRef = collection(db, 'jobPostings');
    const snapshot = await getDocs(jobPostingsRef);
    
    const batch = writeBatch(db);
    let updateCount = 0;
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      // Skip if searchIndex already exists
      if (data.searchIndex) {
        return;
      }
      
      const title = data.title || '';
      const description = data.description || '';
      
      // Generate search index
      const searchIndex = generateSearchIndexForJobPosting(title, description);
      
      // Update document
      const docRef = doc(db, 'jobPostings', docSnapshot.id);
      batch.update(docRef, { searchIndex });
      updateCount++;
    });
    
    if (updateCount > 0) {
      await batch.commit();
      // logger.debug(`Successfully updated ${updateCount} job postings with searchIndex`, { component: 'firebase' });
    } else {
      // logger.debug('No job postings needed searchIndex migration', { component: 'firebase' });
    }
  } catch (error) {
    logger.error('Error during searchIndex migration:', error instanceof Error ? error : new Error(String(error)), { component: 'firebase' });
    throw error;
  }
};

// Migration function to add requiredRoles to existing job postings
export const migrateJobPostingsRequiredRoles = async (): Promise<void> => {
  // logger.debug('Starting requiredRoles migration for job postings...', { component: 'firebase' });
  
  try {
    const jobPostingsRef = collection(db, 'jobPostings');
    const snapshot = await getDocs(jobPostingsRef);
    
    const batch = writeBatch(db);
    let updateCount = 0;
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      // Skip if requiredRoles already exists
      if (data.requiredRoles && Array.isArray(data.requiredRoles)) {
        return;
      }
      
      // Extract roles from dateSpecificRequirements
      const dateSpecificRequirements = data.dateSpecificRequirements || [];
      const requiredRoles = Array.from(new Set(
        dateSpecificRequirements.flatMap((dateReq: { timeSlots?: Array<{ roles?: Array<{ name: string }> }> }) => {
          if (dateReq.timeSlots && Array.isArray(dateReq.timeSlots)) {
            return dateReq.timeSlots.flatMap((ts: { roles?: Array<{ name: string }> }) => {
              if (ts.roles && Array.isArray(ts.roles)) {
                return ts.roles.map((r: { name: string }) => r.name);
              }
              return [];
            });
          }
          return [];
        })
      ));
      
      // logger.debug(`Document ${docSnapshot.id}: extracted roles:`, { component: 'firebase', data: requiredRoles });
      
      // Update document
      const docRef = doc(db, 'jobPostings', docSnapshot.id);
      batch.update(docRef, { requiredRoles });
      updateCount++;
    });
    
    if (updateCount > 0) {
      await batch.commit();
      // logger.debug(`Successfully updated ${updateCount} job postings with requiredRoles`, { component: 'firebase' });
    } else {
      // logger.debug('No job postings needed requiredRoles migration', { component: 'firebase' });
    }
  } catch (error) {
    logger.error('Error during requiredRoles migration:', error instanceof Error ? error : new Error(String(error)), { component: 'firebase' });
    throw error;
  }
};

// Migration function to convert string dates to Timestamps
export const migrateJobPostingsDateFormat = async (): Promise<void> => {
  // logger.debug('Starting date format migration for job postings...', { component: 'firebase' });
  
  try {
    const jobPostingsRef = collection(db, 'jobPostings');
    const snapshot = await getDocs(jobPostingsRef);
    
    const batch = writeBatch(db);
    let updateCount = 0;
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      
      // Check if startDate is a string and needs conversion
      if (data.startDate && typeof data.startDate === 'string') {
        const dateObj = new Date(data.startDate);
        if (!isNaN(dateObj.getTime())) {
          const startDateTimestamp = Timestamp.fromDate(dateObj);
          // logger.debug(`Document ${docSnapshot.id}: converting date ${data.startDate} to Timestamp`, { component: 'firebase' });
          
          // Update document
          const docRef = doc(db, 'jobPostings', docSnapshot.id);
          batch.update(docRef, { startDate: startDateTimestamp });
          updateCount++;
        }
      }
      
      // Also handle endDate if it exists
      if (data.endDate && typeof data.endDate === 'string') {
        const dateObj = new Date(data.endDate);
        if (!isNaN(dateObj.getTime())) {
          const endDateTimestamp = Timestamp.fromDate(dateObj);
          // logger.debug(`Document ${docSnapshot.id}: converting endDate ${data.endDate} to Timestamp`, { component: 'firebase' });
          
          // Update document
          const docRef = doc(db, 'jobPostings', docSnapshot.id);
          batch.update(docRef, { endDate: endDateTimestamp });
          updateCount++;
        }
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      // logger.debug(`Successfully updated ${updateCount} job postings with proper date format`, { component: 'firebase' });
    } else {
      // logger.debug('No job postings needed date format migration', { component: 'firebase' });
    }
  } catch (error) {
    logger.error('Error during date format migration:', error instanceof Error ? error : new Error(String(error)), { component: 'firebase' });
    throw error;
  }
};

// Helper function to generate search index for job postings
const generateSearchIndexForJobPosting = (title: string, description: string): string[] => {
  const text = `${title} ${description}`.toLowerCase();
  const words = text
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
  
  return Array.from(new Set(words));
};

// Run all migrations for job postings
export const runJobPostingsMigrations = async (): Promise<void> => {
  // logger.debug('Starting all job postings migrations...', { component: 'firebase' });
  
  try {
    await migrateJobPostingsRequiredRoles();
    await migrateJobPostingsDateFormat();
    await migrateJobPostingsSearchIndex();
    // logger.debug('All job postings migrations completed successfully', { component: 'firebase' });
  } catch (error) {
    logger.error('??Migration failed:', error instanceof Error ? error : new Error(String(error)), { component: 'firebase' });
    throw error;
  }
};
// Firebase 초기??�??�증/DB ?�스?�스 export
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, doc, collection, getDocs, writeBatch, getDoc, setDoc, updateDoc, arrayUnion, query, where, orderBy, limit, startAfter, Timestamp, Query, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import type { JobPostingFilters } from './hooks/useJobPostings';
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDiwCKWr83N1NRy5NwA1WLc5bRD73VaqRo",
  authDomain: "tholdem-ebc18.firebaseapp.com",
  projectId: "tholdem-ebc18",
  storageBucket: "tholdem-ebc18.appspot.com",
  messagingSenderId: "296074758861",
  appId: "1:296074758861:web:52498228694af470bcf784",
  measurementId: "G-S5BD0PBT3W"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // Export db as a named export
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to Firebase Emulators for local development
const isEmulator = process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true';

if (isEmulator) {
  console.log('?�� Connecting to Firebase Emulators...');
  
  try {
    // Connect Auth Emulator
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log('??Connected to Firebase Auth emulator');
  } catch (error) {
    console.log('?�� Auth emulator already connected or not available');
  }
  
  try {
    // Connect Firestore Emulator
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('??Connected to Firebase Firestore emulator');
  } catch (error) {
    console.log('?�� Firestore emulator already connected or not available');
  }
  
  try {
    // Connect Functions Emulator
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('??Connected to Firebase Functions emulator');
  } catch (error) {
    console.log('?�� Functions emulator already connected or not available');
  }
  
  console.log('?�� All Firebase services connected to emulators!');
} else {
  console.log('?�� Using production Firebase services');
}

export const setupTestData = async () => {
  const tablesCollectionRef = collection(db, 'tables');
  const snapshot = await getDocs(tablesCollectionRef);

  if (!snapshot.empty) {
    console.log("Test data already exists. Skipping setup.");
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
  // const participantsCollectionRef = collection(db, 'participants');
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
    console.log("Test data successfully written to Firestore.");
    return 'SUCCESS';
  } catch (error) {
    console.error("Error writing test data: ", error);
    return 'ERROR';
  }
};

export const promoteToStaff = async (
  userId: string, 
  userName: string, 
  jobRole: string, 
  postingId: string, 
  managerId: string, 
  assignedRole?: string, 
  assignedTime?: string,
  email?: string,
  phone?: string
) => {
  console.log('🚀 promoteToStaff function called:', { 
    userId, userName, jobRole, postingId, managerId, assignedRole, assignedTime, email, phone 
  });
  
  if (!userId || !jobRole || !userName || !postingId || !managerId) {
    console.error("User ID, User Name, Job Role, Posting ID, and Manager ID are required to promote to staff.");
    return;
  }

  const staffRef = doc(db, 'staff', userId);
  
  try {
    console.log('🔍 Checking existing staff document for:', userId);
    const staffSnap = await getDoc(staffRef);
    if (!staffSnap.exists()) {
      console.log('🎆 Creating new staff document');
      await setDoc(staffRef, {
        userId,
        name: userName,
        email: email || '',
        phone: phone || '',
        userRole: 'staff',
        jobRole: [jobRole],
        role: jobRole, // 호환성을 위해 단일 role 필드도 설정
        assignedEvents: [postingId],
        assignedRole: assignedRole || jobRole, // 지원자에서 확정된 역할
        assignedTime: assignedTime || '', // 지원자에서 확정된 시간
        createdAt: new Date(),
        managerId,
        postingId,
      });
      console.log(`✅ New staff document created for user: ${userName} (${userId}) with role: ${jobRole}`);
      } else {
      console.log('🔄 Updating existing staff document');
      // Update existing staff document with new job role and event assignment
      await updateDoc(staffRef, {
        userId,
        name: userName,
        email: email || '',
        phone: phone || '',
        jobRole: arrayUnion(jobRole),
        role: jobRole, // 가장 최근 역할로 업데이트
        assignedEvents: arrayUnion(postingId),
        assignedRole: assignedRole || jobRole, // 지원자에서 확정된 역할
        assignedTime: assignedTime || '', // 지원자에서 확정된 시간
        postingId, // 최신 공고 ID로 업데이트
        managerId // 관리자 ID도 업데이트
      });
      console.log(`Staff document updated for user: ${userName} (${userId}). Added role: ${jobRole} for posting: ${postingId}`);
    }
  } catch (error) {
    console.error(`Failed to promote user ${userName} (${userId}) to staff:`, error);
  }
};

interface PaginationOptions {
  limit?: number;
  startAfterDoc?: any;
}

// Build filtered query for job postings - COMPREHENSIVE INDEX VERSION
export const buildFilteredQuery = (
  filters: JobPostingFilters, 
  pagination?: PaginationOptions
): Query => {
  const jobPostingsRef = collection(db, 'jobPostings');
  const queryConstraints: any[] = [];
  
  console.log('?�� Building query with filters:', filters);
  
  // Always filter for open status
  queryConstraints.push(where('status', '==', 'open'));
  
  // Handle search queries with location/type support
  if (filters.searchTerms && filters.searchTerms.length > 0) {
    console.log('?�� Search mode activated with terms:', filters.searchTerms);
    queryConstraints.push(where('searchIndex', 'array-contains-any', filters.searchTerms));
    
    // Add location filter if specified (has index: status + searchIndex + location + createdAt)
    if (filters.location && filters.location !== 'all') {
      console.log('?�� Search + Location filter applied:', filters.location);
      queryConstraints.push(where('location', '==', filters.location));
    }
    // Add type filter if specified and no location (has index: status + searchIndex + type + createdAt)
    else if (filters.type && filters.type !== 'all') {
      console.log('?�� Search + Type filter applied:', filters.type);
      queryConstraints.push(where('type', '==', filters.type));
    }
    
    // Always use createdAt ordering for search results
    queryConstraints.push(orderBy('createdAt', 'desc'));
  } 
  // Handle date-based queries (prioritized because of range query limitations)
  else if (filters.startDate) {
    console.log('?�� Date filter applied:', filters.startDate);
    
    // Create date at start of day to match job postings
    const filterDate = new Date(filters.startDate);
    filterDate.setHours(0, 0, 0, 0);
    const startDateTimestamp = Timestamp.fromDate(filterDate);
    console.log('?�� Converted date to Timestamp:', startDateTimestamp);
    
    queryConstraints.push(where('startDate', '>=', startDateTimestamp));
    
    // Priority: Role filter first (if specified), then location/type
    // Note: Firebase doesn't allow inequality + array-contains in same query
    // So we prioritize role filter and do client-side filtering for others
    if (filters.role && filters.role !== 'all') {
      console.log('?�� Date + Role filter applied (prioritized):', filters.role);
      queryConstraints.push(where('requiredRoles', 'array-contains', filters.role));
      // Note: location/type will be filtered client-side
    }
    // Add location filter if no role filter (has index: status + location + startDate)
    else if (filters.location && filters.location !== 'all') {
      console.log('?�� Date + Location filter applied:', filters.location);
      queryConstraints.push(where('location', '==', filters.location));
    }
    // Add type filter if no role/location filter (has index: status + type + startDate)
    else if (filters.type && filters.type !== 'all') {
      console.log('?�� Date + Type filter applied:', filters.type);
      queryConstraints.push(where('type', '==', filters.type));
    }
    
    // Use startDate ordering for date-filtered queries
    queryConstraints.push(orderBy('startDate', 'asc'));
  }
  // Handle non-date queries
  else {
    // Add location filter
    if (filters.location && filters.location !== 'all') {
      console.log('?�� Location filter applied:', filters.location);
      queryConstraints.push(where('location', '==', filters.location));
    }
    
    // Add type filter
    if (filters.type && filters.type !== 'all') {
      console.log('?�� Type filter applied:', filters.type);
      queryConstraints.push(where('type', '==', filters.type));
    }
    
    // Add role filter
    if (filters.role && filters.role !== 'all') {
      console.log('?�� Role filter applied:', filters.role);
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
  
  console.log('?�� Final query constraints count:', queryConstraints.length);
  console.log('?�� Query constraints:', queryConstraints.map((c, i) => `${i}: ${c.type || 'unknown'}`));
  
  return query(jobPostingsRef, ...queryConstraints);
};

// Migration function to add searchIndex to existing job postings
export const migrateJobPostingsSearchIndex = async (): Promise<void> => {
  console.log('Starting searchIndex migration for job postings...');
  
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
      console.log(`Successfully updated ${updateCount} job postings with searchIndex`);
    } else {
      console.log('No job postings needed searchIndex migration');
    }
  } catch (error) {
    console.error('Error during searchIndex migration:', error);
    throw error;
  }
};

// Migration function to add requiredRoles to existing job postings
export const migrateJobPostingsRequiredRoles = async (): Promise<void> => {
  console.log('Starting requiredRoles migration for job postings...');
  
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
      
      // Extract roles from timeSlots
      const timeSlots = data.timeSlots || [];
      const requiredRoles = Array.from(new Set(
        timeSlots.flatMap((ts: any) => {
          if (ts.roles && Array.isArray(ts.roles)) {
            return ts.roles.map((r: any) => r.name);
          }
          return [];
        })
      ));
      
      console.log(`Document ${docSnapshot.id}: extracted roles:`, requiredRoles);
      
      // Update document
      const docRef = doc(db, 'jobPostings', docSnapshot.id);
      batch.update(docRef, { requiredRoles });
      updateCount++;
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updateCount} job postings with requiredRoles`);
    } else {
      console.log('No job postings needed requiredRoles migration');
    }
  } catch (error) {
    console.error('Error during requiredRoles migration:', error);
    throw error;
  }
};

// Migration function to convert string dates to Timestamps
export const migrateJobPostingsDateFormat = async (): Promise<void> => {
  console.log('Starting date format migration for job postings...');
  
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
          console.log(`Document ${docSnapshot.id}: converting date ${data.startDate} to Timestamp`);
          
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
          console.log(`Document ${docSnapshot.id}: converting endDate ${data.endDate} to Timestamp`);
          
          // Update document
          const docRef = doc(db, 'jobPostings', docSnapshot.id);
          batch.update(docRef, { endDate: endDateTimestamp });
          updateCount++;
        }
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updateCount} job postings with proper date format`);
    } else {
      console.log('No job postings needed date format migration');
    }
  } catch (error) {
    console.error('Error during date format migration:', error);
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
  console.log('?�� Starting all job postings migrations...');
  
  try {
    await migrateJobPostingsRequiredRoles();
    await migrateJobPostingsDateFormat();
    await migrateJobPostingsSearchIndex();
    console.log('??All job postings migrations completed successfully');
  } catch (error) {
    console.error('??Migration failed:', error);
    throw error;
  }
};
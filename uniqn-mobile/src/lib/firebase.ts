/**
 * UNIQN Mobile - Firebase 설정
 *
 * TODO [출시 전]: 환경별 Firebase 프로젝트 분리 (dev/staging/prod)
 * TODO [출시 전]: Firebase Analytics 초기화 추가
 * TODO [출시 전]: Crashlytics 초기화 추가
 * TODO [출시 전]: Firebase Performance Monitoring 추가
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase 설정 (tholdem-ebc18 프로젝트)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 앱 초기화 (중복 방지)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth 초기화 (플랫폼별 persistence 설정)
// 웹에서는 기본 browser persistence, React Native에서는 AsyncStorage 사용
const auth: Auth = getAuth(app)

// Firestore 초기화
const db = getFirestore(app);

// Storage 초기화
const storage = getStorage(app);

// Cloud Functions 초기화
const functions = getFunctions(app, 'asia-northeast3');

export { app, auth, db, storage, functions };
export default app;

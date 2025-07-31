/**
 * Firebase 동적 import 유틸리티
 * Storage와 Functions를 lazy loading으로 처리하여 번들 크기 감소
 */

import { getApp } from 'firebase/app';

// Storage 모듈 캐시
let storageModule: any = null;
let storageInstance: any = null;
let functionsModule: any = null;
let functionsInstance: any = null;

// 에뮬레이터 설정
const isEmulator = process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true';

/**
 * Firebase Storage를 동적으로 가져옵니다.
 * 처음 호출 시에만 import하고 이후에는 캐시된 모듈을 반환합니다.
 */
export const getStorageLazy = async () => {
  if (!storageModule) {
    console.log('🔄 Firebase Storage 모듈 로딩 중...');
    const startTime = performance.now();
    
    storageModule = await import('firebase/storage');
    
    const loadTime = performance.now() - startTime;
    console.log(`✅ Firebase Storage 로드 완료 (${loadTime.toFixed(2)}ms)`);
  }
  
  if (!storageInstance) {
    const app = getApp();
    storageInstance = storageModule.getStorage(app);
    
    // Storage 에뮬레이터는 별도 설정 없음
    console.log(`📦 Firebase Storage 인스턴스 생성 완료`);
  }
  
  return storageInstance;
};

/**
 * Firebase Storage 참조를 생성합니다.
 * @param path 스토리지 경로
 */
export const getStorageRefLazy = async (path: string) => {
  const storage = await getStorageLazy();
  return storageModule.ref(storage, path);
};

/**
 * 파일을 Firebase Storage에 업로드합니다.
 * @param file 업로드할 파일
 * @param path 저장 경로
 */
export const uploadFileLazy = async (file: File, path: string) => {
  const storage = await getStorageLazy();
  const storageRef = storageModule.ref(storage, path);
  
  // 업로드 진행
  const uploadTask = storageModule.uploadBytesResumable(storageRef, file);
  
  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot: any) => {
        // 진행률 계산
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`📤 업로드 진행률: ${progress.toFixed(0)}%`);
      },
      (error: any) => {
        console.error('❌ 업로드 오류:', error);
        reject(error);
      },
      async () => {
        // 업로드 완료 후 다운로드 URL 가져오기
        const downloadURL = await storageModule.getDownloadURL(uploadTask.snapshot.ref);
        console.log('✅ 업로드 완료:', downloadURL);
        resolve(downloadURL);
      }
    );
  });
};

/**
 * Firebase Functions를 동적으로 가져옵니다.
 * 처음 호출 시에만 import하고 이후에는 캐시된 모듈을 반환합니다.
 */
export const getFunctionsLazy = async () => {
  if (!functionsModule) {
    console.log('🔄 Firebase Functions 모듈 로딩 중...');
    const startTime = performance.now();
    
    functionsModule = await import('firebase/functions');
    
    const loadTime = performance.now() - startTime;
    console.log(`✅ Firebase Functions 로드 완료 (${loadTime.toFixed(2)}ms)`);
  }
  
  if (!functionsInstance) {
    const app = getApp();
    functionsInstance = functionsModule.getFunctions(app);
    
    // 에뮬레이터 연결
    if (isEmulator) {
      try {
        functionsModule.connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
        console.log('🔗 Firebase Functions 에뮬레이터 연결됨');
      } catch (error) {
        console.log('ℹ️ Functions 에뮬레이터 이미 연결되어 있거나 사용할 수 없음');
      }
    }
    
    console.log(`⚡ Firebase Functions 인스턴스 생성 완료`);
  }
  
  return functionsInstance;
};

/**
 * Firebase Function을 호출합니다.
 * @param functionName 함수 이름
 * @param data 전달할 데이터
 */
export const callFunctionLazy = async (functionName: string, data?: any) => {
  const functions = await getFunctionsLazy();
  const callable = functionsModule.httpsCallable(functions, functionName);
  
  try {
    console.log(`🔄 Cloud Function 호출 중: ${functionName}`);
    const result = await callable(data);
    console.log(`✅ Cloud Function 호출 성공: ${functionName}`);
    return result.data;
  } catch (error) {
    console.error(`❌ Cloud Function 호출 실패: ${functionName}`, error);
    throw error;
  }
};

/**
 * 파일 다운로드 URL을 가져옵니다.
 * @param path 스토리지 경로
 */
export const getDownloadURLLazy = async (path: string) => {
  if (!storageModule) {
    await getStorageLazy();
  }
  
  const storage = storageModule.getStorage();
  const storageRef = storageModule.ref(storage, path);
  
  try {
    const url = await storageModule.getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error('다운로드 URL 가져오기 실패:', error);
    throw error;
  }
};

/**
 * 파일을 삭제합니다.
 * @param path 스토리지 경로
 */
export const deleteFileLazy = async (path: string) => {
  if (!storageModule) {
    await getStorageLazy();
  }
  
  const storage = storageModule.getStorage();
  const storageRef = storageModule.ref(storage, path);
  
  try {
    await storageModule.deleteObject(storageRef);
    console.log('✅ 파일 삭제 완료:', path);
  } catch (error) {
    console.error('파일 삭제 실패:', error);
    throw error;
  }
};

/**
 * 모듈 로드 상태를 확인합니다.
 */
export const getLoadStatus = () => {
  return {
    storage: storageModule !== null,
    functions: functionsModule !== null
  };
};

/**
 * 모듈을 미리 로드합니다.
 * 사용자가 기능을 사용하기 전에 백그라운드에서 로드할 수 있습니다.
 */
export const preloadModules = async () => {
  console.log('🔄 Firebase 모듈 사전 로딩 시작...');
  
  const promises = [];
  
  // Storage 모듈 사전 로딩
  if (!storageModule) {
    promises.push(getStorageLazy());
  }
  
  // Functions 모듈 사전 로딩
  if (!functionsModule) {
    promises.push(getFunctionsLazy());
  }
  
  if (promises.length > 0) {
    await Promise.all(promises);
    console.log('✅ Firebase 모듈 사전 로딩 완료');
  } else {
    console.log('ℹ️ 모든 모듈이 이미 로드되어 있습니다');
  }
};
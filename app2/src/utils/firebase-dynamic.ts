/**
 * Firebase 동적 import 유틸리티
 * Storage와 Functions를 lazy loading으로 처리하여 번들 크기 감소
 */

import { getApp } from 'firebase/app';

import { logger } from '../utils/logger';

// Storage 모듈 캐시
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 동적 import된 Firebase 모듈, 타입 추론 불가
let storageModule: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firebase Storage 인스턴스, 동적 로딩으로 타입 불명확
let storageInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 동적 import된 Firebase Functions 모듈
let functionsModule: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firebase Functions 인스턴스, 동적 로딩으로 타입 불명확
let functionsInstance: any = null;

// 에뮬레이터 설정
const isEmulator = process.env.REACT_APP_USE_FIREBASE_EMULATOR === 'true';

/**
 * Firebase Storage를 동적으로 가져옵니다.
 * 처음 호출 시에만 import하고 이후에는 캐시된 모듈을 반환합니다.
 */
export const getStorageLazy = async () => {
  if (!storageModule) {
    storageModule = await import('firebase/storage');
  }

  if (!storageInstance) {
    const app = getApp();
    storageInstance = storageModule.getStorage(app);
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
      () => {
        // 진행률 추적 (UI 업데이트 시 활용 가능)
      },
      (error: any) => {
        logger.error('❌ 업로드 오류:', error instanceof Error ? error : new Error(String(error)), {
          component: 'firebase-dynamic',
        });
        reject(error);
      },
      async () => {
        const downloadURL = await storageModule.getDownloadURL(uploadTask.snapshot.ref);
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
    functionsModule = await import('firebase/functions');
  }

  if (!functionsInstance) {
    const app = getApp();
    functionsInstance = functionsModule.getFunctions(app);

    if (isEmulator) {
      try {
        functionsModule.connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
      } catch (error) {
        // 에뮬레이터 이미 연결됨 또는 사용 불가
      }
    }
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
    const result = await callable(data);
    return result.data;
  } catch (error) {
    logger.error(
      `❌ Cloud Function 호출 실패: ${functionName}`,
      error instanceof Error ? error : new Error(String(error)),
      { component: 'firebase-dynamic' }
    );
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
    logger.error(
      '다운로드 URL 가져오기 실패:',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'firebase-dynamic' }
    );
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
  } catch (error) {
    logger.error('파일 삭제 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'firebase-dynamic',
    });
    throw error;
  }
};

/**
 * 모듈 로드 상태를 확인합니다.
 */
export const getLoadStatus = () => {
  return {
    storage: storageModule !== null,
    functions: functionsModule !== null,
  };
};

/**
 * 모듈을 미리 로드합니다.
 * 사용자가 기능을 사용하기 전에 백그라운드에서 로드할 수 있습니다.
 */
export const preloadModules = async () => {
  const promises = [];

  if (!storageModule) {
    promises.push(getStorageLazy());
  }

  if (!functionsModule) {
    promises.push(getFunctionsLazy());
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
};

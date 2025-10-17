import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

import { logger } from '../utils/logger';

export interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
  source?: CameraSource;
  width?: number;
  height?: number;
}

/**
 * 카메라로 사진 촬영
 */
export const takePhoto = async (options: CameraOptions = {}): Promise<Photo | null> => {
  // 네이티브 플랫폼에서만 카메라 기능 지원
  if (!Capacitor.isNativePlatform()) {
    logger.warn('카메라 기능은 네이티브 앱에서만 지원됩니다');

    // 웹에서는 파일 input으로 대체
    return await selectImageFromGallery();
  }

  try {
    const defaultOptions = {
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // 카메라 또는 갤러리 선택
      width: 1024,
      height: 1024,
      ...options
    };

    const photo = await Camera.getPhoto(defaultOptions);
    logger.info('사진 촬영 완료');

    return photo;
  } catch (error) {
    logger.error('사진 촬영 실패:', error as Error);
    return null;
  }
};

/**
 * 갤러리에서 이미지 선택
 */
export const selectFromGallery = async (options: CameraOptions = {}): Promise<Photo | null> => {
  try {
    const defaultOptions = {
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos, // 갤러리만
      width: 1024,
      height: 1024,
      ...options
    };

    const photo = await Camera.getPhoto(defaultOptions);
    logger.info('갤러리 이미지 선택 완료');

    return photo;
  } catch (error) {
    logger.error('갤러리 이미지 선택 실패:', error as Error);
    return null;
  }
};

/**
 * 카메라로 직접 촬영
 */
export const takeCameraPhoto = async (options: CameraOptions = {}): Promise<Photo | null> => {
  try {
    const defaultOptions = {
      quality: 90,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera, // 카메라만
      width: 1024,
      height: 1024,
      ...options
    };

    const photo = await Camera.getPhoto(defaultOptions);
    logger.info('카메라 촬영 완료');

    return photo;
  } catch (error) {
    logger.error('카메라 촬영 실패:', error as Error);
    return null;
  }
};

/**
 * 웹 브라우저에서 이미지 선택 (파일 input 사용)
 */
const selectImageFromGallery = (): Promise<Photo | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = false;

    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;

        const photo: Photo = {
          dataUrl,
          format: file.type.split('/')[1] || 'jpeg',
          saved: false
        };

        logger.info('웹 이미지 선택 완료');
        resolve(photo);
      };

      reader.onerror = () => {
        logger.error('이미지 읽기 실패');
        resolve(null);
      };

      reader.readAsDataURL(file);
    };

    input.oncancel = () => {
      resolve(null);
    };

    input.click();
  });
};

/**
 * Photo 객체에서 Blob 생성
 */
export const photoToBlob = async (photo: Photo): Promise<Blob | null> => {
  try {
    if (!photo.dataUrl) {
      logger.error('Photo에 dataUrl이 없습니다');
      return null;
    }

    // DataURL을 Blob으로 변환
    const response = await fetch(photo.dataUrl);
    const blob = await response.blob();

    return blob;
  } catch (error) {
    logger.error('Photo를 Blob으로 변환 실패:', error as Error);
    return null;
  }
};

/**
 * 이미지 크기 조정
 */
export const resizeImage = (
  dataUrl: string,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context를 생성할 수 없습니다'));
        return;
      }

      // 비율 계산
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // 이미지 그리기
      ctx.drawImage(img, 0, 0, width, height);

      // DataURL로 변환
      const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(resizedDataUrl);
    };

    img.onerror = () => {
      reject(new Error('이미지 로드 실패'));
    };

    img.src = dataUrl;
  });
};

/**
 * 카메라 권한 확인
 */
export const checkCameraPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    // 웹에서는 사용자가 직접 파일을 선택하므로 권한이 필요 없음
    return true;
  }

  try {
    const permissions = await Camera.checkPermissions();
    return permissions.camera === 'granted';
  } catch (error) {
    logger.error('카메라 권한 확인 실패:', error as Error);
    return false;
  }
};

/**
 * 카메라 권한 요청
 */
export const requestCameraPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  try {
    const permissions = await Camera.requestPermissions();
    return permissions.camera === 'granted';
  } catch (error) {
    logger.error('카메라 권한 요청 실패:', error as Error);
    return false;
  }
};
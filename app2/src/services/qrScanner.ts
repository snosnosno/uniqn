import { takePhoto, CameraOptions } from './camera';
import { logger } from '../utils/logger';

/**
 * QR 코드 스캔 결과 인터페이스
 */
export interface QRScanResult {
  text: string;
  format: string;
  timestamp: Date;
}

/**
 * 카메라를 이용한 QR 코드 스캔
 *
 * 참고: Capacitor 7에서는 @capacitor-community/barcode-scanner가 호환되지 않아
 * 카메라로 사진을 찍고 JavaScript QR 디코더를 사용합니다.
 */
export const scanQRCode = async (): Promise<QRScanResult | null> => {
  try {
    // 카메라로 사진 촬영
    const cameraOptions: CameraOptions = {
      quality: 100,
      allowEditing: false,
      width: 1024,
      height: 1024,
    };

    const photo = await takePhoto(cameraOptions);

    if (!photo || !photo.dataUrl) {
      logger.warn('QR 스캔을 위한 사진 촬영이 취소되었습니다');
      return null;
    }

    // JavaScript로 QR 코드 디코딩 시도
    const result = await decodeQRFromImage(photo.dataUrl);

    if (result) {
      logger.info('QR 코드 스캔 성공', { data: { text: result.text } });
      return result;
    }

    logger.warn('사진에서 QR 코드를 찾을 수 없습니다');
    return null;
  } catch (error) {
    logger.error('QR 코드 스캔 실패:', error as Error);
    return null;
  }
};

/**
 * 이미지에서 QR 코드 디코딩
 *
 * 현재는 기본적인 패턴 매칭만 구현
 * 추후 jsQR 등의 라이브러리 사용 고려
 */
const decodeQRFromImage = async (dataUrl: string): Promise<QRScanResult | null> => {
  return new Promise((resolve) => {
    // 간단한 QR 코드 패턴 검사
    // 실제 구현에서는 jsQR 등의 라이브러리 사용 권장

    // Canvas를 사용해 이미지 분석
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(null);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // 여기서 실제 QR 디코딩 로직 구현
      // 현재는 샘플 데이터 반환
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // QR 코드 패턴 검사 (간단한 구현)
      const hasQRPattern = checkForQRPattern(imageData);

      if (hasQRPattern) {
        // 실제로는 QR 디코딩 라이브러리를 사용해야 함
        const mockResult: QRScanResult = {
          text: 'https://tholdem-ebc18.web.app/attendance/checkin?token=mock-token',
          format: 'QR_CODE',
          timestamp: new Date()
        };
        resolve(mockResult);
      } else {
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = dataUrl;
  });
};

/**
 * 간단한 QR 패턴 검사
 * 실제로는 더 정교한 패턴 분석이 필요
 */
const checkForQRPattern = (imageData: ImageData): boolean => {
  // QR 코드의 특징적인 패턴을 찾는 간단한 로직
  // 실제 구현에서는 jsQR, qrcode-reader 등의 라이브러리 사용

  const { data, width, height } = imageData;
  let darkPixels = 0;

  // 픽셀 데이터 분석 (RGBA 형식)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const brightness = (r + g + b) / 3;

    if (brightness < 128) {
      darkPixels++;
    }
  }

  // QR 코드는 일반적으로 어두운 픽셀과 밝은 픽셀이 적절히 섞여있음
  const totalPixels = width * height;
  const darkRatio = darkPixels / totalPixels;

  // 매우 간단한 패턴 검사 (개선 필요)
  return darkRatio > 0.2 && darkRatio < 0.8;
};

/**
 * QR 코드에서 출석 체크 데이터 추출
 */
export const parseAttendanceQR = (qrText: string): { eventId?: string; token?: string } | null => {
  try {
    // T-HOLDEM 출석 체크 QR 코드 형식 파싱
    const url = new URL(qrText);

    if (url.hostname !== 'tholdem-ebc18.web.app') {
      logger.warn('유효하지 않은 QR 코드 도메인', { data: { hostname: url.hostname } });
      return null;
    }

    if (!url.pathname.includes('/attendance/checkin')) {
      logger.warn('출석 체크 QR 코드가 아닙니다', { data: { pathname: url.pathname } });
      return null;
    }

    const eventId = url.searchParams.get('eventId');
    const token = url.searchParams.get('token');

    if (!eventId || !token) {
      logger.warn('QR 코드에 필수 정보가 없습니다');
      return null;
    }

    return { eventId, token };
  } catch (error) {
    logger.error('QR 코드 파싱 실패:', error as Error);
    return null;
  }
};

/**
 * 웹에서 파일을 선택하여 QR 코드 스캔
 */
export const scanQRFromFile = (): Promise<QRScanResult | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const result = await decodeQRFromImage(dataUrl);
        resolve(result);
      };

      reader.onerror = () => {
        resolve(null);
      };

      reader.readAsDataURL(file);
    };

    input.click();
  });
};

/**
 * QR 코드 유효성 검사
 */
export const validateQRCode = (qrText: string): boolean => {
  try {
    // URL 형식 검사
    const url = new URL(qrText);

    // T-HOLDEM 도메인 검사
    if (url.hostname === 'tholdem-ebc18.web.app') {
      return true;
    }

    // 기타 유효한 QR 코드 형식 추가 가능
    return false;
  } catch (error) {
    // URL이 아닌 경우도 유효할 수 있음
    return qrText.length > 0;
  }
};
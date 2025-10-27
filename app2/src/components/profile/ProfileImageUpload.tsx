import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { getStorageLazy } from '../../utils/firebase-dynamic';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from '../../contexts/AuthContext';

interface ProfileImageUploadProps {
  currentImageUrl?: string | null;
  onImageUpdate: (imageUrl: string | null) => void;
  className?: string;
}

const ProfileImageUpload: React.FC<ProfileImageUploadProps> = ({
  currentImageUrl,
  onImageUpdate,
  className = ''
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [showCropper, setShowCropper] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (5MB 제한)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profileImage.fileSizeError', '파일 크기는 5MB 이하여야 합니다.'));
      return;
    }

    // 파일 타입 체크
    if (!file.type.startsWith('image/')) {
      toast.error(t('profileImage.fileTypeError', '이미지 파일만 업로드할 수 있습니다.'));
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const imageElement = new Image();
      const imageUrl = reader.result?.toString() || '';
      setImageSrc(imageUrl);

      imageElement.addEventListener('load', (e) => {
        const { naturalWidth, naturalHeight } = e.currentTarget as HTMLImageElement;

        // 1:1 비율로 자동 크롭 영역 설정
        const crop = centerCrop(
          makeAspectCrop(
            {
              unit: '%',
              width: 90,
            },
            1,
            naturalWidth,
            naturalHeight,
          ),
          naturalWidth,
          naturalHeight,
        );
        setCrop(crop);
        setShowCropper(true);
      });
      imageElement.src = imageUrl;
    });
    reader.readAsDataURL(file);
  }, [t]);

  // 캔버스에 크롭된 이미지 그리기
  const drawCroppedImage = useCallback((
    canvas: HTMLCanvasElement,
    image: HTMLImageElement,
    crop: PixelCrop,
    scale = 1,
    rotate = 0,
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio;

    canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;

    const rotateRads = rotate * Math.PI / 180;
    const centerX = image.naturalWidth / 2;
    const centerY = image.naturalHeight / 2;

    ctx.save();
    ctx.translate(-cropX, -cropY);
    ctx.translate(centerX, centerY);
    ctx.rotate(rotateRads);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
    );
    ctx.restore();
  }, []);

  // 크롭된 이미지를 Blob으로 변환
  const getCroppedImageBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!completedCrop || !imgRef.current || !canvasRef.current) {
        resolve(null);
        return;
      }

      const canvas = canvasRef.current;
      const image = imgRef.current;

      drawCroppedImage(canvas, image, completedCrop);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  }, [completedCrop, drawCroppedImage]);

  // 이미지 업로드 함수
  const uploadImage = useCallback(async () => {
    if (!currentUser || !selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const storage = await getStorageLazy();

      let uploadBlob: Blob;

      if (completedCrop && imgRef.current) {
        // 크롭된 이미지 사용
        const croppedBlob = await getCroppedImageBlob();
        if (!croppedBlob) {
          throw new Error('크롭된 이미지를 생성할 수 없습니다.');
        }
        uploadBlob = croppedBlob;
      } else {
        // 원본 이미지 사용
        uploadBlob = selectedFile;
      }

      // 이전 이미지 삭제 (기존 이미지가 있는 경우)
      if (currentImageUrl) {
        try {
          const oldImageRef = ref(storage, currentImageUrl);
          await deleteObject(oldImageRef);
          logger.info('이전 프로필 이미지 삭제 완료', {
            component: 'ProfileImageUpload',
            data: { oldImageUrl: currentImageUrl }
          });
        } catch (deleteError) {
          logger.warn('이전 이미지 삭제 실패 (계속 진행)', {
            component: 'ProfileImageUpload',
            error: deleteError instanceof Error ? deleteError.message : String(deleteError)
          });
        }
      }

      // 새 이미지 업로드
      const imageRef = ref(storage, `profile-images/${currentUser.uid}/${Date.now()}.jpg`);
      const uploadTask = uploadBytesResumable(imageRef, uploadBlob);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          logger.error('이미지 업로드 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'ProfileImageUpload' });
          throw error;
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            logger.info('프로필 이미지 업로드 완료', {
              component: 'ProfileImageUpload',
              data: { downloadURL }
            });

            onImageUpdate(downloadURL);
            toast.success(t('profileImage.uploadSuccess'));

            // 상태 초기화
            setSelectedFile(null);
            setImageSrc('');
            setShowCropper(false);
            setUploadProgress(0);
          } catch (urlError) {
            logger.error('다운로드 URL 생성 실패:', urlError instanceof Error ? urlError : new Error(String(urlError)), { component: 'ProfileImageUpload' });
            throw urlError;
          }
        }
      );
    } catch (error) {
      logger.error('프로필 이미지 업로드 중 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'ProfileImageUpload' });
      toast.error(t('profileImage.uploadError', '이미지 업로드 중 오류가 발생했습니다.'));
    } finally {
      setIsUploading(false);
    }
  }, [currentUser, selectedFile, completedCrop, getCroppedImageBlob, currentImageUrl, onImageUpdate, t]);

  // 이미지 삭제 함수
  const deleteImage = useCallback(async () => {
    if (!currentImageUrl || !currentUser) return;

    try {
      setIsUploading(true);
      const storage = await getStorageLazy();
      const imageRef = ref(storage, currentImageUrl);

      await deleteObject(imageRef);
      onImageUpdate(null);

      logger.info('프로필 이미지 삭제 완료', {
        component: 'ProfileImageUpload',
        data: { deletedUrl: currentImageUrl }
      });

      toast.success(t('profileImage.deleteSuccess'));
    } catch (error) {
      logger.error('프로필 이미지 삭제 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'ProfileImageUpload' });
      toast.error(t('profileImage.deleteError', '이미지 삭제 중 오류가 발생했습니다.'));
    } finally {
      setIsUploading(false);
    }
  }, [currentImageUrl, currentUser, onImageUpdate, t]);

  const handleCropComplete = (crop: PixelCrop) => {
    setCompletedCrop(crop);
  };

  const cancelCrop = () => {
    setShowCropper(false);
    setSelectedFile(null);
    setImageSrc('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`profile-image-upload ${className}`}>
      {/* 현재 프로필 이미지 표시 */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={t('profileImage.currentImage')}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
        </div>

        {/* 업로드 버튼들 */}
        <div className="flex space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {t('profileImage.selectImage', '이미지 선택')}
          </button>

          {currentImageUrl && (
            <button
              onClick={deleteImage}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {t('profileImage.deleteImage', '삭제')}
            </button>
          )}
        </div>

        {/* 업로드 진행률 */}
        {isUploading && (
          <div className="w-full max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                {t('profileImage.uploading', '업로드 중...')}
              </span>
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
                {uploadProgress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 이미지 크롭 모달 */}
      {showCropper && imageSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              {t('profileImage.cropTitle', '이미지 자르기')}
            </h3>

            <div className="mb-4">
              <ReactCrop
                crop={crop || { unit: '%', width: 50, height: 50, x: 25, y: 25 }}
                onChange={setCrop}
                onComplete={handleCropComplete}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt={t('profileImage.cropPreview', '크롭 미리보기')}
                  className="max-w-full max-h-96"
                />
              </ReactCrop>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelCrop}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {t('profileImage.cancel', '취소')}
              </button>
              <button
                onClick={uploadImage}
                disabled={!completedCrop || isUploading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 border border-transparent rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isUploading
                  ? t('profileImage.uploading', '업로드 중...')
                  : t('profileImage.upload', '업로드')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨겨진 캔버스 (크롭 처리용) */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default ProfileImageUpload;
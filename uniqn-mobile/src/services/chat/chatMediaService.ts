/**
 * UNIQN Mobile — 채팅 사진: 고르기 → 재인코딩 → 업로드 (S2b)
 *
 * 🔒 개인정보: 원본 파일은 **절대 올리지 않는다.** 항상 manipulator 로 다시 그려 JPEG 로 저장하고,
 *    그 결과 바이트만 올린다. 재인코딩은 EXIF(GPS·기기 정보)를 버린다 — 작은 사진도 리사이즈만
 *    생략하고 재인코딩은 거친다. (웹은 E2E 가 EXIF 부재를 단언, 네이티브는 실기기 체크리스트)
 * 🔑 업로드 바이트는 base64 → ArrayBuffer. RN 에서 fetch(file://)→Blob 을 넘기면 0바이트가
 *    저장된다(storageService.ts 머리말 — 2026-07-24 실사고).
 * 🔑 경로는 서버가 `format('%s/%s/%s.jpg', 방, uid, clientMessageId)` 과 **완전 일치**로 대조한다
 *    → 전부 소문자.
 */
import { Platform } from 'react-native';
import { toByteArray } from 'base64-js';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { BusinessError } from '@/errors/AppError';
import { CHAT_ERROR_CODES } from '@/errors/chat';
import { chatRepository } from '@/repositories/chat';
import { CHAT_IMAGE_LONG_EDGE, CHAT_JPEG_QUALITY, CHAT_MAX_UPLOAD_BYTES } from '@/constants/chat';
import { logger } from '@/utils/logger';

/** 한도를 넘었을 때 한 번 더 시도하는 품질 */
const CHAT_JPEG_RETRY_QUALITY = 0.6;

export type ChatImageSource = 'library' | 'camera';

/** 고른 원본(아직 올리면 안 되는 것) */
export interface PickedChatImage {
  uri: string;
  width: number;
  height: number;
}

/** 재인코딩을 마친, 올려도 되는 사진 */
export interface PreparedChatImage {
  bytes: ArrayBuffer;
  width: number;
  height: number;
}

function imageRejected(
  message: string,
  userMessage = '사진을 보낼 수 없어요. 다시 선택해 주세요.'
) {
  return new BusinessError(CHAT_ERROR_CODES.CHAT_IMAGE_INVALID, { message, userMessage });
}

/** 긴 변이 기준을 넘을 때만 그 변을 기준으로 줄인다(비율 유지). 아니면 null */
export function chatImageResizeTarget(
  width: number,
  height: number
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= CHAT_IMAGE_LONG_EDGE) return null;
  return width >= height ? { width: CHAT_IMAGE_LONG_EDGE } : { height: CHAT_IMAGE_LONG_EDGE };
}

/** 웹 구현은 renderAsync·saveAsync 마다 blob URL 을 만들고 해제하지 않는다 — 여기서 해제한다 */
function revokeWebUri(uri: unknown): void {
  if (Platform.OS !== 'web' || typeof uri !== 'string' || !uri.startsWith('blob:')) return;
  URL.revokeObjectURL(uri);
}

/** 네이티브 SharedObject 는 GC 를 기다리지 않고 바로 놓는다(웹에는 release 가 없을 수 있다) */
function releaseShared(obj: unknown): void {
  const release = (obj as { release?: () => void } | null)?.release;
  if (typeof release === 'function') release.call(obj);
}

async function encodeJpeg(picked: PickedChatImage, compress: number): Promise<PreparedChatImage> {
  const context = ImageManipulator.manipulate(picked.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | null = null;
  try {
    const target = chatImageResizeTarget(picked.width, picked.height);
    if (target) context.resize(target);
    rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    revokeWebUri(saved.uri);
    if (!saved.base64) throw imageRejected('재인코딩 결과 base64 가 비었습니다');
    const bytes = toByteArray(saved.base64);
    return {
      bytes: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      width: saved.width,
      height: saved.height,
    };
  } finally {
    revokeWebUri((rendered as { uri?: unknown } | null)?.uri);
    releaseShared(rendered);
    releaseShared(context);
  }
}

/** 긴 변 1600 · JPEG 0.8 로 다시 그린다. 1.5MB 를 넘으면 0.6 으로 한 번 더, 그래도 넘으면 거부 */
export async function prepareChatImage(picked: PickedChatImage): Promise<PreparedChatImage> {
  const first = await encodeJpeg(picked, CHAT_JPEG_QUALITY);
  if (first.bytes.byteLength <= CHAT_MAX_UPLOAD_BYTES) return first;

  const second = await encodeJpeg(picked, CHAT_JPEG_RETRY_QUALITY);
  if (second.bytes.byteLength <= CHAT_MAX_UPLOAD_BYTES) return second;

  logger.warn('채팅 사진이 재인코딩 후에도 한도를 넘음', {
    component: 'chatMediaService',
    bytes: second.bytes.byteLength,
  });
  throw imageRejected(
    '재인코딩 후에도 업로드 한도 초과',
    '사진 용량이 너무 커요. 다른 사진을 골라 주세요.'
  );
}

/** 서버가 완전 일치로 대조하는 경로 — 전부 소문자 */
export function buildChatImagePath(
  conversationId: string,
  uid: string,
  clientMessageId: string
): string {
  return `${conversationId}/${uid}/${clientMessageId}.jpg`.toLowerCase();
}

export interface UploadChatImageInput {
  conversationId: string;
  uid: string;
  clientMessageId: string;
  image: PreparedChatImage;
}

/** 재인코딩된 바이트를 올리고 경로를 돌려준다(이미 있으면 성공 — 재전송) */
export async function uploadChatImage(input: UploadChatImageInput): Promise<string> {
  const path = buildChatImagePath(input.conversationId, input.uid, input.clientMessageId);
  await chatRepository.uploadImage(path, input.image.bytes);
  return path;
}

/**
 * 앨범/카메라에서 1장 고른다. 권한 거부·취소는 null(호출자가 안내).
 * 편집(자르기)은 끄고 원본 비율 그대로 받는다 — 재인코딩은 prepareChatImage 가 한다.
 */
export async function pickChatImage(
  source: ChatImageSource
): Promise<PickedChatImage | 'denied' | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset || !asset.width || !asset.height) return null;
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

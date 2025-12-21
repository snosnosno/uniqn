/**
 * UNIQN Mobile - 강제/권장 업데이트 모달
 *
 * @description 앱 버전 업데이트 안내 모달
 * @version 1.0.0
 *
 * 타입별 동작:
 * - required: 앱 사용 불가, 닫기 버튼 없음
 * - recommended: 닫기 가능, N일 후 다시 표시
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { type UpdateType } from '@/constants/version';

// ============================================================================
// Types
// ============================================================================

export interface ForceUpdateModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 업데이트 타입 */
  updateType: UpdateType;
  /** 현재 버전 */
  currentVersion: string;
  /** 최소/권장 버전 */
  targetVersion: string;
  /** 스토어 이동 핸들러 */
  onUpdate: () => Promise<void>;
  /** 닫기 핸들러 (권장 업데이트만) */
  onDismiss?: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ForceUpdateModal({
  visible,
  updateType,
  currentVersion,
  targetVersion,
  onUpdate,
  onDismiss,
  isLoading = false,
}: ForceUpdateModalProps): React.ReactElement | null {
  const isRequired = updateType === 'required';
  const canDismiss = !isRequired && onDismiss;

  const handleUpdate = useCallback(async () => {
    try {
      await onUpdate();
    } catch {
      // 에러는 useVersionCheck에서 처리
    }
  }, [onUpdate]);

  if (updateType === 'none' || updateType === 'optional') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={canDismiss ? onDismiss : undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* 아이콘 */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{isRequired ? '🚨' : '📢'}</Text>
          </View>

          {/* 제목 */}
          <Text style={styles.title}>
            {isRequired ? '업데이트 필요' : '새 버전 안내'}
          </Text>

          {/* 설명 */}
          <Text style={styles.description}>
            {isRequired
              ? '앱을 계속 사용하려면 최신 버전으로 업데이트해주세요.'
              : '새로운 기능과 개선사항이 포함된 업데이트가 있습니다.'}
          </Text>

          {/* 버전 정보 */}
          <View style={styles.versionContainer}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>현재 버전</Text>
              <Text style={styles.versionValue}>{currentVersion}</Text>
            </View>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>
                {isRequired ? '최소 버전' : '권장 버전'}
              </Text>
              <Text style={styles.versionValueNew}>{targetVersion}</Text>
            </View>
          </View>

          {/* 버튼 영역 */}
          <View style={styles.buttonContainer}>
            {/* 업데이트 버튼 */}
            <Pressable
              style={({ pressed }) => [
                styles.updateButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleUpdate}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="앱스토어에서 업데이트"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.updateButtonText}>업데이트</Text>
              )}
            </Pressable>

            {/* 닫기 버튼 (권장 업데이트만) */}
            {canDismiss && (
              <Pressable
                style={({ pressed }) => [
                  styles.dismissButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onDismiss}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="나중에 하기"
              >
                <Text style={styles.dismissButtonText}>나중에</Text>
              </Pressable>
            )}
          </View>

          {/* 안내 문구 */}
          {isRequired && (
            <Text style={styles.notice}>
              * 이 업데이트는 필수이며, 업데이트 전까지 앱을 사용할 수 없습니다.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 48, 360);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    width: MODAL_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  versionContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  versionValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  versionValueNew: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  updateButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dismissButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  notice: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default ForceUpdateModal;

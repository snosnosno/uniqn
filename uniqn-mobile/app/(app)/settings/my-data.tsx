/**
 * UNIQN Mobile - 개인정보 열람 화면
 *
 * @description 개인정보 열람/수정/내보내기 화면 (법적 필수)
 * @version 1.0.0
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Share, ActivityIndicator, Pressable } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore, useThemeStore, useToastStore } from '@/stores';
import { getMyData, exportMyData, updateUserProfile } from '@/services';
import type { FirestoreUserProfile } from '@/types';
import { logger } from '@/utils/logger';
import { toDate, type DateInput } from '@/utils/date';
import { formatBirthDate } from '@/utils/formatters';

// ============================================================================
// Data Row Component
// ============================================================================

interface DataRowProps {
  label: string;
  value: string | null;
  editable?: boolean;
  onEdit?: () => void;
}

function DataRow({ label, value, editable, onEdit }: DataRowProps) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-secondary-100 dark:border-surface-overlay">
      <Text className="text-secondary-600 dark:text-secondary-400 text-sm">{label}</Text>
      <View className="flex-row items-center">
        <Text className="text-secondary-900 dark:text-white font-medium mr-2">{value || '-'}</Text>
        {editable && onEdit && (
          <Pressable onPress={onEdit}>
            <Text className="text-primary-600 dark:text-primary-400 text-sm">수정</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Screen Component
// ============================================================================

export default function MyDataScreen() {
  const { isDarkMode } = useThemeStore();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [userData, setUserData] = useState<FirestoreUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState<'nickname' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const data = await getMyData(user.uid);
      setUserData(data);
    } catch (error) {
      logger.error('개인정보 로드 실패', error as Error);
      addToast({ type: 'error', message: '개인정보를 불러오는데 실패했습니다' });
    } finally {
      setIsLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 수정 모달 열기 (닉네임만 수정 가능)
  const handleEdit = useCallback(
    (field: 'nickname') => {
      setEditField(field);
      setEditValue(userData?.[field] ?? '');
      setShowEditModal(true);
    },
    [userData]
  );

  // 수정 저장
  const handleSave = useCallback(async () => {
    if (!user || !editField) return;

    try {
      setIsSaving(true);
      const updatedValue = editValue || undefined;
      // updateUserProfile을 사용하여 Firebase Auth displayName도 동기화 (C-1 수정 활용)
      await updateUserProfile(user.uid, { [editField]: updatedValue });

      // Zustand Store 동기화 (다른 화면에서도 즉시 반영)
      const currentProfile = useAuthStore.getState().profile;
      if (currentProfile) {
        useAuthStore.getState().setProfile({
          ...currentProfile,
          [editField]: updatedValue,
        });
      }

      addToast({ type: 'success', message: '정보가 수정되었습니다' });
      setShowEditModal(false);
      loadData(); // 새로고침
    } catch (error) {
      logger.error('정보 수정 실패', error as Error);
      addToast({ type: 'error', message: '수정에 실패했습니다' });
    } finally {
      setIsSaving(false);
    }
  }, [user, editField, editValue, addToast, loadData]);

  // 데이터 내보내기
  const handleExport = useCallback(async () => {
    if (!user) return;

    try {
      setIsExporting(true);
      logger.info('데이터 내보내기 시작');

      const exportData = await exportMyData(user.uid);
      const jsonString = JSON.stringify(exportData, null, 2);

      // 공유 시트 열기
      await Share.share({
        message: jsonString,
        title: 'UNIQN 개인정보 내보내기',
      });

      addToast({ type: 'success', message: '데이터 내보내기가 완료되었습니다' });
    } catch (error) {
      logger.error('데이터 내보내기 실패', error as Error);
      addToast({ type: 'error', message: '내보내기에 실패했습니다' });
    } finally {
      setIsExporting(false);
    }
  }, [user, addToast]);

  // 날짜 포맷
  const formatDate = (timestamp: DateInput): string => {
    const date = toDate(timestamp);
    if (!date) return '-';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 역할 한글 변환
  const getRoleLabel = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: '관리자',
      employer: '구인자',
      staff: '스태프',
    };
    return roleMap[role] || role;
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark">
        <Stack.Screen
          options={{
            headerShown: true,
            title: '내 정보',
            headerStyle: {
              backgroundColor: isDarkMode ? '#09090B' : '#ffffff',
            },
            headerTintColor: isDarkMode ? '#ffffff' : '#09090B',
          }}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400">
            정보를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '내 정보',
          headerStyle: {
            backgroundColor: isDarkMode ? '#09090B' : '#ffffff',
          },
          headerTintColor: isDarkMode ? '#ffffff' : '#09090B',
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 카드 */}
        <Card className="mb-6 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <View className="flex-row items-start">
            <Text className="text-2xl mr-3">{''}</Text>
            <View className="flex-1">
              <Text className="text-primary-800 dark:text-primary-200 font-semibold mb-1">
                개인정보 처리방침
              </Text>
              <Text className="text-primary-700 dark:text-primary-300 text-sm">
                개인정보보호법에 따라 수집된 개인정보를 열람하고 수정할 수 있습니다.
              </Text>
            </View>
          </View>
        </Card>

        {/* 기본 정보 */}
        <Card className="mb-4">
          <Text className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
            기본 정보
          </Text>

          <DataRow label="이메일" value={userData?.email ?? null} />
          <DataRow label="이름" value={userData?.name ?? null} />
          <DataRow label="연락처" value={userData?.phone ?? null} />
          <DataRow
            label="닉네임"
            value={userData?.nickname ?? null}
            editable
            onEdit={() => handleEdit('nickname')}
          />
          <DataRow label="회원 유형" value={getRoleLabel(userData?.role ?? '')} />
          <DataRow label="가입일" value={formatDate(userData?.createdAt)} />
          <DataRow label="수정일" value={formatDate(userData?.updatedAt)} />
        </Card>

        {/* 본인인증 정보 */}
        <Card className="mb-4">
          <Text className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
            본인인증 정보
          </Text>

          <DataRow label="전화번호 인증" value={userData?.phoneVerified ? '인증 완료' : '미인증'} />
          <DataRow label="이름" value={userData?.name ?? null} />
          <DataRow label="연락처" value={userData?.phone ?? null} />
          <DataRow
            label="생년월일"
            value={userData?.birthDate ? formatBirthDate(userData.birthDate) : null}
          />
          <DataRow
            label="성별"
            value={
              userData?.gender === 'male' ? '남성' : userData?.gender === 'female' ? '여성' : null
            }
          />
        </Card>

        {/* 동의 정보 */}
        <Card className="mb-4">
          <Text className="text-lg font-semibold text-secondary-900 dark:text-white mb-4">
            동의 정보
          </Text>

          <DataRow label="이용약관" value={userData?.termsAgreed ? '동의함' : '미동의'} />
          <DataRow label="개인정보처리방침" value={userData?.privacyAgreed ? '동의함' : '미동의'} />
          <DataRow label="마케팅 수신" value={userData?.marketingAgreed ? '동의함' : '미동의'} />
        </Card>

        {/* 데이터 내보내기 */}
        <Card className="mb-4">
          <Text className="text-lg font-semibold text-secondary-900 dark:text-white mb-2">
            데이터 내보내기
          </Text>
          <Text className="text-secondary-500 dark:text-secondary-400 text-sm mb-4">
            저장된 모든 개인정보를 JSON 형식으로 내보낼 수 있습니다. 지원 내역, 근무 기록 등이
            포함됩니다.
          </Text>

          <Button onPress={handleExport} variant="outline" fullWidth disabled={isExporting}>
            {isExporting ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#6366f1" />
                <Text className="ml-2 text-primary-600 dark:text-primary-400">내보내는 중...</Text>
              </View>
            ) : (
              <Text className="text-primary-600 dark:text-primary-400">내 데이터 내보내기</Text>
            )}
          </Button>
        </Card>

        {/* 개인정보 삭제 안내 */}
        <Card className="bg-secondary-100 dark:bg-surface">
          <Text className="text-secondary-600 dark:text-secondary-400 text-sm leading-5">
            개인정보 삭제를 원하시면 회원탈퇴를 진행해주세요. 탈퇴 시 30일간의 유예 기간이 있으며,
            이 기간 동안 복구가 가능합니다.
          </Text>
        </Card>
      </ScrollView>

      {/* 수정 모달 */}
      <Modal visible={showEditModal} onClose={() => setShowEditModal(false)} title="닉네임 수정">
        <View className="p-4">
          <Input
            label="닉네임"
            value={editValue}
            onChangeText={setEditValue}
            placeholder="닉네임을 입력하세요"
            autoFocus
          />

          <View className="flex-row gap-3 mt-6">
            <View className="flex-1">
              <Button
                onPress={() => setShowEditModal(false)}
                variant="outline"
                fullWidth
                disabled={isSaving}
              >
                취소
              </Button>
            </View>
            <View className="flex-1">
              <Button onPress={handleSave} fullWidth disabled={isSaving}>
                {isSaving ? <ActivityIndicator size="small" color="#ffffff" /> : '저장'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

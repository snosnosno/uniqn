/**
 * UNIQN Mobile - Forgot Password Screen
 * 비밀번호 찾기 화면
 */

import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { MailIcon, ChevronLeftIcon } from '@/components/icons';
import { useState } from 'react';
import { Pressable } from 'react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    setLoading(true);
    // TODO: Firebase Auth 연동
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1000);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* 뒤로가기 버튼 */}
        <Pressable
          onPress={() => router.back()}
          className="px-4 py-2 flex-row items-center"
        >
          <ChevronLeftIcon size={24} color="#6B7280" />
          <Text className="ml-1 text-gray-600 dark:text-gray-400">뒤로</Text>
        </Pressable>

        <ScrollView
          contentContainerClassName="flex-grow px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* 헤더 */}
          <View className="mb-8">
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              비밀번호 찾기
            </Text>
            <Text className="mt-2 text-gray-500 dark:text-gray-400">
              가입한 이메일 주소를 입력하시면{'\n'}비밀번호 재설정 링크를 보내드립니다
            </Text>
          </View>

          {sent ? (
            // 전송 완료 상태
            <View className="items-center py-8">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/30">
                <MailIcon size={32} color="#22c55e" />
              </View>
              <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                이메일을 확인하세요
              </Text>
              <Text className="mt-2 text-center text-gray-500 dark:text-gray-400">
                {email}으로{'\n'}비밀번호 재설정 링크를 보냈습니다
              </Text>
              <Button
                variant="outline"
                onPress={() => router.replace('/(auth)/login')}
                className="mt-6"
              >
                로그인으로 돌아가기
              </Button>
            </View>
          ) : (
            // 이메일 입력 폼
            <>
              <View className="mb-6">
                <Input
                  label="이메일"
                  placeholder="이메일을 입력하세요"
                  type="email"
                  value={email}
                  onChangeText={setEmail}
                  leftIcon={<MailIcon size={20} color="#9CA3AF" />}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <Button onPress={handleSendReset} loading={loading} fullWidth>
                재설정 링크 보내기
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * UNIQN Mobile - Login Screen
 * 로그인 화면
 */

import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Divider } from '@/components/ui';
import { MailIcon, LockIcon } from '@/components/icons';
import { useState } from 'react';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    // TODO: Firebase Auth 연동
    setTimeout(() => {
      setLoading(false);
      router.replace('/(app)/(tabs)');
    }, 1000);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* 로고 */}
          <View className="mb-10 items-center">
            <Text className="text-4xl font-bold text-primary-600 dark:text-primary-400">
              UNIQN
            </Text>
            <Text className="mt-2 text-gray-500 dark:text-gray-400">
              홀덤 스태프 플랫폼
            </Text>
          </View>

          {/* 로그인 폼 */}
          <View className="mb-6">
            <View className="mb-4">
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

            <View className="mb-2">
              <Input
                label="비밀번호"
                placeholder="비밀번호를 입력하세요"
                type="password"
                value={password}
                onChangeText={setPassword}
                leftIcon={<LockIcon size={20} color="#9CA3AF" />}
              />
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <Text className="text-right text-sm text-primary-600 dark:text-primary-400">
                비밀번호 찾기
              </Text>
            </Link>
          </View>

          <Button onPress={handleLogin} loading={loading} fullWidth>
            로그인
          </Button>

          <Divider label="또는" spacing="lg" />

          {/* 회원가입 링크 */}
          <View className="flex-row items-center justify-center">
            <Text className="text-gray-600 dark:text-gray-400">계정이 없으신가요? </Text>
            <Link href="/(auth)/signup" asChild>
              <Text className="font-semibold text-primary-600 dark:text-primary-400">
                회원가입
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

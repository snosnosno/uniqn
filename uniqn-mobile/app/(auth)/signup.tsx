/**
 * UNIQN Mobile - SignUp Screen
 * 회원가입 화면
 */

import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@/components/ui';
import { UserIcon, MailIcon, LockIcon, PhoneIcon } from '@/components/icons';
import { useState } from 'react';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
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
          contentContainerClassName="flex-grow px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* 헤더 */}
          <View className="mb-8">
            <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              회원가입
            </Text>
            <Text className="mt-2 text-gray-500 dark:text-gray-400">
              UNIQN에 오신 것을 환영합니다
            </Text>
          </View>

          {/* 회원가입 폼 */}
          <View className="mb-6 gap-4">
            <Input
              label="이름"
              placeholder="이름을 입력하세요"
              value={name}
              onChangeText={setName}
              leftIcon={<UserIcon size={20} color="#9CA3AF" />}
            />

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

            <Input
              label="전화번호"
              placeholder="전화번호를 입력하세요"
              type="phone"
              value={phone}
              onChangeText={setPhone}
              leftIcon={<PhoneIcon size={20} color="#9CA3AF" />}
            />

            <Input
              label="비밀번호"
              placeholder="비밀번호를 입력하세요"
              type="password"
              value={password}
              onChangeText={setPassword}
              leftIcon={<LockIcon size={20} color="#9CA3AF" />}
              hint="8자 이상, 영문, 숫자 포함"
            />
          </View>

          <Button onPress={handleSignUp} loading={loading} fullWidth>
            회원가입
          </Button>

          {/* 로그인 링크 */}
          <View className="mt-6 flex-row items-center justify-center">
            <Text className="text-gray-600 dark:text-gray-400">이미 계정이 있으신가요? </Text>
            <Link href="/(auth)/login" asChild>
              <Text className="font-semibold text-primary-600 dark:text-primary-400">
                로그인
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

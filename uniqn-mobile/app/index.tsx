import { useEffect } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function Index() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    // 초기 로딩 후 인증 상태에 따라 라우팅
    // TODO: Firebase Auth 상태 확인 후 적절한 화면으로 이동
    const timer = setTimeout(() => {
      // router.replace('/(auth)/login'); // 로그인 화면으로
      // router.replace('/(tabs)'); // 메인 탭으로
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.logoContainer}>
        <Text style={[styles.logo, isDark && styles.logoDark]}>UNIQN</Text>
        <Text style={[styles.tagline, isDark && styles.taglineDark]}>
          홀덤 스태프 매칭 플랫폼
        </Text>
      </View>

      <ActivityIndicator
        size="large"
        color={isDark ? '#60a5fa' : '#2563eb'}
        style={styles.loader}
      />

      <Text style={[styles.version, isDark && styles.versionDark]}>
        v1.0.0
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 48,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 4,
  },
  logoDark: {
    color: '#60a5fa',
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  taglineDark: {
    color: '#9ca3af',
  },
  loader: {
    marginVertical: 24,
  },
  version: {
    position: 'absolute',
    bottom: 48,
    fontSize: 14,
    color: '#9ca3af',
  },
  versionDark: {
    color: '#6b7280',
  },
});

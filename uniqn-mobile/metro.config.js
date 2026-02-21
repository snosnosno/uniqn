const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Firebase 웹 번들링을 위한 설정
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// Firebase 모듈 해결을 위한 extraNodeModules 추가
config.resolver.unstable_enablePackageExports = true;

module.exports = withNativeWind(config, { input: './global.css' });

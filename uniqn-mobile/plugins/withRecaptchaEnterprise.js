/**
 * Expo Config Plugin: Firebase Phone Auth용 reCAPTCHA Enterprise SDK 추가
 *
 * Firebase iOS SDK 10.25+ 부터 Phone Auth에 reCAPTCHA Enterprise가 필수.
 * APNs silent push 실패 시 reCAPTCHA Enterprise로 fallback하는데,
 * 이 SDK가 없으면 auth/unknown 에러 발생.
 *
 * 구조:
 * - RecaptchaInterop (~> 101.0): 인터페이스/프로토콜 (FirebaseAuth 의존성으로 자동 설치)
 * - RecaptchaEnterprise (~> 18.7): 실제 구현체 (명시적 추가 필요 ← 이 플러그인)
 *
 * @see https://cloud.google.com/recaptcha-enterprise/docs/instrument-ios-apps
 * @see https://github.com/firebase/firebase-ios-sdk/issues/15345
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withRecaptchaEnterprise(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');

      // 이미 추가되어 있으면 스킵
      if (contents.includes("pod 'RecaptchaEnterprise'")) {
        return config;
      }

      // RecaptchaEnterprise: reCAPTCHA Enterprise 실제 구현체
      // modular_headers: useFrameworks: 'static' 환경에서 필수
      const podLine =
        "\n  pod 'RecaptchaEnterprise', '~> 18.7', :modular_headers => true";

      if (contents.includes('use_expo_modules!')) {
        contents = contents.replace(
          'use_expo_modules!',
          `use_expo_modules!${podLine}`
        );
      } else {
        // fallback: 파일 끝 end 전에 추가
        const lastEndIndex = contents.lastIndexOf('end');
        if (lastEndIndex !== -1) {
          contents =
            contents.slice(0, lastEndIndex) +
            `${podLine}\n` +
            contents.slice(lastEndIndex);
        }
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withRecaptchaEnterprise;

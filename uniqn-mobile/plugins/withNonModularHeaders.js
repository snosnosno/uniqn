/**
 * Expo Config Plugin: non-modular header 허용
 *
 * useFrameworks: 'static' 사용 시 @react-native-firebase/app Pod에서
 * "include of non-modular header inside framework module" 에러 발생.
 * Podfile post_install에 CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES 추가.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withNonModularHeaders(config) {
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

      if (contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return config;
      }

      const snippet = [
        '',
        '    # [withNonModularHeaders] Allow non-modular includes for RNFirebase',
        '    installer.pods_project.targets.each do |target|',
        '      target.build_configurations.each do |build_config|',
        "        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
        '      end',
        '    end',
      ].join('\n');

      if (contents.includes('post_install do |installer|')) {
        contents = contents.replace(
          'post_install do |installer|',
          `post_install do |installer|${snippet}`
        );
      } else {
        contents += `\npost_install do |installer|${snippet}\nend\n`;
      }

      fs.writeFileSync(podfilePath, contents);
      return config;
    },
  ]);
}

module.exports = withNonModularHeaders;

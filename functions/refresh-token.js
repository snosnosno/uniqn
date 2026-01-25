/**
 * Firebase CLI 토큰 갱신
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const configPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');

async function refreshToken() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const refreshToken = config.tokens.refresh_token;

  // Google OAuth2 클라이언트 ID (Firebase CLI용)
  const clientId = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
  const clientSecret = 'j9iVZfS8kkCEFUPaAeJV0sAi';

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            // 설정 파일 업데이트
            config.tokens.access_token = result.access_token;
            config.tokens.expires_at = Date.now() + (result.expires_in * 1000);
            fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'));
            console.log('토큰 갱신 완료!');
            resolve(result.access_token);
          } else {
            console.error('토큰 갱신 실패:', result);
            reject(new Error(result.error_description || 'Token refresh failed'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

refreshToken().catch(console.error);

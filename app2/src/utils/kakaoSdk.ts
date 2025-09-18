// 카카오 SDK 유틸리티
interface KakaoSDK {
  init(appKey: string): void;
  isInitialized(): boolean;
  Auth: {
    login(options: {
      success?: (authObj: any) => void;
      fail?: (err: any) => void;
      scope?: string;
      persistAccessToken?: boolean;
      throughTalk?: boolean;
    }): void;
    logout(callback?: (response?: any) => void): void;
    getStatusInfo(callback: (statusObj: { status: string }) => void): void;
  };
  API: {
    request(options: {
      url: string;
      success?: (response: any) => void;
      fail?: (error: any) => void;
    }): void;
  };
}

declare global {
  interface Window {
    Kakao: KakaoSDK;
  }
}

export interface KakaoUserInfo {
  id: number;
  connected_at: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
    };
    has_email?: boolean;
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
    has_phone_number?: boolean;
    phone_number_needs_agreement?: boolean;
    phone_number?: string;
    has_gender?: boolean;
    gender_needs_agreement?: boolean;
    gender?: string;
    has_age_range?: boolean;
    age_range_needs_agreement?: boolean;
    age_range?: string;
    has_birthday?: boolean;
    birthday_needs_agreement?: boolean;
    birthday?: string;
  };
}

export interface KakaoAuthResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  refresh_token_expires_in: number;
}

// 카카오 SDK 로드 여부 확인
export const isKakaoSDKLoaded = (): boolean => {
  return typeof window !== 'undefined' && !!window.Kakao;
};

// 카카오 SDK 초기화
export const initializeKakaoSDK = async (appKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window object is not available'));
      return;
    }

    // SDK가 이미 로드되어 있다면 초기화만 수행
    if (window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(appKey);
      }
      resolve();
      return;
    }

    // SDK 스크립트 로드
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.integrity = 'sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfhD0hAJ/aaiVsF6hqJPf';

    script.onload = () => {
      if (window.Kakao) {
        window.Kakao.init(appKey);
        resolve();
      } else {
        reject(new Error('카카오 SDK 로드에 실패했습니다'));
      }
    };

    script.onerror = () => {
      reject(new Error('카카오 SDK 스크립트 로드에 실패했습니다'));
    };

    document.head.appendChild(script);
  });
};

// 카카오 로그인
export const loginWithKakao = (): Promise<KakaoAuthResponse> => {
  return new Promise((resolve, reject) => {
    if (!isKakaoSDKLoaded()) {
      reject(new Error('카카오 SDK가 로드되지 않았습니다'));
      return;
    }

    window.Kakao.Auth.login({
      success: (authObj: KakaoAuthResponse) => {
        resolve(authObj);
      },
      fail: (err: any) => {
        reject(new Error(`카카오 로그인 실패: ${err.error_description || err.error}`));
      },
      scope: 'profile_nickname,profile_image,account_email,gender,age_range'
    });
  });
};

// 카카오 사용자 정보 조회
export const getKakaoUserInfo = (): Promise<KakaoUserInfo> => {
  return new Promise((resolve, reject) => {
    if (!isKakaoSDKLoaded()) {
      reject(new Error('카카오 SDK가 로드되지 않았습니다'));
      return;
    }

    window.Kakao.API.request({
      url: '/v2/user/me',
      success: (res: KakaoUserInfo) => {
        resolve(res);
      },
      fail: (err: any) => {
        reject(new Error(`사용자 정보 조회 실패: ${err.msg}`));
      }
    });
  });
};

// 카카오 로그아웃
export const logoutFromKakao = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isKakaoSDKLoaded()) {
      reject(new Error('카카오 SDK가 로드되지 않았습니다'));
      return;
    }

    window.Kakao.Auth.logout((response: any) => {
      if (response) {
        resolve();
      } else {
        reject(new Error('카카오 로그아웃에 실패했습니다'));
      }
    });
  });
};

// 카카오 연결 끊기 (앱 탈퇴)
export const unlinkKakao = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!isKakaoSDKLoaded()) {
      reject(new Error('카카오 SDK가 로드되지 않았습니다'));
      return;
    }

    window.Kakao.API.request({
      url: '/v1/user/unlink',
      success: () => {
        resolve();
      },
      fail: (err: any) => {
        reject(new Error(`카카오 연결 끊기 실패: ${err.msg}`));
      }
    });
  });
};

// 카카오 액세스 토큰 확인
export const getKakaoAccessToken = (): string | null => {
  if (!isKakaoSDKLoaded()) {
    return null;
  }
  return window.Kakao.Auth.getAccessToken();
};

// 카카오 로그인 상태 확인
export const isKakaoLoggedIn = (): boolean => {
  if (!isKakaoSDKLoaded()) {
    return false;
  }
  return !!window.Kakao.Auth.getAccessToken();
};
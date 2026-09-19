/**
 * SignupStepProfile — 이탈(로그아웃) 버튼 회귀 테스트 (2026-08-02)
 *
 * 버그: 커밋 1d7b2a950("회원가입 4단계→3단계 축소 및 프로필 분리")이 이 컴포넌트를
 * 가입 위저드에서 떼어내 `app/(app)/profile-setup.tsx` 단독 화면으로 승격하면서,
 * `onBack`(= 위저드 3단계 복귀) prop 계약과 '이전' 버튼 JSX 는 그대로 두고 구현만
 * 토스트로 바꿨다. 돌아갈 곳이 없는 버튼이 잔해로 남아, 신규 가입자는 프로필 설정
 * 화면에서 앱 삭제 외에 빠져나갈 수단이 없었다.
 *
 * 수정: 라벨을 '로그아웃' 으로 바꾸고 prop 을 `onExit` 으로 rename.
 * 이 테스트는 배선을 되돌리면(라벨 '이전' 복귀 / onExit 미연결) 반드시 red 가 된다.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { SignupStepProfile } from '../SignupStepProfile';

// 모듈 스코프 import 라 mock 필수 — 실제 구현은 Supabase 로 내려간다.
jest.mock('@/services/auth', () => ({
  checkNicknameExists: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('SignupStepProfile 이탈 버튼', () => {
  const onNext = jest.fn();
  const onExit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("하단 이탈 버튼 라벨은 '로그아웃' 이다 (죽은 '이전' 잔해가 되살아나면 실패)", () => {
    const { getByText, queryByText } = render(
      <SignupStepProfile onNext={onNext} onExit={onExit} />
    );

    expect(getByText('로그아웃')).toBeTruthy();
    expect(queryByText('이전')).toBeNull();
  });

  it('로그아웃 버튼을 누르면 onExit 이 호출된다 (onNext 는 호출되지 않는다)', () => {
    const { getByText } = render(<SignupStepProfile onNext={onNext} onExit={onExit} />);

    fireEvent.press(getByText('로그아웃'));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('저장 중(isLoading)에는 로그아웃 버튼이 비활성화된다 — completeProfile/signOut race 차단', () => {
    const { getByLabelText } = render(
      <SignupStepProfile onNext={onNext} onExit={onExit} isLoading />
    );

    expect(getByLabelText('로그아웃').props.accessibilityState.disabled).toBe(true);
  });

  it('제출 버튼들은 그대로 남아 있다 — 이탈 배선이 폼을 망가뜨리지 않았음을 고정', () => {
    const { getByText } = render(<SignupStepProfile onNext={onNext} onExit={onExit} />);

    expect(getByText('가입 완료')).toBeTruthy();
    expect(getByText('나중에 입력하기')).toBeTruthy();
  });
});

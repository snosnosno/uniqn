/**
 * NicknameSearchField — 닉네임 검색 폼 프리미티브 단위 테스트
 *
 * 라벨/placeholder/검색 버튼 렌더, 입력 변경 콜백, 검색 버튼 탭 콜백을 검증한다.
 */
import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { NicknameSearchField } from '../NicknameSearchField';

describe('NicknameSearchField', () => {
  it('닉네임 라벨·placeholder·검색 버튼을 렌더한다', () => {
    render(
      <NicknameSearchField
        nickname=""
        onChangeNickname={jest.fn()}
        onSearch={jest.fn()}
        isSearching={false}
      />
    );

    expect(screen.getByText('닉네임')).toBeTruthy();
    expect(screen.getByPlaceholderText('닉네임 입력 (2자 이상)')).toBeTruthy();
    expect(screen.getByText('검색')).toBeTruthy();
  });

  it('입력 변경 시 onChangeNickname가 호출된다', () => {
    const onChangeNickname = jest.fn();
    render(
      <NicknameSearchField
        nickname=""
        onChangeNickname={onChangeNickname}
        onSearch={jest.fn()}
        isSearching={false}
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText('닉네임 입력 (2자 이상)'), '홀덤왕');

    expect(onChangeNickname).toHaveBeenCalledWith('홀덤왕');
  });

  it('검색 버튼 탭 시 onSearch가 호출된다', () => {
    const onSearch = jest.fn();
    render(
      <NicknameSearchField
        nickname="홀덤"
        onChangeNickname={jest.fn()}
        onSearch={onSearch}
        isSearching={false}
      />
    );

    fireEvent.press(screen.getByText('검색'));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});

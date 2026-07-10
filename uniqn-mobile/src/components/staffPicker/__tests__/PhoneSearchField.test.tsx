/**
 * PhoneSearchField — 전화 검색 폼 프리미티브 단위 테스트
 *
 * 라벨/placeholder/검색 버튼 렌더, 입력 변경 콜백, 검색 버튼 탭 콜백을 검증한다.
 */
import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { PhoneSearchField } from '../PhoneSearchField';

describe('PhoneSearchField', () => {
  it('전화번호 라벨·placeholder·검색 버튼을 렌더한다', () => {
    render(
      <PhoneSearchField
        phone=""
        onChangePhone={jest.fn()}
        onSearch={jest.fn()}
        isSearching={false}
      />
    );

    expect(screen.getByText('전화번호')).toBeTruthy();
    expect(screen.getByPlaceholderText('등록된 전화번호 전체 입력')).toBeTruthy();
    expect(screen.getByText('검색')).toBeTruthy();
  });

  it('입력 변경 시 onChangePhone가 호출된다', () => {
    const onChangePhone = jest.fn();
    render(
      <PhoneSearchField
        phone=""
        onChangePhone={onChangePhone}
        onSearch={jest.fn()}
        isSearching={false}
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText('등록된 전화번호 전체 입력'), '01012345678');

    expect(onChangePhone).toHaveBeenCalledWith('01012345678');
  });

  it('검색 버튼 탭 시 onSearch가 호출된다', () => {
    const onSearch = jest.fn();
    render(
      <PhoneSearchField
        phone="010"
        onChangePhone={jest.fn()}
        onSearch={onSearch}
        isSearching={false}
      />
    );

    fireEvent.press(screen.getByText('검색'));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});

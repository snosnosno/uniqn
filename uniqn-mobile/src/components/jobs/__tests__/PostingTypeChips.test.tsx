import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PostingTypeChips } from '../PostingTypeChips';

describe('PostingTypeChips', () => {
  it('renders counts for each chip and caps large counts at 99+', () => {
    const { getByText, getByLabelText } = render(
      <PostingTypeChips
        selected="urgent"
        onChange={jest.fn()}
        counts={{
          urgent: 12,
          tournament: 0,
          regular: 120,
        }}
      />
    );

    expect(getByText('12')).toBeTruthy();
    expect(getByText('0')).toBeTruthy();
    expect(getByText('99+')).toBeTruthy();
    expect(getByLabelText('급구 공고 12건')).toBeTruthy();
    expect(getByLabelText('대회 공고 0건')).toBeTruthy();
    expect(getByLabelText('일반 공고 120건')).toBeTruthy();
  });

  it('keeps zero-count chips selectable', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <PostingTypeChips
        selected="urgent"
        onChange={onChange}
        counts={{
          urgent: 12,
          tournament: 0,
          regular: 27,
        }}
      />
    );

    fireEvent.press(getByLabelText('대회 공고 0건'));

    expect(onChange).toHaveBeenCalledWith('tournament');
  });

  it('hides count badges until count data is available', () => {
    const { getByLabelText, queryByLabelText, queryByText, rerender } = render(
      <PostingTypeChips selected="urgent" onChange={jest.fn()} />
    );

    expect(getByLabelText('급구 공고 필터')).toBeTruthy();
    expect(queryByLabelText('급구 공고 12건')).toBeNull();
    expect(queryByText('12')).toBeNull();

    rerender(
      <PostingTypeChips
        selected="urgent"
        onChange={jest.fn()}
        counts={{
          urgent: 12,
          tournament: 0,
          regular: 27,
        }}
      />
    );

    expect(queryByLabelText('급구 공고 필터')).toBeNull();
    expect(getByLabelText('급구 공고 12건')).toBeTruthy();
  });
});

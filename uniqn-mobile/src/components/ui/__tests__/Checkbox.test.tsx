import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Checkbox } from '../Checkbox';

describe('Checkbox', () => {
  it('toggles checked state on press', () => {
    const onChange = jest.fn();

    render(<Checkbox checked={false} onChange={onChange} label="Accept terms" />);

    fireEvent.press(screen.getByLabelText('Accept terms'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when disabled', () => {
    const onChange = jest.fn();

    render(<Checkbox checked={true} onChange={onChange} label="Disabled checkbox" disabled />);

    fireEvent.press(screen.getByLabelText('Disabled checkbox'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders description and error message', () => {
    render(
      <Checkbox
        checked={false}
        onChange={jest.fn()}
        label="Accept terms"
        description="You must accept before continuing."
        error
        errorMessage="Please accept the terms."
      />
    );

    expect(screen.getByText('You must accept before continuing.')).toBeTruthy();
    expect(screen.getByText('Please accept the terms.')).toBeTruthy();
  });
});

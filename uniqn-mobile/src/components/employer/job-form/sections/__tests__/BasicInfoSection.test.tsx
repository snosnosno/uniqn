import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { BasicInfoSection } from '../BasicInfoSection';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types';

function BasicInfoSectionHarness() {
  const [data, setData] = useState(INITIAL_JOB_POSTING_FORM_DATA);

  return (
    <BasicInfoSection
      data={data}
      onUpdate={(update) => setData((prev) => ({ ...prev, ...update }))}
      errors={{}}
    />
  );
}

describe('BasicInfoSection', () => {
  it('preserves spaces while typing the location address', () => {
    const { UNSAFE_getAllByType } = render(<BasicInfoSectionHarness />);
    const getInputs = () => UNSAFE_getAllByType(TextInput);

    fireEvent.changeText(getInputs()[1], 'Supercup');
    fireEvent.changeText(getInputs()[2], 'Gangnam ');

    expect(getInputs()[2].props.value).toBe('Gangnam ');

    fireEvent.changeText(getInputs()[2], 'Gangnam gu');

    expect(getInputs()[2].props.value).toBe('Gangnam gu');
  });
});

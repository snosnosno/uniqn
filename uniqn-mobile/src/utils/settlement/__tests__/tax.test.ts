import { serializeTaxSettings } from '../tax';

describe('serializeTaxSettings', () => {
  it('preserves taxableItems maps when present', () => {
    const serialized = serializeTaxSettings({
      type: 'rate',
      value: 3.3,
      taxableItems: {
        basePay: true,
        meal: false,
        transportation: true,
        accommodation: false,
        additional: true,
      },
    });

    expect(serialized).toEqual({
      type: 'rate',
      value: 3.3,
      taxableItems: {
        basePay: true,
        meal: false,
        transportation: true,
        accommodation: false,
        additional: true,
      },
    });
    expect(serialized.taxableItems).not.toBeUndefined();
  });

  it('omits taxableItems when they are not configured', () => {
    expect(
      serializeTaxSettings({
        type: 'none',
        value: 0,
      })
    ).toEqual({
      type: 'none',
      value: 0,
    });
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYNTHETIC_BANNER_TEXT, SyntheticBanner } from '@/components/SyntheticBanner';
import { DEFAULT_LAYERS } from '@/types/layers';
import { useAppStore } from '@/store/appStore';

describe('SyntheticBanner', () => {
  beforeEach(() => {
    useAppStore.setState({
      dataIsSynthetic: true,
      layers: { ...DEFAULT_LAYERS, buildings: false },
    });
  });
  afterEach(cleanup);

  it('stays visible without a close control even if the building layer is off', () => {
    render(<SyntheticBanner />);
    const el = screen.getByTestId('synthetic-banner');
    expect(el).toHaveTextContent(SYNTHETIC_BANNER_TEXT);
    expect(el.querySelector('button')).toBeNull();
    expect(screen.queryByRole('button', { name: /닫기|close/i })).toBeNull();
  });
});

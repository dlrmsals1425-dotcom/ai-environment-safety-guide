import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LayerPanel } from '@/components/LayerPanel';
import { DEFAULT_LAYERS } from '@/types/layers';
import { useAppStore } from '@/store/appStore';

describe('LayerPanel', () => {
  beforeEach(() => {
    useAppStore.setState({
      layers: { ...DEFAULT_LAYERS },
      cctvSites: [],
      cctvMeta: null,
      cctvQuery: '',
      cctvVisible: true,
      cctvShowRemoved: false,
      cctvSelectedId: null,
    });
  });
  afterEach(cleanup);

  it('toggles the buildings layer without clearing synthetic flag', () => {
    useAppStore.setState({ dataIsSynthetic: true });
    render(<LayerPanel />);
    const box = screen.getByRole('checkbox', { name: '3D 건물' });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(useAppStore.getState().layers.buildings).toBe(false);
    expect(useAppStore.getState().dataIsSynthetic).toBe(true);
    fireEvent.click(box);
    expect(useAppStore.getState().layers.buildings).toBe(true);
  });
});

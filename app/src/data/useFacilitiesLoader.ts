import { useEffect } from 'react';
import { loadCctvSites } from '@/data/facilityLoader';
import { useAppStore } from '@/store/appStore';

const SITES_URL = '/data/facilities/cctv_sites.json';
const META_URL = '/data/facilities/cctv_sites.meta.json';

export function useFacilitiesLoader(): void {
  const setCctvSites = useAppStore((s) => s.setCctvSites);

  useEffect(() => {
    const ac = new AbortController();
    loadCctvSites(SITES_URL, META_URL, ac.signal)
      .then(({ sites, meta }) => {
        setCctvSites(sites, meta);
      })
      .catch((err: unknown) => {
        const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
        if (name === 'AbortError') return;
        console.error('[BITGIL] cctv load failed', err);
      });
    return () => ac.abort();
  }, [setCctvSites]);
}

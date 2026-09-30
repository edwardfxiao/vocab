import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { DATASETS, datasetFromSlug, datasetSlug } from '@/lib/datasets.ts';
import { loadDataset, useAppState } from '@/state/store.ts';

/** Keeps the loaded collection in sync with the `:ds` route segment; unknown slugs redirect to the first collection. */
export function useDatasetRoute() {
  const { ds = '' } = useParams();
  const navigate = useNavigate();
  const config = datasetFromSlug(ds);
  const loadedId = useAppState(s => s.config?.id ?? null);
  useEffect(() => {
    if (!config) { navigate(`/${datasetSlug(DATASETS[0].id)}`, { replace: true }); return; }
    if (config.id !== loadedId) void loadDataset(config.id);
  }, [config, loadedId, navigate]);
  return { config, slug: ds };
}

import { Navigate, Route, Routes } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip.tsx';
import { datasetSlug } from '@/lib/datasets.ts';
import { lastDatasetId } from '@/state/store.ts';
import { DatasetPage } from '@/pages/DatasetPage.tsx';
import { PracticePage } from '@/pages/PracticePage.tsx';
import { PracticeListPage } from '@/pages/PracticeListPage.tsx';
import { RootPage } from '@/pages/RootPage.tsx';
import { StoriesPage } from '@/pages/StoriesPage.tsx';
import { StoryPage } from '@/pages/StoryPage.tsx';
import { Layout } from '@/components/Layout.tsx';

export function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <Routes>
        <Route path="/" element={<Navigate to={`/${datasetSlug(lastDatasetId())}`} replace />} />
        <Route path="/:ds" element={<Layout />}>
          <Route index element={<DatasetPage />} />
          <Route path="w/:word" element={<DatasetPage />} />
          <Route path="root/:root" element={<RootPage />} />
          <Route path="stories" element={<StoriesPage />} />
          <Route path="stories/:n" element={<StoryPage />} />
          <Route path="stories/:n/:variant" element={<StoryPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="practice/list" element={<PracticeListPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  );
}

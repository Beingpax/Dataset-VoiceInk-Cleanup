import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import BenchmarkPage from './pages/BenchmarkPage.jsx';
import CasesPage from './pages/CasesPage.jsx';
import JsonlViewerPage from './pages/JsonlViewerPage.jsx';
import GeneratorPage from './pages/GeneratorPage.jsx';
import MethodologyPage from './pages/MethodologyPage.jsx';
import PromptOutputPage from './pages/PromptOutputPage.jsx';

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/benchmark" element={<BenchmarkPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/viewer" element={<JsonlViewerPage />} />
        <Route path="/prompt-output" element={<PromptOutputPage />} />
        <Route path="/generator" element={<GeneratorPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

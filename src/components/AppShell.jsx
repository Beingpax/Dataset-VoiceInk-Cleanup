import { NavLink } from 'react-router-dom';
import { useBenchmark } from '../context/BenchmarkContext.jsx';

const navigation = [
  ['/', 'Overview'],
  ['/benchmark', 'Benchmark'],
  ['/cases', 'Cases'],
  ['/viewer', 'JSONL Viewer'],
  ['/prompt-output', 'Prompt Output'],
  ['/generator', 'Dataset Generator'],
  ['/methodology', 'Methodology'],
];

export default function AppShell({ children }) {
  const { data } = useBenchmark();
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="wordmark" to="/">VoiceInk <span>Research</span></NavLink>
        <nav className="header-nav" aria-label="Application pages">
          {navigation.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : undefined}>{label}</NavLink>
          ))}
        </nav>
        <div className="project-state"><span />{data ? `${data.benchmark.sample_count} cases · ${data.models.length} systems` : 'Benchmark corpus'}</div>
      </header>
      <main className="page" id="main-content">{children}</main>
    </div>
  );
}

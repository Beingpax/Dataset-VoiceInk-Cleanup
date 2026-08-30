import { NavLink } from 'react-router-dom';

const navigation = [
  ['/', 'Overview'],
  ['/benchmark', 'Benchmark'],
  ['/cases', 'Cases'],
  ['/viewer', 'JSONL Viewer'],
  ['/generator', 'Dataset Generator'],
  ['/methodology', 'Methodology'],
];

export default function AppShell({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="wordmark" to="/">V/C Research</NavLink>
        <div className="project-state"><span />100 benchmark cases · 4 systems</div>
      </header>
      <div className="app-frame">
        <aside className="sidebar">
          <nav aria-label="Application pages">
            {navigation.map(([to, label], index) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : undefined}>
                <span>{String(index + 1).padStart(2, '0')}</span>{label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">
            <a href="https://github.com/Beingpax/Dataset-VoiceInk-Cleanup">GitHub repository</a>
            <p>Models and weights excluded</p>
          </div>
        </aside>
        <main className="page" id="main-content">{children}</main>
      </div>
    </div>
  );
}

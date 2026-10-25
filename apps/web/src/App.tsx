import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import {
  BarChart3,
  Box,
  Droplets,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Plus,
  Settings as SettingsIcon,
  MapPinned,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Auth, Landing, Brand } from './pages/Auth';
import { Farms, Settings } from './pages/Farms';
import { CreateFarm } from './pages/CreateFarm';
import { Twin } from './pages/Twin';
const Analytics = lazy(() => import('./pages/Manage').then((m) => ({ default: m.Analytics })));
const Insights = lazy(() => import('./pages/Manage').then((m) => ({ default: m.Insights })));
const Irrigation = lazy(() => import('./pages/Manage').then((m) => ({ default: m.Irrigation })));
const Scenarios = lazy(() => import('./pages/Manage').then((m) => ({ default: m.Scenarios })));
import { useFarm } from './stores/useFarm';
import { API, api, post } from './services/api';
import { firebaseLogout } from './services/firebase';
import { Button } from './components/ui/button';
import { LanguageSelect } from './components/Language';
import { t } from './i18n';
const nav = [
  { path: '/app', label: 'Overview', icon: LayoutDashboard },
  { path: '/app/farms', label: 'My farms', icon: MapPinned },
  { path: '/app/analytics', label: 'Farm analytics', icon: BarChart3 },
  { path: '/app/irrigation', label: 'Irrigation', icon: Droplets },
  { path: '/app/insights', label: 'Crop advice', icon: Leaf },
  { path: '/app/scenarios', label: 'Scenario analysis', icon: FlaskConical },
];
export default function App() {
  useTranslation();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/auth/me')
      .then((r) => useFarm.getState().setUser(r.user))
      .catch(() => {})
      .finally(() => setLoading(false));
    const expired = () => useFarm.getState().setUser(null);
    window.addEventListener('agritwin:session-expired', expired);
    return () => window.removeEventListener('agritwin:session-expired', expired);
  }, []);
  if (loading)
    return (
      <div className="loading-screen">
        <Leaf size={28} />
        <p>{t('Loading…')}</p>
      </div>
    );
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth register />} />
      <Route path="/app/*" element={<Shell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
function Shell() {
  const { user, farm, farms, load, open, online, setOnline } = useFarm(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [menu, setMenu] = useState(false),
    [storage, setStorage] = useState(''),
    location = useLocation();
  useEffect(() => {
    if (user) {
      load()
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
      api('/health')
        .then((r) => setStorage(r.storage))
        .catch(() => {});
    }
  }, [user?.id]);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!user || !farm) return;
    const id = farm.id,
      socket = io(API || undefined, { withCredentials: true });
    socket.on('connect', () => {
      setOnline(true);
      socket.emit('farm:join', id);
      open(id).catch((e) => setError(e.message));
    });
    socket.on('disconnect', () => setOnline(false));
    socket.on('connect_error', () => setOnline(false));
    socket.on('farm:state-updated', (data) => {
      const current = useFarm.getState().farm;
      if (
        current?.id === id &&
        (current.run.id !== data.runId || data.version >= current.run.version)
      )
        open(id).catch((e) => setError(e.message));
    });
    socket.on('simulation:error', (e) => {
      setError(e.message);
      open(id).catch(() => {});
    });
    socket.on('farm:deleted', () => load().catch((e) => setError(e.message)));
    return () => {
      socket.disconnect();
      setOnline(false);
    };
  }, [farm?.id, user?.id]);
  if (!user) return <Navigate to="/login" replace />;
  const noFarm = !farm && !loading && !['/app/farms', '/app/create'].includes(location.pathname);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Brand />
        <div className="workspace-label">{t('Decision support workspace')}</div>
        <nav>
          {nav.map((n) => (
            <NavLink end={n.path === '/app'} to={n.path} key={n.path}>
              <n.icon size={19} />
              <span>{t(n.label)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-model">
            <ShieldCheck size={18} />
            <strong>{t('Research & decision support')}</strong>
            <p>{t('Simulated states · no physical sensors')}</p>
          </div>
          <NavLink className="settings-link" to="/app/settings">
            <SettingsIcon size={18} />
            {t('Farm settings')}
          </NavLink>
          <button
            className="user-block"
            onClick={async () => {
              try {
                await post('/auth/logout', {});
                await firebaseLogout();
                useFarm.setState({ user: null, farm: null, farms: [] });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
            aria-label={t('Sign out')}
          >
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{t('Sign out')}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="inline">
            <Button
              variant="ghost"
              className="mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <div className="breadcrumb">
              {t('Agricultural digital twin')}
              <strong>
                {t(nav.find((n) => n.path === location.pathname)?.label || 'Farm workspace')}
              </strong>
            </div>
          </div>
          <div className="topbar-right">
            <span className={`connection ${online ? 'connected' : ''}`}>
              <span className="status-dot" />
              {t(online ? 'Connected' : 'Offline')}
            </span>
            <LanguageSelect />
            {farm && (
              <select
                aria-label="Select farm"
                value={farm.id}
                onChange={(e) => open(e.target.value).catch((e) => setError(e.message))}
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <span className="avatar small">{user.name.slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {error && (
            <div className="error" role="alert">
              <span>{t(error)}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="empty">
              <p>{t('Loading…')}</p>
            </div>
          ) : noFarm ? (
            <div className="empty card">
              <MapPinned size={38} />
              <h1>{t('No farms yet')}</h1>
              <Button asChild>
                <Link to="/app/create">
                  {t('Create your first farm')}
                  <Plus size={16} />
                </Link>
              </Button>
            </div>
          ) : (
            <Suspense fallback={<div className="empty">Loading workspace…</div>}>
              <Routes>
                <Route index element={<Twin />} />
                <Route path="farms" element={<Farms />} />
                <Route path="create" element={<CreateFarm />} />
                <Route path="twin" element={<Twin expanded />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="irrigation" element={<Irrigation />} />
                <Route path="insights" element={<Insights />} />
                <Route path="scenarios" element={<Scenarios />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Routes>
            </Suspense>
          )}
          <footer className="app-footer">
            <span>AgriTwin / {t('Research & decision support')}</span>
            <span>
              {t(
                storage === 'local-file'
                  ? 'Local file storage'
                  : 'Simulated states · no physical sensors',
              )}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

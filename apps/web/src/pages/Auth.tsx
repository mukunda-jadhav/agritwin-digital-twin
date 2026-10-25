import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Layers3,
  MapPinned,
  Droplets,
  ChartNoAxesCombined,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { LanguageSelect } from '../components/Language';
import { api, post } from '../services/api';
import { googleConfigured, googleLogin, finishGoogleRedirect } from '../services/firebase';
import { useFarm } from '../stores/useFarm';
import { t } from '../i18n';
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-symbol">
        <Layers3 size={23} />
      </span>
      <span>
        AgriTwin<small>AGRICULTURAL INTELLIGENCE</small>
      </span>
    </Link>
  );
}
export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#platform">{t('Field monitoring')}</a>
          <a href="#methodology">{t('Model information')}</a>
        </nav>
        <div className="inline">
          <LanguageSelect />
          <Link to="/login" className="login-link">
            {t('Sign in')}
          </Link>
          <Button asChild>
            <Link to="/register">
              {t('Create your farm')}
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </header>
      <main>
        <section className="landing-intro">
          <div className="intro-copy">
            <div className="eyebrow">
              <span className="square-mark" />
              {t('Research & decision support')}
            </div>
            <h1>{t('Your farm. Informed decisions.')}</h1>
            <p>
              {t(
                'Understand crop development, water availability and management decisions through a reproducible digital model of your farm.',
              )}
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link to="/register">
                  {t('Create your farm')}
                  <ArrowRight size={17} />
                </Link>
              </Button>
            </div>
            <div className="supported-crops">
              <span>{t('Crop')}</span>
              {['Soybean', 'Cotton', 'Tur', 'Jowar', 'Bajra'].map((c) => (
                <strong key={c}>{t(c)}</strong>
              ))}
            </div>
          </div>
          <div className="intro-spec">
            <span>01 / AGRICULTURAL DIGITAL TWIN</span>
            <p>
              Observe.
              <br />
              Simulate.
              <br />
              Compare.
            </p>
            <div>
              <span className="status-dot" />
              {t('Simulated states · no physical sensors')}
            </div>
          </div>
        </section>
        <section className="landscape-panel">
          <img
            src="/images/field-landscape.jpg"
            alt="Agricultural landscape in natural daylight, used as an illustrative photograph"
            fetchPriority="high"
          />
          <div className="landscape-caption">
            <div>
              <span className="eyebrow">FIELD TO MODEL</span>
              <h2>{t('Agricultural digital twin')}</h2>
              <p>
                {t(
                  'Educational simulation. Field validation is required before making real farming decisions.',
                )}
              </p>
            </div>
            <span className="photo-note">Illustrative landscape · Unsplash</span>
          </div>
          <div className="landscape-reference">
            <MapPinned size={18} />
            <span>
              {t('Location & boundary')}
              <small>{t('Crops & plots')}</small>
            </span>
          </div>
        </section>
        <section id="platform" className="platform-grid">
          {[
            {
              icon: MapPinned,
              title: 'Field monitoring',
              body: 'Field inspection',
              link: '/app/twin',
            },
            {
              icon: Droplets,
              title: 'Water planning',
              body: 'Irrigation recommendation',
              link: '/app/irrigation',
            },
            {
              icon: ChartNoAxesCombined,
              title: 'Scenario analysis',
              body: 'Compare metric',
              link: '/app/scenarios',
            },
          ].map((f, i) => (
            <article key={f.title}>
              <span className="module-number">0{i + 1}</span>
              <f.icon size={25} />
              <h2>{t(f.title)}</h2>
              <p>{t(f.body)}</p>
              <Link to="/login">
                {t('Open workspace')}
                <ChevronRight size={17} />
              </Link>
            </article>
          ))}
        </section>
        <section className="methodology" id="methodology">
          <div>
            <div className="eyebrow">{t('Reference assumptions')}</div>
            <h2>{t('Model information')}</h2>
          </div>
          <p>
            {t(
              'Educational simulation. Field validation is required before making real farming decisions.',
            )}
          </p>
          <div className="method-tags">
            <span>FAO ET₀ / Kc</span>
            <span>Growing degree days</span>
            <span>Open-Meteo</span>
          </div>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Final-year engineering project · Agricultural decision support</span>
        <LanguageSelect />
      </footer>
    </div>
  );
}
export function Auth({ register = false }: { register?: boolean }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [googleReady, setGoogleReady] = useState(false),
    navigate = useNavigate();
  useEffect(() => {
    api('/auth/providers')
      .then((r) => setGoogleReady(googleConfigured && r.google))
      .catch(() => {});
    finishGoogleRedirect()
      .then((r) => {
        if (r) {
          useFarm.getState().setUser(r.user);
          navigate('/app');
        }
      })
      .catch((e) => setError(e.message));
  }, []);
  async function google() {
    setBusy(true);
    setError('');
    try {
      const r = await googleLogin();
      if (r) {
        useFarm.getState().setUser(r.user);
        navigate('/app');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-visual">
        <Brand />
        <div>
          <div className="eyebrow">{t('Agricultural digital twin')}</div>
          <h1>{t('Your farm. Informed decisions.')}</h1>
          <p>
            {t(
              'Understand crop development, water availability and management decisions through a reproducible digital model of your farm.',
            )}
          </p>
        </div>
        <span>{t('Research & decision support')}</span>
      </aside>
      <main className="auth-main">
        <LanguageSelect />
        <div className="auth-card">
          <div className="eyebrow">{t('Farm workspace')}</div>
          <h1>{t(register ? 'Create a new account' : 'Sign in')}</h1>
          {googleReady && (
            <>
              <Button className="google-button" variant="outline" disabled={busy} onClick={google}>
                <span className="google-g">G</span>
                {t('Continue with Google')}
              </Button>
              <div className="auth-divider">
                <span>{t('Email address')}</span>
              </div>
            </>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setBusy(true);
              try {
                const r = await post(
                  `/auth/${register ? 'register' : 'login'}`,
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                useFarm.getState().setUser(r.user);
                navigate('/app');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {register && (
              <label>
                {t('Your name')}
                <input name="name" autoComplete="name" minLength={2} maxLength={80} required />
              </label>
            )}
            <label>
              {t('Email address')}
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              {t('Password')}
              <input
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                minLength={register ? 10 : 1}
                maxLength={128}
                required
              />
            </label>
            {register && <small>{t('Use at least 10 characters.')}</small>}
            {error && (
              <div className="error" role="alert">
                {t(error)}
              </div>
            )}
            <Button disabled={busy} className="full-width">
              {t(busy ? 'Working…' : register ? 'Create account' : 'Sign in')}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p className="auth-switch">
            <Link to={register ? '/login' : '/register'}>
              {t(register ? 'Existing account' : 'Create a new account')}
              <ArrowRight size={14} />
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

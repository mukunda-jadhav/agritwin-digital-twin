import { PlotSettings } from '../components/PlotSettings';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, MapPin, Plus, Tractor, Trash2 } from 'lucide-react';
import { useFarm } from '../stores/useFarm';
import { api } from '../services/api';
import { Button } from '../components/ui/button';
import { fmt } from '../components/common';
import { t } from '../i18n';
import { googleConfigured, googleLogin } from '../services/firebase';
import { toAcres } from '../utils/landArea';
export function Farms() {
  const { farms, open } = useFarm(),
    navigate = useNavigate();
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{t('FARM PORTFOLIO')}</div>
        <h1>{t('My farms')}</h1>
        <p>{t('Manage farm records, crop configurations and saved simulations.')}</p>
        <Button asChild>
          <Link to="/app/create">
            <Plus size={16} />
            {t('Create a farm')}
          </Link>
        </Button>
      </div>
      <div className="farms-grid">
        {farms.map((f) => (
          <article className="card farm-card" key={f.id}>
            <div className="farm-illustration">
              <MapPin size={26} />
              <span>
                {f.plots.length}
                {t('plots')}
              </span>
            </div>
            <div className="padded">
              <h2>{f.name}</h2>
              <p>
                <MapPin size={14} />
                {f.location}
              </p>
              <div className="farm-meta">
                <span>
                  {fmt(toAcres(f.area), 2)} {t('acres')}
                </span>
                <span>{[...new Set(f.plots.map((p) => t(p.crop || 'Tomato')))].join(', ')}</span>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await open(f.id);
                  navigate('/app');
                }}
              >
                {t('Open digital farm')}
                <ArrowUpRight size={16} />
              </Button>
            </div>
          </article>
        ))}
        {!farms.length && (
          <div className="empty card">
            <Tractor size={40} />
            <h2>{t('No farms yet')}</h2>
            <p>{t('Create your first farm to start simulating.')}</p>
            <Button asChild>
              <Link to="/app/create">{t('Create a farm')}</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
export function Settings() {
  const { farm, setFarm, load } = useFarm(),
    navigate = useNavigate(),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState(false),
    [googleReady, setGoogleReady] = useState(false);
  useEffect(() => {
    api<{ google: boolean }>('/auth/providers')
      .then((providers) => setGoogleReady(googleConfigured && providers.google))
      .catch(() => setGoogleReady(false));
  }, []);
  if (!farm) return null;
  return (
    <>
      <div className="page-heading">
        <h1>{t('Farm settings')}</h1>
        <p>{t('Keep your farm details up to date.')}</p>
      </div>
      <form
        className="card padded settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const d = Object.fromEntries(new FormData(e.currentTarget));
            const f = await api(`/farms/${farm.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                ...d,
                latitude: Number(d.latitude),
                longitude: Number(d.longitude),
              }),
            });
            setFarm(f);
            await load();
            setMessage('Farm details saved.');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <h2>{t('Farm profile')}</h2>
        <div className="form-grid">
          {(['name', 'location', 'latitude', 'longitude'] as const).map((k) => (
            <label key={k}>
              {k[0].toUpperCase() + k.slice(1)}
              <input
                key={farm.id + k}
                name={k}
                defaultValue={farm[k]}
                type={k === 'latitude' || k === 'longitude' ? 'number' : 'text'}
                step="any"
                required
              />
            </label>
          ))}
        </div>
        <Button>{t('Save changes')}</Button>
        {message && <p role="status">{message}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <hr />
        <h2>{t('Delete farm')}</h2>
        <p>{t('Deletes this farm and all of its runs, irrigation history, and experiments.')}</p>
        {confirm ? (
          <div className="inline">
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                try {
                  await api(`/farms/${farm.id}`, { method: 'DELETE' });
                  await load();
                  navigate('/app/farms');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t('Permanently delete')}
              {farm.name}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirm(false)}>
              {t('Cancel')}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
            {t('Delete farm')}
          </Button>
        )}
      </form>
      <PlotSettings />
      {googleReady && (
        <section className="card padded settings-form">
          <h2>{t('Connect Google account')}</h2>
          <p>
            {t(
              'Sign in with your existing email account first to securely link Google access to your saved farms.',
            )}
          </p>
          <Button
            onClick={async () => {
              try {
                const result = await googleLogin();
                if (result) setMessage('Google account connected.');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t('Connect Google account')}
          </Button>
        </section>
      )}
    </>
  );
}

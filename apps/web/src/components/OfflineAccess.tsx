import { useEffect, useState } from 'react';
import { WifiOff, Download } from 'lucide-react';
import { api } from '../services/api';
import { useFarm } from '../stores/useFarm';
import {
  clearOffline,
  enableOffline,
  offlineData,
  offlineView,
  offlineWarning,
} from '../services/offline';
import { syncDiary } from '../services/diary';
import { t } from '../i18n';

export function OfflineAccess() {
  const { user, load, farm } = useFarm();
  const [saved, setSaved] = useState<Awaited<ReturnType<typeof offlineData>>>();
  const [offline, setOffline] = useState(!navigator.onLine || offlineView);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const update = () => {
      setOffline(!navigator.onLine || offlineView);
      offlineData()
        .then(setSaved)
        .catch(() => {});
    };
    update();
    window.addEventListener('agritwin:offline', update);
    window.addEventListener('offline', update);
    window.addEventListener('online', update);
    return () => {
      window.removeEventListener('agritwin:offline', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('online', update);
    };
  }, [user?.id]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const lastSaved = saved?.records[farm ? `/farms/${farm.id}` : '/farms']?.savedAt;
  return (
    <section className="offline-access" aria-label={t('Offline access')}>
      {offline && (
        <div className="notice" role="status">
          <WifiOff size={20} />
          <div>
            <strong>{t('Offline — viewing saved data')}</strong>
            <p>
              {t(
                'Weather, AI, maps and simulation changes need internet. Diary drafts can be saved here.',
              )}
            </p>
            {lastSaved && (
              <small>
                {t('Last saved')}: {new Date(lastSaved).toLocaleString()}
              </small>
            )}
          </div>
        </div>
      )}
      <details>
        <summary>
          {t('Offline access')}
          {saved ? ` · ${t('Saved on this device')}` : ''}
          {saved?.drafts.length ? ` · ${saved.drafts.length} ${t('Waiting to sync')}` : ''}
        </summary>
        <p>
          {t(
            'Save your farms on this device to read them without internet. Use only a trusted device. Signing out removes its offline copy.',
          )}
        </p>
        {lastSaved && (
          <p>
            {t('Last saved')}: {new Date(lastSaved).toLocaleString()}
          </p>
        )}
        <div className="inline">
          <button
            className="button button-outline"
            disabled={busy || !navigator.onLine}
            onClick={() =>
              run(async () => {
                if (!user) return;
                if (!('serviceWorker' in navigator))
                  throw new Error('Offline reload is not supported in this browser.');
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration?.active)
                  throw new Error(
                    'Offline files are still preparing. Wait a moment and try again.',
                  );
                await api('/auth/me');
                const summaries = await api<import('@agritwin/shared').Farm[]>('/farms');
                const farms = await Promise.all(
                  summaries.map((farm) =>
                    api<import('@agritwin/shared').Farm>(`/farms/${farm.id}`),
                  ),
                );
                if (offlineView) throw new Error('Reconnect to save a fresh offline copy.');
                await enableOffline(user, farms);
                await load();
              })
            }
          >
            <Download size={16} />
            {t(busy ? 'Saving…' : 'Save farms offline')}
          </button>
          <button
            className="button button-outline"
            disabled={busy || !navigator.onLine}
            onClick={() =>
              run(async () => {
                if (!user) return;
                await syncDiary(user.id);
                await load();
              })
            }
          >
            {t('Refresh & sync')}
          </button>
          {saved && (
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (
                    saved.drafts.length &&
                    !window.confirm(
                      t('Unsynced drafts will be removed from this device. Continue?'),
                    )
                  )
                    return;
                  await clearOffline();
                })
              }
            >
              {t('Remove offline copy')}
            </button>
          )}
        </div>
        <p className="muted">
          {t(
            'Offline maps and live AI are not included. Browser storage can be cleared by your device; sync important entries when online.',
          )}
        </p>
      </details>
      {(error || offlineWarning) && (
        <p role="alert" className="error">
          {t(error || offlineWarning)}
        </p>
      )}
    </section>
  );
}

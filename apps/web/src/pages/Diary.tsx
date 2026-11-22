import { useEffect, useState } from 'react';
import { Download, NotebookPen, Trash2 } from 'lucide-react';
import { diaryInput, type DiaryEntry, type Farm } from '@agritwin/shared';
import { useFarm } from '../stores/useFarm';
import { api } from '../services/api';
import { addDiary, syncDiary } from '../services/diary';
import { offlineData, removeDraft, type DiaryDraft } from '../services/offline';
import { t } from '../i18n';

export const diaryTotals = (entries: Pick<DiaryEntry, 'kind' | 'amountPaise'>[]) =>
  entries.reduce((total, entry) => total + (entry.kind === 'expense' ? entry.amountPaise : 0), 0);
const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const csvCell = (value: string) =>
  `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
export function Diary() {
  const { farm, user, setFarm, open } = useFarm();
  const [kind, setKind] = useState<'note' | 'expense'>('note');
  const [month, setMonth] = useState('');
  const [drafts, setDrafts] = useState<DiaryDraft[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    const update = () =>
      offlineData()
        .then((saved) => {
          if (alive)
            setDrafts(
            saved && saved.user.id === user?.id ? saved.drafts.filter((d) => d.farmId === farm?.id) : [],
            );
        })
        .catch(() => {});
    setDrafts([]);
    setMessage('');
    setError('');
    update();
    window.addEventListener('agritwin:offline', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      alive = false;
      window.removeEventListener('agritwin:offline', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [farm?.id, user?.id]);
  if (!farm || !user) return null;
  const saved = farm.diary || [];
  const pending = drafts.filter((d) => !saved.some((entry) => entry.id === d.entry.id));
  const all = [
    ...saved.map((entry) => ({ ...entry, pending: false })),
    ...pending.map((d) => ({ ...d.entry, createdAt: '', pending: true })),
  ];
  const visible = all
    .filter((entry) => !month || entry.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="page-heading">
        <div className="eyebrow">{farm.name}</div>
        <h1>{t('Farm diary')}</h1>
        <p>{t('Write what you did. Keep track of what you spent.')}</p>
      </div>
      <div className="diary-layout">
        <section className="card padded">
          <h2>
            <NotebookPen size={20} /> {t('Add an entry')}
          </h2>
          <form
            key={farm.id}
            className="diary-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                values = new FormData(form);
              setBusy(true);
              setError('');
              setMessage('');
              try {
                const entry = diaryInput.parse({
                  id: crypto.randomUUID(),
                  date: values.get('date'),
                  kind,
                  category: kind === 'expense' ? values.get('category') : 'Other',
                  note: values.get('note'),
                  amountPaise:
                    kind === 'expense' ? Math.round(Number(values.get('amount')) * 100) : 0,
                });
                const result = await addDiary(farm.id, entry);
                if (result.farm) setFarm(result.farm);
                setMessage(
                  result.pending ? 'Saved on this device — waiting to sync.' : 'Diary entry saved.',
                );
                form.reset();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-grid">
              <label>
                {t('Entry type')}
                <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                  <option value="note">{t('Farm note')}</option>
                  <option value="expense">{t('Expense')}</option>
                </select>
              </label>
              <label>
                {t('Date')}
                <input name="date" type="date" defaultValue={today()} required />
              </label>
            </div>
            {kind === 'expense' && (
              <div className="form-grid">
                <label>
                  {t('Category')}
                  <select name="category">
                    {['Seeds', 'Fertilizer', 'Labour', 'Water', 'Transport', 'Other'].map((c) => (
                      <option key={c} value={c}>
                        {t(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('Amount (₹)')}
                  <input
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="100000000"
                    step="0.01"
                    required
                  />
                </label>
              </div>
            )}
            <label>
              {t('What did you do?')}
              <textarea
                name="note"
                rows={3}
                maxLength={1000}
                required
                placeholder={t('For example: bought seeds or checked the crop.')}
              />
            </label>
            <button className="button button-primary" disabled={busy}>
              {t(busy ? 'Saving…' : 'Save entry')}
            </button>
            <p className="muted">
              {t(
                'These are your records. They do not change the crop simulation or estimated profit.',
              )}
            </p>
          </form>
          {error && (
            <p role="alert" className="error">
              {t(error)}
            </p>
          )}
          {message && (
            <p role="status" className="success">
              {t(message)}
            </p>
          )}
        </section>
        <section className="card padded">
          <div className="section-heading">
            <h2>{t('Your entries')}</h2>
            <button
              className="button button-outline"
              disabled={!visible.length}
              onClick={() => {
                const rows = [
                  ['Date', 'Type', 'Category', 'Note', 'Amount INR', 'Status'],
                  ...visible.map((e) => [
                    e.date,
                    e.kind,
                    e.category,
                    e.note,
                    (e.amountPaise / 100).toFixed(2),
                    e.pending ? 'Pending sync' : 'Saved',
                  ]),
                ];
                const url = URL.createObjectURL(
                  new Blob(
                    ['\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')],
                    { type: 'text/csv;charset=utf-8' },
                  ),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = `farm-diary-${today()}.csv`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={16} />
              {t('Download')}
            </button>
          </div>
          <label>
            {t('Filter by month')}
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          {month && (
            <button className="button button-outline" onClick={() => setMonth('')}>
              {t('Show all dates')}
            </button>
          )}
          <div className="diary-total">
            <span>{t(month ? 'Expenses this month' : 'Expenses — all dates')}</span>
            <strong>{rupees(diaryTotals(visible))}</strong>
            <small>{t('Includes pending entries shown below. Recorded spending only.')}</small>
          </div>
          {pending.length > 0 && (
            <div className="notice">
              <div>
                <strong>
                  {pending.length} {t('Waiting to sync')}
                </strong>
                <p>{t('Connect to the internet, then sync your entries.')}</p>
                <button
                  className="button button-outline"
                  disabled={busy || !navigator.onLine}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await syncDiary(user.id);
                      await open(farm.id);
                      setMessage('Diary entries synced.');
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t('Sync entries')}
                </button>
              </div>
            </div>
          )}
          {!visible.length && (
            <p className="empty">{t('No entries yet. Add your first note or expense.')}</p>
          )}
          <ul className="diary-list">
            {visible.map((entry) => (
              <li key={entry.id}>
                <div className="section-heading">
                  <strong>
                    {entry.date} · {t(entry.kind === 'expense' ? entry.category : 'Farm note')}
                  </strong>
                  {entry.kind === 'expense' && <strong>{rupees(entry.amountPaise)}</strong>}
                </div>
                <p>{entry.note}</p>
                <div className="section-heading">
                  <span className="badge">{t(entry.pending ? 'Waiting to sync' : 'Saved')}</span>
                  <button
                    className="button button-outline"
                    aria-label={`${t('Remove entry')} ${entry.date}`}
                    disabled={busy || (!entry.pending && !navigator.onLine)}
                    onClick={async () => {
                      if (!window.confirm(t('Remove this diary entry?'))) return;
                      setBusy(true);
                      setError('');
                      try {
                        if (entry.pending) await removeDraft(entry.id);
                        else
                          setFarm(
                            await api<Farm>(`/farms/${farm.id}/diary/${entry.id}`, {
                              method: 'DELETE',
                            }),
                          );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Trash2 size={15} />
                    {t('Remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

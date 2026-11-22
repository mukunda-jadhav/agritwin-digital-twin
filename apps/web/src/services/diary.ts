import { diaryInput, type DiaryInput, type Farm } from '@agritwin/shared';
import { api, post, NetworkUnavailable } from './api';
import { offlineData, offlineView, removeDraft, saveDraft } from './offline';

export async function addDiary(farmId: string, entry: DiaryInput) {
  const validated = diaryInput.parse(entry);
  try {
    return { farm: await post<Farm>(`/farms/${farmId}/diary`, validated), pending: false };
  } catch (error) {
    if (!(error instanceof NetworkUnavailable)) throw error;
    await saveDraft(farmId, validated);
    return { farm: undefined, pending: true };
  }
}
let syncing: Promise<number> | null = null;
export function syncDiary(userId: string): Promise<number> {
  if (syncing) return syncing;
  syncing = (async () => {
    const me = await api('/auth/me');
    if (offlineView || me.user.id !== userId)
      throw new Error('Connect and sign in to the same account to sync.');
    const saved = await offlineData();
    if (!saved || saved.user.id !== userId) return 0;
    let count = 0;
    for (const draft of saved.drafts) {
      await post(`/farms/${draft.farmId}/diary`, draft.entry);
      await removeDraft(draft.entry.id);
      count++;
    }
    return count;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

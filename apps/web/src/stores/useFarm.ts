import { create } from 'zustand';
import type { Farm, PublicUser } from '@agritwin/shared';
import { api } from '../services/api';
type State = {
  user: PublicUser | null;
  farms: Farm[];
  farm: Farm | null;
  selected: string;
  online: boolean;
  setUser: (u: PublicUser | null) => void;
  select: (id: string) => void;
  setFarm: (f: Farm) => void;
  load: () => Promise<void>;
  open: (id: string, refresh?: boolean) => Promise<void>;
  setOnline: (v: boolean) => void;
};
let selectionVersion = 0;
let loadVersion = 0;
export const useFarm = create<State>((set, get) => ({
  user: null,
  farms: [],
  farm: null,
  selected: '',
  online: false,
  setUser: (user) => {
    if (get().user?.id !== user?.id) {
      selectionVersion++;
      loadVersion++;
      set({ user, farms: [], farm: null, selected: '', online: false });
    } else set({ user });
  },
  select: (selected) => set({ selected }),
  setOnline: (online) => set({ online }),
  setFarm: (farm) => {
    if (farm.ownerId !== get().user?.id || (get().farm && get().farm!.id !== farm.id)) return;
    set({
      farm,
      farms: get().farms.map((f) => f.id === farm.id ? { ...f, name: farm.name, location: farm.location, plots: farm.plots } : f),
      selected: farm.plots.some((p) => p.id === get().selected) ? get().selected : farm.plots[0]?.id || '',
    });
  },
  load: async () => {
    const userId = get().user?.id, request = ++loadVersion, selection = selectionVersion;
    const farms = await api<Farm[]>('/farms');
    if (get().user?.id !== userId || request !== loadVersion) return;
    set({ farms });
    if (selection !== selectionVersion) return;
    if (farms.length)
      await get().open(farms.some((f) => f.id === get().farm?.id) ? get().farm!.id : farms[0].id);
    else set({ farm: null });
  },
  open: async (id, refresh = false) => {
    if (refresh && get().farm?.id !== id) return;
    const userId = get().user?.id;
    const request = refresh ? selectionVersion : ++selectionVersion;
    const farm = await api<Farm>(`/farms/${id}`);
    if (request !== selectionVersion || userId !== get().user?.id || farm.ownerId !== userId) return;
    if (refresh && get().farm?.id !== id) return;
    set({ farm, selected: farm.plots.some((p) => p.id === get().selected) ? get().selected : farm.plots[0]?.id || '' });
  },
}));

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
  open: (id: string) => Promise<void>;
  setOnline: (v: boolean) => void;
};
export const useFarm = create<State>((set, get) => ({
  user: null,
  farms: [],
  farm: null,
  selected: '',
  online: false,
  setUser: (user) => set({ user }),
  select: (selected) => set({ selected }),
  setOnline: (online) => set({ online }),
  setFarm: (farm) =>
    set({
      farm,
      selected: farm.plots.some((p) => p.id === get().selected) ? get().selected : farm.plots[0].id,
    }),
  load: async () => {
    const farms = await api<Farm[]>('/farms');
    set({ farms });
    if (farms.length)
      await get().open(farms.some((f) => f.id === get().farm?.id) ? get().farm!.id : farms[0].id);
    else set({ farm: null });
  },
  open: async (id) => get().setFarm(await api<Farm>(`/farms/${id}`)),
}));

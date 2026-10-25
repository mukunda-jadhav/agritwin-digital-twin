import i18n, { t } from '../i18n';
import { cropFor, MODEL_VERSION, type Farm, type Snapshot, type Plot } from '@agritwin/shared';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { Droplets, Leaf, Wheat, Activity } from 'lucide-react';
export const last = (f: Farm) => f.run.history[f.run.history.length - 1];
const soils = {
  Loam: { field: 90, wilt: 36 },
  Sandy: { field: 54, wilt: 18 },
  Clay: { field: 114, wilt: 60 },
};
export const moisture = (soil: keyof typeof soils, water: number, rootDepthM = 0.3) => {
  const scale = rootDepthM / 0.3,
    field = soils[soil].field * scale,
    wilt = soils[soil].wilt * scale;
  return Math.max(0, Math.min(100, ((water - wilt) / (field - wilt)) * 100));
};
export const plotMoisture = (plot: Plot, water: number, modelVersion = MODEL_VERSION) =>
  moisture(plot.soil, water, modelVersion === MODEL_VERSION ? cropFor(plot.crop).rootDepthM : 0.3);
export const fmt = (v: number, d = 0) =>
  v.toLocaleString(i18n.language, { maximumFractionDigits: d });
export const dateLabel = (v: string) =>
  new Date(v + 'T00:00:00').toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export function metrics(f: Farm, s: Snapshot = last(f)) {
  const area = f.plots.reduce((t, p) => t + p.area, 0);
  return {
    moisture:
      s.states.reduce((t, x) => {
        const p = f.plots.find((p) => p.id === x.plotId)!;
        return t + plotMoisture(p, x.water, f.run.modelVersion) * p.area;
      }, 0) / area,
    growth:
      (s.states.reduce((t, x) => t + x.growth * f.plots.find((p) => p.id === x.plotId)!.area, 0) /
        area) *
      100,
    stress:
      (s.states.reduce((t, x) => t + x.stress * f.plots.find((p) => p.id === x.plotId)!.area, 0) /
        area) *
      100,
    water: s.states.reduce((t, x) => t + x.waterLitres, 0),
    yield: s.states.reduce((t, x) => t + x.yieldKg, 0),
  };
}
export function StatCards({ farm, snapshot }: { farm: Farm; snapshot?: Snapshot }) {
  const m = metrics(farm, snapshot);
  return (
    <div className="stat-grid">
      {[
        {
          label: 'Available soil water',
          value: fmt(m.moisture, 1),
          unit: '%',
          icon: Droplets,
          note: 'Area-weighted • simulated',
          color: 'blue',
        },
        {
          label: 'Crop development',
          value: fmt(m.growth, 1),
          unit: '%',
          icon: Leaf,
          note: '100% = maximum development',
          color: 'green',
        },
        {
          label: 'Water applied',
          value: fmt(m.water / 1000, 1),
          unit: 'm³',
          icon: Activity,
          note: 'Gross irrigation this run',
          color: 'blue',
        },
        {
          label: 'Estimated yield',
          value: fmt(m.yield / 1000, 2),
          unit: 't',
          icon: Wheat,
          note: 'Simulation baseline estimate',
          color: 'gold',
        },
      ].map((c) => (
        <article className="stat card" key={t(c.label)}>
          <div className="stat-label">
            {c.label}
            <c.icon size={18} className={c.color} />
          </div>
          <div className="stat-value">
            {c.value}
            <span>{c.unit}</span>
          </div>
          <small>{t(c.note)}</small>
        </article>
      ))}
    </div>
  );
}
export function HistoryChart({ farm, plotId }: { farm: Farm; plotId?: string }) {
  const plot = plotId ? farm.plots.find((p) => p.id === plotId) : undefined;
  const data = farm.run.history.flatMap((snapshot) => {
    if (plotId) {
      const state = snapshot.states.find((item) => item.plotId === plotId);
      if (!plot || !state) return [];
      return [
        {
          date: snapshot.date.slice(5),
          moisture: plotMoisture(plot, state.water, farm.run.modelVersion),
          growth: state.growth * 100,
        },
      ];
    }
    return [{ date: snapshot.date.slice(5), ...metrics(farm, snapshot) }];
  });
  return (
    <div className="chart" aria-label="Soil water and crop growth history">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4e9370" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#4e9370" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e9ede7" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} width={32} />
          <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Legend />
          <Area
            isAnimationActive={false}
            name={t('Available water %')}
            dataKey="moisture"
            stroke="#39865d"
            fill="url(#waterFill)"
            strokeWidth={2.5}
          />
          <Area
            isAnimationActive={false}
            name={t('Growth %')}
            dataKey="growth"
            stroke="#c39a43"
            fill="transparent"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ComparisonChart({
  data,
  field,
}: {
  data: any[];
  field: 'moisture' | 'stress' | 'growth' | 'water' | 'yield';
}) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid vertical={false} stroke="#e9ede7" />
          <XAxis dataKey="day" />
          <YAxis width={65} />
          <Tooltip formatter={(v) => fmt(Number(v), 1)} />
          <Legend />
          <Line
            isAnimationActive={false}
            name={t('Baseline')}
            dataKey={`a${field}`}
            stroke="#39865d"
            dot={false}
            strokeWidth={2}
          />
          <Line
            isAnimationActive={false}
            name={t('Experiment')}
            dataKey={`b${field}`}
            stroke="#cf9340"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

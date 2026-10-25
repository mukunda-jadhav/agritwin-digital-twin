import type { Farm } from '@agritwin/shared';
export function fieldLayout(farm: Farm) {
  const cols = Math.min(3, Math.ceil(Math.sqrt(farm.plots.length))),
    gap = 3;
  let z = 0;
  const fields: { id: string; x: number; z: number; width: number; depth: number }[] = [];
  for (let row = 0; row < Math.ceil(farm.plots.length / cols); row++) {
    const plots = farm.plots.slice(row * cols, (row + 1) * cols),
      sizes = plots.map((p) => ({
        width: Math.sqrt(p.area * 1.4),
        depth: Math.sqrt(p.area / 1.4),
      })),
      total = sizes.reduce((v, s) => v + s.width, 0) + gap * (sizes.length - 1);
    let x = -total / 2;
    const depth = Math.max(...sizes.map((s) => s.depth));
    plots.forEach((p, i) => {
      const s = sizes[i];
      fields.push({
        id: p.id,
        x: x + s.width / 2,
        z: z + s.depth / 2,
        width: s.width,
        depth: s.depth,
      });
      x += s.width + gap;
    });
    z += depth + gap;
  }
  const depth = z - gap;
  fields.forEach((f) => (f.z -= depth / 2));
  const width = Math.max(...fields.map((f) => Math.abs(f.x) + f.width / 2)) * 2;
  return { fields, width, depth, extent: Math.max(width, depth) };
}

import { Component, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  cropFor,
  MODEL_VERSION,
  type Farm,
  type Plot,
  type PlotState,
  type Snapshot,
} from '@agritwin/shared';
import { last, plotMoisture } from '../components/common';
import { fieldLayout } from './layout';
import { t } from '../i18n';
export type CameraView = 'aerial' | 'isometric' | 'close' | 'inspect' | 'boundary';
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        3D is unavailable on this device. All plot measurements and simulation controls remain
        available below.
      </div>
    ) : (
      this.props.children
    );
  }
}
function soilTexture(grass = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!,
    image = ctx.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) {
    const x = i % 256,
      y = Math.floor(i / 256),
      noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1,
      ripple = grass ? 0 : Math.sin(x * 0.65) * 4;
    const shade = noise * 7 + ripple * 0.2;
    image.data[i * 4] = (grass ? 105 : 133) + shade;
    image.data[i * 4 + 1] = (grass ? 112 : 111) + shade;
    image.data[i * 4 + 2] = (grass ? 80 : 84) + shade;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function leafGeometry(form: string, leafWidth: number) {
  const points: number[] = [],
    uv: number[] = [],
    indices: number[] = [],
    segments = 10;
  for (let i = 0; i <= segments; i++) {
    const f = i / segments,
      width =
        Math.sin(Math.PI * f) *
        Math.max(0.035, Math.min(0.24, leafWidth * 2.2)) *
        (form === 'fruit' && i % 2 ? 0.72 : 1),
      bend = f * f * 0.65;
    points.push(-width, f * (1 - f * 0.3), bend, width, f * (1 - f * 0.3), bend);
    uv.push(0, f, 1, f);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function PlantStand({
  plot,
  state,
  width,
  depth,
  budget,
  close = false,
}: {
  plot: Plot;
  state: PlotState;
  width: number;
  depth: number;
  budget: number;
  close?: boolean;
}) {
  const crop = cropFor(plot.crop),
    stems = useRef<THREE.InstancedMesh>(null),
    leaves = useRef<THREE.InstancedMesh>(null),
    produce = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(() => {
    const rows = Math.max(1, Math.floor((width - 1) / crop.rowSpacing)),
      perRow = Math.max(1, Math.floor((depth - 1) / crop.plantSpacing)),
      stride = Math.max(1, Math.ceil(Math.sqrt((rows * perRow) / budget))),
      result: { x: number; z: number; v: number }[] = [];
    for (let r = 0; r < rows; r += stride)
      for (let p = 0; p < perRow; p += stride) {
        const v = (Math.sin((r + 1) * 12.3 + (p + 1) * 8.9) + 1) / 2;
        result.push({
          x: (r / Math.max(1, rows - 1) - 0.5) * Math.max(0.2, width - 1.2),
          z: (p / Math.max(1, perRow - 1) - 0.5) * Math.max(0.2, depth - 1.2),
          v,
        });
      }
    for (let r = 0; close && r < rows && r * crop.rowSpacing < 5; r++)
      for (let p = 0; p < perRow && p * crop.plantSpacing < 7; p++) {
        if (r % stride === 0 && p % stride === 0) continue;
        result.push({
          x: (r - (rows - 1) / 2) * crop.rowSpacing,
          z: (p - (perRow - 1) / 2) * crop.plantSpacing,
          v: (Math.sin(r * 9.1 + p * 3.7) + 1) / 2,
        });
      }
    return result;
  }, [crop, width, depth, budget, close]);
  const leaf = useMemo(() => leafGeometry(crop.form, crop.leafWidth), [crop.form, crop.leafWidth]),
    stemGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 5), []),
    fruitGeometry = useMemo(
      () =>
        crop.form === 'fruit' || crop.form === 'fiber' || crop.form === 'groundnut'
          ? new THREE.SphereGeometry(1, 7, 5)
          : new THREE.CapsuleGeometry(
              crop.form === 'grass' ? 0.012 : 0.032,
              crop.form === 'grass' ? 0.1 : 0.16,
              3,
              6,
            ),
      [crop.form, crop.name],
    );
  useEffect(() => () => leaf.dispose(), [leaf]);
  useEffect(() => () => stemGeometry.dispose(), [stemGeometry]);
  useEffect(() => () => fruitGeometry.dispose(), [fruitGeometry]);
  useLayoutEffect(() => {
    if (!stems.current || !leaves.current || !produce.current) return;
    const matrix = new THREE.Object3D(),
      grown = state.stage !== 'Not planted' && state.gdd >= crop.stages[1].gdd,
      harvested =
        state.growth >= 1 &&
        ((state.harvestedKg || 0) > 0 || state.harvestReviewed) &&
        state.yieldKg - (state.harvestedKg || 0) < 0.000001,
      height = harvested ? 0.1 : crop.maxHeight * Math.max(0.08, Math.min(1, state.growth / 0.68)),
      mature = state.growth > 0.83,
      leafColor = new THREE.Color(
        state.stress > 0.65
          ? '#8b7942'
          : mature && crop.form !== 'fruit'
            ? '#9c8b50'
            : crop.form === 'grass' || crop.form === 'cane'
              ? '#4f682f'
              : '#536c36',
      );
    let li = 0,
      fi = 0;
    stems.current.count = grown ? points.length : 0;
    leaves.current.count = 0;
    produce.current.count = 0;
    if (!grown) return;
    points.forEach((point, i) => {
      const h = height * (0.93 + point.v * 0.14),
        stemRadius =
          crop.form === 'cane' || crop.name === 'Maize'
            ? 0.014
            : crop.form === 'fruit' || crop.form === 'fiber'
              ? 0.008
              : 0.0035;
      matrix.position.set(point.x, h / 2, point.z);
      matrix.rotation.set(0, 0, 0);
      matrix.scale.set(stemRadius, h, stemRadius);
      matrix.updateMatrix();
      stems.current!.setMatrixAt(i, matrix.matrix);
      const count = harvested ? 0 : crop.form === 'grass' || crop.form === 'cane' ? 6 : 4;
      for (let j = 0; j < count; j++) {
        matrix.position.set(point.x, h * (0.18 + j * 0.105), point.z);
        matrix.rotation.set(0, j * 2.399 + point.v, crop.form === 'fruit' ? 0.5 : 0.15);
        const length =
          crop.form === 'fruit' ? h * 0.5 : crop.form === 'grass' ? h * 0.42 : h * 0.65;
        matrix.scale.set(length, length, length);
        matrix.updateMatrix();
        leaves.current!.setMatrixAt(li, matrix.matrix);
        leaves.current!.setColorAt(li, leafColor);
        li++;
      }
      const reproductive = state.gdd >= crop.headGdd;
      if (
        reproductive &&
        !harvested &&
        (state.harvestedKg || 0) < Math.max(0.000001, state.yieldKg)
      ) {
        const countFruit = crop.form === 'fruit' ? 3 : 1;
        const compactHead = crop.form !== 'fruit';
        for (let j = 0; j < countFruit; j++) {
          matrix.position.set(
            point.x + (compactHead ? 0 : Math.cos(j * 2) * 0.14),
            crop.form === 'groundnut' ? 0.08 : compactHead ? h : h * (0.45 + j * 0.1),
            point.z + (compactHead ? 0 : Math.sin(j * 2) * 0.14),
          );
          matrix.rotation.set(0, point.v, 0);
          matrix.scale.setScalar(
            crop.form === 'fruit'
              ? 0.025 + Math.min(0.025, state.growth * 0.03)
              : crop.form === 'fiber' || crop.form === 'groundnut'
                ? 0.06
                : 0.035,
          );
          matrix.updateMatrix();
          produce.current!.setMatrixAt(fi, matrix.matrix);
          produce.current!.setColorAt(
            fi,
            new THREE.Color(
              crop.form === 'fruit'
                ? state.gdd >= 1150
                  ? '#a84931'
                  : '#75823e'
                : crop.form === 'fiber'
                  ? '#e5e1cf'
                  : crop.form === 'groundnut'
                    ? '#a98a54'
                    : mature
                      ? '#baa16b'
                      : '#81904a',
            ),
          );
          fi++;
        }
      }
    });
    leaves.current.count = li;
    produce.current.count = fi;
    [stems, leaves, produce].forEach((ref) => {
      ref.current!.instanceMatrix.needsUpdate = true;
      if (ref.current!.instanceColor) ref.current!.instanceColor!.needsUpdate = true;
      ref.current!.computeBoundingSphere();
    });
  }, [crop, state, points]);
  return (
    <group>
      <instancedMesh ref={stems} args={[stemGeometry, undefined, points.length]} castShadow>
        <meshStandardMaterial color="#637042" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[leaf, undefined, points.length * 6]}>
        <meshStandardMaterial color="white" side={THREE.DoubleSide} roughness={0.88} />
      </instancedMesh>
      <instancedMesh ref={produce} args={[fruitGeometry, undefined, points.length * 3]} castShadow>
        <meshStandardMaterial color="white" roughness={0.8} />
      </instancedMesh>
    </group>
  );
}
function FieldRows({ width, depth, cropName }: { width: number; depth: number; cropName: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const spacing = Math.max(0.35, cropFor(cropName).rowSpacing * 1.2);
  const count = Math.max(1, Math.min(100, Math.floor((width - 1) / spacing)));
  useLayoutEffect(() => {
    if (!ref.current) return;
    const object = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      object.position.set(((i + 0.5) / count - 0.5) * (width - 0.7), 0.008, 0);
      object.rotation.set(-Math.PI / 2, 0, 0);
      object.scale.set(Math.min(0.22, (width / count) * 0.25), Math.max(0.2, depth - 0.6), 1);
      object.updateMatrix();
      ref.current.setMatrixAt(i, object.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [width, depth, count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} receiveShadow>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial color="#66543e" roughness={1} polygonOffset polygonOffsetFactor={-1} />
    </instancedMesh>
  );
}
function Parcel({
  plot,
  state,
  field,
  modelVersion,
  selected,
  onSelect,
  budget,
  close = false,
}: {
  plot: Plot;
  state: PlotState;
  field: ReturnType<typeof fieldLayout>['fields'][0];
  modelVersion: string;
  selected: boolean;
  onSelect: () => void;
  budget: number;
  close?: boolean;
}) {
  const soil = useMemo(() => {
    const map = soilTexture();
    map.repeat.set(field.width / 3, field.depth / 3);
    return map;
  }, [field.width, field.depth]);
  useEffect(() => () => soil.dispose(), [soil]);
  const { width: w, depth: d } = field,
    water = plotMoisture(plot, state.water, modelVersion);
  const boundaries: [number, number, number][] = [
    [-w / 2, 0.035, -d / 2],
    [w / 2, 0.035, -d / 2],
    [w / 2, 0.035, d / 2],
    [-w / 2, 0.035, d / 2],
    [-w / 2, 0.035, -d / 2],
  ];
  return (
    <group
      position={[field.x, 0, field.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[w, 0.26, d]} />
        <meshStandardMaterial
          map={soil}
          color={water < 30 ? '#d9c5a5' : '#b0a087'}
          roughness={1}
          bumpMap={soil}
          bumpScale={0.012}
        />
      </mesh>
      <Line
        points={boundaries}
        color={selected ? '#f4e2a6' : '#a4ae8c'}
        lineWidth={selected ? 2 : 0.7}
      />
      <FieldRows width={w} depth={d} cropName={plot.crop || 'Tomato'} />
      <PlantStand plot={plot} state={state} width={w} depth={d} budget={budget} close={close} />
      {plot.method === 'Drip' &&
        Array.from({ length: Math.min(30, Math.floor(w / 2)) }, (_, i) => (
          <mesh key={i} position={[-w / 2 + 1 + i * 2, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, d, 4]} />
            <meshStandardMaterial color="#383b32" roughness={0.9} />
          </mesh>
        ))}
    </group>
  );
}
function Camera({
  view,
  layout,
  selected,
}: {
  view: CameraView;
  layout: ReturnType<typeof fieldLayout>;
  selected: string;
}) {
  const controls = useRef<any>(null),
    { camera, invalidate, size: viewport } = useThree(),
    target = useRef(new THREE.Vector3()),
    position = useRef(new THREE.Vector3());
  useEffect(() => {
    const f = layout.fields.find((f) => f.id === selected) || layout.fields[0],
      s = layout.extent * Math.max(1, viewport.height / viewport.width);
    if (view === 'aerial' || view === 'boundary') {
      target.current.set(0, 0, 0);
      position.current.set(0, s * 1.05, s * 0.02);
    } else if (view === 'isometric') {
      target.current.set(0, 0, 0);
      position.current.set(s * 0.68, s * 0.78, s * 0.8);
    } else if (view === 'inspect') {
      target.current.set(f.x, 0, f.z);
      position.current.set(f.x + f.width * 0.65, f.width * 0.75, f.z + f.depth * 0.6);
    } else {
      const x = f.x - f.width / 2 + 2,
        z = f.z - f.depth / 2 + 3;
      target.current.set(x, 0.6, z);
      position.current.set(x + 3, 2.2, z + 4);
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(position.current);
      controls.current?.target.copy(target.current);
    }
    invalidate();
  }, [view, selected, layout, camera, invalidate, viewport.width, viewport.height]);
  const moving = useRef(true);
  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [view, selected, layout, invalidate, viewport.width, viewport.height]);
  useFrame((_, dt) => {
    if (moving.current && controls.current) {
      camera.position.lerp(position.current, Math.min(1, dt * 5));
      controls.current.target.lerp(target.current, Math.min(1, dt * 5));
      controls.current.update();
      if (camera.position.distanceTo(position.current) < 0.03) moving.current = false;
      else invalidate();
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      enablePan={false}
      dampingFactor={0.12}
      minDistance={1.8}
      maxDistance={layout.extent * 2.4}
      maxPolarAngle={Math.PI / 2.08}
      onStart={() => {
        moving.current = false;
      }}
    />
  );
}
export default function FarmScene({
  farm,
  snapshot,
  selected,
  onSelect,
  view = 'isometric',
  night = false,
}: {
  farm: Farm;
  snapshot?: Snapshot;
  selected: string;
  onSelect: (id: string) => void;
  view?: CameraView;
  night?: boolean;
}) {
  const layoutKey = JSON.stringify(farm.plots.map((p) => [p.id, p.area]));
  const snap = snapshot || last(farm),
    boundaryKey = farm.boundary?.length
      ? JSON.stringify(farm.boundary.map(({ lat, lng }) => [lat, lng]))
      : '',
    footprint = useMemo(() => {
      const boundary = boundaryKey ? farm.boundary : null;
      if (!boundary || boundary.length < 3) return null;
      const lat = boundary.reduce((v, p) => v + p.lat, 0) / boundary.length;
      const lng = boundary.reduce((v, p) => v + p.lng, 0) / boundary.length;
      const pts = boundary.map(
        (p) =>
          new THREE.Vector2(
            (p.lng - lng) * 111320 * Math.cos((lat * Math.PI) / 180),
            (p.lat - lat) * 111320,
          ),
      );
      const box = new THREE.Box2().setFromPoints(pts),
        center = box.getCenter(new THREE.Vector2());
      pts.forEach((p) => p.sub(center));
      return {
        shape: new THREE.Shape(pts),
        width: box.max.x - box.min.x,
        depth: box.max.y - box.min.y,
      };
    }, [boundaryKey]),
    layout = useMemo(() => {
      const normal = fieldLayout(farm);
      return view === 'boundary' && footprint
        ? {
            ...normal,
            width: footprint.width,
            depth: footprint.depth,
            extent: Math.max(10, footprint.width, footprint.depth),
          }
        : normal;
    }, [farm.id, layoutKey, view === 'boundary', footprint]),
    ground = useMemo(() => {
      const texture = soilTexture(true);
      texture.repeat.set(80, 80);
      return texture;
    }, []);
  useEffect(() => () => ground.dispose(), [ground]);
  const size = layout.extent,
    cameraConfig = useMemo(
      () => ({
        position: [size * 0.68, size * 0.78, size * 0.8] as [number, number, number],
        fov: 45,
        near: 0.1,
        far: Math.max(300, size * 12),
      }),
      [size],
    ),
    rain = (snap.weather?.rain || 0) > 1;
  return (
    <SceneBoundary>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={cameraConfig}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        aria-label={t('Field model')}
      >
        <color attach="background" args={[night ? '#273039' : rain ? '#b8c0bd' : '#dce0da']} />
        <fog attach="fog" args={[rain ? '#b8c0bd' : '#dce0da', size * 1.8, size * 5]} />
        <hemisphereLight args={['#e1e9ef', '#615543', night ? 0.4 : 1.6]} />
        <directionalLight
          position={[size * 0.5, size * 0.9, -size * 0.4]}
          intensity={night ? 0.5 : rain ? 1 : 2.6}
          color="#fff1dc"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-size}
          shadow-camera-right={size}
          shadow-camera-top={size}
          shadow-camera-bottom={-size}
          shadow-camera-far={size * 3}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]} receiveShadow>
          <planeGeometry args={[size * 8, size * 8]} />
          <meshStandardMaterial map={ground} roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
          <planeGeometry args={[layout.width + 8, layout.depth + 8]} />
          <meshStandardMaterial color="#9d9788" roughness={1} />
        </mesh>
        {view === 'boundary' && footprint ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <shapeGeometry args={[footprint.shape]} />
            <meshStandardMaterial color="#9c825c" side={THREE.DoubleSide} roughness={1} />
          </mesh>
        ) : (
          layout.fields.map((field) => (
            <Parcel
              key={field.id}
              field={field}
              plot={farm.plots.find((p) => p.id === field.id)!}
              modelVersion={farm.run.modelVersion || MODEL_VERSION}
              state={snap.states.find((s) => s.plotId === field.id)!}
              selected={selected === field.id}
              onSelect={() => onSelect(field.id)}
              close={view === 'close' && selected === field.id}
              budget={Math.max(180, Math.floor(10000 / farm.plots.length))}
            />
          ))
        )}
        <Camera view={view} layout={layout} selected={selected} />
      </Canvas>
    </SceneBoundary>
  );
}

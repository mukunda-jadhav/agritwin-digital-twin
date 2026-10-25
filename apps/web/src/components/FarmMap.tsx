import { useEffect, useRef, useState, type FormEvent } from 'react';
import L from 'leaflet';
import { area } from '@turf/area';
import 'leaflet/dist/leaflet.css';
import { Crosshair, PenLine, Search, Trash2, Undo2 } from 'lucide-react';
import { Button } from './ui/button';
import { t } from '../i18n';
import { toAcres } from '../utils/landArea';
type Point = { lat: number; lng: number };
type Place = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};
function boundaryArea(points: Point[]) {
  if (points.length < 3) return 0;
  const ring = points.map((p) => [p.lng, p.lat]);
  return area({ type: 'Polygon', coordinates: [[...ring, ring[0]]] });
}
export function FarmMap({
  latitude,
  longitude,
  boundary,
  location,
  onLocation,
  onLocationName,
  onBoundary,
}: {
  latitude: number;
  longitude: number;
  boundary: Point[];
  location: string;
  onLocation: (p: Point, address?: string) => void;
  onLocationName: (name: string) => void;
  onBoundary: (points: Point[], area: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const outline = useRef<L.Polygon | null>(null);
  const vertices = useRef<L.LayerGroup | null>(null);
  const points = useRef(boundary);
  const drawingRef = useRef(false);
  const callbacks = useRef({ onLocation, onBoundary });
  callbacks.current = { onLocation, onBoundary };
  points.current = boundary;
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState('');
  const [tileError, setTileError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  function update(next: Point[]) {
    points.current = next;
    callbacks.current.onBoundary(next, boundaryArea(next));
  }
  useEffect(() => {
    if (!container.current) return;
    const m = L.map(container.current, { scrollWheelZoom: false, doubleClickZoom: false }).setView(
      [latitude, longitude],
      16,
    );
    map.current = m;
    L.tileLayer(
      import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          import.meta.env.VITE_MAP_ATTRIBUTION ||
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    )
      .on('tileerror', () => setTileError(true))
      .addTo(m);
    marker.current = L.circleMarker([latitude, longitude], {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#166534',
      fillOpacity: 1,
    })
      .addTo(m)
      .bindTooltip('Farm location');
    outline.current = L.polygon(boundary, { color: '#166534', weight: 2, fillOpacity: 0.18 }).addTo(
      m,
    );
    vertices.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      const p = { lat: e.latlng.lat, lng: e.latlng.wrap().lng };
      if (drawingRef.current) update([...points.current, p]);
      else callbacks.current.onLocation(p);
    });
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return;
    marker.current?.setLatLng([latitude, longitude]);
    map.current?.panTo([latitude, longitude]);
  }, [latitude, longitude]);
  useEffect(() => {
    outline.current?.setLatLngs(boundary);
    vertices.current?.clearLayers();
    boundary.forEach((p, index) => {
      const vertex = L.marker([p.lat, p.lng], {
        draggable: true,
        title: `Boundary corner ${index + 1}: drag to adjust`,
        icon: L.divIcon({
          className: 'farm-boundary-vertex',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      });
      vertex.on('dragend', () => {
        const next = [...points.current],
          position = vertex.getLatLng();
        next[index] = { lat: position.lat, lng: position.wrap().lng };
        update(next);
      });
      vertices.current?.addLayer(vertex);
    });
  }, [boundary]);
  function locate() {
    setError('');
    if (!navigator.geolocation) {
      setError('Device location is unavailable. Enter coordinates below.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        callbacks.current.onLocation({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setError('Location permission was unavailable. Enter coordinates below.');
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }
  async function searchPlaces(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = location.trim();
    if (query.length < 2) {
      setSearchError(t('Enter a village, taluka or district name.'));
      setPlaces([]);
      return;
    }
    setSearching(true);
    setSearchError('');
    setPlaces([]);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '5',
        countrycode: 'IN',
        lat: String(latitude),
        lon: String(longitude),
      });
      const response = await fetch(`https://photon.komoot.io/api/?${params}`);
      if (!response.ok) throw new Error('Place search is temporarily unavailable.');
      const result = (await response.json()) as { features?: Place[] };
      const matches = (result.features || []).filter(
        (place) =>
          place.properties?.countrycode?.toUpperCase() === 'IN' &&
          place.geometry?.coordinates?.length === 2 &&
          place.geometry.coordinates.every(Number.isFinite),
      );
      setPlaces(matches);
      if (!matches.length)
        setSearchError(t('No matching places found. Try a village, taluka or district.'));
    } catch {
      setSearchError(
        t(
          'Place search is temporarily unavailable. Choose a point on the map or enter coordinates.',
        ),
      );
    } finally {
      setSearching(false);
    }
  }
  function selectPlace(place: Place) {
    const { name, city, county, state } = place.properties;
    const address = [name, city, county, state]
      .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
      .join(', ');
    const [lng, lat] = place.geometry.coordinates;
    onLocationName(address || location.trim());
    onLocation({ lat, lng }, address);
    setPlaces([]);
    setSearchError('');
  }
  function placeLabel(place: Place) {
    const { name, city, county, state } = place.properties;
    return [name, city, county, state]
      .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index)
      .join(', ');
  }
  return (
    <div className="map-selector">
      <p className="muted">
        Select your farm on the map, use device location, or enter coordinates below. OpenStreetMap
        requires no API key.
      </p>
      <form className="place-search" onSubmit={searchPlaces} role="search">
        <label htmlFor="farm-place-search">{t('Search village, taluka or district')}</label>
        <div className="place-search-row">
          <input
            id="farm-place-search"
            value={location}
            onChange={(event) => {
              onLocationName(event.target.value);
              setPlaces([]);
              setSearchError('');
            }}
            placeholder={t('e.g. Gangapur, Nashik')}
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={searching}
            aria-label={t('Search place')}
          >
            <Search size={16} />
            {searching ? t('Searching…') : t('Search place')}
          </Button>
        </div>
        {searchError && (
          <p className="place-search-message" role="status">
            {searchError}
          </p>
        )}
        {places.length > 0 && (
          <ul className="place-results" aria-label={t('Matching places')}>
            {places.map((place, index) => (
              <li key={`${place.geometry.coordinates.join(',')}-${index}`}>
                <button type="button" onClick={() => selectPlace(place)}>
                  {placeLabel(place)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div
        className="farm-location-map"
        ref={container}
        role="region"
        aria-label="Farm location map. Use arrow keys to pan, plus or minus to zoom."
      />
      <div className="map-actions">
        <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
          <Crosshair size={16} />
          {locating ? 'Locating…' : t('Use my location')}
        </Button>
        <Button
          type="button"
          variant={drawing ? 'default' : 'outline'}
          size="sm"
          aria-pressed={drawing}
          onClick={() => {
            drawingRef.current = !drawing;
            setDrawing(!drawing);
          }}
        >
          <PenLine size={16} />
          {t(drawing ? 'Finish boundary' : 'Draw boundary')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const p = map.current?.getCenter();
            if (p) {
              const point = { lat: p.lat, lng: p.wrap().lng };
              if (drawing) update([...points.current, point]);
              else onLocation(point);
            }
          }}
        >
          {drawing ? 'Add map centre as corner' : 'Use map centre'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!boundary.length}
          onClick={() => update(points.current.slice(0, -1))}
        >
          <Undo2 size={16} />
          Undo corner
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!boundary.length}
          onClick={() => update([])}
        >
          <Trash2 size={16} />
          {t('Clear boundary')}
        </Button>
      </div>
      {drawing && (
        <p role="status" className="muted">
          Click each corner in order around your field, then finish. Avoid crossing edges. Drag
          corners to adjust. Keyboard: pan with arrow keys and use “Add map centre as corner”.
        </p>
      )}
      {boundary.length > 0 && (
        <p className="muted" role="status">
          {boundary.length} corners ·{' '}
          {boundary.length < 3
            ? 'Add at least three corners to calculate area.'
            : `Approximate area: ${toAcres(boundaryArea(boundary)).toFixed(3)} acres. Confirm against your land records.`}
        </p>
      )}
      {tileError && (
        <p className="error" role="alert">
          Map imagery could not load. Check your connection or enter coordinates below.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <p className="muted">
        Road and land-feature map; satellite imagery is not included.{' '}
        {t('Map location does not determine soil, crops or soil moisture.')}
      </p>
    </div>
  );
}

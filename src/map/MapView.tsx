import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import regions from '../data/italy-regions.json';
import { assetUrl, destinations, type Destination } from '../data/catalog';
import './map.css';

export default function MapView({ onSelect, language = 'it' }: { onSelect: (destination: Destination) => void; language?: 'it' | 'en' }) {
  const container = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { center: [40.7, 16.1], zoom: 10, minZoom: 10, maxZoom: 12, zoomControl: false, maxBounds: [[39, 14], [42, 18]] });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.geoJSON(regions as GeoJSON.GeoJsonObject, { style: { color: 'grey', fillColor: 'white', weight: 1, fillOpacity: 1 }, interactive: false }).addTo(map);
    for (const [name, lat, lng, size] of [['Basilicata', 40.525909, 16.179019, 60], ['Matera', 40.6695, 16.6024, 30], ['Potenza', 40.6453, 15.8094, 30]] as const) {
      L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: `region-label ${name.toLowerCase()}-title`, html: `<span style="font-size:${size}px">${name}</span>`, iconSize: [220, 100], iconAnchor: [110, 50] }) }).addTo(map);
    }
    const markers = destinations.map(destination => {
      const marker = L.marker(destination.coordinates, { title: destination.name, alt: destination.name, keyboard: true, icon: makeIcon(destination, map.getZoom()) }).addTo(map);
      marker.on('click', () => select.current(destination));
      return { marker, destination };
    });
    const onZoom = () => markers.forEach(({ marker, destination }) => marker.setIcon(makeIcon(destination, map.getZoom())));
    map.on('zoomend', onZoom);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    const frame = requestAnimationFrame(() => map.invalidateSize());
    return () => { cancelAnimationFrame(frame); observer.disconnect(); map.off('zoomend', onZoom); map.remove(); };
  }, []);
  return <div className="territory-map" ref={container} aria-label={language === 'en' ? 'Map of Basilicata destinations' : 'Mappa delle località della Basilicata'}><div className="blue-overlay" aria-hidden="true" /></div>;
}

function makeIcon(destination: Destination, zoom: number) {
  const scale = zoom >= 12 ? 2.5 : zoom >= 11 ? 1.8 : zoom < 10 ? 0.7 : 1;
  return L.icon({ iconUrl: assetUrl(destination.mapIcon), iconSize: [destination.markerSize[0] * scale, destination.markerSize[1] * scale] });
}

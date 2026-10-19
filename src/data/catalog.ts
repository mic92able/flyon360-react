import rawDestinations from './destinations.json';
import actualPaths from './asset-paths.json';
import rawAliases from './asset-aliases.json';
import rawInfo from './info.json';

export type Language = 'it' | 'en';
export interface Destination {
  id: string;
  name: string;
  coordinates: [number, number];
  panorama: string;
  mapIcon: string;
  crest: string;
  sites: { name: string; panorama: string }[];
  markerSize: [number, number];
}
export interface DestinationInfo {
  eventi: { nome: string; data: string }[];
  numeri_utili: { nome: string; numero: string }[];
  link_mappa: string;
  link_youtube: string;
  link_youtube_inglese: string;
}
export const destinations = rawDestinations as Destination[];
export const destinationInfo = rawInfo as Record<string, DestinationInfo>;
const fileIndex = new Map(actualPaths.map(path => [path.normalize('NFC').toLowerCase(), path]));
const aliases = rawAliases as Record<string, string>;

/** Match actual disk spelling, including Unicode normalization and case. */
export function resolveAssetPath(input: string): string {
  let path = input;
  try { path = decodeURIComponent(path); } catch { /* Preserve a literal percent in a filename. */ }
  path = path.replace(/^.*?assets\//, '').replace(/^(\.\.\/|\.\/|\/)+/, '').replace(/\/{2,}/g, '/').normalize('NFC');
  path = aliases[path] ?? path;
  return fileIndex.get(path.normalize('NFC').toLowerCase()) ?? path;
}

export function assetUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const configuredBase = import.meta.env.VITE_ASSET_BASE_URL?.trim();
  const base = configuredBase
    ? configuredBase.replace(/\/?$/, '/')
    : `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}assets/`;
  const resolved = resolveAssetPath(path);
  // Cloudflare's API rejects the stored `S.S..jpg` object key.
  const deployPath = configuredBase ? resolved.replace(/\.\.(?=[^/]*$)/g, '.') : resolved;
  return `${base}${deployPath.split('/').map(encodeURIComponent).join('/')}`;
}

export function getPanoramaUrl(url: string, language: Language): string {
  const path = resolveAssetPath(url).replace(/MENU(?:_360|360INGLESE)/, language === 'en' ? 'MENU360INGLESE' : 'MENU_360');
  return assetUrl(path);
}

/** Preserve the map URL exactly as supplied by the content catalog. */
export function getMapUrl(destination: Destination): { url: string; embeddable: boolean } {
  const url = destinationInfo[destination.name]?.link_mappa;
  return { url: url ?? '', embeddable: Boolean(url) };
}

/** Select the town-specific immersive flight for the active language. */
export function getVideo(destination: Destination, language: Language): string | undefined {
  const info = destinationInfo[destination.name];
  return language === 'en' ? info?.link_youtube_inglese : info?.link_youtube;
}

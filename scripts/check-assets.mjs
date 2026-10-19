import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsRoot = path.join(root, 'public', 'assets');
const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));

const [destinations, hotspots, indexedPaths, aliases, townInfo] = await Promise.all([
  readJson('src/data/destinations.json'),
  readJson('src/scene/hotspots.json'),
  readJson('src/data/asset-paths.json'),
  readJson('src/data/asset-aliases.json'),
  readJson('src/data/info.json'),
]);

async function walk(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await walk(path.join(directory, entry.name), relative));
    else result.push(relative);
  }
  return result;
}

const diskPaths = (await walk(assetsRoot)).sort();
const diskSet = new Set(diskPaths);
const issues = [];
const corrections = { alias: 0, case: 0, unicode: 0, exact: 0 };
const references = [];
const normalizedKey = value => value.normalize('NFC').toLocaleLowerCase('en-US');
const normalizedIndex = new Map();

for (const actual of diskPaths) {
  const key = normalizedKey(actual);
  const matches = normalizedIndex.get(key) ?? [];
  matches.push(actual);
  normalizedIndex.set(key, matches);
}

for (const [key, matches] of normalizedIndex) {
  if (matches.length > 1) issues.push(`Ambiguous case/Unicode key ${JSON.stringify(key)}: ${matches.join(', ')}`);
}

function cleanAssetPath(input) {
  let value = input;
  try { value = decodeURIComponent(value); } catch { /* A literal percent is a legal filename character. */ }
  return value
    .replace(/^.*?assets\//, '')
    .replace(/^(\.\.\/|\.\/|\/)+/, '')
    .replace(/\/{2,}/g, '/')
    .normalize('NFC');
}

function resolve(input) {
  const cleaned = cleanAssetPath(input);
  const aliased = aliases[cleaned] ?? cleaned;
  const matches = normalizedIndex.get(normalizedKey(aliased)) ?? [];
  return { cleaned, aliased, actual: matches.length === 1 ? matches[0] : undefined, usedAlias: aliased !== cleaned };
}

function reference(kind, owner, input) {
  const result = resolve(input);
  references.push({ kind, owner, input, ...result });
  if (!result.actual) {
    issues.push(`Missing ${kind} for ${owner}: ${JSON.stringify(input)} (resolved as ${JSON.stringify(result.aliased)})`);
    return;
  }
  if (result.usedAlias) corrections.alias++;
  else if (result.actual !== result.aliased && result.actual.normalize('NFC') === result.aliased.normalize('NFC')) corrections.unicode++;
  else if (result.actual !== result.aliased) corrections.case++;
  else corrections.exact++;
}

function preview(input, size) {
  return input.replace(/(\.[^./]+)$/, `_resize${size}$1`);
}

const ids = new Set();
const townNames = new Set();
const siteNames = new Set();
const sitePanoramas = new Map();
const siteOwners = new Map();
const videoIds = new Set();
const videoUrlPattern = /^https:\/\/www\.youtube\.com\/embed\/([A-Za-z0-9_-]{11})(?:\?.*)?$/;
const mapIds = new Set();
const mapUrlPattern = /^https:\/\/www\.google\.com\/maps\/d\/embed\?mid=([^&]+)(?:&.*)?$/;

for (const destination of destinations) {
  if (!destination.id || ids.has(destination.id)) issues.push(`Invalid or duplicate destination id: ${JSON.stringify(destination.id)}`);
  ids.add(destination.id);
  if (!destination.name || townNames.has(destination.name)) issues.push(`Invalid or duplicate destination name: ${JSON.stringify(destination.name)}`);
  townNames.add(destination.name);
  if (!Array.isArray(destination.coordinates) || destination.coordinates.length !== 2 || destination.coordinates.some(value => !Number.isFinite(value))) {
    issues.push(`Invalid coordinates for ${destination.name}`);
  }
  reference('map icon', destination.name, destination.mapIcon);
  reference('crest', destination.name, destination.crest);
  for (const language of ['it', 'en']) {
    const panorama = cleanAssetPath(destination.panorama).replace(/MENU(?:_360|360INGLESE)/, language === 'en' ? 'MENU360INGLESE' : 'MENU_360');
    reference(`town panorama (${language})`, destination.name, panorama);
    reference(`town preview 75 (${language})`, destination.name, preview(panorama, 75));
    reference(`town preview 50 (${language})`, destination.name, preview(panorama, 50));
  }
  const localSites = new Set();
  for (const site of destination.sites) {
    if (!site.name || localSites.has(site.name)) issues.push(`Invalid or duplicate site in ${destination.name}: ${JSON.stringify(site.name)}`);
    localSites.add(site.name);
    siteNames.add(site.name);
    if (siteOwners.has(site.name)) issues.push(`Site name is ambiguous across destinations: ${site.name}`);
    siteOwners.set(site.name, destination.name);
    sitePanoramas.set(`${destination.name}\0${site.name}`, cleanAssetPath(site.panorama));
    reference('site panorama', `${destination.name} / ${site.name}`, site.panorama);
    reference('site preview 75', `${destination.name} / ${site.name}`, preview(site.panorama, 75));
    reference('site preview 50', `${destination.name} / ${site.name}`, preview(site.panorama, 50));
  }
}

const hotspotIds = new Set();
const navigation = new Map();
const siteAudio = new Set();
const addNavigation = (from, to) => navigation.set(from, [...(navigation.get(from) ?? []), to]);
for (const hotspot of hotspots) {
  if (!hotspot.id || hotspotIds.has(hotspot.id)) issues.push(`Invalid or duplicate hotspot id: ${JSON.stringify(hotspot.id)}`);
  hotspotIds.add(hotspot.id);
  if (hotspot.context !== 'town' && hotspot.context !== 'site') issues.push(`Invalid context on hotspot ${hotspot.id}: ${hotspot.context}`);
  if (hotspot.context === 'town' && !townNames.has(hotspot.key)) issues.push(`Unknown town key on hotspot ${hotspot.id}: ${hotspot.key}`);
  if (hotspot.context === 'site' && !siteNames.has(hotspot.key)) issues.push(`Unknown site key on hotspot ${hotspot.id}: ${hotspot.key}`);
  const hasCenter = Array.isArray(hotspot.center) && hotspot.center.length === 3 && hotspot.center.every(Number.isFinite) && Number.isFinite(hotspot.radius);
  const hasVertices = Array.isArray(hotspot.vertices) && hotspot.vertices.length === 12 && hotspot.vertices.every(Number.isFinite);
  if (hasCenter === hasVertices) issues.push(`Hotspot ${hotspot.id} must have either center/radius or four vertices`);

  if (hotspot.action?.type === 'navigate') {
    reference('hotspot panorama', hotspot.id, hotspot.action.url);
    if (hotspot.action.site) {
      const owner = hotspot.context === 'town' ? hotspot.key : siteOwners.get(hotspot.key);
      addNavigation(`${hotspot.context}:${hotspot.key}`, `site:${hotspot.action.site}`);
      const catalogPanorama = sitePanoramas.get(`${owner}\0${hotspot.action.site}`);
      if (!catalogPanorama) issues.push(`Hotspot ${hotspot.id} navigates to a site absent from ${hotspot.key}`);
      else if (resolve(catalogPanorama).actual !== resolve(hotspot.action.url).actual) issues.push(`Hotspot ${hotspot.id} panorama differs from the catalog`);
    }
    if (hotspot.action.town) addNavigation(`${hotspot.context}:${hotspot.key}`, `town:${hotspot.action.town}`);
  } else if (hotspot.action?.type === 'audio') {
    if (hotspot.context !== 'site') issues.push(`Audio hotspot ${hotspot.id} is outside a site scene`);
    siteAudio.add(hotspot.key);
    for (const [language, folder] of [['it', 'AUDIO_SITI'], ['en', 'AUDIO_SITI_INGLESE']]) {
      reference(`audio (${language})`, hotspot.id, `${hotspot.action.prefix}${folder}${hotspot.action.suffix}`);
    }
  } else if (hotspot.action?.type !== 'video') {
    issues.push(`Unknown action on hotspot ${hotspot.id}`);
  }
}

for (const destination of destinations) {
  const info = townInfo[destination.name];
  if (!info) issues.push(`Missing town info for ${destination.name}`);
  const mapMatch = typeof info?.link_mappa === 'string' ? info.link_mappa.match(mapUrlPattern) : null;
  if (!mapMatch) issues.push(`Invalid Google Maps embed for ${destination.name}: ${JSON.stringify(info?.link_mappa)}`);
  else if (mapIds.has(mapMatch[1])) issues.push(`Duplicate Google Maps id for ${destination.name}: ${mapMatch[1]}`);
  else mapIds.add(mapMatch[1]);
  for (const [language, key] of [['it', 'link_youtube'], ['en', 'link_youtube_inglese']]) {
    const url = info?.[key];
    const match = typeof url === 'string' ? url.match(videoUrlPattern) : null;
    if (!match) issues.push(`Invalid YouTube video (${language}) for ${destination.name}: ${JSON.stringify(url)}`);
    else if (videoIds.has(match[1])) issues.push(`Duplicate YouTube video id for ${destination.name} (${language}): ${match[1]}`);
    else videoIds.add(match[1]);
  }
  const reachable = new Set([`town:${destination.name}`]);
  const pending = [...reachable];
  while (pending.length) {
    for (const target of navigation.get(pending.shift()) ?? []) {
      if (!reachable.has(target)) { reachable.add(target); pending.push(target); }
    }
  }
  for (const site of destination.sites) {
    if (!reachable.has(`site:${site.name}`)) issues.push(`No hotspot path reaches ${destination.name} / ${site.name} from its town panorama`);
    if (!siteAudio.has(site.name)) issues.push(`No audio hotspot exists for ${destination.name} / ${site.name}`);
  }
}

for (const [source, target] of Object.entries(aliases)) {
  if (source !== source.normalize('NFC') || target !== target.normalize('NFC')) issues.push(`Alias must use NFC spelling: ${source} -> ${target}`);
  if (diskSet.has(source)) issues.push(`Redundant alias source exists exactly on disk: ${source}`);
  if (!resolve(target).actual) issues.push(`Alias target does not exist: ${source} -> ${target}`);
}

const indexedSet = new Set(indexedPaths);
for (const actual of diskPaths) if (!indexedSet.has(actual)) issues.push(`asset-paths.json omits disk file: ${actual}`);
for (const indexed of indexedPaths) if (!diskSet.has(indexed)) issues.push(`asset-paths.json contains stale file: ${indexed}`);
if (indexedSet.size !== indexedPaths.length) issues.push('asset-paths.json contains duplicate entries');

console.log(`Assets on disk: ${diskPaths.length}`);
console.log(`Catalog: ${destinations.length} destinations, ${sitePanoramas.size} sites`);
console.log(`Hotspots: ${hotspots.length}; references checked: ${references.length}`);
console.log(`YouTube: ${videoIds.size} distinct town/language videos`);
console.log(`Google Maps: ${mapIds.size} distinct town embeds`);
console.log(`Resolution: ${corrections.exact} exact, ${corrections.case} case, ${corrections.unicode} Unicode, ${corrections.alias} alias`);

if (issues.length) {
  console.error(`\nAsset validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Asset validation passed.');
}

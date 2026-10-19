import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { destinations, getVideo, type Destination, type Language } from './data/catalog';
import Shell, { AudioPlayer, VideoDialog } from './ui/Shell';
import './app.css';

const MapView = lazy(() => import('./map/MapView'));
const Panorama = lazy(() => import('./scene/Panorama'));

type HomeView = { kind: 'home' };
type TownView = { kind: 'town'; town: string; url: string };
type SiteView = { kind: 'site'; town: string; site: string; url: string };
type View = HomeView | TownView | SiteView;
type LoadingState = { active: boolean; progress: number };

export default function App() {
  // The application always opens in Italian; language selection lasts
  // for the current session only.
  const [language, setLanguage] = useState<Language>('it');
  const [view, setView] = useState<View>({ kind: 'home' });
  const [audioUrl, setAudioUrl] = useState<string>();
  const [videoOpen, setVideoOpen] = useState(false);
  const [loading, setLoading] = useState<LoadingState>({ active: false, progress: 0 });

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const goHome = useCallback(() => {
    setView({ kind: 'home' });
    setAudioUrl(undefined);
    setVideoOpen(false);
    setLoading({ active: false, progress: 0 });
  }, []);

  const openDestination = useCallback((destinationOrName: Destination | string) => {
    const destination = typeof destinationOrName === 'string'
      ? destinations.find(item => item.name === destinationOrName)
      : destinationOrName;
    if (!destination) return;
    setView({ kind: 'town', town: destination.name, url: destination.panorama });
    setAudioUrl(undefined);
    setVideoOpen(false);
  }, []);

  const navigatePanorama = useCallback((url: string, eventTown?: string, site?: string) => {
    setAudioUrl(undefined);
    setVideoOpen(false);
    if (eventTown) {
      const destination = destinations.find(item => item.name === eventTown);
      if (destination) setView({ kind: 'town', town: destination.name, url: destination.panorama });
      return;
    }
    if (!site) return;
    setView(current => {
      if (current.kind === 'home') return current;
      return { kind: 'site', town: current.town, site, url };
    });
  }, []);

  const selectedDestination = useMemo(
    () => view.kind === 'home' ? undefined : destinations.find(item => item.name === view.town),
    [view],
  );
  const video = selectedDestination ? getVideo(selectedDestination, language) : undefined;
  const shellView = view.kind === 'home'
    ? view
    : view.kind === 'town'
      ? { kind: 'town' as const, town: view.town }
      : { kind: 'site' as const, town: view.town, site: view.site };

  return <Shell
    language={language}
    onLanguage={setLanguage}
    view={shellView}
    onHome={goHome}
    onDestination={openDestination}
  >
    <Suspense fallback={<div className="module-loading" role="status">{language === 'it' ? 'Preparazione…' : 'Preparing…'}</div>}>
      {view.kind === 'home'
        ? <MapView onSelect={openDestination} language={language} />
        : <Panorama
          url={view.url}
          town={view.kind === 'town' ? view.town : undefined}
          site={view.kind === 'site' ? view.site : undefined}
          language={language}
          onNavigate={navigatePanorama}
          onAudio={setAudioUrl}
          onVideo={() => setVideoOpen(true)}
          onHome={goHome}
          onLoading={(active, progress) => setLoading({ active, progress })}
          />}
    </Suspense>
    {loading.active && <><div className="loading-progress" style={{ width: `${loading.progress}%` }} /><div className="loading-overlay" role="status" aria-label={language === 'it' ? 'Caricamento panorama' : 'Loading panorama'}><span className="loading-spinner" aria-hidden="true" /></div></>}
    {audioUrl && <AudioPlayer url={audioUrl} />}
    {videoOpen && <VideoDialog
      url={video ?? ''}
      onClose={() => setVideoOpen(false)}
    />}
  </Shell>;
}

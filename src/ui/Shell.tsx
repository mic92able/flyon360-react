import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { destinations, assetUrl } from '../data/catalog';
import rawInfo from './town-info.json';
import './ui.css';

export type Language = 'it' | 'en';
type View = { kind: 'home' } | { kind: 'town'; town: string } | { kind: 'site'; town: string; site: string };
type Props = { language: Language; onLanguage: (language: Language) => void; view: View; onHome: () => void; onDestination: (name: string) => void; children: ReactNode };
type TownInfo = { eventi: { nome: string; data: string }[]; numeri_utili: { nome: string; numero: string }[]; link_mappa?: string };
const townInfo = rawInfo as Record<string, TownInfo>;
const image = (path: string) => assetUrl(path.startsWith('assets/') ? path : `assets/${path}`);

function LanguageSwitch({ language, onLanguage }: Pick<Props, 'language' | 'onLanguage'>) {
  return <div className="language-switch">
    <img src={image('ita.png')} alt="Italiano" />
    <button type="button" role="switch" aria-checked={language === 'en'} aria-label={language === 'it' ? 'Passa all’inglese' : 'Switch to Italian'} onClick={() => onLanguage(language === 'it' ? 'en' : 'it')}><span aria-hidden="true" /></button>
    <img src={image('eng.png')} alt="English" />
  </div>;
}

export default function Shell({ language, onLanguage, view, onHome, onDestination, children }: Props) {
  const en = language === 'en';
  const t = (it: string, english: string) => en ? english : it;
  const [intro, setIntro] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<'main' | 'embed' | 'events' | 'numbers' | 'map'>('main');
  const embedRef = useRef<HTMLTextAreaElement>(null);
  const introRef = useRef<HTMLDialogElement>(null);
  const introTitleId = useId();
  const town = view.kind === 'home' ? undefined : view.town;
  const chromeVisible = view.kind !== 'site';
  const info = town ? townInfo[town] : undefined;
  const embed = '<iframe src="https://www.flyvr.it" frameborder="0"></iframe>';
  useEffect(() => { setPanel('main'); setMenu(false); }, [view.kind, town]);
  useEffect(() => {
    const dialog = introRef.current;
    if (intro && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [intro]);
  const closeIntro = () => { introRef.current?.close(); setIntro(false); };
  function copyEmbed() {
    embedRef.current?.focus();
    embedRef.current?.select();
    document.execCommand('copy');
    window.alert(`Testo copiato: ${embed}`);
  }
  return <div className={`fly-shell ${expanded ? 'carousel-expanded' : ''} ${chromeVisible ? '' : 'chrome-hidden'}`}>
    {chromeVisible && <header className="brand-header"><img src={image('ICONE/be-cultour_Logo_Ist.jpg')} alt="Be.Cultour — APT Basilicata e partner" /></header>}
    <main className="explorer-stage" id="explorer-main">
      {view.kind === 'home' && <h1 className="visually-hidden">{t('Mappa interattiva del Vulture e Alto Bradano', 'Interactive map of Vulture and Alto Bradano')}</h1>}
      {children}
      {view.kind === 'home' && <img className="compass" src={image('ROSADEIVENTI.png')} alt="" />}
      {chromeVisible && <div className="navigation-area">
        <div className={`navigation-heading ${view.kind !== 'home' ? 'white' : ''}`}>
          {view.kind !== 'home' && <h1>{town}</h1>}
          <button type="button" className="menu-toggle" aria-expanded={menu} aria-controls="explorer-menu" aria-label={menu ? t('Chiudi menu', 'Close menu') : t('Apri menu', 'Open menu')} onClick={() => setMenu(!menu)}><span className={`menu-icon ${menu ? 'close' : 'hamburger'}`} aria-hidden="true"><i /><i /><i /></span></button>
        </div>
        {menu && <section className={`explorer-menu ${panel === 'map' ? 'wide' : ''}`} id="explorer-menu" aria-label={t('Menu esplorazione', 'Explore menu')}>
          {panel !== 'main' && <button type="button" className="panel-back" aria-label={t('Indietro', 'Back')} onClick={() => setPanel('main')}>&lt;</button>}
          {panel === 'main' && view.kind === 'home' && <>
            <LanguageSwitch language={language} onLanguage={onLanguage} />
            <div className="home-info-text">{t('Benvenuti nella mappa di esplorazione di APT Basilicata “Area del Vulture e Alto Bradano”', 'Welcome to the exploration map of APT Basilicata “Vulture Area and Alto Bradano”')}</div>
            <div className="short-rule" aria-hidden="true" /><div className="home-info-text">{t('Clicca sulle città ed esplora i territori', 'Click on the cities and explore the territories')}</div>
            <button type="button" className="outline-button" onClick={() => setPanel('embed')}>{t('Incorpora URL', 'Embed URL')}</button>
            <div className="policy-links"><a href="https://www.iubenda.com/privacy-policy/62608995" target="_blank" rel="noreferrer">Privacy Policy</a><a href="https://www.iubenda.com/privacy-policy/62608995/cookie-policy" target="_blank" rel="noreferrer">Cookie Policy</a></div>
            <div className="short-rule" aria-hidden="true" /><div className="credits">Credits:<br /><a href="https://www.basilicataturistica.it" target="_blank" rel="noreferrer">basilicataturistica.it</a><br /><a href="https://www.becultour.eu" target="_blank" rel="noreferrer">becultour.eu</a><div className="credit-columns"><div>{t('Foto & Video', 'Photos & Videos')}<br /><a href="https://www.fly-on.it" target="_blank" rel="noreferrer">www.fly-on.it</a></div><div>{t('Testi & grafica', 'Texts & Graphics')}<br /><a href="https://www.do-de.it" target="_blank" rel="noreferrer">www.do-de.it</a></div></div></div>
          </>}
          {panel === 'embed' && <><h2>{t('Incorpora la mappa', 'Embed the map')}</h2><label htmlFor="embed-code">{t('Codice da incorporare', 'Embed code')}</label><textarea ref={embedRef} id="embed-code" readOnly value={embed} /><button type="button" className="outline-button" onClick={copyEmbed}>{t('Copia', 'Copy')}</button></>}
          {panel === 'main' && view.kind !== 'home' && <nav className="town-actions" aria-label={town}>
            <button type="button" onClick={() => setPanel('events')}>{t('EVENTI', 'EVENTS')}<span aria-hidden="true">›</span></button>
            <button type="button" onClick={() => setPanel('numbers')}>{t('NUMERI UTILI', 'USEFUL NUMBERS')}<span aria-hidden="true">›</span></button>
            <button type="button" onClick={() => setPanel('map')}>{t('MAPPA', 'MAP')}<span aria-hidden="true">›</span></button>
          </nav>}
          {panel === 'events' && <><h2>{t('Eventi', 'Events')}</h2><ul className="info-list">{info?.eventi.map((item, i) => <li key={i}><strong>{item.data}</strong><span>&quot;{item.nome}&quot;</span></li>)}</ul></>}
          {panel === 'numbers' && <><h2>{t('Numeri utili', 'Useful numbers')}</h2><ul className="info-list">{info?.numeri_utili.map((item, i) => <li key={i}><strong>{item.nome}</strong><span>{item.numero}</span></li>)}</ul></>}
          {panel === 'map' && <iframe className="town-map-frame" title={t('Mappa di ', 'Map of ') + town} src={info?.link_mappa} allowFullScreen />}
        </section>}
      </div>}
    </main>
    <nav className="destination-dock" aria-label={t('Destinazioni', 'Destinations')}>
      <button type="button" className="dock-toggle" aria-expanded={expanded} aria-controls="destination-list" aria-label={expanded ? t('Nascondi destinazioni', 'Hide destinations') : t('Mostra destinazioni', 'Show destinations')} onClick={() => setExpanded(!expanded)}><span aria-hidden="true">{expanded ? '⌄' : '⌃'}</span></button>
      {expanded && <div className="destination-list" id="destination-list"><button type="button" className="destination" aria-current={view.kind === 'home' ? 'page' : undefined} onClick={onHome}><img className="home-crest" src={image('ICONE/ICONA_HOME.png')} alt="" /><span>Home</span></button>{destinations.map(destination => <button type="button" key={destination.id} className="destination" aria-current={town === destination.name ? 'page' : undefined} onClick={() => onDestination(destination.name)}><img src={assetUrl(destination.crest)} alt="" /><span>{destination.name}</span></button>)}</div>}
    </nav>
    {intro && <dialog className="intro-dialog" ref={introRef} aria-labelledby={introTitleId} onCancel={event => event.preventDefault()}><div className="intro-content"><LanguageSwitch language={language} onLanguage={onLanguage} /><img className="intro-title-image" src={image('POP_UP/popup_tit.png')} alt="Vulture e Alto Bradano" /><h2 id={introTitleId}>{t("Questa è una mappa per l'esplorazione dei territori Zona Vulture - Alto Bradano, Basilicata, Italia", 'This is a map of exploration Vulture - Alto Bradano area, Basilicata, Italy')}</h2><p>{t("La mappa è stata realizzata per APT Basilicata nell'ambito del progetto Be.Cultour, finanziato dal Programma europeo Horizon2020 per la ricerca e l'innovazione", 'The map was created for APT Basilicata as part of the Be.Cultour project, funded by the European Horizon2020 program for research and innovation')}</p><img className="intro-vr-image" src={image('POP_UP/pop_up_ICONA2.png')} alt="" /><h3>{t('Realtà Virtuale', 'Virtual Reality')}</h3><div className="short-rule" aria-hidden="true" /><p>{t('Clicca e trascina per visitare le Città', 'Click and drag to visit the Cities')}</p><button type="button" autoFocus className="enter-button" onClick={closeIntro}>{t('ENTRA', 'ENTER')}</button><img className="intro-partners" src={image('POP_UP/pop_up_ICO.png')} alt="Partner del progetto Be.Cultour" /></div></dialog>}
  </div>;
}

export function VideoDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); previous?.focus(); };
  }, []);
  const valid = /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//.test(url);
  return <dialog ref={ref} className="video-dialog" aria-label="Video della località" onCancel={event => { event.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="video-dialog-content">{valid && <iframe title="YouTube video player" src={url} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}<button type="button" autoFocus className="dialog-close" onClick={onClose}>Chiudi</button></div></dialog>;
}

export function AudioPlayer({ url }: { url: string }) {
  return <div className="audio-player" aria-hidden="true"><audio key={url} src={url} controls autoPlay /></div>;
}

import {useEffect,useRef,useState} from 'react';
import {SceneEngine,assetUrl} from './SceneEngine';
import type {SceneAction} from './SceneEngine';
import './panorama.css';

export interface PanoramaProps {
  url:string;
  town?:string;
  site?:string;
  language:'it'|'en';
  onNavigate:(url:string,town?:string,site?:string)=>void;
  onAudio:(url:string)=>void;
  onVideo:()=>void;
  onHome:()=>void;
  onLoading?:(loading:boolean,progress:number)=>void;
}
export function Panorama(props:PanoramaProps){
  const container=useRef<HTMLDivElement>(null);
  const engine=useRef<SceneEngine|null>(null);
  const latest=useRef(props);latest.current=props;
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const english=props.language==='en';
  useEffect(()=>{
    if(!container.current)return;
    const action=(event:SceneAction)=>{
      const p=latest.current;
      if(event.type==='navigate')p.onNavigate(event.url,event.town??undefined,event.site??undefined);
      if(event.type==='audio')p.onAudio(assetUrl(`${event.prefix}${p.language==='en'?'AUDIO_SITI_INGLESE':'AUDIO_SITI'}${event.suffix}`));
      if(event.type==='video')p.onVideo();
    };
    try{engine.current=new SceneEngine(container.current,{onAction:action,onError:setError,onLoading:(loading,progress)=>latest.current.onLoading?.(loading,progress)});}
    catch{setError(latest.current.language==='it'?'La visualizzazione 3D non è disponibile in questo browser.':'3D viewing is unavailable in this browser.');}
    return()=>{engine.current?.dispose();engine.current=null;};
  },[retry]);
  // Apply a language change on the next navigation without replacing an open panorama.
  useEffect(()=>{void engine.current?.setScene({url:props.url,town:props.town,site:props.site,language:latest.current.language});},[props.url,props.town,props.site,retry]);
  return <div className="panorama-viewer">
    <div ref={container} className="panorama-canvas"/>
    <div className="panorama-zoom" aria-label={english?'Panorama controls':'Controlli panorama'}>
      <button type="button" aria-label={english?'Zoom in':'Aumenta zoom'} onClick={()=>engine.current?.zoom(1)}>+</button>
      <button type="button" aria-label={english?'Zoom out':'Riduci zoom'} onClick={()=>engine.current?.zoom(-1)}>−</button>
    </div>
    {error&&<div className="panorama-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)}>{english?'Retry':'Riprova'}</button><button type="button" onClick={props.onHome}>{english?'Return to map':'Torna alla mappa'}</button></div>}
  </div>;
}
export default Panorama;

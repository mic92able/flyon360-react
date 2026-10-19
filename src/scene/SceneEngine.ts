import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import rawHotspots from './hotspots.json';
import {assetUrl,getPanoramaUrl,resolveAssetPath} from '../data/catalog';
import assetPaths from '../data/asset-paths.json';
const knownAssets=new Set(assetPaths);
export {assetUrl} from '../data/catalog';

export type SceneAction = {type:'navigate';url:string;town?:string|null;site?:string|null}|{type:'audio';prefix:string;suffix:string}|{type:'video'};
export interface Hotspot {context:string;key:string;id:string;center?:number[];radius?:number;vertices?:number[];action:SceneAction}
export const hotspots = rawHotspots as Hotspot[];
export interface SceneSelection {url:string;town?:string;site?:string;language:'it'|'en'}
interface Callbacks {onAction:(action:SceneAction)=>void;onLoading:(loading:boolean,progress:number)=>void;onError:(message:string)=>void}

/** Owns the WebGL lifecycle; React owns navigation and media. */
export class SceneEngine {
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(45,1,1,1000);
  private renderer:THREE.WebGLRenderer;
  private controls:OrbitControls;
  private sphere:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;
  private raycaster=new THREE.Raycaster();
  private reticle=new THREE.Mesh(new THREE.SphereGeometry(10),new THREE.MeshBasicMaterial({color:0xffffff}));
  private quads:THREE.Mesh[]=[];
  private active:Hotspot[]=[];
  private abort?:AbortController;
  private disposed=false;
  private interactive=false;
  private generation=0;
  private observer:ResizeObserver;
  private button:HTMLElement;
  private start={x:0,y:0};
  private moved=false;
  private pointers=new Set<number>();
  private hover?:string;
  private hoverSince=0;
  private fired=false;
  private removeListeners:Array<()=>void>=[];
  private language:SceneSelection['language']='it';
  private touch=false;

  constructor(private container:HTMLElement,private callbacks:Callbacks) {
    this.renderer=new THREE.WebGLRenderer();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMappingExposure=2;
    this.renderer.xr.enabled=true;
    this.camera.position.set(0,0,400);
    this.scene.add(this.camera);
    this.reticle.material.depthTest=false;this.reticle.renderOrder=10;
    this.sphere=new THREE.Mesh(new THREE.SphereGeometry(500),new THREE.MeshBasicMaterial({side:THREE.BackSide,color:0xffffff}));
    // Authored panorama hotspot coordinates depend on this rotation.
    this.sphere.rotation.y=90;
    this.scene.add(this.sphere);
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Panorama interattivo a 360 gradi');
    this.renderer.domElement.style.touchAction='none';
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    const touch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
    this.touch=touch;
    this.controls.enableDamping=true;
    this.controls.rotateSpeed=touch?-0.7:-0.3;
    this.controls.enablePan=touch;
    this.controls.enableZoom=touch;
    if(touch)this.controls.maxDistance=400;
    this.button=VRButton.createButton(this.renderer);
    this.button.classList.add('scene-vr-button');
    const setVrUnsupported=(unsupported:boolean)=>{
      this.button.classList.toggle('scene-vr-unsupported',unsupported);
      this.button.hidden=unsupported;
      this.button.setAttribute('aria-hidden',String(unsupported));
      if(unsupported){this.button.style.setProperty('display','none','important');this.button.setAttribute('tabindex','-1');this.button.remove();}
      else{this.button.style.removeProperty('display');this.button.removeAttribute('tabindex');if(!this.button.isConnected)this.container.appendChild(this.button);}
    };
    const syncVrAvailability=()=>{
      const label=(this.button.textContent??'').trim().toUpperCase();
      if(label==='VR NOT SUPPORTED'||label==='VR NOT ALLOWED'||label==='WEBXR NOT AVAILABLE')setVrUnsupported(true);
      else if(label==='ENTER VR'||label==='EXIT VR')setVrUnsupported(false);
    };
    const buttonObserver=new MutationObserver(syncVrAvailability);
    buttonObserver.observe(this.button,{childList:true,characterData:true,subtree:true});
    this.removeListeners.push(()=>buttonObserver.disconnect());
    setVrUnsupported(true);
    syncVrAvailability();
    const listen=(type:string,fn:EventListener,options?:AddEventListenerOptions)=>{
      this.renderer.domElement.addEventListener(type,fn,options);
      this.removeListeners.push(()=>this.renderer.domElement.removeEventListener(type,fn,options));
    };
    listen('pointerdown',((event:PointerEvent)=>{this.pointers.add(event.pointerId); if(this.pointers.size===1){this.start={x:event.clientX,y:event.clientY};this.moved=false;}else this.moved=true;}) as EventListener);
    listen('pointermove',((event:PointerEvent)=>{if(this.pointers.size&&Math.hypot(event.clientX-this.start.x,event.clientY-this.start.y)>5)this.moved=true;if(this.interactive)this.container.style.cursor=this.pick(event.clientX,event.clientY)?'pointer':'grab';}) as EventListener);
    listen('pointerup',((event:PointerEvent)=>{this.pointers.delete(event.pointerId);if(!this.moved&&event.isPrimary){const hit=this.pick(event.clientX,event.clientY);if(hit)this.dispatch(hit.action);}}) as EventListener);
    listen('pointercancel',((event:PointerEvent)=>{this.pointers.delete(event.pointerId);this.moved=true;}) as EventListener);
    listen('wheel',((event:WheelEvent)=>{event.preventDefault();this.zoom(event.deltaY<0?1:-1);}) as EventListener,{passive:false});
    listen('webglcontextlost',((event:Event)=>{
      event.preventDefault();
      this.interactive=false;
      this.generation++;
      this.abort?.abort();
      this.pointers.clear();
      this.resetGaze();
      this.container.style.cursor='default';
      this.callbacks.onLoading(false,0);
      this.callbacks.onError(this.language==='it'?'La visualizzazione 3D si è interrotta. Riprova.':'The 3D viewer stopped. Please retry.');
    }) as EventListener);
    const sessionStart=()=>{this.scene.add(this.reticle);this.resetGaze();};
    const sessionEnd=()=>{this.scene.remove(this.reticle);this.resetGaze();};
    this.renderer.xr.addEventListener('sessionstart',sessionStart);
    this.renderer.xr.addEventListener('sessionend',sessionEnd);
    this.removeListeners.push(()=>{this.renderer.xr.removeEventListener('sessionstart',sessionStart);this.renderer.xr.removeEventListener('sessionend',sessionEnd);});
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    this.renderer.setAnimationLoop(()=>{
      if(this.disposed)return;
      if(this.renderer.xr.isPresenting){this.gaze();}else this.controls.update();
      this.renderer.render(this.scene,this.camera);
    });
  }
  zoom(direction:number){const step=this.touch?0.02:0.2;this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom+direction*step,1,2);this.camera.updateProjectionMatrix();}
  private resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
  private resetGaze(){this.hover=undefined;this.hoverSince=0;this.fired=false;}
  private dispatch(action:SceneAction){
    if(action.type==='navigate'){
      // Navigation updates React on the next render. Invalidate in-flight upgrades
      // immediately so a second click or a late texture cannot revive this scene.
      this.interactive=false;
      this.generation++;
      this.abort?.abort();
      this.pointers.clear();
      this.resetGaze();
      this.container.style.cursor='wait';
    }
    this.callbacks.onAction(action);
  }
  private pick(x?:number,y?:number):Hotspot|undefined {
    if(!this.interactive)return undefined;
    if(x!==undefined&&y!==undefined){const rect=this.renderer.domElement.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),this.camera);}
    const point=this.raycaster.intersectObject(this.sphere)[0]?.point;
    if(!point)return undefined;
    if(this.renderer.xr.isPresenting)this.reticle.position.copy(point);
    for(const h of this.active){if(h.center&&point.distanceTo(new THREE.Vector3(...h.center as [number,number,number]))<=h.radius!)return h;}
    const hits=this.raycaster.intersectObjects(this.quads);
    // Preserve authored action precedence rather than nearest quad order.
    return this.active.find(h=>h.vertices&&hits.some(hit=>hit.object.name===h.id));
  }
  private gaze(){
    const camera=this.renderer.xr.getCamera();
    this.raycaster.ray.origin.setFromMatrixPosition(camera.matrixWorld);
    this.raycaster.ray.direction.set(0,0,-1).transformDirection(camera.matrixWorld);
    const hit=this.pick();
    this.reticle.material.color.set(hit?0x3f51b5:0xffffff);
    if(hit?.id!==this.hover){this.hover=hit?.id;this.hoverSince=performance.now();this.fired=false;}
    if(hit&&!this.fired&&performance.now()-this.hoverSince>=3000){this.fired=true;this.dispatch(hit.action);}
  }
  async setScene(selection:SceneSelection){
    if(this.disposed)return;
    this.language=selection.language;
    const generation=++this.generation;this.interactive=false;this.container.style.cursor='wait';
    this.abort?.abort();this.abort=new AbortController();const signal=this.abort.signal;
    this.clearQuads();this.resetGaze();
    this.active=hotspots.filter(h=>h.context==='town'?h.key===selection.town:h.key===selection.site);
    for(const h of this.active){if(!h.vertices)continue;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(h.vertices,3));geometry.setIndex([0,1,2,0,2,3]);const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({transparent:true,opacity:0}));mesh.name=h.id;this.quads.push(mesh);this.scene.add(mesh);}
    const candidates=this.textureCandidates(selection);
    this.callbacks.onLoading(true,0);this.callbacks.onError('');
    let loaded=false;
    for(const candidate of candidates){
      try {
        const texture=await this.loadTexture(candidate,signal,p=>{if(generation===this.generation&&!loaded)this.callbacks.onLoading(true,p);});
        if(this.disposed||generation!==this.generation){texture.dispose();return;}
        const old=this.sphere.material.map;this.sphere.material.map=texture;this.sphere.material.needsUpdate=true;old?.dispose();loaded=true;this.interactive=true;this.container.style.cursor='grab';this.callbacks.onLoading(false,100);
      } catch(error){if(signal.aborted||this.disposed)return; /* Missing preview falls through to higher resolution. */}
    }
    if(!loaded&&generation===this.generation){this.container.style.cursor='default';this.callbacks.onLoading(false,0);this.callbacks.onError(selection.language==='it'?'Impossibile caricare il panorama. Riprova o scegli un’altra località.':'Unable to load this panorama. Retry or choose another location.');}
  }
  private textureCandidates(selection:SceneSelection):string[]{
    const fullUrl=getPanoramaUrl(selection.url,selection.language);
    if(/^(https?:|data:|blob:)/i.test(fullUrl))return [fullUrl];
    const fullPath=resolveAssetPath(fullUrl);
    const paths=[
      fullPath.replace(/(\.[^.]+)$/,'_resize75$1'),
      fullPath.replace(/(\.[^.]+)$/,'_resize50$1'),
      fullPath,
    ];
    const candidates=paths
      .map(path=>resolveAssetPath(path))
      .filter((path,index)=>index===paths.length-1||knownAssets.has(path))
      .map(assetUrl);
    return [...new Set(candidates)];
  }
  private async loadTexture(url:string,signal:AbortSignal,progress:(value:number)=>void){
    const response=await fetch(url,{signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const total=Number(response.headers.get('content-length'));let blob:Blob;
    if(response.body){const reader=response.body.getReader();const parts:Uint8Array<ArrayBuffer>[]=[];let received=0;while(true){const {done,value}=await reader.read();if(done)break;parts.push(new Uint8Array(value));received+=value.length;if(total)progress(Math.min(99,received/total*100));}blob=new Blob(parts);}else blob=await response.blob();
    const objectUrl=URL.createObjectURL(blob);
    try {const image=new Image();image.src=objectUrl;await image.decode();if(signal.aborted)throw new DOMException('Aborted','AbortError');const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;}finally{URL.revokeObjectURL(objectUrl);}
  }
  private clearQuads(){for(const mesh of this.quads){this.scene.remove(mesh);mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}this.quads=[];}
  dispose(){if(this.disposed)return;this.disposed=true;this.interactive=false;this.generation++;this.abort?.abort();this.pointers.clear();this.renderer.setAnimationLoop(null);this.observer.disconnect();this.removeListeners.forEach(remove=>remove());this.controls.dispose();this.clearQuads();this.active=[];this.sphere.material.map?.dispose();this.sphere.material.dispose();this.sphere.geometry.dispose();this.reticle.geometry.dispose();this.reticle.material.dispose();const session=this.renderer.xr.getSession();if(session)void session.end().catch(()=>{});this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.button.remove();this.container.style.cursor='';}
}

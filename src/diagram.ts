import type { Badge, Chapter, DiagramNode, DiagramScene, NodeKind, TextLines, Tier } from './types.js';

type RenderNode = DiagramNode & {
  clip: string;
  ready: boolean;
  visibleBadges: Badge[];
};

let serial=0;
const COLORS: Record<Tier, string>={l0:'#80b4ff',l1:'#68d5c8',l2:'#bbabff',external:'#e2b478',actor:'#bdc9da'};
const KINDS: Record<NodeKind, string>={resource:'Ресурс',operator:'Контроллер',cloud:'Облако',machines:'Узлы',app:'Приложение',endpoint:'Точка доступа',storage:'Хранилище',gate:'Условие',user:'Участник'};
const ICONS: Record<NodeKind, string>={
  resource:'<path d="M3 1.5h8l3 3V15H3zM11 1.5v4h3M6 8h5M6 11h5"/>',
  operator:'<path d="m8 1 6 3.5v7L8 15l-6-3.5v-7z"/><path d="M5 8a3 3 0 0 1 5-2M10 4v2H8M11 8a3 3 0 0 1-5 2M6 12v-2h2"/>',
  cloud:'<path d="M4 13a3.5 3.5 0 0 1-.7-6.9A5 5 0 0 1 12.7 5a4 4 0 0 1-.2 8z"/>',
  machines:'<rect x="2" y="1" width="12" height="5.5" rx="1.5"/><rect x="2" y="9" width="12" height="5.5" rx="1.5"/><path d="M5 3.7h.1M8 3.7h3M5 11.7h.1M8 11.7h3"/>',
  app:'<rect x="1.5" y="2" width="13" height="12" rx="2"/><path d="M1.5 5.5h13M4 3.8h.1M6 3.8h.1m-.6 4 2.5 2-2.5 2M9 12h3"/>',
  endpoint:'<path d="M6 2H2v12h4M10 2h4v12h-4M5 8h6M8 5l3 3-3 3"/>',
  storage:'<ellipse cx="8" cy="3" rx="6" ry="2"/><path d="M2 3v10c0 2.7 12 2.7 12 0V3M2 8c0 2.7 12 2.7 12 0"/>',
  gate:'<circle cx="8" cy="8" r="6.5"/><path d="m4.6 8.1 2.3 2.4 4.7-5"/>',
  user:'<circle cx="8" cy="4.2" r="2.8"/><path d="M2.5 14c.2-3.4 2.1-5 5.5-5s5.3 1.6 5.5 5"/>'
};
function esc(v: unknown): string{return String(v==null?'':v).replace(/[&<>"']/g,function(c){const entities: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};return entities[c] || c;});}
function number(v: unknown,fallback: number): number{return Number.isFinite(Number(v))?Number(v):fallback;}
function at(v: unknown): number{return Math.max(0,Math.floor(number(v,0)));}
function lines(v: TextLines | null | undefined): string[]{return v==null?[]:(Array.isArray(v)?v:[v]).map(function(s){return String(s);}).filter(function(s){return s.trim().length>0;});}
function tier(v: string): Tier{return Object.hasOwn(COLORS, v) ? v as Tier : 'external';}
function tint(base: string,color: string,amount: number): string{
  return '#'+[1,3,5].map(function(i){
    let a=parseInt(base.slice(i,i+2),16),b=parseInt(color.slice(i,i+2),16);
    return Math.round(a+(b-a)*amount).toString(16).padStart(2,'0');
  }).join('');
}
function widthOf(text: string,size: number,tracking = 0): number{
  let units=0;
  Array.from(String(text)).forEach(function(c){
    if(/\s/.test(c))units+=.31;
    else if(/[ilI1.,:;!'|]/.test(c))units+=.32;
    else if(/[MWЖШЩЮФ@%]/.test(c))units+=.91;
    else if(/[A-ZА-ЯЁ0-9]/.test(c))units+=.66;
    else units+=.58;
  });
  return units*size+Math.max(0,Array.from(String(text)).length-1)*(tracking||0);
}
function shorten(text: string,width: number,size: number,tracking = 0): string{
  text=String(text);
  if(widthOf(text,size,tracking)<=width)return text;
  let chars=Array.from(text);
  while(chars.length&&widthOf(chars.join('')+'…',size,tracking)>width)chars.pop();
  return chars.join('').trimEnd()+'…';
}
function wrap(value: TextLines | null | undefined,width: number,size: number,maxLines: number,tracking = 0): string[]{
  let result: string[]=[];
  lines(value).forEach(function(line){
    let words=line.trim().split(/\s+/),current='';
    words.forEach(function(word){
      let next=current?current+' '+word:word;
      if(current&&widthOf(next,size,tracking)>width){result.push(shorten(current,width,size,tracking));current=word;}
      else current=next;
    });
    if(current||!line)result.push(shorten(current,width,size,tracking));
  });
  if(result.length>maxLines){result=result.slice(0,maxLines);result[maxLines-1]=shorten(result[maxLines-1]+' …',width,size,tracking);}
  return result;
}
function style(): string{return '<style>'+
  '.nd-root{font-family:"Golos Text",Arial,sans-serif;font-weight:400;overflow:visible}'+
  '.nd-root text{user-select:none;pointer-events:none}.nd-node{cursor:pointer;outline:none}'+
  '.nd-node .nd-outline{transition:stroke-width .16s,stroke-opacity .16s}.nd-node:hover .nd-outline,.nd-node:focus .nd-outline{stroke-width:2.2;stroke-opacity:1}'+
  '.nd-node:focus-visible .nd-outline{stroke-dasharray:5 3}.nd-reveal{animation:nd-enter .64s cubic-bezier(.2,.7,.3,1) both}.nd-edge-reveal{animation:nd-edge .7s ease-out both}.nd-edge-pulse{pointer-events:none}'+
  '@keyframes nd-enter{from{opacity:0}to{opacity:1}}@keyframes nd-edge{from{opacity:0}to{opacity:1}}'+
  '@media(prefers-reduced-motion:reduce){.nd-root *{animation:none!important;transition:none!important}.nd-root .nd-edge-pulse{display:none!important}}'+
  '</style>';}
function border(kind: NodeKind,w: number,h: number,color: string,active: boolean): string{
  let fill=active?tint('#111e2f',color,.13):'#111e2f';
  let attrs=' class="nd-outline" fill="'+fill+'" stroke="'+color+'" stroke-opacity="'+(active?'.85':'.3')+'" stroke-width="'+(active?'1.6':'1.1')+'"';
  let shape='';
  if(kind==='resource'){
    shape='<path d="M9 1H'+(w-20)+'L'+(w-1)+' 20V'+(h-9)+'Q'+(w-1)+' '+(h-1)+' '+(w-9)+' '+(h-1)+'H9Q1 '+(h-1)+' 1 '+(h-9)+'V9Q1 1 9 1Z"'+attrs+'/>'+
      '<path d="M'+(w-20)+' 1V20H'+(w-1)+'" fill="none" stroke="'+color+'" stroke-opacity=".48"/>';
  }else if(kind==='machines'){
    shape='<rect x="8" y="1" width="'+(w-9)+'" height="'+(h-9)+'" rx="4" fill="#0d1726" stroke="'+color+'" stroke-opacity=".22"/>'+
      '<rect x="4" y="4" width="'+(w-9)+'" height="'+(h-9)+'" rx="4" fill="#101b2b" stroke="'+color+'" stroke-opacity=".32"/>'+
      '<rect x="1" y="7" width="'+(w-9)+'" height="'+(h-8)+'" rx="4"'+attrs+'/>';
  }else if(kind==='endpoint'){
    shape='<rect x="1" y="1" width="'+(w-2)+'" height="'+(h-2)+'" rx="6"'+attrs+' stroke-dasharray="5 5"/>';
  }else if(kind==='gate'){
    shape='<path d="M14 1H'+(w-14)+'L'+(w-1)+' '+(h/2)+' '+(w-14)+' '+(h-1)+'H14L1 '+(h/2)+'Z"'+attrs+'/>';
  }else if(kind==='storage'){
    // Cylinder rims stay in the outer eight pixels, outside every text row.
    shape='<path d="M1 5Q'+(w/2)+' -3 '+(w-1)+' 5V'+(h-5)+'Q'+(w/2)+' '+(h+3)+' 1 '+(h-5)+'Z"'+attrs+'/>'+
      '<path d="M1 5Q'+(w/2)+' 11 '+(w-1)+' 5M1 '+(h-5)+'Q'+(w/2)+' '+(h-11)+' '+(w-1)+' '+(h-5)+'" fill="none" stroke="'+color+'" stroke-opacity=".23"/>';
  }else{
    let radius=kind==='app'?4:6;
    shape='<rect x="1" y="1" width="'+(w-2)+'" height="'+(h-2)+'" rx="'+radius+'"'+attrs+'/>';
    if(kind==='app')shape+='<rect x="5" y="36" width="2" height="'+Math.max(5,h-48)+'" rx="1" fill="'+color+'" fill-opacity=".35"/>';
    if(kind==='operator')shape+='<path d="M5 28V'+(h-12)+'" stroke="'+color+'" stroke-opacity=".3" stroke-width="2"/>';
  }
  return shape;
}

export function render(chapter: DiagramScene,step: number): string{
  step=at(step);let uid='narrative-'+(++serial);
  let rawNodes=Array.isArray(chapter.nodes)?chapter.nodes:[],zoneList=Array.isArray(chapter.zones)?chapter.zones:[],edgeList=Array.isArray(chapter.edges)?chapter.edges:[];
  let beat=Array.isArray(chapter.beats)?chapter.beats[step]:null;
  let active=new Set(beat&&Array.isArray(beat.active)?beat.active.map(String):[]);
  let nodes=rawNodes.filter(function(n){return n&&at(n.at)<=step;}).map(function(n,index){
    const view: RenderNode={...n,clip:uid+'-clip-'+index,ready:false,visibleBadges:[]};
    (Array.isArray(n.variants)?n.variants:[]).filter(function(v){return at(v.at)<=step;}).slice().sort(function(a,b){return at(a.at)-at(b.at);}).forEach(function(v){if(v.title!==undefined)view.title=v.title;if(v.sub!==undefined)view.sub=v.sub;});
    view.id=String(n.id==null?'node-'+index:n.id);view.x=number(n.x,0);view.y=number(n.y,0);view.w=Math.max(32,number(n.w,190));view.h=Math.max(32,number(n.h,94));
    view.tier=tier(n.tier);view.kind=ICONS[n.kind]?n.kind:'resource';view.clip=uid+'-clip-'+index;
    view.ready=typeof n.readyAt==='number'&&Number.isFinite(n.readyAt)&&step>=n.readyAt;
    view.visibleBadges=(Array.isArray(n.badges)?n.badges:[]).filter(function(b){return b&&at(b.at)<=step;});
    return view;
  });
  // Bounds include future nodes so each chapter keeps a stable frame.
  let frameItems=[...rawNodes,...zoneList].filter(Boolean);
  let frameLeft=frameItems.length?Math.min.apply(null,frameItems.map(function(n){return number(n.x,0);})):16;
  let frameRight=frameItems.length?Math.max.apply(null,frameItems.map(function(n){return number(n.x,0)+number(n.w,0);})):1184;
  let frameWidth=Math.max(1,frameRight-frameLeft),frameHeight=frameWidth*420/1168;
  let map=new Map(nodes.map(function(n){return [n.id,n];}));
  let defs='<defs><marker id="'+uid+'-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1 8.5 5 1 9" fill="none" stroke="#8093ab" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></marker>';
  nodes.forEach(function(n){defs+='<clipPath id="'+n.clip+'"><rect x=".5" y=".5" width="'+(n.w-1)+'" height="'+(n.h-1)+'" rx="5"/></clipPath>';});
  defs+='</defs>';
  let out='<svg xmlns="http://www.w3.org/2000/svg" class="nd-root" viewBox="'+frameLeft+' 0 '+frameWidth+' '+frameHeight+'" width="100%" height="100%" role="group" aria-labelledby="'+uid+'-title" data-step="'+step+'"><title id="'+uid+'-title">'+esc(chapter.label||chapter.title||'Схема создания платформы')+'</title>'+defs+style();
  zoneList.filter(function(z){return z&&at(z.at)<=step;}).forEach(function(z){
    let x=number(z.x,0),y=number(z.y,0),w=Math.max(1,number(z.w,100)),h=Math.max(1,number(z.h,100)),col=COLORS[tier(z.tier)];
    out+='<g data-zoneid="'+esc(z.id||'')+'"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="8" fill="'+tint('#0d1726',col,.035)+'" stroke="'+col+'" stroke-opacity=".2" stroke-width="1"'+(z.tier==='external'?' stroke-dasharray="5 5"':'')+'/>'+
      '<rect x="'+(x+8)+'" y="'+(y+11)+'" width="2" height="14" rx="1" fill="'+col+'" fill-opacity=".85"/>'+
      '<path d="M'+(x+17)+' '+(y+33)+'H'+(x+w-17)+'" stroke="'+col+'" stroke-opacity=".12"/>'+
      '<text x="'+(x+18)+'" y="'+(y+22)+'" fill="'+col+'" font-size="11" font-weight="500" letter-spacing="1.05">'+esc(shorten(z.label||String(z.id||'').toUpperCase(),Math.max(10,w-36),11))+'</text></g>';
  });
  let edgeLabels='';
  edgeList.filter(function(e){return e&&at(e.at)<=step&&map.has(String(e.from))&&map.has(String(e.to))&&typeof e.path==='string';}).forEach(function(e){
    let k=e.kind||'command',hot=active.has(String(e.from))||active.has(String(e.to));
    const source=map.get(String(e.from));
    if (!source) return;
    let sourceColor=COLORS[source.tier];
    let eventEdge=at(e.at)===step&&(k==='command'||k==='status');
    out+='<g'+(eventEdge?' class="nd-edge-reveal"':'')+'><path d="'+esc(e.path)+'" fill="none" stroke="'+(hot?sourceColor:'#8093ab')+'" stroke-opacity="'+(hot?'.95':'.8')+'" stroke-width="'+(e.emphasis?'2.5':k==='link'?'1':'1.55')+'" stroke-linecap="round" stroke-linejoin="round"'+(k==='status'?' stroke-dasharray="6 5"':'')+(k!=='link'?' marker-end="url(#'+uid+'-arrow)"':'')+'/></g>';
    if(eventEdge){
      out+='<g class="nd-edge-pulse" opacity="0" aria-hidden="true"><circle r="2.8" fill="'+sourceColor+'"/>'+
        '<animateMotion path="'+esc(e.path)+'" dur=".82s" begin="0s" repeatCount="1" calcMode="paced" fill="freeze"/>'+
        '<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.78;1" dur=".82s" begin="0s" repeatCount="1" fill="freeze"/></g>';
    }
    if(e.label){let label=shorten(e.label,340,12),w=widthOf(label,12)+18,h=24,x=Math.max(5,Math.min(1195-w,number(e.lx,600)-w/2)),y=Math.max(4,Math.min(392,number(e.ly,210)-h/2));
      edgeLabels+='<g'+(eventEdge?' class="nd-edge-reveal"':'')+'><title>'+esc(e.label)+'</title><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="4" fill="#0d1726" stroke="#34465c" stroke-opacity=".5"/><text x="'+(x+w/2)+'" y="'+(y+16)+'" text-anchor="middle" font-size="12" fill="#b6c4d6">'+esc(label)+'</text></g>';
    }
  });
  out+=edgeLabels;
  nodes.forEach(function(n){
    let col=COLORS[n.tier],isActive=active.has(n.id),badges=n.visibleBadges;
    let pad=16,mainSize=n.w>=205?22:n.w>=180?21:20,textWidth=Math.max(10,n.w-pad*2-(n.kind==='machines'?7:0));
    let lineHeight=28,titleBaseline=44,usableBottom=n.h-(badges.length?32:12);
    let titleLines=wrap(n.title,textWidth,mainSize,3,-.45),subLines=wrap(n.sub,textWidth,15,3);
    let lastTitle=titleBaseline+Math.max(0,titleLines.length-1)*lineHeight;
    let subBaseline=n.phase?68:lastTitle+24;
    let subMax=Math.max(0,Math.min(3,Math.floor((usableBottom-subBaseline)/18)+1));
    let overflow=lastTitle>usableBottom||subLines.length>subMax;
    if(subLines.length>subMax)subLines=subMax?wrap(n.sub,textWidth,15,subMax):[];
    let full=lines(n.title).concat(lines(n.sub)).concat(badges.map(function(b){return String(b.label||'');})).join('. ')+(n.ready?'. Готово':'');
    out+='<g class="nd-node" data-nodeid="'+esc(n.id)+'" data-title-baseline="'+titleBaseline+'"'+(overflow?' data-layout-overflow="true"':'')+' tabindex="0" role="button" aria-label="'+esc(full)+'" transform="translate('+n.x+' '+n.y+')"><title>'+esc(full)+'</title><g'+(at(n.at)===step?' class="nd-reveal"':'')+'>';
    out+='<g clip-path="url(#'+n.clip+')">'+border(n.kind,n.w,n.h,col,isActive);
    let nodeIcon=n.kind==='gate'&&!n.ready?'<circle cx="8" cy="8" r="6.5"/><path d="M4.5 8h7"/>':ICONS[n.kind];
    let kindLabel=KINDS[n.kind];
    let metaX=38,headerRight=n.w-pad-(n.kind==='resource'?8:0),readyX=headerRight-12;
    if(n.phase){
      out+='<g class="nd-phase"><text x="16" y="20" font-size="9.5" font-weight="500" letter-spacing="1" fill="'+col+'">ФАЗА '+esc(n.phase)+'</text></g>';
    }else{
      out+='<g transform="translate('+pad+' 8) scale(.875)" fill="none" stroke="'+col+'" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">'+nodeIcon+'</g>';
      out+='<text class="nd-metadata" x="'+metaX+'" y="20" font-size="9.5" font-weight="400" letter-spacing=".1" fill="'+col+'">'+esc(kindLabel)+'</text>';
    }
    if(n.ready){out+='<g class="nd-ready" role="img" aria-label="Готово"><title>Готово</title><path d="M'+readyX+' 15.5l3.5 3.5 7-8" fill="none" stroke="'+col+'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>';}
    titleLines.forEach(function(t,i){out+='<text class="nd-title" x="'+pad+'" y="'+(titleBaseline+i*lineHeight)+'" fill="'+(isActive?tint('#eaf1fb',col,.22):'#eaf1fb')+'" font-size="'+mainSize+'" font-weight="550" letter-spacing="-.45">'+esc(t)+'</text>';});
    subLines.forEach(function(t,i){out+='<text class="nd-subtitle" x="'+pad+'" y="'+(subBaseline+i*18)+'" fill="#b6c4d6" font-size="15" font-weight="400">'+esc(t)+'</text>';});
    let bx=pad,by=n.h-24,maxRight=n.w-pad;
    badges.forEach(function(b,i){
      if(bx>=maxRight-20)return;
      let remaining=badges.length-i,budget=maxRight-bx,label=shorten(b.label||'',Math.max(10,budget-12),10.5),bw=widthOf(label,10.5)+12;
      if(i&&bw+bx>maxRight){label='+'+remaining;bw=widthOf(label,10.5)+12;}
      if(bw+bx>maxRight)return;
      out+='<g><text x="'+bx+'" y="'+(by+11.5)+'" fill="'+col+'" font-size="10.5" font-weight="400">'+esc(label)+'</text></g>';bx+=bw+5;
    });
    out+='</g></g></g>';
  });
  return out+'</svg>';
}

export function renderAtlas(chapters: Chapter[]): string{
  chapters=Array.isArray(chapters)?chapters:[];let uid='narrative-atlas-'+(++serial),rows=Math.max(1,Math.ceil(chapters.length/3)),height=rows*126+20;
  let out='<svg xmlns="http://www.w3.org/2000/svg" class="nd-root" viewBox="0 0 1200 '+height+'" width="100%" role="group" aria-labelledby="'+uid+'"><title id="'+uid+'">Карта глав</title>'+style();
  chapters.forEach(function(ch,i){
    let x=22+(i%3)*398,y=12+Math.floor(i/3)*126,title=String(ch.nav||ch.label||ch.title||'Глава '+(i+1)).replace(/<[^>]*>/g,' ');
    const tiers: Tier[]=[];
    (ch.zones||[]).forEach(function(z){let t=tier(z.tier);if(tiers.indexOf(t)===-1)tiers.push(t);});
    out+='<g class="nd-node" data-chapter-index="'+i+'" tabindex="0" role="button" aria-label="'+esc(title)+'"><rect class="nd-outline" x="'+x+'" y="'+y+'" width="374" height="104" rx="6" fill="#111e2f" stroke="#34465c"/><text x="'+(x+16)+'" y="'+(y+26)+'" fill="#8395ad" font-size="11" letter-spacing="1">'+String(i+1).padStart(2,'0')+'</text><text x="'+(x+16)+'" y="'+(y+58)+'" fill="#eaf1fb" font-size="20" font-weight="550">'+esc(shorten(title,340,20))+'</text>';
    tiers.forEach(function(t,j){out+='<text x="'+(x+16+j*58)+'" y="'+(y+84)+'" fill="'+COLORS[t]+'" font-size="11" font-weight="400">'+(t==='external'?'EXT':t.toUpperCase())+'</text>';});
    out+='</g>';
  });
  return out+'</svg>';
}
export { renderAtlas as map };

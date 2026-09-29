import { createFlightMap } from './flight-engine';
import type { FlightContent } from './flight-engine';

export function mountFlight(content: FlightContent): void {
 const {scenes,stations}=content;
 const last=scenes.length-1;
 function $(id: 'previous'): HTMLButtonElement;
 function $(id: 'about-dialog'): HTMLDialogElement;
 function $(id: 'universe'): HTMLCanvasElement;
 function $(id: string): HTMLElement;
 function $(id: string): HTMLElement {
  const element=document.getElementById(id);
  if(!(element instanceof HTMLElement))throw new Error('Missing flight element: '+id);
  if(id==='previous'&&!(element instanceof HTMLButtonElement))throw new Error('Missing previous button');
  if(id==='about-dialog'&&!(element instanceof HTMLDialogElement))throw new Error('Missing about dialog');
  if(id==='universe'&&!(element instanceof HTMLCanvasElement))throw new Error('Missing flight canvas');
  return element;
 }
 const story=document.querySelector<HTMLElement>('.story');
 if(!story)throw new Error('Missing flight story');
 const storyElement=story;
 const entities: Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
 const esc=(s:string|number)=>String(s).replace(/[&<>"']/g,c=>entities[c]);
 let current=-1,auto=false,flightTimer=0,toastTimer=0;
 const map=createFlightMap($('universe'),content,{onSelect:index=>go(index),onMotion:()=>{pause();$('map-hint').textContent='Свободный ракурс · выберите главу или верните ракурс';}});
 function updateAuto(){
  $('autoplay').setAttribute('aria-pressed',String(auto));
  $('autoplay-label').textContent=auto?'Пауза':'Автополёт';
  $('autoplay').querySelector<HTMLElement>('.play-icon')!.textContent=auto?'Ⅱ':'▷';
  $('flight-state').textContent=auto?'АВТОПОЛЁТ · 18 СЕК / ШАГ':current<0?'ОБЗОР МАРШРУТА':'ГЛАВА '+(scenes[current].chapter+1)+' · ШАГ '+(scenes[current].step+1);
 }
 function pause(){auto=false;clearTimeout(flightTimer);updateAuto();}
 function schedule(){clearTimeout(flightTimer);if(!auto)return;flightTimer=window.setTimeout(()=>{if(current>=last){pause();return;}go(current+1,{keepAuto:true});schedule();},18000);}
 function toggleAuto(){if(auto){pause();return;}auto=true;if(current<0||current===last)go(0,{keepAuto:true});updateAuto();schedule();}
 function render(){
  const overview=current<0,s=scenes[Math.max(0,current)];
  const station=stations[s.chapter];
  storyElement.classList.remove('arrive');
  $('story-index').textContent=overview?'ЭКСПЕДИЦИЯ / L0 — L2':s.eyebrow;
  $('story-title').innerHTML=overview?'Одна заявка.<br><span>Целая платформа.</span>':esc(s.title);
  $('story-summary').textContent=overview?'Маршрут через три уровня Kubernetes. Проследите, как операторы создают инфраструктуру, готовят доступы и запускают клиентский кластер.':s.summary;
  $('facts').innerHTML=overview?'<div class="intro-layer"><b>L0</b><span>Управление и оркестрация</span></div><div class="intro-layer"><b>L1</b><span>Инфраструктура и Control plane L2</span></div><div class="intro-layer"><b>L2</b><span>Клиентский Kubernetes</span></div>':s.facts.map(f=>'<details class="fact" name="flight-facts"><summary>'+esc(f.label)+'</summary><p>'+esc(f.body)+'</p></details>').join('');
  $('next').innerHTML=(overview?'Начать полёт':current===last?'Весь маршрут':'Следующий шаг')+' <span aria-hidden="true">'+(current===last?'↗':'→')+'</span>';
  $('previous').disabled=overview;
  $('takeaway').textContent=overview?stations.length+' глав · '+scenes.length+' шагов · одна готовая платформа.':s.takeaway;
  $('takeaway').classList.remove('with-parallel');
  $('flight-count').textContent=overview?stations.length+' ГЛАВ / '+scenes.length+' ШАГОВ':String(current+1).padStart(2,'0')+' / '+scenes.length;
  $('map-hint').textContent='Вращайте карту мышью · колесо — масштаб';
  document.querySelectorAll('.stop').forEach((el,i)=>{el.classList.toggle('done',!overview&&i<s.chapter);if(!overview&&i===s.chapter)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  $('step-route').innerHTML=overview?'':Array.from({length:station.count},(_,i)=>'<button data-step="'+(station.start+i)+'" aria-label="Шаг '+(i+1)+': '+esc(scenes[station.start+i].title)+'"'+(i===s.step?' aria-current="step"':'')+'>'+(i+1)+'</button>').join('');
  $('step-route').setAttribute('aria-label',overview?'Шаги главы':'Шаги главы '+(s.chapter+1));
  $('notes-title').textContent=overview?'От заявки до готовой платформы':s.title;
  $('notes-time').textContent=overview?'10–15 МИНУТ · '+stations.length+' ГЛАВ':'ГЛАВА '+(s.chapter+1)+' · ШАГ '+(s.step+1)+' / '+station.count;
  $('notes-body').textContent=overview?'Каждая глава — область космической карты. Внутри неё ресурсы и связи появляются по шагам. Направление стрелки и движущихся импульсов совпадает с направлением действия или статуса. Нижняя панель переключает главы, малые кнопки — шаги внутри главы.':s.note;
  updateAuto();document.title=(overview?'Platform Odyssey':s.title+' · Platform Odyssey')+' · Beget';
  document.body.dataset.chapter=overview?'overview':String(s.chapter+1);
  document.body.dataset.step=overview?'0':String(s.step+1);
  void storyElement.offsetWidth;storyElement.classList.add('arrive');
 }
 function go(index:number,options:{keepAuto?:boolean;immediate?:boolean;fromHash?:boolean}={}){
  if(!options.keepAuto)pause();current=Math.max(-1,Math.min(last,index));
  if(current<0)map.overview({immediate:!!options.immediate});else map.setScene(current,{immediate:!!options.immediate});
  if(!options.fromHash){const s=scenes[current];history.replaceState(null,'',current<0?'#overview':'#chapter-'+(s.chapter+1)+'-step-'+(s.step+1));}render();
 }
 function next(){go(current<0?0:current===last?-1:current+1);}
 function back(){go(current<=0?-1:current-1);}
 function notes(){const shown=$('notes-panel').hidden;if(shown)pause();$('notes-panel').hidden=!shown;$('notes').setAttribute('aria-expanded',String(shown));}
 function toast(s:string){clearTimeout(toastTimer);$('toast').textContent=s;$('toast').hidden=false;toastTimer=window.setTimeout(()=>{$('toast').hidden=true;},4000);}
 $('route').innerHTML=stations.map((station,i)=>'<button class="stop" data-stop="'+station.start+'" aria-label="Глава '+(i+1)+': '+esc(station.title)+'"><span class="stop-dot" aria-hidden="true"></span><span class="stop-num">'+String(i+1).padStart(2,'0')+'</span><span class="stop-label">'+esc(station.name)+'</span></button>').join('');
 $('route').style.setProperty('--stations',String(stations.length));
 $('route').addEventListener('click',e=>{const n=e.target instanceof Element?e.target.closest<HTMLElement>('[data-stop]'):null;if(n)go(Number(n.dataset.stop));});
 $('step-route').addEventListener('click',e=>{const n=e.target instanceof Element?e.target.closest<HTMLElement>('[data-step]'):null;if(n)go(Number(n.dataset.step));});
 $('facts').addEventListener('toggle',e=>{if(e.target instanceof HTMLDetailsElement&&e.target.open)pause();},true);
 $('next').addEventListener('click',next);$('previous').addEventListener('click',back);$('overview').addEventListener('click',()=>go(-1));$('autoplay').addEventListener('click',toggleAuto);
 $('recenter').addEventListener('click',()=>{if(current<0)map.overview();else map.setScene(current);$('map-hint').textContent='Вращайте карту мышью · колесо — масштаб';});
 $('notes').addEventListener('click',notes);$('close-notes').addEventListener('click',notes);
 $('about').addEventListener('click',()=>{pause();$('about-dialog').showModal();});$('close-about').addEventListener('click',()=>$('about-dialog').close());
 $('about-dialog').addEventListener('click',e=>{if(e.target instanceof HTMLDialogElement&&e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Откройте HTML в отдельном браузере и нажмите F11.');}});
 document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||$('about-dialog').open||(e.target instanceof Element&&e.target.closest('input,textarea,select')))return;
  if(e.key==='Escape'){pause();if(!$('notes-panel').hidden)notes();return;}
  if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();next();}
  else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();back();}
  else if(e.key===' '&&!(e.target instanceof Element&&e.target.closest('button,a,summary'))){e.preventDefault();toggleAuto();}
  else if(/^[1-7]$/.test(e.key))go(stations[Number(e.key)-1].start);
  else if(e.key==='Home'||['m','ь'].includes(e.key.toLowerCase()))go(-1);
  else if(e.key==='End')go(last);
  else if(['n','т'].includes(e.key.toLowerCase()))notes();
  else if(['f','а'].includes(e.key.toLowerCase()))$('fullscreen').click();
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 function readHash(){
  const chapter=location.hash.match(/^#chapter-(\d+)-step-(\d+)$/);
  if(chapter){const station=stations[Number(chapter[1])-1],step=Number(chapter[2])-1;return station&&step>=0&&step<station.count?station.start+step:-1;}
  const legacy=location.hash.match(/^#stop-(\d+)$/);return legacy?Math.min(last,Number(legacy[1])-1):-1;
 }
 window.addEventListener('hashchange',()=>go(readHash(),{fromHash:true}));
 go(readHash(),{immediate:true,fromHash:true});
}

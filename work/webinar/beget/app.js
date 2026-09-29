(() => {
 'use strict';
 const chapters=window.NarrativeContent.chapters,renderer=window.NarrativeDiagram;
 const names=['Заказ и зависимости','Создание L1','L1 и Vault','Заказ L2','Устройство L2','Готовый L2','Приложения'];
 const $=id=>document.getElementById(id);
 let frameAlignment=0;
 function alignFrame(){
  if(frameAlignment)cancelAnimationFrame(frameAlignment);
  frameAlignment=requestAnimationFrame(()=>{
   frameAlignment=0;
   const rect=$('diagram').getBoundingClientRect();
   const width=Math.min(rect.width,rect.height*1168/420);
   document.querySelector('.presentation').style.setProperty('--content-width',width+'px');
  });
 }

 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const formatExplanation=s=>String(s).split(/(ClusterClaim Operator|Control plane L2|ClusterClaim|Cluster API|Cluster L[12]|AddonOperator|AddonClaim|Applications|Argo CD|Vault)/g).map((part,i)=>i%2?'<span class="technical-name">'+esc(part)+'</span>':esc(part)).join('');
 const offsets=chapters.map((c,i)=>chapters.slice(0,i).reduce((n,v)=>n+v.beats.length,0));
 const total=chapters.reduce((n,c)=>n+c.beats.length,0);
 const eventWord=total%100>=11&&total%100<=14?'СОБЫТИЙ':total%10===1?'СОБЫТИЕ':total%10>=2&&total%10<=4?'СОБЫТИЯ':'СОБЫТИЙ';
 let chapter=-1,step=0,toastTimer;
 const intro={title:'Три уровня одной платформы',zones:[{id:'intro-l0',x:20,y:55,w:355,h:310,label:'L0',tier:'l0'},{id:'intro-l1',x:424,y:55,w:355,h:310,label:'L1',tier:'l1'},{id:'intro-l2',x:827,y:55,w:353,h:310,label:'L2',tier:'l2'}],nodes:[{id:'intro-management',at:0,x:54,y:132,w:287,h:159,title:'Принимает заказ',sub:['Операторы и Cluster API','управляют созданием'],kind:'operator',tier:'l0'},{id:'intro-infra',at:0,x:457,y:132,w:287,h:159,title:'Строит инфраструктуру',sub:['Узлы L1 и','Control plane L2'],kind:'machines',tier:'l1'},{id:'intro-client',at:0,x:860,y:132,w:287,h:159,title:'Предоставляет L2',sub:['API L2 и','пользовательские приложения'],kind:'endpoint',tier:'l2'}],edges:[{from:'intro-management',to:'intro-infra',at:0,path:'M341 212H457',label:'создаёт',lx:398,ly:191,kind:'command'},{from:'intro-infra',to:'intro-client',at:0,path:'M744 212H860',label:'обслуживает',lx:803,ly:191,kind:'link'}],beats:[{active:[]}]};
 function render(fly){
  const opening=chapter<0,c=opening?null:chapters[chapter],b=c&&c.beats[step];
  $('chapter-label').textContent=opening?'ИСТОРИЯ ОДНОГО ЗАКАЗА':String(chapter+1).padStart(2,'0')+' / '+c.kicker;
  $('event-position').textContent=opening?'L0 → L1 → L2':'СОБЫТИЕ '+String(offsets[chapter]+step+1).padStart(2,'0')+' / '+total;
  $('headline').textContent=opening?'Что происходит после «Создать кластер»?':b.title;
  $('explanation').innerHTML=formatExplanation(opening?'Одна заявка запускает создание целой платформы. Проследим, кто действует, что появляется и почему разрешён следующий шаг.':b.summary);
  $('context-line').textContent=opening?'ТРИ УРОВНЯ ОДНОЙ ПЛАТФОРМЫ':chapter===2?'ВЕТКИ ИДУТ ОДНОВРЕМЕННО · МЕНЯЕТСЯ ТОЛЬКО ФОКУС РАССКАЗА':c.question;
  document.querySelector('.scene-context').classList.toggle('parallel',chapter===2);
  $('diagram').innerHTML=renderer.render(opening?intro:c,opening?0:step);
  alignFrame();
  $('result-caption').textContent=opening?'ГЛАВНЫЙ ВОПРОС':'ЧТО ИЗМЕНИЛОСЬ';
  $('result-text').textContent=opening?'Как из конфигурации получить Kubernetes, готовый для приложений пользователя?':b.result;
  let nextTitle='Начать историю';
  if(!opening){if(step<c.beats.length-1)nextTitle=c.beats[step+1].title;else if(chapter<chapters.length-1)nextTitle=chapters[chapter+1].beats[0].title;else nextTitle='В начало';}
  $('next').innerHTML=esc(nextTitle)+' <span aria-hidden="true">'+(chapter===chapters.length-1&&step===c.beats.length-1?'↺':'→')+'</span>';
  $('next').setAttribute('aria-label',opening?'Начать историю':'Далее: '+nextTitle);
  $('back').disabled=opening;
  document.querySelectorAll('.chapter').forEach((el,i)=>{if(i===chapter)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  $('beat-nav').innerHTML=opening?'':c.beats.map((v,i)=>'<button class="beat-dot" data-beat="'+i+'" aria-label="Событие '+(offsets[chapter]+i+1)+': '+esc(v.title)+'" '+(i===step?'aria-current="step"':'')+' title="'+esc(v.title)+'"></button>').join('');
  $('story-count').textContent=opening?chapters.length+' ГЛАВ · '+total+' '+eventWord:(step+1)+' / '+c.beats.length+' В ЭТОЙ ГЛАВЕ';
  document.title=(opening?'Путь кластера':b.title)+' · Beget';
  if(fly)skyTravel(chapter+1);
 }
 function go(index,beat=0,opts={}){const previous=chapter;chapter=Math.max(-1,Math.min(chapters.length-1,index));step=chapter<0?0:Math.max(0,Math.min(chapters[chapter].beats.length-1,beat));if(!opts.fromHash)history.replaceState(null,'',chapter<0?'#intro':'#chapter-'+(chapter+1)+'-step-'+(step+1));render(previous!==chapter&&!opts.immediate);}
 function next(){if(chapter<0)go(0);else if(step<chapters[chapter].beats.length-1)go(chapter,step+1);else if(chapter<chapters.length-1)go(chapter+1);else go(-1);}
 function back(){if(chapter<0)return;if(step>0)go(chapter,step-1);else if(chapter>0)go(chapter-1,chapters[chapter-1].beats.length-1);else go(-1);}
 function openDialog(kicker,title,body,wide=false){$('dialog').classList.toggle('wide',wide);$('dialog-kicker').textContent=kicker;$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;if(!$('dialog').open)$('dialog').showModal();}
 function inspect(id){const c=chapter<0?intro:chapters[chapter];let n=c.nodes.find(v=>v.id===id);if(!n)return;n={...n};(n.variants||[]).filter(v=>v.at<=step).forEach(v=>{n={...n,...v};});const arr=v=>Array.isArray(v)?v:[v];const types={resource:'Ресурс Kubernetes',operator:'Контроллер',cloud:'Облачный сервис',machines:'Машины и узлы',app:'Приложение',endpoint:'Точка доступа API',storage:'Хранилище',gate:'Условие перехода',user:'Пользователь'};openDialog((n.tier==='actor'?'Участник процесса':(n.tier==='external'?'Внешний сервис':n.tier.toUpperCase())+' · '+(n.detailKind||types[n.kind])),arr(n.title).join(' '),'<p>'+(n.detail?esc(n.detail):arr(n.sub||'').map(esc).join('<br>'))+'</p>'+((n.badges||[]).filter(v=>v.at<=step).map(v=>'<p>'+esc(v.label)+'</p>').join('')));}
 $('chapters').innerHTML=names.map((s,i)=>'<button class="chapter" data-chapter="'+i+'" aria-label="Глава '+(i+1)+': '+esc(s)+'"><span class="chapter-number">'+String(i+1).padStart(2,'0')+'</span>'+esc(s)+'</button>').join('');
 $('chapters').addEventListener('click',e=>{const el=e.target.closest('[data-chapter]');if(el)go(Number(el.dataset.chapter));});
 $('beat-nav').addEventListener('click',e=>{const el=e.target.closest('[data-beat]');if(el)go(chapter,Number(el.dataset.beat));});
 $('next').addEventListener('click',next);$('back').addEventListener('click',back);$('close-dialog').addEventListener('click',()=>$('dialog').close());
 $('diagram').addEventListener('click',e=>{const n=e.target.closest('[data-nodeid]');if(n)inspect(n.dataset.nodeid);});
 $('diagram').addEventListener('keydown',e=>{const n=e.target.closest('[data-nodeid]');if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();inspect(n.dataset.nodeid);}});
 $('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{clearTimeout(toastTimer);$('toast').textContent='Для полного экрана откройте HTML в браузере и нажмите F11.';$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}});
 document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||$('dialog').open||e.target.closest('input,textarea,select'))return;const key=e.key.toLowerCase();if(e.key==='Escape')return;if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();next();}else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();back();}else if(e.key===' '&&!e.target.closest('button,a,[role=button]')){e.preventDefault();next();}else if(/^[1-9]$/.test(e.key)&&Number(e.key)<=chapters.length)go(Number(e.key)-1);else if(e.key==='Home')go(-1);else if(e.key==='End')go(chapters.length-1,chapters[chapters.length-1].beats.length-1);else if(['f','а'].includes(key))$('fullscreen').click();});
 function hashState(){const m=location.hash.match(/^#chapter-(\d+)-step-(\d+)$/);return m?{c:Number(m[1])-1,s:Number(m[2])-1}:{c:-1,s:0};}
 window.addEventListener('hashchange',()=>{const {c,s}=hashState();go(c,s,{fromHash:true});});
 function skyTravel(){}
 window.addEventListener('resize',alignFrame,{passive:true});
 if(document.fonts)document.fonts.ready.then(alignFrame);
 const initial=hashState();go(initial.c,initial.s,{fromHash:true,immediate:true});
})();

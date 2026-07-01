// ── PREFS ─────────────────────────────────────────────────
const DP={wantBike:true,hasCar:true,hasScooter:true,tMin:8,tMax:34,wMax:25,rainOk:false,showEvents:true};
const lP=()=>{
  try{
    const stored=JSON.parse(localStorage.getItem('mp')||'{}');
    if('hasBike' in stored&&!('wantBike' in stored)){stored.wantBike=stored.hasBike;delete stored.hasBike;}
    return{...DP,...stored};
  }catch{return{...DP};}
};
const sP=p=>localStorage.setItem('mp',JSON.stringify(p));

function applyPreset(n){
  const presets={all:{wantBike:true,hasCar:true,hasScooter:true},nocar:{hasCar:false},nobike:{wantBike:false},transit:{wantBike:false,hasCar:false,hasScooter:false}};
  const p={...lP(),...(presets[n]||{})};
  document.getElementById('p-bike').checked=p.wantBike;
  document.getElementById('p-car').checked=p.hasCar;
  document.getElementById('p-scooter').checked=p.hasScooter;
  document.getElementById('bike-thresh').style.display=p.wantBike?'':'none';
}
function openSettings(){
  const p=lP();
  document.getElementById('p-bike').checked=p.wantBike;
  document.getElementById('p-car').checked=p.hasCar;
  document.getElementById('p-scooter').checked=p.hasScooter;
  document.getElementById('p-tmin').value=p.tMin;
  document.getElementById('p-tmax').value=p.tMax;
  document.getElementById('p-wmax').value=p.wMax;
  document.getElementById('p-rain').checked=p.rainOk;
  document.getElementById('p-events').checked=p.showEvents;
  document.getElementById('bike-thresh').style.display=p.wantBike?'':'none';
  document.getElementById('p-bike').onchange=e=>document.getElementById('bike-thresh').style.display=e.target.checked?'':'none';
  document.getElementById('settings-ov').classList.add('open');
}
function closeSettings(){document.getElementById('settings-ov').classList.remove('open')}
function saveSettings(){
  sP({
    wantBike:document.getElementById('p-bike').checked,
    hasCar:document.getElementById('p-car').checked,
    hasScooter:document.getElementById('p-scooter').checked,
    tMin:+document.getElementById('p-tmin').value,
    tMax:+document.getElementById('p-tmax').value,
    wMax:+document.getElementById('p-wmax').value,
    rainOk:document.getElementById('p-rain').checked,
    showEvents:document.getElementById('p-events').checked,
  });
  document.getElementById('sp-ok').textContent='✓ Gespeichert';
  setTimeout(()=>{document.getElementById('sp-ok').textContent='';closeSettings();renderRec();renderInfoCards();},700);
}

// ── CLOCK ─────────────────────────────────────────────────
(function tick(){document.getElementById('clock').textContent=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});setTimeout(tick,15e3)})();

// ── NAVIGATION ────────────────────────────────────────────
function show(id,btn){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('on'));
  document.getElementById('panel-'+id).classList.add('on');
  if(btn)btn.classList.add('on');
  if(id==='bike')setTimeout(()=>leafMap&&leafMap.invalidateSize(),150);
  if(id==='start')setTimeout(()=>startMap&&startMap.invalidateSize(),150);
  if(id==='dep'&&!document.getElementById('dep-board').querySelector('.dep-box')){loadDep();loadBusDep();}
  if(id==='stoer')renderStoer();
}

// ── WEATHER ───────────────────────────────────────────────
const OWM='e753f02c4f2f0f94cf78f4907344dca5',HH=[53.5753,10.0153];
let wxState=null,fcData=[];

function wxIcon(id){
  if(id<300)return'⛈';if(id<400)return'🌦';
  if(id<600)return'🌧';if(id<700)return'❄';
  if(id<800)return'🌫';if(id===800)return'☀';
  if(id===801)return'🌤';return'☁';
}

async function loadWeather(){
  try{
    const r=await fetch(`/api/weather?lat=${HH[0]}&lon=${HH[1]}&appid=${OWM}&units=metric&lang=de`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const wx=await r.json();
    wxState={t:Math.round(wx.main.temp),w:Math.round(wx.wind.speed*3.6),h:wx.main.humidity,id:wx.weather[0].id,desc:wx.weather[0].description};
    document.getElementById('wx-pill').innerHTML=`${wxIcon(wxState.id)} <b>${wxState.t}°C</b> &middot; ${wxState.w} km/h`;
    renderRec();
    renderGreeting();
    renderInfoCards();
    renderStoer();
  }catch(e){
    console.error('weather',e);
    document.getElementById('wx-pill').textContent='Wetter nicht verfügbar';
  }
}

async function loadForecast(){
  try{
    const r=await fetch(`/api/forecast?lat=${HH[0]}&lon=${HH[1]}&appid=${OWM}&units=metric&lang=de&cnt=40`,{signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(!d.list?.length)throw new Error('Keine Forecast-Daten');
    const by={};
    d.list.forEach(item=>{
      const [date,time]=item.dt_txt.split(' '),h=parseInt(time);
      if(!by[date])by[date]=[];
      by[date].push({...item,h});
    });
    fcData=Object.entries(by).map(([date,items])=>{
      const day=items.filter(i=>i.h>=9&&i.h<=18),ref=day.length?day:items;
      const temps=items.map(i=>i.main.temp);
      const winds=ref.map(i=>i.wind.speed*3.6);
      const ids=ref.map(i=>i.weather[0].id);
      const worst=ids.reduce((acc,id)=>{
        if(id<300)return id; if(acc<300)return acc;
        if(id<600)return id; if(acc<600)return acc;
        if(id<700)return id; if(acc<700)return acc;
        return acc;
      },ids[0]??800);
      return{date,tMin:Math.round(Math.min(...temps)),tMax:Math.round(Math.max(...temps)),wAvg:Math.round(winds.reduce((a,b)=>a+b,0)/winds.length),weatherId:worst};
    });
    renderForecast(lP());
  }catch(e){
    console.error('forecast',e);
    document.getElementById('fc-grid').innerHTML=`<div class="err" style="grid-column:1/-1">Vorhersage nicht verfügbar: ${e.message}</div>`;
  }
}

// ── GREETING ──────────────────────────────────────────────
function renderGreeting(){
  const h=new Date().getHours();
  const greet=h<5?'Gute Nacht':h<12?'Guten Morgen':h<18?'Guten Tag':'Guten Abend';
  const days=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const now=new Date();
  const ds=`${days[now.getDay()]}, ${now.getDate()}. ${months[now.getMonth()]}`;
  document.getElementById('greeting-main').textContent=greet;
  const sub=wxState?`${ds} · ${wxIcon(wxState.id)} ${wxState.t}°C · ${wxState.desc}`:`${ds} · Hamburg`;
  document.getElementById('greeting-sub').textContent=sub;
}

// ── START MAP ─────────────────────────────────────────────
let startMap=null,startDestMarker=null,routeMode='transit';
let hhMarker=null,routeFG=null,userPos=null;

function getLocation(){
  const btn=document.getElementById('loc-btn');
  if(!navigator.geolocation){btn.title='Nicht verfügbar';return;}
  btn.textContent='…';
  navigator.geolocation.getCurrentPosition(
    pos=>{
      userPos={lat:pos.coords.latitude,lon:pos.coords.longitude};
      btn.classList.add('on');btn.textContent='◉';btn.title='Standort aktiv — klicken zum Deaktivieren';
      btn.onclick=()=>{userPos=null;btn.classList.remove('on');btn.textContent='◎';
        btn.title='Mein Standort als Startpunkt';btn.onclick=getLocation;
        if(hhMarker){startMap.removeLayer(hhMarker);}
        hhMarker=L.circleMarker(HH,{radius:7,fillColor:'#2563eb',color:'#fff',weight:2,fillOpacity:1}).addTo(startMap).bindPopup('<b>Hamburg</b>');
        if(destState)fetchAndDrawRoute();
      };
      if(hhMarker)startMap.removeLayer(hhMarker);
      hhMarker=L.circleMarker([userPos.lat,userPos.lon],{radius:8,fillColor:'#2563eb',color:'#fff',weight:2,fillOpacity:1})
        .addTo(startMap).bindPopup('<b>Mein Standort</b>').openPopup();
      if(destState)fetchAndDrawRoute();
    },
    ()=>{btn.textContent='◎';btn.title='Standortzugriff verweigert';},
    {timeout:8000,maximumAge:120000}
  );
}

function initStartMap(){
  if(startMap)return;
  startMap=L.map('start-map',{zoomControl:false,attributionControl:false}).setView(HH,11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(startMap);
  L.control.zoom({position:'bottomright'}).addTo(startMap);
  routeFG=L.featureGroup().addTo(startMap);
  hhMarker=L.circleMarker(HH,{radius:7,fillColor:'#2563eb',color:'#fff',weight:2,fillOpacity:1})
    .addTo(startMap).bindPopup('<b>Hamburg</b>');
}

function setRouteMode(mode,btn){
  routeMode=mode;
  document.querySelectorAll('#route-tabs .chip').forEach(c=>c.classList.remove('on'));
  if(btn)btn.classList.add('on');
  if(destState)fetchAndDrawRoute();
}

async function fetchAndDrawRoute(){
  if(!destState||!startMap)return;
  routeFG.clearLayers();
  const ri=document.getElementById('route-info');
  ri.style.display='flex';
  document.getElementById('ri-label').textContent='Route wird berechnet…';
  document.getElementById('ri-sub').textContent='';
  document.getElementById('ri-link').style.display='none';

  const[lat1,lon1]=userPos?[userPos.lat,userPos.lon]:HH;
  const{lat:lat2,lon:lon2}=destState;

  if(routeMode==='transit'){await fetchTransitRoute(lat1,lon1,lat2,lon2);return;}

  const osrmProfile=routeMode==='bike'?'cycling':'driving';
  try{
    const r=await fetch(
      `https://router.project-osrm.org/route/v1/${osrmProfile}/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`,
      {signal:AbortSignal.timeout(9000)}
    );
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    if(d.code!=='Ok'||!d.routes?.length)throw new Error('Keine Route');
    const route=d.routes[0];
    const coords=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    const distM=route.distance,durS=route.duration;
    const color=routeMode==='bike'?'#1a7f37':'#9a6700';
    L.polyline(coords,{color,weight:4,opacity:.75}).addTo(routeFG);
    startMap.fitBounds(routeFG.getBounds(),{padding:[20,20]});
    const distTxt=distM<1000?Math.round(distM)+' m':(distM/1000).toFixed(1)+' km';
    const mins=Math.round(durS/60);
    const durTxt=mins<60?mins+' min':`${Math.floor(mins/60)}h ${mins%60}min`;
    const modeLabel=routeMode==='bike'?'Fahrrad':'Carsharing / Auto';
    document.getElementById('ri-label').textContent=`${modeLabel} · ${distTxt} · ca. ${durTxt}`;
    const linkEl=document.getElementById('ri-link');
    linkEl.style.display='';
    const gmMode=routeMode==='bike'?'bicycling':'driving';
    linkEl.href=`https://www.google.com/maps/dir/?api=1&origin=${lat1},${lon1}&destination=${lat2},${lon2}&travelmode=${gmMode}`;
    linkEl.textContent='Google Maps →';
  }catch(e){
    document.getElementById('ri-label').textContent='Route nicht verfügbar: '+e.message;
    L.polyline([[lat1,lon1],[lat2,lon2]],{color:'#9198a1',weight:2,dashArray:'5 5',opacity:.5}).addTo(routeFG);
    startMap.fitBounds(routeFG.getBounds(),{padding:[24,24]});
  }
}

async function fetchTransitRoute(lat1,lon1,lat2,lon2){
  const ri=document.getElementById('route-info');
  const productColor={suburban:'#1a7f37',regional:'#7f1d1d',regionalExp:'#7f1d1d',
    nationalExpress:'#1c1c1c',national:'#1c1c1c',bus:'#9a3412',subway:'#1e3a8a',ferry:'#134e4a'};
  try{
    const[fromR,toR]=await Promise.all([
      fetch(`https://v5.db.transport.rest/stops/nearby?latitude=${lat1}&longitude=${lon1}&results=1`,{signal:AbortSignal.timeout(7000)}),
      fetch(`https://v5.db.transport.rest/stops/nearby?latitude=${lat2}&longitude=${lon2}&results=1`,{signal:AbortSignal.timeout(7000)})
    ]);
    const[fromArr,toArr]=await Promise.all([fromR.json(),toR.json()]);
    if(!fromArr?.length||!toArr?.length)throw new Error('Keine Haltestellen gefunden');
    const jR=await fetch(
      `https://v5.db.transport.rest/journeys?from=${fromArr[0].id}&to=${toArr[0].id}&results=1&stopovers=true`,
      {signal:AbortSignal.timeout(12000)}
    );
    const jD=await jR.json();
    if(!jD.journeys?.length)throw new Error('Keine Verbindung gefunden');
    const journey=jD.journeys[0];
    const legs=journey.legs.filter(l=>!l.walking&&l.stopovers?.length>=2);
    legs.forEach(leg=>{
      const color=productColor[leg.line?.product]||'#2563eb';
      const coords=leg.stopovers.map(s=>[s.stop?.location?.latitude,s.stop?.location?.longitude]).filter(c=>c[0]&&c[1]);
      if(coords.length>=2){
        L.polyline(coords,{color,weight:4,opacity:.8}).addTo(routeFG);
        leg.stopovers.slice(1,-1).forEach(s=>{
          if(s.stop?.location)
            L.circleMarker([s.stop.location.latitude,s.stop.location.longitude],
              {radius:3,fillColor:color,color:'#fff',weight:1,fillOpacity:.9})
              .addTo(routeFG).bindPopup(s.stop.name||'');
        });
      }
    });
    if(routeFG.getLayers().length)startMap.fitBounds(routeFG.getBounds(),{padding:[20,20]});
    const dep=new Date(journey.legs[0].departure),arr=new Date(journey.legs[journey.legs.length-1].arrival);
    const mins=Math.round((arr-dep)/60000);
    const durTxt=mins<60?mins+' min':`${Math.floor(mins/60)}h ${mins%60}min`;
    const changes=Math.max(0,legs.length-1);
    const changesTxt=changes?' · '+changes+' Umstieg'+(changes>1?'e':''):'';
    document.getElementById('ri-label').textContent='Bus / ÖPNV · ca. '+durTxt+changesTxt;
    document.getElementById('ri-sub').textContent=`${fromArr[0].name} → ${toArr[0].name}`;
  }catch(e){
    // Fallback: OSRM driving as approximate transit path
    try{
      const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`,{signal:AbortSignal.timeout(8000)});
      const d=await r.json();
      if(d.code==='Ok'&&d.routes?.length){
        const coords=d.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
        L.polyline(coords,{color:'#2563eb',weight:3,dashArray:'8 4',opacity:.6}).addTo(routeFG);
        startMap.fitBounds(routeFG.getBounds(),{padding:[20,20]});
        const mins=Math.round(d.routes[0].duration*1.25/60);
        const durTxt=mins<60?mins+' min':`${Math.floor(mins/60)}h ${mins%60}min`;
        document.getElementById('ri-label').textContent=`Bus / ÖPNV · ca. ${durTxt} (Schätzung)`;
        document.getElementById('ri-sub').textContent='Ungefähre Route — exakte Verbindung via HVV';
      }
    }catch{}
  }
  const linkEl=document.getElementById('ri-link');
  linkEl.style.display='';
  linkEl.href=`https://www.hvv.de/de/fahrplaene/fahrplanauskunft`;
  linkEl.textContent='HVV öffnen →';
}

function updateStartMap(){
  if(!startMap)return;
  if(startDestMarker){startMap.removeLayer(startDestMarker);startDestMarker=null;}
  routeFG.clearLayers();
  const tabs=document.getElementById('route-tabs');
  const ri=document.getElementById('route-info');
  if(!destState){
    startMap.setView(userPos?[userPos.lat,userPos.lon]:HH,11);
    tabs.style.display='none';
    ri.style.display='none';
    return;
  }
  startDestMarker=L.circleMarker([destState.lat,destState.lon],{radius:7,fillColor:'#cf222e',color:'#fff',weight:2,fillOpacity:1})
    .addTo(startMap).bindPopup(`<b>${destState.name}</b><br>${fmtDist(destState.dist)} Luftlinie`);
  tabs.style.display='flex';
  fetchAndDrawRoute();
}

// ── STÖRUNGEN ─────────────────────────────────────────────
let lastDeps=[];

function renderStoer(){
  if(wxState){
    const{t,w,id}=wxState;
    const rain=id>=300&&id<700,heavy=id>=500&&id<600,thunder=id<300;
    const h=new Date().getHours();
    const morningRush=h>=7&&h<=9,eveningRush=h>=16&&h<=19,rush=morningRush||eveningRush;
    const tags=[];
    let title,detail;
    if(thunder){
      title='Gewitter — starke Verzögerungen möglich';
      detail='Gewitterbedingte Störungen im ÖPNV und erhöhtes Unfallrisiko im Straßenverkehr.';
      tags.push({t:'Gewitter',c:'bad'},{t:'Störungen wahrscheinlich',c:'bad'});
    }else if(heavy&&rush){
      title='Starkregen + Rushhour — Staus wahrscheinlich';
      detail='Kombination aus Starkregen und erhöhtem Verkehrsaufkommen. Mehr Zeit einplanen.';
      tags.push({t:'Starkregen',c:'bad'},{t:morningRush?'Morgenrush':'Abendrush',c:'warn'});
    }else if(heavy){
      title='Starkregen — Verzögerungen möglich';
      detail='Bei Starkregen kommt es häufig zu Staus und ÖPNV-Verspätungen.';
      tags.push({t:'Starkregen',c:'bad'});
    }else if(rain&&rush){
      title='Regen + Rushhour — mehr Zeit einplanen';
      detail='Leichter Regen und Stoßzeiten erhöhen das Verkehrsaufkommen.';
      tags.push({t:'Regen',c:'warn'},{t:morningRush?'Morgenrush':'Abendrush',c:'warn'});
    }else if(rush){
      title=morningRush?'Morgenrush — erhöhtes Verkehrsaufkommen':'Abendrush — erhöhtes Verkehrsaufkommen';
      detail='Stoßzeiten: S-Bahn und Busse stärker ausgelastet.';
      tags.push({t:morningRush?'Morgenrush':'Abendrush',c:'warn'},{t:'Normalbetrieb',c:'ok'});
    }else if(w>40){
      title='Starker Wind — Fährbetrieb möglicherweise eingeschränkt';
      detail=`Windgeschwindigkeit ${w} km/h. Fährlinien können betroffen sein.`;
      tags.push({t:`Wind ${w} km/h`,c:'warn'});
    }else{
      title='Keine bekannten Störungen';
      detail='Aktuelle Störungsmeldungen direkt bei HVV und NDR prüfen.';
      tags.push({t:'Normalbetrieb',c:'ok'});
    }
    document.getElementById('stoer-status-card').className='rec-card traffic';
    document.getElementById('stoer-title').textContent=title;
    document.getElementById('stoer-detail').textContent=detail;
    document.getElementById('stoer-tags').innerHTML=tags.map(x=>`<span class="rtag ${x.c}">${x.t}</span>`).join('');
  }

  const sb=document.getElementById('stoer-dep-box');
  if(!lastDeps.length){
    sb.innerHTML=`<div class="dep-box"><div class="dep-hd"><span class="dep-sn">Zugstatus</span><span class="dep-ts">Bahn-Tab öffnen zum Laden</span></div></div>`;
    return;
  }
  const delayed=lastDeps.filter(d=>(d.delayDeparture||0)>2&&!d.isCancelled).length;
  const cancl=lastDeps.filter(d=>d.isCancelled===1).length;
  const summ=cancl?`${cancl} Ausfall${cancl>1?'e':''}`:delayed?`${delayed} verspätet`:'Alles pünktlich';
  const rows=lastDeps.slice(0,10).map(d=>{
    const delay=d.delayDeparture??0,cancelled=d.isCancelled===1;
    const name=(d.train||'').trim();
    const dest=(d.destination||'?').replace(/^Hamburg[- ]/i,'');
    const[hh,mm]=(d.scheduledDeparture||'00:00').split(':').map(Number);
    let tHtml;
    if(cancelled)tHtml='<span style="color:var(--red);font-style:italic">Fällt aus</span>';
    else if(delay>5)tHtml=`<span class="t-now">+${delay}'</span>`;
    else if(delay>2)tHtml=`<span class="t-soon">+${delay}'</span>`;
    else tHtml=`<span class="t-ok">Pünktlich</span>`;
    return`<tr><td><span class="lbadge ${badgeCls(d.trainClasses||[])}">${name}</span></td><td class="dep-dir">${dest}</td><td class="dep-plt">${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}</td><td class="dep-t">${tHtml}</td></tr>`;
  }).join('');
  sb.innerHTML=`<div class="dep-box"><div class="dep-hd"><span class="dep-sn">${curLabel}</span><span class="dep-ts">${summ}</span></div><table class="dep-tbl"><tbody>${rows}</tbody></table></div>`;
}

// ── RECOMMENDATION ────────────────────────────────────────
const MODES={
  storm:  {cls:'storm',  label:'Gewitter',   title:'Bitte ÖPNV nehmen — Gewittergefahr!'},
  transit:{cls:'transit',label:'ÖPNV',       title:'S-Bahn oder HVV empfohlen'},
  bike:   {cls:'bike',   label:'Fahrrad',    title:'Gutes Radwetter'},
  scooter:{cls:'scooter',label:'E-Scooter',  title:'E-Scooter empfohlen'},
  car:    {cls:'car',    label:'Carsharing', title:'Carsharing empfohlen'},
  walk:   {cls:'walk',   label:'Zu Fuß',     title:'Kurze Strecke — zu Fuß!'},
};
function getMode(t,w,id,p,dist){
  const rain=id>=300&&id<700,heavy=id>=500&&id<600,thunder=id<300,snow=id>=600&&id<700;
  if(thunder)return'storm';
  if(snow)return'transit';
  if(dist!==null&&dist<0.7)return'walk';
  const bikeOk=p.wantBike&&t>=p.tMin&&t<=p.tMax&&w<=p.wMax&&(!rain||(p.rainOk&&!heavy));
  if(bikeOk&&(dist===null||dist<=25))return'bike';
  if(p.hasScooter&&t>=10&&!heavy&&(dist===null||dist<=12))return'scooter';
  if(p.hasCar&&(w>30||(dist!==null&&dist>30)))return'car';
  return'transit';
}

let destState=null,destWeather=null;

async function loadDestWeather(lat,lon){
  try{
    const r=await fetch(`/api/weather?lat=${lat}&lon=${lon}&appid=${OWM}&units=metric&lang=de`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const wx=await r.json();
    destWeather={t:Math.round(wx.main.temp),w:Math.round(wx.wind.speed*3.6),id:wx.weather[0].id,desc:wx.weather[0].description,city:wx.name};
    renderTripCompare();
  }catch(e){
    destWeather=null;
    document.getElementById('trip-cmp').style.display='none';
  }
}

function renderTripCompare(){
  const el=document.getElementById('trip-cmp');
  if(!wxState||!destWeather||!destState){el.style.display='none';return;}
  const p=lP();
  const hhMode=getMode(wxState.t,wxState.w,wxState.id,p,null);
  const dMode=getMode(destWeather.t,destWeather.w,destWeather.id,p,null);
  document.getElementById('tc-hh-wx').textContent=`${wxIcon(wxState.id)} ${wxState.t}°C`;
  document.getElementById('tc-hh-sub').textContent=`${wxState.desc} · ${wxState.w} km/h`;
  const hb=document.getElementById('tc-hh-badge');hb.className=`trip-badge ${MODES[hhMode].cls}`;hb.textContent=MODES[hhMode].label;
  document.getElementById('tc-dest-lbl').textContent=destWeather.city||destState.name;
  document.getElementById('tc-dest-wx').textContent=`${wxIcon(destWeather.id)} ${destWeather.t}°C`;
  document.getElementById('tc-dest-sub').textContent=`${destWeather.desc} · ${destWeather.w} km/h`;
  const db=document.getElementById('tc-dest-badge');db.className=`trip-badge ${MODES[dMode].cls}`;db.textContent=MODES[dMode].label;
  const diff=Math.abs(wxState.t-destWeather.t);
  const hints=[];
  if(diff>=5)hints.push(`${diff}°C ${destWeather.t>wxState.t?'wärmer':'kälter'} als Hamburg`);
  if(destWeather.id>=300&&destWeather.id<700&&!(wxState.id>=300&&wxState.id<700))hints.push('Regen am Ziel — Schirm nicht vergessen');
  if(destWeather.id>=800&&wxState.id>=300&&wxState.id<700)hints.push('Schöner als Hamburg am Ziel');
  document.getElementById('tc-hint').textContent=hints.join(' · ');
  el.style.display='';
}

function renderRec(){
  if(!wxState)return;
  const{t,w,id}=wxState,p=lP(),dist=destState?destState.dist:null;
  const mode=getMode(t,w,id,p,dist),m=MODES[mode];
  document.getElementById('rec-card').className='rec-card '+m.cls;
  document.getElementById('rec-mode').textContent=m.label;
  let title=m.title;
  if(mode==='bike'){
    if(t>=16&&t<=26&&w<=14&&id>=800)title='Perfektes Radwetter!';
    else if(t>28)title='Warm — lieber E-Scooter oder ÖPNV?';
  }else if(mode==='transit'&&p.wantBike){
    if(t<p.tMin)title=`Zu kalt für Rad (${t}°C < ${p.tMin}°C)`;
    else if(t>p.tMax)title=`Zu heiß für Rad (${t}°C > ${p.tMax}°C)`;
    else if(id>=300&&id<700)title='Regen — ÖPNV empfohlen';
    else if(w>p.wMax)title=`Zu viel Wind (${w} km/h)`;
  }
  document.getElementById('rec-title').textContent=title;
  const parts=[];
  if(destState)parts.push(`→ ${destState.name}`);
  parts.push(`${t}°C`);
  if(id>=300&&id<700)parts.push(id>=500&&id<600?'Starker Regen':'Regen');
  parts.push(`Wind ${w} km/h`);
  document.getElementById('rec-detail').textContent=parts.join(' · ');
  const distEl=document.getElementById('rec-dist');
  if(destState){distEl.style.display='';distEl.textContent=fmtDist(destState.dist)+' Luftlinie';}
  else distEl.style.display='none';
  const tags=[];
  if(t>=16&&t<=26)tags.push({t:`${t}°C ideal`,c:'ok'});
  else if(t<p.tMin&&p.wantBike)tags.push({t:`Zu kalt ${t}°C`,c:'bad'});
  else if(t>p.tMax&&p.wantBike)tags.push({t:`Zu heiß ${t}°C`,c:'bad'});
  if(w<=14)tags.push({t:'Wenig Wind',c:'ok'});
  else if(w>p.wMax&&p.wantBike)tags.push({t:`Wind ${w} km/h`,c:'bad'});
  if(id<300)tags.push({t:'Gewitter',c:'bad'});
  else if(id>=300&&id<700)tags.push({t:'Regen',c:'warn'});
  else tags.push({t:'Kein Regen',c:'ok'});
  if(!p.wantBike)tags.push({t:'Fahrrad aus',c:'warn'});
  if(!p.hasCar)tags.push({t:'Kein Auto',c:'warn'});
  document.getElementById('rec-tags').innerHTML=tags.map(x=>`<span class="rtag ${x.c}">${x.t}</span>`).join('');
  renderForecast(p);
}

// ── EVENTS CARD ───────────────────────────────────────────
function renderInfoCards(){
  const p=lP();
  const ec=document.getElementById('events-card');
  if(p.showEvents&&wxState){
    const{t,w,id}=wxState;
    const rain=id>=300&&id<700,heavy=id>=500&&id<600,thunder=id<300;
    const goodWeather=!rain&&!thunder&&t>=14&&w<=25;
    const tags=[];
    let title,detail;
    if(thunder||heavy){
      title='Heute lieber drinnen — Theater, Museen, Kino';
      detail='Bei Gewitter/Starkregen sind Indoor-Veranstaltungen die bessere Wahl.';
      tags.push({t:'Indoor',c:'warn'},{t:'Theater & Museen',c:'info'},{t:'Kino',c:'info'});
    }else if(goodWeather&&t>=20){
      title='Perfektes Ausflugswetter — Alster, Stadtpark, Elbstrand';
      detail='Ideales Wetter für Outdoor-Events. Alsterwiesen, Stadtparkfest oder Elbstrand genießen.';
      tags.push({t:'Outdoor ideal',c:'ok'},{t:'Alster',c:'info'},{t:'Stadtpark',c:'info'},{t:'Elbstrand',c:'info'});
    }else if(goodWeather){
      title='Gutes Wetter für Outdoor-Events in Hamburg';
      detail='Angenehmes Wetter für Parks, Märkte und Open-Air-Veranstaltungen.';
      tags.push({t:'Outdoor ok',c:'ok'},{t:'Parks & Märkte',c:'info'});
    }else if(rain){
      title='Leichter Regen — Indoor-Events bevorzugen';
      detail='Elbphilharmonie, Kunsthalle, Miniatur Wunderland oder eines der vielen Museen.';
      tags.push({t:'Indoor',c:'warn'},{t:'Elbphilharmonie',c:'info'},{t:'Kunsthalle',c:'info'});
    }else{
      title='Events heute in Hamburg entdecken';
      detail='Hamburgs Veranstaltungskalender für aktuelle Events in deiner Nähe.';
      tags.push({t:'Events',c:'info'});
    }
    document.getElementById('events-title').textContent=title;
    document.getElementById('events-detail').textContent=detail;
    document.getElementById('events-tags').innerHTML=tags.map(x=>`<span class="rtag ${x.c}">${x.t}</span>`).join('');
    ec.style.display='';
  }else{
    ec.style.display='none';
  }
}

function renderForecast(p){
  if(!fcData.length)return;
  const today=new Date().toISOString().split('T')[0];
  const WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
  const mIco={storm:'⛈',transit:'🚊',bike:'🚲',scooter:'🛴',car:'🚗',walk:'🚶'};
  document.getElementById('fc-grid').innerHTML=fcData.slice(0,5).map(fc=>{
    const d=new Date(fc.date+'T12:00:00'),wd=WD[d.getDay()],isToday=fc.date===today;
    const mode=getMode(Math.round((fc.tMin+fc.tMax)/2),fc.wAvg,fc.weatherId,p,null);
    return`<div class="fc-day${isToday?' today':''}">
      <div class="fc-wd">${isToday?'Heute':wd}</div>
      <div class="fc-wx">${wxIcon(fc.weatherId)}</div>
      <div class="fc-temp">${fc.tMax}°<small>/${fc.tMin}°</small></div>
      <div class="fc-wind">${fc.wAvg}km/h</div>
      <div class="fc-tip" title="${MODES[mode].title}">${mIco[mode]}</div>
    </div>`;
  }).join('');
}

// ── DESTINATION ───────────────────────────────────────────
const geoCache={};
function haversine(la1,lo1,la2,lo2){
  const R=6371,d=v=>v*Math.PI/180;
  const a=Math.sin(d(la2-la1)/2)**2+Math.cos(d(la1))*Math.cos(d(la2))*Math.sin(d(lo2-lo1)/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtDist(km){return km<1?Math.round(km*1e3)+' m':km.toFixed(1)+' km'}
async function calcRoute(){
  const q=document.getElementById('dest-in').value.trim();
  if(!q){
    destState=null;destWeather=null;
    document.getElementById('trip-cmp').style.display='none';
    renderRec();
    updateStartMap();
    return;
  }
  try{
    let geo=geoCache[q];
    if(!geo){
      const r=await fetch(`/api/geocode?q=${encodeURIComponent(q)}&format=json&limit=1`,{signal:AbortSignal.timeout(6000)});
      const d=await r.json();
      if(!d||!d[0])throw new Error('Ort nicht gefunden');
      geo=d[0];geoCache[q]=geo;
    }
    destState={name:q,lat:+geo.lat,lon:+geo.lon,dist:haversine(HH[0],HH[1],+geo.lat,+geo.lon)};
    document.getElementById('gmaps-link').href=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=transit`;
    renderRec();
    updateStartMap();
    loadDestWeather(+geo.lat,+geo.lon);
  }catch(e){
    document.getElementById('rec-title').textContent='⚠ '+e.message;
  }
}

// ── DEPARTURES ────────────────────────────────────────────
let curStop='Hamburg%20Hbf',curLabel='Hamburg Hbf';
function updateHvvLinks(){
  const enc=encodeURIComponent(curLabel);
  const depEl=document.getElementById('hvv-dep-link');
  const rtEl=document.getElementById('hvv-route-link');
  if(depEl)depEl.href=`https://www.hvv.de/de/fahrplaene/abfahrt-ankunft?stop=${enc}`;
  if(rtEl)rtEl.href=`https://www.hvv.de/de/fahrplaene/fahrplanauskunft?start=${enc}`;
}
function setStop(id,label,btn){
  curStop=id;curLabel=label;
  document.querySelectorAll('#stop-chips .chip').forEach(c=>c.classList.remove('on'));
  if(btn)btn.classList.add('on');
  updateHvvLinks();
  loadDep();
  loadBusDep();
}
function searchStop(){
  const v=document.getElementById('stop-in').value.trim();
  if(!v)return;
  document.querySelectorAll('#stop-chips .chip').forEach(c=>c.classList.remove('on'));
  curLabel=v;curStop=encodeURIComponent(v);
  document.getElementById('stop-in').value='';
  updateHvvLinks();
  loadDep();
  loadBusDep();
}
function navToStop(){
  window.open(`https://www.hvv.de/de/fahrplaene/abfahrt-ankunft?stop=${encodeURIComponent(curLabel)}`,'_blank');
}
function badgeCls(cls){
  if((cls||[]).some(c=>/^S\d/.test(c)))return'l-s';
  if((cls||[]).some(c=>/^(IC|EC|THA|RJ|NJ|EN|D|RE|RB|FLX)/.test(c)))return'l-ic';
  return'l-def';
}
async function loadDep(){
  document.getElementById('dep-board').innerHTML='<div class="loading">Abfahrten werden geladen…</div>';
  try{
    const r=await fetch(`/api/transit/${curStop}.json?version=3&limit=14`,{signal:AbortSignal.timeout(9000)});
    if(r.status===404)throw new Error('Haltestelle nicht gefunden');
    if(!r.ok)throw new Error('HTTP '+r.status);
    const{departures:deps=[]}=await r.json();
    if(!deps.length)throw new Error('Keine Abfahrten in den nächsten Minuten');
    lastDeps=deps.slice(0,14);
    renderStoer();
    const now=new Date();
    const rows=lastDeps.map(d=>{
      const cls=d.trainClasses||[];
      const name=(d.train||'').trim();
      const dest=(d.destination||'?').replace(/^Hamburg[- ]/i,'');
      const delay=d.delayDeparture??0,cancelled=d.isCancelled===1;
      const plat=d.platform?'Gl. '+d.platform:'';
      const[h,m]=(d.scheduledDeparture||'00:00').split(':').map(Number);
      const dt=new Date(now);dt.setHours(h,m,0,0);
      if(dt<new Date(+now-300000))dt.setDate(dt.getDate()+1);
      const act=new Date(+dt+delay*60000),min=Math.round((act-now)/60000);
      const hh=act.getHours().toString().padStart(2,'0'),mm2=act.getMinutes().toString().padStart(2,'0');
      let tHtml;
      if(cancelled)tHtml='<span style="color:var(--red);font-style:italic">Fällt aus</span>';
      else if(min<=0)tHtml='<span class="t-now">Jetzt</span>';
      else if(min<60){
        const cl=min<=3?'t-now':min<=9?'t-soon':'t-ok';
        const dl=delay>0?`<span class="t-d">+${delay}'</span>`:'';
        tHtml=`<span class="${cl}">${min}<small> min</small></span>${dl}`;
      }else{
        const dl=delay>0?`<span class="t-d">+${delay}'</span>`:'';
        tHtml=`<span>${hh}:${mm2}</span>${dl}`;
      }
      return`<tr><td><span class="lbadge ${badgeCls(cls)}">${name}</span></td><td class="dep-dir">${dest}</td><td class="dep-plt">${plat}</td><td class="dep-t">${tHtml}</td></tr>`;
    }).join('');
    const ts=now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    document.getElementById('dep-board').innerHTML=`<div class="dep-box">
      <div class="dep-hd"><span class="dep-sn">${curLabel}</span><span class="dep-ts">Stand ${ts}</span></div>
      <table class="dep-tbl"><tbody>${rows}</tbody></table>
    </div>`;
  }catch(e){
    document.getElementById('dep-board').innerHTML=`<div class="err">⚠ ${e.message}</div>`;
  }
}

// ── BUS & U-BAHN via HAFAS ────────────────────────────────
const hafasIdCache={};
async function loadBusDep(){
  const bb=document.getElementById('bus-board');
  bb.innerHTML='<div class="loading">Wird geladen…</div>';
  try{
    let stopId=hafasIdCache[curLabel];
    if(!stopId){
      const lr=await fetch(`https://v5.db.transport.rest/locations?query=${encodeURIComponent(curLabel)}&results=1`,{signal:AbortSignal.timeout(7000)});
      const ld=await lr.json();
      if(!ld?.length)throw new Error('Haltestelle nicht gefunden');
      stopId=ld[0].id;
      hafasIdCache[curLabel]=stopId;
    }
    const dr=await fetch(`https://v5.db.transport.rest/stops/${stopId}/departures?duration=45&results=20`,{signal:AbortSignal.timeout(9000)});
    if(!dr.ok)throw new Error('HTTP '+dr.status);
    const deps=await dr.json();
    const busDeps=(deps?.departures||deps||[]).filter(d=>['bus','subway','tram','ferry'].includes(d.line?.product)&&!d.cancelled).slice(0,12);
    if(!busDeps.length){bb.innerHTML='<div class="loading" style="padding:14px">Keine Bus/U-Bahn-Abfahrten verfügbar</div>';return;}
    const now=new Date();
    const productBadge={bus:'l-re',subway:'l-ic',tram:'l-re',ferry:'l-s'};
    const rows=busDeps.map(d=>{
      const name=d.line?.name||'?';
      const dest=(d.direction||'?').replace(/^Hamburg[, -]*/i,'');
      const plat=d.platform?'Gl. '+d.platform:'';
      const when=new Date(d.when||d.plannedWhen);
      const delay=Math.round((d.delay||0)/60);
      const min=Math.round((when-now)/60000);
      let tHtml;
      if(min<=0)tHtml='<span class="t-now">Jetzt</span>';
      else if(min<60){
        const cl=min<=3?'t-now':min<=9?'t-soon':'t-ok';
        const dl=delay>0?`<span class="t-d">+${delay}'</span>`:'';
        tHtml=`<span class="${cl}">${min}<small> min</small></span>${dl}`;
      }else{
        const hh=when.getHours().toString().padStart(2,'0'),mm=when.getMinutes().toString().padStart(2,'0');
        tHtml=`<span>${hh}:${mm}</span>`;
      }
      const bc=productBadge[d.line?.product]||'l-def';
      return`<tr><td><span class="lbadge ${bc}">${name}</span></td><td class="dep-dir">${dest}</td><td class="dep-plt">${plat}</td><td class="dep-t">${tHtml}</td></tr>`;
    }).join('');
    const ts=now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
    bb.innerHTML=`<div class="dep-box"><div class="dep-hd"><span class="dep-sn">${curLabel}</span><span class="dep-ts">Stand ${ts}</span></div><table class="dep-tbl"><tbody>${rows}</tbody></table></div>`;
  }catch(e){
    bb.innerHTML=`<div class="loading" style="padding:14px;color:var(--dim)">Bus/U-Bahn nicht verfügbar: ${e.message}</div>`;
  }
}

// ── BIKES ─────────────────────────────────────────────────
let leafMap=null;
let srMarks=[],dottMarks=[];
let srData=[],dottData=[];
let bikeTab='stadtrad';

function initMap(){
  if(leafMap)return;
  leafMap=L.map('bike-map').setView(HH,13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(leafMap);
}

function showBikeTab(tab){
  bikeTab=tab;
  document.getElementById('bt-stadtrad').className='chip'+(tab==='stadtrad'?' on':'');
  document.getElementById('bt-dott').className='chip'+(tab==='dott'?' on':'');
  srMarks.forEach(m=>tab==='stadtrad'?m.addTo(leafMap):leafMap.removeLayer(m));
  dottMarks.forEach(m=>tab==='dott'?m.addTo(leafMap):leafMap.removeLayer(m));
  renderBikeList(tab);
}

function renderBikeList(tab){
  const data=tab==='stadtrad'?srData:dottData;
  if(!data.length){document.getElementById('bike-list').innerHTML='<div class="loading">Lädt…</div>';return;}
  const top=[...data].sort((a,b)=>b.avail-a.avail).slice(0,14);
  const total=data.reduce((s,x)=>s+x.avail,0);
  const label=tab==='stadtrad'?`StadtRAD · ${data.length} Stationen · ${total} Räder verfügbar`:`Dott · ${data.length} Zonen`;
  document.getElementById('bike-list').innerHTML=`<div class="sbox">
    <div class="sbox-hd">${label}</div>
    ${top.map(s=>{
      const col=s.avail>5?'#1a7f37':s.avail>0?'#9a6700':'#cf222e';
      return`<div class="srow" onclick="leafMap.flyTo([${s.lat},${s.lon}],16)">
        <span class="sdot" style="background:${col}"></span>
        <span class="srow-name">${s.name}</span>
        <span class="snum" style="color:${col}">${s.avail}</span>
        <span class="sunit">${s.detail}</span>
      </div>`;
    }).join('')}
  </div>`;
}

async function loadBikes(){
  initMap();
  document.getElementById('bike-list').innerHTML='<div class="loading">Stationen werden geladen…</div>';
  await Promise.allSettled([loadStadtRAD(), loadDott()]);
  renderBikeList(bikeTab);
}

async function loadStadtRAD(){
  try{
    const[iR,sR]=await Promise.all([
      fetch('/api/stadtrad/info',{signal:AbortSignal.timeout(9000)}),
      fetch('/api/stadtrad/status',{signal:AbortSignal.timeout(9000)})
    ]);
    const{data:{stations:inf=[]}}=await iR.json();
    const{data:{stations:sta=[]}}=await sR.json();
    const iMap=Object.fromEntries(inf.map(s=>[s.station_id,s]));
    srMarks.forEach(m=>leafMap.removeLayer(m));srMarks=[];
    srData=sta.map(s=>{
      const i=iMap[s.station_id]||{};
      const avail=s.num_bikes_available||0;
      const docks=s.num_docks_available||0;
      return{...i,avail,docks,detail:`${avail} Räder · ${docks} frei`,name:i.name||s.station_id};
    }).filter(s=>s.lat&&s.lon);
    srData.forEach(s=>{
      const col=s.avail>5?'#1a7f37':s.avail>0?'#9a6700':'#cf222e';
      const r=Math.max(5,Math.min(10,4+s.avail/4));
      const m=L.circleMarker([s.lat,s.lon],{radius:r,fillColor:col,color:'#fff',weight:1.5,fillOpacity:.9});
      m.bindPopup(`<b>${s.name}</b><br>🚲 ${s.avail} verfügbar · ${s.docks} Docks frei<br><small>Kapazität: ${s.capacity||'?'}</small>`);
      srMarks.push(m);
      if(bikeTab==='stadtrad')m.addTo(leafMap);
    });
  }catch(e){console.error('stadtrad:',e);}
}

async function loadDott(){
  try{
    const[iR,sR]=await Promise.all([
      fetch('/api/bikes/info',{signal:AbortSignal.timeout(8000)}),
      fetch('/api/bikes/status',{signal:AbortSignal.timeout(8000)})
    ]);
    const{data:{stations:inf=[]}}=await iR.json();
    const{data:{stations:sta=[]}}=await sR.json();
    const iMap=Object.fromEntries(inf.map(s=>[s.station_id,s]));
    dottMarks.forEach(m=>leafMap.removeLayer(m));dottMarks=[];
    dottData=sta.map(s=>{
      const i=iMap[s.station_id]||{};
      const bikes=(s.vehicle_types_available||[]).find(v=>v.vehicle_type_id==='dott_bicycle')?.count||0;
      const scooters=(s.vehicle_types_available||[]).find(v=>v.vehicle_type_id==='dott_scooter')?.count||0;
      return{...i,avail:bikes+scooters,bikes,scooters,detail:bikes?`${bikes}🚲 ${scooters}🛴`:'Scooter',name:i.name||'Zone'};
    }).filter(s=>s.lat&&s.lon);
    dottData.forEach(s=>{
      const col=s.avail>5?'#1d4ed8':s.avail>0?'#7c3aed':'#9198a1';
      const m=L.circleMarker([s.lat,s.lon],{radius:5,fillColor:col,color:'#fff',weight:1.5,fillOpacity:.8});
      m.bindPopup(`<b>${s.name}</b><br>🚲 ${s.bikes} Bikes · 🛴 ${s.scooters} Scooter`);
      dottMarks.push(m);
      if(bikeTab==='dott')m.addTo(leafMap);
    });
  }catch(e){console.error('dott:',e);}
}

// ── PROVIDERS ─────────────────────────────────────────────
function renderProviders(){
  const cars=[
    {n:'ShareNow',sub:'BMW & Mercedes · Free-floating',url:'https://www.share-now.com/de/de/'},
    {n:'Miles',sub:'Nur Kilometerpreis · ab 0,19 €/km',url:'https://www.miles-mobility.com/'},
    {n:'Sixt Share',sub:'VW-Flotte & Transporter',url:'https://www.sixt.de/share/'},
    {n:'Cambio',sub:'Stationsbasiert · 70+ Stationen',url:'https://www.cambio-carsharing.de/hamburg'},
  ];
  document.getElementById('car-list').innerHTML=cars.map(p=>`<div class="prow">
    <div class="prow-info"><div class="prow-name">${p.n}</div><div class="prow-sub">${p.sub}</div></div>
    <a class="prow-link" href="${p.url}" target="_blank">Buchen →</a>
  </div>`).join('');
  const sc=[
    {n:'Tier',sub:'Größte E-Scooter-Flotte in Hamburg',url:'https://www.tier.app/'},
    {n:'Lime',sub:'E-Scooter & E-Bikes',url:'https://www.li.me/de-de'},
    {n:'Voi',sub:'Nachhaltige Mobilität',url:'https://www.voiscooters.com/'},
    {n:'Dott',sub:'3600+ E-Bikes & Scooter in Hamburg',url:'https://ridedott.com/'},
  ];
  document.getElementById('scooter-list').innerHTML=sc.map(p=>`<div class="prow">
    <div class="prow-info"><div class="prow-name">${p.n}</div><div class="prow-sub">${p.sub}</div></div>
    <a class="prow-link" href="${p.url}" target="_blank">App →</a>
  </div>`).join('');
}

// ── INIT ──────────────────────────────────────────────────
function refreshAll(){loadWeather();loadForecast();loadDep();loadBusDep();loadBikes();}
renderProviders();
renderGreeting();
refreshAll();
initStartMap();
setInterval(loadDep,60*1000);
setInterval(loadWeather,5*60*1000);
setInterval(loadForecast,30*60*1000);
setInterval(loadBikes,5*60*1000);
setInterval(renderGreeting,60*1000);

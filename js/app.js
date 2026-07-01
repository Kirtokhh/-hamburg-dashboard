// ── PREFS ─────────────────────────────────────────────────
const DP={wantBike:true,hasCar:true,hasScooter:true,tMin:8,tMax:34,wMax:25,rainOk:false};
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
  if(id==='events')renderInfoCards();
}

// ── WEATHER ───────────────────────────────────────────────
const OWM='e753f02c4f2f0f94cf78f4907344dca5',HH=[53.5753,10.0153];
let wxState=null,wxStatus='init',fcData=[];
// wxStatus: 'init' → nie geladen  |  'loading'  |  'ok'  |  'error' (nie erfolgreich)

function wxIcon(id){
  if(id<300)return'⛈';if(id<400)return'🌦';
  if(id<600)return'🌧';if(id<700)return'❄';
  if(id<800)return'🌫';if(id===800)return'☀';
  if(id===801)return'🌤';return'☁';
}

async function loadWeather(){
  const firstLoad=wxStatus==='init';
  wxStatus='loading';
  try{
    const r=await fetch(`/api/weather?lat=${HH[0]}&lon=${HH[1]}&appid=${OWM}&units=metric&lang=de`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const wx=await r.json();
    wxState={t:Math.round(wx.main.temp),w:Math.round(wx.wind.speed*3.6),h:wx.main.humidity,id:wx.weather[0].id,desc:wx.weather[0].description};
    wxStatus='ok';
    document.getElementById('wx-pill').innerHTML=`${wxIcon(wxState.id)} <b>${wxState.t}°C</b> &middot; ${wxState.w} km/h`;
    renderRec();
    renderGreeting();
    renderInfoCards();
  }catch(e){
    console.error('weather',e);
    if(firstLoad){
      // Erster Load fehlgeschlagen — wxState bleibt null, Fehlerzustand überall
      wxStatus='error';
      document.getElementById('wx-pill').textContent='Wetter nicht verfügbar';
      renderRec(); // zeigt Fehler im rec-card, nicht "Lädt…"
    }else{
      // Refresh fehlgeschlagen — alte Daten behalten, kleines Warnsignal im Header
      wxStatus='ok'; // wxState ist noch gültig
      document.getElementById('wx-pill').innerHTML=
        `${wxIcon(wxState.id)} <b>${wxState.t}°C</b> &middot; ${wxState.w} km/h <span title="Daten veraltet" style="opacity:.5;font-size:11px">⚠</span>`;
    }
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
  document.getElementById('greeting-sub').textContent=`${ds} · Hamburg`;
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

function setRouteModeFromOpt(mode){
  routeMode=mode;
  document.querySelectorAll('#route-tabs .chip').forEach(c=>c.classList.remove('on'));
  const modeIdx={transit:0,bike:1,car:2};
  const chips=document.querySelectorAll('#route-tabs .chip');
  if(modeIdx[mode]!==undefined)chips[modeIdx[mode]]?.classList.add('on');
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

let destState=null;

function updateTimeLbl(){
  const v=document.getElementById('dep-time').value;
  document.getElementById('time-now-lbl').style.display=v?'none':'';
}

function getModeReason(t,w,id,p,dist){
  const rain=id>=300&&id<700,heavy=id>=500&&id<600,thunder=id<300,snow=id>=600&&id<700;
  const mode=getMode(t,w,id,p,dist);
  if(mode==='storm')return'Gewitter — ÖPNV am sichersten';
  if(mode==='walk')return`Kurze Strecke${dist!==null?' ('+fmtDist(dist)+')':''}`;
  if(mode==='bike'){
    if(t>=16&&t<=26&&w<=14&&!rain)return'Perfektes Radwetter';
    const r=[];
    if(!rain)r.push('Kein Regen');
    if(w<=14)r.push('Wenig Wind');
    if(t>=12&&t<=28)r.push(`${t}°C`);
    return r.join(' · ')||'Gutes Radwetter';
  }
  if(mode==='scooter')return'Kein Starkregen · kurze Strecke';
  if(mode==='car')return w>30?`Starker Wind (${w} km/h)`:dist!==null&&dist>30?`Weite Strecke (${fmtDist(dist)})`:'Weite Strecke';
  // transit reasons
  if(thunder)return'Gewitter';
  if(snow)return'Schnee';
  if(heavy)return'Starkregen';
  if(rain&&!p.rainOk)return'Regen';
  if(t<p.tMin)return`Zu kalt (${t}°C)`;
  if(t>p.tMax)return`Zu heiß (${t}°C)`;
  if(w>p.wMax)return`Zu viel Wind (${w} km/h)`;
  return'ÖPNV empfohlen';
}

function renderRec(){
  if(!wxState){
    if(wxStatus==='error'){
      document.getElementById('rec-card').className='rec-card transit';
      document.getElementById('rec-mode').textContent='—';
      document.getElementById('rec-title').textContent='Wetter nicht verfügbar';
      document.getElementById('rec-detail').textContent='Verbindung prüfen oder Seite neu laden (↻).';
      document.getElementById('rec-tags').innerHTML='<span class="rtag bad">Kein Signal</span>';
      document.getElementById('rec-dist').style.display='none';
    }
    return;
  }
  const{t,w,id,desc,h}=wxState,p=lP();

  if(!destState){
    // Neutraler Wetterkontext — kein Befehl, nur Information
    document.getElementById('rec-card').className='rec-card neutral';
    document.getElementById('rec-mode').textContent='Wetter Hamburg';
    document.getElementById('rec-title').textContent=`${t}°C · ${desc.charAt(0).toUpperCase()+desc.slice(1)}`;
    document.getElementById('rec-detail').textContent=`Wind ${w} km/h · Luftfeuchtigkeit ${h}%`;
    document.getElementById('rec-dist').style.display='none';
    const tags=[];
    if(id<300)tags.push({t:'Gewitter',c:'bad'});
    else if(id>=500&&id<600)tags.push({t:'Starkregen',c:'bad'});
    else if(id>=300&&id<600)tags.push({t:'Regen',c:'warn'});
    else if(id>=600&&id<700)tags.push({t:'Schnee',c:'warn'});
    else if(id===800)tags.push({t:'Sonnig',c:'ok'});
    else if(id<=801)tags.push({t:'Leicht bewölkt',c:'ok'});
    else tags.push({t:'Bewölkt',c:'warn'});
    if(w>40)tags.push({t:`Sturm ${w} km/h`,c:'bad'});
    else if(w>25)tags.push({t:`Wind ${w} km/h`,c:'warn'});
    else tags.push({t:'Ruhiger Wind',c:'ok'});
    if(t>=16&&t<=26)tags.push({t:`${t}°C angenehm`,c:'ok'});
    else if(t<6)tags.push({t:`Kalt ${t}°C`,c:'bad'});
    else if(t<10)tags.push({t:`Kühl ${t}°C`,c:'warn'});
    else if(t>32)tags.push({t:`Sehr heiß ${t}°C`,c:'bad'});
    else if(t>28)tags.push({t:`Heiß ${t}°C`,c:'warn'});
    document.getElementById('rec-tags').innerHTML=tags.map(x=>`<span class="rtag ${x.c}">${x.t}</span>`).join('');
    renderForecast(p);
    return;
  }

  // Mit Ziel — zeigt Empfehlung als Antwort auf die Suchanfrage
  const dist=destState.dist;
  const mode=getMode(t,w,id,p,dist),m=MODES[mode];
  const reason=getModeReason(t,w,id,p,dist);
  document.getElementById('rec-card').className='rec-card '+m.cls;
  document.getElementById('rec-mode').textContent='Heute empfohlen';
  document.getElementById('rec-title').textContent=`${m.label} → ${destState.name}`;
  document.getElementById('rec-detail').textContent=`${reason} · ${t}°C · Wind ${w} km/h`;
  const distEl=document.getElementById('rec-dist');
  distEl.style.display='';
  distEl.textContent=fmtDist(dist)+' Luftlinie';
  const tags=[];
  if(id<300)tags.push({t:'Gewitter',c:'bad'});
  else if(id>=300&&id<600)tags.push({t:'Regen',c:'warn'});
  else tags.push({t:'Kein Regen',c:'ok'});
  if(w<=14)tags.push({t:'Wenig Wind',c:'ok'});
  else if(w>p.wMax&&p.wantBike)tags.push({t:`Wind ${w} km/h`,c:'bad'});
  else if(w>25)tags.push({t:`Wind ${w} km/h`,c:'warn'});
  if(!p.wantBike)tags.push({t:'Fahrrad aus',c:'warn'});
  document.getElementById('rec-tags').innerHTML=tags.map(x=>`<span class="rtag ${x.c}">${x.t}</span>`).join('');
  renderForecast(p);
}

// ── EVENTS CARD ───────────────────────────────────────────
function renderInfoCards(){
  const ec=document.getElementById('events-card');
  if(wxState){
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
    const weatherId=isToday&&wxState?wxState.id:fc.weatherId;
    const mode=getMode(Math.round((fc.tMin+fc.tMax)/2),fc.wAvg,weatherId,p,null);
    return`<div class="fc-day${isToday?' today':''}">
      <div class="fc-wd">${isToday?'Heute':wd}</div>
      <div class="fc-wx">${wxIcon(weatherId)}</div>
      <div class="fc-temp">${fc.tMax}°<small>/${fc.tMin}°</small></div>
      <div class="fc-wind">${fc.wAvg}km/h</div>
      <div class="fc-tip" title="${MODES[mode].title}">${mIco[mode]}</div>
    </div>`;
  }).join('');
}

// ── DESTINATION & MODE OPTIONS ────────────────────────────
const geoCache={};
const HH_BBOX='9.5,54.0,10.5,53.3'; // Nominatim viewbox — Hamburg + Umland

function haversine(la1,lo1,la2,lo2){
  const R=6371,d=v=>v*Math.PI/180;
  const a=Math.sin(d(la2-la1)/2)**2+Math.cos(d(la1))*Math.cos(d(la2))*Math.sin(d(lo2-lo1)/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmtDist(km){return km<1?Math.round(km*1e3)+' m':km.toFixed(1)+' km'}

// ── GEOCODING AUTOCOMPLETE ────────────────────────────────
let suggestTimeout=null,suggestResults=[],activeSug=-1;

function onDestInput(){
  clearTimeout(suggestTimeout);
  const q=document.getElementById('dest-in').value.trim();
  if(q.length<2){hideSuggestions();return;}
  suggestTimeout=setTimeout(()=>fetchSuggestions(q),280);
}

function onDestKey(e){
  const el=document.getElementById('geo-suggestions');
  if(el.style.display==='none'){if(e.key==='Enter')calcRoute();return;}
  const items=el.querySelectorAll('.geo-sug');
  if(e.key==='ArrowDown'){e.preventDefault();activeSug=Math.min(activeSug+1,items.length-1);highlightSug(items);}
  else if(e.key==='ArrowUp'){e.preventDefault();activeSug=Math.max(activeSug-1,0);highlightSug(items);}
  else if(e.key==='Enter'){e.preventDefault();activeSug>=0?selectSuggestion(activeSug):calcRoute();}
  else if(e.key==='Escape'){hideSuggestions();}
}

function highlightSug(items){items.forEach((el,i)=>el.classList.toggle('active',i===activeSug));}

async function fetchSuggestions(q){
  try{
    const params=new URLSearchParams({q,format:'json',limit:5,countrycodes:'de',
      viewbox:HH_BBOX,addressdetails:1,dedupe:1});
    const r=await fetch(`/api/geocode?${params}`,{signal:AbortSignal.timeout(5000)});
    const d=await r.json();
    suggestResults=Array.isArray(d)?d:[];
    activeSug=-1;
    const el=document.getElementById('geo-suggestions');
    if(!suggestResults.length){hideSuggestions();return;}
    el.innerHTML=suggestResults.map((res,i)=>{
      const parts=res.display_name.split(',').map(s=>s.trim());
      const name=parts.slice(0,2).join(', ');
      const sub=parts.slice(2,4).filter(Boolean).join(', ');
      return`<div class="geo-sug" onclick="selectSuggestion(${i})">
        <div class="geo-sug-name">${name}</div>
        ${sub?`<div class="geo-sug-sub">${sub}</div>`:''}
      </div>`;
    }).join('');
    el.style.display='';
  }catch(e){hideSuggestions();}
}

function hideSuggestions(){
  document.getElementById('geo-suggestions').style.display='none';
  suggestResults=[];activeSug=-1;
}

function selectSuggestion(idx){
  const res=suggestResults[idx];
  if(!res)return;
  const parts=res.display_name.split(',').map(s=>s.trim());
  const name=parts.slice(0,2).join(', ');
  document.getElementById('dest-in').value=name;
  hideSuggestions();
  const[lat1,lon1]=userPos?[userPos.lat,userPos.lon]:HH;
  destState={name,lat:+res.lat,lon:+res.lon,dist:haversine(lat1,lon1,+res.lat,+res.lon)};
  geoCache[name]=res;
  document.getElementById('gmaps-link').href=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}&travelmode=transit`;
  renderRec();
  updateStartMap();
  calcAllOptions();
}

// ── SHARING INTEGRATION ───────────────────────────────────
function findNearestSharing(data,lat,lon){
  if(!data?.length)return null;
  const avail=data.filter(s=>s.avail>0&&s.lat&&s.lon);
  if(!avail.length)return null;
  return avail.reduce((best,s)=>{
    const d=haversine(lat,lon,s.lat,s.lon);
    return(!best||d<best.walkDist)?{...s,walkDist:d}:best;
  },null);
}

async function fetchOsrmDuration(profile,lat1,lon1,lat2,lon2){
  const r=await fetch(
    `https://router.project-osrm.org/route/v1/${profile}/${lon1},${lat1};${lon2},${lat2}?overview=false`,
    {signal:AbortSignal.timeout(9000)}
  );
  if(!r.ok)throw new Error('HTTP '+r.status);
  const d=await r.json();
  if(d.code!=='Ok'||!d.routes?.length)throw new Error('Keine Route');
  return{distM:d.routes[0].distance,durS:d.routes[0].duration};
}

async function fetchTransitDuration(lat1,lon1,lat2,lon2,depTimeISO){
  const[fromR,toR]=await Promise.all([
    fetch(`https://v5.db.transport.rest/stops/nearby?latitude=${lat1}&longitude=${lon1}&results=1`,{signal:AbortSignal.timeout(7000)}),
    fetch(`https://v5.db.transport.rest/stops/nearby?latitude=${lat2}&longitude=${lon2}&results=1`,{signal:AbortSignal.timeout(7000)})
  ]);
  const[fromArr,toArr]=await Promise.all([fromR.json(),toR.json()]);
  if(!fromArr?.length||!toArr?.length)throw new Error('Keine Haltestellen');
  const isArr=document.getElementById('time-dir')?.value==='arr';
  const params=new URLSearchParams({from:fromArr[0].id,to:toArr[0].id,results:1,stopovers:false});
  if(depTimeISO)params.set(isArr?'arrival':'departure',depTimeISO);
  const jR=await fetch(`https://v5.db.transport.rest/journeys?${params}`,{signal:AbortSignal.timeout(12000)});
  if(!jR.ok)throw new Error('HTTP '+jR.status);
  const jD=await jR.json();
  if(!jD.journeys?.length)throw new Error('Keine Verbindung');
  const j=jD.journeys[0];
  const dep=new Date(j.legs[0].departure);
  const arr=new Date(j.legs[j.legs.length-1].arrival);
  const durMin=Math.round((arr-dep)/60000);
  const changes=Math.max(0,j.legs.filter(l=>!l.walking).length-1);
  const depStr=dep.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  return{durMin,changes,depStr};
}

function renderModeOptions(data,dist,p){
  const el=document.getElementById('mode-options');
  if(!wxState||!destState){el.style.display='none';return;}

  const recommended=getMode(wxState.t,wxState.w,wxState.id,p,dist);
  const fmtMin=m=>m<60?`${m} min`:`${Math.floor(m/60)}h ${m%60}min`;
  const fmtKm=m=>m<1000?`${Math.round(m)} m`:`${(m/1000).toFixed(1)} km`;
  const opts=[];

  // Zu Fuß — OSRM foot-Profil wenn verfügbar, sonst Schätzung
  if(data.walk){
    const{durMin,distM,real}=data.walk;
    opts.push({mode:'walk',label:'Zu Fuß',
      dur:fmtMin(durMin),
      sub:(distM?fmtKm(distM):fmtDist(dist))+(real?'':' · ~'),
      est:!real});
  }

  // Fahrrad — OSRM cycling, echte Route + nächste StadtRAD-Station als Hinweis
  const[lat1b,lon1b]=userPos?[userPos.lat,userPos.lon]:HH;
  if(p.wantBike&&dist<=25){
    if(data.bike){
      const durMin=Math.round(data.bike.durS/60);
      let sub=fmtKm(data.bike.distM);
      const sr=findNearestSharing(srData,lat1b,lon1b);
      if(sr)sub+=` · StadtRAD ${sr.name.replace(/^(StadtRAD\s|Hamburg[\s-]+)/i,'').substring(0,18)} (${fmtDist(sr.walkDist)})`;
      opts.push({mode:'bike',label:'Fahrrad',dur:fmtMin(durMin),sub,est:false});
    }else{
      opts.push({mode:'bike',label:'Fahrrad',dur:'—',sub:'Route nicht verfügbar',est:false});
    }
  }

  // E-Scooter — Cycling-Route @ 20 km/h, explizit als Schätzung markiert
  // Wird ausgeblendet wenn Fahrrad fast gleiche Zeit hätte (Plausibilitätsprüfung)
  if(data.scooter){
    const{durMin,distM}=data.scooter;
    let sub=(distM?fmtKm(distM):fmtDist(dist))+' · ~20 km/h';
    const dott=findNearestSharing(dottData,lat1b,lon1b);
    if(dott)sub+=` · Dott (${fmtDist(dott.walkDist)})`;
    opts.push({mode:'scooter',label:'E-Scooter',dur:fmtMin(durMin),sub,est:true});
  }

  // ÖPNV — DB HAFAS (deckt HVV-Linien in Hamburg ab, echte Abfahrtszeiten)
  const isArr=document.getElementById('time-dir')?.value==='arr';
  if(data.transit){
    const{durMin,changes,depStr}=data.transit;
    const changeTxt=changes>0?` · ${changes}×`:' · direkt';
    const timeTxt=depStr?(isArr?`an ${depStr}`:`ab ${depStr}`):'Jetzt';
    opts.push({mode:'transit',label:'S-Bahn / ÖPNV',dur:fmtMin(durMin),sub:timeTxt+changeTxt,est:false});
  }else{
    opts.push({mode:'transit',label:'S-Bahn / ÖPNV',dur:'—',sub:'via HVV öffnen',est:false});
  }

  // Carsharing — OSRM driving, echte Route
  if(data.car&&p.hasCar){
    opts.push({mode:'car',label:'Carsharing',dur:fmtMin(Math.round(data.car.durS/60)),sub:fmtKm(data.car.distM),est:false});
  }

  opts.sort((a,b)=>(b.mode===recommended?1:0)-(a.mode===recommended?1:0));

  const modeCol={walk:'var(--muted)',bike:'var(--green)',scooter:'#7c3aed',transit:'var(--blue)',car:'var(--amber)',storm:'var(--red)'};
  const reason=getModeReason(wxState.t,wxState.w,wxState.id,p,dist);
  const timeDir=isArr?'Ankunft':'Abfahrt';
  const timeVal=document.getElementById('dep-time').value;
  const timeLbl=timeVal?` · ${timeDir} ${timeVal}`:'';

  el.innerHTML=`<div class="sbox">
    <div class="sbox-hd" style="display:flex;flex-direction:column;gap:2px">
      <span>Reisezeiten → ${destState.name}${timeLbl}</span>
      <span style="font-size:11px;color:var(--muted);font-weight:400">${reason}</span>
    </div>
    ${opts.map(o=>{
      const isRec=o.mode===recommended;
      const col=modeCol[o.mode]||'var(--muted)';
      const mapMode=o.mode==='walk'?'transit':o.mode==='scooter'?'bike':o.mode;
      return`<div class="srow${isRec?' opt-rec':''}"
        style="${isRec?`border-left:3px solid ${col};background:var(--bg);padding-left:9px`:'padding-left:12px'}"
        onclick="setRouteModeFromOpt('${mapMode}')">
        <span class="sdot" style="background:${col};flex-shrink:0"></span>
        <span class="srow-name" style="min-width:110px">${o.label}</span>
        <span style="font-size:13px;font-weight:${isRec?700:400};white-space:nowrap">${o.dur}</span>
        <span style="font-size:11px;color:var(--dim);margin-left:8px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.sub}</span>
        ${isRec?`<span class="rtag ok" style="flex-shrink:0">Empfohlen</span>`:''}
        ${o.est&&!isRec?`<span style="font-size:11px;color:var(--dim);flex-shrink:0">~</span>`:''}
      </div>`;
    }).join('')}
  </div>`;
}

async function calcAllOptions(){
  if(!destState){document.getElementById('mode-options').style.display='none';return;}
  const[lat1,lon1]=userPos?[userPos.lat,userPos.lon]:HH;
  const{lat:lat2,lon:lon2,dist}=destState;
  const p=lP();

  const timeVal=document.getElementById('dep-time').value;
  let depTimeISO=null;
  if(timeVal){
    const[hh,mm]=timeVal.split(':').map(Number);
    const dt=new Date();dt.setHours(hh,mm,0,0);
    if(dt<new Date())dt.setDate(dt.getDate()+1);
    depTimeISO=dt.toISOString();
  }

  const el=document.getElementById('mode-options');
  el.style.display='';
  el.innerHTML='<div class="loading" style="padding:14px;text-align:center">Verbindungen werden berechnet…</div>';

  const[bikeRes,carRes,transitRes,walkRes]=await Promise.allSettled([
    (p.wantBike&&dist<=25)?fetchOsrmDuration('cycling',lat1,lon1,lat2,lon2):Promise.reject('skip'),
    p.hasCar?fetchOsrmDuration('driving',lat1,lon1,lat2,lon2):Promise.reject('skip'),
    fetchTransitDuration(lat1,lon1,lat2,lon2,depTimeISO),
    dist<=4?fetchOsrmDuration('foot',lat1,lon1,lat2,lon2):Promise.reject('skip'),
  ]);

  // Zu Fuß: echtes OSRM foot-Profil, Fallback Haversine / 5 km/h
  let walkData=null;
  if(walkRes.status==='fulfilled'){
    walkData={durMin:Math.round(walkRes.value.durS/60),distM:walkRes.value.distM,real:true};
  }else if(dist<=4){
    walkData={durMin:Math.round(dist/5*60),distM:null,real:false};
  }

  // E-Scooter: Cycling-Route @ explizit 20 km/h (kein 0.68-Faktor)
  // Plausibilitätsprüfung: überspringen wenn Fahrrad-Zeit fast identisch (≤3 min Unterschied)
  let scooterData=null;
  if(p.hasScooter&&dist<=12){
    const bikeDistM=bikeRes.status==='fulfilled'?bikeRes.value.distM:null;
    const distKm=(bikeDistM??dist*1000)/1000;
    const scooterMin=Math.round(distKm/20*60);
    const bikeMin=bikeRes.status==='fulfilled'?Math.round(bikeRes.value.durS/60):null;
    const tooSimilar=p.wantBike&&bikeMin!==null&&Math.abs(bikeMin-scooterMin)<=3;
    if(!tooSimilar){
      scooterData={durMin:scooterMin,distM:bikeDistM,real:!!bikeDistM};
    }
  }

  renderModeOptions({
    bike:bikeRes.status==='fulfilled'?bikeRes.value:null,
    car:carRes.status==='fulfilled'?carRes.value:null,
    transit:transitRes.status==='fulfilled'?transitRes.value:null,
    walk:walkData,
    scooter:scooterData,
  },dist,p);
}

async function calcRoute(){
  const q=document.getElementById('dest-in').value.trim();
  hideSuggestions();
  if(!q){
    destState=null;
    document.getElementById('mode-options').style.display='none';
    renderRec();
    updateStartMap();
    return;
  }
  try{
    let geo=geoCache[q];
    if(!geo){
      const params=new URLSearchParams({q,format:'json',limit:1,countrycodes:'de',
        viewbox:HH_BBOX,addressdetails:1});
      const r=await fetch(`/api/geocode?${params}`,{signal:AbortSignal.timeout(6000)});
      const d=await r.json();
      if(!d||!d[0])throw new Error('Ort nicht gefunden');
      geo=d[0];geoCache[q]=geo;
    }
    const[lat1,lon1]=userPos?[userPos.lat,userPos.lon]:HH;
    destState={name:q,lat:+geo.lat,lon:+geo.lon,dist:haversine(lat1,lon1,+geo.lat,+geo.lon)};
    document.getElementById('gmaps-link').href=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=transit`;
    renderRec();
    updateStartMap();
    calcAllOptions();
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
    const localDeps=deps.slice(0,14);
    const now=new Date();
    const rows=localDeps.map(d=>{
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

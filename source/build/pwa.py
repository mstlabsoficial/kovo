import os,json,shutil
D='/private/tmp/claude-501/sesiona/'
OUTDIR=os.path.join(os.getcwd(),'kovo-app')
os.makedirs(OUTDIR,exist_ok=True)
t=open('/Users/tmesa/Downloads/Sesiona.html',encoding='utf-8').read()
head='''<title>KOVO</title>
<meta name="description" content="KOVO · gestión para consultas de psicología">
<meta name="theme-color" content="#0A0C0B">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="KOVO">
</head>'''
assert t.count('</head>')==1
t=t.replace('</head>',head,1)
assert t.count('<title>KOVO</title>')==2
t=t.replace('<body>\n<title>KOVO</title>','<body>\n',1) if '<body>\n<title>KOVO</title>' in t else t
t=t.replace('</script>\n\n</body>','</script>\n<script>if(\'serviceWorker\' in navigator&&location.protocol===\'https:\')navigator.serviceWorker.register(\'sw.js\').catch(()=>{});</script>\n\n</body>',1)
assert "serviceWorker" in t
open(os.path.join(OUTDIR,'index.html'),'w',encoding='utf-8').write(t)
man={"name":"KOVO","short_name":"KOVO","description":"Gestión para consultas de psicología","start_url":"./","scope":"./","display":"standalone","orientation":"portrait","background_color":"#0A0C0B","theme_color":"#0A0C0B","lang":"es",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png","purpose":"any maskable"},{"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}]}
open(os.path.join(OUTDIR,'manifest.webmanifest'),'w',encoding='utf-8').write(json.dumps(man,ensure_ascii=False,indent=2))
open(os.path.join(OUTDIR,'sw.js'),'w',encoding='utf-8').write('''const C='kovo-v1';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r})
    .catch(()=>caches.match(e.request).then(m=>m||caches.match('./index.html'))));
});
''')
shutil.copy(D+'icon512.svg.png',os.path.join(OUTDIR,'icon-512.png'))
shutil.copy(D+'icon192.svg.png',os.path.join(OUTDIR,'icon-192.png'))
shutil.copy(D+'icon180.svg.png',os.path.join(OUTDIR,'apple-touch-icon.png'))
open(os.path.join(OUTDIR,'LEEME.txt'),'w',encoding='utf-8').write('''KOVO · app instalable (prototipo con datos ficticios)

Esta carpeta es la app completa. Para tenerla en el móvil como una app:

1. Súbela a un alojamiento web con https (por ejemplo Netlify: entra en app.netlify.com/drop
   y arrastra esta carpeta entera). Te dará una dirección tipo https://kovo-xxxx.netlify.app
2. Abre esa dirección en el móvil:
   - iPhone (Safari): botón Compartir > "Añadir a pantalla de inicio".
   - Android (Chrome): menú ⋮ > "Instalar aplicación" o "Añadir a pantalla de inicio".
3. Aparecerá el icono de KOVO y se abrirá a pantalla completa, también sin conexión.

Los datos se guardan en cada dispositivo (no se sincronizan entre móvil y ordenador).
No uses datos reales de pacientes: para eso hace falta un servidor seguro y cumplir el RGPD.
''')
print(OUTDIR, sorted(os.listdir(OUTDIR)))

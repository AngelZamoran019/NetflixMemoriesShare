const HTML_PREFIX = "html/";
const MAX_HTML_BYTES = 10 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function page(html) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function validId(id) {
  return /^[A-Za-z0-9_-]{8,80}$/.test(id);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function adminPage() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Creador De Recuerdos — Publicador</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#080808;color:#fff;font-family:Arial,sans-serif;padding:24px}
.wrap{width:min(760px,100%);margin:0 auto}
.card{background:#151515;border:1px solid #2b2b2b;border-radius:18px;padding:28px;box-shadow:0 20px 70px #0008}
h1{margin:0 0 8px;font-size:28px}
h2{margin:0;font-size:20px}
p{color:#aaa;line-height:1.5}
.drop{display:block;border:1px dashed #555;border-radius:14px;padding:28px;text-align:center;margin:22px 0;background:#101010;cursor:pointer}
.drop input{width:100%;margin-top:14px}
button{width:100%;padding:14px;border:0;border-radius:10px;background:#fff;color:#000;font-weight:800;cursor:pointer}
button:disabled{opacity:.5;cursor:wait}
.result{display:none;margin-top:22px;padding:16px;border-radius:12px;background:#0d2516;border:1px solid #245d35}
.result a{display:block;color:#8cffaa;overflow-wrap:anywhere;margin-top:8px}
.error{display:none;color:#ff8f8f;margin-top:14px}
.history{margin-top:24px}
.history-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.refresh{width:auto;padding:9px 13px;background:#292929;color:#fff;font-size:12px}
.history-list{display:grid;gap:10px}
.history-item{background:#101010;border:1px solid #292929;border-radius:12px;padding:14px}
.history-name{font-weight:700;overflow-wrap:anywhere}
.history-date{font-size:12px;color:#777;margin-top:5px}
.history-links{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.history-links a{display:block;text-align:center;padding:9px;border-radius:8px;background:#202020;color:#fff;text-decoration:none;font-size:12px}
.empty,.loading{color:#777;font-size:14px;padding:12px 0}
@media(max-width:560px){.history-links{grid-template-columns:1fr}.card{padding:20px}}
</style>
</head>
<body>
<div class="wrap">
<main class="card">
<h1>Creador De Recuerdos</h1>
<p>Publicador de experiencias HTML. Selecciona el HTML exportado para generar automáticamente una vista previa con marca de agua y una vista final limpia.</p>
<form id="form">
<label class="drop">Selecciona tu archivo HTML<input id="file" type="file" accept=".html,.htm,text/html" required></label>
<button id="button" type="submit">PUBLICAR HTML</button>
</form>
<div id="error" class="error"></div>
<section id="result" class="result">
<strong>Publicado correctamente.</strong>
<div>Demo con marca de agua:</div><a id="demo" target="_blank" rel="noopener"></a>
<div style="margin-top:12px">Vista final:</div><a id="view" target="_blank" rel="noopener"></a>
</section>
</main>
<section class="card history">
<div class="history-head"><h2>Historial de proyectos publicados</h2><button id="refresh" class="refresh" type="button">ACTUALIZAR</button></div>
<div id="historyList" class="history-list"><div class="loading">Cargando historial...</div></div>
</section>
</div>
<script>
const form=document.getElementById('form');
const button=document.getElementById('button');
const error=document.getElementById('error');
const result=document.getElementById('result');
const historyList=document.getElementById('historyList');
const refresh=document.getElementById('refresh');
function escapeText(value){return String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));}
async function loadHistory(){
 historyList.innerHTML='<div class="loading">Cargando historial...</div>';
 try{
  const r=await fetch('/api/history',{cache:'no-store'});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(body.error||'No fue posible cargar el historial.');
  if(!body.projects?.length){historyList.innerHTML='<div class="empty">Todavía no hay proyectos publicados.</div>';return;}
  historyList.innerHTML=body.projects.map(project=>{
   const name=escapeText(project.name||'Proyecto HTML');
   const date=project.createdAt?new Date(project.createdAt).toLocaleString('es-MX'):'Fecha no disponible';
   const demo=escapeText(project.demo); const view=escapeText(project.view);
   return '<article class="history-item">' + '<div class="history-name">' + name + '</div>' + '<div class="history-date">Publicado: ' + escapeText(date) + '</div>' + '<div class="history-links">' + '<a href="' + demo + '" target="_blank" rel="noopener">VER DEMO</a>' + '<a href="' + view + '" target="_blank" rel="noopener">VER FINAL</a>' + '</div></article>';
  }).join('');
 }catch(err){historyList.innerHTML='<div class="empty">'+escapeText(err.message)+'</div>';}
}
form.addEventListener('submit',async(e)=>{
 e.preventDefault(); error.style.display='none'; result.style.display='none';
 const file=document.getElementById('file').files[0]; if(!file)return;
 button.disabled=true; button.textContent='PUBLICANDO...';
 try{
  const data=new FormData(); data.append('html',file);
  const r=await fetch('/api/upload',{method:'POST',body:data});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(body.error||'No fue posible publicar el HTML.');
  document.getElementById('demo').href=body.demo; document.getElementById('demo').textContent=body.demo;
  document.getElementById('view').href=body.view; document.getElementById('view').textContent=body.view;
  result.style.display='block'; form.reset(); loadHistory();
 }catch(err){error.textContent=err.message; error.style.display='block'}finally{button.disabled=false;button.textContent='PUBLICAR HTML'}
});
refresh.addEventListener('click',loadHistory); loadHistory();
</script>
</body></html>`;
}

function addWatermark(html) {
  const watermark = `
<style id="recuerdos-watermark-style">
.recuerdos-watermark-layer{position:fixed;inset:-25%;width:150%;height:150%;z-index:2147483647;pointer-events:none;overflow:hidden;display:grid;grid-template-columns:repeat(15,1fr);grid-template-rows:repeat(24,1fr);align-items:center;justify-items:center;transform:rotate(-24deg);transform-origin:center center}
.recuerdos-watermark-layer span{font:700 10px/1 Arial,sans-serif;letter-spacing:.04em;color:rgba(255,255,255,.18);white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.2)}
@media(min-width:700px){.recuerdos-watermark-layer span{font-size:12px}}
</style>
<div class="recuerdos-watermark-layer" aria-hidden="true">${Array.from({length:360},()=>'<span>Dangels Print Studio</span>').join('')}</div>`;
  if (/<\/body\s*>/i.test(html)) return html.replace(/<\/body\s*>/i, `${watermark}</body>`);
  return `${html}${watermark}`;
}

async function upload(request, env) {
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  if (!env.RECUERDOS) return json({ error: "El almacenamiento todavía no está configurado." }, 503);
  const form = await request.formData();
  const file = form.get("html");
  if (!(file instanceof File)) return json({ error: "Debes seleccionar un archivo HTML." }, 400);
  if (!/\.html?$/i.test(file.name)) return json({ error: "Solo se permiten archivos .html o .htm." }, 400);
  if (file.size > MAX_HTML_BYTES) return json({ error: "El HTML supera el límite de 10 MB." }, 413);
  const html = await file.text();
  if (!html.trim()) return json({ error: "El archivo HTML está vacío." }, 400);
  const id = crypto.randomUUID().replaceAll("-", "");
  await env.RECUERDOS.put(`${HTML_PREFIX}${id}.html`, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8", cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { originalName: file.name, createdAt: new Date().toISOString() },
  });
  const base = new URL(request.url).origin;
  return json({ id, demo: `${base}/demo/${id}`, view: `${base}/view/${id}` }, 201);
}

async function history(request, env) {
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  if (!env.RECUERDOS) return json({ error: "El almacenamiento todavía no está configurado." }, 503);
  const listed = await env.RECUERDOS.list({ prefix: HTML_PREFIX, limit: 1000, include: ["customMetadata"] });
  const base = new URL(request.url).origin;
  const projects = listed.objects.map(object => {
    const id = object.key.slice(HTML_PREFIX.length).replace(/\.html$/i, "");
    return { id, name: object.customMetadata?.originalName || "Proyecto HTML", createdAt: object.customMetadata?.createdAt || object.uploaded?.toISOString?.() || null, demo: `${base}/demo/${id}`, view: `${base}/view/${id}` };
  }).filter(project => validId(project.id)).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return json({ projects, truncated: listed.truncated });
}

async function serveMemory(mode, id, env) {
  if (!validId(id)) return new Response("Recuerdo no encontrado.", { status: 404 });
  const object = await env.RECUERDOS.get(`${HTML_PREFIX}${id}.html`);
  if (!object) return new Response("Recuerdo no encontrado.", { status: 404 });
  const html = await object.text();
  const output = mode === "demo" ? addWatermark(html) : html;
  return new Response(output, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" && request.method === "GET") return page(adminPage());
    if (path === "/api/upload") return upload(request, env);
    if (path === "/api/history" && request.method === "GET") return history(request, env);
    const match = path.match(/^\/(demo|view)\/([^/]+)$/);
    if (match && request.method === "GET") return serveMemory(match[1], match[2], env);
    return new Response("Ruta no encontrada.", { status: 404 });
  },
};

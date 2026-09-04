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

function page(html, status = 200) {
  return new Response(html, {
    status,
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
body{margin:0;min-height:100vh;background:#080808;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
.card{width:min(560px,100%);background:#151515;border:1px solid #2b2b2b;border-radius:18px;padding:28px;box-shadow:0 20px 70px #0008}
h1{margin:0 0 8px;font-size:28px}
p{color:#aaa;line-height:1.5}
.drop{display:block;border:1px dashed #555;border-radius:14px;padding:28px;text-align:center;margin:22px 0;background:#101010;cursor:pointer}
.drop input{width:100%;margin-top:14px}
button{width:100%;padding:14px;border:0;border-radius:10px;background:#fff;color:#000;font-weight:800;cursor:pointer}
button:disabled{opacity:.5;cursor:wait}
.result{display:none;margin-top:22px;padding:16px;border-radius:12px;background:#0d2516;border:1px solid #245d35}
.result a{display:block;color:#8cffaa;overflow-wrap:anywhere;margin-top:8px}
.error{display:none;color:#ff8f8f;margin-top:14px}
.small{font-size:12px;color:#777}
</style>
</head>
<body>
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
<p class="small">La publicación es directa por ahora. Más adelante podemos agregar una capa de protección.</p>
</main>
<script>
const form=document.getElementById('form');
const button=document.getElementById('button');
const error=document.getElementById('error');
const result=document.getElementById('result');
form.addEventListener('submit',async(e)=>{
 e.preventDefault(); error.style.display='none'; result.style.display='none';
 const file=document.getElementById('file').files[0];
 if(!file){return}
 button.disabled=true; button.textContent='PUBLICANDO...';
 try{
  const data=new FormData(); data.append('html',file);
  const r=await fetch('/api/upload',{method:'POST',body:data});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(body.error||'No fue posible publicar el HTML.');
  document.getElementById('demo').href=body.demo; document.getElementById('demo').textContent=body.demo;
  document.getElementById('view').href=body.view; document.getElementById('view').textContent=body.view;
  result.style.display='block'; form.reset();
 }catch(err){error.textContent=err.message; error.style.display='block'}finally{button.disabled=false;button.textContent='PUBLICAR HTML'}
});
</script>
</body></html>`;
}

function addWatermark(html) {
  const watermark = `
<style id="recuerdos-watermark-style">
.recuerdos-watermark-layer{position:fixed;inset:0;z-index:2147483647;pointer-events:none;overflow:hidden}
.recuerdos-watermark-layer span{position:absolute;left:50%;width:180%;text-align:center;transform:translateX(-50%) rotate(-24deg);font:800 clamp(26px,8vw,76px)/1 Arial,sans-serif;letter-spacing:.08em;color:rgba(255,255,255,.16);text-shadow:0 2px 8px rgba(0,0,0,.3);white-space:nowrap}
.recuerdos-watermark-layer span:nth-child(1){top:8%}.recuerdos-watermark-layer span:nth-child(2){top:28%}.recuerdos-watermark-layer span:nth-child(3){top:48%}.recuerdos-watermark-layer span:nth-child(4){top:68%}.recuerdos-watermark-layer span:nth-child(5){top:88%}
</style>
<div class="recuerdos-watermark-layer" aria-hidden="true">
<span>VISTA PREVIA</span><span>VISTA PREVIA</span><span>VISTA PREVIA</span><span>VISTA PREVIA</span><span>VISTA PREVIA</span>
</div>`;
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
    httpMetadata: {
      contentType: "text/html; charset=utf-8",
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { originalName: escapeHtml(file.name) },
  });

  const base = new URL(request.url).origin;
  return json({
    id,
    demo: `${base}/demo/${id}`,
    view: `${base}/view/${id}`,
  }, 201);
}

async function serveMemory(mode, id, env) {
  if (!validId(id)) return new Response("Recuerdo no encontrado.", { status: 404 });
  const object = await env.RECUERDOS.get(`${HTML_PREFIX}${id}.html`);
  if (!object) return new Response("Recuerdo no encontrado.", { status: 404 });

  const html = await object.text();
  const output = mode === "demo" ? addWatermark(html) : html;
  return new Response(output, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" && request.method === "GET") return page(adminPage());
    if (path === "/api/upload") return upload(request, env);

    const match = path.match(/^\/(demo|view)\/([^/]+)$/);
    if (match && request.method === "GET") return serveMemory(match[1], match[2], env);

    return new Response("Ruta no encontrada.", { status: 404 });
  },
};

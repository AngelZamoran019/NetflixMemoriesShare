const HTML_PREFIX = "html/";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function pageNotFound() {
  return new Response("Recuerdo no encontrado.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function validId(id) {
  return /^[A-Za-z0-9_-]{8,80}$/.test(id);
}

async function getHtml(id, env) {
  const object = await env.RECUERDOS.get(`${HTML_PREFIX}${id}.html`);
  if (!object) return null;
  return await object.text();
}

function addWatermark(html) {
  const watermark = `
<style id="recuerdos-watermark-style">
  .recuerdos-watermark {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-family: Arial, sans-serif;
    font-size: clamp(28px, 10vw, 90px);
    font-weight: 800;
    letter-spacing: .08em;
    color: rgba(255,255,255,.16);
    text-shadow: 0 2px 8px rgba(0,0,0,.28);
    transform: rotate(-24deg);
    user-select: none;
  }
</style>
<div class="recuerdos-watermark" aria-hidden="true">VISTA PREVIA</div>`;

  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${watermark}</body>`);
  }

  return `${html}${watermark}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" && request.method === "GET") {
      return new Response(
        "NetflixMemoriesShare activo. Usa /demo/ID o /view/ID.",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } },
      );
    }

    const match = path.match(/^\/(demo|view)\/([^/]+)$/);
    if (!match || request.method !== "GET") {
      return path === "/" ? pageNotFound() : new Response("Ruta no encontrada.", { status: 404 });
    }

    const [, mode, id] = match;

    if (!validId(id)) return pageNotFound();

    const html = await getHtml(id, env);
    if (!html) return pageNotFound();

    const output = mode === "demo" ? addWatermark(html) : html;

    return new Response(output, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};

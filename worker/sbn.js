// Cloudflare Worker: cerca un ISBN nel catalogo SBN (biblioteche italiane) e lo restituisce
// all'app Libreria, che dal browser non puo' interrogare SBN direttamente (manca il CORS).
// Uso: GET https://<worker>/?isbn=9788807950810 -> {titolo, autori, editore, anno} oppure {}
const ORIGINI = ["https://lucaesposti.github.io", "http://localhost:8791"];

export default {
  async fetch(req) {
    const o = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": ORIGINI.includes(o) ? o : ORIGINI[0], "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" };
    const isbn = (new URL(req.url).searchParams.get("isbn") || "").replace(/[^0-9Xx]/g, "");
    if (isbn.length !== 10 && isbn.length !== 13) return new Response("{}", { status: 400, headers: cors });
    const r = await fetch("https://opac.sbn.it/o/opac-api/titles-search-full-post", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (Libreria)" },
      body: "core=sbn&isbn=" + isbn,
      cf: { cacheTtl: 86400 }
    });
    const t = await r.text();
    // la risposta e' JSON "quasi" valido: prendo solo il primo risultato con le regex
    const g = re => (t.match(re) || [])[1] || "";
    const info = g(/"info":\s*"((?:[^"\\]|\\.)*)"/), autore = g(/"text":\s*"((?:[^"\\]|\\.)*)"/), pub = g(/"infos":\s*\[\s*"((?:[^"\\]|\\.)*)"/);
    if (!info) return new Response("{}", { headers: cors });
    const [titolo, resp = ""] = info.split(" / ");
    // "Moshfegh, Ottessa" -> "Ottessa Moshfegh"; se manca uso la responsabilita' dopo " / "
    const nome = autore ? autore.replace(/<[^>]*>/g, "").split(", ").reverse().join(" ").trim() : resp.split(" ; ")[0];
    const m = pub.match(/:\s*([^,]+),\s*(?:\[?c?)(\d{4})/);
    const out = { titolo: titolo.trim(), autori: nome ? [nome] : [], editore: m ? m[1].trim() : "", anno: m ? m[2] : "" };
    return new Response(JSON.stringify(out), { headers: cors });
  }
};

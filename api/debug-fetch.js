// TEMPORARY diagnostic endpoint - remove after debugging.
const { REQUEST_HEADERS, extractStateBlob, parseInitialState } = require("../lib/xhs");

module.exports = async function handler(req, res) {
  const target = new URL(req.url, "http://localhost").searchParams.get("u") || "";
  const out = { target, region: process.env.VERCEL_REGION || null, hops: [] };
  try {
    let url = target;
    for (let i = 0; i < 6 && url; i++) {
      const r = await fetch(url, { headers: REQUEST_HEADERS, redirect: "manual" });
      const loc = r.headers.get("location");
      const hop = { url: url.slice(0, 160), status: r.status, location: loc ? loc.slice(0, 200) : null };
      out.hops.push(hop);
      if (loc && r.status >= 300 && r.status < 400) { url = new URL(loc, url).toString(); continue; }
      const html = await r.text();
      hop.htmlLength = html.length;
      hop.title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || null;
      try {
        const state = parseInitialState(extractStateBlob(html));
        hop.stateKeys = Object.keys(state);
        hop.noteKeys = state.note ? Object.keys(state.note) : null;
        hop.noteDetailMapKeys = state.note?.noteDetailMap ? Object.keys(state.note.noteDetailMap) : null;
        const first = state.note?.noteDetailMap ? Object.values(state.note.noteDetailMap)[0] : null;
        hop.firstDetailKeys = first ? Object.keys(first) : null;
        hop.serverRequestInfo = state.note?.serverRequestInfo || null;
      } catch (e) { hop.stateError = e.message; hop.snippet = html.slice(0, 300); }
      break;
    }
  } catch (e) {
    out.error = e.message;
    out.cause = e.cause ? { message: e.cause.message, code: e.cause.code, name: e.cause.name } : null;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(out, null, 2));
};

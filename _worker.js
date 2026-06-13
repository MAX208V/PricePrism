function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}

async function handleDashboard(env) {
  var apps = await getApps(env);
  var list = [];
  for (var k = 0; k < apps.length; k++) {
    var app = apps[k];
    var st = await env.KV.get("status:" + app.id, "json") || {};
    list.push({ id: app.id, name: app.name, threshold: app.threshold, country: app.country, note: app.note, monitor_mode: app.monitor_mode, status: st });
  }
  var history = await env.KV.get("history", "json") || [];
  return new Response(renderHtml(list, history, !!(env.SC3_UID && env.SC3_SENDKEY), !!(env.SCRAPER_PROXY)), { headers: { "Content-Type": "text/html;charset=utf-8" } });
}

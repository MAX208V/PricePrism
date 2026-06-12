  if (request.method === "POST") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let name = body.name || "";
    const country = body.country || DEFAULT_COUNTRY;
    const lang = body.lang || DEFAULT_LANG;
    const apps = await getApps(env);
    if (apps.find(a => a.id === body.app_id)) return jsonResponse({ error: "App already exists" }, 409);
    let info = null;
    try { info = await fetchAppInfo(env, body.app_id, country, lang); } catch (e) {}
    if (!name && info && info.title) name = info.title;
    if (!name) name = body.app_id;
    const appConfig = { id: body.app_id, name, threshold: body.threshold ?? DEFAULT_THRESHOLD, country, lang, currency: DEFAULT_CURRENCY, created_at: new Date().toISOString() };
    apps.push(appConfig);
    await env.KV.put("config:apps", JSON.stringify(apps));
    if (info) {
      const st = await env.KV.get("status:" + body.app_id, "json") || {};
      st.last_checked_price = info.price; st.last_checked_at = new Date().toISOString();
      st.icon = info.icon; st.score = info.score; st.scoreText = info.scoreText; st.ratings = info.ratings; st.developer = info.developer;
      await env.KV.put("status:" + body.app_id, JSON.stringify(st));
    }
    return jsonResponse({ ok: true, name });
  }

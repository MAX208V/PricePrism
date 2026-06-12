  if (request.method === "POST") {
    const body = await request.json();
    if (!body.app_id) return jsonResponse({ error: "app_id required" }, 400);
    let name = body.name || "";
    const country = body.country || DEFAULT_COUNTRY;
    const lang = body.lang || DEFAULT_LANG;
    const apps = await getApps(env);
    if (apps.find(a => a.id === body.app_id)) return jsonResponse({ error: "App already exists" }, 409);

// Play Scraper API - Cloudflare Workers
// Architecture: Workers + KV + Cron + Assets

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ==================== CORS Headers ====================
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ==================== Static Assets ====================
    // Serve index.html for root and dashboard paths
    if (pathname === '/' || pathname === '/dashboard' || pathname === '/index.html') {
      const html = await env.ASSETS?.fetch(new URL('/index.html', request.url)) 
        || new Response(await import('./index.html?raw'), { headers: { 'Content-Type': 'text/html' } });
      return html;
    }

    // Serve other static assets
    if (!pathname.startsWith('/api/')) {
      const asset = await env.ASSETS?.fetch(request);
      if (asset && asset.status !== 404) return asset;
    }

    // ==================== API Routes ====================
    try {
      // GET /api/dashboard - Dashboard data for frontend
      if (pathname === '/api/dashboard' && request.method === 'GET') {
        const { apps, history, hasSc3, hasProxy } = await getDashboardData(env);
        return jsonResponse({ apps, history, hasSc3, hasProxy }, cors);
      }

      // GET /api/apps - List all apps
      if (pathname === '/api/apps' && request.method === 'GET') {
        const apps = await getApps(env);
        return jsonResponse({ apps }, cors);
      }

      // POST /api/apps - Add new app
      if (pathname === '/api/apps' && request.method === 'POST') {
        const body = await request.json();
        const result = await addApp(env, body);
        return jsonResponse(result, cors, result.success ? 201 : 400);
      }

      // DELETE /api/apps - Remove app
      if (pathname === '/api/apps' && request.method === 'DELETE') {
        const body = await request.json();
        const result = await removeApp(env, body.app_id);
        return jsonResponse(result, cors);
      }

      // PATCH /api/apps - Update app
      if (pathname === '/api/apps' && request.method === 'PATCH') {
        const body = await request.json();
        const result = await updateApp(env, body);
        return jsonResponse(result, cors);
      }

      // POST /api/check - Check all prices
      if (pathname === '/api/check' && request.method === 'POST') {
        const result = await checkPrices(env);
        return jsonResponse(result, cors);
      }

      // GET /api/search - Search apps
      if (pathname === '/api/search' && request.method === 'GET') {
        const term = url.searchParams.get('term');
        if (!term) return jsonResponse({ error: 'Missing term' }, cors, 400);
        const results = await searchApps(env, term);
        return jsonResponse({ results }, cors);
      }

      // 404 Not Found
      return jsonResponse({ error: 'Not found' }, cors, 404);
    } catch (err) {
      console.error('API Error:', err);
      return jsonResponse({ error: err.message || 'Server error' }, cors, 500);
    }
  },

  // ==================== Cron Trigger ====================
  async scheduled(event, env, ctx) {
    console.log('Cron triggered at', new Date().toISOString());
    await checkPrices(env);
  }
};

// ==================== Helper Functions ====================
function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// ==================== KV Operations ====================
async function getApps(env) {
  const list = await env.KV.list({ prefix: 'app:' });
  const apps = [];
  for (const key of list.keys) {
    const data = await env.KV.get(key.name, 'json');
    if (data) {
      apps.push({ id: key.name.replace('app:', ''), ...data });
    }
  }
  return apps;
}

async function getDashboardData(env) {
  const apps = await getApps(env);
  const history = await env.KV.get('history', 'json') || [];
  const config = await env.KV.get('config', 'json') || {};
  const hasSc3 = !!config.sc3_key;
  const hasProxy = !!config.proxy_url;
  
  // Get status for each app
  const appsWithStatus = await Promise.all(apps.map(async (app) => {
    const status = await env.KV.get(`status:${app.id}`, 'json') || {};
    return { ...app, status };
  }));
  
  return { apps: appsWithStatus, history: history.slice(0, 20), hasSc3, hasProxy };
}

async function addApp(env, { app_id, name, threshold, country = 'us', note = '', monitor_mode = 'threshold' }) {
  if (!app_id) return { success: false, error: 'Missing app_id' };
  if (!threshold || threshold <= 0) return { success: false, error: 'Invalid threshold' };
  
  const key = `app:${app_id}`;
  const exists = await env.KV.get(key);
  if (exists) return { success: false, error: 'App already exists' };
  
  const data = { 
    name: name || app_id, 
    threshold, 
    country, 
    note,
    monitor_mode,
    added_at: new Date().toISOString() 
  };
  await env.KV.put(key, JSON.stringify(data));
  return { success: true, message: 'App added' };
}

async function removeApp(env, app_id) {
  if (!app_id) return { success: false, error: 'Missing app_id' };
  await env.KV.delete(`app:${app_id}`);
  await env.KV.delete(`status:${app_id}`);
  return { success: true, message: 'App removed' };
}

async function updateApp(env, { app_id, name, threshold, country, note, monitor_mode }) {
  if (!app_id) return { success: false, error: 'Missing app_id' };
  const key = `app:${app_id}`;
  const existing = await env.KV.get(key, 'json');
  if (!existing) return { success: false, error: 'App not found' };
  
  const data = { ...existing };
  if (name !== undefined) data.name = name;
  if (threshold !== undefined) data.threshold = threshold;
  if (country !== undefined) data.country = country;
  if (note !== undefined) data.note = note;
  if (monitor_mode !== undefined) data.monitor_mode = monitor_mode;
  
  await env.KV.put(key, JSON.stringify(data));
  return { success: true, message: 'App updated' };
}

// ==================== Price Checking ====================
async function checkPrices(env) {
  const apps = await getApps(env);
  const config = await env.KV.get('config', 'json') || {};
  const results = [];
  
  for (const app of apps) {
    try {
      const price = await fetchPrice(app.id, app.country, config.proxy_url);
      const status = { 
        price, 
        checked_at: new Date().toISOString(),
        icon: status?.icon,
        developer: status?.developer,
        scoreText: status?.scoreText,
        ratings: status?.ratings
      };
      await env.KV.put(`status:${app.id}`, JSON.stringify(status));
      
      // Check threshold and notify if needed
      const shouldNotify = app.monitor_mode === 'change' 
        ? price !== status.previous_price
        : price > 0 && price < app.threshold;
      
      if (shouldNotify && config.sc3_key) {
        await sendNotification(env, app, price);
        status.notified_at = new Date().toISOString();
        status.notified = true;
        await env.KV.put(`status:${app.id}`, JSON.stringify(status));
      }
      
      results.push({ app_id: app.id, price, notified: shouldNotify });
    } catch (err) {
      console.error(`Failed to check ${app.id}:`, err);
      results.push({ app_id: app.id, error: err.message });
    }
  }
  
  // Update history
  const history = await env.KV.get('history', 'json') || [];
  history.unshift(...results.filter(r => !r.error).map(r => ({
    time: new Date().toISOString(),
    name: apps.find(a => a.id === r.app_id)?.name || r.app_id,
    price: r.price,
    notified: r.notified
  })));
  await env.KV.put('history', JSON.stringify(history.slice(0, 100)));
  
  return { success: true, checked: results.length, results };
}

// ==================== External APIs ====================
async function fetchPrice(appId, country, proxyUrl) {
  const url = proxyUrl 
    ? `${proxyUrl}/https://play.google.com/store/apps/details?id=${appId}&hl=${country}`
    : `https://play.google.com/store/apps/details?id=${appId}&hl=${country}`;
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  
  if (!response.ok) throw new Error('Failed to fetch price');
  const html = await response.text();
  
  // Extract price - simple regex approach
  const priceMatch = html.match(/["']([^"']*\$[\d.,]+[^"']*)["']/);
  if (priceMatch) {
    const priceText = priceMatch[1];
    const numMatch = priceText.match(/[\d.,]+/);
    if (numMatch) return parseFloat(numMatch[0].replace(',', ''));
  }
  
  // Check if free
  if (html.includes('"Free"') || html.includes('"免费"') || html.includes('"Install"')) {
    return 0;
  }
  
  return -1; // Unknown price
}

async function searchApps(env, term) {
  const config = await env.KV.get('config', 'json') || {};
  if (!config.proxy_url) {
    throw new Error('Search requires proxy configuration');
  }
  
  const response = await fetch(`${config.proxy_url}/https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps`, {
    headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' }
  });
  
  if (!response.ok) throw new Error('Search failed');
  const html = await response.text();
  
  // Parse search results
  const results = [];
  // Use simple regex parsing for demo
  const appPattern = /data-docid="([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>[^<]*<[^>]*>([^<]+)/g;
  let match;
  while ((match = appPattern.exec(html)) && results.length < 10) {
    results.push({
      appId: match[1],
      icon: match[2],
      title: match[3].trim(),
      developer: 'Unknown',
      priceText: '',
      free: false
    });
  }
  
  return results;
}

async function sendNotification(env, app, price) {
  const config = await env.KV.get('config', 'json') || {};
  if (!config.sc3_key) return;
  
  const message = `🎉 ${app.name} 降价啦！\n\n当前价格: $${price}\n目标阈值: $${app.threshold}\n\nhttps://play.google.com/store/apps/details?id=${app.id}`;
  
  await fetch('https://sc3.chk.valueserver.xyz/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: config.sc3_key, message })
  });
}

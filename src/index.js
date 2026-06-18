// ==================== PricePrism — 入口 ====================
import {
  handleDashboard, handleAppsApi, handleCheck, handleHistory,
  handleSearch, handleAppDetail, handleCountries, handleBg,
  handleTrend, handleMigrate
} from './handlers.js';
import { monitorAndNotify } from './services.js';
import { jsonResponse } from './utils.js';

export default {
  async scheduled(event, env, ctx) {
    console.log("[Cron] 开始价格检查");
    const result = await monitorAndNotify(env);
    console.log("[Cron] 完成:", JSON.stringify(result.ok ? { ok: true, count: result.results?.length } : result));
  },

  async fetch(request, env) {
    // CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" } });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/dashboard") return handleDashboard(env);
      if (path === "/api/apps") return handleAppsApi(request, env);
      if (path === "/api/check") return handleCheck(env);
      if (path === "/api/history") return handleHistory(env);
      if (path === "/api/search") return handleSearch(request, env);
      if (path === "/api/app-detail") return handleAppDetail(request, env);
      if (path === "/api/countries") return handleCountries();
      if (path === "/api/bg") return handleBg();
      if (path === "/api/trend") return handleTrend(request, env);
      if (path === "/api/migrate") return handleMigrate(env);
      if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);

      const response = await env.ASSETS.fetch(request);
      if (response.status === 404) {
        return env.ASSETS.fetch(new URL('/index.html', url.origin));
      }
      return response;
    } catch (e) {
      console.error("[Error]", path, e.message);
      return jsonResponse({ error: e.message }, 500);
    }
  },
};

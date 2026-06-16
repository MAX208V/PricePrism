```javascript
// ==================== 导入 ====================
import { renderHtml, esc } from "./dashboard.js";

// ==================== 配置区 ====================
const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = "6";
const DEFAULT_CURRENCY = "USD";
const SCRAPER_API_DEFAULT = "https://play-scraper-api.vercel.app/api/price";
const HISTORY_MAX = 50;

// ==================== 主入口 ====================
export default {
  async scheduled(event, env, ctx) {
    await monitorAndNotify(env);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/apps") return handleAppsApi(request, env);
    if (path === "/check" || path === "/api/check") {
      const res = await monitorAndNotify(env);
      return jsonResponse(res);
    }
    if (path === "/api/history") return handleHistory(env);
    if (path === "/api/status") return handleStatus(env);
    if (path === "/api/search") return handleSearch(request, env);
    if (path.startsWith("/api/")) return jsonResponse({ error: "Not found" }, 404);
    return handleDashboard(env);
  },
};
```
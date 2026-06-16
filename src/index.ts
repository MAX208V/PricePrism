// 主入口文件
import { AppsHandler } from './api/apps-handler';
import { SearchHandler } from './api/search-handler';
import { CheckHandler } from './api/check-handler';
import { HistoryHandler } from './api/history-handler';
import { DashboardHandler } from './dashboard-handler';
import { MonitorService } from './services/monitor-service';

export default {
  /**
   * 定时任务处理
   */
  async scheduled(event: any, env: any, ctx: any) {
    const monitorService = new MonitorService(env);
    await monitorService.monitorAndNotify();
  },

  /**
   * HTTP 请求处理
   */
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // API 路由
    if (path === "/api/apps") {
      const appsHandler = new AppsHandler(env);
      if (request.method === "GET") {
        return await appsHandler.handleGet();
      } else if (request.method === "POST") {
        return await appsHandler.handlePost(request);
      } else if (request.method === "DELETE") {
        return await appsHandler.handleDelete(request);
      } else if (request.method === "PATCH") {
        return await appsHandler.handlePatch(request);
      } else {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // 检查路由
    if (path === "/check" || path === "/api/check") {
      const checkHandler = new CheckHandler(env);
      return await checkHandler.handle();
    }
    
    // 历史记录路由
    if (path === "/api/history") {
      const historyHandler = new HistoryHandler(env);
      return await historyHandler.handle();
    }
    
    // 搜索路由
    if (path === "/api/search") {
      const searchHandler = new SearchHandler(env);
      return await searchHandler.handle(request);
    }
    
    // 404 处理
    if (path.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // 默认返回仪表板
    try {
      const dashboardHandler = new DashboardHandler(env);
      return await dashboardHandler.handle();
    } catch (e: any) {
      return new Response("ERR: " + e.message + "\n" + e.stack, {
        status: 500,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }
  },
};
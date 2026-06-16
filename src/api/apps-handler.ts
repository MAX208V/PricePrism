// 应用 API 路由处理器
import { AppService } from '../services/app-service';

export class AppsHandler {
  private appService: AppService;

  constructor(private env: any) {
    this.appService = new AppService(env);
  }

  /**
   * 处理 GET 请求 - 获取所有应用
   */
  async handleGet(): Promise<Response> {
    try {
      const apps = await this.appService.getAllAppsWithStatus();
      return this.jsonResponse(apps);
    } catch (err: any) {
      return this.jsonResponse({ error: err.message }, 400);
    }
  }

  /**
   * 处理 POST 请求 - 添加应用
   */
  async handlePost(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = await this.appService.addApp(body);
      return this.jsonResponse(result);
    } catch (err: any) {
      return this.jsonResponse({ error: err.message }, 400);
    }
  }

  /**
   * 处理 DELETE 请求 - 删除应用
   */
  async handleDelete(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      if (!body.app_id) {
        return this.jsonResponse({ error: "app_id required" }, 400);
      }
      
      await this.appService.deleteApp(body.app_id);
      return this.jsonResponse({ ok: true });
    } catch (err: any) {
      return this.jsonResponse({ error: err.message }, 400);
    }
  }

  /**
   * 处理 PATCH 请求 - 更新应用
   */
  async handlePatch(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      if (!body.app_id) {
        return this.jsonResponse({ error: "app_id required" }, 400);
      }
      
      await this.appService.updateApp(body.app_id, body);
      return this.jsonResponse({ ok: true });
    } catch (err: any) {
      return this.jsonResponse({ error: err.message }, 400);
    }
  }

  /**
   * 返回 JSON 响应
   */
  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
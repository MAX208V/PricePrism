// 检查 API 路由处理器
import { MonitorService } from '../services/monitor-service';

export class CheckHandler {
  private monitorService: MonitorService;

  constructor(private env: any) {
    this.monitorService = new MonitorService(env);
  }

  /**
   * 处理检查请求
   */
  async handle(): Promise<Response> {
    try {
      const result = await this.monitorService.monitorAndNotify();
      return this.jsonResponse(result);
    } catch (err: any) {
      return this.jsonResponse({ error: err.message }, 500);
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
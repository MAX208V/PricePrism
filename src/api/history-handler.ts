// 历史记录 API 路由处理器
import { HistoryRepository } from '../repositories/history-repository';

export class HistoryHandler {
  private historyRepo: HistoryRepository;

  constructor(private env: any) {
    this.historyRepo = new HistoryRepository(env);
  }

  /**
   * 处理获取历史记录请求
   */
  async handle(): Promise<Response> {
    try {
      const history = await this.historyRepo.getHistory();
      return this.jsonResponse(history);
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
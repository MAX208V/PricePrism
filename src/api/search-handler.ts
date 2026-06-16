// 搜索 API 路由处理器
import { SearchService } from '../services/search-service';

export class SearchHandler {
  private searchService: SearchService;

  constructor(private env: any) {
    this.searchService = new SearchService(env);
  }

  /**
   * 处理搜索请求
   */
  async handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const term = url.searchParams.get("term");
      
      if (!term) {
        return this.jsonResponse({ error: "term required" }, 400);
      }
      
      const result = await this.searchService.search(term);
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
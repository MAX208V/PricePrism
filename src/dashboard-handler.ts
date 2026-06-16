// 仪表板处理器
import { AppService } from './services/app-service';
import { HistoryRepository } from './repositories/history-repository';
import { renderHtml } from './dashboard/dashboard-template';

export class DashboardHandler {
  private appService: AppService;
  private historyRepo: HistoryRepository;

  constructor(private env: any) {
    this.appService = new AppService(env);
    this.historyRepo = new HistoryRepository(env);
  }

  /**
   * 处理仪表板请求
   */
  async handle(): Promise<Response> {
    try {
      // 获取应用列表和状态
      const apps = await this.appService.getAllAppsWithStatus();
      
      // 获取历史记录
      const history = await this.historyRepo.getHistory();
      
      // 检查是否配置了通知和代理
      const hasSc3 = !!(this.env.SC3_UID && this.env.SC3_SENDKEY);
      const hasProxy = !!(this.env.SCRAPER_PROXY);
      
      // 渲染HTML
      const html = renderHtml(apps, history, hasSc3, hasProxy);
      
      return new Response(html, {
        headers: { "Content-Type": "text/html;charset=utf-8" }
      });
    } catch (e: any) {
      return new Response("ERR: " + e.message + "\n" + e.stack, {
        status: 500,
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
    }
  }
}
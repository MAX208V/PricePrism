// 应用服务层
import { AppsRepository } from '../repositories/apps-repository';
import { StatusRepository } from '../repositories/status-repository';

const DEFAULT_COUNTRY = "us";
const DEFAULT_LANG = "en";
const DEFAULT_THRESHOLD = 6;
const DEFAULT_CURRENCY = "USD";
const SCRAPER_API_DEFAULT = "https://play-scraper-api.vercel.app/api/price";

export class AppService {
  private appsRepo: AppsRepository;
  private statusRepo: StatusRepository;

  constructor(private env: any) {
    this.appsRepo = new AppsRepository(env);
    this.statusRepo = new StatusRepository(env);
  }

  /**
   * 获取所有应用及其状态
   */
  async getAllAppsWithStatus(): Promise<any[]> {
    const apps = await this.appsRepo.getAll();
    const result = [];
    
    for (const app of apps) {
      const status = await this.statusRepo.getStatus(app.id);
      result.push({ ...app, status });
    }
    
    return result;
  }

  /**
   * 添加新应用
   */
  async addApp(appData: any): Promise<any> {
    // 验证必需字段
    if (!appData.app_id) {
      throw new Error("app_id required");
    }

    // 检查应用是否已存在
    const existingApps = await this.appsRepo.getAll();
    if (existingApps.find((a: any) => a.id === appData.app_id)) {
      throw new Error("App already exists");
    }

    // 获取应用信息
    let name = appData.name || "";
    const country = appData.country || DEFAULT_COUNTRY;
    const lang = appData.lang || DEFAULT_LANG;
    
    let info = null;
    try {
      info = await this.fetchAppInfo(appData.app_id, country, lang);
    } catch (e) {
      console.warn('获取应用信息失败:', e);
    }

    // 如果没有提供名称且能获取到应用信息，则使用应用标题
    if (!name && info && info.title) {
      name = info.title;
    }
    if (!name) {
      name = appData.app_id;
    }

    // 创建应用配置
    const appConfig = {
      id: appData.app_id,
      name,
      threshold: appData.threshold ?? DEFAULT_THRESHOLD,
      country,
      lang,
      currency: DEFAULT_CURRENCY,
      created_at: new Date().toISOString(),
      monitor_mode: appData.monitor_mode || "threshold",
      note: appData.note || ""
    };

    // 保存应用配置
    await this.appsRepo.create(appConfig);

    // 如果获取到了应用信息，更新状态
    if (info) {
      const status = await this.statusRepo.getStatus(appData.app_id);
      status.last_checked_price = info.price;
      status.last_checked_at = new Date().toISOString();
      status.initial_price = info.price;
      status.icon = info.icon;
      status.score = info.score;
      status.scoreText = info.scoreText;
      status.ratings = info.ratings;
      status.developer = info.developer;
      await this.statusRepo.updateStatus(appData.app_id, status);
    }

    return { ok: true, name };
  }

  /**
   * 删除应用
   */
  async deleteApp(appId: string): Promise<void> {
    if (!appId) {
      throw new Error("app_id required");
    }

    await this.appsRepo.delete(appId);
  }

  /**
   * 更新应用
   */
  async updateApp(appId: string, updateData: any): Promise<void> {
    if (!appId) {
      throw new Error("app_id required");
    }

    await this.appsRepo.update(appId, updateData);
  }

  /**
   * 获取应用信息
   */
  private async fetchAppInfo(appId: string, country: string, lang: string): Promise<any> {
    const proxy = this.env.SCRAPER_PROXY;
    
    // 如果配置了代理，优先使用代理
    if (proxy) {
      try {
        const resp = await fetch(proxy + "?method=app&appId=" + appId + "&country=" + country + "&lang=" + lang);
        const data = await resp.json();
        if (data.ok && data.data) {
          return {
            price: data.data.price,
            currency: data.data.currency || "USD",
            icon: data.data.icon,
            title: data.data.title,
            score: data.data.score,
            scoreText: data.data.scoreText,
            ratings: data.data.ratings,
            developer: data.data.developer,
          };
        }
      } catch (e) {
        console.warn('使用代理获取应用信息失败:', e);
      }
    }

    // 使用备用API
    const fallbackResp = await fetch(
      (this.env.SCRAPER_API || SCRAPER_API_DEFAULT) + 
      "?id=" + appId + "&country=" + country + "&lang=" + lang
    );
    
    if (fallbackResp.ok) {
      const data = await fallbackResp.json();
      return { price: data.price, currency: data.currency || "USD" };
    }

    return null;
  }
}
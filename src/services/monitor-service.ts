// 监控服务层
import { AppsRepository } from '../repositories/apps-repository';
import { StatusRepository } from '../repositories/status-repository';
import { HistoryRepository } from '../repositories/history-repository';

const SCRAPER_API_DEFAULT = "https://play-scraper-api.vercel.app/api/price";
const HISTORY_MAX = 50;

export class MonitorService {
  private appsRepo: AppsRepository;
  private statusRepo: StatusRepository;
  private historyRepo: HistoryRepository;

  constructor(private env: any) {
    this.appsRepo = new AppsRepository(env);
    this.statusRepo = new StatusRepository(env);
    this.historyRepo = new HistoryRepository(env);
  }

  /**
   * 监控并通知价格变化
   */
  async monitorAndNotify(): Promise<any> {
    const SC3_UID = this.env.SC3_UID;
    const SC3_SENDKEY = this.env.SC3_SENDKEY;
    
    if (!SC3_UID || !SC3_SENDKEY) {
      return { ok: false, error: "Missing SC3_UID or SC3_SENDKEY" };
    }

    const apps = await this.appsRepo.getAll();
    if (!apps.length) {
      return { ok: true, message: "No apps configured" };
    }

    const results = [];
    for (const app of apps) {
      try {
        results.push(await this.checkApp(app));
      } catch (e: any) {
        results.push({ app_id: app.id, name: app.name, ok: false, error: e.message });
      }
    }

    return { ok: true, results };
  }

  /**
   * 检查单个应用的价格
   */
  private async checkApp(app: any): Promise<any> {
    const { id, name, country, lang, threshold, monitor_mode } = app;
    const SCRAPER_API = this.env.SCRAPER_API || SCRAPER_API_DEFAULT;
    const PROXY = this.env.SCRAPER_PROXY;
    
    let price, cur = "USD", icon, score, scoreText, ratings, developer;
    
    // 如果配置了代理，优先使用代理获取价格
    if (PROXY) {
      try {
        const resp = await fetch(PROXY + "?method=app&appId=" + id + "&country=" + country + "&lang=" + lang);
        const data = await resp.json();
        if (data.ok && data.data) {
          price = data.data.price;
          cur = data.data.currency || "USD";
          icon = data.data.icon;
          score = data.data.score;
          scoreText = data.data.scoreText;
          ratings = data.data.ratings;
          developer = data.data.developer;
        }
      } catch (e) {
        console.warn('使用代理获取价格失败:', e);
      }
    }
    
    // 如果代理获取失败，使用备用API
    if (price === undefined) {
      const priceInfo = await this.fetchPrice(SCRAPER_API, id, country, lang);
      if (!priceInfo || !priceInfo.ok) {
        return { app_id: id, name, ok: false, error: "fetch_price_failed" };
      }
      price = priceInfo.price;
      cur = priceInfo.currency || "USD";
    }
    
    // 获取并更新应用状态
    const statusKey = "status:" + id;
    let status = await this.statusRepo.getStatus(id);
    
    // 如果是首次检查，记录初始价格
    if (status.initial_price === undefined) {
      status.initial_price = price;
    }
    
    // 更新状态信息
    status.last_checked_price = price;
    status.last_checked_at = new Date().toISOString();
    if (icon) status.icon = icon;
    if (score) status.score = score;
    if (scoreText) status.scoreText = scoreText;
    if (ratings) status.ratings = ratings;
    if (developer) status.developer = developer;
    
    // 检查是否需要通知
    let notified = false, reason = null;
    
    if (monitor_mode === "change") {
      // 价格变动模式：只要价格发生变化就通知
      const lastCheck = status.last_checked_price;
      if (lastCheck !== undefined && lastCheck !== null && lastCheck !== price) {
        notified = true;
        reason = "price_changed";
      }
    } else {
      // 阈值模式：只有价格低于阈值才通知
      const below = price > 0 && price < threshold && cur === "USD";
      if (below) {
        const last = status.last_notified_price;
        if (last === undefined || last === null) {
          notified = true;
          reason = "first_drop";
        } else if (price < last) {
          notified = true;
          reason = "price_dropped";
        } else if (price === last) {
          notified = false;
          reason = "price_unchanged";
        } else {
          notified = false;
          reason = "price_rose";
        }
      }
    }
    
    if (notified) {
      // 发送通知
      const title = monitor_mode === "change" ? 
        (name + " 价格变动") : 
        (name + " 降价啦！");
      
      const desp = "**" + price + " " + cur + "**" + 
        (monitor_mode === "change" ? 
          "（上次: $" + status.last_checked_price + "）" : 
          "，已低于阈值 " + threshold + " " + cur) +
        "\n\n应用ID：`" + id + "`\n时间：" + new Date().toISOString() +
        "\n\n[打开 Google Play](https://play.google.com/store/apps/details?id=" + 
        id + "&hl=" + lang + "&gl=" + country + ")";
      
      const nr = await this.sendSc3(
        this.env.SC3_UID, 
        this.env.SC3_SENDKEY, 
        title, 
        desp
      );
      
      // 更新通知状态
      status.last_notified_price = price;
      status.last_notified_at = new Date().toISOString();
      
      // 添加到历史记录
      await this.historyRepo.appendHistory({
        app_id: id,
        name: name,
        price: price,
        threshold: threshold,
        time: new Date().toISOString(),
        notified: true
      });
      
      // 保存状态
      await this.statusRepo.updateStatus(id, status);
      
      return {
        app_id: id,
        name,
        ok: true,
        price,
        currency: cur,
        threshold,
        notified: true,
        reason,
        icon,
        score,
        scoreText,
        ratings,
        developer,
        sc3: nr
      };
    }
    
    // 保存状态
    await this.statusRepo.updateStatus(id, status);
    
    return {
      app_id: id,
      name,
      ok: true,
      price,
      currency: cur,
      threshold,
      notified: false,
      reason,
      icon,
      score,
      scoreText,
      ratings,
      developer
    };
  }

  /**
   * 获取价格信息
   */
  private async fetchPrice(api: string, appId: string, country: string, lang: string): Promise<any> {
    const resp = await fetch(
      api + "?id=" + appId + "&country=" + country + "&lang=" + lang,
      { headers: { Accept: "application/json" } }
    );
    
    if (!resp.ok) throw new Error("Vercel " + resp.status);
    return await resp.json();
  }

  /**
   * 发送通知到 Server酱
   */
  private async sendSc3(uid: string, key: string, title: string, desp: string): Promise<any> {
    const resp = await fetch(
      "https://" + uid + ".push.ft07.com/send/" + key + ".send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, desp })
      }
    );
    
    return { status: resp.status, body: await resp.text() };
  }
}
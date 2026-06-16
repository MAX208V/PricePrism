// 搜索服务层
const SCRAPER_API_DEFAULT = "https://play-scraper-api.vercel.app/api/price";

export class SearchService {
  constructor(private env: any) {}

  /**
   * 搜索Google Play应用
   */
  async search(term: string): Promise<any> {
    if (!term) {
      throw new Error("term required");
    }

    const proxy = this.env.SCRAPER_PROXY;
    if (!proxy) {
      throw new Error("SCRAPER_PROXY not configured");
    }

    try {
      const resp = await fetch(
        proxy + "?method=search&term=" + encodeURIComponent(term) + "&num=10",
        { headers: { Accept: "application/json" } }
      );
      
      const data = await resp.json();
      if (!data.ok) {
        throw new Error(data.error || "search failed");
      }
      
      return { ok: true, results: data.data };
    } catch (e: any) {
      throw new Error(e.message);
    }
  }
}
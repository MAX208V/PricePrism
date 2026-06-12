// ==================== 配置区 ====================
const APP_ID = "com.flyersoft.moonreaderp";
const COUNTRY = "us";
const LANG = "en";
const PRICE_THRESHOLD = 20; // 低于 6 USD 通知

// ==================== 主入口 ====================
export default {
  // Cron 定时任务触发入口（云端自动运行）
  async scheduled(event, env, ctx) {
    await monitorAndNotify(env);
  },

  // HTTP 请求触发入口（用于本地测试）
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/check") {
      const res = await monitorAndNotify(env);
      return new Response(JSON.stringify(res), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Moon+ Reader Monitor is running. Visit /check to test.", { status: 200 });
  },
};

// ==================== 核心逻辑 ====================
async function monitorAndNotify(env) {
  // 1. 从环境变量读取配置（更安全）
  const SCRAPER_API = env.SCRAPER_API || "https://play-scraper-api.vercel.app/api/price";
  const SC3_UID = env.SC3_UID;
  const SC3_SENDKEY = env.SC3_SENDKEY;

  if (!SC3_UID || !SC3_SENDKEY) {
    return { ok: false, error: "Missing SC3_UID or SC3_SENDKEY in environment variables" };
  }

  // 2. 从 Vercel 获取价格
  const priceInfo = await fetchPrice(SCRAPER_API);

  if (!priceInfo || !priceInfo.ok) {
    console.error("获取价格失败", priceInfo);
    return { ok: false, error: "fetch_price_failed" };
  }

  const { price, currency } = priceInfo;

  // 3. 判断是否满足通知条件（价格 < 6 USD 且是美元）
  const shouldNotify = price > 0 && price < PRICE_THRESHOLD && currency === "USD";

  if (!shouldNotify) {
    return { ok: true, notified: false, price, currency, message: "价格未低于阈值" };
  }

  // 4. 构造通知内容
  const title = "Moon+ Reader Pro 降价啦！";
  const desp = `美区价格：**${price} ${currency}**，已低于 ${PRICE_THRESHOLD} ${currency}\n\n` +
               `应用ID：${APP_ID}\n` +
               `地区：${COUNTRY} / ${LANG}\n` +
               `时间：${new Date().toISOString()}\n\n` +
               `[点击打开 Google Play](https://play.google.com/store/apps/details?id=${APP_ID}&hl=${LANG}&gl=${COUNTRY})`;

  // 5. 调 Server酱³ 发通知
  const notifyResult = await sendSc3Notification(SC3_UID, SC3_SENDKEY, title, desp);

  return {
    ok: true,
    notified: true,
    price,
    currency,
    sc3Result: notifyResult,
  };
}

// ==================== 调 Vercel 拿价格 ====================
async function fetchPrice(scraperApi) {
  const url = `${scraperApi}?id=${APP_ID}&country=${COUNTRY}&lang=${LANG}`;
  const resp = await fetch(url, {
    headers: { "Accept": "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`Vercel API error: ${resp.status}`);
  }

  return await resp.json();
}

// ==================== 调 Server酱³ 发通知 ====================
async function sendSc3Notification(uid, sendkey, title, desp) {
  const sc3Url = `https://${uid}.push.ft07.com/send/${sendkey}.send`;

  const body = {
    title,
    desp, // 支持Markdown
  };

  const resp = await fetch(sc3Url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  console.log("Server酱³ 返回状态：", resp.status);
  console.log("Server酱³ 返回内容：", text);

  return {
    status: resp.status,
    body: text,
  };
}

// ==================== 常量 ====================

export const DEFAULT_COUNTRY = "us";

export const DEFAULT_LANG = "en";

export const DEFAULT_THRESHOLD = 6;

export const HISTORY_MAX = 50;

export const COUNTRY_NAMES = {

  us: "🇺🇸 美国", jp: "🇯🇵 日本", kr: "🇰🇷 韩国", hk: "🇭🇰 香港",

  tw: "🇹🇼 台湾", cn: "🇨🇳 中国", gb: "🇬🇧 英国", de: "🇩🇪 德国",

  fr: "🇫🇷 法国", it: "🇮🇹 意大利", es: "🇪🇸 西班牙", ca: "🇨🇦 加拿大",

  au: "🇦🇺 澳大利亚", br: "🇧🇷 巴西", ru: "🇷🇺 俄罗斯", in: "🇮🇳 印度",

  sg: "🇸🇬 新加坡", my: "🇲🇾 马来西亚", th: "🇹🇭 泰国", id: "🇮🇩 印度尼西亚",

  ph: "🇵🇭 菲律宾", vn: "🇻🇳 越南", nl: "🇳🇱 荷兰", se: "🇸🇪 瑞典",

  no: "🇳🇴 挪威", dk: "🇩🇰 丹麦", ch: "🇨🇭 瑞士", mx: "🇲🇽 墨西哥",

  tr: "🇹🇷 土耳其", za: "🇿🇦 南非", ae: "🇦🇪 阿联酋", sa: "🇸🇦 沙特"

};

// ==================== 响应工具 ====================

export function jsonResponse(data, status = 200) {

  return new Response(JSON.stringify(data), {

    status,

    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }

  });

}

// ==================== 数据解析 ====================

export function parseCountries(app) {

  if (!app) return ["us"];

  try {

    if (typeof app.countries === 'string') return JSON.parse(app.countries);

    if (Array.isArray(app.countries)) return app.countries;

  } catch (e) {}

  return [app.country || "us"];

}

export function parseDeveloper(dev) {

  if (!dev) return '';

  if (typeof dev === 'string') return dev;

  if (typeof dev === 'object') return dev.devId || dev.name || JSON.stringify(dev);

  return '';
}



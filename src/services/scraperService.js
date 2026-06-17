/**
 * Service for scraping app info and price from external APIs
 */

/**
 * Fetch app info from scraper API
 * @param {object} env - Cloudflare environment
 * @param {string} appId - App ID
 * @param {string} country - Country code
 * @returns {Promise<Object>} App information
 */
export async function fetchAppInfo(env, appId, country) {
  const scraperApi = env.SCRAPER_API;
  
  if (!scraperApi) {
    throw new Error('SCRAPER_API not configured');
  }
  
  try {
    // 根据facundoolano/google-play-api的标准API格式
    const response = await fetch(`${scraperApi}/api/apps/${appId}/?country=${country}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch app info:', error);
    throw error;
  }
}

/**
 * Fetch current price of an app
 * @param {object} env - Cloudflare environment
 * @param {string} appId - App ID
 * @param {string} country - Country code
 * @returns {Promise<number>} Current price in USD
 */
export async function fetchPrice(env, appId, country) {
  const scraperApi = env.SCRAPER_API;
  
  if (!scraperApi) {
    throw new Error('SCRAPER_API not configured');
  }
  
  try {
    // 首先获取应用详细信息，从中提取价格
    const response = await fetch(`${scraperApi}/api/apps/${appId}/?country=${country}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    // 从应用详情中提取价格信息
    // 注意：不同API实现可能有不同的价格字段，需要根据实际情况调整
    const price = data.price || data.priceText || 0;
    
    // 如果价格是字符串格式（如"$29.99"），需要解析为数字
    if (typeof price === 'string') {
      const match = price.match(/[0-9]+\.?[0-9]*/);
      return match ? parseFloat(match[0]) : 0;
    }
    
    return typeof price === 'number' ? price : 0;
  } catch (error) {
    console.error('Failed to fetch price:', error);
    throw error;
  }
}
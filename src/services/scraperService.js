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
    const response = await fetch(`${scraperApi}/api/apps/${appId}?country=${country}`);
    
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
    const response = await fetch(`${scraperApi}/api/apps/${appId}/price?country=${country}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.price || 0;
  } catch (error) {
    console.error('Failed to fetch price:', error);
    throw error;
  }
}
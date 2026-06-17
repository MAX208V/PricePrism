/**
 * Controller for handling search-related API requests
 */

/**
 * Handle GET /api/search - Search for apps
 * @param {Request} request - The incoming request
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response with search results
 */
export async function handleSearch(request, env) {
  try {
    const url = new URL(request.url);
    const term = url.searchParams.get('term');

    if (!term || typeof term !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid or missing search term' }), { status: 400 });
    }

    const scraperApi = env.SCRAPER_API;
    
    if (!scraperApi) {
      return new Response(JSON.stringify({ error: 'SCRAPER_API not configured' }), { status: 500 });
    }

    try {
      // 使用您的GooglePlayScraper_api的proxy端点进行搜索
      const response = await fetch(`${scraperApi}/api/proxy?method=search&term=${encodeURIComponent(term)}&num=20`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // 转换为前端期望的格式
      if (result.ok && Array.isArray(result.data)) {
        // 将搜索结果转换为前端期望的格式
        const transformedResults = result.data.map(item => ({
          appId: item.appId,
          title: item.title,
          icon: item.icon,
          developer: item.developer,
          priceText: item.priceText,
          free: item.free,
          scoreText: item.scoreText
        }));
        
        return new Response(JSON.stringify({ results: transformedResults }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        throw new Error(result.error || 'Failed to parse search results');
      }
    } catch (error) {
      console.error('Failed to search apps:', error);
      return new Response(JSON.stringify({ error: 'Failed to search apps' }), { status: 500 });
    }
  } catch (error) {
    console.error('Error handling search request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
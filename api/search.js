/**
 * Search API module
 */

export async function handleSearch(request, env) {
  // Extract search term from query parameters
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get('term');
  
  // Validate search term
  if (!searchTerm || searchTerm.trim().length === 0) {
    return new Response(JSON.stringify({ 
      error: '搜索词不能为空' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    });
  }
  
  try {
    // Get scraper API URL from environment or use default
    const scraperApiUrl = env.SCRAPER_API || 'https://play-scraper-api.vercel.app/api/search';
    
    // Make request to Google Play search API
    const response = await fetch(`${scraperApiUrl}?q=${encodeURIComponent(searchTerm)}`);
    
    if (!response.ok) {
      throw new Error(`Google Play Scraper API response was not ok: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform the data to match expected format
    const results = (data.results || []).map(item => ({
      appId: item.appId,
      title: item.title,
      developer: item.developer,
      scoreText: item.score,
      priceText: item.priceText || (item.free ? '免费' : ''),
      icon: item.icon
    }));
    
    return new Response(JSON.stringify({ 
      results: results 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Search API error:', error);
    return new Response(JSON.stringify({ 
      error: '搜索失败，请稍后重试' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
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
    // Make request to Google Play search API
    const response = await fetch(
      `https://play.google.com/store/search?q=${encodeURIComponent(searchTerm)}&c=apps`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google Play API response was not ok: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse search results from HTML response
    const results = parseSearchResults(html);
    
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

function parseSearchResults(html) {
  // This is a simplified parser - in a real implementation, you would need
  // a more robust solution to extract data from the Google Play HTML
  
  const results = [];
  // Simple regex-based extraction (this would need improvement in production)
  const appRegex = /<div class="VfPpkd-WsjYwc VfPpkd-WsjYwc-OWXEXe-u1mln VfPpkd-WsjYwc-OWXEXe-Iamruy VfPpkd-WsjYwc-OWXEXe-dgl2Hf[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  
  let match;
  while ((match = appRegex.exec(html))) {
    const appBlock = match[1];
    
    // Try to extract app information
    try {
      const appIdMatch = appBlock.match(/href="\/store\/apps\/details\?id=([^"]+)"/);
      const titleMatch = appBlock.match(/<span[^>]*>([^<]+)<\/span>/);
      const developerMatch = appBlock.match(/<span[^>]*class="wMUdtb"[^>]*>([^<]+)<\/span>/);
      const ratingMatch = appBlock.match(/aria-label="评级: ([\d.]+)星"/);
      const priceMatch = appBlock.match(/<span[^>]*class="VfPpfd[^"]*"[^>]*>([^<]+)<\/span>/);
      
      if (appIdMatch && titleMatch) {
        results.push({
          appId: appIdMatch[1],
          title: titleMatch[1].trim(),
          developer: developerMatch ? developerMatch[1].trim() : '',
          scoreText: ratingMatch ? ratingMatch[1] : '',
          priceText: priceMatch ? priceMatch[1].trim() : ''
        });
      }
    } catch (parseError) {
      console.error('Error parsing app block:', parseError);
      continue;
    }
    
    // Limit results
    if (results.length >= 20) break;
  }
  
  return results;
}
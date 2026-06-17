/**
 * Scheduler module for periodic price checking
 */

export async function handleScheduled(env) {
  try {
    // Get all apps from KV storage
    const appsData = await env.KV.get('apps', 'json') || {};
    const apps = Object.values(appsData);
    
    if (apps.length === 0) {
      console.log('No apps to check');
      return;
    }
    
    // Get configuration
    const configRaw = await env.KV.get('config') || '{}';
    let config = {};
    try {
      config = JSON.parse(configRaw);
    } catch (e) {
      config = {};
    }
    
    // Get proxy URL if configured
    const proxyUrl = config.proxyUrl;
    
    // Get existing history
    const historyRaw = await env.KV.get('history') || '[]';
    let history = [];
    try {
      history = JSON.parse(historyRaw);
    } catch (e) {
      history = [];
    }
    
    // Check each app
    let checkedCount = 0;
    for (const app of apps) {
      try {
        // Fetch app details
        const appDetails = await fetchAppDetails(app.id, app.country, proxyUrl);
        
        // Update app status
        app.status = {
          ...app.status,
          last_checked_at: new Date().toISOString(),
          last_checked_price: appDetails.price,
          icon: appDetails.icon,
          developer: appDetails.developer,
          scoreText: appDetails.scoreText,
          ratings: appDetails.ratings
        };
        
        // Check if notification is needed
        let shouldNotify = false;
        const currentPrice = appDetails.price;
        
        if (currentPrice !== undefined && currentPrice >= 0) {
          // For threshold mode, notify when price drops below threshold
          if (app.monitor_mode === 'threshold' && currentPrice > 0 && currentPrice < app.threshold) {
            shouldNotify = true;
          }
          // For change mode, notify on any price change
          else if (app.monitor_mode === 'change' && app.status && app.status.last_checked_price !== undefined && 
                  app.status.last_checked_price !== currentPrice) {
            shouldNotify = true;
          }
        }
        
        // Send notification if needed
        if (shouldNotify && config.sc3) {
          await sendNotification(app, appDetails, config);
          app.status.last_notified_at = new Date().toISOString();
          
          // Add to history
          history.unshift({
            time: new Date().toISOString(),
            app_id: app.id,
            name: app.name,
            price: currentPrice,
            notified: true
          });
        } else if (currentPrice !== undefined) {
          // Add to history even if not notified
          history.unshift({
            time: new Date().toISOString(),
            app_id: app.id,
            name: app.name,
            price: currentPrice,
            notified: false
          });
        }
        
        // Update app in storage
        appsData[app.id] = app;
        checkedCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (appError) {
        console.error(`Error checking app ${app.id}:`, appError);
        // Continue with other apps
      }
    }
    
    // Save updated apps
    await env.KV.put('apps', JSON.stringify(appsData));
    
    // Save history (keep only last 100 entries)
    history = history.slice(0, 100);
    await env.KV.put('history', JSON.stringify(history));
    
    console.log(`Scheduled check completed. Checked ${checkedCount} apps.`);
  } catch (error) {
    console.error('Error during scheduled check:', error);
  }
}

async function fetchAppDetails(appId, country, proxyUrl) {
  // Construct URL with proxy if configured
  const baseUrl = proxyUrl ? 
    `${proxyUrl}?url=` : 
    'https://play.google.com/store/apps/details?id=';
    
  const url = proxyUrl ? 
    `${baseUrl}${encodeURIComponent(`https://play.google.com/store/apps/details?id=${appId}&hl=en&gl=${country}`)}` :
    `${baseUrl}${appId}&hl=en&gl=${country}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch app details: ${response.status}`);
  }
  
  const html = await response.text();
  
  // Parse details from HTML (simplified)
  const priceMatch = html.match(/<meta[^>]*itemprop="price"[^>]*content="([0-9.]+)"/) ||
                     html.match(/<span[^>]*class="[^"]*VfPpfd[^"]*"[^>]*>(\$[0-9.]+)/);
                     
  const iconMatch = html.match(/<img[^>]*itemprop="image"[^>]*src="([^"]+)"/) ||
                    html.match(/<img[^>]*alt="Icon"[^>]*src="([^"]+)"/);
                    
  const developerMatch = html.match(/<span[^>]*itemprop="name"[^>]*>([^<]+)<\/span>/);
  
  const scoreMatch = html.match(/<div[^>]*role="img"[^>]*aria-label="Rated ([0-9.]+) stars"/);
  
  const ratingsMatch = html.match(/<span[^>]*class="[^"]*wMUdtb[^"]*"[^>]*>([^<]+)<\/span>/);
  
  return {
    price: priceMatch ? (priceMatch[1].startsWith('$') ? parseFloat(priceMatch[1].substring(1)) : parseFloat(priceMatch[1])) : undefined,
    icon: iconMatch ? iconMatch[1] : undefined,
    developer: developerMatch ? developerMatch[1].trim() : undefined,
    scoreText: scoreMatch ? scoreMatch[1] : undefined,
    ratings: ratingsMatch ? ratingsMatch[1].trim() : undefined
  };
}

async function sendNotification(app, appDetails, config) {
  // Send notification via ServerChan (SC3)
  const sc3Url = `https://sctapi.ftqq.com/${config.sc3}.send`;
  
  const title = `${app.name} 价格监控通知`;
  const desp = `
## 应用信息
- **名称**: ${app.name}
- **ID**: ${app.id}
- **当前价格**: $${appDetails.price}
- **监控阈值**: $${app.threshold}
- **地区**: ${app.country}

## 应用详情
- **开发者**: ${appDetails.developer || 'N/A'}
- **评分**: ${appDetails.scoreText || 'N/A'} stars
- **评论数**: ${appDetails.ratings || 'N/A'}

> [前往 Google Play 查看](https://play.google.com/store/apps/details?id=${app.id})
  `.trim();
  
  const response = await fetch(sc3Url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(desp)}`
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send notification: ${response.status}`);
  }
}
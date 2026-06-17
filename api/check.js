/**
 * Check API module for manually triggering price checks
 */

export async function handleCheck(request, env) {
  try {
    // Get all apps from KV storage
    const appsData = await env.KV.get('apps', 'json') || {};
    const apps = Object.values(appsData);
    
    if (apps.length === 0) {
      return new Response(JSON.stringify({ 
        message: '没有需要检查的应用' 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get configuration
    const configRaw = await env.KV.get('config') || '{}';
    let config = {};
    try {
      config = JSON.parse(configRaw);
    } catch (e) {
      config = {};
    }
    
    // Get scraper API URL from environment or use default
    const scraperApiUrl = env.SCRAPER_API || 'https://play-scraper-api.vercel.app/api/price';
    
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
        const appDetails = await fetchAppDetails(app.id, app.country, scraperApiUrl);
        
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
    
    return new Response(JSON.stringify({ 
      message: `检查完成，共检查 ${checkedCount} 个应用`,
      checked: checkedCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error during manual check:', error);
    return new Response(JSON.stringify({ 
      error: '检查过程中发生错误' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

async function fetchAppDetails(appId, country, scraperApiUrl) {
  // Construct URL for app details
  const url = `${scraperApiUrl}?id=${encodeURIComponent(appId)}&country=${country || 'us'}&lang=en`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch app details: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Transform response to match expected format
  return {
    price: data.price,
    icon: data.icon,
    developer: data.developer,
    scoreText: data.score,
    ratings: data.ratings
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
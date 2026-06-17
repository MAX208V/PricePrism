/**
 * Notification module for sending alerts
 */

export async function sendNotification(app, appDetails, config) {
  // Validate configuration
  if (!config.sc3) {
    throw new Error('ServerChan key not configured');
  }
  
  // Send notification via ServerChan (SC3)
  const sc3Url = `https://sctapi.ftqq.com/${config.sc3}.send`;
  
  const title = `${app.name} 价格监控通知`;
  const desp = `
## 应用信息
- **名称**: ${app.name}
- **ID**: ${app.id}
- **当前价格**: $${appDetails.price !== undefined ? appDetails.price : 'N/A'}
- **监控阈值**: $${app.threshold}
- **监控模式**: ${app.monitor_mode === 'change' ? '价格变动' : '低于阈值'}
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
  
  return await response.json();
}

export async function sendTestNotification(config) {
  // Validate configuration
  if (!config.sc3) {
    throw new Error('ServerChan key not configured');
  }
  
  // Send test notification via ServerChan (SC3)
  const sc3Url = `https://sctapi.ftqq.com/${config.sc3}.send`;
  
  const title = 'Price Monitor 测试通知';
  const desp = `
## 通知测试成功

如果收到此消息，说明通知配置正确。

  `.trim();
  
  const response = await fetch(sc3Url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(desp)}`
  });
  
  if (!response.ok) {
    throw new Error(`Failed to send test notification: ${response.status}`);
  }
  
  return await response.json();
}
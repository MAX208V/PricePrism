/**
 * Apps API module for managing monitored applications
 */

export async function handleListApps(request, env) {
  try {
    // Get all apps from KV storage
    const appsData = await env.KV.get('apps', 'json') || {};
    const apps = Object.values(appsData);
    
    // Get check history from KV storage (limited to last 30 entries)
    const historyRaw = await env.KV.get('history') || '[]';
    let history = [];
    try {
      history = JSON.parse(historyRaw);
    } catch (e) {
      history = [];
    }
    
    // Sort history by time descending and limit to 30 entries
    history.sort((a, b) => new Date(b.time) - new Date(a.time));
    history = history.slice(0, 30);
    
    // Check configuration status
    const configRaw = await env.KV.get('config') || '{}';
    let config = {};
    try {
      config = JSON.parse(configRaw);
    } catch (e) {
      config = {};
    }
    
    const hasSc3 = !!config.sc3;
    const hasProxy = !!config.proxyUrl;
    
    return new Response(JSON.stringify({ 
      apps: apps,
      history: history,
      hasSc3: hasSc3,
      hasProxy: hasProxy
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error listing apps:', error);
    return new Response(JSON.stringify({ 
      error: '获取应用列表失败' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

export async function handleAddApp(request, env) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.app_id) {
      return new Response(JSON.stringify({ 
        error: '缺少必需字段: app_id' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    const appId = data.app_id;
    const name = data.name || '';
    const threshold = parseFloat(data.threshold) || 6.0;
    const country = data.country || 'us';
    const note = data.note || '';
    const monitorMode = data.monitor_mode || 'threshold';
    
    // Validate threshold
    if (isNaN(threshold) || threshold <= 0) {
      return new Response(JSON.stringify({ 
        error: '无效的价格阈值' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    // Get existing apps
    const appsData = await env.KV.get('apps', 'json') || {};
    
    // Check if app already exists
    if (appsData[appId]) {
      return new Response(JSON.stringify({ 
        error: '应用已在监控列表中' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    // Add new app
    appsData[appId] = {
      id: appId,
      name: name,
      threshold: threshold,
      country: country,
      note: note,
      monitor_mode: monitorMode,
      created_at: new Date().toISOString()
    };
    
    // Save updated apps list
    await env.KV.put('apps', JSON.stringify(appsData));
    
    return new Response(JSON.stringify({ 
      message: '应用添加成功',
      app: appsData[appId]
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error adding app:', error);
    return new Response(JSON.stringify({ 
      error: '添加应用失败' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

export async function handleUpdateApp(request, env) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.app_id) {
      return new Response(JSON.stringify({ 
        error: '缺少必需字段: app_id' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    const appId = data.app_id;
    const name = data.name;
    const threshold = parseFloat(data.threshold);
    const country = data.country;
    const note = data.note;
    const monitorMode = data.monitor_mode;
    
    // Get existing apps
    const appsData = await env.KV.get('apps', 'json') || {};
    
    // Check if app exists
    if (!appsData[appId]) {
      return new Response(JSON.stringify({ 
        error: '应用不存在' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404
      });
    }
    
    // Update app fields
    const app = appsData[appId];
    if (name !== undefined) app.name = name;
    if (!isNaN(threshold) && threshold > 0) app.threshold = threshold;
    if (country !== undefined) app.country = country;
    if (note !== undefined) app.note = note;
    if (monitorMode !== undefined) app.monitor_mode = monitorMode;
    
    // Save updated apps list
    await env.KV.put('apps', JSON.stringify(appsData));
    
    return new Response(JSON.stringify({ 
      message: '应用更新成功',
      app: app
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating app:', error);
    return new Response(JSON.stringify({ 
      error: '更新应用失败' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

export async function handleDeleteApp(request, env) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.app_id) {
      return new Response(JSON.stringify({ 
        error: '缺少必需字段: app_id' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    const appId = data.app_id;
    
    // Get existing apps
    const appsData = await env.KV.get('apps', 'json') || {};
    
    // Check if app exists
    if (!appsData[appId]) {
      return new Response(JSON.stringify({ 
        error: '应用不存在' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404
      });
    }
    
    // Delete app
    delete appsData[appId];
    
    // Save updated apps list
    await env.KV.put('apps', JSON.stringify(appsData));
    
    return new Response(JSON.stringify({ 
      message: '应用删除成功'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting app:', error);
    return new Response(JSON.stringify({ 
      error: '删除应用失败' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
/**
 * Ultra-simple rendering functions
 */

function renderSimpleAppCards(apps) {
    const container = document.getElementById('appList');
    if (!container) {
        console.error('appList container not found');
        return;
    }
    
    if (!apps || apps.length === 0) {
        container.innerHTML = '<div class="cd" style="text-align:center;padding:32px;color:var(--m);font-weight:500;font-size:14px">暂无监控应用</div>';
        return;
    }
    
    let html = '';
    for (const app of apps) {
        const status = app.status || {};
        const price = status.last_checked_price;
        const priceStr = price !== undefined ? `$${price}` : '-';
        const isLow = price !== undefined && price > 0 && price < app.threshold;
        
        html += `
            <div class="ac">
                <div class="ach">
                    <div class="acn">
                        <div class="act">${app.name || app.appId}</div>
                        <div class="aci">${app.appId}</div>
                    </div>
                    <span class="bg ${isLow ? '' : 'gy'}">${isLow ? '低于阈值' : '正常'}</span>
                </div>
                <div class="acb">
                    <div class="g">
                        <div class="gi">
                            <div class="gl">当前价格</div>
                            <div class="v ${isLow ? 'gr' : ''}">${priceStr}</div>
                        </div>
                        <div class="gi">
                            <div class="gl">阈值</div>
                            <div class="v">$${app.threshold}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function renderSimpleHistory(history) {
    const container = document.getElementById('historyList');
    if (!container) {
        console.error('historyList container not found');
        return;
    }
    
    if (!history || history.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">暂无记录</div>';
        return;
    }
    
    let html = '';
    for (const entry of history) {
        html += `
            <div class="hr">
                <span class="ht">${entry.time || ''}</span>
                <span class="hn">${entry.name || entry.app || ''}</span>
                <span class="hp">$${entry.price !== undefined ? entry.price : '-'}</span>
                <span class="bg hb ${entry.notified ? '' : 'gy'}">${entry.notified ? '已通知' : '跳过'}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Export functions to global scope
window.renderSimpleAppCards = renderSimpleAppCards;
window.renderSimpleHistory = renderSimpleHistory;
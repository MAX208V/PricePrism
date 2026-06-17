/**
 * Ultra-simple main application
 */

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Simple app initializing...');
    
    try {
        // Load apps and history
        await loadSimpleData();
        
        // Set up form submission handler
        const form = document.getElementById('af');
        if (form) {
            form.addEventListener('submit', handleSimpleAddApp);
            console.log('Form handler attached');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        showSimpleToast('初始化失败: ' + error.message);
    }
});

async function loadSimpleData() {
    try {
        console.log('Loading data...');
        
        // Show loading states
        const appList = document.getElementById('appList');
        const historyList = document.getElementById('historyList');
        if (appList) appList.innerHTML = '<div class="cd" style="text-align:center;padding:32px;color:var(--m);font-weight:500;font-size:14px">加载中...</div>';
        if (historyList) historyList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--m);font-weight:500;font-size:14px">加载中...</div>';
        
        // Fetch all data
        const data = await window.simpleGetApps();
        console.log('Data loaded:', data);
        
        // Render data with simple renderers
        if (window.renderSimpleAppCards) {
            window.renderSimpleAppCards(data.apps || []);
        }
        if (window.renderSimpleHistory) {
            window.renderSimpleHistory(data.history || []);
        }
        
        // Show/hide sections
        const warningSection = document.getElementById('warning-section');
        const searchSection = document.getElementById('searchSection');
        if (warningSection) {
            warningSection.style.display = data.hasSc3 ? 'none' : 'block';
        }
        if (searchSection) {
            searchSection.style.display = data.hasProxy ? 'block' : 'none';
        }
        
    } catch (error) {
        console.error('Load data error:', error);
        showSimpleToast('加载数据失败: ' + error.message);
    }
}

async function handleSimpleAddApp(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    const appData = {
        app_id: formData.get('app_id'),
        name: formData.get('name') || '',
        threshold: parseFloat(formData.get('threshold')),
        country: formData.get('country') || 'us'
    };
    
    if (!appData.app_id) {
        showSimpleToast('请输入应用ID');
        return;
    }
    
    if (isNaN(appData.threshold) || appData.threshold <= 0) {
        showSimpleToast('请输入有效的阈值');
        return;
    }
    
    try {
        await window.simpleAddApp(appData);
        showSimpleToast('应用已添加');
        form.reset();
        
        // Reload data
        setTimeout(() => {
            loadSimpleData();
        }, 500);
    } catch (error) {
        showSimpleToast('添加失败: ' + error.message);
    }
}

function showSimpleToast(message) {
    const toast = document.getElementById('tt');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('s');
    
    setTimeout(() => {
        toast.classList.remove('s');
    }, 3000);
}

// Make available globally
window.loadSimpleData = loadSimpleData;
window.handleSimpleAddApp = handleSimpleAddApp;
window.showSimpleToast = showSimpleToast;
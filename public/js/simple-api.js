/**
 * Ultra-simple API client
 */

async function getApps() {
    const response = await fetch('/api/apps');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function addApp(appData) {
    const response = await fetch('/api/apps', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(appData)
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// Export functions to global scope
window.simpleGetApps = getApps;
window.simpleAddApp = addApp;
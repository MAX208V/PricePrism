/**
 * Simplified app implementation
 */

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Simple app loading...');
    
    // Test API connection
    try {
        const response = await fetch('/api/apps');
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API data loaded:', data);
        
        // Update simple UI
        updateSimpleUI(data);
    } catch (error) {
        console.error('Failed to load data:', error);
        document.getElementById('simple-status').innerHTML = 
            `<div style="color:red">Error: ${error.message}</div>`;
    }
});

function updateSimpleUI(data) {
    const statusDiv = document.getElementById('simple-status');
    const appsDiv = document.getElementById('simple-apps');
    
    if (!statusDiv || !appsDiv) {
        console.error('Required DOM elements not found');
        return;
    }
    
    statusDiv.innerHTML = `
        <div>Total apps: ${data.apps.length}</div>
        <div>Has proxy: ${data.hasProxy}</div>
        <div>Has SC3: ${data.hasSc3}</div>
    `;
    
    // Clear loading indicator
    appsDiv.innerHTML = '';
    
    // Show apps
    if (data.apps.length === 0) {
        appsDiv.innerHTML = '<div>No apps found</div>';
        return;
    }
    
    data.apps.forEach(app => {
        const appDiv = document.createElement('div');
        appDiv.innerHTML = `
            <div style="border:1px solid #ccc; margin:10px; padding:10px;">
                <h3>${app.name || app.appId}</h3>
                <p>ID: ${app.appId}</p>
                <p>Threshold: $${app.threshold}</p>
                <p>Country: ${app.country}</p>
            </div>
        `;
        appsDiv.appendChild(appDiv);
    });
}
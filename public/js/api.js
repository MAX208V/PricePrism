/**
 * API client for communicating with the backend
 */

/**
 * Generic API request function
 * @param {string} path - API endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
async function api(path, options = {}) {
  const url = `/api${path}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

/**
 * Get all apps with their statuses
 * @returns {Promise<Array>} Array of apps with status
 */
export async function getApps() {
  return await api('/apps');
}

/**
 * Add a new app
 * @param {object} data - App data
 * @returns {Promise<object>} Response from server
 */
export async function addApp(data) {
  return await api('/apps', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Edit an existing app
 * @param {object} data - App data to update
 * @returns {Promise<object>} Response from server
 */
export async function editApp(data) {
  return await api('/apps', {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/**
 * Delete an app
 * @param {string} appId - ID of the app to delete
 * @returns {Promise<object>} Response from server
 */
export async function deleteApp(appId) {
  return await api('/apps', {
    method: 'DELETE',
    body: JSON.stringify({ app_id: appId })
  });
}

/**
 * Check all apps for price changes
 * @returns {Promise<object>} Response from server
 */
export async function checkAll() {
  return await api('/check', {
    method: 'POST'
  });
}

/**
 * Search for apps
 * @param {string} term - Search term
 * @returns {Promise<object>} Search results
 */
export async function search(term) {
  return await api(`/search?term=${encodeURIComponent(term)}`);
}

/**
 * Get notification history
 * @returns {Promise<Array>} History entries
 */
export async function getHistory() {
  return await api('/history');
}
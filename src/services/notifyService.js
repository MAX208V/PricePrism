/**
 * Service for sending notifications via ServerChan (SC3)
 */

/**
 * Send notification via ServerChan
 * @param {object} env - Cloudflare environment
 * @param {string} title - Notification title
 * @param {string} content - Notification content
 * @returns {Promise<boolean>} Whether notification was sent successfully
 */
export async function sendSc3(env, title, content) {
  const sc3Uid = env.SC3_UID;
  const sc3SendKey = env.SC3_SENDKEY;
  
  // Check if SC3 credentials are configured
  if (!sc3Uid || !sc3SendKey) {
    console.warn('ServerChan credentials not configured');
    return false;
  }
  
  try {
    const response = await fetch(`https://sctapi.ftqq.com/${sc3SendKey}.send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        desp: content
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.code !== 0) {
      console.error('ServerChan API error:', result.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send ServerChan notification:', error);
    return false;
  }
}
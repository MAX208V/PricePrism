/**
 * Controller for handling search-related API requests
 */

import { fetchAppInfo } from '../services/scraperService.js';

/**
 * Handle GET /api/search - Search for apps
 * @param {Request} request - The incoming request
 * @param {object} env - Cloudflare environment
 * @returns {Response} JSON response with search results
 */
export async function handleSearch(request, env) {
  try {
    const url = new URL(request.url);
    const term = url.searchParams.get('term');

    if (!term || typeof term !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid or missing search term' }), { status: 400 });
    }

    const scraperApi = env.SCRAPER_API;
    
    if (!scraperApi) {
      return new Response(JSON.stringify({ error: 'SCRAPER_API not configured' }), { status: 500 });
    }

    try {
      const response = await fetch(`${scraperApi}/api/apps?q=${encodeURIComponent(term)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Failed to search apps:', error);
      return new Response(JSON.stringify({ error: 'Failed to search apps' }), { status: 500 });
    }
  } catch (error) {
    console.error('Error handling search request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
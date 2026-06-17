/**
 * Helper functions for the worker
 */

/**
 * Creates a standardized JSON response
 * @param {Object} data - The data to be returned in the response
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Response} Standardized JSON response
 */
export function jsonResponse(data, statusCode = 200) {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Allow CORS for all origins
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

/**
 * Formats an ISO date string to a readable format: MM/DD HH:MM UTC
 * @param {string} isoString - The ISO date string to format
 * @returns {string} Formatted date string or '-' if input is falsy
 */
export function fmtUTC(isoString) {
  if (!isoString) return "-";
  
  const date = new Date(isoString);
  const pad = (num) => (num < 10 ? "0" + num : "" + num);
  
  return (
    pad(date.getUTCMonth() + 1) +
    "/" +
    pad(date.getUTCDate()) +
    " " +
    pad(date.getUTCHours()) +
    ":" +
    pad(date.getUTCMinutes()) +
    " UTC"
  );
}
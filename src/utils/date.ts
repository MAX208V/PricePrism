/**
 * 格式化UTC时间
 * @param iso ISO时间字符串
 * @returns 格式化的时间字符串
 */
export function fmtUTC(iso: string | number | Date): string {
  if (!iso) return "-";
  
  const d = new Date(iso);
  const pad = (n: number): string => n < 10 ? "0" + n : "" + n;
  
  return pad(d.getUTCMonth() + 1) + "/" + pad(d.getUTCDate()) + " " + 
         pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " UTC";
}

/**
 * 获取当前时间戳
 * @returns 时间戳
 */
export function now(): number {
  return Date.now();
}

/**
 * 获取今天开始的时间戳
 * @returns 时间戳
 */
export function today(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 获取本周开始的时间戳
 * @returns 时间戳
 */
export function thisWeek(): number {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 获取本月开始的时间戳
 * @returns 时间戳
 */
export function thisMonth(): number {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
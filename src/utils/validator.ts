/**
 * 验证应用ID格式
 * @param appId 应用ID
 * @returns 是否有效
 */
export function isValidAppId(appId: string): boolean {
  if (!appId) return false;
  // Google Play应用ID通常是反向域名格式
  return /^[a-zA-Z0-9_.]+$/.test(appId);
}

/**
 * 验证价格阈值
 * @param threshold 阈值
 * @returns 是否有效
 */
export function isValidThreshold(threshold: number): boolean {
  return typeof threshold === 'number' && threshold > 0;
}

/**
 * 验证国家代码
 * @param country 国家代码
 * @returns 是否有效
 */
export function isValidCountry(country: string): boolean {
  if (!country) return false;
  // 简单验证：2个字母的国家代码
  return /^[a-z]{2}$/.test(country.toLowerCase());
}

/**
 * 验证必填字段
 * @param obj 对象
 * @param requiredFields 必填字段
 * @returns 缺失的字段数组
 */
export function validateRequired(obj: any, requiredFields: string[]): string[] {
  const missing: string[] = [];
  
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }
  
  return missing;
}
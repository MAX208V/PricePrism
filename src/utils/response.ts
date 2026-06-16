/**
 * 成功响应
 * @param data 数据
 * @returns 响应对象
 */
export function success(data: any) {
  return Response.json({
    success: true,
    data
  })
}

/**
 * 错误响应
 * @param message 错误信息
 * @param status 状态码
 * @returns 响应对象
 */
export function error(message: string, status: number = 400) {
  return Response.json({
    success: false,
    message
  }, {
    status
  })
}

/**
 * 分页响应
 * @param data 数据
 * @param page 页码
 * @param limit 每页数量
 * @param total 总数
 * @returns 响应对象
 */
export function paginate(data: any[], page: number, limit: number, total: number) {
  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  })
}
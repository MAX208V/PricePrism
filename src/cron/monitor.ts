import { MonitorService } from '../services/monitor.service'

/**
 * 运行监控任务
 * @param env 环境变量
 */
export async function runMonitor(env: any) {
  try {
    console.log('开始执行价格监控任务...')
    
    const monitorService = new MonitorService(env)
    await monitorService.checkAll()
    
    console.log('价格监控任务执行完成')
  } catch (error) {
    console.error('价格监控任务执行失败:', error)
  }
}
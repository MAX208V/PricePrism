import { AppRepository } from '../repositories/app.repo'
import { HistoryRepository } from '../repositories/history.repo'
import { PlayService } from './play.service'
import { NotificationService } from './notify.service'

export class MonitorService {
  private appRepo: AppRepository
  private historyRepo: HistoryRepository
  private playService: PlayService
  private notifyService: NotificationService

  constructor(private env: any) {
    this.appRepo = new AppRepository(env)
    this.historyRepo = new HistoryRepository()
    this.playService = new PlayService()
    this.notifyService = new NotificationService()
  }

  /**
   * 检查所有应用的价格
   */
  async checkAll() {
    const apps = await this.appRepo.list()
    
    for (const app of apps) {
      try {
        await this.checkApp(app.id)
      } catch (error) {
        console.error(`Error checking app ${app.id}:`, error)
      }
    }
  }

  /**
   * 检查单个应用的价格
   * @param appId 应用ID
   */
  async checkApp(appId: string) {
    const app = await this.appRepo.get(appId)
    if (!app) {
      throw new Error(`App not found: ${appId}`)
    }

    // 获取最新价格
    const details = await this.playService.detail(app.appId)
    const currentPrice = details.price || 0
    
    // 更新应用信息
    await this.appRepo.update(appId, {
      ...app,
      title: details.title,
      price: currentPrice,
      icon: details.icon,
      updatedAt: Date.now()
    })

    // 记录历史价格
    await this.historyRepo.append(app.appId, {
      price: currentPrice,
      time: Date.now()
    })

    // 检查是否需要通知
    if (currentPrice > 0 && currentPrice < app.threshold) {
      // 发送通知
      await this.notifyService.send({
        appId: app.appId,
        appName: details.title,
        oldPrice: app.price,
        newPrice: currentPrice,
        threshold: app.threshold
      })
      
      // 记录通知状态
      await this.appRepo.update(appId, {
        ...app,
        lastNotifiedAt: Date.now()
      })
    }
  }
}
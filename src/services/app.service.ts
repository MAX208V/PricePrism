import { AppRepository } from '../repositories/app.repo'
import { PlayService } from './play.service'

export class AppService {
  private appRepo: AppRepository
  private playService: PlayService

  constructor(private env: any) {
    this.appRepo = new AppRepository(env)
    this.playService = new PlayService()
  }

  /**
   * 获取应用列表
   * @returns 应用列表
   */
  async list() {
    return await this.appRepo.list()
  }

  /**
   * 创建新应用监控
   * @param data 应用数据
   * @returns 创建的应用
   */
  async create(data: any) {
    // 如果没有提供标题，从Play商店获取
    let title = data.name
    if (!title) {
      try {
        const details = await this.playService.detail(data.appId)
        title = details.title
      } catch (error) {
        title = data.appId
      }
    }

    const app = {
      id: this.generateId(),
      appId: data.appId,
      name: title,
      threshold: data.threshold || 6.00,
      country: data.country || 'us',
      note: data.note || '',
      monitorMode: data.monitorMode || 'threshold',
      price: 0,
      icon: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    return await this.appRepo.create(app)
  }

  /**
   * 更新应用
   * @param id 应用ID
   * @param data 更新数据
   * @returns 更新后的应用
   */
  async update(id: string, data: any) {
    return await this.appRepo.update(id, data)
  }

  /**
   * 删除应用
   * @param id 应用ID
   */
  async remove(id: string) {
    return await this.appRepo.remove(id)
  }

  /**
   * 生成唯一ID
   * @returns UUID
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c == 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}
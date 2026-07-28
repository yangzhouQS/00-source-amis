/**
 * 资产注册表（第三方 JS/CSS 依赖管理）
 * 取代旧版烘焙进 canvas.html 的硬编码依赖
 * - 去重（id + version）
 * - 向 iframe/window 按序注入
 */
import type {AssetMeta} from '../schema/types';

export class AssetRegistry {
  private assets = new Map<string, AssetMeta>();

  /** 注册资产 */
  register(asset: AssetMeta): void {
    const key = this.key(asset);
    const existing = this.assets.get(key);
    if (existing) {
      // 已有相同 key，更新 url
      existing.url = asset.url;
      return;
    }
    this.assets.set(key, asset);
  }

  /** 批量注册 */
  registerAll(assets: AssetMeta[]): void {
    assets.forEach(a => this.register(a));
  }

  /** 取消注册 */
  unregister(id: string, version?: string): boolean {
    return this.assets.delete(`${id}@${version ?? '0.0.0'}`);
  }

  /** 全部资产 */
  all(): AssetMeta[] {
    return Array.from(this.assets.values());
  }

  /** 按类型筛选 */
  filter(kind: 'js' | 'css'): AssetMeta[] {
    return this.all().filter(a => a.kind === kind);
  }

  /**
   * 向目标 window 注入资产（按序，串行）
   * @param win 目标窗口（通常是 iframe.contentWindow）
   */
  async injectInto(win: Window): Promise<void> {
    const doc = win.document;
    const scripts = this.filter('js');
    const styles = this.filter('css');

    // 先注入样式
    for (const style of styles) {
      if (style.global && (win as any)[style.global]) continue;
      this.injectStyle(doc, style);
    }
    // 再串行注入脚本
    for (const script of scripts) {
      if (script.global && (win as any)[script.global]) continue;
      await this.injectScript(doc, script);
    }
  }

  /** 注入到当前文档（同 DOM 模式用） */
  async injectIntoDocument(): Promise<void> {
    return this.injectInto(window);
  }

  private injectStyle(doc: Document, asset: AssetMeta): void {
    if (doc.querySelector(`link[data-asset="${asset.id}"]`)) return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = asset.url;
    link.setAttribute('data-asset', asset.id);
    doc.head.appendChild(link);
  }

  private injectScript(doc: Document, asset: AssetMeta): Promise<void> {
    return new Promise((resolve, reject) => {
      if (doc.querySelector(`script[data-asset="${asset.id}"]`)) {
        resolve();
        return;
      }
      const script = doc.createElement('script');
      script.src = asset.url;
      script.setAttribute('data-asset', asset.id);
      script.onload = () => resolve();
      script.onerror = () => {
        if (asset.required) {
          reject(
            new Error(
              `[AssetRegistry] 必需资产加载失败: ${asset.id} (${asset.url})`
            )
          );
        } else {
          console.warn(
            `[AssetRegistry] 资产加载失败: ${asset.id} (${asset.url})`
          );
          resolve();
        }
      };
      doc.head.appendChild(script);
    });
  }

  private key(asset: {id: string; version?: string}): string {
    return `${asset.id}@${asset.version ?? '0.0.0'}`;
  }
}

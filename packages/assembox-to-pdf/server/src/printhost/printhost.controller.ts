import { Controller, Get, Header, NotFoundException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { SceneService } from '../scene/scene.service';

/**
 * 打印宿主页入口（方案 A §4.1）：
 * GET /print?ticket=... → 返回 print-host 构建产物 index.html（资产在 /print-assets/*）。
 */
@Controller()
export class PrintHostController {
  constructor(private readonly scenes: SceneService) {}

  @Get('print')
  @Header('Cache-Control', 'no-store')
  print(): string {
    const file = join(config.printHostDist, 'index.html');
    if (!existsSync(file)) {
      throw new NotFoundException(
        `打印宿主页未构建：${file} 不存在（先执行 pnpm --filter @cs/print-host build）`,
      );
    }
    const fs = require('node:fs') as typeof import('node:fs');
    return fs.readFileSync(file, 'utf-8');
  }

  /** 环境自检信息（排障辅助） */
  @Get('print/_env')
  env(): Record<string, unknown> {
    return {
      chromiumExecutablePath: config.chromiumExecutablePath,
      printHostDist: config.printHostDist,
      scenesDir: config.scenesDir,
      scenes: this.scenes.listSceneIds(),
    };
  }
}

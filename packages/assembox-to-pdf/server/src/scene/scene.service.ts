import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';

export interface ScenePayload {
  sceneName: string;
  /** 原始 uiSkeleton JSON（事件为字符串，由打印宿主 deserializeScene 适配） */
  uiSkeleton: Record<string, unknown>;
  dataSource: Record<string, unknown>;
  routerConfig: Record<string, unknown>;
}

/**
 * 受信场景服务（测试环境：本地 json-config 目录实现）。
 * 生产演进：向场景配置服务拉取（方案 A §9 —— 不接受请求体直传场景 JSON）。
 */
/**
 * 场景 → mock requestFn 映射（测试环境）。
 * 生产演进：dataSource 由配置服务按场景下发。
 */
const SCENE_REQUEST_FNS: Record<string, Record<string, { url: string; method: 'GET' | 'POST' }>> = {
  'single-table-scene': {
    queryPayments: { url: '/internal/mock/payments', method: 'GET' },
  },
  'chart-table-scene': {
    queryPaymentsLarge: { url: '/internal/mock/payments-large', method: 'GET' },
  },
};

@Injectable()
export class SceneService {
  /** 列出可用场景（sceneId = 文件名去扩展名） */
  listSceneIds(): string[] {
    if (!existsSync(config.scenesDir)) return [];
    const fs = require('node:fs') as typeof import('node:fs');
    return fs
      .readdirSync(config.scenesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  }

  /**
   * 组装渲染任务所需的完整场景载荷：uiSkeleton + dataSource（含 mock 业务 API 地址）
   */
  assemble(sceneId: string): ScenePayload {
    const file = join(config.scenesDir, `${sceneId}.json`);
    if (!existsSync(file)) {
      throw new NotFoundException(`场景不存在: ${sceneId}`);
    }
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    // 场景文件可能是完整 AssemConfig 形态（{ uiSkeleton: {...} }）或裸 uiSkeleton —— 统一剥壳
    const uiSkeleton = (parsed && typeof parsed === 'object' && 'uiSkeleton' in parsed ? parsed.uiSkeleton : parsed) as Record<string, unknown>;
    const sceneName = Object.keys(uiSkeleton)[0];
    if (!sceneName) throw new NotFoundException(`场景 ${sceneId} 无 uiSkeleton 键`);

    const requestFns = SCENE_REQUEST_FNS[sceneId] ?? {};
    return {
      sceneName,
      uiSkeleton,
      routerConfig: {},
      // mock 数据源（D1：浏览器内取数）。KV 模式无 paramsConfig 时请求不带参数，
      // mock 端点返回全量数据（transform 已把表格分页改写为全量单页）
      dataSource: {
        api: { config: {} },
        requestConfig: Object.fromEntries(
          Object.entries(requestFns).map(([name, rc]) => [
            name,
            {
              url: `${config.publicBaseUrl}${rc.url}`,
              method: rc.method,
              description: `mock ${name}（导出服务本地实现）`,
            },
          ]),
        ),
        dataModelConfig: {},
        sharedFns: {},
      },
    };
  }
}

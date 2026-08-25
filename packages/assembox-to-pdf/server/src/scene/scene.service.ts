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
/** 场景运行时配置（测试环境）：mock requestFn 映射 + 表单数据模型初值 */
export interface SceneRuntimeConfig {
  requestFns: Record<string, { url: string; method: 'GET' | 'POST' }>;
  /** dataModelConfig：字段 defaultValue 作为表单静态初值（data-model-builder 优先级：注入 > 默认值） */
  dataModelConfig?: Record<string, Record<string, unknown>>;
}

/**
 * 表单数据模型（测试环境初值）。
 * 结构：模型(weeklyForm) → 表(base) → 字段 → { defaultValue }，
 * 与 buildDataModel 的入参形状一致（模型内是表结构，字段配置在表下）。
 */
const WEEKLY_FORM_MODEL = {
  base: {
    projectName: { defaultValue: '智慧产业园一期项目' },
    period: { defaultValue: '2026-08-24 至 2026-08-30' },
    dept: { defaultValue: '工程管理部' },
    author: { defaultValue: '张桂芳' },
    weather: { defaultValue: 'normal' },
    overallStatus: { defaultValue: 'normal' },
    endDate: { defaultValue: '2027-06-30' },
    checkItems: { defaultValue: ['质量', '安全'], valueType: 'list' },
    nextWeekPlan: { defaultValue: '完成地下室底板浇筑收尾；启动 2# 塔吊基础施工；组织主体结构图纸会审与安全技术交底。' },
  },
};

const SCENE_CONFIGS: Record<string, SceneRuntimeConfig> = {
  'single-table-scene': {
    requestFns: { queryPayments: { url: '/internal/mock/payments', method: 'GET' } },
  },
  'chart-table-scene': {
    requestFns: { queryPaymentsLarge: { url: '/internal/mock/payments-large', method: 'GET' } },
  },
  'weekly-report-scene': {
    requestFns: { queryWeeklyItems: { url: '/internal/mock/weekly-items', method: 'GET' } },
    dataModelConfig: { weeklyForm: WEEKLY_FORM_MODEL },
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
   * 组装渲染任务所需的完整场景载荷：uiSkeleton + dataSource（含 mock 业务 API 地址与表单初值）
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

    const sceneCfg = SCENE_CONFIGS[sceneId] ?? { requestFns: {} };
    return {
      sceneName,
      uiSkeleton,
      routerConfig: {},
      // mock 数据源（D1：浏览器内取数）。KV 模式无 paramsConfig 时请求不带参数，
      // mock 端点返回全量数据（transform 已把表格分页改写为全量单页）
      dataSource: {
        api: { config: {} },
        requestConfig: Object.fromEntries(
          Object.entries(sceneCfg.requestFns).map(([name, rc]) => [
            name,
            {
              url: `${config.publicBaseUrl}${rc.url}`,
              method: rc.method,
              description: `mock ${name}（导出服务本地实现）`,
            },
          ]),
        ),
        dataModelConfig: sceneCfg.dataModelConfig ?? {},
        sharedFns: {},
      },
    };
  }
}

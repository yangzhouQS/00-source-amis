import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectRenderTypes, transformForPrint } from '../src';

const fixturePath = fileURLToPath(new URL('../../json-config/single-table-scene.json', import.meta.url));
/** 文件为完整 AssemConfig 形态：{ uiSkeleton: { singleTable: { viewsProps } } } */
const scene = JSON.parse(readFileSync(fixturePath, 'utf-8')).uiSkeleton;

function countNodes(value: unknown, renderType: string): number {
  let n = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, any>;
      if (o.__nodeOptions?.renderType === renderType) n++;
      Object.values(o).forEach(walk);
    }
  };
  walk(value);
  return n;
}

describe('transformForPrint：single-table-scene 实测', () => {
  const { scene: out, stats } = transformForPrint(scene, { rowLimit: 500 });

  it('剔除交互组件：YqToolBar / Button / YqAdvancedFilter', () => {
    expect(countNodes(out, 'YqToolBar')).toBe(0);
    expect(countNodes(out, 'Button')).toBe(0);
    expect(countNodes(out, 'YqAdvancedFilter')).toBe(0);
    // 工具栏整树剔除（其槽内按钮/筛选器随之消失，不单独计数）
    expect(stats.removed['YqToolBar']).toBe(1);
  });

  it('剔除 YqFilterItem 等筛选区组件（原挂在工具栏 filterSlot 下，随树移除）', () => {
    expect(countNodes(out, 'YqFilterItem')).toBe(0);
    expect(countNodes(out, 'Input')).toBe(0);
    expect(countNodes(out, 'Select')).toBe(0);
  });

  it('默认剔除导航条，keepNav: true 时保留', () => {
    expect(countNodes(out, 'YqNavigationBar')).toBe(0);
    const kept = transformForPrint(scene, { keepNav: true }).scene;
    expect(countNodes(kept, 'YqNavigationBar')).toBe(1);
  });

  it('dialogOptions 清空（弹层不属于打印内容）', () => {
    expect(scene.singleTable.viewsProps.dialogOptions.length).toBeGreaterThan(0);
    expect(out.singleTable.viewsProps.dialogOptions).toEqual([]);
    expect(stats.removed['Dialog']).toBe(scene.singleTable.viewsProps.dialogOptions.length);
  });

  it('YqTableAsync 分页改写为全量单页', () => {
    expect(countNodes(out, 'YqTableAsync')).toBe(1);
    const table = findFirst(out, 'YqTableAsync');
    expect(table.__nodeOptions.pagination).toEqual({
      currentSize: 500,
      pageSizes: [500],
      layout: 'total',
    });
    expect(table.__nodeOptions.columnConfigs.length).toBe(
      findFirst(scene, 'YqTableAsync').__nodeOptions.columnConfigs.length,
    );
    expect(stats.tableRewrites).toBe(1);
  });

  it('columnSlots（Tag/RawHtml 单元格渲染）保留', () => {
    const table = findFirst(out, 'YqTableAsync');
    expect(table.__nodeOptions.columnSlots.length).toBe(2);
    expect(countNodes(out, 'Tag')).toBe(1);
    expect(countNodes(out, 'RawHtml')).toBe(1);
  });

  it('根布局解除视口高度约束', () => {
    const root = out.singleTable.viewsProps.planeOptions;
    expect(root.__nodeOptions.height).toBe('auto');
  });

  it('未知 renderType 透传且上报', () => {
    const weird = {
      s: {
        viewsProps: {
          planeOptions: {
            __nodeOptions: { renderType: 'FutureGrid' },
            defaultSlot: { __nodeOptions: { renderType: 'YqLabel', content: 'x' } },
          },
        },
      },
    };
    const r = transformForPrint(weird as any);
    expect(r.stats.unknownRenderTypes).toContain('FutureGrid');
    expect(countNodes(r.scene, 'FutureGrid')).toBe(1);
    expect(countNodes(r.scene, 'YqLabel')).toBe(1);
  });

  it('纯函数：不修改输入场景', () => {
    const before = JSON.stringify(scene);
    transformForPrint(scene);
    expect(JSON.stringify(scene)).toBe(before);
  });

  it('幂等：重复变换结果一致', () => {
    const once = transformForPrint(scene).scene;
    const twice = transformForPrint(once).scene;
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it('变换后场景内不残留已剔除类型（collectRenderTypes 全量核对）', () => {
    const types = [...collectRenderTypes(out)];
    for (const t of ['YqToolBar', 'Button', 'YqAdvancedFilter', 'YqNavigationBar', 'Dialog', 'Input', 'Select', 'YqFilterItem', 'Form']) {
      expect(types).not.toContain(t);
    }
  });
});

describe('transformForPrint：Chart 改写', () => {
  const chartScene = {
    s: {
      viewsProps: {
        planeOptions: {
          __nodeOptions: { renderType: 'YqFlexBox', isRow: false, itemNum: 1, height: '100%' },
          itemConfig: [
            {
              isFixed: false,
              defaultSlot: {
                __nodeOptions: { renderType: 'Chart', g2PlotName: 'Column', width: '600px', options: { xField: 'm' } },
              },
            },
          ],
        },
      },
    },
  };

  it('注入 animation:false 且宽度 100%', () => {
    const { scene: out, stats } = transformForPrint(chartScene as any);
    const chart = findFirst(out, 'Chart');
    expect(chart.__nodeOptions.animation).toBeUndefined(); // 节点级不落
    expect(chart.__nodeOptions.options).toMatchObject({ animation: false, xField: 'm' });
    expect(chart.__nodeOptions.width).toBe('100%');
    expect(stats.chartRewrites).toBe(1);
  });
});

describe('transformForPrint：chart-table-scene 实测（图表 + 长表）', () => {
  const fixture = fileURLToPath(new URL('../../json-config/chart-table-scene.json', import.meta.url));
  const scene = JSON.parse(readFileSync(fixture, 'utf-8')).uiSkeleton;
  const { scene: out, stats } = transformForPrint(scene, { rowLimit: 2000 });

  it('3 个图表全部改写：animation:false 并入 G2Plot options，宽度 100%', () => {
    expect(countNodes(out, 'Chart')).toBe(3);
    expect(stats.chartRewrites).toBe(3);
    const pie = findByG2PlotName(out, 'Pie');
    expect(pie.__nodeOptions.options).toMatchObject({ animation: false, angleField: 'value' });
    // 图表静态 data 原样保留（G2Plot 数据源）
    expect(pie.__nodeOptions.data.length).toBe(4);
    const area = findByG2PlotName(out, 'Area');
    expect(area.__nodeOptions.options.animation).toBe(false);
    expect(area.__nodeOptions.data.length).toBe(6);
  });

  it('长表分页改写为全量（rowLimit 2000）且列/单元格插槽保留', () => {
    const table = findFirst(out, 'YqTableAsync');
    expect(table.__nodeOptions.pagination).toEqual({ currentSize: 2000, pageSizes: [2000], layout: 'total' });
    expect(table.__nodeOptions.requestFn).toBe('queryPaymentsLarge');
    expect(table.__nodeOptions.columnConfigs.length).toBe(13);
    expect(table.__nodeOptions.columnSlots.length).toBe(2);
  });

  it('剔除交互节点（场景内 onCurrentChange 联动的 Button 不存在）且图表行不被误删', () => {
    expect(countNodes(out, 'Button')).toBe(0);
    // 嵌套 YqFlexBox（图表并排行 isRow:true）保留
    expect(countNodes(out, 'YqFlexBox')).toBe(2);
  });
});

describe('transformForPrint：weekly-report-scene 实测（封皮+复杂表单+图表+300行表）', () => {
  const fixture = fileURLToPath(new URL('../../json-config/weekly-report-scene.json', import.meta.url));
  const scene = JSON.parse(readFileSync(fixture, 'utf-8')).uiSkeleton;
  const { scene: out, stats } = transformForPrint(scene, { rowLimit: 2000 });

  it('周报封皮（RawHtml 含 page-break-after）原样保留', () => {
    const cover = findFirst(out, 'RawHtml');
    expect(cover.__nodeOptions.content).toContain('page-break-after:always');
    expect(cover.__nodeOptions.content).toContain('智慧产业园一期项目周报');
  });

  it('复杂表单完整保留：Input/Select/RadioGroup/CheckboxGroup/DatePicker 全在', () => {
    expect(countNodes(out, 'Form')).toBe(1);
    expect(countNodes(out, 'FormItem')).toBe(9);
    for (const t of ['Input', 'Select', 'RadioGroup', 'CheckboxGroup', 'DatePicker']) {
      expect(countNodes(out, t)).toBeGreaterThan(0);
    }
  });

  it('4 个图表改写：animation:false 且静态 data 保留', () => {
    expect(stats.chartRewrites).toBe(4);
    for (const name of ['Column', 'Pie', 'Line', 'Area']) {
      const chart = findByG2PlotName(out, name);
      expect(chart.__nodeOptions.options.animation).toBe(false);
      expect(chart.__nodeOptions.width).toBe('100%');
      expect(chart.__nodeOptions.data.length).toBeGreaterThan(0);
    }
  });

  it('300 行日志表改写为全量且列/插槽保留', () => {
    const table = findFirst(out, 'YqTableAsync');
    expect(table.__nodeOptions.requestFn).toBe('queryWeeklyItems');
    expect(table.__nodeOptions.pagination).toEqual({ currentSize: 2000, pageSizes: [2000], layout: 'total' });
    expect(table.__nodeOptions.columnConfigs.length).toBe(12);
    expect(countNodes(out, 'Tag')).toBe(1);
  });

  it('幂等 + 纯函数', () => {
    const before = JSON.stringify(scene);
    const once = transformForPrint(scene).scene;
    expect(JSON.stringify(transformForPrint(once).scene)).toBe(JSON.stringify(transformForPrint(once).scene));
    expect(JSON.stringify(scene)).toBe(before);
  });
});

function findFirst(value: unknown, renderType: string): Record<string, any> {
  let found: Record<string, any> | undefined;
  const walk = (v: unknown): void => {
    if (found) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, any>;
      if (o.__nodeOptions?.renderType === renderType) {
        found = o;
        return;
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(value);
  if (!found) throw new Error(`renderType ${renderType} not found`);
  return found;
}

/** Chart 节点按 g2PlotName 定位（Column/Pie/Area 同为 renderType: Chart） */
function findByG2PlotName(value: unknown, g2PlotName: string): Record<string, any> {
  let found: Record<string, any> | undefined;
  const walk = (v: unknown): void => {
    if (found) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      const o = v as Record<string, any>;
      if (o.__nodeOptions?.renderType === 'Chart' && o.__nodeOptions.g2PlotName === g2PlotName) {
        found = o;
        return;
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(value);
  if (!found) throw new Error(`Chart ${g2PlotName} not found`);
  return found;
}

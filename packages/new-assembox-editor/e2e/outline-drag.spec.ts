import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * 大纲树拖拽统一到 Dragon（三期）e2e 套件
 * 对应设计文档 §9.2 场景表（new-docs/outline-drag-unification-design.md）
 *
 * 模拟方式（AGENTS drag/ 已验证经验）：
 * - 真实 CDP 鼠标输入（page.mouse）：buttons 状态天然正确，跨 iframe 派发自动路由
 * - 抖动 >4px 触发 dragstart；断言用 schema 落点（window.editor），不只看高亮
 * - goto 用 domcontentloaded：head 里 CDN 外联会阻塞 load 事件
 *
 * 环境依赖：demo 入口把 editor 挂在 window.editor 上（断言探针）
 */

const OUTLINE_DOCK = ".lc-assem-workbench__left-area .lc-assem-dock";
const LEFT_TREE_ROW = ".lc-assem-workbench__left-fixed-pane [data-node-id]";
const RIGHT_AREA = ".lc-assem-workbench__right-area";
const PALETTE_ITEM = ".lc-assem-component-pane [class*='__item']";

/** 打开编辑器并等待骨架就绪 */
async function bootEditor(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => {
      const w = window as any;
      return !!w.editor?.store?.state?.ready;
    },
    undefined,
    { timeout: 30_000 },
  );
  // 等左侧面板渲染稳定
  await expect(page.getByText("组件库").first()).toBeVisible({ timeout: 15_000 });
}

/** 打开左侧大纲（master）面板 */
async function openOutline(page: Page): Promise<void> {
  await page.locator(OUTLINE_DOCK, { hasText: "大纲" }).first().click();
  await page.waitForSelector(LEFT_TREE_ROW, { timeout: 10_000 });
}

/** schema 查询探针 */
async function evalEditor<T>(page: Page, fn: string, arg?: unknown): Promise<T> {
  return page.evaluate(
    `((arg) => { const ed = window.editor; const fn = ${fn}; return fn(ed, arg); })(${JSON.stringify(arg)})`,
  ) as Promise<T>;
}

const parentOf = `(ed, id) => {
  const p = ed.schemaOps.getParentById(ed.store.schema, id);
  return p ? ed.schemaOps.getNodeId(p) : null;
}`;
const countNodes = `(ed) => {
  let n = 0; ed.schemaOps.walk(ed.store.schema, () => n++); return n;
}`;
const renderTypeOf = `(ed, id) =>
  ed.schemaOps.getNodeById(ed.store.schema, id)?.__nodeOptions?.renderType ?? null`;
const slotIndexOf = `(ed, id) => {
  const loc = ed.schemaOps.findSlotOf(ed.store.schema, id);
  return loc ? { parentId: loc.parentId, slotKey: loc.slotKey, index: loc.index } : null;
}`;
const activeId = `(ed) => ed.store.state.activeId`;
const dragonState = `(ed) => ({
  dragging: ed.dragon.dragging,
  lastSource: ed.dragon.lastLocation?.source ?? null,
  lastDropMode: ed.dragon.lastLocation?.dropMode ?? null,
  lastContainerId: ed.dragon.lastLocation?.containerId ?? null,
})`;

/** 真实鼠标拖拽：from → to（toRatioY 为目标行内纵向比例，0.15=before / 0.5=inner / 0.85=after） */
async function mouseDrag(
  page: Page,
  from: Locator,
  to: Locator | { x: number; y: number },
  opts: { toRatioY?: number; copy?: boolean; esc?: boolean } = {},
): Promise<void> {
  const f = await from.boundingBox();
  const t = "boundingBox" in to ? await to.boundingBox() : to;
  if (!f || !t) {
    throw new Error("mouseDrag: boundingBox 为空");
  }
  const fx = f.x + f.width / 2;
  const fy = f.y + f.height / 2;
  const ratio = opts.toRatioY ?? 0.5;
  // to 为 Locator 时按行内比例取点；为点坐标对象（含 width/height 字段）时直接使用
  const isPoint = !("width" in t) || t.width === undefined;
  const tx = isPoint ? t.x : t.x + t.width / 2;
  const ty = isPoint ? t.y : t.y + t.height * ratio;

  await page.mouse.move(fx, fy);
  await page.mouse.down();
  // 抖动 >4px 触发 dragstart
  await page.mouse.move(fx + 14, fy + 8, { steps: 3 });
  await page.waitForTimeout(150);
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.waitForTimeout(200);
  if (opts.esc) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    await page.mouse.up();
    return;
  }
  if (opts.copy) {
    await page.keyboard.down("Control");
  }
  await page.mouse.up();
  if (opts.copy) {
    await page.keyboard.up("Control");
  }
  await page.waitForTimeout(250);
}

// ══════════════════════════════════════════════════════════
// A 组：大纲未打开（走右区 backup 面板）
// ══════════════════════════════════════════════════════════

test.describe("拖拽右区切换（一期）", () => {
  test("面板拖拽时右区切换为大纲树，结束后恢复属性面板", async ({ page }) => {
    await bootEditor(page);
    const item = page.locator(PALETTE_ITEM).first();
    const f = await item.boundingBox();
    expect(f).toBeTruthy();

    await page.mouse.move(f!.x + f!.width / 2, f!.y + f!.height / 2);
    await page.mouse.down();
    await page.mouse.move(f!.x + f!.width / 2 + 14, f!.y + f!.height / 2 + 8, { steps: 3 });
    await page.waitForTimeout(250);

    // 拖拽中：右区出现大纲树（backup）
    const backupDuring = await page.evaluate(() => {
      const el = document.querySelector(".lc-assem-workbench__right-area .lc-assem-outline-pane");
      return !!el && (el.offsetWidth > 0 || el.offsetHeight > 0);
    });
    expect(backupDuring).toBeTruthy();

    await page.mouse.up();
    await page.waitForTimeout(300);

    // 结束后：backup 隐藏、settings 恢复激活
    const after = await page.evaluate(() => {
      const el = document.querySelector(".lc-assem-workbench__right-area .lc-assem-outline-pane");
      return {
        backupVisible: !!el && (el.offsetWidth > 0 || el.offsetHeight > 0),
        settingsActive: !!(window as any).editor?.skeleton?.getPanel?.("settingsPanel")?.active,
      };
    });
    expect(after.backupVisible).toBeFalsy();
    expect(after.settingsActive).toBeTruthy();
  });

  test("左侧大纲已打开时去重：拖拽不弹 backup（R7）", async ({ page }) => {
    await bootEditor(page);
    await openOutline(page);

    const row = page.locator(LEFT_TREE_ROW).nth(1);
    await mouseDrag(page, row, page.locator(LEFT_TREE_ROW).first(), { toRatioY: 0.15 });
    await page.waitForTimeout(200);

    const backupVisible = await page.evaluate(() => {
      const el = document.querySelector(".lc-assem-workbench__right-area .lc-assem-outline-pane");
      return !!el && (el.offsetWidth > 0 || el.offsetHeight > 0);
    });
    expect(backupVisible).toBeFalsy();
  });
});

// ══════════════════════════════════════════════════════════
// B 组：面板 → 树投放（OutlineSensor nodeData）
// ══════════════════════════════════════════════════════════

test.describe("面板拖入大纲树（二期 sensor）", () => {
  test("inner 投放：拖到树行中点，schema 落点为目标容器 defaultSlot", async ({ page }) => {
    await bootEditor(page);
    // 触发 backup 出现（拖拽中才有右区树）——面板拖拽目标取 backup 树第一行（场景根）
    const item = page.locator(PALETTE_ITEM).first();
    const f = await item.boundingBox();
    await page.mouse.move(f!.x + f!.width / 2, f!.y + f!.height / 2);
    await page.mouse.down();
    await page.mouse.move(f!.x + f!.width / 2 + 14, f!.y + f!.height / 2 + 8, { steps: 3 });
    await page.waitForTimeout(300); // backup 挂载

    const row = page.locator(`${RIGHT_AREA} [data-node-id]`).first();
    const targetId = await row.getAttribute("data-node-id");
    expect(targetId).toBeTruthy();

    const before = await evalEditor<number>(page, countNodes);
    const c = await rowCenter(page, row, 0.5);
    await page.mouse.move(c[0], c[1]);
    await page.waitForTimeout(200);
    // lastLocation 在 mouseup 后会被 dragon 清空——投放前读取
    const locBeforeUp = await evalEditor<any>(page, dragonState);
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await evalEditor<number>(page, countNodes);
    expect(after).toBe(before + 1);
    expect(locBeforeUp).toMatchObject({
      lastSource: "outline",
      lastDropMode: "inner",
      lastContainerId: targetId,
    });
  });

  test("ESC 取消：schema 零变更、无残留高亮", async ({ page }) => {
    await bootEditor(page);
    const item = page.locator(PALETTE_ITEM).first();
    const f = await item.boundingBox();
    await page.mouse.move(f!.x + f!.width / 2, f!.y + f!.height / 2);
    await page.mouse.down();
    await page.mouse.move(f!.x + f!.width / 2 + 14, f!.y + f!.height / 2 + 8, { steps: 3 });
    await page.waitForTimeout(300);

    const row = page.locator(`${RIGHT_AREA} [data-node-id]`).first();
    const before = await evalEditor<number>(page, countNodes);

    const c = await rowCenter(page, row, 0.5);
    await page.mouse.move(c[0], c[1], { steps: 5 });
    await page.waitForTimeout(150);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await evalEditor<number>(page, countNodes);
    expect(after).toBe(before);
    const ghostGone = await page.evaluate(
      () => !document.querySelector(".lc-assem-drag-ghost") ||
        getComputedStyle(document.querySelector(".lc-assem-drag-ghost")!).display === "none",
    );
    expect(ghostGone).toBeTruthy();
  });
});

/** 行中心坐标（ratio 为纵向比例） */
async function rowCenter(page: Page, row: Locator, ratioY: number): Promise<[number, number]> {
  const bb = await row.boundingBox();
  if (!bb) {
    throw new Error("rowCenter: 无 boundingBox");
  }
  return [bb.x + bb.width / 2, bb.y + bb.height * ratioY];
}

// ══════════════════════════════════════════════════════════
// C 组：树内拖拽（三期 node 型）
// ══════════════════════════════════════════════════════════

test.describe("树内拖拽（三期统一 Dragon）", () => {
  test.beforeEach(async ({ page }) => {
    await bootEditor(page);
    await openOutline(page);
  });

  test("before 平级拖动：同父槽内相对序反转", async ({ page }) => {
    // 找同父的相邻兄弟对（排除 Q1 间接容器子节点）
    const pair = await page.evaluate(() => {
      const ed = (window as any).editor;
      const rows = [...document.querySelectorAll(
        ".lc-assem-workbench__left-fixed-pane [data-node-id]",
      )];
      const ids = rows.map(r => r.getAttribute("data-node-id")!);
      const groups = new Map<string, string[]>();
      for (const id of ids) {
        const loc = ed.schemaOps.findSlotOf(ed.store.schema, id);
        if (!loc) {
          continue;
        }
        const parent = ed.schemaOps.getNodeById(ed.store.schema, loc.parentId);
        // Q1：间接容器子槽的平级拖动被拒，排除
        const indirect = parent?.__nodeOptions?.itemConfig || parent?.__nodeOptions?.tabPane;
        const isCellChild = loc.slotKey === "defaultSlot" && Array.isArray(indirect);
        if (isCellChild) {
          continue;
        }
        const key = `${loc.parentId}::${loc.slotKey}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(id);
      }
      for (const [, list] of groups) {
        if (list.length >= 2) {
          // 按 schema index 排序取前两个
          const withIdx = list.map(id => ({
            id,
            index: ed.schemaOps.findSlotOf(ed.store.schema, id)!.index,
          })).sort((a, b) => a.index - b.index);
          return { earlier: withIdx[0].id, later: withIdx[1].id };
        }
      }
      return null;
    });
    test.skip(!pair, "demo schema 无可用的直接槽位兄弟对");

    const before = await evalEditor<any>(page, slotIndexOf, pair!.later);
    expect(before.index).toBeGreaterThan(0);

    const earlierRow = page.locator(`${LEFT_TREE_ROW}[data-node-id='${pair!.earlier}']`);
    const laterRow = page.locator(`${LEFT_TREE_ROW}[data-node-id='${pair!.later}']`);
    // 把"后面的"拖到"前面的"上沿 25%（before）
    await mouseDrag(page, laterRow, earlierRow, { toRatioY: 0.15 });

    const after = await evalEditor<any>(page, slotIndexOf, pair!.later);
    expect(after.parentId).toBe(before.parentId);
    expect(after.index).toBeLessThan(before.index);
  });

  test("拖入自身后代被拒：schema 零变更", async ({ page }) => {
    // 根节点（rows[0]）拖到其任意后代行中点
    const rows = page.locator(LEFT_TREE_ROW);
    const rootId = await rows.first().getAttribute("data-node-id");
    // 找一个深层后代（第 5 行以后）
    const descRow = rows.nth(Math.min(6, (await rows.count()) - 1));
    const descId = await descRow.getAttribute("data-node-id");
    const descendant = await evalEditor<boolean>(page, `(ed, arg) => {
      const [anc, tgt] = arg;
      let cur = ed.schemaOps.getParentById(ed.store.schema, tgt);
      while (cur) {
        if (ed.schemaOps.getNodeId(cur) === anc) return true;
        cur = ed.schemaOps.getParentById(ed.store.schema, ed.schemaOps.getNodeId(cur));
      }
      return false;
    }`, [rootId, descId]);
    test.skip(!descendant, "目标行不是根的后代");

    const before = await evalEditor<number>(page, countNodes);
    const beforeParent = await evalEditor<string | null>(page, parentOf, rootId);
    await mouseDrag(page, rows.first(), descRow, { toRatioY: 0.5 });

    const after = await evalEditor<number>(page, countNodes);
    const afterParent = await evalEditor<string | null>(page, parentOf, rootId);
    expect(after).toBe(before);
    expect(afterParent).toBe(beforeParent);
  });

  test("Ctrl 按住投放：克隆落位、原节点保留（D4 copy）", async ({ page }) => {
    // 叶子行拖到根行中点（inner），Ctrl 按住
    const rows = page.locator(LEFT_TREE_ROW);
    const rootId = await rows.first().getAttribute("data-node-id");
    // 找一个不属于根直接子级的叶子（避免原地豁免歧义）：取深层行
    const leafRow = rows.nth(Math.min(5, (await rows.count()) - 1));
    const leafId = await leafRow.getAttribute("data-node-id");
    const leafRT = await evalEditor<string>(page, renderTypeOf, leafId);
    const beforeCount = await evalEditor<number>(page, countNodes);
    const beforeParent = await evalEditor<string | null>(page, parentOf, leafId);

    await mouseDrag(page, leafRow, rows.first(), { toRatioY: 0.5, copy: true });

    // 原节点保留在原位
    expect(await evalEditor<string | null>(page, parentOf, leafId)).toBe(beforeParent);
    // schema 多出一个同 renderType 克隆（scaffold 落位可能带子节点，宽松断言：总数增加）
    const afterCount = await evalEditor<number>(page, countNodes);
    expect(afterCount).toBeGreaterThan(beforeCount);
    void leafRT;
    void rootId;
  });

  test("点击树行（<4px 位移）选中、不触发拖拽", async ({ page }) => {
    const row = page.locator(LEFT_TREE_ROW).nth(1);
    const id = await row.getAttribute("data-node-id");
    const bb = await row.boundingBox();
    await page.mouse.move(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2);
    await page.mouse.down();
    await page.mouse.move(bb!.x + bb!.width / 2 + 1, bb!.y + bb!.height / 2 + 1); // 1px < 4px
    await page.mouse.up();
    await page.waitForTimeout(200);

    expect(await evalEditor<string | null>(page, activeId)).toBe(id);
  });

  test("按住删除按钮拖动不拖起节点（D1 豁免）", async ({ page }) => {
    const row = page.locator(LEFT_TREE_ROW).nth(1);
    const id = await row.getAttribute("data-node-id");
    // hover 出删除按钮
    const bb = await row.boundingBox();
    await page.mouse.move(bb!.x + bb!.width / 2, bb!.y + bb!.height / 2);
    await page.waitForTimeout(300);
    const del = row.locator("[class*='node-actions'] button").first();
    const delBB = await del.boundingBox();
    test.skip(!delBB, "删除按钮不可见");

    const before = await evalEditor<number>(page, countNodes);
    await page.mouse.move(delBB!.x + delBB!.width / 2, delBB!.y + delBB!.height / 2);
    await page.mouse.down();
    await page.mouse.move(delBB!.x + delBB!.width / 2 + 30, delBB!.y + 20, { steps: 3 });
    const draggingMid = await evalEditor<boolean>(page, `(ed) => ed.dragon.dragging`);
    await page.mouse.up();
    await page.waitForTimeout(200);

    expect(draggingMid).toBeFalsy();
    expect(await evalEditor<number>(page, countNodes)).toBe(before);
    void id;
  });

  test("树 → 画布移动：拖到 iframe 根容器，无引擎挂起（D6/R1 守护）", async ({ page }) => {
    const rows = page.locator(LEFT_TREE_ROW);
    // 选深层叶子（非根直接子级），避免原地
    const leafRow = rows.nth(Math.min(5, (await rows.count()) - 1));
    const leafId = await leafRow.getAttribute("data-node-id");
    const beforeParent = await evalEditor<string | null>(page, parentOf, leafId);

    // 画布 iframe 根节点
    const canvasRoot = page.frameLocator("iframe").first().locator("[data-editor-id]").first();
    const cb = await canvasRoot.boundingBox();
    test.skip(!cb, "画布根节点不可见");

    await mouseDrag(page, leafRow, { x: cb!.x + cb!.width / 2, y: cb!.y + Math.min(cb!.height / 2, 200) }, {});

    const st = await evalEditor<any>(page, dragonState);
    expect(st.dragging).toBeFalsy(); // R1：未挂起
    const afterParent = await evalEditor<string | null>(page, parentOf, leafId);
    // 落点允许断言：父级变化（移动成功）或维持（嵌套校验拒绝），二者皆可，但引擎必须正常结束
    void beforeParent;
    void afterParent;
  });
});

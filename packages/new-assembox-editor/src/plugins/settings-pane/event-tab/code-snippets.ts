/**
 * 事件代码片段配置（参考旧版 func-editor-dialog/config/*）
 *
 * 每个片段 = { name, description, category, params, generate }
 * - params: 声明参数表单（label + type + options）
 * - generate: (values) => 插入编辑器的代码字符串
 *
 * ctx 契约对齐新版渲染层（use-node-events.ts EventContext）：
 *   ctx.getNode(id) / ctx.$dataModels / ctx.$sharedFns / ctx.$globalVars / ctx.$requestFns
 */

export interface SnippetParam {
  key: string;
  label: string;
  type: "text" | "select" | "model";
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface CodeSnippet {
  name: string;
  description: string;
  category: string;
  params: SnippetParam[];
  generate: (values: Record<string, string>) => string;
}

export const SNIPPET_CATEGORIES = [
  "节点操作",
  "数据模型",
  "共享方法",
  "路由跳转",
  "消息通知",
  "数据请求",
] as const;

export const codeSnippets: CodeSnippet[] = [
  // ── 节点操作 ──
  {
    name: "获取节点实例",
    description: "按 nodeId 获取目标组件的 exposed 实例（调用其方法/读取状态）",
    category: "节点操作",
    params: [{ key: "nodeId", label: "节点 ID", type: "text", placeholder: "YqTableAsync::xxx" }],
    generate: v => `const node = ctx.getNode('${v.nodeId || "NODE_ID"}');`,
  },
  {
    name: "调用节点方法",
    description: "获取节点实例并调用其暴露的方法（如 reloadData / clearFilterState）",
    category: "节点操作",
    params: [
      { key: "nodeId", label: "节点 ID", type: "text", placeholder: "YqTableAsync::xxx" },
      { key: "method", label: "方法名", type: "text", placeholder: "reloadData" },
    ],
    generate: v => {
      const id = v.nodeId || "NODE_ID";
      const m = v.method || "METHOD";
      return `const node = ctx.getNode('${id}');\nif (node) {\n  node.${m}();\n}`;
    },
  },
  {
    name: "刷新表格",
    description: "获取表格节点并重新加载数据",
    category: "节点操作",
    params: [{ key: "nodeId", label: "表格节点 ID", type: "text", placeholder: "YqTableAsync::xxx" }],
    generate: v => {
      const id = v.nodeId || "TABLE_NODE_ID";
      return `const table = ctx.getNode('${id}');\nif (table) {\n  table.reloadData();\n}`;
    },
  },

  // ── 数据模型 ──
  {
    name: "读取模型值",
    description: "从 $dataModels 读取指定路径的数据",
    category: "数据模型",
    params: [{ key: "path", label: "模型路径", type: "model", placeholder: "advancedFilter.singleTable" }],
    generate: v => `const value = ctx.$dataModels.${v.path || "MODEL.PATH"};`,
  },
  {
    name: "写入模型值",
    description: "向 $dataModels 写入数据（触发关联组件响应式更新）",
    category: "数据模型",
    params: [{ key: "path", label: "模型路径", type: "model", placeholder: "advancedFilter.singleTable" }],
    generate: v => `ctx.$dataModels.${v.path || "MODEL.PATH"} = [];`,
  },
  {
    name: "清空模型",
    description: "将指定模型重置为空对象",
    category: "数据模型",
    params: [{ key: "name", label: "模型名", type: "model", placeholder: "advancedFilter" }],
    generate: v => `ctx.$assemCore.setForm('${v.name || "MODEL_NAME"}');`,
  },

  // ── 共享方法 ──
  {
    name: "调用共享方法",
    description: "调用数据源面板定义的共享方法（含请求类方法）",
    category: "共享方法",
    params: [
      { key: "fnName", label: "方法名", type: "text", placeholder: "searchTable" },
      { key: "args", label: "参数（可选）", type: "text", placeholder: "留空则传 ctx" },
    ],
    generate: v => {
      const fn = v.fnName || "FN_NAME";
      const arg = v.args?.trim() || "ctx";
      return `await ctx.$sharedFns.${fn}(${arg});`;
    },
  },

  // ── 路由跳转 ──
  {
    name: "页面跳转",
    description: "跳转到指定 URL",
    category: "路由跳转",
    params: [{ key: "url", label: "目标地址", type: "text", placeholder: "/detail-page" }],
    generate: v => `window.location.href = '${v.url || "/TARGET_URL"}';`,
  },

  // ── 消息通知 ──
  {
    name: "成功提示",
    description: "显示成功消息",
    category: "消息通知",
    params: [{ key: "message", label: "消息内容", type: "text", placeholder: "操作成功" }],
    generate: v => `ctx.notify('success', '${v.message || "操作成功"}');`,
  },
  {
    name: "错误提示",
    description: "显示错误消息",
    category: "消息通知",
    params: [{ key: "message", label: "消息内容", type: "text", placeholder: "操作失败" }],
    generate: v => `ctx.notify('error', '${v.message || "操作失败"}');`,
  },

  // ── 数据请求 ──
  {
    name: "调用请求方法",
    description: "调用数据源面板定义的请求方法并处理结果",
    category: "数据请求",
    params: [
      { key: "fnName", label: "请求方法名", type: "text", placeholder: "getTableData" },
      { key: "params", label: "请求参数", type: "text", placeholder: '{ page: 1 }' },
    ],
    generate: v => {
      const fn = v.fnName || "REQUEST_FN";
      const params = v.params?.trim() || "{}";
      return `const res = await ctx.$requestFns.${fn}(${params});\nconsole.log('result:', res);`;
    },
  },
];

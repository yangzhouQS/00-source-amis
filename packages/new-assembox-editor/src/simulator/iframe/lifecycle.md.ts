/**
 * iframe 渲染生命周期 + 通信流程（设计说明）
 *
 * ══════════ 阶段一：iframe 创建与握手 ══════════
 *
 *  Host                                    Iframe (canvas.html)
 *   │                                            │
 *   │  1. 创建 <iframe src="canvas.html">         │
 *   │───────────────────────────────────────────►│  加载 canvas.html
 *   │                                            │  执行 iframe-renderer-entry.ts
 *   │  2. 设置 win.__ASSEM_HOST__ = hostApi       │
 *   │───────────────────────────────────────────►│  读取 hostApi，构造 SimulatorRenderer
 *   │                                            │  注册 Element Plus + 渲染组件
 *   │                                            │  win.__ASSEM_RENDERER__ = renderer
 *   │  3. 监听 iframe 'load' / 轮询 __ASSEM_RENDERER__  │
 *   │◄───────────────────────────────────────────│  ready 标志就绪
 *   │  4. host 拿到 renderer 引用                  │
 *   │                                            │
 *   ══════════ 阶段二：初始化渲染 ══════════
 *   │                                            │
 *   │  5. renderer.init({ schema, components })   │
 *   │───────────────────────────────────────────►│  构建 Vue app，渲染 SchemaRenderer
 *   │                                            │  每个 onMounted：stamp data-editor-id
 *   │                                            │  注册到实例树
 *   │  6. host.onRendererReady()                  │
 *   │◄───────────────────────────────────────────│  触发 SIMULATOR_READY 事件
 *   │  7. host 绑定事件路由（mousedown/click/      │
 *   │     mouseover/scroll），挂载 BemTools        │
 *   │                                            │
 *   ══════════ 阶段三：交互循环（稳态） ══════════
 *   │                                            │
 *   │  用户操作 → host 改 schema                   │
 *   │  8. renderer.updateNode/insertNode/...       │
 *   │───────────────────────────────────────────►│  局部更新 DOM（响应式）
 *   │                                            │
 *   │  画布内点击/悬浮                             │
 *   │  9. host.onNodeClick/onNodeHover             │
 *   │◄───────────────────────────────────────────│  iframe 内 closest('[data-editor-id]')
 *   │  BemTools 定位：renderer.getRect(nodeId)     │
 *   │───────────────────────────────────────────►│  返回 getBoundingClientRect()
 *   │                                            │
 *   ══════════ 阶段四：销毁 ══════════
 *   │                                            │
 *   │  10. renderer.dispose() / iframe 移除        │
 *   │───────────────────────────────────────────►│  unmount Vue app，清空全局引用
 *
 * ══════════ 依赖管理 ══════════
 *  - iframe 依赖（Element Plus 等）由 canvas.html 通过 <script>/<link> 加载，
 *    或由 host 通过 AssetRegistry 注入（动态组件库场景）。
 *  - 组件映射 components: ComponentMapping[] 告诉 renderer：node.type → 全局组件名。
 *
 * ══════════ 坐标系 ══════════
 *  - iframe 内部坐标 = 逻辑坐标（无缩放）。
 *  - host 缩放通过 iframe 元素 transform: scale() 实现，transform-origin: 0 0。
 *  - 覆盖层定位：rect.left/top * scale + viewportOffset。
 */
export {};

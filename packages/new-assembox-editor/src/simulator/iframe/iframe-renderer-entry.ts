/**
 * iframe 渲染器入口（运行于 canvas.html 内部）
 *
 * 职责：
 *  1. 读取 host 暴露的 hostApi（win.__ASSEM_HOST__）
 *  2. 注册 Element Plus 与全局组件解析器
 *  3. 构造 IframeSimulatorRenderer 并挂到 win.__ASSEM_RENDERER__
 *  4. 兼容 postMessage 协议（跨源场景）
 *
 * 通信握手：
 *  - host 在创建 iframe 后设置 win.__ASSEM_HOST__ = hostApi
 *  - 本入口读取后注册 renderer，host 通过 load 事件/轮询拿到 win.__ASSEM_RENDERER__
 */
import {createApp} from 'vue';
import ElementPlus from 'element-plus';
import * as ElementPlusComponents from 'element-plus';
import 'element-plus/dist/index.css';
import {IframeSimulatorRenderer} from './simulator-renderer';
import type {SimulatorHostApi, HostMessage, ProtocolEnvelope} from './protocol';
import {PROTOCOL_NS, isProtocolEnvelope, HOST_CMD} from './protocol';
import './iframe-renderer.less';

const win = window as any;

/** 组件解析器：globalName → 组件实例（优先 Element Plus 全局） */
function createComponentResolver() {
  return (globalName: string): any => {
    // Element Plus 组件（ElButton / ElInput / ElCard ...）
    if (globalName in ElementPlusComponents) {
      return (ElementPlusComponents as any)[globalName];
    }
    // 自定义全局组件（业务库通过 AssetRegistry 注入后挂在 window）
    if (globalName in win) {
      return win[globalName];
    }
    return null;
  };
}

function bootstrap(): void {
  // 等待 hostApi 注入
  const getHostApi = (): SimulatorHostApi | null => win.__ASSEM_HOST__ ?? null;
  let hostApi = getHostApi();

  const renderer = new IframeSimulatorRenderer(hostApi ?? undefined);
  renderer.setComponentResolver(createComponentResolver());

  // 暴露 renderer 供 host 直引
  win.__ASSEM_RENDERER__ = renderer;

  // 兼容 postMessage 协议（跨源）
  win.addEventListener('message', (event: MessageEvent) => {
    const data = event.data;
    if (!isProtocolEnvelope(data) || data.from !== 'host') return;
    handleHostMessage(renderer, data.message as HostMessage, () =>
      getHostApi()
    );
  });

  // hostApi 延迟注入兜底：轮询
  if (!hostApi) {
    const timer = win.setInterval(() => {
      hostApi = getHostApi();
      if (hostApi) {
        renderer.setHostApi(hostApi);
        win.clearInterval(timer);
      }
    }, 16);
  }

  // 销毁清理
  win.addEventListener('beforeunload', () => {
    win.__ASSEM_RENDERER__ = null;
    renderer.dispose();
  });
}

/** 处理 host 命令（postMessage 模式） */
function handleHostMessage(
  renderer: IframeSimulatorRenderer,
  msg: HostMessage,
  getHostApi: () => SimulatorHostApi | null
): void {
  const p = msg.payload ?? {};
  switch (msg.type) {
    case HOST_CMD.INIT:
      renderer.init(p);
      break;
    case HOST_CMD.RENDER_SCHEMA:
      renderer.renderSchema(p.schema);
      break;
    case HOST_CMD.UPDATE_NODE:
      renderer.updateNode(p.nodeId, p.patch);
      break;
    case HOST_CMD.INSERT_NODE:
      renderer.insertNode(p.parentId, p.region, p.node, p.index);
      break;
    case HOST_CMD.MOVE_NODE:
      renderer.moveNode(p.nodeId, p.toParentId, p.region, p.index);
      break;
    case HOST_CMD.REMOVE_NODE:
      renderer.removeNode(p.nodeId);
      break;
    case HOST_CMD.SET_DRAGGING:
      renderer.setDraggingState(p.active);
      break;
    case HOST_CMD.SET_COMPONENTS:
      renderer.setComponents(p.components);
      break;
    case HOST_CMD.SET_DESIGN_MODE:
      renderer.setDesignMode(p.mode);
      break;
    case HOST_CMD.RERENDER:
      renderer.rerender();
      break;
    default:
      break;
  }
  void getHostApi;
}

bootstrap();

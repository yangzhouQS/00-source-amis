import type { Editor } from "../../../core/editor";
/**
 * 模型引用检查：扫描服务配置绑定 + 画布节点 modelName 前缀引用
 * 删除/重命名模型前调用，产出引用点列表供确认弹窗展示
 */

export interface DsReference {
  type: "service" | "node";
  name: string;
  detail: string;
}

/** 查找引用指定模型的位置 */
export function scanModelReferences(
  editor: Editor,
  modelName: string,
): DsReference[] {
  const refs: DsReference[] = [];
  const ds = editor.dataSource;

  // 1. 服务配置：paramsConfig.dataModelName / advancedFilterModelName
  if (ds?.requestConfig && typeof ds.requestConfig === "object") {
    for (const [id, raw] of Object.entries<any>(ds.requestConfig)) {
      const pc = raw?.paramsConfig;
      if (!pc) {
        continue;
      }
      if (pc.dataModelName === modelName) {
        refs.push({ type: "service", name: id, detail: "paramsConfig.dataModelName" });
      }
      if (pc.advancedFilterModelName === modelName) {
        refs.push({ type: "service", name: id, detail: "paramsConfig.advancedFilterModelName" });
      }
    }
  }

  // 2. 画布节点：__nodeOptions.modelName 以 `${modelName}.` 开头
  const prefix = `${modelName}.`;
  const walk = (node: any): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.__nodeOptions?.renderType) {
      const mn = node.__nodeOptions.modelName;
      if (typeof mn === "string" && (mn === modelName || mn.startsWith(prefix))) {
        refs.push({
          type: "node",
          name: node.__nodeName ?? node.__nodeId ?? "?",
          detail: `modelName: ${mn}`,
        });
      }
      // 子节点藏在直接槽位/间接容器（slot-accessors 契约）
      const opts = node.__nodeOptions;
      for (const slotField of ["defaultSlot", "toolSlot", "filterSlot", "headerSlot", "bottomSlot", "labelSlot", "rightSlot"]) {
        const v = (opts as any)[slotField];
        if (Array.isArray(v)) {
          v.forEach(walk);
        }
        else if (v) {
          walk(v);
        }
      }
      for (const arrField of ["itemConfig", "tabPane", "buttonGroupOptions", "columnSlots"]) {
        const arr = (opts as any)[arrField];
        if (!Array.isArray(arr)) {
          continue;
        }
        for (const entry of arr) {
          for (const childProp of ["defaultSlot", "buttonOption", "columRender"]) {
            const child = entry?.[childProp];
            if (Array.isArray(child)) {
              child.forEach(walk);
            }
            else if (child) {
              walk(child);
            }
          }
        }
      }
    }
    else if (Array.isArray(node)) {
      node.forEach(walk);
    }
  };
  const schema = editor.store?.schema;
  if (schema && typeof schema === "object") {
    for (const scene of Object.values<any>(schema)) {
      const vp = scene?.viewsProps;
      if (!vp) {
        continue;
      }
      walk(vp.planeOptions);
      for (const docArr of ["dialogOptions", "drawerOptions", "tabOptions"]) {
        if (Array.isArray(vp[docArr])) {
          vp[docArr].forEach(walk);
        }
      }
    }
  }

  return refs;
}

/**
 * PC 场景空 schema 模板
 * 结构与 assembox-desktop-next 的 AssemPlugin 期望一致
 */

let counter = 0;

function shortId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}`;
}

export function createPcEmptySchema(sceneName = 'main'): any {
  return {
    [sceneName]: {
      viewsProps: {
        planeOptions: {
          __nodeName: 'root',
          __nodeId: `FlexBox::root-${shortId()}`,
          __nodeType: 'renderNode',
          __nodeEvent: {},
          __nodeOptions: {
            renderType: 'FlexBox',
            isRow: false,
            itemNum: 1,
            width: '100%',
            height: '100%',
            itemConfig: [
              {
                isFixed: false,
                size: '',
                paddingSize: 'base',
                clearPadding: [],
                isHidden: false,
                contentType: 'container',
                defaultSlot: null
              }
            ]
          }
        }
      }
    }
  };
}

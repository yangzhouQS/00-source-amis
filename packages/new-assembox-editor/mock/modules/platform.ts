/**
 * 宿主平台侧接口 mock（iframe 画布内组件会发出的请求）
 *
 * - /share-read/component-config/*：vue3-biz-components-library 的 table-setting /
 *   advanced-filter 个人配置读写（user-code-config 查询返回 null = 无个人配置，
 *   组件自动回退默认列配置；save/reset 直接落空操作）
 * - /mb-sharedata/orgs/getOrgsByParentId：组织树查询（返回空子级即可）
 */
import type { MockModule } from "../types";

export const platformModule: MockModule = {
  routes: [
    {
      method: "POST",
      url: "/share-read/component-config/user-code-config",
      description: "查询用户组件个人配置（table-setting / advanced-filter）。result=null → 组件走默认配置",
      delay: 120,
      handler: () => null,
    },
    {
      method: "POST",
      url: "/share-read/component-config/save-user-config",
      description: "保存用户组件个人配置（落空）",
      handler: () => true,
    },
    {
      method: "POST",
      url: "/share-read/component-config/reset-user-config",
      description: "重置用户组件个人配置（落空）",
      handler: () => true,
    },
    {
      method: "GET",
      url: "/mb-sharedata/orgs/getOrgsByParentId",
      description: "按父级查组织（返回空子级）",
      handler: ({ query }) => ({
        parentId: query.parentId ?? "0",
        list: [],
        count: 0,
      }),
    },
  ],
};

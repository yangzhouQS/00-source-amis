# 云阙平台 Web 开发框架使用参考指南

> **@cs/js-web-framework** - 云阙平台产品开发统一 Portal 框架


## 一、快速开始

### 安装

```bash
pnpm add @cs/js-web-framework@latest
```

### 基础依赖

```json
{
  "element-plus": "2.13.7",
  "@element-plus/icons-vue": "^2.x",
  "axios": "^1.x"
}
```

### 最小化初始化示例

```typescript
import { WebFramework } from "@cs/js-web-framework";
import App from "./App.vue";

new WebFramework({
  bodyComponent: App,  // 必填：主应用组件
});
```

---



## 二、核心配置

### WebFramework 初始化参数

```typescript
interface LayoutFrameworkOptions {
  // 必填：主应用组件
  bodyComponent: Component;
  
  // 可选：挂载点（默认 "#app"）
  el?: string | HTMLElement;
  
  // 可选：Vue Router 实例
  router?: Router;
  
  // 可选：自定义组件注册回调
  registerComponents?: (app: App) => void | Promise<void>;
}
```

### 完整初始化示例

```typescript
import { WebFramework } from "@cs/js-web-framework";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [...]
});

new WebFramework({
  bodyComponent: App,
  el: "#app",
  router,
  registerComponents: (app) => {
    // 注册全局组件、指令等
    app.component('MyComponent', MyComponent);
  },
});
```

---

## 三、核心 API 导出

### 1. HTTP 请求 `$http`

```typescript
import { $http } from "@cs/js-web-framework";

// GET 请求
const data = await $http.get<UserInfo>("/api/user", { params: { id: 1 } });

// POST 请求
const result = await $http.post<Response>("/api/user", { name: "test" });

// PUT 请求
await $http.put("/api/user", { id: 1, name: "updated" });

// DELETE 请求
await $http.delete("/api/user", { id: 1 });

// 设置全局请求头
$http.setHeaders({
  "x-custom-header": "value",
});

// 请求取消功能
$http.enableAutoCancel();   // 启用自动取消
$http.cancelAllRequests();  // 取消所有请求
```

### 2. 状态管理 `portalStore`

```typescript
import { portalStore } from "@cs/js-web-framework";

const store = portalStore();

// 获取上下文信息
console.log(store.$context);

// 获取菜单列表（树形）
console.log(store.menus);

// 获取菜单列表（平铺）
console.log(store.menuItems);

// 获取用户权限
console.log(store.permissions);


// 获取组织根节点
console.log(store.orgRoot);

// 获取用户信息
console.log(store.user);
```

### 3. Pinia 状态管理工具 `portalPinia`

框架将 `pinia` 的核心 API 聚合为 `portalPinia` 统一导出，业务代码无需单独安装/引入 `pinia`，直接从框架按需取用即可。

**导出成员**

| 成员 | 说明 |
|------|------|
| `createPinia` | 创建 Pinia 实例 |
| `defineStore` | 定义 Store |
| `getActivePinia` | 获取当前激活的 Pinia 实例 |
| `storeToRefs` | 解构 Store 并保持响应式 |
| `mapState` | Options API 映射 state（计算属性） |
| `mapActions` | Options API 映射 actions（方法） |
| `mapStores` | Options API 映射整个 Store |

**定义业务 Store**

```typescript
import { portalPinia } from "@cs/js-web-framework";

const { defineStore } = portalPinia;

// 组合式写法
export const useUserStore = defineStore("userStore", () => {
  const userInfo = ref({ name: "", age: 0 });
  const setUser = (val: { name: string; age: number }) => (userInfo.value = val);
  return { userInfo, setUser };
});

// 选项式写法（不推荐）
```

**在组件中使用（保持响应式解构）**

```typescript
import { storeToRefs } from "@cs/js-web-framework"; // portalPinia 内成员均已重定向导出
import { portalPinia } from "@cs/js-web-framework";
import { useUserStore } from "./stores/user-store";

const userStore = useUserStore();
// storeToRefs 保证 state/getter 解构后仍保持响应式
const { userInfo } = portalPinia.storeToRefs(userStore);
// actions 直接解构即可
const { setUser } = userStore;
```

**手动创建并挂载 Pinia 实例**

> 框架初始化时默认已注入 Pinia，仅特殊场景（如独立子应用）需要手动创建。

```typescript
import { createApp } from "vue";
import { portalPinia } from "@cs/js-web-framework";
import App from "./App.vue";

const app = createApp(App);
app.use(portalPinia.createPinia());
app.mount("#app");

// 获取当前激活的 Pinia 实例
const pinia = portalPinia.getActivePinia();
```

**Options API 组件中使用**

```typescript
import { portalPinia } from "@cs/js-web-framework";
import { useUserStore } from "./stores/user-store";

const { mapState, mapActions, mapStores } = portalPinia;

export default {
  computed: {
    // 映射整个 store
    ...mapStores(useUserStore),
    // 映射指定 state/getter
    ...mapState(useUserStore, ["userInfo"]),
  },
  methods: {
    // 映射指定 action
    ...mapActions(useUserStore, ["setUser"]),
  },
};
```

### 4.上下文数据结构 `$context`

```typescript
interface IPublicContextStateType {
  tenantId: number;          // 租户ID
  tenantCode: string;        // 租户编码
  tenantName: string;        // 租户名称
  portalName: string;        // 门户名称
  portalLogo: string;        // 门户Logo
  applicationId: string;     // 应用ID
  appName: string;           // 应用名称
  appIcon: string;           // 应用图标
  moduleId: string;          // 模块ID
  moduleCode: string;        // 模块编码
  moduleName: string;        // 模块名称
  moduleUrl: string;         // 模块URL
  productCode: string;       // 产品编码
  productName: string;       // 产品名称
  userId: string;            // 用户ID
  userName: string;          // 用户名
  realName: string;          // 真实姓名
  phoneNumber: string;       // 手机号
  orgId: number;             // 组织ID
  orgName: string;           // 组织名称
  orgFullName: string;       // 组织全路径名称
  permissions: string[];     // 权限列表
}
```

### 5.内部默认注册组件

```
 /**
   * 内部默认注册组件
   * @param app
   * @private
   */
  private _registerComponent(app: App) {
    // 注册elementPlus
    app.use(ElementPlus, {
      locale: zhCn,
    });
    
    // 注册扩展库
    if (window.ElementPlusUi) {
      app.use(window.ElementPlusUi);
    }
    
    if (window.TablePro) {
      app.use(window.TablePro);
    }
  }
```



## 四、Hooks

### 页面加载钩子

```typescript
import { usePageLoadHook } from "@cs/js-web-framework";

// 在组件中使用
const router = useRouter();
usePageLoadHook(router, {
  isForceFlush: true,  // 强制刷新到根路由（默认 true）
  rootPath: "/",       // 根路由路径（默认 "/"）
});
```

---

## 五、URL 参数说明

框架会自动解析以下 URL 参数：

| 参数 | 说明 |
|------|------|
| `applicationId` | 应用ID |
| `moduleId` | 模块ID |
| `orgId` | 组织ID |

参数会被自动加密为 36 进制格式传输。

---

## 六、类型导出

```typescript
// 框架配置类型
export type { LayoutFrameworkOptions } from "@cs/js-web-framework";

// 上下文类型
export type { 
  IPublicContextStateType,
  IPublicMenuType,
  IPublicOrgNodeType,
  IPublicApplicationType,
  IPublicPortalConfigType,
  QueryParamsType
} from "@cs/js-web-framework";
```

---

## 七、CDN 引用

框架提供 UMD 构建产物，可通过 `<script>` 标签直接引入，无需打包工具。加载后框架挂载到全局变量 **`window.JsWebFramework`**。

```html
<script src="https://cdn.yearrow.com/files/@cs/js-web-framework/1.1.5/js-web-framework.umd.js"></script>
```

> **前置依赖**：框架内部 `vue`、`vue-router`、`axios`、`element-plus`、`@element-plus/icons-vue` 均为外部化（external）依赖，必须**先于**框架脚本引入，且全局变量名需匹配：

| 模块 | 全局变量 |
|------|---------|
| vue | `Vue` |
| vue-router | `VueRouter` |
| axios | `axios` |
| element-plus | `ElementPlus` |
| @element-plus/icons-vue | `ElementPlusIconsVue` |

### 完整 CDN 使用示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>js-web-framework CDN 示例</title>
  <!-- 1. 先引入框架外部化依赖 -->
  <script src="https://cdn.yearrow.com/files/vue/3.x/vue.global.js"></script>
  <script src="https://cdn.yearrow.com/files/vue-router/4.x/vue-router.global.js"></script>
  <script src="https://cdn.yearrow.com/files/axios/1.x/axios.min.js"></script>
  <link rel="stylesheet" href="https://cdn.yearrow.com/files/element-plus/2.13.7/index.css" />
  <script src="https://cdn.yearrow.com/files/element-plus/2.13.7/index.full.min.js"></script>
  <script src="https://cdn.yearrow.com/files/@element-plus/icons-vue/2.x/index.iife.min.js"></script>
  <!-- 2. 再引入框架 -->
  <script src="https://cdn.yearrow.com/files/@cs/js-web-framework/1.1.5/js-web-framework.umd.js"></script>
</head>
<body>
  <div id="app"></div>
  <script>
    // 框架通过全局变量 JsWebFramework 暴露
    const { WebFramework, portalStore, portalPinia, $http } = window.JsWebFramework;

    // 业务根组件
    const App = {
      template: `<div>CDN 接入示例</div>`,
    };

    // 通过 CDN 接入时需手动创建并挂载 Pinia
    const pinia = portalPinia.createPinia();

    new WebFramework({
      bodyComponent: App,
      registerComponents: (app) => {
        app.use(pinia);
      },
    });
  </script>
</body>
</html>
```

### CDN 场景 API 取用

```javascript
const { WebFramework, portalStore, portalPinia, $http } = window.JsWebFramework;

// HTTP 请求
$http.get("/api/user").then((res) => console.log(res));

// 上下文数据
const store = portalStore();
console.log(store.$context);

// 自定义 Store
const { defineStore, storeToRefs } = portalPinia;
```

> **版本提示**：CDN 地址中的 `1.1.5` 为版本号，升级时同步替换即可。生产环境建议锁定具体版本号，避免使用 latest。

---

## 八、常见问题

### Q: 如何隐藏头部或侧边栏？

```typescript
new WebFramework({
  bodyComponent: App,
});
```

### Q: 如何获取当前用户信息？

```typescript
const store = portalStore();
const { userId, userName, realName } = store.$context;
```

### Q: 如何判断用户是否有某个权限？

```typescript
const store = portalStore();
const hasPermission = store.permissions.includes("work-station-view");
```

### Q: 报错 `Cannot read properties of undefined (reading '_s')`？

**报错现象**

```text
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading '_s')
```

**原因分析**

`_s` 是 Pinia 内部存储 stores 注册表的属性。该报错的根本原因是应用中存在**多个 Pinia 实例（双 Pinia）**：框架内部通过 `portalPinia` 捆绑了独立的 `pinia`，若业务代码又单独 `import { createPinia } from "pinia"` 并 `app.use(pinia)`，就会出现两个 Pinia 实例。`portalStore()` / 业务 Store 在调用时通过 `getActivePinia()` 取到的是另一个实例，访问其内部 `_s` 即得到 `undefined`，从而抛错。

常见触发场景：

- 业务项目自建 Pinia 实例：`import { createPinia } from "pinia"`
- `defineStore` 来源混用：业务用原生 `pinia` 的 `defineStore`，框架 `portalStore` 用 `portalPinia.defineStore`
- monorepo / 子应用中重复安装 `pinia`，导致两份 `pinia` 打包副本

**错误写法（产生双 Pinia）**

```typescript
import { createApp } from "vue";
import { createPinia, defineStore } from "pinia"; // ❌ 业务又引入了一份 pinia
import { WebFramework, portalStore } from "@cs/js-web-framework";

const app = createApp({});
app.use(createPinia()); // ❌ 与框架内部 Pinia 形成两个实例
// portalStore() 此时取到错误实例，访问 _s 为 undefined -> 报错
```

**正确写法（统一使用框架的 portalPinia）**

```typescript
import { portalPinia, portalStore } from "@cs/js-web-framework";

const { createPinia, defineStore, storeToRefs } = portalPinia;

// ✅ 复用框架同源 Pinia，确保唯一实例
const pinia = createPinia();

// ✅ 业务 Store 也通过 portalPinia.defineStore 定义
const useUserStore = defineStore("userStore", () => {
  const userInfo = ref({ name: "" });
  return { userInfo };
});
```

> **提示**：框架初始化时默认已注入 Pinia 实例，常规业务开发无需手动 `createPinia()`；仅在独立子应用、CDN 接入等无框架托管场景才需手动创建，且必须使用 `portalPinia.createPinia()`。

**排查方式**

```typescript
import { portalPinia } from "@cs/js-web-framework";

// 检查当前激活的 Pinia 实例是否为框架同源实例
const activePinia = portalPinia.getActivePinia();
console.log(activePinia); // 不应为 undefined，且 _s 应为 Map 结构
```



---


## 九、更新日志

| 版本    | 日期         | 更新内容                                                                             |
|-------|------------|----------------------------------------------------------------------------------|
| 1.1.5 | 2026-07-27 | 新增全局配置查询及状态管理功能，结账日、数量、金额、不含税单价、含税单价小数位配置 |
| 1.1.4 | 2026-07-08 | portal框架内部使用类名称优化，调整为使用统一bem规范命名                                                 |
| 1.1.3 | 2026-07-03 | 框架loading动画样式调整优化                                                                |
| 1.1.2 | 2026-06-02 | 升级element-plus版本至2.13.7，`ElementPro`替换为`ElementPlusUi`                           |
| 1.1.0 | 2026-05-22 | 添加同步获取父应用上下文数据功能                                                                 |
| 1.0.0 | 2026-05-13 | 添加 LayoutNavigation 组件用于面包屑导航<br/>基于多tab页签简化框架上下文功能，移除部分接口及数据初始化，移除上下文参数不一致重定向功能 |
| 0.5.0 | 2026-04-06 | 框架多tab升级,菜单加载模块配置添加                                                              |
| 0.4.5 | 2026-03-11 | 应用地址跳转不合法检测提示                                                                    |
| 0.4.4 | 2026-03-09 | 配置接口路径修改至 /bmShare                                                               |
| 0.4.3 | 2026-03-09 | 优化参数加密处理支持超大整数                                                                   |
| 0.4.2 | 2026-03-04 | BigInt 超过 Number.MAX_SAFE_INTEGER 处理                                             |
| 0.4.1 | 2025-11-11 | 组织机构重定向优化、URL参数处理增强                                                              |
| 0.4.0 | 2025-11-11 | 添加 URL 解析和序列化工具                                                                  |
| 0.3.3 | 2025-11-10 | 兼容低代码初始化无参数场景                                                                    |
| 0.3.2 | 2025-11-04 | 添加自定义配置查询及辅助工具函数                                                                 |

---

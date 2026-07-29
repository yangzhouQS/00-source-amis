# Setter 使用参考手册

> 范围：new-assembox-editor 内置 24 个 setter 的用法、`setterProps` 配置与示例
> 位置：`src/setters/<name>/index.tsx`，聚合出口 `src/setters/index.ts`
> 配置入口：`ComponentMeta.props[]` 的每个 `PropConfig`（`setter` + `setterProps`）

---

## 一、通用契约（所有 setter 共有）

所有 setter 通过 `defineSetter` 包装或直接实现，统一接收以下 props：

| 字段 | 类型 | 说明 |
|---|---|---|
| `value` | `any` | 当前值（来自 schema props） |
| `defaultValue` | `any` | 默认值 |
| `onChange` | `(v) => void` | 值变更统一出口 |
| `placeholder` | `string` | 占位文本 |
| `isPreview` | `boolean` | 只读预览态 |
| `disabled` | `boolean` | 禁用 |
| `fieldName` | `string` | 所属字段名（调试用） |

> 下文每个 setter 只列**特有 setterProps**（通过 `PropConfig.setterProps` 透传），通用字段不再重复。

---

## 二、propType 自动推断

未显式指定 `setter` 时，按 `propType` 自动推断（`inferSetterName`）：

| propType | 推断 setter |
|---|---|
| `string` | StringSetter |
| `number` | NumberSetter |
| `boolean` | BoolSetter |
| `json` | JsonSetter |
| `color` | ColorSetter |
| `icon` | IconSetter |
| `{type:'oneOf', value}` | SelectSetter（并自动注入 `options`，含 `labels`） |
| `{type:'shape', value: PropConfig[]}` | ObjectSetter（自动注入 `config.items`） |
| `{type:'array'\|'arrayOf', value}` | ArraySetter（自动注入 `itemConfig`/`itemSetter`） |

显式 `setter` 优先于推断。

---

## 三、SetterContext（复合 setter 上下文）

复合 setter（Object / Array / Mixed / ArrayOfMulti）通过 `useSetterCtx()` 注入：

```ts
interface SetterContext {
  editor: Editor;
  setterRegistry: SetterRegistry;  // 解析子 setter
  nodeId?: NodeId;
  fieldConfig?: PropConfig;
}
```

由 `settings-pane` 渲染顶层 setter 时 `provide(SETTER_CONTEXT_KEY, ctx)`。

---

## 四、基础类型 Setter（9 个）

### 1. StringSetter
单行字符串输入（`ElInput`）。`propType: 'string'` 自动推断。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `clearable` | `boolean` | `true` | 显示清除按钮 |

```ts
{name: 'title', title: '标题', propType: 'string', defaultValue: '', setterProps: {clearable: true}}
```

### 2. TextareaSetter
多行文本（`ElInput type=textarea`）。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `rows` | `number` | `3` | 行数 |
| `showWordLimit` | `boolean` | `false` | 字数统计 |
| `maxlength` | `number` | — | 最大长度 |

```ts
{name: 'description', title: '描述', propType: 'string', setter: 'TextareaSetter', setterProps: {rows: 4, maxlength: 200, showWordLimit: true}}
```

### 3. NumberSetter
数字输入（`ElInputNumber`）。`propType: 'number'` 自动推断。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `min` / `max` | `number` | — | 范围 |
| `step` | `number` | `1` | 步长 |
| `precision` | `number` | — | 小数位 |
| `controlsPosition` | `string` | `'right'` | 加减按钮位置 |

```ts
{name: 'fontSize', title: '字号', propType: 'number', defaultValue: 14, setterProps: {min: 12, max: 48, step: 2}}
```

### 4. BoolSetter
布尔开关（`ElSwitch`）。`propType: 'boolean'` 自动推断。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `activeText` / `inactiveText` | `string` | — | 开/关文案 |
| `activeValue` / `inactiveValue` | `any` | `true`/`false` | 视觉对应值（写出固定为布尔） |

```ts
{name: 'disabled', title: '是否禁用', propType: 'boolean', defaultValue: false, setterProps: {activeText: '禁用', inactiveText: '启用'}}
```

### 5. SelectSetter
下拉选择（`ElSelect`），支持分组/搜索/多选。`oneOf` 自动注入 options。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `options` | `Array<{label,value,disabled?,children?} \| string \| number>` | `[]` | 选项；含 `children` 自动分组 |
| `mode` | `'multiple'\|'tags'` | — | 多选模式 |
| `showSearch` | `boolean` | `false` | 可搜索 |
| `hasClear` | `boolean` | `true` | 可清空 |

```ts
// oneOf 自动注入 options
{name: 'size', title: '尺寸', propType: {type:'oneOf', value:['large','default','small']}, defaultValue: 'default'}
// 显式 options + 分组 + 多选
{name: 'position', title: '定位', propType: 'string', setter: 'SelectSetter',
 setterProps: {mode: 'multiple', options: [
   {label:'静态', value:'static'},
   {label:'动态', children:[{label:'relative',value:'relative'},{label:'absolute',value:'absolute'}]}
 ]}}
```

### 6. RadioGroupSetter
单选按钮组（`ElRadioGroup`）。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `options` | `Array<{label,value,disabled?} \| string \| number>` | `[]` | 选项 |
| `button` | `boolean` | `true` | 按钮样式 vs 圆点 |
| `size` | `string` | `'small'` | 尺寸 |

```ts
{name: 'align', title: '对齐', propType: {type:'oneOf', value:['left','center','right']}, setter: 'RadioGroupSetter', setterProps: {button: true}}
```

### 7. ColorSetter
颜色选择（`ElColorPicker`）。`propType: 'color'` 自动推断。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `showAlpha` | `boolean` | `true` | 透明度 |
| `colorFormat` | `'hex'\|'rgb'\|'hsl'\|'hsv'` | `'hex'` | 格式 |
| `predefine` | `string[]` | — | 预设色板 |

```ts
{name: 'color', title: '颜色', propType: 'color', defaultValue: '#0079f2', setterProps: {showAlpha: false, predefine: ['#0079f2','#00c587']}}
```

### 8. JsonSetter
JSON 编辑器（**Monaco**，语法高亮 + 错误标记，仅有效时回写）。`propType: 'json'` 自动推断。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `rows` | `number` | `6` | 行高（高度 = `rows*18+8`px） |

```ts
{name: 'extraProps', title: '附加属性(JSON)', propType: 'json', defaultValue: {foo: 1}, setterProps: {rows: 10}}
```

### 9. IconSetter
图标选择器（Element Plus 图标 + iconFont，弹窗搜索网格）。`propType: 'icon'` 自动推断。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `iconType` | `''\|'elementIcon'\|'iconFont'` | `''` | 限制类型（空=两个 Tab） |
| `iconFontList` | `Array<{font_class, name?}>` | `[]` | iconFont 清单 |
| `iconFontPrefix` | `string` | `'icon cs-common '` | iconFont class 前缀 |

```ts
{name: 'icon', title: '图标', propType: 'icon', defaultValue: 'Plus', setterProps: {iconType: 'elementIcon'}}
```

---

## 五、复合类型 Setter（4 个）

### 10. ObjectSetter
对象编辑器，逐字段渲染子 setter，输出对象。`shape` 自动注入 config。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `config` | `{items: PropConfig[]}` | `{items:[]}` | 子字段配置（每个 item 是完整 PropConfig，支持 `hidden` 联动） |

```ts
{name: 'style', title: '样式对象', propType: {type:'shape', value: [
  {name:'width', title:'宽度', propType:'number'},
  {name:'color', title:'颜色', propType:'color'}
]}, defaultValue: {width:100, color:'#fff'}}
```

### 11. ArraySetter
数组编辑器（增删/拖拽排序，每项同一子 setter）。`array`/`arrayOf` 自动注入。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `itemSetter` | `string \| {setter?, props?, config?, initialValue?}` | `'StringSetter'` | 子项 setter |
| `itemConfig` | `{items: PropConfig[]}` | — | itemSetter=ObjectSetter 时的子字段 |
| `initialValue` | `any` | `''` | 新增项默认值 |
| `itemMaxLength` | `number` | — | 最大项数 |

```ts
// 字符串数组
{name: 'tags', title: '标签', propType: {type:'arrayOf', value:'string'}, setterProps: {itemMaxLength: 10}}
// 对象数组（array 自动注入 itemConfig）
{name: 'options', title: '选项', propType: {type:'array', value:[
  {name:'label', title:'文本', propType:'string'},
  {name:'value', title:'值', propType:'string'}
]}, defaultValue: []}
```

### 12. ArrayOfMultiSetter
多选复选框组（`ElCheckboxGroup`），值为数组。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `options` | `Array<{label,value,disabled?}>` | `[]` | 选项 |
| `direction` | `'row'\|'column'` | `'column'` | 排列方向 |

```ts
{name: 'permissions', title: '权限', propType: 'json', setter: 'ArrayOfMultiSetter', defaultValue: [],
 setterProps: {direction:'row', options:[{label:'读',value:'read'},{label:'写',value:'write'}]}}
```

### 13. MixedSetter
多 setter 切换器（同一字段动态切换编辑方式，带下拉入口）。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `setters` | `Array<string \| {name, title?, props?, initialValue?}>` | `[]` | 候选 setter |
| `usedSetter` | `string` | `''` | 当前选中（受控，emit update:usedSetter） |

```ts
{name: 'value', title: '值(可切换)', propType: 'string', setter: 'MixedSetter',
 setterProps: {setters: [
   {name:'StringSetter', title:'文本', initialValue:''},
   {name:'NumberSetter', title:'数字', initialValue:0},
   {name:'VariableSetter', title:'变量', initialValue:{type:'variable', value:''}}
 ]}}
```

---

## 六、高级 / 业务 Setter（11 个）

### 14. FunctionSetter
通用代码字符串编辑器（textarea + 全屏 + `new Function` 校验）。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `language` | `string` | `'javascript'` | 语言（placeholder 提示） |
| `height` | `number` | `120` | 高度 px |
| `supportFullScreen` | `boolean` | `true` | 全屏弹窗 |

```ts
{name: 'onClick', title: '点击回调(代码)', propType: 'string', setter: 'FunctionSetter', setterProps: {height: 160}}
```

### 15. JSFunctionSetter
结构化 JS 函数编辑器（形参 + 函数体 + mock 测试运行）。输出 `{type:'JSFunction', params, body}`。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `defaultParams` | `string[]` | `['data','event']` | 默认形参 |
| `defaultBody` | `string` | `'return data;'` | 函数体默认 |
| `showTestRun` | `boolean` | `true` | 测试运行面板 |
| `supportFullScreen` | `boolean` | `true` | 全屏 |
| `height` | `number` | `140` | 高度 px |

```ts
{name: 'formatter', title: '格式化函数', propType: 'json', setter: 'JSFunctionSetter',
 defaultValue: {type:'JSFunction', params:['row'], body:'return row.name;'}, setterProps: {defaultParams:['row','col']}}
```

### 16. RequestFnSetter
数据源/请求选择器（树形 `ElTreeSelect` + 搜索）。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `dataSourceTree` | `Array<{id, description?, isGroup?, disabled?, children?}>` | `[]` | 树形数据源（优先） |
| `dataSource` | `Array<{id, description?, disabled?}>` | `[]` | 扁平数据源 |
| `clearable` | `boolean` | `true` | 可清空 |

```ts
{name: 'api', title: '数据接口', propType: 'string', setter: 'RequestFnSetter',
 setterProps: {dataSourceTree:[{id:'user', description:'用户', isGroup:true, children:[{id:'userList', description:'用户列表'}]}]}}
```

### 17. StyleSetter
可视化 CSS 样式编辑器（Layout/Font/Border/Position 分组，复用 Color/Number/Select setter）。输出 CSS 属性对象。

**无特有 setterProps**（自包含）。

```ts
{name: 'style', title: '样式', propType: 'json', setter: 'StyleSetter', defaultValue: {width:'200px', color:'#333'}}
```

### 18. ModelNameSetter
模型/字段绑定选择器（Popover + 可搜索树）。输出字段路径。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `modelTree` | `Array<{key, fullPath?, isLeaf?, description?, children?}>` | `[]` | 模型字段树 |
| `clearable` | `boolean` | `true` | 可清空 |

```ts
{name: 'bindField', title: '绑定字段', propType: 'string', setter: 'ModelNameSetter',
 setterProps: {modelTree:[{key:'user', description:'用户', children:[{key:'name', fullPath:'user.name', isLeaf:true}]}]}}
```

### 19. ClassNameSetter
CSS 类名多选（标签模式），值为空格分隔字符串。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `classNameList` | `string[]` | `[]` | 预设类名 |
| `allowCreate` | `boolean` | `true` | 允许手动输入 |

```ts
{name: 'className', title: '类名', propType: 'string', setter: 'ClassNameSetter',
 defaultValue: '', setterProps: {classNameList:['active','primary','large']}}
```

### 20. VariableSetter
变量绑定输入（`{{ }}` 装饰）。输出 `{type:'variable', value}`，清空输出 `undefined`。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `variables` | `Array<{label, value}>` | `[]` | 候选变量（预留下拉联动） |

```ts
{name: 'bindValue', title: '绑定变量', propType: 'json', setter: 'VariableSetter',
 defaultValue: {type:'variable', value:'this.state.foo'}, setterProps: {variables:[{label:'用户名', value:'this.state.userName'}]}}
```

### 21. ExpressionSetter
JS 表达式编辑器（`{{ }}` + `ElAutocomplete` 上下文提示 + 防抖）。输出 `{type:'JSExpression', value}`。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `contextKeys` | `string[]` | `['this','state','props','schema','constants','utils']` | 自动补全候选键 |

```ts
{name: 'visibleExpr', title: '显示条件', propType: 'json', setter: 'ExpressionSetter',
 defaultValue: {type:'JSExpression', value:'this.state.visible'}, setterProps: {contextKeys:['this','state','row']}}
```

### 22. LabelSetter
只读文本标签（纯展示，不可编辑）。

**无特有 setterProps**（仅 `value`）。

```ts
{name: 'version', title: '版本号', propType: 'string', setter: 'LabelSetter', defaultValue: '1.0.0'}
```

### 23. DocSetter
文档链接展示（渲染超链接组）。**数据即 `value`**（非 setterProps）。

`value`: `Array<{docTitle, docUrl}> | {docTitle, docUrl}`，默认 `[]`。

```ts
{name: 'docs', title: '相关文档', propType: 'json', setter: 'DocSetter',
 defaultValue: [{docTitle:'使用指南', docUrl:'https://example.com/guide'}]}
```

### 24. CustomSetter
自定义渲染 setter（传入 render 函数或 Vue 组件，完全自定义 UI）。

| setterProps | 类型 | 默认 | 说明 |
|---|---|---|---|
| `render` | `(ctx:{value,onChange,disabled}) => VNode` | — | 渲染函数（优先） |
| `component` | `Component \| (() => Component)` | — | Vue 组件（注入 value/onChange/disabled） |

```ts
{name: 'customField', title: '自定义', propType: 'number', setter: 'CustomSetter',
 setterProps: {render: ({value, onChange}) => h(ElSlider, {modelValue: value, onUpdate:modelValue: onChange})}}
```

---

## 七、速查表

| Setter | 特有 setterProps | 推断 propType |
|---|---|---|
| StringSetter | `clearable` | string |
| TextareaSetter | `rows` `showWordLimit` `maxlength` | — |
| NumberSetter | `min` `max` `step` `precision` `controlsPosition` | number |
| BoolSetter | `activeText` `inactiveText` `activeValue` `inactiveValue` | boolean |
| SelectSetter | `options` `mode` `showSearch` `hasClear` | oneOf |
| RadioGroupSetter | `options` `button` `size` | — |
| ColorSetter | `showAlpha` `colorFormat` `predefine` | color |
| JsonSetter | `rows` | json |
| IconSetter | `iconType` `iconFontList` `iconFontPrefix` | icon |
| ObjectSetter | `config.items` | shape |
| ArraySetter | `itemSetter` `itemConfig` `initialValue` `itemMaxLength` `mode` | array/arrayOf |
| ArrayOfMultiSetter | `options` `direction` | — |
| MixedSetter | `setters` `usedSetter` | — |
| FunctionSetter | `language` `height` `supportFullScreen` | — |
| JSFunctionSetter | `defaultParams` `defaultBody` `showTestRun` `supportFullScreen` `height` | — |
| RequestFnSetter | `dataSourceTree` `dataSource` `clearable` | — |
| StyleSetter | 无（自包含） | — |
| ModelNameSetter | `modelTree` `clearable` | — |
| ClassNameSetter | `classNameList` `allowCreate` | — |
| VariableSetter | `variables`（预留） | — |
| ExpressionSetter | `contextKeys` | — |
| LabelSetter | 无（只读） | — |
| DocSetter | 无（数据即 value） | — |
| CustomSetter | `render` `component` | — |

---

## 八、自定义 Setter

### 8.1 用 defineSetter（推荐，自动套用通用契约）

```ts
import {defineSetter} from '../base';

export const MySetter = defineSetter('MySetter', (props, ctx) => {
  // props.value / props.onChange / props.disabled 等通用字段已注入
  // props.xxx 读取 PropConfig.setterProps 透传的特有字段
  return h(ElInput, {
    modelValue: props.value,
    'onUpdate:modelValue': props.onChange,
    disabled: props.disabled
  });
});
```

### 8.2 注册

```ts
// 方式 A：插件 contributes（推荐）
definePlugin({
  id: 'my-plugin',
  contributes: {setters: [{name: 'MySetter', component: MySetter}]}
});

// 方式 B：setup 内手动
setup(ctx) { ctx.setterRegistry.register('MySetter', MySetter); }
```

### 8.3 在 ComponentMeta 使用

```ts
{
  name: 'field',
  title: '字段',
  propType: 'string',
  setter: 'MySetter',
  setterProps: {/* 透传给 MySetter 的特有配置 */}
}
```

> 复合 setter（需解析子 setter）应通过 `useSetterCtx()` 获取 `setterRegistry`，用 `resolveSetter(registry, propConfig)` 解析子 setter 组件与 props。

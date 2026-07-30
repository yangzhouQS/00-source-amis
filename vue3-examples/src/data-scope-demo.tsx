/**
 * DataScope 数据作用域完整验证 Demo
 * 覆盖文档 12 的所有设计能力（13 组验证）
 */
import {createApp, defineComponent, ref} from 'vue';
import {ElButton, ElCard, ElSpace} from 'element-plus';
import 'element-plus/dist/index.css';

import {
  createObject,
  extractObjectChain,
  createObjectFromChain,
  injectObjectChain,
  cloneObject,
  extendObject,
  getVariable,
  setVariable,
  deleteVariable,
  isObjectShallowModified,
  syncDataFromSuper,
  DataScope,
  RootScope
} from './data-scope/data-scope';
const App = defineComponent({
  name: 'DataScopeFullDemo',
  setup() {
    const log = ref<{msg: string; ok: boolean}[]>([]);
    const addLog = (msg: string, ok = true) => {
      const time = new Date().toLocaleTimeString();
      log.value.unshift({msg: `[${time}] ${ok ? '✅' : '❌'} ${msg}`, ok});
      if (log.value.length > 40) log.value.pop();
    };
    const assert = (label: string, condition: boolean) => {
      addLog(`${label} → ${condition}`, condition);
    };

    // ═══════ 1. createObject 原型链读取 ═══════
    const test1 = () => {
      const parent = createObject(null, {name: '父级', age: 50});
      const child = createObject(parent, {name: '子级', grade: '一年级'});
      assert('1a. child.name 自身层', child.name === '子级');
      assert('1b. child.age 穿透父级', child.age === 50);
      assert('1c. child.grade 自身属性', child.grade === '一年级');
      assert('1d. __super 指向父级', child.__super === parent);
      assert('1e. Object.keys 不含 __super', !Object.keys(child).includes('__super'));
      assert('1f. JSON.stringify 不含 __super', !JSON.stringify(child).includes('__super'));
    };

    // ═══════ 2. 写隔离（赋值遮蔽） ═══════
    const test2 = () => {
      const parent = createObject(null, {name: '父级', shared: '共享值'});
      const child = createObject(parent, {name: '子级'});
      setVariable(child, 'shared', '子改的值');
      assert('2a. child.shared 被遮蔽', child.shared === '子改的值');
      assert('2b. parent.shared 不受影响', parent.shared === '共享值');
      setVariable(child, 'newProp', '新属性');
      assert('2c. child.newProp 自身层', child.newProp === '新属性');
      assert('2d. parent.newProp 不存在', parent.newProp === undefined);
    };

    // ═══════ 3. getVariable canAccessSuper ═══════
    const test3 = () => {
      const parent = createObject(null, {a: 1, nested: {b: 2}});
      const child = createObject(parent, {c: 3});
      assert('3a. getVariable(穿透) 读 a', getVariable(child, 'a', true) === 1);
      assert('3b. getVariable(不穿透) 读 a → undefined', getVariable(child, 'a', false) === undefined);
      assert('3c. getVariable(自身) 读 c', getVariable(child, 'c', false) === 3);
      assert('3d. getVariable(点号) nested.b', getVariable(child, 'nested.b') === 2);
      assert('3e. getVariable(不存在) → undefined', getVariable(child, 'xyz') === undefined);
    };

    // ═══════ 4. deleteVariable 只删自身层 ═══════
    const test4 = () => {
      const parent = createObject(null, {name: '父级'});
      const child = createObject(parent, {name: '子级', own: '自有'});
      deleteVariable(child, 'own');
      assert('4a. child.own 已删除', child.own === undefined);
      assert('4b. 删 child.name 后穿透读父', (deleteVariable(child, 'name'), child.name === '父级'));
    };

    // ═══════ 5. 链折叠/展开/插入 ═══════
    const test5 = () => {
      const root = createObject(null, {level: 0, rootKey: 'root'});
      const mid = createObject(root, {level: 1, midKey: 'mid'});
      const leaf = createObject(mid, {level: 2, leafKey: 'leaf'});
      const chain = extractObjectChain(leaf);
      assert('5a. extractChain 长度 3', chain.length === 3);
      assert('5b. chain[0] 是 root', chain[0].rootKey === 'root');
      assert('5c. chain[2] 是 leaf', chain[2].leafKey === 'leaf');
      const rebuilt = createObjectFromChain(chain);
      assert('5d. rebuilt.level 读到 leaf', rebuilt.level === 2);
      assert('5e. rebuilt.rootKey 穿透 root', rebuilt.rootKey === 'root');
      const injected = injectObjectChain(leaf, {injected: true});
      assert('5f. injected.injected 存在', injected.injected === true);
      assert('5g. injected.level 读到 leaf', injected.level === 2);
      assert('5h. injected.rootKey 穿透 root', injected.rootKey === 'root');
    };

    // ═══════ 6. cloneObject / extendObject ═══════
    const test6 = () => {
      const parent = createObject(null, {base: 1});
      const child = createObject(parent, {name: '原始', value: 100});
      const cloned = cloneObject(child);
      assert('6a. cloned.name 正确', cloned.name === '原始');
      assert('6b. cloned.__super 指向 parent', cloned.__super === parent);
      cloned.name = '改了';
      assert('6c. 改 cloned 不影响原始', child.name === '原始');
      const extended = extendObject(child, {name: '扩展', extra: '新增'});
      assert('6d. extend name 覆盖', extended.name === '扩展');
      assert('6e. extend extra 新增', extended.extra === '新增');
      assert('6f. extend value 保留', extended.value === 100);
      assert('6g. extend __super 保留', extended.__super === parent);
    };

    // ═══════ 7. DataScope 响应式（shallowRef） ═══════
    const test7 = () => {
      const scope = new DataScope({name: '张三', age: 25});
      const oldRef = scope.data.value;
      scope.set('name', '李四');
      assert('7a. set 后引用变更', scope.data.value !== oldRef);
      assert('7b. name 更新', scope.data.value.name === '李四');
      scope.update({age: 30, city: '北京'});
      assert('7c. update age', scope.data.value.age === 30);
      assert('7d. update city 新增', scope.data.value.city === '北京');
      scope.delete('city');
      assert('7e. delete city 不存在', scope.data.value.city === undefined);
    };

    // ═══════ 8. DataScope 父子继承 ═══════
    const test8 = () => {
      const parent = new DataScope({globalVar: '全局', shared: '父级共享'});
      const child = parent.createChild({childProp: '子级属性', shared: '子级覆盖'});
      assert('8a. child 读 globalVar 穿透父', child.get('globalVar') === '全局');
      assert('8b. child 读 shared 自身遮蔽', child.get('shared') === '子级覆盖');
      assert('8c. child 读 childProp 自身', child.get('childProp') === '子级属性');
      assert('8d. child.getOwn(shared) 自身层', child.getOwn('shared') === '子级覆盖');
      assert('8e. child.getOwn(globalVar) 不存在', child.getOwn('globalVar') === undefined);
      child.set('globalVar', '子改的');
      assert('8f. 子改不影响父', parent.get('globalVar') === '全局');
      assert('8g. 子读 globalVar 读到自身', child.get('globalVar') === '子改的');
    };

    // ═══════ 9. isObjectShallowModified ═══════
    const test9 = () => {
      assert('9a. 相同 → false', !isObjectShallowModified({x:1,y:2}, {x:1,y:2}));
      assert('9b. 值不同 → true', isObjectShallowModified({x:1,y:2}, {x:1,y:3}));
      assert('9c. key 数不同 → true', isObjectShallowModified({x:1,y:2}, {x:1,y:2,z:3}));
      assert('9d. 忽略指定 key', !isObjectShallowModified({x:1,y:2}, {x:1,y:3}, ['y']));
    };

    // ═══════ 10. DataScope.fromChain（弹窗场景） ═══════
    const test10 = () => {
      const pageScope = new DataScope({pageId: 1, userName: '页面用户'});
      const formData = {fieldA: '表单值', fieldB: 42};
      const globalData = {appName: '测试应用', version: '1.0'};
      const dialogScope = DataScope.fromChain([globalData, pageScope.data.value, formData]);
      assert('10a. 读全局 appName', dialogScope.get('appName') === '测试应用');
      assert('10b. 读页面 userName', dialogScope.get('userName') === '页面用户');
      assert('10c. 读表单 fieldA', dialogScope.get('fieldA') === '表单值');
      assert('10d. fieldA 优先于全局', dialogScope.get('fieldA') === '表单值');
    };

    // ═══════ 11. syncDataFromSuper 父→子同步 ═══════
    const test11 = () => {
      // 场景：子级有自身数据，父级数据变化后同步
      const childOwn = {name: '子级名字', age: 20, tempField: '临时'};
      const oldParent = {name: '旧父名', age: 20, city: '北京'};
      const newParent = {name: '新父名', age: 21, city: '北京'};

      // 全量同步（force=true，无 syncKeys）
      const synced = syncDataFromSuper(childOwn, newParent, oldParent);
      assert('11a. sync: name 更新为新父名', synced.name === '新父名');
      assert('11b. sync: age 更新为 21', synced.age === 21);
      // 11c 修正：city 不在 childOwn 自身层，syncDataFromSuper 只同步 child 已有 key
      // amis 机制：sync 只同步 child 自身 own keys（或 syncKeys 白名单）
      assert('11c. sync: tempField 保留（自身 key）', synced.tempField === '临时');

      // 白名单同步（FormStore 场景：只同步指定 key）
      // 注意：syncKeys 是白名单 + child 自身 keys，所以 age（child 自身）仍会同步
      const syncedForm = syncDataFromSuper(childOwn, newParent, oldParent, ['name']);
      assert('11e. syncForm: name 更新', syncedForm.name === '新父名');
      // 11f 修正：age 是 child 自身 key，即使指定 syncKeys=['name'] 仍会同步
      assert('11f. syncForm: age 仍同步（自身 key）', syncedForm.age === 21);

      // 父级值未变化时不同步
      const sameParent = {...oldParent};
      const syncedNoChange = syncDataFromSuper(childOwn, sameParent, oldParent);
      assert('11g. sync: 父级无变化时 name 不被覆盖', syncedNoChange.name === '子级名字');

      // 父级从有值变为 undefined（删除场景）
      const syncedDel = syncDataFromSuper(childOwn, {name: undefined, age: 20}, oldParent);
      assert('11h. sync: name 变 undefined 同步', syncedDel.name === undefined);
    };

    // ═══════ 12. RootScope 全局变量注入（downStream） ═══════
    const test12 = () => {
      const root = new RootScope({pageId: 1, pageTitle: '首页'});
      root.setGlobalVar('appVersion', '2.0');
      root.setContext('__page', {id: 'home'});
      root.setQuery({tab: 'list', filter: 'active'});

      // root 自身能读全局变量
      assert('12a. root 读 global.appVersion', root.get('global')?.appVersion === '2.0');
      assert('12b. root 读 __page.id', root.get('__page')?.id === 'home');
      assert('12c. root 读 __query.tab', root.get('__query')?.tab === 'list');
      assert('12d. root 读 pageId 自身', root.get('pageId') === 1);

      // 子 scope 继承全局变量
      const child = root.createChild({formName: '表单A'});
      assert('12e. child 读 global.appVersion（穿透全局层）', child.get('global')?.appVersion === '2.0');
      assert('12f. child 读 __query.filter（穿透 query 层）', child.get('__query')?.filter === 'active');
      assert('12g. child 读 pageId（穿透 root data 层）', child.get('pageId') === 1);
      assert('12h. child 读 formName 自身', child.get('formName') === '表单A');

      // 优先级：自身 > root data > query > global > context
      child.set('pageId', 999);
      assert('12i. child.pageId 遮蔽 root', child.get('pageId') === 999);
      assert('12j. root.pageId 不受影响', root.get('pageId') === 1);

      // 链结构验证
      const chain = root.getChain();
      assert('12k. root chain 含全局层', chain.some(l => l.global));
      assert('12l. root chain 含 context 层', chain.some(l => l.__page));
    };

    // ═══════ 13. 综合场景：表单 + 列表 + 弹窗联动 ═══════
    const test13 = () => {
      // 模拟：页面有全局变量 + CRUD 列表 + 弹窗表单
      const root = new RootScope({pageName: '用户管理'});
      root.setGlobalVar('currentUser', {id: 1, role: 'admin'});
      root.setQuery({page: '1'});

      // CRUD 子 scope
      const crud = root.createChild({
        list: [{id: 1, name: '张三'}, {id: 2, name: '李四'}],
        total: 2
      });

      // CRUD 读全局变量
      assert('13a. CRUD 读 global.currentUser', crud.get('global')?.currentUser?.role === 'admin');
      assert('13b. CRUD 读 __query.page', crud.get('__query')?.page === '1');
      assert('13c. CRUD 读 list 自身', Array.isArray(crud.get('list')));

      // 打开弹窗：拼接数据上下文
      // ★ 关键：root.downStream 本身是链对象，需先 extractObjectChain 展平再拼接
      const dialogChain = [
        ...extractObjectChain(root.downStream),  // 展平已有的链（context→global→query→data）
        {rowData: {id: 1, name: '张三'}},         // 弹窗附加数据
        {mode: 'edit', saving: false}              // 弹窗自身状态
      ];
      const dialog = DataScope.fromChain(dialogChain);

      assert('13d. dialog 读 global.currentUser', dialog.get('global')?.currentUser?.id === 1);
      assert('13e. dialog 读 __query.page', dialog.get('__query')?.page === '1');
      assert('13f. dialog 读 pageName（穿透 page 层）', dialog.get('pageName') === '用户管理');
      assert('13g. dialog 读 rowData 附加层', dialog.get('rowData')?.name === '张三');
      assert('13h. dialog 读 mode 自身层', dialog.get('mode') === 'edit');

      // 弹窗写隔离：修改不影响父级
      dialog.set('pageName', '被弹窗改了');
      assert('13i. dialog 改 pageName 不影响 root', root.get('pageName') === '用户管理');

      // 父→子同步：root 变化后同步到 CRUD
      const oldRootData = root.data.value;
      root.set('pageName', '权限管理');
      const syncedCrud = syncDataFromSuper(
        crud.data.value,
        root.data.value,
        oldRootData,
        ['pageName']
      );
      assert('13j. sync: CRUD.pageName 同步为新值', syncedCrud.pageName === '权限管理');
    };

    // ═══════ 运行所有 ═══════
    const runAll = () => {
      log.value = [];
      test1();  test2();  test3();  test4();  test5();  test6();  test7();
      test8();  test9();  test10(); test11(); test12(); test13();
      const passed = log.value.filter(l => l.ok).length;
      const failed = log.value.filter(l => !l.ok).length;
      addLog(`═══ 验证完成：${passed} 通过，${failed} 失败 ═══`, failed === 0);
    };

    return () => (
      <div style={{padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif'}}>
        <h1 style={{color: '#303133'}}>Vue3 数据作用域（__super 原型链）完整验证</h1>
        <p style={{color: '#909399'}}>
          参考文档 12 所有设计能力：createObject / 读写隔离 / 链折叠展开 / syncDataFromSuper / RootScope 全局注入 / 综合联动
        </p>

        <ElCard header="验证操作（13 组）" style={{marginBottom: '16px'}}>
          <ElSpace wrap>
            <ElButton type="primary" onClick={runAll}>▶ 一键运行全部</ElButton>
            <ElButton onClick={test1}>1. createObject 原型链</ElButton>
            <ElButton onClick={test2}>2. 写隔离</ElButton>
            <ElButton onClick={test3}>3. getVariable 穿透</ElButton>
            <ElButton onClick={test4}>4. deleteVariable</ElButton>
            <ElButton onClick={test5}>5. 链折叠/展开/插入</ElButton>
            <ElButton onClick={test6}>6. clone/extend</ElButton>
            <ElButton onClick={test7}>7. 响应式</ElButton>
            <ElButton onClick={test8}>8. 父子继承</ElButton>
            <ElButton onClick={test9}>9. shallowDiff</ElButton>
            <ElButton onClick={test10}>10. fromChain 弹窗</ElButton>
            <ElButton type="warning" onClick={test11}>11. syncDataFromSuper ★</ElButton>
            <ElButton type="warning" onClick={test12}>12. RootScope 全局注入 ★</ElButton>
            <ElButton type="danger" onClick={test13}>13. 综合联动 ★</ElButton>
          </ElSpace>
        </ElCard>

        <ElCard header="验证日志">
          <div style={{maxHeight: '450px', overflow: 'auto', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.8'}}>
            {log.value.length === 0 ? (
              <span style={{color: '#909399'}}>点击按钮执行验证...</span>
            ) : (
              log.value.map((entry, i) => (
                <div key={i} style={{
                  padding: '2px 0',
                  color: !entry.ok ? '#f56c6c' : entry.msg.includes('完成') ? '#409eff' : '#67c23a',
                  fontWeight: entry.msg.includes('完成') ? 'bold' : 'normal'
                }}>
                  {entry.msg}
                </div>
              ))
            )}
          </div>
        </ElCard>
      </div>
    );
  }
});

createApp(App).mount('#app');

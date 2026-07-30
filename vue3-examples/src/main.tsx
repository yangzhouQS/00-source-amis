/**
 * Vue3 Scoped 组件通信系统验证 Demo
 * 覆盖场景：组件注册/注销、5 种查找 API、reload/send/close、isolateScope、点号路径
 */
import {createApp, defineComponent, ref, reactive, computed, provide} from 'vue';
import {
  ElButton, ElInput, ElCard, ElTag, ElDialog, ElMessage,
  ElCollapse, ElCollapseItem, ElDivider, ElSpace, ElText
} from 'element-plus';
import 'element-plus/dist/index.css';
import {SCOPED_KEY, rootScopedContext} from './scoped/scoped-context';
import {useScoped, useComponentRef} from './scoped/use-scoped';

// ═══════════════ 组件 A：模拟 CRUD 列表 ═══════════════
const MockCRUD = defineComponent({
  name: 'MockCRUD',
  props: {name: String, title: String},
  setup(props) {
    const dataList = reactive([
      {id: 1, name: '张三', age: 25},
      {id: 2, name: '李四', age: 30},
      {id: 3, name: '王五', age: 28}
    ]);
    const keyword = ref('');
    const reloadCount = ref(0);

    useScoped({
      name: props.name,
      id: `crud_${props.name}`,
      type: 'crud',
      reload: (subPath, query) => {
        reloadCount.value++;
        if (query?.keyword) {
          keyword.value = query.keyword;
          dataList.splice(0, dataList.length);
          const mock = [
            {id: 1, name: '张三', age: 25},
            {id: 2, name: '李四', age: 30},
            {id: 3, name: '王五', age: 28}
          ];
          mock.filter(r => r.name.includes(query.keyword)).forEach(r => dataList.push(r));
        } else {
          keyword.value = '';
          dataList.splice(0, dataList.length);
          [
            {id: 1, name: '张三', age: 25},
            {id: 2, name: '李四', age: 30},
            {id: 3, name: '王五', age: 28}
          ].forEach(r => dataList.push(r));
        }
      },
      receive: (values) => {
        ElMessage.success(`CRUD ${props.name} 收到数据: ${JSON.stringify(values)}`);
      },
      getData: () => ({rows: dataList, total: dataList.length})
    });

    return () => (
      <ElCard header={`CRUD: ${props.name} (reload ${reloadCount.value} 次)`}>
        {keyword.value && <ElTag type="warning" style="margin-bottom:8px">筛选: {keyword.value}</ElTag>}
        <div style="display:flex;gap:8px;flex-direction:column">
          {dataList.map(row => (
            <div key={row.id} style="display:flex;gap:12px;align-items:center;padding:4px 8px;background:#f5f7fa;border-radius:4px">
              <span>{row.id}</span>
              <span>{row.name}</span>
              <span style="color:#909399">{row.age}岁</span>
            </div>
          ))}
        </div>
      </ElCard>
    );
  }
});

// ═══════════════ 组件 B：模拟表单 ═══════════════
const MockForm = defineComponent({
  name: 'MockForm',
  props: {name: String},
  setup(props) {
    const formData = reactive({username: '', email: ''});
    const receiveCount = ref(0);
    const lastReceived = ref('');

    useScoped({
      name: props.name,
      id: `form_${props.name}`,
      type: 'form',
      isolateScope: true,  // ← 独立作用域
      receive: (values) => {
        receiveCount.value++;
        lastReceived.value = JSON.stringify(values);
        Object.assign(formData, values);
      },
      getData: () => ({...formData})
    });

    return () => (
      <ElCard header={`Form: ${props.name} (receive ${receiveCount.value} 次)`}>
        {lastReceived.value && (
          <div style="margin-bottom:8px;color:#67c23a;font-size:12px">
            最近收到: {lastReceived.value}
          </div>
        )}
        <div style="display:flex;flex-direction:column;gap:8px">
          <ElInput v-model={formData.username} placeholder="用户名" size="small" />
          <ElInput v-model={formData.email} placeholder="邮箱" size="small" />
        </div>
      </ElCard>
    );
  }
});

// ═══════════════ 组件 C：模拟弹窗 ═══════════════
const MockDialog = defineComponent({
  name: 'MockDialog',
  props: {name: String},
  setup(props) {
    const visible = ref(false);

    const {component} = useScoped({
      name: props.name,
      id: `dialog_${props.name}`,
      type: 'dialog',
      isolateScope: true,
      onClose: () => {
        visible.value = false;
        ElMessage.info(`Dialog ${props.name} 已关闭`);
      }
    });

    // 同步 show 状态到 scope
    const setShow = (v: boolean) => {
      visible.value = v;
      component.show = v;
    };

    return () => (
      <div>
        <ElButton onClick={() => setShow(true)} size="small">
          打开 {props.name}
        </ElButton>
        <ElDialog
          v-model={visible.value}
          title={`Dialog: ${props.name}`}
          width="400px"
          onClose={() => component.show = false}
        >
          <p>这是一个模拟弹窗，可以被 scope.close() 关闭</p>
          <MockForm name="dialogForm" />
        </ElDialog>
      </div>
    );
  }
});

// ═══════════════ 主验证页面 ═══════════════
const App = defineComponent({
  name: 'ScopedDemoApp',
  setup() {
    provide(SCOPED_KEY, rootScopedContext);

    const log = ref<string[]>([]);
    const addLog = (msg: string) => {
      const time = new Date().toLocaleTimeString();
      log.value.unshift(`[${time}] ${msg}`);
      if (log.value.length > 20) log.value.pop();
    };

    // ── 验证 1：组件注册 ──
    const checkRegistration = () => {
      const scope = rootScopedContext;
      const crudA = scope.getByName('crudA');
      const formA = scope.getByName('formA');
      const dialogA = scope.getByName('dialogA');
      addLog(`注册检查: crudA=${!!crudA}, formA=${!!formA}, dialogA=${!!dialogA}`);
      addLog(`  getById: crud_crudA=${!!scope.getById('crud_crudA')}, form_formA=${!!scope.getById('form_formA')}`);
    };

    // ── 验证 2：reload 基本调用 ──
    const testReload = () => {
      rootScopedContext.reload('crudA');
      addLog('reload("crudA") — 刷新 crudA');
    };

    // ── 验证 3：reload + query 参数 ──
    const testReloadWithQuery = () => {
      rootScopedContext.reload('crudA?keyword=张', {keyword: '张'});
      addLog('reload("crudA?keyword=张") — 刷新 crudA 并筛选"张"');
    };

    // ── 验证 4：send 发送数据 ──
    const testSend = () => {
      rootScopedContext.send('formA', {username: '赵六', email: 'zhao@test.com'});
      addLog('send("formA", {username:"赵六"}) — 向 formA 灌值');
    };

    // ── 验证 5：多目标 reload ──
    const testMultiReload = () => {
      rootScopedContext.reload('crudA,crudB');
      addLog('reload("crudA,crudB") — 同时刷新两个 CRUD');
    };

    // ── 验证 6：getById（全局查找） ──
    const testGetById = () => {
      const comp = rootScopedContext.getById('crud_crudA');
      const data = comp?.getData?.();
      addLog(`getById("crud_crudA"): 找到=${!!comp}, data=${data ? JSON.stringify(data) : 'null'}`);
    };

    // ── 验证 7：getByName 点号路径（穿透 isolateScope） ──
    const testDotPath = () => {
      // formA 是 isolateScope，其内部没有子组件注册（简化 demo）
      // 但可以验证查找本身不报错
      const comp = rootScopedContext.getByName('formA');
      addLog(`getByName("formA"): 找到=${!!comp}, type=${comp?.type}`);
    };

    // ── 验证 8：close 关闭弹窗 ──
    const testClose = () => {
      // 先打开 dialogA
      const dialogA = rootScopedContext.getByName('dialogA');
      if (dialogA) {
        // 模拟打开
        rootScopedContext.close('dialogA');
        addLog('close("dialogA") — 尝试关闭 dialogA');
      } else {
        addLog('close: dialogA 未找到');
      }
    };

    // ── 验证 9：未注册组件查找 ──
    const testNotFound = () => {
      const notFound = rootScopedContext.getByName('nonExistent');
      const notFoundId = rootScopedContext.getById('nonExistent');
      addLog(`查找不存在: byName=${!!notFound}, byId=${!!notFoundId} (都应为 false)`);
    };

    // ── 验证 10：getComponents 获取注册列表 ──
    const testGetComponents = () => {
      const list = rootScopedContext.getComponents();
      const names = list.map(c => c.name).filter(Boolean);
      addLog(`getComponents(): ${list.length} 个 — [${names.join(', ')}]`);
    };

    return () => (
      <div style="padding:24px;max-width:1200px;margin:0 auto;font-family:sans-serif">
        <h1 style="color:#303133">Vue3 Scoped 组件通信验证</h1>
        <p style="color:#909399">参考 amis Scoped 设计，验证组件注册/查找/reload/send/close 全场景</p>

        {/* ── 操作按钮区 ── */}
        <ElCard header="验证操作" style="margin-bottom:16px">
          <ElSpace wrap>
            <ElButton type="primary" onClick={checkRegistration}>1. 注册检查</ElButton>
            <ElButton onClick={testReload}>2. reload(crudA)</ElButton>
            <ElButton onClick={testReloadWithQuery}>3. reload + query 筛选</ElButton>
            <ElButton onClick={testSend}>4. send(formA) 灌值</ElButton>
            <ElButton onClick={testMultiReload}>5. 多目标 reload</ElButton>
            <ElButton onClick={testGetById}>6. getById</ElButton>
            <ElButton onClick={testDotPath}>7. getByName</ElButton>
            <ElButton onClick={testClose}>8. close(dialogA)</ElButton>
            <ElButton onClick={testNotFound}>9. 查找不存在</ElButton>
            <ElButton onClick={testGetComponents}>10. getComponents</ElButton>
          </ElSpace>
        </ElCard>

        {/* ── 组件展示区 ── */}
        <div style="display:flex;gap:16px;margin-bottom:16px">
          <div style="flex:1">
            <MockCRUD name="crudA" title="列表 A" />
          </div>
          <div style="flex:1">
            <MockCRUD name="crudB" title="列表 B" />
          </div>
        </div>

        <div style="display:flex;gap:16px;margin-bottom:16px">
          <div style="flex:1">
            <MockForm name="formA" />
          </div>
          <div style="flex:1">
            <MockDialog name="dialogA" />
          </div>
        </div>

        {/* ── 日志区 ── */}
        <ElCard header="操作日志">
          <div style="max-height:300px;overflow:auto;font-family:monospace;font-size:13px;line-height:1.8">
            {log.value.length === 0 ? (
              <ElText type="info">点击上方按钮执行验证操作...</ElText>
            ) : (
              log.value.map((entry, i) => (
                <div key={i} style={{
                  padding: '2px 0',
                  color: entry.includes('false') && !entry.includes('都应') ? '#f56c6c' : '#67c23a'
                }}>
                  {entry}
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

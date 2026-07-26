import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'element-plus/dist/index.css';
import App from './app';
import { usePluginStore } from '@/store/plugin-store';
import { BUILTIN_PLUGINS } from '@/builtin-plugins';
import './styles/index.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

// 注册内置插件并恢复用户已安装的 URL 插件
usePluginStore(pinia).init(BUILTIN_PLUGINS);

app.mount('#app');

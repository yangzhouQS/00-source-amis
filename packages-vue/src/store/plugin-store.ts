import { defineStore } from 'pinia';
import type { EditorPlugin, PluginManifest } from '@/types/plugin';

const STORAGE_KEY = 'amis-editor-vue:plugin-manifests';

interface PluginEntry {
  manifest: PluginManifest;
  plugin: EditorPlugin | null;
}

function loadManifests(): PluginManifest[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveManifests(list: PluginManifest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** 加载 UMD 脚本，约定脚本内将插件对象赋值给 window.__amisPlugin__ */
function loadPluginScript(url: string): Promise<EditorPlugin | null> {
  return new Promise(resolve => {
    const w = window as any;
    w.__amisPlugin__ = null;
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => {
      const plugin = w.__amisPlugin__ || null;
      w.__amisPlugin__ = null;
      resolve(plugin);
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

export const usePluginStore = defineStore('plugin', {
  state: () => ({
    entries: [] as PluginEntry[],
    initialized: false,
    installing: false
  }),

  getters: {
    manifests(state): PluginManifest[] {
      return state.entries.map(e => e.manifest);
    },
    activePlugins(state): EditorPlugin[] {
      return state.entries
        .filter(e => e.manifest.enabled && e.plugin)
        .map(e => e.plugin!);
    }
  },

  actions: {
    /** 初始化：注册内置插件，并恢复用户已安装的 URL 插件及启用状态 */
    init(builtins: EditorPlugin[]) {
      for (const p of builtins) {
        if (!this.entries.find(e => e.manifest.id === p.id)) {
          this.entries.push({
            manifest: {
              id: p.id,
              name: p.name,
              description: p.description,
              version: p.version,
              author: p.author,
              enabled: true,
              builtin: true
            },
            plugin: p
          });
        }
      }
      const stored = loadManifests();
      for (const m of stored) {
        const existing = this.entries.find(e => e.manifest.id === m.id);
        if (existing) {
          if (m.builtin) existing.manifest.enabled = m.enabled;
        } else if (m.url) {
          this.entries.push({ manifest: { ...m }, plugin: null });
        }
      }
      // 懒加载已记录的 URL 插件
      this.entries
        .filter(e => !e.manifest.builtin && !e.plugin && e.manifest.url)
        .forEach(e => this.loadUrlPlugin(e.manifest.url!, e.manifest.id));
      this.initialized = true;
      this.persist();
    },

    persist() {
      saveManifests(this.manifests);
    },

    setEnabled(id: string, enabled: boolean) {
      const e = this.entries.find(x => x.manifest.id === id);
      if (!e) return;
      e.manifest.enabled = enabled;
      this.persist();
    },

    async installFromUrl(url: string): Promise<string> {
      this.installing = true;
      try {
        const plugin = await loadPluginScript(url);
        if (!plugin) {
          throw new Error('未从脚本中读取到插件（脚本需将插件对象赋值给 window.__amisPlugin__）');
        }
        const id = plugin.id || 'url-' + Math.random().toString(36).slice(2, 8);
        const manifest: PluginManifest = {
          id,
          name: plugin.name,
          description: plugin.description,
          version: plugin.version,
          author: plugin.author,
          url,
          enabled: true,
          builtin: false
        };
        const idx = this.entries.findIndex(e => e.manifest.id === id);
        const entry: PluginEntry = { manifest, plugin };
        if (idx >= 0) this.entries[idx] = entry;
        else this.entries.push(entry);
        this.persist();
        return id;
      } finally {
        this.installing = false;
      }
    },

    async loadUrlPlugin(url: string, id: string) {
      const plugin = await loadPluginScript(url);
      const e = this.entries.find(x => x.manifest.id === id);
      if (e && plugin) e.plugin = plugin;
    },

    uninstall(id: string) {
      const e = this.entries.find(x => x.manifest.id === id);
      if (!e || e.manifest.builtin) return;
      this.entries = this.entries.filter(x => x.manifest.id !== id);
      this.persist();
    }
  }
});

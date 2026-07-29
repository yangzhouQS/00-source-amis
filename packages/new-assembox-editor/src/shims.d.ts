declare module '*.vue' {
  import type {DefineComponent} from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '*.less';
declare module '*.css';

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module 'monaco-editor';
declare module '@guolao/vue-monaco-editor';

declare global {
  interface Window {
    __ASSEM_EDITOR_DEV__?: boolean;
  }
}

export {};

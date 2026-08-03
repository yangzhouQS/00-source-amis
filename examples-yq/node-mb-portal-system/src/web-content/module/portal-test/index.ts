import { createPinia } from "pinia";
// import YqBizComponentsLibrary from "@cs/vue3-biz-components-library";
import YqBizComponentsLibrary from "../../../../../../packages/vue3-biz-components-library/src/index";
import App from "./App";
import "../template.html";

const pinia = createPinia();
new JsKanbanFramework.KanbanWebFramework({
  bodyComponent: App,
  registerComponents: (app) => {
    app.use(pinia);
    app.use(YqBizComponentsLibrary);
  },
});

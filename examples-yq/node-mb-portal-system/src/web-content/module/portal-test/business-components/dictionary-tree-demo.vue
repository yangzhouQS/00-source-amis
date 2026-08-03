<template>
  <div class="demo-grid">
    <yq-panel padding-size="small" title="懒加载（展开节点时携带 parentId）">
      <YqDictionaryTree
        v-model="lazyText"
        code="TreeDicTest"
        load-mode="lazy"
        clearable
        :default-props="fieldNames"
        @change="lazyRow = $event"
      />
      <pre class="demo-result">{{ JSON.stringify({ text: lazyText, row: lazyRow }, null, 2) }}</pre>
    </yq-panel>

    <yq-panel padding-size="small" title="全部加载（接口不传 parentId，前端组树）">
      <YqDictionaryTree
        v-model="allText"
        code="TreeDicTest"
        load-mode="all"
        :more-enable="false"
        clearable
        :default-props="fieldNames"
        @change="allRow = $event"
      />
      <pre class="demo-result">{{ JSON.stringify({ text: allText, row: allRow }, null, 2) }}</pre>
    </yq-panel>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";

const lazyText = ref("");
const lazyRow = ref<Record<string, any> | null>(null);
const allText = ref("");
const allRow = ref<Record<string, any> | null>(null);
const fieldNames = { label: "name", value: "id", disabled: "disabled" };
</script>

<style scoped lang="less">
.demo-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.demo-result {
  max-height: 150px;
  margin: 8px 0 0;
  overflow: auto;
  font-size: 12px;
}
@media (max-width: 900px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <div class="demo-grid">
    <yq-panel padding-size="small" title="基础选择与数量拆分">
      <el-button size="small" type="primary" @click="basicVisible = true">
        打开选材
      </el-button>
      <pre class="demo-result">{{ JSON.stringify(basicRows, null, 2) }}</pre>
    </yq-panel>

    <yq-panel padding-size="small" title="动态 loadParams">
      <el-space :size="8" wrap>
        <el-input v-model="projectId" size="small" placeholder="projectId，可留空" style="width: 180px" />
        <el-button size="small" type="primary" @click="paramsVisible = true">
          按参数打开
        </el-button>
      </el-space>
      <pre class="demo-result">{{ JSON.stringify({ loadParams, rows: paramsRows }, null, 2) }}</pre>
    </yq-panel>
  </div>

  <YqSelectComMaterial
    v-model:visible="basicVisible"
    @get-select-rows="basicRows = $event"
  />
  <YqSelectComMaterial
    v-model:visible="paramsVisible"
    :load-params="loadParams"
    @get-select-rows="paramsRows = $event"
  />
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";

const basicVisible = ref(false);
const paramsVisible = ref(false);
const projectId = ref("");
const basicRows = ref<Record<string, any>[]>([]);
const paramsRows = ref<Record<string, any>[]>([]);
const loadParams = computed(() => projectId.value ? { projectId: projectId.value } : {});
</script>

<style scoped lang="less">
.demo-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.demo-result {
  max-height: 220px;
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

<template>
  <div class="demo-grid">
    <yq-panel padding-size="small" title="基础单选 + 文本 v-model 监听">
      <el-input v-model="dictionaryText" size="small" placeholder="修改文本 v-model 测试回显" />
      <YqDictionarySelect
        v-model="dictionaryText"
        code="MaterialUnit"
        :transform-response="transformDictionaryResponse"
        clearable
        @change="selectedRow = $event"
      />
      <YqDictionarySelect
        code="MaterialUnit"
        :default-props="fieldNames"
        placeholder="带副标题的字典选择"
      />
      <pre class="demo-result">{{ JSON.stringify({ text: dictionaryText, row: selectedRow }, null, 2) }}</pre>
    </yq-panel>

    <yq-panel padding-size="small" title="尺寸、禁用与请求条件">
      <el-space direction="vertical" alignment="stretch" :size="6" style="width: 100%">
        <YqDictionarySelect
          code="MaterialUnit"
          size="small"
          dropdown-width="360px"
          :default-props="fieldNames"
          :condition-items="[{ fieldName: 'name', fieldValue: '%台%', op: 'like' }]"
          placeholder="小尺寸，默认仅显示叶子数据"
        />
        <YqDictionarySelect
          v-model="disabledText"
          code="MaterialUnit"
          disabled
          :default-props="fieldNames"
        />
        <YqDictionarySelect
          v-model="projectText"
          code="storageLocation"
          clearable
          :org-id="portal.$context.orgId"
          :tenant-id="portal.$context.tenantId"
        />
      </el-space>
    </yq-panel>
  </div>
</template>

<script lang="ts" setup>
import { portalStore } from "@cs/js-kanban-framework";
import { ref } from "vue";

const portal = portalStore();
const dictionaryText = ref("");
const disabledText = ref("禁用状态");
const projectText = ref("项目部字典");
const selectedRow = ref<Record<string, any> | null>(null);
const fieldNames = { label: "name", subLabel: "name", value: "id", disabled: "disabled" };

function transformDictionaryResponse(response: any) {
  const rows = response?.result?.rows ?? response?.result ?? response ?? [];
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    name: row.name || row.label || "",
  }));
}
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

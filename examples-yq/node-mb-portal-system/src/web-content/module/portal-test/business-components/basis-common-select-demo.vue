<template>
  <div class="demo-grid">
    <yq-panel padding-size="small" title="真实供应商接口 + defaultText 监听">
      <el-input v-model="supplierText" size="small" placeholder="修改 supplierText 测试响应式回显" />
      <YqBasisCommonSelectApi
        ref="supplierRef"
        v-model="supplierId"
        v-model:default-text="supplierText"
        :request-config="supplierRequestConfig"
        :default-props="supplierFieldNames"
        clearable
        download-code="supplier"
        @change="handleSupplierChange"
        @download-success="handleSupplierDownload"
      />
      <el-button class="demo-action" size="small" @click="supplierRef?.clear()">
        清空
      </el-button>
      <pre class="demo-result">{{ JSON.stringify({ id: supplierId, row: supplierRow }, null, 2) }}</pre>
    </yq-panel>

    <yq-panel padding-size="small" title="禁用和尺寸">
      <el-space direction="vertical" alignment="stretch" :size="6" style="width: 100%">
        <YqBasisCommonSelectApi
          :request-config="supplierRequestConfig"
          :default-props="supplierFieldNames"
          default-text="禁用状态"
          disabled
        />
        <YqBasisCommonSelectApi
          :request-config="supplierRequestConfig"
          :default-props="supplierFieldNames"
          size="small"
          dropdown-width="360px"
          placeholder="小尺寸、宽下拉层"
        />
      </el-space>
    </yq-panel>

    <yq-panel padding-size="small" title="客商下拉与下载组合">
      <div class="supplier-select-demo">
        <YqBasisCommonSelectApi
          v-model="companyId"
          v-model:default-text="companyText"
          :request-config="companyRequestConfig"
          :default-props="companyFieldNames"
          download-code="supplier"
          clearable
          @change="handleCompanyChange"
          @download-success="downloadedCompany = $event"
        />
      </div>
      <pre class="demo-result">{{ JSON.stringify({ companyId, companyText, selectedCompany, downloadedCompany }, null, 2) }}</pre>
    </yq-panel>
  </div>
</template>

<script lang="ts" setup>
import { portalStore } from "@cs/js-kanban-framework";
import { computed, ref } from "vue";

type BusinessRow = Record<string, any>;

const portal = portalStore();
const supplierRef = ref<any>();
const supplierId = ref<string | number | null>(null);
const supplierText = ref("");
const supplierRow = ref<BusinessRow | null>(null);
const companyId = ref<string | number | null>(null);
const companyText = ref("");
const selectedCompany = ref<BusinessRow | null>(null);
const downloadedCompany = ref<BusinessRow | null>(null);

const supplierFieldNames = { label: "supplierName", subLabel: "supplierCode", value: "id" };
const companyFieldNames = { label: "name", subLabel: "creditCode", value: "id" };
const supplierRequestConfig = computed(() => ({
  url: "/mb-base-info/common-suppliers/findMany",
  searchField: "supplierName",
  conditionItems: [
    { fieldName: "orgId", fieldValue: portal.$context.orgId, op: "eq" },
    { fieldName: "isEnable", fieldValue: true, op: "eq" },
  ],
}));
const companyRequestConfig = computed(() => ({
  url: "/mb-base-info/shared-data/company",
  searchField: "name",
  conditionItems: [
    { fieldName: "orgId", fieldValue: portal.lastProject?.id || portal.$context.orgId, op: "eq" },
  ],
}));
function handleSupplierChange(row: BusinessRow | null) {
  supplierRow.value = row;
  supplierText.value = row?.supplierName || "";
}

function handleSupplierDownload(row: BusinessRow) {
  supplierRow.value = row;
}

function handleCompanyChange(row: BusinessRow | null) {
  selectedCompany.value = row;
  companyText.value = row?.name || row?.supplierName || "";
}
</script>

<style scoped lang="less">
.demo-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.demo-action {
  margin-top: 8px;
}
.supplier-select-demo {
  width: 520px;
  max-width: 100%;
}
.demo-result {
  max-height: 180px;
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

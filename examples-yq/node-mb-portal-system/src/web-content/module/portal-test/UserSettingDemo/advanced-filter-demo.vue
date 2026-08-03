<template>
  <yq-tool-bar :background="true" padding-size="small" border tool-max-width="280px" divider>
    <template #tool>
      <el-space>
        <el-button :icon="Reset" type="default" plain @click="resetAdvancedFilters">
          重置
        </el-button>
        <yq-advanced-filter
          ref="advancedFilterRef"
          filter-code="receive_module_filter" :fields="fieldList" :preset-schemes="presetSchemeList"
          @search="handleFilterSearch"
        />
      </el-space>
    </template>
  </yq-tool-bar>
</template>

<script lang="ts" setup>
import type { FilterField, FilterScheme } from "@cs/vue3-biz-components-library";
import { Reset } from "@element-plus/icons-vue";

import { ref } from "vue";

// 页面自行维护过滤字段
const fieldList = ref<FilterField[]>([
  {
    id: "orderCode22",
    label: "单据编号",
    columnName: "orderCode",
    type: "text",
    component: {
      name: "ElInput",
      attributes: {
        placeholder: "请输入单据编号",
      },
    },
  },
  {
    id: "serviceTyp11",
    label: "业务类型",
    columnName: "serviceType",
    type: "enum_single",
    component: {
      name: "ElSelect",
      attributes: {
        placeholder: "请选择业务类型",
        options: [
          {
            label: "收料",
            value: 10,
          },
          {
            label: "调入",
            value: 20,
          },
        ],
      },
    },
  },
  {
    id: "orderDate",
    label: "账期",
    columnName: "orderDate",
    type: "date",
    component: {
      name: "ElDatePicker",
      attributes: {
        type: "month",
        valueFormat: "YYYY-MM",
        placeholder: "选择账期",
        format: "YYYY-MM",
      },
    },
  },
  {
    id: "totalAmount",
    columnName: "totalAmount",
    label: "总金额(元)",
    type: "number",
    component: {
      name: "ElInputNumber",
      attributes: {
        placeholder: "请输入总金额",
        align: "left",
      },
    },
  },
  {
    id: "taxAmount",
    columnName: "taxAmount",
    label: "税率",
    type: "number",
    component: {
      name: "ElInputNumber",
      attributes: {
        placeholder: "请输税率",
        align: "right",
        suffix: "%",
      },
    },
  },
]);

// 页面定义系统预设方案
const presetSchemeList: FilterScheme[] = [
  {
    id: "preset_all",
    name: "查询所有",
    type: "preset",
    conditions: [
      { id: "preset_all_1", fieldName: "orderCode", operator: "equals", fieldValue: "" },
      { id: "preset_all_2", fieldName: "serviceType", operator: "equals", fieldValue: 10, labelValue: "调入" },
    ],
  },
];

function handleFilterSearch(query) {
  console.log("过滤查询参数", query);
}

// 高级查询组件实例
const advancedFilterRef = ref<any>(null);

// 重置高级查询条件；高级查询和普通查询是独立的，不互不影响
function resetAdvancedFilters() {
  advancedFilterRef.value?.clearFilterState(true);
}
</script>

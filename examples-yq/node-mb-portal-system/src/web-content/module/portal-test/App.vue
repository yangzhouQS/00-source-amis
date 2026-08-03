<template>
  <yq-box padding-size="large">
    <el-tabs v-model="state.activeName">
      <el-tab-pane label="文件上传测试" name="file" lazy>
        <FileUpload />
      </el-tab-pane>
      <el-tab-pane label="图片卡片预览" name="card" lazy>
        <CardPreview />
      </el-tab-pane>
      <el-tab-pane label="业务组件测试" name="business" lazy>
        <BusinessComponentsDemo />
      </el-tab-pane>
      <el-tab-pane label="高级过滤器" name="filter" lazy>
        <AdvancedFilterDemo />
      </el-tab-pane>
      <el-tab-pane label="表格设置" name="setting" lazy>
        <TableSettingDemo />
      </el-tab-pane>
    </el-tabs>
  </yq-box>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import BusinessComponentsDemo from "./business-components/business-components-demo.vue";
import { CardPreview } from "./file-upload/card-preview";
import { FileUpload } from "./file-upload/file-upload";
import AdvancedFilterDemo from "./UserSettingDemo/advanced-filter-demo.vue";
import TableSettingDemo from "./UserSettingDemo/table-setting-demo.vue";

const state = reactive({
  inputVal: "",
  messageType: "success",
  messageText: "消息提示",
  activeName: "file",
});
</script>

<style lang="less" scoped>

</style>

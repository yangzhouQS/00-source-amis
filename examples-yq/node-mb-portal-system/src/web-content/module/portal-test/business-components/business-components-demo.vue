<template>
  <div class="business-components-demo">
    <el-divider>YqBasisCommonSelectApi</el-divider>
    <BasisCommonSelectDemo />

    <el-divider>YqDictionarySelect</el-divider>
    <DictionarySelectDemo />

    <el-divider>YqDictionaryTree</el-divider>
    <DictionaryTreeDemo />

    <el-divider>YqSelectComMaterial</el-divider>
    <MaterialSelectDemo />

    <el-divider>YqOrganizationTreeSelect</el-divider>
    <OrganizationSelectDemo />

    <el-divider>YqOrganizationTreePanel</el-divider>
    <OrganizationPanelDemo />
  </div>
</template>

<script lang="ts" setup>
import BasisCommonSelectDemo from "./basis-common-select-demo.vue";
import DictionarySelectDemo from "./dictionary-select-demo.vue";
import DictionaryTreeDemo from "./dictionary-tree-demo.vue";
import MaterialSelectDemo from "./material-select-demo.vue";
import OrganizationPanelDemo from "./organization-panel-demo.vue";
import OrganizationSelectDemo from "./organization-select-demo.vue";
</script>

<style scoped lang="less">
.business-components-demo {
  padding-bottom: 16px;
}
</style>

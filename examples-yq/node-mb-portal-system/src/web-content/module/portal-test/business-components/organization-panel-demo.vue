<template>
  <div class="panel-grid">
    <yq-panel style="width:400px" border padding-size="small" title="单选 + 默认根节点 + 外部回显">
      <el-space class="demo-actions" :size="6" wrap>
        <el-input v-model="singleText" size="small" placeholder="修改 defaultText 测试响应式回显" />
        <el-button size="small" @click="singleRef?.clear()">
          清空
        </el-button>
        <el-button size="small" @click="singleRef?.reload()">
          刷新
        </el-button>
      </el-space>
      <YqOrganizationTreePanel
        ref="singleRef"
        v-model="singleId"
        :default-text="singleText"
        :current-size="10"
        :more-enable="true"
        clearable
        @change="handleSingleChange"
        @clear="singleText = ''"
      />
    </yq-panel>

    <yq-panel style="width:400px" border padding-size="small" title="多选 Checkbox">
      <el-space class="demo-actions" :size="6" wrap>
        <el-button size="small" @click="selectRoot">
          选中节点
        </el-button>
        <el-button size="small" @click="multipleRef?.clear()">
          清空
        </el-button>
      </el-space>
      <YqOrganizationTreePanel
        ref="multipleRef"
        v-model="multipleIds"
        :root-node="portalRootNode"
        :current-size="10"
        multiple
        clearable
        @checked-change="checkedChange"
      /></yq-panel>
      <!-- <pre class="demo-result">{{ JSON.stringify({ id: singleId, node: singleNode }, null, 2) }}</pre>
      <pre class="demo-result">{{ JSON.stringify({ ids: multipleIds, nodes: multipleNodes }, null, 2) }}</pre> -->
  </div>
</template>

<script lang="ts" setup>
import { portalStore } from "@cs/js-kanban-framework";
import { computed, ref } from "vue";

type OrganizationNode = Record<string, any>;

const portal = portalStore();
const portalRootNode = computed<OrganizationNode>(() => ({
  id: portal.$context.orgId,
  name: portal.$context.orgName || portal.$context.orgShortName || "组织机构",
  shortName: portal.$context.orgShortName || portal.$context.orgName || "组织机构",
  fullId: portal.$context.fullId,
}));
const singleId = ref<string | number | null>(portal.$context.orgId || null);
const singleText = ref(portal.$context.orgShortName || portal.$context.orgName || "组织机构");
const singleNode = ref<OrganizationNode | null>(null);
const multipleIds = ref<Array<string | number>>([]);
const multipleNodes = ref<OrganizationNode[]>([]);
const singleRef = ref<any>();
const multipleRef = ref<any>();

function handleSingleChange(node: OrganizationNode | null) {
  singleNode.value = node;
  singleText.value = node?.name || node?.shortName || "";
}

function selectRoot() {
  multipleRef.value?.setChecked?.([
    portalRootNode.value,
    { id: "7816723087493120" },
    { id: "4645930449518592" },
  ]);
}
const checkedChange = (nodes: OrganizationNode[]) => {
  multipleNodes.value = nodes;
  console.log("checkedChange", nodes);
};
</script>

<style scoped lang="less">
.panel-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  height: 500px;
}
.demo-actions {
  margin-top: 8px;
}
.demo-result {
  max-height: 160px;
  margin: 8px 0 0;
  overflow: auto;
  font-size: 12px;
  white-space: pre-wrap;
}
</style>

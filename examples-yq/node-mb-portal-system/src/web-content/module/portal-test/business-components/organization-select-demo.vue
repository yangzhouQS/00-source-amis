<template>
  <div class="demo-grid">
    <yq-panel padding-size="small" title="内部加载默认根节点">
      <YqOrganizationTreeSelect v-model="defaultId" clearable @change="defaultNode = $event" />
      <pre class="demo-result">{{ formatResult(defaultId, defaultNode) }}</pre>
    </yq-panel>

    <yq-panel padding-size="small" title="Portal 组织作为根节点 + 外部回显">
      <el-input v-model="portalText" size="small" placeholder="修改 defaultText 测试响应式回显" />
      <YqOrganizationTreeSelect
        ref="portalSelectRef"
        v-model="portalId"
        v-model:default-text="portalText"
        :root-node="portalRootNode"
        :default-expanded-keys="expandedKeys"
        clearable
        @change="portalNode = $event"
        @clear="portalText = ''"
      />
      <el-space class="demo-actions" :size="6" wrap>
        <el-button size="small" @click="expandPortalRoot">
          展开根节点
        </el-button>
        <el-button size="small" @click="portalSelectRef?.clear()">
          清空
        </el-button>
        <el-button size="small" @click="portalSelectRef?.reload()">
          刷新
        </el-button>
      </el-space>
      <pre class="demo-result">{{ formatResult(portalId, portalNode) }}</pre>
    </yq-panel>

    <yq-panel padding-size="small" title="禁用状态">
      <YqOrganizationTreeSelect :root-node="portalRootNode" default-text="禁用状态" disabled />
    </yq-panel>

    <yq-panel padding-size="small" title="尺寸和宽度">
      <el-space direction="vertical" alignment="stretch" :size="6" style="width: 100%">
        <YqOrganizationTreeSelect :root-node="portalRootNode" width="280px" size="small" placeholder="小尺寸 280px" />
        <YqOrganizationTreeSelect :root-node="portalRootNode" width="100%" size="large" placeholder="大尺寸 100%" />
      </el-space>
    </yq-panel>
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
const defaultId = ref<string | number | null>(null);
const defaultNode = ref<OrganizationNode | null>(null);
const portalId = ref<string | number | null>(portal.$context.orgId || null);
const portalText = ref(portal.$context.orgShortName || portal.$context.orgName || "组织机构");
const portalNode = ref<OrganizationNode | null>(null);
const expandedKeys = ref<Array<string | number>>([]);
const portalSelectRef = ref<any>();

function formatResult(id: unknown, node: unknown) {
  return JSON.stringify({ id, node, expandedKeys: expandedKeys.value }, null, 2);
}

function expandPortalRoot() {
  const id = portalRootNode.value.id;
  expandedKeys.value = id === undefined ? [] : [id];
}
</script>

<style scoped lang="less">
.demo-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.demo-actions {
  margin-top: 8px;
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

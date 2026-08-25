// 本地占位实现（私有包不可从公共 registry 获取；编辑器 lint 配置按需接入真实包）
const config = { rules: {}, extends: [] };
export default config;
export const configs = { recommended: config };

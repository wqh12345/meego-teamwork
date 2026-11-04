/**
 * 飞书审批 · 数据访问层
 *
 * 组件只依赖本文件；每个方法内部按 `feishuRuleMock.js` 的 `FEISHU_API_READY` 开关
 * 决定走「真实接口」还是「mock」。
 *
 * 接口就绪时：把 `FEISHU_API_READY` 里对应开关置为 true 即可，组件不用改。
 * 接口全部就绪后：删掉本文件与 `feishuRuleMock.js`，把这几个方法改成直接调 `api.js`。
 *
 * 统一约定：返回业务数据；**失败 / 不存在返回 null**（真实接口失败时请求层已弹过全局 toast）。
 */
import {
  getFeishuApprovalRuleList,
  getFeishuApprovalRuleDetail,
  postFeishuCheckTemplate,
  getFeishuTemplateFields,
  getFeishuMappingSources,
  getFeishuWorkItemTypes,
  getWorkitemRole,
} from '../../../../../../api/api';
import {
  FEISHU_API_READY,
  FEISHU_APPROVAL_RULE_MOCK,
  getRuleDetailMock,
  getTemplateFieldsMock,
  getMappingSourcesMock,
  getWorkItemTypesMock,
  getWorkItemRolesMock,
} from './feishuRuleMock';

/** 请求层在业务码非成功时 resolve 成 false，这里统一收敛 */
const unwrap = (res) => (res && res.result ? res.data : null);

/** 2.1 规则列表（接口已按 createTime 倒序） */
export async function fetchRuleList(projectKey) {
  if (!FEISHU_API_READY.ruleList) return FEISHU_APPROVAL_RULE_MOCK;
  const data = unwrap(await getFeishuApprovalRuleList({ projectKey }));
  return Array.isArray(data) ? data : [];
}

/** 2.2 规则详情；本地新增（无 id）的规则直接返回自身 */
export async function fetchRuleDetail(rule) {
  if (!rule) return null;
  if (rule.id === undefined || rule.id === null) return rule;
  if (!FEISHU_API_READY.ruleList) return getRuleDetailMock(rule.id) || rule;
  return unwrap(await getFeishuApprovalRuleDetail(rule.id)) || rule;
}

/**
 * 保存前 / 打开弹窗前校验：POST approval/feishu/checkTemplate
 * 请求体与保存数据结构一致：{ projectKey, id, ruleName, workItems, approvalCode, fieldMappings }
 * 后端校验优先级：90010 模板不存在 → 90001 工作项被占 → 90013 重名 → 90002 模板已变更
 * 失败（非 200）时全局请求层已弹后端 msg，调用方只需按返回值决定放行 / 拦截
 * @returns {Promise<boolean>} true = 全部通过；false = 任一校验命中
 */
export async function checkFeishuTemplate(payload) {
  // mock 未就绪 → 默认放行，不阻塞前端联调
  if (!FEISHU_API_READY.checkTemplate) return true;
  const res = await postFeishuCheckTemplate(payload);
  return !!(res && res.result);
}

/** 3.1 模板控件列表；模板不存在返回 null */
export async function fetchTemplateFields(approvalCode, projectKey) {
  if (!approvalCode) return null;
  if (!FEISHU_API_READY.templateFields) return getTemplateFieldsMock(approvalCode);
  return unwrap(await getFeishuTemplateFields({ approvalCode, projectKey }));
}

/** 3.2 映射来源选项；不传类型则返回全部（前端按行的类型自行过滤） */
export async function fetchMappingSources(feishuFieldType, projectKey) {
  if (!FEISHU_API_READY.mappingSources) return getMappingSourcesMock(feishuFieldType).sources || [];
  const data = unwrap(
    await getFeishuMappingSources({ projectKey, ...(feishuFieldType ? { feishuFieldType } : {}) }),
  );
  return (data && data.sources) || [];
}

/** 2.5 工作项类型列表（含「是否已被规则占用」→ 置灰）；编辑时传 excludeRuleId 放行自身 */
export async function fetchWorkItemTypes(projectKey, excludeRuleId) {
  if (!FEISHU_API_READY.workItemTypes) return getWorkItemTypesMock(excludeRuleId).items || [];
  const data = unwrap(
    await getFeishuWorkItemTypes({
      projectKey,
      ...(excludeRuleId !== undefined && excludeRuleId !== null ? { excludeRuleId } : {}),
    }),
  );
  return (data && data.items) || [];
}

/** 4.1 工作项角色 */
export async function fetchWorkItemRoles(workItemId, projectKey) {
  if (!workItemId) return [];
  if (!FEISHU_API_READY.workItemRoles) return getWorkItemRolesMock(workItemId);
  const data = unwrap(await getWorkitemRole({ workItemId, projectKey }));
  return Array.isArray(data) ? data : [];
}

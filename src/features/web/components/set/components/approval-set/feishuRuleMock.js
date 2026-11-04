/**
 * 飞书审批 · mock 数据（V5.3）
 *
 * 依据：《V5.3-飞书审批开发文档》
 * 用途：下列接口后端未就绪期间，用本文件的 mock 数据把
 *      「列表 → 新建 / 编辑 / 删除 → 页面统一保存」整条链路先跑通。
 *
 * 切换方式（接口逐个就绪，可逐个切）：
 *   1. 把 `FEISHU_API_READY` 里对应开关置为 true；
 *   2. 或者删掉本文件、移除组件里的 mock 分支与 import。
 *
 * 本文件里的数据结构与接口出参**完全一致**，切换时渲染与提交逻辑都不用改。
 * 每个段落都标了对应的开发文档章节号。
 */

/* ------------------------------------------------------------------ *
 * 开关
 * ------------------------------------------------------------------ */

/** 接口就绪开关：true = 走真实接口，false = 用本文件的 mock（对应开发文档各章节） */
export const FEISHU_API_READY = {
  ruleList: true,        // 2.1 规则列表 / 2.2 规则详情
  checkTemplate:true,     // 保存前 / 打开弹窗前校验 approval/feishu/checkTemplate（替代旧 template/check）
  workItemTypes:true,     // 2.5 工作项类型列表（含是否已配置 → 置灰）
  templateFields:true,    // 3.1 拉取模板控件列表
  mappingSources:true,   // 3.2 字段映射来源选项
  workItemRoles:true,      // 4.1 工作项角色
  // ↓ 本期前端**不使用**：决策为「只改本地 + 页面统一保存」，这两条接口留给后端 / 其他端
  ruleSave: false,        // 2.3 新建、编辑规则
  ruleDelete: false,      // 2.4 删除规则
};

/**
 * @deprecated 旧开关，仅为兼容 ApprovalSet.jsx 现有引用保留。
 * 新代码请统一用 `FEISHU_API_READY.ruleList`。
 */
export const FEISHU_RULE_API_READY = FEISHU_API_READY.ruleList;

/* ------------------------------------------------------------------ *
 * 错误码（开发文档「错误码」章节）
 * ------------------------------------------------------------------ */

export const FEISHU_ERROR_CODES = {
  TEMPLATE_NOT_FOUND: 1390002,     // 未找到该审批模板，请检查模板 Approval Code 是否正确
  WORK_ITEM_BOUND: 90001,          // 本次提交内同一工作项被多条规则绑定
  TEMPLATE_CHANGED: 90002,         // 字段映射与飞书模板比对失败
  MAPPING_SOURCE_MISMATCH: 90003,  // mappingSource 与控件类型不匹配
  ROLE_CONFIG_REQUIRED: 90004,     // 选了 roleApproval 但 roleWorkItemConfig 为空
  RULE_NAME_INVALID: 90005,        // 规则名为空或超 30 字
  WORK_ITEM_EMPTY: 90006,          // workItemIds 为空
  TEMPLATE_INVALID: 90010,         // approvalCode 为空或模板查不到
  RULES_EMPTY: 90011,              // approvalType=2 且 rules 为空数组
  RULE_NOT_IN_PROJECT: 90012,      // 规则 id 不属于当前空间
  RULE_NAME_DUPLICATED: 90013,     // 规则名称与同空间已有规则重名
};

/** 错误码 → 前端提示文案（前端按 code 兜底展示） */
export const FEISHU_ERROR_MESSAGES = {
  [FEISHU_ERROR_CODES.TEMPLATE_NOT_FOUND]: '未找到该审批模板，请检查模板Approval Code是否正确',
  [FEISHU_ERROR_CODES.WORK_ITEM_BOUND]: '该工作项已配置审批规则，请先解除原规则绑定',
  [FEISHU_ERROR_CODES.TEMPLATE_CHANGED]: '飞书审批模板已变更，请刷新字段映射后重试',
  [FEISHU_ERROR_CODES.MAPPING_SOURCE_MISMATCH]: '内容映射来源与飞书控件类型不匹配，请重新选择',
  [FEISHU_ERROR_CODES.ROLE_CONFIG_REQUIRED]: '请为所有工作项选择角色',
  [FEISHU_ERROR_CODES.RULE_NAME_INVALID]: '请输入 1~30 个字符的规则名称',
  [FEISHU_ERROR_CODES.WORK_ITEM_EMPTY]: '请选择工作项',
  [FEISHU_ERROR_CODES.TEMPLATE_INVALID]: '未找到该审批模板，请检查模板Approval Code是否正确',
  [FEISHU_ERROR_CODES.RULES_EMPTY]: '请先添加审批规则',
  [FEISHU_ERROR_CODES.RULE_NOT_IN_PROJECT]: '该规则不属于当前空间，请刷新后重试',
  [FEISHU_ERROR_CODES.RULE_NAME_DUPLICATED]: '规则名称已存在，请修改后重试',
};

/* ------------------------------------------------------------------ *
 * 3.2 字段映射来源选项  GET /approval/feishu/mapping/sources
 *     ⚠️ 前端不硬编码，一律以本接口下发为准（保证与后端校验一致）
 * ------------------------------------------------------------------ */

const TEXT_TYPES = ['input', 'textarea'];
const CONTACT_TYPES = ['contact'];

export const FEISHU_MAPPING_SOURCES_MOCK = {
  sources: [
    { value: 'changeType',     label: '变更类型',   fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'workItem',       label: '所属工作项', fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'project',        label: '所属项目',   fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'registerObject', label: '登记对象',   fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'workDate',       label: '工作日期',   fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'workHour',       label: '登记工时',   fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'workDesc',       label: '工作描述',   fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'registeredHour', label: '已登记工时', fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'summaryHour',    label: '汇总工时',   fieldTypes: TEXT_TYPES,    needRoleConfig: false },
    { value: 'teamAdmin',      label: '团队管理员', fieldTypes: CONTACT_TYPES, needRoleConfig: false },
    { value: 'roleApproval',   label: '角色审批',   fieldTypes: CONTACT_TYPES, needRoleConfig: true },
  ],
};

/**
 * 3.2 的 mock 实现
 * @param {string} [feishuFieldType] 传则只返回该控件类型可用的来源；不传返回全部
 * @returns {{sources: Array}} 该类型无可用来源时 sources 为空数组（前端下拉展示「暂无数据」）
 */
export function getMappingSourcesMock(feishuFieldType) {
  const all = FEISHU_MAPPING_SOURCES_MOCK.sources;
  if (!feishuFieldType) return { sources: all };
  // 明细控件（fieldList）是容器，不参与映射，映射落在它的列上（列按自身类型取来源）
  if (feishuFieldType === 'fieldList') return { sources: [] };
  return { sources: all.filter((s) => s.fieldTypes.includes(feishuFieldType)) };
}

/* ------------------------------------------------------------------ *
 * 2.5 工作项类型列表  GET /approval/config/getWorkItemTypes
 *     只有 configured=true 会置灰；编辑时传 excludeRuleId 排除自己
 * ------------------------------------------------------------------ */

const SLIM_WORK_ITEM_TYPES = {
  items: [
    { workItemId: 'task',     workItemName: '任务',   configured: false, ruleId: null, ruleName: null },
    { workItemId: 'bug',      workItemName: '缺陷',   configured: false, ruleId: null, ruleName: null },
    { workItemId: 'story',    workItemName: '需求',   configured: false, ruleId: null, ruleName: null },
    { workItemId: 'sub_task', workItemName: '子任务', configured: false, ruleId: null, ruleName: null },
    { workItemId: 'sprint',   workItemName: '迭代',   configured: false, ruleId: null, ruleName: null },
    { workItemId: 'sprint2',   workItemName: '迭代2',   configured: false, ruleId: null, ruleName: null },
  ],
};

/**
 * 2.5 的 mock 实现：按已存在的规则列表算出「谁被占用」
 * @param {number|null} [excludeRuleId] 编辑规则时传自身 id，把自己占用的工作项视为未占用
 */
export function getWorkItemTypesMock(excludeRuleId) {
  const occupied = {};
  FEISHU_APPROVAL_RULE_MOCK.forEach((rule) => {
    if (excludeRuleId != null && rule.id === excludeRuleId) return;
    (rule.workItems || []).forEach((w) => {
      occupied[w.workItemId] = { ruleId: rule.id, ruleName: rule.ruleName };
    });
  });
  return {
    items: SLIM_WORK_ITEM_TYPES.items.map((it) => {
      const o = occupied[it.workItemId];
      return o
        ? { ...it, configured: true, ruleId: o.ruleId, ruleName: o.ruleName }
        : { ...it, configured: false, ruleId: null, ruleName: null };
    }),
  };
}

/* ------------------------------------------------------------------ *
 * 4.1 工作项角色  GET /approval/config/workitem/roles?workItemId=xxx
 * ------------------------------------------------------------------ */

export const FEISHU_WORKITEM_ROLES_MOCK = {
  task: [
    { id: 1, workItemId: 'task', workItemName: '任务', roleId: 'role_44c1d8', roleName: '项目经理', tag: 0 },
    { id: 2, workItemId: 'task', workItemName: '任务', roleId: 'role_7a10bb', roleName: '产品经理', tag: 0 },
  ],
  bug: [
    { id: 3, workItemId: 'bug', workItemName: '缺陷', roleId: 'role_2b71e4', roleName: '测试负责人', tag: 0 },
  ],
  story: [
    { id: 4, workItemId: 'story', workItemName: '需求', roleId: 'role_9f3a2c', roleName: '产品负责人', tag: 0 },
  ],
  sub_task: [
    { id: 5, workItemId: 'sub_task', workItemName: '子任务', roleId: 'role_5c88e0', roleName: '开发负责人', tag: 0 },
  ],
  sprint: [
    { id: 6, workItemId: 'sprint', workItemName: '迭代', roleId: 'role_3d21f9', roleName: '迭代负责人', tag: 0 },
  ],
};

/** 4.1 的 mock 实现 */
export function getWorkItemRolesMock(workItemId) {
  return FEISHU_WORKITEM_ROLES_MOCK[workItemId] || [];
}

/* ------------------------------------------------------------------ *
 * 3.1 模板控件列表  GET /approval/feishu/template/fields?approvalCode=xxx
 *     可用 code 见下方 keys；查不到的 code 返回 null（前端复现「未找到模板」失败态）
 * ------------------------------------------------------------------ */

export const FEISHU_TEMPLATE_FIELDS_MOCK = {
  /** UI 图里的模板：图 1 / 图 3 的「审批名称：AI 项目工时审批」 */
  TPL_001: {
    approvalCode: 'TPL_001',
    approvalName: 'AI 项目工时审批',
    fields: [
      // 必填 + 规则详情里没映射 → 演示「三路合并」分支 1：仍展示、来源为空 + 红框（对应图 1 的 工时提交人*）
      { feishuFieldId: 'widget_submitter', feishuFieldName: '工时提交人', feishuFieldType: 'contact', required: true },
      // 非必填 + 规则详情里已映射 → 演示分支 3：保留展示
      { feishuFieldId: 'widget_work_period', feishuFieldName: '工作周期', feishuFieldType: 'input', required: false },
      // 非必填 + 已映射为「角色审批」→ 演示「多工作项角色配置」子区域（对应图 3 的 变更类型）
      // 注意：roleApproval 只适用于 contact 类型（开发文档 3.2），所以这里给的是 contact
      { feishuFieldId: 'widget_change_type', feishuFieldName: '变更类型', feishuFieldType: 'contact', required: false },
      // 明细控件：容器本身 mappingSource 必须为空，映射落在 columns 上（开发文档 0.2 / 6）
      {
        feishuFieldId: 'widget_hour_detail',
        feishuFieldName: '工时明细',
        feishuFieldType: 'fieldList',
        required: false,
        columns: [
          { feishuFieldId: 'col_work_item', feishuFieldName: '所属工作项', feishuFieldType: 'input', required: true },
          { feishuFieldId: 'col_work_hour', feishuFieldName: '登记工时', feishuFieldType: 'input', required: true },
        ],
      },
    ],
  },
  TPL_002: {
    approvalCode: 'TPL_002',
    approvalName: '研发工时审批',
    fields: [
      { feishuFieldId: 'widget_002_project', feishuFieldName: '所属项目', feishuFieldType: 'input', required: true },
      { feishuFieldId: 'widget_002_date', feishuFieldName: '工作日期', feishuFieldType: 'input', required: true },
      { feishuFieldId: 'widget_002_hour', feishuFieldName: '登记工时', feishuFieldType: 'input', required: true },
      { feishuFieldId: 'widget_002_admin', feishuFieldName: '团队管理员', feishuFieldType: 'contact', required: true },
    ],
  },
};

/**
 * 3.1 的 mock 实现
 * @returns {object|null} null = 模板不存在（对应错误码 1390002 / 90010）
 */
export function getTemplateFieldsMock(approvalCode) {
  return FEISHU_TEMPLATE_FIELDS_MOCK[approvalCode] || null;
}

/* ------------------------------------------------------------------ *
 * 【新增接口·后端待开发】模板字段变化校验
 *     路径 / 方法 / 命名待后端定，暂按 GET /approval/feishu/template/check?projectKey=&ruleId= 约定
 *     调用时机：**打开编辑弹窗时先调**（未修改 Approval Code 也要调）
 *     返回 changed=true → 前端 toast 失败信息，但**不阻断**，弹窗照常打开、数据照常展示
 *     changed=true 时 toast 文案直接用 FEISHU_ERROR_MESSAGES[90002]
 * ------------------------------------------------------------------ */

export const FEISHU_TEMPLATE_CHECK_MOCK = {
  /** 有变化：模板新增了必填字段 + 规则里存的控件已被删除 */
  10: {
    changed: true,
    approvalCode: 'TPL_001',
    approvalName: 'AI 项目工时审批',
    changes: [
      { feishuFieldId: 'widget_submitter', feishuFieldName: '工时提交人', type: 'ADDED_REQUIRED' },
      { feishuFieldId: 'widget_deleted_001', feishuFieldName: '已删除的控件', type: 'DELETED' },
    ],
  },
  /** 无变化 */
  12: {
    changed: false,
    approvalCode: 'TPL_002',
    approvalName: '研发工时审批',
    changes: [],
  },
};

/**
 * 校验接口的 mock 实现
 * @returns {object|null} null = 接口异常；**异常时不阻断打开弹窗**（只记日志），
 *                        否则校验接口挂掉会导致编辑功能完全不可用
 */
export function checkTemplateFieldsMock(ruleId) {
  return FEISHU_TEMPLATE_CHECK_MOCK[ruleId] || null;
}

/* ------------------------------------------------------------------ *
 * 2.2 规则详情  GET /approval/feishu/rule/{id}
 *     编辑弹窗回显用；fieldMappings 结构同 2.3 保存请求体
 * ------------------------------------------------------------------ */

const RULE_DETAIL_10 = {
  id: 10,
  ruleName: '加班审批规则',
  approvalCode: 'TPL_001',
  approvalName: 'AI 项目工时审批',
  workItems: [
    { workItemId: 'task', workItemName: '任务' },
    { workItemId: 'bug', workItemName: '缺陷' },
  ],
  /**
   * 这份 fieldMappings 专门用来演示「编辑态打开 → 拉最新模板 → 三路合并」的三种情况：
   *   1) 模板必填字段「工时提交人」这里**故意不存** → 展示但来源为空 + 红框（分支 1）
   *   2) 「已删除的控件」这个 id 不在模板里        → 该行不展示、旧映射丢弃（分支 2）
   *   3) 「工作周期」非必填且存在于模板中          → 保留展示（分支 3）
   */
  fieldMappings: [
    {
      feishuFieldId: 'widget_deleted_001',
      feishuFieldName: '已删除的控件',
      feishuFieldType: 'input',
      required: false,
      mappingSource: 'workHour',
      roleWorkItemConfig: [],
      columns: [],
    },
    {
      feishuFieldId: 'widget_work_period',
      feishuFieldName: '工作周期',
      feishuFieldType: 'input',
      required: false,
      // ⚠️ 图 1 里这一行显示的是「工时周期」，但该来源不在开发文档 3.2 的下发清单里，
      //    这里先用「已登记工时」占位。见需求文档 Q4：确认是图旧了，还是要后端新增 workPeriod。
      mappingSource: 'registeredHour',
      roleWorkItemConfig: [],
      columns: [],
    },
    {
      feishuFieldId: 'widget_change_type',
      feishuFieldName: '变更类型',
      feishuFieldType: 'contact',
      required: false,
      mappingSource: 'roleApproval',
      // 角色配置属于「当前这一个飞书字段」，多个字段都选角色审批时各自一份（开发文档 1.2）
      roleWorkItemConfig: [
        { workItemId: 'task', workItemName: '任务', roleId: 'role_44c1d8', roleName: '项目经理' },
        { workItemId: 'bug', workItemName: '缺陷', roleId: 'role_2b71e4', roleName: '测试负责人' },
      ],
      columns: [],
    },
    {
      // 明细控件：容器 mappingSource 必须为 null，映射写在 columns 里
      feishuFieldId: 'widget_hour_detail',
      feishuFieldName: '工时明细',
      feishuFieldType: 'fieldList',
      required: false,
      mappingSource: null,
      roleWorkItemConfig: [],
      columns: [
        {
          feishuFieldId: 'col_work_item',
          feishuFieldName: '所属工作项',
          feishuFieldType: 'input',
          required: true,
          mappingSource: 'workItem',
          roleWorkItemConfig: [],
          columns: [],
        },
        {
          feishuFieldId: 'col_work_hour',
          feishuFieldName: '登记工时',
          feishuFieldType: 'input',
          required: true,
          mappingSource: 'workHour',
          roleWorkItemConfig: [],
          columns: [],
        },
      ],
    },
  ],
};

const RULE_DETAIL_12 = {
  id: 12,
  ruleName: '研发工时审批',
  approvalCode: 'TPL_002',
  approvalName: '研发工时审批',
  workItems: [{ workItemId: 'story', workItemName: '需求' }],
  fieldMappings: [
    {
      feishuFieldId: 'widget_002_project',
      feishuFieldName: '所属项目',
      feishuFieldType: 'input',
      required: true,
      mappingSource: 'project',
      roleWorkItemConfig: [],
      columns: [],
    },
    {
      feishuFieldId: 'widget_002_date',
      feishuFieldName: '工作日期',
      feishuFieldType: 'input',
      required: true,
      mappingSource: 'workDate',
      roleWorkItemConfig: [],
      columns: [],
    },
    {
      feishuFieldId: 'widget_002_hour',
      feishuFieldName: '登记工时',
      feishuFieldType: 'input',
      required: true,
      mappingSource: 'workHour',
      roleWorkItemConfig: [],
      columns: [],
    },
    {
      feishuFieldId: 'widget_002_admin',
      feishuFieldName: '团队管理员',
      feishuFieldType: 'contact',
      required: true,
      mappingSource: 'teamAdmin',
      roleWorkItemConfig: [],
      columns: [],
    },
  ],
};

/** 2.2 的 mock 实现；id 不存在返回 null */
export function getRuleDetailMock(id) {
  if (id === RULE_DETAIL_10.id) return RULE_DETAIL_10;
  if (id === RULE_DETAIL_12.id) return RULE_DETAIL_12;
  return null;
}

/* ------------------------------------------------------------------ *
 * 2.1 规则列表  GET /approval/feishu/rule/list
 *     按 createTime 倒序（最新的在最前）—— 与接口实现一致
 * ------------------------------------------------------------------ */

export const FEISHU_APPROVAL_RULE_MOCK = [
  { ...RULE_DETAIL_12, createTime: '2026-09-18 10:20:00' },
  { ...RULE_DETAIL_10, createTime: '2026-09-01 12:00:00' },
];

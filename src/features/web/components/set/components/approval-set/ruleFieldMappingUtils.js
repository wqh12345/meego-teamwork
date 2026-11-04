/**
 * 飞书审批 · 字段映射的纯逻辑
 *
 * 从 RuleEditModal 里抽出来的原因：三路合并与结构转换是整块需求最容易出错的地方，
 * 抽成无副作用函数后可以单独跑用例验证（`node` 直接跑，无需渲染组件）。
 */

export const ROLE_APPROVAL = 'roleApproval';
export const FIELD_LIST = 'fieldList';

/**
 * 按 feishuFieldId 从「规则详情已存映射」里找对应项。
 * 明细内的列要限定在所属容器内 —— 列 id 只在明细内唯一、跨明细可能重复。
 */
export const findStored = (stored, feishuFieldId, containerId) => {
  if (containerId) {
    const container = (stored || []).find((m) => m.feishuFieldId === containerId);
    return (container?.columns || []).find((m) => m.feishuFieldId === feishuFieldId);
  }
  return (stored || []).find((m) => m.feishuFieldId === feishuFieldId);
};

/**
 * 模板控件列表 × 规则详情已存映射 → 字段映射表格行
 *
 *   分支 1｜模板字段：**一律展示**（必填 / 非必填都渲染），非必填只是「来源允许为空」
 *   分支 2｜已存映射的 feishuFieldId 不在模板中 → 不展示（旧映射丢弃）
 *   分支 3｜已存映射命中模板字段 → 回显来源 / 角色配置
 *
 * 明细控件（fieldList）容器占一行，其列递归套用同一规则；
 * 列行的 key 用 `${容器id}::${列id}`，避免跨明细重名。
 *
 * @param {Array} fields 3.1 模板控件列表
 * @param {Array} stored 2.2 规则详情的 fieldMappings（新建 / 刷新 / 换模板时传 []）
 */
export const buildRows = (fields, stored) => {
  const rows = [];
  const walk = (list, containerId) => {
    (list || []).forEach((field) => {
      const isContainer = field.feishuFieldType === FIELD_LIST;
      const mapping = findStored(stored, field.feishuFieldId, containerId);
      rows.push({
        key: containerId ? `${containerId}::${field.feishuFieldId}` : field.feishuFieldId,
        feishuFieldId: field.feishuFieldId,
        feishuFieldName: field.feishuFieldName,
        feishuFieldType: field.feishuFieldType,
        required: !!field.required,
        isContainer,
        parentKey: containerId || null,
        mappingSource: mapping?.mappingSource || undefined,
        roleWorkItemConfig: mapping?.roleWorkItemConfig || [],
      });
      if (isContainer) walk(field.columns, field.feishuFieldId);
    });
  };
  walk(fields, null);
  return rows;
};

/** 表格行 → 接口 fieldMappings 结构（明细容器把自己的列完整带上；容器本身 mappingSource 为 null） */
export const toFieldMappings = (rows) => {
  const pick = (row) => ({
    feishuFieldId: row.feishuFieldId,
    feishuFieldName: row.feishuFieldName,
    feishuFieldType: row.feishuFieldType,
    required: !!row.required,
    mappingSource: row.isContainer ? null : row.mappingSource || null,
    roleWorkItemConfig:
      !row.isContainer && row.mappingSource === ROLE_APPROVAL
        ? (row.roleWorkItemConfig || []).map(({ workItemId, workItemName, roleId, roleName }) => ({
            workItemId,
            workItemName,
            roleId,
            roleName,
          }))
        : [],
    columns: [],
  });

  return rows
    .filter((row) => !row.parentKey)
    .map((row) => {
      const item = pick(row);
      if (row.isContainer) {
        item.columns = rows.filter((child) => child.parentKey === row.key).map(pick);
      }
      return item;
    });
};

/** 把 fieldMappings（含明细的列）压成一维可比较的字符串数组 */
export const flattenMappings = (list, containerId) => {
  const out = [];
  (list || []).forEach((mapping) => {
    const key = containerId ? `${containerId}::${mapping.feishuFieldId}` : mapping.feishuFieldId;
    const roles = (mapping.roleWorkItemConfig || [])
      .map((role) => `${role.workItemId}:${role.roleId || ''}`)
      .sort()
      .join('+');
    out.push(`${key}|${mapping.mappingSource || ''}|${roles}`);
    if (mapping.columns && mapping.columns.length) {
      out.push(...flattenMappings(mapping.columns, mapping.feishuFieldId));
    }
  });
  return out;
};

/**
 * 表单签名 —— 脏检查用。
 *
 * ⚠️ 基线必须取「服务端已存的数据」而不是「三路合并后的界面数据」：
 * 若模板已变更（控件被删 / 新增必填），合并结果与已存数据本就不同，
 * 此时应当算「有改动」、允许保存，否则会出现
 * 「页面保存报 90002 → 打开规则弹窗又因无改动无法保存」的死锁。
 *
 * 只比较会被提交的字段：规则名称 / Approval Code / 工作项 / 映射来源 / 角色配置。
 * 不比较 `required`（仅用于展示星号）、控件顺序、createTime。
 */
export const buildSignature = (ruleName, approvalCode, workItems, fieldMappings) =>
  JSON.stringify({
    n: (ruleName || '').trim(),
    c: (approvalCode || '').trim(),
    w: (workItems || [])
      .map((w) => w.workItemId)
      .sort()
      .join(','),
    m: flattenMappings(fieldMappings).sort().join(';'),
  });

/**
 * 表格行 → 展示行（**纯展示层**变换，不改数据结构）。
 *
 * 明细控件（fieldList）是容器，它的列在 rows 里是独立行、靠 parentKey 归属。
 * 设计稿要求「容器名在第一列纵向合并、子列名在第二列、来源在第三列」，
 * 因此把容器的**第一个**子列并入容器行，其余子列照常输出：
 *
 *   { kind: 'container', container, child, rowSpan }  容器行（child 即被并入的首个子列）
 *   { kind: 'leaf', row }                             普通字段 / 非首个子列
 *   { kind: 'bare', row }                             容器但不可合并（无子列 / 首子列仍是容器）
 *
 * `rowSpan` 取「该组实际渲染出的行数」而非子列个数 —— 子列里再嵌容器时两者不相等，
 * 取错会把表格撑坏。不可合并时退化为 `bare`，容器单独占一行（来源列显示「—」）。
 *
 * ⚠️ 只用于渲染：`toFieldMappings` / `hasSourceMappingError` 等仍基于原始 `rows`。
 *
 * @param {Array} rows `buildRows` 的产出（扁平数组，容器行在其子行之前）
 */
export const buildDisplayRows = (rows) => {
  const byParent = new Map();
  (rows || []).forEach((row) => {
    const parent = row.parentKey || null;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(row);
  });

  const walk = (parentKey) => {
    const out = [];
    (byParent.get(parentKey) || []).forEach((row) => {
      const kids = row.isContainer ? byParent.get(row.key) || [] : [];
      if (row.isContainer && kids.length > 0 && !kids[0].isContainer) {
        const childRows = walk(row.key);
        out.push({
          key: row.key,
          kind: 'container',
          container: row,
          child: kids[0],
          rowSpan: childRows.length,
        });
        out.push(...childRows.slice(1));
      } else {
        out.push({ key: row.key, kind: row.isContainer ? 'bare' : 'leaf', row });
        if (row.isContainer) out.push(...walk(row.key));
      }
    });
    return out;
  };

  return walk(null);
};

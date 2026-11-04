import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Select,message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import FieldMappingTable from './components/FieldMappingTable';
import {
  checkFeishuTemplate,
  fetchMappingSources,
  fetchTemplateFields,
  fetchWorkItemRoles,
  fetchWorkItemTypes,
} from './feishuRuleApi';
import { FEISHU_ERROR_CODES, FEISHU_ERROR_MESSAGES } from './feishuRuleMock';
import { buildRows, toFieldMappings, ROLE_APPROVAL } from './ruleFieldMappingUtils';

const TEMPLATE_NOT_FOUND_MSG = FEISHU_ERROR_MESSAGES[FEISHU_ERROR_CODES.TEMPLATE_NOT_FOUND];

const pad2 = (n) => String(n).padStart(2, '0');
/** 列表按 createTime 倒序，新增取当前时间可排在最前 */
const formatNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
const makeLocalKey = () => `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 飞书审批规则 · 新建 / 编辑弹窗
 *
 * mode = 'add' | 'edit'；rule 为本地列表中的那条规则（编辑时传入）
 * 保存前先调 checkFeishuTemplate 前置校验（失败由全局请求层弹提示并拦截）；
 * 通过后交给父组件写本地列表，不调后端保存接口（需求确认稿 v4 决策 B1）
 */
const RuleEditModal = ({ open, mode = 'add', rule, ruleList = [], projectKey, onCancel, onSubmit }) => {
  const [ruleName, setRuleName] = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [approvalName, setApprovalName] = useState('');
  const [workItems, setWorkItems] = useState([]);
  const [templateFields, setTemplateFields] = useState([]);
  const [rows, setRows] = useState([]);
  const [sources, setSources] = useState([]);
  const [workItemOptions, setWorkItemOptions] = useState([]);
  const [roleOptions, setRoleOptions] = useState({});
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [templateTip, setTemplateTip] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showMappingError, setShowMappingError] = useState(false);
  // 工作项下拉顶部内嵌搜索词
  const [workItemSearch, setWorkItemSearch] = useState('');

  const loadedCodeRef = useRef('');
  const lastCodeRef = useRef('');
  // 提交中标记：同步生效，用于拦截「保存」的重复点击（state 更新是异步的，拦不住连点）
  const submitLockRef = useRef(false);

  /** 与列表页保持一致的规则唯一标识：后端 id → 本地 _localKey → 「approvalCode + ruleName」兜底 */
  const makeRuleKey = (item) => {
    if (!item) return '';
    if (item.id !== undefined && item.id !== null && item.id !== '') return `id:${item.id}`;
    if (item._localKey) return `local:${item._localKey}`;
    return `sig:${item.approvalCode || ''}::${item.ruleName || ''}`;
  };

  /** checkTemplate 请求体：与保存数据结构一致（新增时 id 为 null） */
  const buildCheckPayload = (data) => ({
    projectKey,
    id: data.id !== undefined && data.id !== null ? data.id : null,
    ruleName: (data.ruleName || '').trim(),
    workItems: data.workItems || [],
    approvalCode: (data.approvalCode || '').trim(),
    fieldMappings: data.fieldMappings || [],
  });

  /** 拉模板控件；useStored=true 时按已存映射回显（打开编辑弹窗），否则全部重置 */
  const loadTemplate = async (code, { stored = [], useStored = false } = {}) => {
    setLoading(true);
    const data = await fetchTemplateFields(code, projectKey);
    setLoading(false);
    if (!data) {
      setTemplateError(TEMPLATE_NOT_FOUND_MSG);
      setTemplateLoaded(false);
      setTemplateFields([]);
      setRows([]);
      setApprovalName('');
      setTemplateTip('');
      return false;
    }
    const prevCode = lastCodeRef.current;
    setTemplateError('');
    setApprovalName(data.approvalName || '');
    setTemplateFields(data.fields || []);
    setRows(buildRows(data.fields || [], useStored ? stored : []));
    setTemplateLoaded(true);
    loadedCodeRef.current = code;
    lastCodeRef.current = code;
    // 换模板提示条：新增 / 编辑都出现（决策 A5）；刷新 / 首次拉取不出现
    //setTemplateTip(prevCode && prevCode !== code ? '已更换审批模板，字段映射已重置，请重新配置' : '');
    if(prevCode && prevCode !== code){
      message.error('已更换审批模板，字段映射已重置，请重新配置')
    }
    return true;
  };

  /** 打开发送的数据请求 */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const init = async () => {
      setErrors({});
      setShowMappingError(false);
      setTemplateTip('');
      setTemplateError('');
      setTemplateLoaded(false);
      setTemplateFields([]);
      setRows([]);
      setApprovalName('');
      setRoleOptions({});
      // 重置提交标记（防御性重置；正常路径在 handleOk 的 finally 里已解锁）
      submitLockRef.current = false;
      setSubmitting(false);
      loadedCodeRef.current = '';
      lastCodeRef.current = '';
      setRuleName(rule?.ruleName || '');
      setApprovalCode(rule?.approvalCode || '');
      setApprovalName(rule?.approvalName || '');
      setWorkItems(rule?.workItems || []);

      // 来源选项（一次性取全部，按行的控件类型在前端过滤）
      const sourceList = await fetchMappingSources(undefined, projectKey);
      if (cancelled) return;
      setSources(sourceList || []);

      // 工作项候选：编辑时把自身占用的工作项放行（excludeRuleId）
      const items = await fetchWorkItemTypes(projectKey, mode === 'edit' ? rule?.id : undefined);
      if (cancelled) return;
      setWorkItemOptions(items || []);

      // 新增：等用户输入 Approval Code 后再拉模板
      if (mode !== 'edit') return;

      // 编辑：字段映射直接取列表行数据（列表才是当前真相，含尚未落库的本地改动），
      // 不再调规则详情接口，避免旧数据覆盖刚配好的映射；后续校验、拉模板、三路合并均不变
      const stored = rule?.fieldMappings || [];
      // 校验不通过（如 90002 模板已变更）时全局请求层已弹后端 msg；只提示、不阻断（决策 C3），弹窗照常打开回显
      await checkFeishuTemplate(
        buildCheckPayload({
          id: rule?.id,
          ruleName: rule?.ruleName,
          approvalCode: rule?.approvalCode,
          workItems: rule?.workItems || [],
          fieldMappings: stored,
        }),
      );
      if (cancelled) return;
      // 无论是否修改过 Approval Code，打开编辑都要重新拉模板（决策 C6）
      await loadTemplate(rule?.approvalCode, { stored, useStored: true });
    };
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 保存仅在提交中 / 拉取模板时禁用；编辑模式允许无改动直接保存
  const submitDisabled = submitting || loading;

  /** 按需加载工作项角色（父层缓存，避免重复请求） */
  const loadRoles = async (workItemId) => {
    if (roleOptions[workItemId]) return;
    const list = await fetchWorkItemRoles(workItemId, projectKey);
    setRoleOptions((prev) => ({ ...prev, [workItemId]: list || [] }));
  };

  /** 清除单个字段的校验提示（输入即消失） */
  const clearError = (field) => {
    setErrors((prev) => {
      if (prev[field] === undefined) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  /**
   * 必填字段未选「内容映射来源」。
   * 非必填字段允许为空 —— 模板字段现在全部渲染，若仍按「所有行都要有来源」判定会全量误报。
   */
  const hasSourceMappingError = (nextRows) =>
    nextRows.some((row) => row.required && !row.isContainer && !row.mappingSource);

  /** 选了「角色审批」但关联工作项未全部选角色 */
  const hasRoleMappingError = (nextRows, nextWorkItems) =>
    nextRows.some(
      (row) =>
        row.mappingSource === ROLE_APPROVAL &&
        nextWorkItems.some(
          (w) => !(row.roleWorkItemConfig || []).some((v) => v.workItemId === w.workItemId && v.roleId),
        ),
    );

  /** 字段映射校验：返回错误文案，全部合法返回空串 */
  const getMappingError = (nextRows, nextWorkItems) => {
    if (hasSourceMappingError(nextRows)) {
      return '请完成所有字段映射';
    }
    if (hasRoleMappingError(nextRows, nextWorkItems)) {
      return '请为所有工作项选择角色';
    }
    return '';
  };

  /** 映射补全后自动收起映射校验提示（来源、角色均合法后） */
  const syncMappingError = (nextRows, nextWorkItems) => {
    if (getMappingError(nextRows, nextWorkItems)) return;
    clearError('mapping');
    setShowMappingError(false);
  };

  /** Approval Code 失焦：拉模板 */
  const handleCodeBlur = async () => {
    const code = (approvalCode || '').trim();
    if (!code) {
      setTemplateError('');
      setTemplateLoaded(false);
      setTemplateFields([]);
      setRows([]);
      setApprovalName('');
      setTemplateTip('');
      loadedCodeRef.current = '';
      return;
    }
    if (templateLoaded && code === loadedCodeRef.current) return;
    await loadTemplate(code);
  };

  /** 刷新：重拉模板并重置已配置映射（决策 A6，无二次确认） */
  const handleRefresh = async () => {
    const code = loadedCodeRef.current || (approvalCode || '').trim();
    if (!code) return;
    // 刷新会重建全部映射行，旧的字段映射 / 角色校验提示已失效，先收起再重拉
    setShowMappingError(false);
    clearError('mapping');
    await loadTemplate(code);
  };

  /** 修改来源；切走「角色审批」时清空角色配置 */
  const handleChangeSource = (key, value) => {
    const nextRows = rows.map((row) =>
      row.key === key
        ? {
            ...row,
            mappingSource: value,
            roleWorkItemConfig: value === ROLE_APPROVAL ? row.roleWorkItemConfig : [],
          }
        : row,
    );
    setRows(nextRows);
    syncMappingError(nextRows, workItems);
  };

  const handleChangeRole = (key, next) => {
    const nextRows = rows.map((row) =>
      row.key === key ? { ...row, roleWorkItemConfig: next } : row,
    );
    setRows(nextRows);
    syncMappingError(nextRows, workItems);
  };

  /** 工作项变化：同步清掉已不存在工作项的角色配置 */
  const handleChangeWorkItems = (ids) => {
    const next = ids.map((id) => {
      const hit = workItems.find((w) => w.workItemId === id);
      return (
        hit || {
          workItemId: id,
          workItemName: (workItemOptions.find((o) => o.workItemId === id) || {}).workItemName,
        }
      );
    });
    const nextRows = rows.map((row) => ({
      ...row,
      roleWorkItemConfig: (row.roleWorkItemConfig || []).filter((v) =>
        next.some((w) => w.workItemId === v.workItemId),
      ),
    }));
    setWorkItems(next);
    setRows(nextRows);
    clearError('workItems');
    syncMappingError(nextRows, next);
  };

  /** ruleList 里的某条规则是否就是当前正在编辑的规则 */
  const isSameRule = (a, b) => makeRuleKey(a) === makeRuleKey(b);

  /** 工作项是否被 ruleList 中「其他规则」占用（含本地新增、未落库的规则） */
  const isOccupiedByOtherRule = (workItemId) =>
    (ruleList || []).some(
      (item) =>
        !isSameRule(item, rule) &&
        (item.workItems || []).some((w) => w.workItemId === workItemId),
    );

  /** 保存：前端校验 + checkTemplate 前置校验（不调后端保存接口） */
  const handleOk = async () => {
    // 提交中：忽略重复点击（连点会导致同一条规则被插入两次）
    if (submitLockRef.current) return;
    const nextErrors = {};
    const name = ruleName.trim();
    if (!name) {
      nextErrors.ruleName = '请输入规则名称';
    } else {
      const duplicated = (ruleList || []).some(
        (item) => item.ruleName === name && !isSameRule(item, rule),
      );
      if (duplicated) nextErrors.ruleName = '规则名称已存在';
    }
    if (!workItems.length) {
      nextErrors.workItems = '请选择工作项';
    } else if (workItems.some((w) => isOccupiedByOtherRule(w.workItemId))) {
      nextErrors.workItems = '存在已被其他规则配置的工作项，请重新选择';
    }
    if (!approvalCode.trim()) {
      nextErrors.approvalCode = '请输入Approval Code';
    } else if (!templateLoaded) {
      nextErrors.approvalCode = templateError || TEMPLATE_NOT_FOUND_MSG;
    }

    const mappingError = getMappingError(rows, workItems);
    // 映射错误：toast 总提示 + 行级提示双重展示（行内提示仍由 showMappingError 驱动）
    if (mappingError) message.error(mappingError);

    setErrors(nextErrors);
    setShowMappingError(!!mappingError);
    if (Object.keys(nextErrors).length || mappingError) return;

    submitLockRef.current = true;
    setSubmitting(true);
    const ruleObject = {
      ...(rule?.id !== undefined && rule?.id !== null ? { id: rule.id } : {}),
      _localKey: rule?._localKey || makeLocalKey(),
      ruleName: name,
      approvalCode: approvalCode.trim(),
      approvalName,
      workItems,
      fieldMappings: toFieldMappings(rows),
      createTime: rule?.createTime || formatNow(),
    };
    //console.log('[feishu] 规则保存数据', ruleObject);
    try {
      // 保存前置校验：90010 / 90001 / 90013 / 90002 任一命中时全局 toast 已弹 msg，这里直接拦截（return 后走 finally 解锁）
      const passed = await checkFeishuTemplate(
        buildCheckPayload({
          id: rule?.id,
          ruleName: name,
          approvalCode,
          workItems,
          fieldMappings: ruleObject.fieldMappings,
        }),
      );
      if (!passed) return;
      // onSubmit 允许返回 Promise：父层若保存失败（如后端校验模板变更）并保持弹窗打开，这里会等它结束
      await onSubmit?.(ruleObject);
    } catch (err) {
      console.error('[feishu] 规则保存失败', err);
    } finally {
      // 解锁；父层保存成功并关闭弹窗时，这里随弹窗重开被重置，不会有副作用
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const selectedWorkItemIds = workItems.map((w) => w.workItemId);

  // 内嵌搜索：按工作项名称本地模糊过滤（不区分大小写）
  const workItemKeyword = workItemSearch.trim().toLowerCase();
  const filteredWorkItemOptions = (workItemOptions || []).filter(
    (item) =>
      !workItemKeyword || (item.workItemName || '').toLowerCase().includes(workItemKeyword),
  );

  return (
    <Modal
      wrapClassName="feishu-rule-modal-wrap"
      title={mode === 'edit' ? '编辑审批规则' : '添加审批规则'}
      open={open}
      width={600}
      maskClosable={false}
      onCancel={onCancel}
      styles={{ body: { maxHeight: '62vh', overflowY: 'auto' } }}
      footer={[
        <Button key="cancel" className="cancel-btn" onClick={onCancel}>
          取消
        </Button>,
        <Button key="ok" type="primary" disabled={submitDisabled} loading={submitting} onClick={handleOk}>
          保存
        </Button>,
      ]}
    >
      <div className="feishu-form-item">
        <div className="feishu-form-label">
          规则名称<span className="feishu-form-required">*</span>
        </div>
        <Input
          value={ruleName}
          maxLength={30}
          showCount
          placeholder="请输入"
          status={errors.ruleName ? 'error' : undefined}
          onChange={(e) => {
            setRuleName(e.target.value);
            clearError('ruleName');
          }}
        />
        {errors.ruleName ? <div className="feishu-form-error">{errors.ruleName}</div> : null}
      </div>

      <div className="feishu-form-item">
        <div className="feishu-form-label">
          工作项<span className="feishu-form-required">*</span>
        </div>
        <Select
          style={{ width: '100%' }}
          mode="multiple"
          placeholder="请选择"
          maxTagCount="responsive"
          optionFilterProp="label"
          // 禁用内联搜索，只用下拉顶部内嵌搜索框
          showSearch={false}
          value={selectedWorkItemIds}
          status={errors.workItems ? 'error' : undefined}
          onChange={handleChangeWorkItems}
          // 注：Web 端 rc-select@14.16.6 不支持 popupRender/onOpenChange/classNames 新 API，用旧名
          onDropdownVisibleChange={(open) => {
            // 收起时清空搜索词，下次打开恢复完整列表
            if (!open) setWorkItemSearch('');
          }}
          popupClassName="feishu-workitem-select-dropdown"
          dropdownRender={(menu) => (
            <>
              <div className="feishu-workitem-search">
                <Input
                  style={{ marginBottom: '3px' }}
                  allowClear
                  placeholder="搜索"
                  prefix={<SearchOutlined />}
                  value={workItemSearch}
                  onChange={(e) => setWorkItemSearch(e.target.value)}
                  // 阻止冒泡：点搜索框不关闭下拉
                  onMouseDown={(e) => e.stopPropagation()}
                  // 阻止键盘事件冒泡给 Select（Portal 沿组件树冒泡），
                  // 避免 Backspace/Enter 被 rc-select 拦截误删已选工作项
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
              {menu}
            </>
          )}
          options={filteredWorkItemOptions.map((item) => ({
            value: item.workItemId,
            label: item.workItemName,
            disabled:
              (!!item.configured || isOccupiedByOtherRule(item.workItemId)) &&
              !selectedWorkItemIds.includes(item.workItemId),
            occupiedBy: item.configured ? item.ruleName : '',
          }))}
          optionRender={(option) => {
            const data = option.data || option;
            return (
              <div className="feishu-workitem-option">
                <span>{option.label}</span>
              </div>
            );
          }}
        />
        {errors.workItems ? (
          <div className="feishu-form-error">{errors.workItems}</div>
        ) : (
          <div className="feishu-form-tip">同一工作项只能绑定一条规则，已配置的工作项不可选</div>
        )}
      </div>

      <div className="feishu-form-item">
        <div className="feishu-form-label">
          飞书审批 Approval Code<span className="feishu-form-required">*</span>
        </div>
        <Input
          value={approvalCode}
          placeholder="请输入"
          status={templateError || errors.approvalCode ? 'error' : undefined}
          onChange={(e) => {
            setApprovalCode(e.target.value);
            clearError('approvalCode');
            // code 变更后旧的「未找到审批模板」提示已失效，一并清除
            setTemplateError('');
          }}
          onBlur={handleCodeBlur}
        />
        {templateError ? (
          <div className="feishu-form-error">{templateError}</div>
        ) : errors.approvalCode ? (
          <div className="feishu-form-error">{errors.approvalCode}</div>
        ) : approvalName ? (
          <div className="feishu-form-tip">审批名称：{approvalName}</div>
        ) : null}
      </div>

      {templateLoaded ? (
        <FieldMappingTable
          rows={rows}
          sources={sources}
          workItems={workItems}
          roleOptions={roleOptions}
          loadRoles={loadRoles}
          loading={loading}
          hasFields={templateFields.length > 0}
          tip={templateTip}
          showMappingError={showMappingError}
          onRefresh={handleRefresh}
          onChangeSource={handleChangeSource}
          onChangeRole={handleChangeRole}
        />
      ) : null}
    </Modal>
  );
};

export default RuleEditModal;

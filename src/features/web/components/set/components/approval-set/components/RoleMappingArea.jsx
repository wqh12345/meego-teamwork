import React, { useEffect } from 'react';
import { Select } from 'antd';

/**
 * 「角色审批」子区域
 *
 * - 出现在「内容映射来源 = 角色审批」那一行的下方（该飞书字段自己的配置，多个字段各配一份）
 * - 列出该规则关联的**全部工作项**，每个工作项独立选角色（**可多选、不限数量**），互不影响
 * - 校验：选了角色审批则所有关联工作项都要**至少选一个**角色，未选时下拉标红
 * - `roleWorkItemConfig` 为扁平数组：一个工作项选 N 个角色就出现 N 条同 workItemId 的记录
 * - 切换来源时由父组件清空 roleWorkItemConfig（本组件只负责展示与选择）
 */
const RoleMappingArea = ({
  workItems = [],
  value = [],
  onChange,
  roleOptions = {},
  loadRoles,
  showError = false,
}) => {
  const workItemIds = (workItems || []).map((w) => w.workItemId).join(',');

  // 按需加载各工作项的角色候选（父组件做了缓存）
  useEffect(() => {
    (workItems || []).forEach((w) => {
      if (!roleOptions[w.workItemId]) loadRoles?.(w.workItemId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItemIds]);

  if (!workItems || workItems.length === 0) {
    return <div className="feishu-role-empty">请先选择工作项</div>;
  }

  return (
    <div className="feishu-role-area">
      {workItems.map((w) => {
        // 该工作项在扁平配置中命中的全部角色（单选旧数据即长度为 1 的特例，天然兼容回显）
        const selectedRoleIds = (value || [])
          .filter((v) => v.workItemId === w.workItemId)
          .map((v) => v.roleId);
        const options = (roleOptions[w.workItemId] || []).map((role) => ({
          value: role.roleId,
          label: role.roleName,
        }));
        return (
          <div className="feishu-role-row" key={w.workItemId}>
            <span className="feishu-role-name" title={w.workItemName}>
              {w.workItemName}
            </span>
            <div className="feishu-role-control">
              <Select
                className="feishu-role-select"
                size="small"
                mode="multiple"
                placeholder="请选择角色"
                showSearch
                optionFilterProp="label"
                value={selectedRoleIds}
                options={options}
                notFoundContent="暂无数据"
                status={showError && selectedRoleIds.length === 0 ? 'error' : undefined}
                onChange={(roleIds) => {
                  const toEntry = (item, roleId) => {
                    const label = (roleOptions[item.workItemId] || []).find((r) => r.roleId === roleId) || {};
                    return {
                      workItemId: item.workItemId,
                      workItemName: item.workItemName,
                      roleId,
                      roleName: label.roleName,
                    };
                  };
                  // 其它工作项保持原样；当前工作项替换为本次勾选结果
                  const others = (value || []).filter((v) => v.workItemId !== w.workItemId);
                  // 按 workItems 顺序回写，保证提交结构与界面一致
                  const next = workItems.flatMap((item) =>
                    item.workItemId === w.workItemId
                      ? (roleIds || []).map((roleId) => toEntry(item, roleId))
                      : others.filter((v) => v.workItemId === item.workItemId),
                  );
                  onChange?.(next);
                }}
              />
              {/* 未选角色（多选为空）：下拉框下方行级提示，选中后自动消失 */}
              {showError && selectedRoleIds.length === 0 ? (
                <div className="feishu-form-error2">请选择角色</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoleMappingArea;

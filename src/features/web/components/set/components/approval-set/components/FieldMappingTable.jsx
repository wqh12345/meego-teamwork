import React, { useMemo } from 'react';
import { Select, Table, Tooltip } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import RoleMappingArea from './RoleMappingArea';
import { buildDisplayRows } from '../ruleFieldMappingUtils';

/**
 * 字段映射表格
 *
 * 行结构由父组件按「模板控件列表 × 已存映射」算好后传入（见 ruleFieldMappingUtils.buildRows）：
 *   - **模板字段一律展示**（必填 / 非必填都渲染）；非必填只是「来源允许为空」
 *   - 规则里存了但模板已没有的控件不展示
 *
 * 明细控件（fieldList）容器按设计稿渲染成「合并单元格 + 子列」：容器名在第一列纵向合并
 * （垂直居中），它的列名在第二列，来源下拉在第三列。为此渲染前先经 `buildDisplayRows`
 * 把容器的首个子列并入容器行（详见该函数注释）。
 *
 * 表格是三列网格（表头第一列 colSpan=2 → 视觉上仍是「飞书审批字段 / 内容映射来源」两列）：
 *   顶层行   → [字段名 colSpan=2] [来源]
 *   容器行   → [容器名 rowSpan] [首个子列名] [首个子列来源]
 *   其余子列 → [（第一列被 rowSpan 占位，不渲染）] [子列名] [子列来源]
 * 第三类必须让第一列空着，否则整行右移、多撑出一列（表格右侧留白 + 下拉错位）。
 */
const FieldMappingTable = ({
  rows = [],
  sources = [],
  workItems = [],
  roleOptions = {},
  loadRoles,
  loading = false,
  hasFields = true,
  tip = '',
  showMappingError = false,
  onRefresh,
  onChangeSource,
  onChangeRole,
}) => {
  /** 该行可用的映射来源（按行的控件类型过滤） */
  const getSourceOptions = (row) =>
    sources
      .filter((s) => (s.fieldTypes || []).includes(row.feishuFieldType))
      .map((s) => ({ value: s.value, label: s.label }));

  const needRoleConfig = (row) => {
    const hit = sources.find((s) => s.value === row.mappingSource);
    return !!hit?.needRoleConfig;
  };

  /**
   * 是否为「明细容器除首列以外的子列」。
   *
   * 这类行渲染时第一列已被容器的 rowSpan 占位，若照常给第一列 `colSpan: 2`，
   * 浏览器会把它整体挤到第二列并多占一列，第二列的下拉被推到第 4 列 ——
   * 结果就是表格右半留白、明细最后一行的来源下拉错位。所以它们不渲染第一列。
   */
  const isChildRow = (record) => record.kind !== 'container' && !!record.row?.parentKey;

  /**
   * 展示行：把明细容器的首个子列并入容器行（必须 memo —— 每次渲染重建数组会让
   * 受控的 Select 重挂载、下拉展开中断）
   */
  const displayRows = useMemo(() => buildDisplayRows(rows), [rows]);

  /** 字段名 + 必填红星；明细容器与它的子列共用同一渲染 */
  const getNameCell = (row) => (
    <span className="feishu-field-name">
      <span className="feishu-field-text" title={row.feishuFieldName}>
        {row.feishuFieldName}
      </span>
      {row.required ? <span className="feishu-field-required">*</span> : null}
    </span>
  );

  /** 内容映射来源单元格：下拉 + 行内校验提示 +（选了角色审批时的）角色配置子区域 */
  const renderSourceCell = (row) => (
    <div className="feishu-source-cell">
      <Select
        style={{ width: '100%' }}
        allowClear
        placeholder="请选择"
        value={row.mappingSource}
        options={getSourceOptions(row)}
        notFoundContent="暂无数据"
        status={showMappingError && row.required && !row.mappingSource ? 'error' : undefined}
        onChange={(value) => onChangeSource?.(row.key, value)}
      />
      {/* 必填字段未映射：下拉框下方行级提示，选中后自动消失 */}
      {showMappingError && row.required && !row.mappingSource ? (
        <div className="feishu-form-error2">请选择字段映射</div>
      ) : null}
      {needRoleConfig(row) ? (
        <RoleMappingArea
          workItems={workItems}
          value={row.roleWorkItemConfig}
          roleOptions={roleOptions}
          loadRoles={loadRoles}
          showError={showMappingError}
          onChange={(next) => onChangeRole?.(row.key, next)}
        />
      ) : null}
    </div>
  );

  const columns = [
    {
      title: '飞书审批字段',
      dataIndex: 'feishuFieldName',
      key: 'feishuFieldName',
      width: 100,
      align: 'left',
      // 表头第一列跨「字段名 / 明细列名」两列
      onHeaderCell: () => ({ colSpan: 2 }),
      onCell: (record) => {
        if (record.kind === 'container') {
          return { rowSpan: record.rowSpan, className: 'feishu-field-cell is-container' };
        }
        // 明细子列：第一列被容器的 rowSpan 占位（colSpan 0 = 不渲染该格），名字交给第二列
        if (isChildRow(record)) return { colSpan: 0 };
        return { colSpan: 2, className: 'feishu-field-cell' };
      },
      render: (_, record) => {
        if (record.kind === 'container') return getNameCell(record.container);
        if (isChildRow(record)) return null;
        return getNameCell(record.row);
      },
    },
    {
      // 明细控件子列的列名；顶层普通行不占此列（colSpan: 0 → 不渲染）
      title: '',
      key: 'detailFieldName',
      width: 110,
      onHeaderCell: () => ({ colSpan: 0 }),
      onCell: (record) =>
        record.kind === 'container' || isChildRow(record)
          ? { className: 'feishu-detail-cell' }
          : { colSpan: 0 },
      render: (_, record) => {
        if (record.kind === 'container') return getNameCell(record.child);
        if (isChildRow(record)) return getNameCell(record.row);
        return null;
      },
    },
    {
      title: '内容映射来源',
      key: 'mappingSource',
      render: (_, record) => {
        // 容器没有可合并的子列时退化为普通行，来源列显示占位符
        if (record.kind === 'bare') return <span className="feishu-source-dash">—</span>;
        return renderSourceCell(record.kind === 'container' ? record.child : record.row);
      },
    },
  ];

  return (
    <div className="feishu-mapping-section">
      <div className="feishu-mapping-header">
        <span className="feishu-mapping-title">设置字段映射</span>
        <Tooltip title="刷新（会重置已配置的映射）">
          <span
            className="feishu-mapping-refresh"
            onClick={() => !loading && onRefresh?.()}
          >
            <SyncOutlined spin={loading} style={{ marginRight: 4 }} />
            刷新
          </span>
        </Tooltip>
      </div>

      {/* {tip ? <div className="feishu-mapping-tip">{tip}</div> : null} */}

      {hasFields ? (
        <Table
          className="feishu-mapping-table"
          tableLayout="fixed"
          rowKey="key"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={displayRows}
          locale={{ emptyText: '暂无数据' }}
        />
      ) : (
        <div className="feishu-mapping-empty">该审批模板暂无控件字段</div>
      )}
    </div>
  );
};

export default FieldMappingTable;

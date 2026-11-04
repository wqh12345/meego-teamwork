import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Input, Tooltip, Button } from 'antd';
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import { SearchOutlined } from '@ant-design/icons';

import 'react-virtualized/styles.css';
import './MemberModal.css'; // 自定义样式文件
import { UserTag } from '@lark-project/ui-kit-plugin';
// 封装的查看成员Modal组件
const MemberModal = ({
visible, onClose, initialData = [], title = '查看成员'}) => {
  // 搜索关键词状态
  const [searchKey, setSearchKey] = useState('');
  // 过滤后的成员数据（搜索逻辑）
  const filteredData = useMemo(() => {
    if (!searchKey.trim()) return initialData;
    return initialData.filter(item => 
      item.userName.toLowerCase().includes(searchKey.toLowerCase())
    );
  }, [initialData, searchKey]);

  // 缓存行高，提升虚拟滚动性能
  const [cache] = useState(() => 
    new CellMeasurerCache({
      defaultHeight: 40, // 默认行高
      fixedWidth: true,
    })
  );

  // 清除缓存以确保数据变化时能正确渲染
  useEffect(() => {
    cache.clearAll();
  }, [initialData, visible]); // 添加visible依赖

  // 当Modal关闭再打开时，清空搜索关键字
  useEffect(() => {
    if (!visible) {
      setSearchKey('');
    } else {
      // Modal打开时清空缓存，确保重新渲染
      cache.clearAll();
    }
  }, [visible, setSearchKey]);

  // 渲染表格行内容
  const renderRow = ({ index, key, parent, style }) => {
    const item = filteredData[index];
    const teamStr = item.teamMemberVoList ? item.teamMemberVoList.map(team => team.teamName).join('、') : ''; // 拼接多团队名称

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <div className="member-row" style={style}>
          {/* 成员名称列 */}
          <div className="member-cell member-name">
            <UserTag userId={item.userKey} name={item.userName} avatar={item.avatarUrl} />
          </div>
          {/* 所属团队列（溢出省略+悬浮提示） */}
          <div className="member-cell member-team">
            {teamStr?(<Tooltip title={teamStr} placement="topLeft">
              <span className="team-text">{teamStr}</span>
            </Tooltip>):"--"}
          </div>
        </div>
      </CellMeasurer>
    );
  };

  // 渲染表头
  const renderHeader = () => (
    <div className="member-header">
      <div className="member-cell member-name">成员</div>
      <div className="member-cell member-team">所属团队</div>
    </div>
  );

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={onClose}
      footer={null} // 隐藏默认footer，只保留关闭按钮
      width={600} // 弹窗宽度，可根据需求调整
      className="member-modal"
      destroyOnClose={true}
      centered={true}
    >
      {/* 提示文案 */}
      <div className="member-tip">
        当前为默认记录规范，成员名单仅供查看，无法直接编辑。如需调整成员所属规范，请前往目标自定义规范进行"管理成员"操作。
      </div>

      {/* 搜索框 */}
      <Input
        placeholder="请输入成员名称"
        value={searchKey}
        onChange={(e) => setSearchKey(e.target.value)}
        style={{ margin: '16px 0', width: '300px' }}
        suffix={<SearchOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
      />

      {/* 表格容器（表头+虚拟滚动主体） */}
      {visible && <div className="member-table-container">
        {/* 固定表头 */}
        {renderHeader()}

        {/* 虚拟滚动列表 */}
        <div className="member-list-container">
          <AutoSizer disableHeight>
            {({ width }) => (
              <List
                key={`list-${visible}-${filteredData.length}`}
                width={width}
                height={400} // 列表可视区域高度，可调整
                rowCount={filteredData.length}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                deferredMeasurementCache={cache}
                overscanRowCount={5} // 预加载行数，优化滚动体验
                noRowsRenderer={() => <div className="no-data">暂无成员数据</div>}
              />
            )}
          </AutoSizer>
        </div>
      </div>
      }
      <div className="modal-footer">
        <Button onClick={onClose}>
            关闭
        </Button>
      </div>
    </Modal>
  );
};

export default React.memo(MemberModal);
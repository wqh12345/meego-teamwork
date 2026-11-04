import React, { Component } from "react";
import { Input, Checkbox, Spin, Empty, Avatar } from "antd";
import { SearchOutlined, CloseOutlined, TeamOutlined, CaretRightOutlined, CaretDownOutlined } from "@ant-design/icons";
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import 'react-virtualized/styles.css';
import { getDeptTreeData } from "../../../../api/api";
import { debounce } from "../../../../util/util";
import "./DeptSelector.css";
import defaultAvatar from "../../../../image/dept.png";
// 默认头像
const DEFAULT_AVATAR = defaultAvatar;

class DeptSelector extends Component {
  constructor(props) {
    super(props);
    
    this.cache = new CellMeasurerCache({
      defaultHeight: 40,
      fixedWidth: true,
      minHeight: 40,
      maxHeight: 40,
    });
    
    this.selectedCache = new CellMeasurerCache({
      defaultHeight: 50,
      fixedWidth: true,
      minHeight: 50,
      maxHeight: 50,
    });
    
    this.state = {
      deptTreeData: [],
      flattenedRows: [],
      selectedDeptIds: new Set(),
      selectedDepts: [], // 按选择顺序存储
      searchKey: '',
      isSearching: false,
      searchResults: [],
      isSpinning: true,
      expandedDepts: new Set(),
      selectionVersion: 0, // 用于强制刷新虚拟列表
    };
    
    this.handleSearchChange = debounce(this.onSearch, 300).bind(this);
    this.listRef = React.createRef();
    this.selectedListRef = React.createRef();
  }

  componentDidMount() {
    let tenantModeInfo = null;
    try {
      const raw = sessionStorage.getItem('tenantModeInfo');
      if (raw) tenantModeInfo = JSON.parse(raw);
    } catch (_) {}
    if (tenantModeInfo?.install) {
      this.loadDeptTree();
    }
    // 处理初始传入的选中部门数据（Modal destroyOnClose 导致每次打开都需要重新处理）
    if (this.props.selectedDepts && this.props.selectedDepts.length > 0) {
      const newSelectedIds = new Set();
      const newSelectedDepts = [];
      
      this.props.selectedDepts.forEach(dept => {
        const departmentId = dept.departmentId;
        if (departmentId && !newSelectedIds.has(departmentId)) {
          newSelectedIds.add(departmentId);
          newSelectedDepts.push({
            departmentId,
            departmentName: dept.departmentName,
            parentPath: dept.parentPath || '',
            avatarUrl: dept.avatarUrl || DEFAULT_AVATAR,
          });
        }
      });
      
      if (newSelectedIds.size > 0) {
        this.setState({
          selectedDeptIds: newSelectedIds,
          selectedDepts: newSelectedDepts,
        });
      }
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // 当选中部门变化时，刷新缓存
    if (prevState.selectedDeptIds !== this.state.selectedDeptIds) {
      this.selectedCache.clearAll();
    }
    if (prevState.flattenedRows !== this.state.flattenedRows || 
        prevState.expandedDepts !== this.state.expandedDepts) {
      this.cache.clearAll();
    }
    // 处理外部传入的初始选中数据
    if (this.props.selectedDepts && this.props.selectedDepts !== prevProps.selectedDepts) {
      const newSelectedIds = new Set();
      const newSelectedDepts = [];
      
      this.props.selectedDepts.forEach(dept => {
        const departmentId = dept.departmentId;
        if (departmentId && !newSelectedIds.has(departmentId)) {
          newSelectedIds.add(departmentId);
          newSelectedDepts.push({
            departmentId,
            departmentName: dept.departmentName,
            parentPath: dept.parentPath || '',
            avatarUrl: dept.avatarUrl || DEFAULT_AVATAR,
          });
        }
      });
      
      if (newSelectedIds.size !== this.state.selectedDeptIds.size ||
          [...newSelectedIds].some(id => !this.state.selectedDeptIds.has(id))) {
        this.setState({
          selectedDeptIds: newSelectedIds,
          selectedDepts: newSelectedDepts,
        });
      }
    }
  }

  // 加载部门树数据
  loadDeptTree = async () => {
    try {
      this.setState({ isSpinning: true });
      console.log(sessionStorage.getItem('tenantModeInfo'));
      const res = await getDeptTreeData({ 
        userKey: sessionStorage.getItem('jwtMeegoTeamworkUserId') || '' 
      });
      console.log('DeptSelector API raw response:', res);
      // API 返回 { data: { departments: [...], tenantName: '...' } } 或兼容直接数组格式
      const apiData = Array.isArray(res?.data?.departments)
        ? res.data.departments
        : (Array.isArray(res?.data) ? res.data : []);
      console.log('DeptSelector apiData:', apiData);
      
      // 创建虚拟根节点，departmentId 为 "0"，名称取自 tenantName
      const rootDeptName = res?.data?.tenantName || '组织';
      const rootNode = {
        departmentId: '0',
        name: rootDeptName,
        parentDepartmentId: '',
        children: apiData,
      };
      console.log('DeptSelector rootNode:', rootNode);
      
      // 规范化数据（根节点的 parentPath 为空字符串）
      const normalizedData = this.normalizeDeptTree([rootNode], '');
      console.log('DeptSelector normalizedData:', normalizedData);
      
      // 计算默认展开的部门ID集合（仅展开根节点，一级部门不展开）
      const defaultExpandedDepts = new Set();
      // 只添加根节点 "0"，一级部门的子部门（二级部门）不展开
      defaultExpandedDepts.add('0');
      console.log('DeptSelector defaultExpandedDepts (root only):', defaultExpandedDepts);
      
      // 使用展开状态重新扁平化部门树
      const flattened = this.flattenDeptTreeWithExpanded(normalizedData, defaultExpandedDepts);
      console.log('DeptSelector flattened rows:', flattened.length);
      
      this.setState({
        deptTreeData: normalizedData,
        flattenedRows: flattened,
        expandedDepts: defaultExpandedDepts,
        isSpinning: false,
      }, () => {
        this.updateListKeys();
      });
    } catch (error) {
      console.error('加载部门树失败:', error);
      this.setState({ isSpinning: false, deptTreeData: [], flattenedRows: [] });
    }
  }

  // 规范化部门节点（parentPath 是父节点的路径字符串，不含当前节点）
  normalizeDeptTree = (nodes, parentPath = '') => {
    if (!nodes || !Array.isArray(nodes)) return [];
    return nodes.map(node => {
      const departmentId = String(node.departmentId || node.deptId || '');
      const departmentName = node.name || node.deptName || '';
      const children = Array.isArray(node.children) ? node.children : [];
      const currentPath = parentPath ? `${parentPath}/${departmentName}` : departmentName;
      return {
        departmentId,
        departmentName,
        parentPath,
        hasChildren: children.length > 0,
        childDepts: this.normalizeDeptTree(children, currentPath),
        avatarUrl: DEFAULT_AVATAR,
      };
    });
  }

  // 扁平化部门树用于虚拟列表渲染
  flattenDeptTree = (nodes, level = 0, parentPath = '') => {
    const rows = [];
    nodes.forEach(node => {
      const fullPath = parentPath ? `${parentPath}/${node.departmentName}` : node.departmentName;
      rows.push({
        ...node,
        level,
        fullPath,
        type: 'dept',
        key: `dept-${node.departmentId}`,
      });
      
      // 如果部门展开且有子部门，递归添加子部门
      if (this.state.expandedDepts.has(node.departmentId) && node.childDepts && node.childDepts.length > 0) {
        rows.push(...this.flattenDeptTree(node.childDepts, level + 1, fullPath));
      }
    });
    return rows;
  }
  
  // 扁平化部门树（使用指定的展开状态）
  flattenDeptTreeWithExpanded = (nodes, expandedDepts, level = 0, parentPath = '') => {
    const rows = [];
    nodes.forEach(node => {
      const fullPath = parentPath ? `${parentPath}/${node.departmentName}` : node.departmentName;
      rows.push({
        ...node,
        level,
        fullPath,
        type: 'dept',
        key: `dept-${node.departmentId}`,
      });
      
      // 如果部门展开且有子部门，递归添加子部门
      if (expandedDepts.has(node.departmentId) && node.childDepts && node.childDepts.length > 0) {
        rows.push(...this.flattenDeptTreeWithExpanded(node.childDepts, expandedDepts, level + 1, fullPath));
      }
    });
    return rows;
  }

  // 搜索部门
  onSearch = () => {
    const { searchKey, deptTreeData, expandedDepts } = this.state;
    if (!searchKey.trim()) {
      this.setState({
        isSearching: false,
        searchResults: [],
        flattenedRows: this.flattenDeptTreeWithExpanded(deptTreeData, expandedDepts),
      });
      return;
    }

    const keyword = searchKey.trim().toLowerCase();
    const results = this.searchDeptInTree(deptTreeData, keyword, '');
    
    this.setState({
      isSearching: true,
      searchResults: results,
    });
  }

  // 在树中搜索部门
  searchDeptInTree = (nodes, keyword, parentPath) => {
    const results = [];
    nodes.forEach(node => {
      const fullPath = parentPath ? `${parentPath}/${node.departmentName}` : node.departmentName;
      const departmentName = (node.departmentName || '').toLowerCase();
      
      if (departmentName.includes(keyword)) {
        results.push({
          ...node,
          level: 0,
          fullPath,
          type: 'dept',
          key: `dept-${node.departmentId}`,
        });
      }
      
      // 递归搜索子部门
      if (node.childDepts && node.childDepts.length > 0) {
        results.push(...this.searchDeptInTree(node.childDepts, keyword, fullPath));
      }
    });
    return results;
  }

  // 切换部门展开/收起
  toggleExpand = (departmentId) => {
    this.setState(prevState => {
      const newExpanded = new Set(prevState.expandedDepts);
      if (newExpanded.has(departmentId)) {
        newExpanded.delete(departmentId);
      } else {
        newExpanded.add(departmentId);
      }
      
      const newFlattened = this.flattenDeptTreeWithExpanded(prevState.deptTreeData, newExpanded);
      return {
        expandedDepts: newExpanded,
        flattenedRows: newFlattened,
      };
    });
  }

  // 勾选/取消勾选部门
  handleDeptCheck = (dept, checked) => {
    this.setState(prevState => {
      const newSelectedIds = new Set(prevState.selectedDeptIds);
      const newSelectedDepts = [...prevState.selectedDepts];
      
      if (checked) {
        // 添加到选中
        if (!newSelectedIds.has(dept.departmentId)) {
          newSelectedIds.add(dept.departmentId);
          newSelectedDepts.push({
            departmentId: dept.departmentId,
            departmentName: dept.departmentName,
            parentPath: dept.parentPath || '',
            avatarUrl: dept.avatarUrl || DEFAULT_AVATAR,
          });
        }
      } else {
        // 从选中移除
        newSelectedIds.delete(dept.departmentId);
        const index = newSelectedDepts.findIndex(d => d.departmentId === dept.departmentId);
        if (index > -1) {
          newSelectedDepts.splice(index, 1);
        }
      }
      
      return {
        selectedDeptIds: newSelectedIds,
        selectedDepts: newSelectedDepts,
      };
    }, () => {
      this.notifyParent();
      // 只清除右侧列表缓存，保持左侧列表滚动位置
      this.selectedCache.clearAll();
      if (this.selectedListRef.current) this.selectedListRef.current.forceUpdateGrid();
    });
  }

  // 删除右侧已选部门
  handleDeleteDept = (departmentId) => {
    this.setState(prevState => {
      const newSelectedIds = new Set(prevState.selectedDeptIds);
      newSelectedIds.delete(departmentId);
      
      const newSelectedDepts = prevState.selectedDepts.filter(d => d.departmentId !== departmentId);
      
      return {
        selectedDeptIds: newSelectedIds,
        selectedDepts: newSelectedDepts,
      };
    }, () => {
      this.notifyParent();
      // 只清除右侧列表缓存，保持左侧列表滚动位置
      this.selectedCache.clearAll();
      if (this.selectedListRef.current) this.selectedListRef.current.forceUpdateGrid();
    });
  }

  // 清空所有选择
  handleClearAll = () => {
    this.setState({
      selectedDeptIds: new Set(),
      selectedDepts: [],
    }, () => {
      this.notifyParent();
      // 只清除右侧列表缓存，保持左侧列表滚动位置
      this.selectedCache.clearAll();
      if (this.selectedListRef.current) this.selectedListRef.current.forceUpdateGrid();
    });
  }

  // 通知父组件
  notifyParent = () => {
    const { selectedDepts, selectedDeptIds } = this.state;
    this.props.onChange?.({
      selectedDepts,
      selectedDeptIds: Array.from(selectedDeptIds),
    });
  }

  // 更新列表keys
  updateListKeys = () => {
    this.cache.clearAll();
    this.selectedCache.clearAll();
    if (this.listRef.current) this.listRef.current.forceUpdateGrid();
    if (this.selectedListRef.current) this.selectedListRef.current.forceUpdateGrid();
  }

  // 初始化选中状态（从父组件传入）
  initSelection = (selectedDepts) => {
    if (!selectedDepts || selectedDepts.length === 0) return;
    
    const newSelectedIds = new Set();
    const newSelectedDepts = [];
    
    selectedDepts.forEach(dept => {
      const departmentId = dept.departmentId || dept.teamId; // 兼容不同的字段名
      if (departmentId) {
        newSelectedIds.add(departmentId);
        newSelectedDepts.push({
          departmentId,
          departmentName: dept.departmentName || dept.teamName,
          parentPath: dept.parentPath || '',
          avatarUrl: dept.avatarUrl || DEFAULT_AVATAR,
        });
      }
    });
    
    this.setState({
      selectedDeptIds: newSelectedIds,
      selectedDepts: newSelectedDepts,
    });
  }

  // 渲染左侧部门列表行
  renderDeptRow = ({ index, key, parent, style }) => {
    const { flattenedRows, searchResults, isSearching, selectedDeptIds } = this.state;
    const rows = isSearching ? searchResults : flattenedRows;
    const dept = rows[index];
    
    if (!dept) return null;
    
    const isChecked = selectedDeptIds.has(dept.departmentId);
    
    return (
      <CellMeasurer
        key={dept.key}
        parent={parent}
        index={index}
        cache={this.cache}
      >
        <div 
          className="dept-selector-item" 
          style={{
            ...style,
            paddingLeft: `${dept.level * 20 + 10}px`,
          }}
        >
          <div className="dept-selector-item-left">
            {/* 展开/收起图标 */}
            {dept.childDepts && dept.childDepts.length > 0 && !isSearching ? (
              <span 
                className="dept-selector-expand-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  this.toggleExpand(dept.departmentId);
                }}
              >
                {this.state.expandedDepts.has(dept.departmentId) ? (
                  <CaretDownOutlined style={{ fontSize: 12, color: '#999' }} />
                ) : (
                  <CaretRightOutlined style={{ fontSize: 12, color: '#999' }} />
                )}
              </span>
            ) : (
              /* 无子部门或搜索模式下：占位符宽度与展开图标一致（16px + 4px margin = 20px） */
              <span className="dept-selector-expand-icon" style={{ cursor: 'default' }} />
            )}
            
            {/* 勾选框 */}
            <Checkbox
              checked={isChecked}
              onChange={(e) => this.handleDeptCheck(dept, e.target.checked)}
            >
              {/* 部门头像 */}
              <Avatar 
                size={24} 
                src={dept.avatarUrl || DEFAULT_AVATAR}
                icon={<TeamOutlined />}
                style={{ marginRight: 8 }}
              />
              {/* 部门名称 */}
              <span className="dept-selector-dept-name" title={dept.departmentName}>
                {dept.departmentName}
              </span>
              {/* 上级部门路径 */}
              {isSearching && dept.parentPath && (
                <span className="dept-selector-dept-path" style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                  （{dept.parentPath}）
                </span>
              )}
            </Checkbox>
          </div>
        </div>
      </CellMeasurer>
    );
  }

  // 渲染右侧已选部门行
  renderSelectedDeptRow = ({ index, key, parent, style }) => {
    const { selectedDepts } = this.state;
    const dept = selectedDepts[index];
    
    if (!dept) return null;
    
    return (
      <CellMeasurer
        key={`selected-${dept.departmentId}`}
        parent={parent}
        index={index}
        cache={this.selectedCache}
      >
        <div className="dept-selector-selected-dept-item" style={style}>
          <div className="dept-selector-selected-dept-item-left">
            <Avatar 
              size={24} 
              src={dept.avatarUrl || DEFAULT_AVATAR}
              icon={<TeamOutlined />}
              style={{ marginRight: 8 }}
            />
            <div className="dept-selector-selected-dept-info">
              <span className="dept-selector-selected-dept-name" title={dept.departmentName}>
                {dept.departmentName}
              </span>
              {dept.parentPath && (
                <span className="dept-selector-selected-dept-path" title={dept.parentPath}>
                  {dept.parentPath}
                </span>
              )}
            </div>
          </div>
          <CloseOutlined 
            className="dept-selector-selected-dept-delete"
            onClick={() => this.handleDeleteDept(dept.departmentId)}
          />
        </div>
      </CellMeasurer>
    );
  }

  render() {
    const { 
      flattenedRows, 
      searchResults, 
      isSearching, 
      selectedDepts, 
      searchKey, 
      isSpinning,
      selectionVersion,
    } = this.state;
    
    const rows = isSearching ? searchResults : flattenedRows;
    
    return (
      <div className="dept-selector-warp">
        <div className="dept-selector-content">
          {/* 左侧部门树 */}
          <div className="dept-selector-left">
            {/* 搜索框 */}
            <div className="dept-selector-search-input">
              <Input
                placeholder="请输入部门关键词"
                value={searchKey}
                suffix={
                  <SearchOutlined 
                    style={{ color: "#BBBBBB", cursor: 'pointer' }} 
                    onClick={this.handleSearchChange}
                  />
                }
                onChange={(e) => {
                  this.setState({ searchKey: e.target.value });
                  this.handleSearchChange(e);
                }}
              />
            </div>
            
            {/* 部门树列表 */}
            <Spin spinning={isSpinning} tip="数据加载中...">
              <div className="dept-selector-tree-list" style={{ height: '330px' }}>
                {rows.length > 0 ? (
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        ref={this.listRef}
                        key={`dept-list-${selectionVersion}`}
                        width={width}
                        height={height}
                        rowCount={rows.length}
                        rowHeight={40}
                        rowRenderer={this.renderDeptRow}
                        deferredMeasurementCache={this.cache}
                        overscanRowCount={5}
                        noRowsRenderer={() => (
                          <div className="dept-selector-empty-data">
                            <Empty
                              image={require("../../../../image/no-data-table.png")}
                              description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                            />
                          </div>
                        )}
                      />
                    )}
                  </AutoSizer>
                ) : (
                  <div className="dept-selector-empty-data">
                    <Empty
                      image={require("../../../../image/no-data-table.png")}
                      description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                    />
                  </div>
                )}
              </div>
            </Spin>
          </div>
          
          {/* 右侧已选部门 */}
          <div className="dept-selector-right">
            <div className="dept-selector-selected-header">
              <span>已选 ({selectedDepts.length})</span>
              {selectedDepts.length > 0 && (
                <span 
                  className="dept-selector-clear-all-btn"
                  onClick={this.handleClearAll}
                  style={{ cursor: 'pointer', color: '#4247f6' }}
                >
                  清空
                </span>
              )}
            </div>
            <div className="dept-selector-selected-dept-list" style={{ height: 'calc(100% - 40px)' }}>
              {selectedDepts.length > 0 ? (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      ref={this.selectedListRef}
                      key="selected-dept-list"
                      width={width}
                      height={height}
                      rowCount={selectedDepts.length}
                      rowHeight={50}
                      rowRenderer={this.renderSelectedDeptRow}
                      deferredMeasurementCache={this.selectedCache}
                      overscanRowCount={5}
                      noRowsRenderer={() => (
                        <div className="dept-selector-empty-data">
                          <Empty
                            image={require("../../../../image/no-data-table.png")}
                            description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                          />
                        </div>
                      )}
                    />
                  )}
                </AutoSizer>
              ) : (
                <div className="dept-selector-empty-data" style={{ padding: '60px 0' }}>
                  <Empty
                    image={require("../../../../image/no-data-table.png")}
                    description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default DeptSelector;

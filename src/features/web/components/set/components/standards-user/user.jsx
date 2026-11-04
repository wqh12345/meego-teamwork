import React, { Component } from "react";
import { Button, Avatar, Input, Checkbox, Tooltip, Spin, Empty, Tabs, Breadcrumb, Alert } from "antd";
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import 'react-virtualized/styles.css';
import { filterDuplicates, debounce } from "../../../../../../util/util";
import {
  getProjectMemberList,
  getProjectAllStaff,
  postSearchMember,
  getProjectUserTeamAll,
  getreTeam,
  queryTeamUserList,
  querySeatAllUser,
  queryAuthAllUser,
  queryAuthTeamList,
  getDeptTreeData
} from "../../../../../../api/api";
import { SearchOutlined, CloseOutlined, UserOutlined, CaretRightOutlined, CaretDownOutlined, InfoCircleFilled } from "@ant-design/icons";
import "./user.css";
import { UserTag } from '@lark-project/ui-kit-plugin';
import DepartmentTree from '../../../department-tree/DepartmentTree';
// function repeatArrayEfficient(arr, times) {
//     // 创建长度为times的数组，填充原始数组后扁平化
//     return Array(times).fill(arr).flatMap(item => item.map(obj => ({ ...obj })));
// }
class TeamSettings extends Component {
  constructor(props) {
    super(props);
    
    this.cache = new CellMeasurerCache({
      defaultHeight: 40,
      fixedWidth: true,
      minHeight: 40,
      maxHeight: 40,
    });
    
    this.selectedUserCache = new CellMeasurerCache({
      defaultHeight: 50,
      fixedWidth: true,
      minHeight: 50,
      maxHeight: 50,
    });
    
    this.state = {
      type: "",
      searchKey: "",
      deptId: "0",
      isSpinning: true,
      allTree: [
        {
          name: "全部员工",
          id: "0",
          isLeaf: true,
          parentId: "0",
        },
      ],
      checkboxOptions: {
        label: "name",
        value: "id",
        disabled: "disabled",
      },
      projectMemberList: [],
      treeData: [],
      initTreeData: [],
      
      // 选择状态 - 使用更高效的数据结构
      selectedUsersMap: new Map(), // userId -> user
      selectedTeamsSet: new Set(), // 选中的团队ID
      
      // 为了兼容性保留的数组格式
      selectedUsers: [],
      selectedUserIds: [],
      selectedDeparts: [],
      selectedDepartIds: [],
      checkedKeys: [],
      defaultSelectedKeys: [],
      
      // 其他状态
      departNum: 0,
      userList: [],
      teamList: [],
      isDisabledTreeData: false,
      activeTabKey: '1',
      items: [
        {
          key: '1',
          label: '成员',
        },
        {
          key: '2',
          label: '团队',
        },
        {
          key: '3',
          label: '部门',
        },
      ],
      
      // 标签页选择状态
      tabSelections: {
        '1': {
          selectedUserIds: [],
          selectedUsers: [],
          checkAll: false,
          isIndeterminate: false
        },
        '2': {
          selectedUserIds: [],
          selectedUsers: [],
          checkAll: false,
          isIndeterminate: false
        },
        '3': {
          selectedMemberIds: new Set(),
          checkAll: false,
          isIndeterminate: false
        }
      },
      
      // 数据缓存
      fullTreeData: {
        '1': [],
        '2': [],
        '3': []
      },
      // 部门Tab搜索状态
      deptSearchKey: '',
      isDeptSearching: false,
      seatCount: {
        "used": null,
        "residue": null,
        "total": null
      },
      hasInitializedSelection: false,
      isSearching: false,
      currentLevel: 1,
      currentTeamId: null,
      teamMemberData: {},
      teamMembers: [],
      teamName: "",
      
      // 团队选择状态
      teamSelectedUserIdsMap: new Map(), // teamId -> Set(userIds)
      teamSelectedUsersMap: new Map(), // teamId -> Map(userId -> user)
      
      breadcrumbItems: [
        { title: '所有团队', id: null }
      ],
      expandedTeams: {},
      showAlert: false,
      
      // 虚拟滚动相关
      leftListKey: 0,
      rightListKey: 0,
      
      // 部门树数据（由父组件调用API获取后传递给DepartmentTree）
      deptTreeData: null,
      deptTreeLoading: false,
      deptTreeError: null,
      
      // 计算缓存
      computedCache: {
        teamCheckboxCache: new Map(),
        teamDisplayCountCache: new Map(),
        selectedUsersCache: null,
        _selectedUsersMapRef: null,
      }
    };
    
    this.handleSearchChange = debounce(this.onSearchKeyChange, 300).bind(this);
    this.onCheckAll = this.onCheckAll.bind(this);
    this.onClearAll = this.onClearAll.bind(this);
    
    this.listRef = React.createRef();
    this.selectedListRef = React.createRef();
    this.deptTreeRef = React.createRef();
    
    this.getTeamCheckboxState = this.getTeamCheckboxState.bind(this);
    this.getTeamMemberDisplayCount = this.getTeamMemberDisplayCount.bind(this);
    this.refreshTeamCheckboxCache = this.refreshTeamCheckboxCache.bind(this);
  }

  // ==================== 生命周期方法 ====================
  
  componentDidMount() {
    const selectedUser = this.props.selectedUser || {};
    const {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = [],
    } = selectedUser;

    const selectedUsersMap = new Map();
    const selectedTeamsSet = new Set(selectedDepartIds);
    
    selectedUsers.forEach(user => {
      const userId = user.userKey || user.staffId || user.id;
      user.avatarUrl = user.avatarUrl || user.staffAvatarUrl;
      user.username = user.userName || user.username || user.nameCn || '';
      if (userId) {
        selectedUsersMap.set(userId, user);
      }
    });

    const tabSelections = {
      '1': {
        selectedUserIds: selectedUserIds,
        selectedUsers: selectedUsers,
        checkAll: false,
        isIndeterminate: false
      },
      '2': {
        selectedUserIds: selectedDepartIds,
        selectedUsers: selectedDeparts,
        checkAll: false,
        isIndeterminate: false
      },
      '3': {
        selectedMemberIds: new Set(),
        checkAll: false,
        isIndeterminate: false
      }
    };
    
    this.setState({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
      selectedUsersMap,
      selectedTeamsSet,
      tabSelections
    }, () => {
      this.querySeatAllUserData().then(() => {
        this.updateCheckboxStatus();
      });
      // 并行加载部门树数据，传递给DepartmentTree组件
      let tenantModeInfo = null;
      try {
        const raw = sessionStorage.getItem('tenantModeInfo');
        if (raw) tenantModeInfo = JSON.parse(raw);
      } catch (_) {}
      if (tenantModeInfo?.install) {
        this.loadDeptTreeData();
      }
    });
  }

  componentDidUpdate(prevProps, prevState) {
    // 清理缓存
    if (
      prevState.treeData !== this.state.treeData ||
      prevState.isSearching !== this.state.isSearching ||
      prevState.searchKey !== this.state.searchKey
    ) {
      this.cache.clearAll();
      this.state.computedCache.teamCheckboxCache.clear();
      this.state.computedCache.teamDisplayCountCache.clear();
      this.state.computedCache.selectedUsersCache = null;
    }
    
    if (
      prevState.selectedUsersMap !== this.state.selectedUsersMap ||
      prevState.selectedTeamsSet !== this.state.selectedTeamsSet
    ) {
      this.selectedUserCache.clearAll();
      this.state.computedCache.selectedUsersCache = null;
      this.state.computedCache._selectedUsersMapRef = null;
    }
  }

  componentWillReceiveProps(nextProps) {
    const { treeData, activeTabKey } = this.state;
    const nextSelectedUser = nextProps.selectedUser || {};
    let {
      selectedDeparts = [],
      selectedUsers = [],
      selectedDepartIds = [],
      selectedUserIds = []
    } = nextSelectedUser;

    if (!selectedDepartIds.length) {
      this.setState({ isDisabledTreeData: false, departNum: 0 });
    }

    const selectedUsersMap = new Map();
    const selectedTeamsSet = new Set(selectedDepartIds);
    
    selectedUsers.forEach(user => {
      const userId = user.userKey || user.staffId || user.id;
      if (userId) {
        selectedUsersMap.set(userId, user);
      }
    });

    if (treeData.length) {
      treeData.forEach((item) => {
        const staffId = activeTabKey === "1" ? item.staffId : item.teamId;
        if (selectedUserIds.includes(staffId) && !selectedUsersMap.has(staffId)) {
          selectedUsersMap.set(staffId, {
            ...item,
            staffId,
            username: activeTabKey === "1" ? item.staffName : item.teamName,
          });
        }
      });
    }

    const updatedTabSelections = {
      ...this.state.tabSelections,
      '1': {
        ...this.state.tabSelections['1'],
        selectedUserIds: selectedUserIds,
        selectedUsers: Array.from(selectedUsersMap.values()).filter(user => user.isUser)
      },
      '2': {
        ...this.state.tabSelections['2'],
        selectedUserIds: selectedDepartIds,
        selectedUsers: selectedDeparts
      }
    };

    this.setState({
      selectedDepartIds,
      selectedUserIds,
      defaultSelectedKeys: selectedDepartIds.concat(selectedUserIds),
      selectedUsersMap,
      selectedTeamsSet,
      tabSelections: updatedTabSelections
    }, () => {
      this.updateCheckboxStatus();
      this.selectedUserCache.clearAll();
    });
  }

  componentWillUnmount() {
    this.cache.clearAll();
    this.selectedUserCache.clearAll();
  }

  // ==================== 数据获取和处理方法 ====================

  getTenantSeatCountData = async () => {
    try {
      const res = await getTenantSeatCount();
      const seatCountNew = {
        "used": 12,
        "residue": 12,
        "total": 1
      }
      this.setState({ seatCount: { ...seatCountNew } })
    } catch (error) {
      console.error('获取席位数据失败:', error);
    }
  }

  processedUserData = () => {
    const { activeTabKey, userList, teamList, selectedUsersMap, selectedTeamsSet } = this.state;
    const dataList = activeTabKey === '1' ? userList || [] : teamList || [];

    const processedData = dataList.map((item, idx) => {
      const isUser = activeTabKey === '1';
      const staffId = isUser ? item.userKey : item.teamId;
      const username = isUser ? item.userName : item.teamName;
      const staffAvatarUrl = !isUser 
        ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
        : (item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');

      // 如果是团队，检查是否需要设置isAll标志
      const isAll = !isUser && selectedTeamsSet.has(staffId) ? 1 : 0;

      return {
        ...item,
        isUser,
        isLeaf: true,
        staffId,
        username,
        staffAvatarUrl,
        isAll,
        openId: item.openId || null, // 保留openId字段，用于与部门Tab的ID映射
        __unique_key__: `${staffId}_${Date.now()}_${idx}`,
        icon: (
          <Avatar
            size={20}
            src={staffAvatarUrl}
            icon={<UserOutlined />}
          />
        )
      };
    });

    const updatedFullTreeData = {
      ...this.state.fullTreeData,
      [activeTabKey]: processedData
    };
    // const newStaffDataEfficient = repeatArrayEfficient(processedData, 30);
    //     console.log(`重复30次后数据长度: ${newStaffDataEfficient.length}`);
    //     newStaffDataEfficient.forEach((item, index) => {
    //       item.unikey=index
    // })
    this.setState({
      treeData: processedData,
      fullTreeData: updatedFullTreeData,
      isSpinning: false,
      isSearching: false
    }, () => {
      this.updateCheckboxStatus();
      this.updateListKeys();
    });
  }

  // 修复：根据已保存的成员数据初始化团队选择状态
  initializeTeamSelectionState = (teamList, selectedUsersMap, selectedTeamsSet) => {
    const teamSelectedUserIdsMap = new Map();
    const teamSelectedUsersMap = new Map();
    
    // 遍历所有团队
    teamList.forEach(team => {
      const teamId = team.teamId;
      const teamMemberSet = new Set();
      const teamUserMap = new Map();
      
      // 检查团队成员是否在已选用户中
      if (team.teamMemberVoList) {
        team.teamMemberVoList.forEach(member => {
          const userId = member.userKey;
          if (selectedUsersMap.has(userId)) {
            teamMemberSet.add(userId);
            teamUserMap.set(userId, {
              ...member,
              userKey: member.userKey,
              username: member.userName,
              isUser: true
            });
          }
        });
        
        // 如果团队有选中的成员，更新团队选择状态
        if (teamMemberSet.size > 0) {
          teamSelectedUserIdsMap.set(teamId, teamMemberSet);
          teamSelectedUsersMap.set(teamId, teamUserMap);
          
          // 如果团队所有成员都被选中，则团队本身也应该被选中
          if (teamMemberSet.size === team.teamMemberVoList.length) {
            selectedTeamsSet.add(teamId);
          }
        }
      }
    });
    
    return { teamSelectedUserIdsMap, teamSelectedUsersMap, selectedTeamsSet };
  }

  getSearchUserList = async () => {
    this.setState({ isSpinning: true });
    const { searchKey, activeTabKey, currentLevel, fullTreeData, teamMembers } = this.state;
    
    if (!searchKey) {
      const treeData = currentLevel === 1 
        ? fullTreeData[activeTabKey] || []
        : teamMembers;
      
      this.setState({
        treeData,
        isSpinning: false,
        isSearching: false
      }, () => {
        this.updateCheckboxStatus();
        this.updateListKeys();
      });
      return;
    }

    try {
      let res;
      const data = { query: searchKey.trim() };

      if (activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2)) {
        res = await postSearchMember(data);
      } else if (activeTabKey === '2' && currentLevel === 1) {
        res = await queryAuthTeamList({ teamName: data.query });
      }

      if (res?.result) {
        let searchList = activeTabKey === '2' && currentLevel === 1 ? res?.data || [] : res.data;
        
        const processedData = searchList.map((item, idx) => {
          const isUser = activeTabKey === '1' || (activeTabKey === '2' && currentLevel === 2);
          const staffId = isUser ? item.staffUserKey : item.teamId;
          const username = isUser ? item.staffName : item.teamName;
          const staffAvatarUrl = !isUser && currentLevel === 1
            ? 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
            : (item.staffAvatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png');

          const isTeamInSelected = !isUser && this.state.selectedTeamsSet.has(staffId);

          return {
            ...item,
            isUser,
            isLeaf: true,
            staffId,
            userName: username,
            username,
            userKey: item.staffUserKey,
            staffAvatarUrl,
            __unique_key__: `${staffId}_${this.state.searchKey}_${idx}`,
            ...(isTeamInSelected && { isAll: 1 }),
            icon: (
              <Avatar
                size={20}
                src={staffAvatarUrl}
                icon={<UserOutlined />}
              />
            )
          };
        });
        
        this.setState({
          treeData: processedData,
          isSpinning: false,
          isSearching: true
        }, () => {
          this.updateCheckboxStatus();
          this.updateListKeys();
        });
      } else {
        this.setState({ isSpinning: false });
      }
    } catch (error) {
      console.error('搜索失败:', error);
      this.setState({ isSpinning: false });
    }
  };

  onSearchKeyChange = (e) => {
    this.getSearchUserList();
  };

  // ==================== 选择状态计算方法 ====================

  getTeamCheckboxState = (team) => {
    const teamId = team.staffId || team.teamId;
    const cacheKey = `${teamId}_${this.state.selectedUsersMap.size}_${this.state.selectedTeamsSet.has(teamId)}`;
    
    if (this.state.computedCache.teamCheckboxCache.has(cacheKey)) {
      return this.state.computedCache.teamCheckboxCache.get(cacheKey);
    }

    const teamMembers = team.teamMemberVoList || [];
    const totalMembers = teamMembers.length;
    //console.log('totalMembers8888', totalMembers);
    if (totalMembers === 0) {
      const result = { checked: false, indeterminate: false };
      this.state.computedCache.teamCheckboxCache.set(cacheKey, result);
      return result;
    }

    let selectedMembersCount = 0;
    for (const member of teamMembers) {
      //console.log(member.userKey,this.state.selectedUsersMap);
      if (this.state.selectedUsersMap.has(member.userKey)) {
        selectedMembersCount++;
      }
    }

    let result;
    //console.log(team.teamName,'--------', selectedMembersCount,totalMembers);
    if (selectedMembersCount === totalMembers) {
      result = { checked: true, indeterminate: false };
    } else if (selectedMembersCount > 0 && selectedMembersCount < totalMembers) {
      result = { checked: false, indeterminate: true };
    } else {
      result = { checked: false, indeterminate: false };
    }

    // 如果团队本身被选中，确保复选框状态为选中
    // if (this.state.selectedTeamsSet.has(teamId)) {
    // console.log('this.state.selectedTeamsSet', this.state.selectedTeamsSet);
    //   result = { checked: true, indeterminate: false };
    // }

    this.state.computedCache.teamCheckboxCache.set(cacheKey, result);
    return result;
  };

  getTeamMemberDisplayCount = (team) => {
    const teamId = team.staffId;
    const cacheKey = `${teamId}_${this.state.selectedUsersMap.size}_${this.state.selectedTeamsSet.has(teamId)}`;
    
    if (this.state.computedCache.teamDisplayCountCache.has(cacheKey)) {
      return this.state.computedCache.teamDisplayCountCache.get(cacheKey);
    }
    const teamMembers = team.teamMemberVoList || [];
    const totalMembers = teamMembers.length;
    let selectedMemberCount = 0;
    if (this.state.selectedTeamsSet.has(teamId)) {
      // 如果团队被选中，显示团队所有成员数量
      //const result = `${totalMembers}/${totalMembers}`;
      for (const member of teamMembers) {
        if (this.state.selectedUsersMap.has(member.userKey)) {
          selectedMemberCount++;
        }
      }
      const result = `${selectedMemberCount}/${totalMembers}`;
      this.state.computedCache.teamDisplayCountCache.set(cacheKey, result);
      return result;
    } else {
      // 如果团队未被选中，显示被选中的成员数量
      for (const member of teamMembers) {
        if (this.state.selectedUsersMap.has(member.userKey)) {
          selectedMemberCount++;
        }
      }
      const result = `${selectedMemberCount}/${totalMembers}`;
      this.state.computedCache.teamDisplayCountCache.set(cacheKey, result);
      return result;
    }
  };

  // 刷新团队复选框缓存
  refreshTeamCheckboxCache() {
    this.state.computedCache.teamCheckboxCache.clear();
    this.state.computedCache.teamDisplayCountCache.clear();
  }

 updateCheckboxStatus = () => {
    const { tabSelections, fullTreeData, selectedUsersMap, selectedTeamsSet, teamList, selectedUsers, selectedUserIds, selectedDeparts, selectedDepartIds, treeData, isSearching, activeTabKey } = this.state;
    const updatedTabSelections = { ...tabSelections };
    let hasChanges = false;

    // ======== 1. 同步 Tab 1（成员）的 selectedUserIds ========
    const syncedTab1UserIds = Array.from(selectedUsersMap.keys());
    const syncedTab1Users = Array.from(selectedUsersMap.values()).filter(u => u.isUser && !u._isAlias);
    if (!this.arraysEqual(updatedTabSelections['1'].selectedUserIds, syncedTab1UserIds)) {
      updatedTabSelections['1'] = {
        ...updatedTabSelections['1'],
        selectedUserIds: syncedTab1UserIds,
        selectedUsers: syncedTab1Users,
      };
      hasChanges = true;
    }

    // ======== 2. 同步 Tab 2（团队）的 selectedUserIds ========
    if (!this.arraysEqual(updatedTabSelections['2'].selectedUserIds, selectedDepartIds)) {
      updatedTabSelections['2'] = {
        ...updatedTabSelections['2'],
        selectedUserIds: selectedDepartIds,
        selectedUsers: selectedDeparts,
      };
      hasChanges = true;
    }

    // ======== 3. 同步所有标签页的 checkAll/isIndeterminate 状态 ========
    ['1', '2'].forEach(tabKey => {
      // 搜索状态下使用当前treeData，否则使用fullTreeData
      const tabData = (isSearching && activeTabKey === tabKey) ? (treeData || []) : (fullTreeData[tabKey] || []);
      const totalItems = tabData.length;
      if (totalItems === 0) return;

      let selectedCount = 0;

      if (tabKey === '1') {
        // 成员Tab：统计在 selectedUsersMap 中的成员数
        tabData.forEach(item => {
          if (selectedUsersMap.has(item.staffId)) selectedCount++;
        });
      } else if (tabKey === '2') {
        // 团队Tab：统计团队级别的选中数
        selectedCount = tabData.filter(item => selectedTeamsSet.has(item.staffId)).length;
        // 额外检查：是否所有团队的所有成员都被选中（处理部分团队全选的情况）
        const allMembersSelected = tabData.every(team => {
          if (!team.teamMemberVoList || team.teamMemberVoList.length === 0) return false;
          return team.teamMemberVoList.every(member =>
            selectedUsersMap.has(member.userKey || member.staffId)
          );
        });
        if (allMembersSelected) selectedCount = totalItems;
      }

      const checkAll = totalItems > 0 && selectedCount === totalItems;
      const isIndeterminate = selectedCount > 0 && selectedCount < totalItems;

      const currentTab = updatedTabSelections[tabKey];
      if (currentTab.checkAll !== checkAll || currentTab.isIndeterminate !== isIndeterminate) {
        updatedTabSelections[tabKey] = { ...currentTab, checkAll, isIndeterminate };
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.setState({ tabSelections: updatedTabSelections });
    }
  };

  // 浅比较两个数组是否相等
  arraysEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  // ==================== 选择操作核心方法 ====================

  // 修复：勾选团队时正确处理团队成员
  onTeamCheckboxChange = (team, checked) => {
    const teamId = team.staffId;
    const teamMembers = team.teamMemberVoList || [];
    
    this.setState(prevState => {
      // console.log('prevState.selectedTeamsSet', prevState.selectedTeamsSet);
      // console.log('prevState.newTeamSelectedUserIdsMap', prevState.newTeamSelectedUserIdsMap);
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      
      if (checked) {
        // 选中团队
        newSelectedTeamsSet.add(teamId);
        
        const teamMemberSet = new Set();
        const teamUserMap = new Map();
        
        // 添加团队所有成员到选中状态
        teamMembers.forEach(member => {
          const userId = member.userKey;
          teamMemberSet.add(userId);
          teamUserMap.set(userId, {
            ...member,
            userKey: member.userKey,
            username: member.userName,
            isUser: true
          });
          
          // 只添加当前团队未选中的成员
          if (!newSelectedUsersMap.has(userId)) {
            newSelectedUsersMap.set(userId, {
              ...member,
              userKey: member.userKey,
              username: member.userName,
              isUser: true
            });
          }
        });
        
        newTeamSelectedUserIdsMap.set(teamId, teamMemberSet);
        newTeamSelectedUsersMap.set(teamId, teamUserMap);
      } else {
        // 取消选中团队
        newSelectedTeamsSet.delete(teamId);
        
        // 尝试从现有缓存中获取团队成员的ID集合
        let teamMemberSet = newTeamSelectedUserIdsMap.get(teamId);
        
        if (!teamMemberSet || teamMemberSet.size === 0) {
          // 如果缓存中没有团队成员信息，直接从team对象中获取
          teamMemberSet = new Set();
          teamMembers.forEach(member => {
            const userId = member.userKey;
            teamMemberSet.add(userId);
          });
        }
        // console.log('teamMemberSet8888', teamMemberSet);
        // 从全局选中中移除当前团队的成员
        teamMemberSet.forEach(userId => {
          // 检查该成员是否属于其他被选中的团队
          // let shouldKeepUser = false;
          
          // for (const [otherTeamId, otherMemberSet] of newTeamSelectedUserIdsMap) {
          //   if (otherTeamId !== teamId && otherMemberSet.has(userId)) {
          //     shouldKeepUser = true;
          //     break;
          //   }
          // }
          
          // // 如果用户不属于其他选中团队，则从全局选中中移除
          // if (!shouldKeepUser) {
          //   newSelectedUsersMap.delete(userId);
          // }
          newSelectedUsersMap.delete(userId);
        });
        
        // 移除当前团队的选中状态
        newTeamSelectedUserIdsMap.delete(teamId);
        newTeamSelectedUsersMap.delete(teamId);
      }
      
      // 更新兼容性数组
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      
      // 更新团队数据的isAll标志
      const updatedTeamList = prevState.teamList.map(t => 
        t.teamId === teamId ? { ...t, isAll: checked ? 1 : 0 } : t
      );
      const updatedTreeData = prevState.treeData.map(item => 
        item.staffId === teamId ? { ...item, isAll: checked ? 1 : 0 } : item
      );
      
      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds,
        teamList: updatedTeamList,
        treeData: updatedTreeData
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
      this.syncMembersToDeptTab();
    });
  };

  onCheck = (checkedValues) => {
    const { treeData, activeTabKey, currentLevel, currentTeamId } = this.state;
    const checkedSet = new Set(checkedValues);
    
    this.setState(prevState => {
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      
      // 处理当前视图中的所有项目
      treeData.forEach(item => {
        // 解析成员在 selectedUsersMap 中的实际 key（处理搜索结果 ID 不一致问题）
        const itemId = (() => {
          if (newSelectedUsersMap.has(item.staffId)) return item.staffId;
          if (item.userKey && item.userKey !== item.staffId && newSelectedUsersMap.has(item.userKey)) return item.userKey;
          if (item.openId && newSelectedUsersMap.has(item.openId)) return item.openId;
          return item.staffId;
        })();
        const shouldBeSelected = checkedSet.has(itemId);
        const currentlySelected = newSelectedUsersMap.has(itemId);
        
        if (shouldBeSelected && !currentlySelected) {
          // 选中项目
          newSelectedUsersMap.set(itemId, item);
          
          // 如果是团队下级页面，更新团队选中状态
          if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
            const teamMemberSet = newTeamSelectedUserIdsMap.get(currentTeamId) || new Set();
            teamMemberSet.add(itemId);
            newTeamSelectedUserIdsMap.set(currentTeamId, teamMemberSet);
            
            const teamUserMap = newTeamSelectedUsersMap.get(currentTeamId) || new Map();
            teamUserMap.set(itemId, item);
            newTeamSelectedUsersMap.set(currentTeamId, teamUserMap);
            
            // 检查团队是否应该被选中（所有成员都被选中）
            const team = prevState.teamList.find(t => t.teamId === currentTeamId);
            if (team && team.teamMemberVoList) {
              const allMembersSelected = team.teamMemberVoList.every(member => 
                newSelectedUsersMap.has(member.userKey)
              );
              if (allMembersSelected) {
                newSelectedTeamsSet.add(currentTeamId);
              }
            }
          }
          
          // 如果是团队主页面，找到对应的团队
          if (activeTabKey === '2' && currentLevel === 1) {
            const team = prevState.teamList.find(t => 
              t.teamMemberVoList?.some(member => member.userKey === itemId)
            );
            if (team) {
              const teamMemberSet = newTeamSelectedUserIdsMap.get(team.teamId) || new Set();
              teamMemberSet.add(itemId);
              newTeamSelectedUserIdsMap.set(team.teamId, teamMemberSet);
              
              const teamUserMap = newTeamSelectedUsersMap.get(team.teamId) || new Map();
              teamUserMap.set(itemId, item);
              newTeamSelectedUsersMap.set(team.teamId, teamUserMap);
              
              // 检查团队是否应该被选中
              const allMembersSelected = team.teamMemberVoList.every(member => 
                newSelectedUsersMap.has(member.userKey)
              );
              if (allMembersSelected) {
                newSelectedTeamsSet.add(team.teamId);
              }
            }
          }
        } else if (!shouldBeSelected && currentlySelected) {
          // 取消选中项目
          newSelectedUsersMap.delete(itemId);
          
          // 从所有团队的选中成员中移除
          for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
            if (memberSet.has(itemId)) {
              memberSet.delete(itemId);
              
              const teamUserMap = newTeamSelectedUsersMap.get(teamId);
              if (teamUserMap) {
                teamUserMap.delete(itemId);
                
                // 如果团队没有选中成员了，清除团队选中状态
                if (teamUserMap.size === 0) {
                  newTeamSelectedUserIdsMap.delete(teamId);
                  newTeamSelectedUsersMap.delete(teamId);
                  newSelectedTeamsSet.delete(teamId);
                } else {
                  // 如果还有成员被选中，确保团队不被标记为全选
                  newSelectedTeamsSet.delete(teamId);
                }
              }
            }
          }
        }
      });
      
      // 更新兼容性数组
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      
      // 更新团队数据的isAll标志
      const updatedTeamList = prevState.teamList.map(team => {
        const isAll = newSelectedTeamsSet.has(team.teamId) ? 1 : 0;
        return { ...team, isAll };
      });
      
      const updatedTreeData = treeData.map(item => {
        if (!item.isUser) {
          const isAll = newSelectedTeamsSet.has(item.staffId) ? 1 : 0;
          return { ...item, isAll };
        }
        return item;
      });
      
      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds,
        teamList: updatedTeamList,
        treeData: updatedTreeData
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
      this.syncMembersToDeptTab();
    });
  };

  // 修复：团队下级页面取消全选时，移除所有同名成员
  onCheckAll = (e) => {
    const { checked } = e.target;
    const { treeData, activeTabKey, currentLevel, currentTeamId, teamList, searchKey, isSearching,tabSelections,fullTreeData} = this.state;

    this.setState(prevState => {
      let newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      
      let updatedTeamList = teamList;
      let updatedTreeData = treeData;
      
      if (checked) {
        // 全选
        if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
          // 全选团队下级成员
          const allMemberIds = treeData.map(member => member.staffId);
          const memberSet = new Set(allMemberIds);
          const userMap = new Map();
          
          treeData.forEach(member => {
            userMap.set(member.staffId, member);
            newSelectedUsersMap.set(member.staffId, member);
          });
          
          newTeamSelectedUserIdsMap.set(currentTeamId, memberSet);
          newTeamSelectedUsersMap.set(currentTeamId, userMap);
          
          // 标记团队为选中状态
          newSelectedTeamsSet.add(currentTeamId);
        } else if (activeTabKey === '2' && currentLevel === 1) {
          // 全选所有团队
          treeData.forEach(team => {
            const teamId = team.staffId;
            newSelectedTeamsSet.add(teamId);
            
            if (team.teamMemberVoList) {
              const memberSet = new Set();
              const userMap = new Map();
              
              team.teamMemberVoList.forEach(member => {
                const userId = member.userKey;
                memberSet.add(userId);
                userMap.set(userId, {
                  ...member,
                  userKey: member.userKey,
                  username: member.userName,
                  isUser: true
                });
                
                if (!newSelectedUsersMap.has(userId)) {
                  newSelectedUsersMap.set(userId, {
                    ...member,
                    userKey: member.userKey,
                    username: member.userName,
                    isUser: true
                  });
                }
              });
              
              newTeamSelectedUserIdsMap.set(teamId, memberSet);
              newTeamSelectedUsersMap.set(teamId, userMap);
            }
          });
          
          updatedTeamList = teamList.map(team => ({ ...team, isAll: 1 }));
          updatedTreeData = treeData.map(item => ({ ...item, isAll: 1 }));
        } else {
          // 全选成员
          if (isSearching) {
            // 搜索状态下，只全选当前搜索结果
            treeData.forEach(item => {
              newSelectedUsersMap.set(item.staffId, item);
            });
          } else {
            // 非搜索状态下，全选所有成员
            treeData.forEach(item => {
              newSelectedUsersMap.set(item.staffId, item);
            });
          }
        }
      } else {
        // 取消全选
        if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
          // 取消全选团队下级成员 - 移除所有同名成员
          const memberIds = treeData.map(member => member.staffId);
          
          // 从所有团队的选中成员中移除这些成员
          for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
            memberIds.forEach(id => {
              if (memberSet.has(id)) {
                memberSet.delete(id);
              }
            });
            
            // 如果团队没有选中成员了，清除团队选中状态
            if (memberSet.size === 0) {
              newTeamSelectedUserIdsMap.delete(teamId);
              newTeamSelectedUsersMap.delete(teamId);
              
              // 如果团队本身没有被选中，从选中团队中移除
              if (!newSelectedTeamsSet.has(teamId)) {
                newSelectedTeamsSet.delete(teamId);
              }
            }
          }
          
          // 从全局选中中移除这些成员
          memberIds.forEach(id => {
            newSelectedUsersMap.delete(id);
          });
          
          // 移除当前团队的选中状态
          newTeamSelectedUserIdsMap.delete(currentTeamId);
          newTeamSelectedUsersMap.delete(currentTeamId);
          newSelectedTeamsSet.delete(currentTeamId);
        } else if (activeTabKey === '2' && currentLevel === 1) {
          // 取消全选所有团队
          treeData.forEach(team => {
            const teamId = team.staffId;
            newSelectedTeamsSet.delete(teamId);
            const teamMemberSet = newTeamSelectedUserIdsMap.get(teamId);
            if (teamMemberSet) {
              // 从全局选中中移除该团队的所有成员
              teamMemberSet.forEach(userId => {
                newSelectedUsersMap.delete(userId);
              });
            }
            team.teamMemberVoList.forEach(member => {
              const userId = member.userKey;
              newSelectedUsersMap.delete(userId);
            });
            // 移除当前团队的选中状态
            newTeamSelectedUserIdsMap.delete(teamId);
            newTeamSelectedUsersMap.delete(teamId);
          });
          updatedTeamList = teamList.map(team => ({ ...team, isAll: 0 }));
          updatedTreeData = treeData.map(item => ({ ...item, isAll: 0 }));
        } else {
          // 取消全选成员 - 根据搜索状态决定取消范围
          if (isSearching) {
            // 搜索状态下，只取消当前搜索结果中的成员
            const searchResultIds = treeData.map(item => item.staffId);
            
            // 从全局选中中移除搜索结果成员
            searchResultIds.forEach(id => {
              newSelectedUsersMap.delete(id);
            });
            
            // 从所有团队的选中成员中移除这些搜索结果成员
            for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
              searchResultIds.forEach(id => {
                if (memberSet.has(id)) {
                  memberSet.delete(id);
                }
              });
              
              // 如果团队没有选中成员了，清除团队选中状态
              if (memberSet.size === 0) {
                newTeamSelectedUserIdsMap.delete(teamId);
                newTeamSelectedUsersMap.delete(teamId);
                
                // 如果团队本身没有被选中，从选中团队中移除
                if (!newSelectedTeamsSet.has(teamId)) {
                  newSelectedTeamsSet.delete(teamId);
                }
              }
            }
          } else {
            // 非搜索状态下，取消所有成员，包括属于已选团队的成员
            const allMemberIds = treeData.map(item => item.staffId);
            
            // 清空所有成员
            for (const id of allMemberIds) {
              newSelectedUsersMap.delete(id);
            }
            
            // 清空团队选中状态
            newTeamSelectedUserIdsMap.clear();
            newTeamSelectedUsersMap.clear();
            
            // 清空团队选中
            newSelectedTeamsSet.clear();
            
            // 更新团队数据的isAll标志
            updatedTeamList = teamList.map(team => ({ ...team, isAll: 0 }));
            updatedTreeData = treeData.map(item => ({ ...item, isAll: 0 }));
          }
        }
      }
      
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      return {
        teamList: updatedTeamList,
        treeData: updatedTreeData,
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
      this.syncMembersToDeptTab();
    });
  };

  // 修复：删除右侧选中成员时，同步更新团队状态
  onDelSelectedClick = (item, index, type) => {
    const itemId = item.userKey || item.id;
    
    this.setState(prevState => {
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const newSelectedTeamsSet = new Set(prevState.selectedTeamsSet);
      const newTeamSelectedUserIdsMap = new Map(prevState.teamSelectedUserIdsMap);
      const newTeamSelectedUsersMap = new Map(prevState.teamSelectedUsersMap);
      
      if (type === 'user') {
        // 从全局选中中移除用户
        newSelectedUsersMap.delete(itemId);
        
        // 从所有团队的选中成员中移除该用户
        const affectedTeams = [];
        
        for (const [teamId, memberSet] of newTeamSelectedUserIdsMap) {
          if (memberSet.has(itemId)) {
            memberSet.delete(itemId);
            
            const teamUserMap = newTeamSelectedUsersMap.get(teamId);
            if (teamUserMap) {
              teamUserMap.delete(itemId);
            }
            
            // 检查团队是否还应该被选中
            let shouldTeamBeSelected = false;
            if (memberSet.size > 0) {
              shouldTeamBeSelected = true;
            }
            
            // 更新团队的选中状态
            if (!shouldTeamBeSelected) {
              newSelectedTeamsSet.delete(teamId);
              affectedTeams.push(teamId);
            }
          }
        }
        
        // 更新团队列表的isAll标志
        const updatedTeamList = prevState.teamList.map(team => {
          if (affectedTeams.includes(team.teamId)) {
            return { ...team, isAll: 0 };
          }
          return team;
        });
        
        // 更新树数据的isAll标志
        const updatedTreeData = prevState.treeData.map(treeItem => {
          if (affectedTeams.includes(treeItem.staffId)) {
            return { ...treeItem, isAll: 0 };
          }
          return treeItem;
        });
        
        // 更新兼容性数组
        const selectedUsers = Array.from(newSelectedUsersMap.values());
        const selectedUserIds = Array.from(newSelectedUsersMap.keys());
        const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
          prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
        );
        const selectedDepartIds = Array.from(newSelectedTeamsSet);
        
        return {
          selectedUsersMap: newSelectedUsersMap,
          selectedTeamsSet: newSelectedTeamsSet,
          teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
          teamSelectedUsersMap: newTeamSelectedUsersMap,
          selectedUsers,
          selectedUserIds,
          selectedDeparts,
          selectedDepartIds,
          defaultSelectedKeys: selectedUserIds,
          teamList: updatedTeamList,
          treeData: updatedTreeData
        };
      } else if (type === 'depart') {
        // 取消选中团队
        newSelectedTeamsSet.delete(itemId);
        const teamMemberSet = newTeamSelectedUserIdsMap.get(itemId);
        
        if (teamMemberSet) {
          // 从全局选中中移除该团队的所有成员
          teamMemberSet.forEach(userId => {
            newSelectedUsersMap.delete(userId);
          });
        }
        
        newTeamSelectedUserIdsMap.delete(itemId);
        newTeamSelectedUsersMap.delete(itemId);
        
        const updatedTeamList = prevState.teamList.map(team => 
          team.teamId === itemId ? { ...team, isAll: 0 } : team
        );
        const updatedTreeData = prevState.treeData.map(treeItem => 
          treeItem.staffId === itemId ? { ...treeItem, isAll: 0 } : treeItem
        );
        
        const selectedUsers = Array.from(newSelectedUsersMap.values());
        const selectedUserIds = Array.from(newSelectedUsersMap.keys());
        const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
          prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
        );
        const selectedDepartIds = Array.from(newSelectedTeamsSet);
        
        return {
          selectedUsersMap: newSelectedUsersMap,
          selectedTeamsSet: newSelectedTeamsSet,
          teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
          teamSelectedUsersMap: newTeamSelectedUsersMap,
          selectedUsers,
          selectedUserIds,
          selectedDeparts,
          selectedDepartIds,
          defaultSelectedKeys: selectedUserIds,
          teamList: updatedTeamList,
          treeData: updatedTreeData
        };
      }
      
      // 更新兼容性数组
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId => 
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);
      
      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds
      };
    }, () => {
      // 刷新缓存，确保团队复选框状态正确
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
      this.syncMembersToDeptTab();
    });
  };

  // 清空所有选择
  onClearAll = () => {
    this.setState(prevState => {
      const updatedTeamList = prevState.teamList.map(team => ({ ...team, isAll: 0 }));
      const updatedTreeData = prevState.treeData.map(item => ({ ...item, isAll: 0 }));
      
      return {
        selectedUsersMap: new Map(),
        selectedTeamsSet: new Set(),
        teamSelectedUserIdsMap: new Map(),
        teamSelectedUsersMap: new Map(),
        selectedUsers: [],
        selectedUserIds: [],
        selectedDeparts: [],
        selectedDepartIds: [],
        checkedKeys: [],
        defaultSelectedKeys: [],
        isDisabledTreeData: false,
        teamList: updatedTeamList,
        treeData: updatedTreeData,
        tabSelections: {
          ...prevState.tabSelections,
          '3': {
            ...(prevState.tabSelections['3'] || {}),
            selectedMemberIds: new Set()
          }
        }
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
    });
  };

  // 通知父组件
  notifyParentComponent = () => {
    const { selectedUsers, selectedUserIds, selectedDeparts, selectedDepartIds } = this.state;
    
    this.props.getSelectedUser?.({
      selectedDeparts,
      selectedUsers,
      selectedDepartIds,
      selectedUserIds,
      checkedKeys: []
    });
  };

  // ==================== 团队相关操作 ====================

  getTeamMembers = async (teamId, teamName, teamUserList) => {
    try {
      const processedMembers = teamUserList.map((item, idx) => ({
        ...item,
        isUser: true,
        isLeaf: true,
        staffId: item.userKey,
        username: item.userName || item.nameCn,
        staffAvatarUrl: item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
        __unique_key__: `${item.userKey}_${Date.now()}_${idx}`,
        icon: (
          <Avatar
            size={20}
            src={item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'}
            icon={<UserOutlined />}
          />
        )
      }));

      const newBreadcrumbItems = [
        { title: '所有团队', id: null },
        { title: teamName, id: teamId }
      ];
      
      this.setState({
        treeData: processedMembers,
        teamMembers: processedMembers,
        currentTeamId: teamId,
        currentLevel: 2,
        teamName: teamName,
        breadcrumbItems: newBreadcrumbItems,
        isSpinning: false
      }, () => {
        this.refreshTeamCheckboxCache();
        this.updateCheckboxStatus();
        this.updateListKeys();
      });
    } catch (error) {
      console.error('获取团队成员失败:', error);
      this.setState({ isSpinning: false });
    }
  };

  backToTeamList = () => {
    this.setState({
      currentLevel: 1,
      currentTeamId: null,
      treeData: this.state.fullTreeData['2'] || [],
      teamName: "",
      breadcrumbItems: [
        { title: '所有团队', id: null }
      ]
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.updateListKeys();
    });
  };

  handleBreadcrumbClick = (item) => {
    if (item.id === null) {
      this.backToTeamList();
    }
  };

  // ==================== 标签页切换 ====================

  onChange = (key) => {
    // 切换Tab前立即清理缓存，确保新Tab不会使用过期数据
    this.cache.clearAll();
    this.selectedUserCache.clearAll();
    this.state.computedCache.selectedUsersCache = null;
    this.state.computedCache._selectedUsersMapRef = null;
    // 清理团队复选框缓存，确保切换后团队勾选状态正确反映最新选中数据
    this.refreshTeamCheckboxCache();
    
    this.setState({
      activeTabKey: key,
      searchKey: '',
      isSearching: false,
      currentLevel: 1,
      currentTeamId: null,
      teamName: "",
      breadcrumbItems: [
        { title: '所有团队', id: null }
      ],
      deptSearchKey: '',
      isDeptSearching: false
    }, () => {
      // 部门Tab不需要加载数据，DepartmentTree组件自行管理
      if (key === '3') {
        // 同步成员Tab的选中状态到部门Tab
        this.syncMembersToDeptTab();
        return;
      }

      // 切换到成员/团队Tab时，确保团队选择状态与selectedUsersMap同步
      const { newTeamSelectedUserIdsMap, newTeamSelectedUsersMap, newSelectedTeamsSet } =
        this.syncTeamSelectionState(this.state.selectedUsersMap, this.state.teamList, this.state);

      const fullTreeData = this.state.fullTreeData[key] || [];

      let updatedTreeData = fullTreeData;

      if (key === '2') {
        updatedTreeData = fullTreeData.map(team => {
          // 使用 syncTeamSelectionState 返回的最新值，而非 this.state.selectedTeamsSet
          const isTeamSelected = newSelectedTeamsSet.has(team.staffId);
          return { ...team, isAll: isTeamSelected ? 1 : 0 };
        });

        const updatedFullTreeData = {
          ...this.state.fullTreeData,
          [key]: updatedTreeData
        };

        this.setState({
          teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
          teamSelectedUsersMap: newTeamSelectedUsersMap,
          selectedTeamsSet: newSelectedTeamsSet,
          fullTreeData: updatedFullTreeData,
          treeData: updatedTreeData
        }, () => {
          this.refreshTeamCheckboxCache();
          this.updateCheckboxStatus();
          this.updateListKeys();
        });
      } else {
        this.setState({
          teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
          teamSelectedUsersMap: newTeamSelectedUsersMap,
          selectedTeamsSet: newSelectedTeamsSet,
          treeData: fullTreeData
        }, () => {
          this.refreshTeamCheckboxCache();
          this.updateCheckboxStatus();
          this.updateListKeys();
        });
      }

      if (!this.state.fullTreeData[key] || this.state.fullTreeData[key].length === 0) {
        this.processedUserData();
      }
    });
  };

  // ==================== 跨Tab联动同步方法 ====================

  /**
   * 根据 selectedUsersMap 重建团队选择状态（teamSelectedUserIdsMap / teamSelectedUsersMap / selectedTeamsSet）
   * 解决从成员Tab或部门Tab修改选中状态后，团队Tab显示不一致的问题
   */
  syncTeamSelectionState = (selectedUsersMap, teamList, prevState) => {
    const newTeamSelectedUserIdsMap = new Map();
    const newTeamSelectedUsersMap = new Map();
    const newSelectedTeamsSet = new Set();

    (teamList || []).forEach(team => {
      const teamId = team.teamId;
      const members = team.teamMemberVoList || [];
      if (members.length === 0) return;

      const memberSet = new Set();
      const userMap = new Map();

      members.forEach(member => {
        const userId = member.userKey;
        if (selectedUsersMap.has(userId)) {
          memberSet.add(userId);
          userMap.set(userId, {
            ...member,
            userKey: member.userKey,
            username: member.userName,
            isUser: true
          });
        }
      });

      if (memberSet.size > 0) {
        newTeamSelectedUserIdsMap.set(teamId, memberSet);
        newTeamSelectedUsersMap.set(teamId, userMap);
        // 团队所有成员都被选中时，标记团队为全选
        if (memberSet.size === members.length) {
          newSelectedTeamsSet.add(teamId);
        }
      }
    });

    return { newTeamSelectedUserIdsMap, newTeamSelectedUsersMap, newSelectedTeamsSet };
  }

  // ==================== 部门Tab相关方法 ====================

  // 同步成员Tab选中状态到部门Tab
  syncMembersToDeptTab = () => {
    const { selectedUsersMap, tabSelections } = this.state;
    const newDeptMemberIds = new Set();
    
    // 将成员Tab中所有已选成员的 userKey 同步到部门Tab
    // 现在部门Tab和成员Tab都统一使用 userKey 作为标识符
    for (const [userKey, userObj] of selectedUsersMap) {
      // 跳过别名条目（_isAlias标记的冗余条目）
      if (userObj._isAlias) continue;
      // 统一使用 userKey 作为标识符
      newDeptMemberIds.add(userKey);
    }
    
    const updatedTabSelections = {
      ...tabSelections,
      '3': {
        ...(tabSelections['3'] || {}),
        selectedMemberIds: newDeptMemberIds
      }
    };
    
    this.setState({ tabSelections: updatedTabSelections }, () => {
      // 同步后强制刷新部门树的复选框状态
      if (this.deptTreeRef && this.deptTreeRef.current) {
        this.deptTreeRef.current.forceUpdate();
      }
    });
  }

  // 部门Tab中勾选/取消成员
  handleDeptMemberCheck = (userKey, checked, memberItem) => {
    console.log('handleDeptMemberCheck====', userKey, checked, memberItem);
    this.setState(prevState => {
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const prevDeptState = prevState.tabSelections['3'] || {};
      const newDeptMemberIds = new Set(prevDeptState.selectedMemberIds || []);
      
      if (checked) {
        // 添加到全局选中 — 统一使用 userKey 作为标识符
        const userObj = {
          staffId: memberItem.staffUserKey || userKey,
          userKey: userKey,
          username: memberItem.staffName,
          staffAvatarUrl: memberItem.staffAvatarUrl || '',
          isUser: true,
        };
        newSelectedUsersMap.set(userKey, userObj);
        newDeptMemberIds.add(userKey);
      } else {
        // 从全局选中移除 — 统一使用 userKey 作为标识符
        newSelectedUsersMap.delete(userKey);
        newDeptMemberIds.delete(userKey);
      }
      
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      
      // 同步清理缓存，确保右侧列表及时更新
      prevState.computedCache.selectedUsersCache = null;
      prevState.computedCache._selectedUsersMapRef = null;
      
      // 跨Tab联动：根据最新的 selectedUsersMap 重建团队选择状态
      const { newTeamSelectedUserIdsMap, newTeamSelectedUsersMap, newSelectedTeamsSet } =
        this.syncTeamSelectionState(newSelectedUsersMap, prevState.teamList, prevState);

      // 更新兼容性数组（团队选中状态可能变化）
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId =>
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);

      // 更新团队数据的isAll标志
      const updatedTeamList = prevState.teamList.map(team => {
        const isAll = newSelectedTeamsSet.has(team.teamId) ? 1 : 0;
        return { ...team, isAll };
      });

      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds,
        teamList: updatedTeamList,
        tabSelections: {
          ...prevState.tabSelections,
          '3': {
            ...prevDeptState,
            selectedMemberIds: newDeptMemberIds
          }
          // 注：tab '1' 和 '2' 的 selectedUserIds/checkAll/isIndeterminate
          // 由 setState 回调中的 updateCheckboxStatus() 统一同步
        }
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
      this.syncMembersToDeptTab();
    });
  }

  // 部门Tab中全选/取消某部门下所有员工
  handleDeptSelectAllMembers = (deptId, members, checked) => {
    this.setState(prevState => {
      const newSelectedUsersMap = new Map(prevState.selectedUsersMap);
      const prevDeptState = prevState.tabSelections['3'] || {};
      const newDeptMemberIds = new Set(prevDeptState.selectedMemberIds || []);
      
      members.forEach(member => {
        // 统一使用 userKey 作为标识符
        const userKey = member.staffUserKey || member.staffId;
        
        if (checked) {
          const userObj = {
            staffId: userKey,
            userKey: userKey,
            username: member.staffName,
            staffAvatarUrl: member.staffAvatarUrl || '',
            isUser: true,
          };
          newSelectedUsersMap.set(userKey, userObj);
          newDeptMemberIds.add(userKey);
        } else {
          newSelectedUsersMap.delete(userKey);
          newDeptMemberIds.delete(userKey);
        }
      });
      
      const selectedUsers = Array.from(newSelectedUsersMap.values());
      const selectedUserIds = Array.from(newSelectedUsersMap.keys());
      
      // 同步清理缓存，确保右侧列表及时更新
      prevState.computedCache.selectedUsersCache = null;
      prevState.computedCache._selectedUsersMapRef = null;
      
      // 跨Tab联动：根据最新的 selectedUsersMap 重建团队选择状态
      const { newTeamSelectedUserIdsMap, newTeamSelectedUsersMap, newSelectedTeamsSet } =
        this.syncTeamSelectionState(newSelectedUsersMap, prevState.teamList, prevState);

      // 更新兼容性数组
      const selectedDeparts = Array.from(newSelectedTeamsSet).map(teamId =>
        prevState.teamList.find(team => team.teamId === teamId) || { staffId: teamId }
      );
      const selectedDepartIds = Array.from(newSelectedTeamsSet);

      // 更新团队数据的isAll标志
      const updatedTeamList = prevState.teamList.map(team => {
        const isAll = newSelectedTeamsSet.has(team.teamId) ? 1 : 0;
        return { ...team, isAll };
      });

      return {
        selectedUsersMap: newSelectedUsersMap,
        selectedTeamsSet: newSelectedTeamsSet,
        teamSelectedUserIdsMap: newTeamSelectedUserIdsMap,
        teamSelectedUsersMap: newTeamSelectedUsersMap,
        selectedUsers,
        selectedUserIds,
        selectedDeparts,
        selectedDepartIds,
        defaultSelectedKeys: selectedUserIds,
        teamList: updatedTeamList,
        tabSelections: {
          ...prevState.tabSelections,
          '3': {
            ...prevDeptState,
            selectedMemberIds: newDeptMemberIds
          }
        }
      };
    }, () => {
      this.refreshTeamCheckboxCache();
      this.updateCheckboxStatus();
      this.notifyParentComponent();
      this.updateListKeys();
      this.syncMembersToDeptTab();
    });
  }

  // ==================== 虚拟滚动相关 ====================

  renderSelectedUserRow = ({ index, key, parent, style }) => {
    // 使用Map引用检测缓存是否过期
    if (!this.state.computedCache.selectedUsersCache || 
        this.state.computedCache._selectedUsersMapRef !== this.state.selectedUsersMap) {
      this.state.computedCache.selectedUsersCache = Array.from(this.state.selectedUsersMap.values())
        .filter(user => user.isUser);
      this.state.computedCache._selectedUsersMapRef = this.state.selectedUsersMap;
    }
    
    const selectedUsers = this.state.computedCache.selectedUsersCache;
    const user = selectedUsers[index];
    
    if (!user) return null;
    
    const userKey = user.__unique_key__ || `${user.staffId || user.userKey || user.id}_${index}`;

    return (
      <CellMeasurer
        key={userKey}
        parent={parent}
        index={index}
        cache={this.selectedUserCache}
      >
        <div
          className="selected-item"
          style={style}
        >
          <div className="selected-item-left">
            {user.userKey ? <UserTag userId={user.userKey} name={user.username || user.nameCn || ''} avatar={user.staffAvatarUrl || user.avatarUrl} /> : ""}
          </div>
          <Button
            size="small"
            type="text"
            icon={<CloseOutlined />}
            onClick={() => this.onDelSelectedClick(user, index, "user")}
          />
        </div>
      </CellMeasurer>
    );
  };

  // 渲染左侧列表
  renderVirtualRow = ({ index, key, parent, style }) => {
    const { treeData, activeTabKey, currentLevel, currentTeamId } = this.state;
    const item = treeData[index];
    
    if (!item) return null;

    const itemKey = item.unikey || `${item.staffId}_${index}`;
    
    // 渲染团队项目
    if (activeTabKey === '2' && currentLevel === 1) {
      const { checked, indeterminate } = this.getTeamCheckboxState(item);
      return (
        <CellMeasurer
          key={itemKey}
          parent={parent}
          index={index}
          cache={this.cache}
        >
          <div className="select-item" style={style}>
            <Checkbox
              value={item.staffId}
              disabled={this.state.isDisabledTreeData || item.disabled}
              checked={checked}
              indeterminate={indeterminate}
              onChange={(e) => this.onTeamCheckboxChange(item, e.target.checked)}
            >
              <Avatar
                size={20}
                src={item.staffAvatarUrl}
                icon={<UserOutlined />}
              />
              <span className="select-item-txt-2" title={item.username}>
                {item.username}
              </span>
              <span className="team-teamMemberVoList-num">({this.getTeamMemberDisplayCount(item)})</span>
            </Checkbox>
            <Button
              type="text"
              size="small"
              onClick={() => this.getTeamMembers(item.staffId, item.username, item?.teamMemberVoList)}
              style={{
                padding: '0 6px',
                fontSize: '12px',
                color: '#4247f6'
              }}
            >
              下级
            </Button>
          </div>
        </CellMeasurer>
      );
    }

    // 渲染成员项目（包括团队下级页面）
    // 检查选中状态：优先用staffId匹配，回退用userKey匹配（解决搜索结果ID不一致的问题），再回退用openId匹配
    const isChecked = 
      this.state.selectedUsersMap.has(item.staffId) || 
      (item.userKey && item.userKey !== item.staffId && this.state.selectedUsersMap.has(item.userKey)) ||
      (item.openId && this.state.selectedUsersMap.has(item.openId));

    // 获取 selectedUsersMap 中该成员的实际 key，确保 onCheck 操作使用一致的 ID
    const getRealUserKey = () => {
      if (this.state.selectedUsersMap.has(item.staffId)) return item.staffId;
      if (item.userKey && item.userKey !== item.staffId && this.state.selectedUsersMap.has(item.userKey)) return item.userKey;
      if (item.openId && this.state.selectedUsersMap.has(item.openId)) return item.openId;
      return item.staffId;
    };
    
    return (
      <CellMeasurer
        key={itemKey}
        parent={parent}
        index={index}
        cache={this.cache}
      >
        <div className="select-item" style={style}>
          <Checkbox
            value={item.staffId}
            disabled={this.state.isDisabledTreeData || item.disabled}
            checked={isChecked}
            onChange={(e) => {
              const realKey = getRealUserKey();
              const currentValues = Array.from(this.state.selectedUsersMap.keys());
              const newValue = e.target.checked
                ? [...currentValues, realKey]
                : currentValues.filter(id => id !== realKey);
              
              if (activeTabKey === '2' && currentLevel === 2 && currentTeamId) {
                const currentCheckedSet = new Set(currentValues);
                if (e.target.checked) {
                  currentCheckedSet.add(realKey);
                } else {
                  currentCheckedSet.delete(realKey);
                }
                this.onCheck(Array.from(currentCheckedSet));
              } else {
                this.onCheck(newValue);
              }
            }}
          >
            {item.userKey ? <UserTag userId={item.userKey} name={item.username} avatar={item.staffAvatarUrl} /> : ""}
          </Checkbox>
        </div>
      </CellMeasurer>
    );
  };

  updateListKeys = () => {
    // 仅清除CellMeasurer高度缓存和计算缓存，不改变List的key
    // 改变key会导致List组件卸载/重新挂载，丢失滚动位置
    this.cache.clearAll();
    this.selectedUserCache.clearAll();
    this.state.computedCache.selectedUsersCache = null;
    this.state.computedCache._selectedUsersMapRef = null;
    // 直接强制刷新可见行，而非通过key变化触发重新挂载
    if (this.listRef.current) this.listRef.current.forceUpdateGrid();
    if (this.selectedListRef.current) this.selectedListRef.current.forceUpdateGrid();
  };

  // ==================== API 方法 ====================

  /**
   * 加载部门树数据
   * 调用getDeptTreeData API获取完整的部门树数据，并传递给DepartmentTree组件
   */
  loadDeptTreeData = async () => {
    try {
      this.setState({ deptTreeLoading: true, deptTreeError: null });
      const res = await getDeptTreeData({ userKey: sessionStorage.getItem('jwtMeegoTeamworkUserId') || '' });
      const apiData = res?.data || [];
      this.setState({
        deptTreeData: apiData,
        deptTreeLoading: false,
      });
    } catch (error) {
      console.error('加载部门树数据失败:', error);
      this.setState({
        deptTreeData: [],
        deptTreeLoading: false,
        deptTreeError: error.message || '加载部门数据失败',
      });
    }
  };

  querySeatAllUserData = async () => {
    try {
      this.setState({ isSpinning: true });
      const teamParams = {
        teamName: '',
      };
      const res = await queryAuthAllUser();
      const teamRes = await queryAuthTeamList(teamParams);
      
      if (res?.result && res.data) {
        // 处理已选中的用户数据
        const processedSelectUsers = this.state.selectedUsers.map((item, idx) => {
          const staffAvatarUrl = item.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png';

          return {
            ...item,
            isUser: true,
            isLeaf: true,
            staffId: item.userKey,
            username: item.userName,
            staffAvatarUrl,
            __unique_key__: `${item.userKey}_${Date.now()}_${idx}`,
            icon: (
              <Avatar
                size={20}
                src={staffAvatarUrl}
                icon={<UserOutlined />}
              />
            )
          };
        });

        // 关键修复：根据已保存的成员数据初始化团队选择状态
        const teamList = teamRes?.data || [];
        const { selectedUsersMap, selectedTeamsSet } = this.state;
        
        // 初始化团队选择状态
        const { 
          teamSelectedUserIdsMap, 
          teamSelectedUsersMap, 
          selectedTeamsSet: updatedSelectedTeamsSet 
        } = this.initializeTeamSelectionState(teamList, selectedUsersMap, selectedTeamsSet);
        
        // 更新团队数据的isAll标志
        const updatedTeamList = teamList.map(team => {
          const isAll = updatedSelectedTeamsSet.has(team.teamId) ? 1 : 0;
          return { ...team, isAll };
        });
        
        const allSelectedUsers = [...processedSelectUsers];
        const allSelectedUserIds = allSelectedUsers.map(user => user.staffId);

        const selectedUsers = processedSelectUsers;
        const selectedUserIds = selectedUsers.map(user => user.staffId);
        const selectedDeparts = Array.from(updatedSelectedTeamsSet).map(teamId => 
          updatedTeamList.find(team => team.teamId === teamId) || { staffId: teamId }
        );
        const selectedDepartIds = Array.from(updatedSelectedTeamsSet);

        const updatedTabSelections = {
          '1': {
            selectedUserIds: selectedUserIds,
            selectedUsers: selectedUsers,
            checkAll: false,
            isIndeterminate: false
          },
          '2': {
            selectedUserIds: selectedDepartIds,
            selectedUsers: selectedDeparts,
            checkAll: false,
            isIndeterminate: false
          },
          '3': {
            ...(this.state.tabSelections['3'] || {}),
            selectedMemberIds: this.state.tabSelections['3']?.selectedMemberIds || new Set(),
            checkAll: false,
            isIndeterminate: false
          }
        };

        this.setState({
          userList: res?.data || [],
          teamList: updatedTeamList,
          teamSelectedUserIdsMap,
          teamSelectedUsersMap,
          selectedTeamsSet: updatedSelectedTeamsSet,
          selectedUsers: allSelectedUsers,
          selectedUserIds: allSelectedUserIds,
          selectedDeparts,
          selectedDepartIds,
          defaultSelectedKeys: allSelectedUserIds,
          tabSelections: updatedTabSelections,
          hasInitializedSelection: true
        }, () => {
          this.props.getSelectedUser({
            selectedDeparts: selectedDeparts,
            selectedUsers: selectedUsers,
            selectedDepartIds: selectedDepartIds,
            selectedUserIds: selectedUserIds,
            checkedKeys: []
          });
          this.processedUserData();
        });

        return Promise.resolve();
      } else {
        this.setState({ isSpinning: false, showAlert: true });
        return Promise.resolve();
      }
    } catch (error) {
      console.error('获取初始数据失败:', error);
      this.setState({ isSpinning: false });
      return Promise.reject(error);
    }
  }

  // ==================== 渲染方法 ====================

  render() {
    const { 
      activeTabKey, 
      breadcrumbItems, 
      treeData, 
      tabSelections,
      isSpinning,
      searchKey,
      selectedUsersMap,
      selectedTeamsSet
    } = this.state;

    const currentTabSelection = tabSelections[activeTabKey];
    const selectedUsersCount = Array.from(selectedUsersMap.values()).filter(u => !u._isAlias).length;
    
    const hasSelections = selectedUsersCount > 0 || selectedTeamsSet.size > 0;

    // 根据 tenantModeInfo.install 字段动态控制部门Tab显示
    const tenantModeInfo = JSON.parse(sessionStorage.getItem('tenantModeInfo') || '{}');
    const showDeptTab = tenantModeInfo.install === true;

    const tabItems = [
      { key: '1', label: '成员' },
      { key: '2', label: '团队' },
      ...(showDeptTab ? [{ key: '3', label: '组织架构' }] : [])
    ];

    return (
      <div className="selected-setting-warp standards-setting">
        <div style={{ color: '#666'}}>
          可通过成员或团队维度选择人员。注意：若选中的成员已属于其他规范，保存后将自动从原规范移入当前规范。若删除已选中的成员，保存后将会自动移入到默认规范。
        </div>
        <div className="selected-seat-content">
          <div className="selected-user-left">
            <div className="select-input">
              <Input
                placeholder="请输入关键词"
                value={activeTabKey === '3' ? this.state.deptSearchKey : searchKey}
                suffix={
                  <SearchOutlined 
                    style={{ color: "#BBBBBB", cursor: 'pointer' }} 
                    onClick={() => {
                      if (activeTabKey === '3') {
                        this.setState({ isDeptSearching: !!this.state.deptSearchKey });
                      } else {
                        this.handleSearchChange({ target: { value: searchKey } });
                      }
                    }}
                  />
                }
                onChange={(e) => {
                  if (activeTabKey === '3') {
                    this.setState({ 
                      deptSearchKey: e.target.value,
                      isDeptSearching: !!e.target.value
                    });
                  } else {
                    this.setState({ searchKey: e.target.value });
                    this.handleSearchChange(e);
                  }
                }}
              />
            </div>
            <div className="select-tabs">
              <Tabs
                activeKey={activeTabKey}
                items={tabItems}
                onChange={this.onChange}
                inkBarStyle={{
                  backgroundColor: '#1890ff',
                  height: 3,
                  borderRadius: 2,
                }}
              />

              {activeTabKey === '2' && this.state.currentLevel === 2 && (
                <div className="team-breadcrumb" style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Breadcrumb
                    items={breadcrumbItems.map((item, index) => ({
                      title: index === breadcrumbItems.length - 1 ? (
                        <span style={{ color: '#333', fontWeight: '500' }}>{item.title}</span>
                      ) : (
                        <a
                          onClick={() => this.handleBreadcrumbClick(item)}
                          style={{ color: '#4247f6', cursor: 'pointer' }}
                        >
                          {item.title}
                        </a>
                      )
                    }))}
                    separator=">"
                  />
                </div>
              )}
            </div>

            <Spin spinning={isSpinning} tip="数据加载中...">
              {activeTabKey === '3' ? (
                <div className="select-content" style={{ height: '330px', overflow: 'hidden', paddingLeft: '0px' }}>
                  <DepartmentTree
                    deptTreeData={this.state.deptTreeData}
                    deptTreeLoading={this.state.deptTreeLoading}
                    selectedMemberIds={this.state.tabSelections['3']?.selectedMemberIds || new Set()}
                    onMemberCheck={this.handleDeptMemberCheck}
                    onSelectAllMembers={this.handleDeptSelectAllMembers}
                    searchKey={this.state.deptSearchKey}
                    isSearching={this.state.isDeptSearching}
                    disabled={this.state.isDisabledTreeData}
                  />
                </div>
              ) : (
              <div className="select-content" style={{ height: '330px', overflow: 'hidden', paddingLeft: '10px' }}>
                {treeData?.length > 0 && !this.state.isDisabledTreeData && (
                  <div className="select-item select-all-item" style={{ marginTop: '6px', marginBottom: '0px' }}>
                    <Checkbox
                      indeterminate={currentTabSelection.isIndeterminate}
                      checked={currentTabSelection.checkAll}
                      onChange={this.onCheckAll}
                    >
                      全选
                    </Checkbox>
                  </div>
                )}

                <div style={{ height: treeData?.length > 0 && !this.state.isDisabledTreeData ? 'calc(100% - 40px)' : '100%' }}>
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        ref={this.listRef}
                        key={`left-list-${activeTabKey}-${this.state.currentLevel}`}
                        width={width}
                        height={height}
                        rowCount={treeData.length}
                        rowHeight={40}
                        rowRenderer={this.renderVirtualRow}
                        deferredMeasurementCache={this.cache}
                        overscanRowCount={5}
                        noRowsRenderer={() => (
                          <div className="empty-data">
                            <Empty
                              image={require("../../../../../../image/no-data-table.png")}
                              styles={{
                                image: {
                                  height: 90,
                                  width: 90,
                                  margin: "auto",
                                  marginBottom: 10,
                                },
                              }}
                              description={
                                <span style={{ color: "#727272", fontSize: "12px" }}>
                                  暂无数据
                                </span>
                              }
                            />
                          </div>
                        )}
                      />
                    )}
                  </AutoSizer>
                </div>
              </div>
              )}
            </Spin>
          </div>

          {/* 右侧选中区域 */}
          <div className="selected-user-right selected-seat-right">
            <div className="selected-title" style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 14 }}>
              {hasSelections ? (
                <>
                  <p>
                    <span>已选{selectedUsersCount}人</span>
                  </p>
                  <p onClick={this.onClearAll} style={{ cursor: 'pointer', color: '#4247f6' }}>清空</p>
                </>
              ) : null}
            </div>
            <div className="selected-content" style={{ height: '100%', overflow: 'hidden' }}>
              <AutoSizer>
                {({ height, width }) => {
                  // 使用Map引用检测缓存是否过期，确保状态变更后及时重新计算
                  if (!this.state.computedCache.selectedUsersCache || 
                      this.state.computedCache._selectedUsersMapRef !== selectedUsersMap) {
                    this.state.computedCache.selectedUsersCache = Array.from(selectedUsersMap.values())
                      .filter(user => user.isUser && !user._isAlias);
                    this.state.computedCache._selectedUsersMapRef = selectedUsersMap;
                  }
                  const selectedUsers = this.state.computedCache.selectedUsersCache;
                  
                  return (
                    <List
                      ref={this.selectedListRef}
                      key="right-list"
                      width={width}
                      height={height}
                      rowCount={selectedUsers.length}
                      rowHeight={40}
                      rowRenderer={this.renderSelectedUserRow}
                      deferredMeasurementCache={this.selectedUserCache}
                      overscanRowCount={5}
                      noRowsRenderer={() => (
                        <div className="empty-data" style={{ padding: '28px 0 0' }}>
                          <Empty
                            image={require("../../../../../../image/no-data-table.png")}
                            styles={{
                              image: {
                                height: 90,
                                width: 90,
                                margin: "auto",
                                marginBottom: 10,
                              },
                            }}
                            description={
                              <span style={{ color: "#727272", fontSize: "12px" }}>
                                暂无数据
                              </span>
                            }
                          />
                        </div>
                      )}
                    />
                  );
                }}
              </AutoSizer>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default TeamSettings;
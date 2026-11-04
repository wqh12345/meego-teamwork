import React, { Component } from "react";
import { Button, Avatar, Input, Checkbox, Spin, Empty, Tabs, Breadcrumb, Alert, message, Tooltip } from "antd";
import { SearchOutlined, CloseOutlined, UserOutlined, CaretRightOutlined, CaretDownOutlined, InfoCircleFilled } from "@ant-design/icons";
import { debounce } from "../../../../util/util";
import {
  postSearchMember,
  querySeatAllUser,
  getDeptTreeData
} from "../../../../api/api";
import "./seatSettings.css";
import { UserTag } from '@lark-project/ui-kit-plugin';
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import 'react-virtualized/styles.css';
import DepartmentTree from '../department-tree/DepartmentTree';

// 常量定义
const TAB_KEYS = {
  MEMBER: '1',
  TEAM: '2',
  DEPT: '3'
};

const DEFAULT_AVATAR = 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png';

// 缓存测量器
const leftCache = new CellMeasurerCache({
  fixedWidth: true,
  defaultHeight: 40,
  minHeight: 40
});

const rightCache = new CellMeasurerCache({
  fixedWidth: true,
  defaultHeight: 40,
  minHeight: 40
});

class TeamSettings extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      // UI状态
      activeTabKey: TAB_KEYS.MEMBER,
      searchKey: "",
      isSpinning: false,
      isSearching: false,
      currentLevel: 1,
      currentTeamId: null,
      teamName: "",
      breadcrumbItems: [{ title: '全部团队', id: null }],
      expandedTeams: new Set(),
      showAlert: true,

      // 数据缓存
      treeData: [],
      allMembers: [],
      allTeams: [],
      teamMembersMap: new Map(),
      
      // 选择状态
      selectedMemberIds: new Set(),
      selectedTeamIds: new Set(),
      teamSelectedMemberIds: new Map(),
      
      // 部门Tab状态
      deptTreeData: null,
      deptTreeLoading: false,
      selectedDeptMemberIds: new Set(),  // 部门Tab中已选成员的userKey集合（与成员Tab统一）
      deptSearchKey: '',
      isDeptSearching: false,
      
      // 缓存的计算结果
      uniqueSelectedCount: 0,
      lastSeatTotal: 0,

      // 席位数据
      seatCount: { used: 2, residue: 2, total: 2 },

      // 搜索相关
      searchResults: [],
      isSearchingActive: false,
      
      // 虚拟列表配置
      leftListHeight: 330,
      rightListHeight: 350,
      rowHeight: 40,
      overscanRowCount: 20,
      
      // 滚动位置缓存
      leftScrollTop: 0,
      rightScrollTop: 0,
      
      // 右侧选中数据
      rightSelectedData: [],
      
      // 成员添加顺序（用于右侧列表排序：先添加的排在前面）
      memberOrderMap: new Map(),  // userKey -> 添加顺序序号（越小越靠前）
      
      // 全选状态缓存
      checkAllState: { checked: false, indeterminate: false }
    };

    // 绑定方法
    this.handleSearchChange = debounce(this.handleSearch, 300).bind(this);
    this.updateSelectedCount = this.updateSelectedCount.bind(this);
    this.leftListRef = React.createRef();
    this.rightListRef = React.createRef();
    this.leftCache = leftCache;
    this.rightCache = rightCache;
    
    // 成员添加顺序计数器
    this.memberOrderCounter = 0;
  }

  componentDidMount() {
    this.initData();
    let tenantModeInfo = null;
    try {
      const raw = sessionStorage.getItem('tenantModeInfo');
      if (raw) tenantModeInfo = JSON.parse(raw);
    } catch (_) {}
    if (tenantModeInfo?.install) {
      this.loadDeptTreeData();
    }
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
    this.leftCache.clearAll();
    this.rightCache.clearAll();
  }

  componentDidUpdate(prevProps, prevState) {
    // 左侧数据变化时重新计算缓存
    if (prevState.treeData !== this.state.treeData) {
      this.leftCache.clearAll();
      this.scheduleGridUpdate('left');
    }

    // 更新统计和全选状态
    if (prevState.selectedMemberIds !== this.state.selectedMemberIds ||
        prevState.selectedTeamIds !== this.state.selectedTeamIds ||
        prevState.teamSelectedMemberIds !== this.state.teamSelectedMemberIds) {
      this.updateSelectedCount();
      this.updateCheckAllState();
    }
  }

  // 调度网格更新
  scheduleGridUpdate = (side) => {
    requestAnimationFrame(() => {
      if (side === 'left' && this.leftListRef.current) {
        this.leftListRef.current.recomputeRowHeights();
        this.leftListRef.current.forceUpdateGrid();
      } else if (side === 'right' && this.rightListRef.current) {
        this.rightListRef.current.recomputeRowHeights();
        this.rightListRef.current.forceUpdateGrid();
      }
    });
  };

  // 强制更新列表
  forceUpdateGrid = (side) => {
    if (side === 'left' && this.leftListRef.current) {
      this.leftListRef.current.forceUpdateGrid();
    } else if (side === 'right' && this.rightListRef.current) {
      this.rightListRef.current.forceUpdateGrid();
    }
  };

  // 处理窗口大小变化
  handleResize = () => {
    this.forceUpdateGrid('left');
    this.forceUpdateGrid('right');
  };

  // 刷新右侧数据
  refreshRightData = () => {
    const newRightData = this.updateRightSelectedData();
    if (JSON.stringify(newRightData) !== JSON.stringify(this.state.rightSelectedData)) {
      this.setState({ rightSelectedData: newRightData }, () => {
        this.rightCache.clearAll();
        if (this.rightListRef.current) {
          this.rightListRef.current.forceUpdateGrid();
        }
      });
    }
  };

  // 初始化数据
  initData = async () => {
    try {
      this.setState({ isSpinning: true });
      const res = await querySeatAllUser();
      if (res?.result && res.data) {
        const { selectUserList = [], selectTeamList = [], seatNumVo, userList = [], teamList = [] } = res.data;
        
        this.setState({ seatCount: { ...seatNumVo }, showAlert: true });

        // 按sort字段升序排序selectUserList
        const sortedSelectUserList = [...selectUserList].sort((a, b) => {
          const sortA = a.sort || 0;
          const sortB = b.sort || 0;
          return sortA - sortB;
        });

        const processedSelectUsers = sortedSelectUserList.map(item => {
          const staffAvatarUrl = item.avatarUrl || DEFAULT_AVATAR;
          return {
            ...item,
            isUser: true,
            isLeaf: true,
            staffId: item.userKey,
            username: item.userName,
            staffAvatarUrl,
            icon: (
              <Avatar
                size={20}
                src={staffAvatarUrl}
                icon={<UserOutlined />}
              />
            )
          };
        });

        const teamMembersMapData = new Map();
        if (res?.data?.teamList) {
          res.data.teamList.forEach(team => {
            teamMembersMapData.set(team.teamId, team.teamMemberVoList || []);
          });
        }

        const selectedMemberIds = new Set();
        const selectedTeamIds = new Set();
        const teamSelectedMemberIds = new Map();

        // 1. 先处理已选中的成员（来自成员标签页）
        if (processedSelectUsers && processedSelectUsers.length > 0) {
          processedSelectUsers.forEach(user => {
            selectedMemberIds.add(user.staffId);
          });
        }

        const processedSelectTeams = selectTeamList.map(item => {
          return {
            ...item,
            isUser: false,
            isLeaf: true,
            staffId: item.teamId,
            username: item.teamName,
            staffAvatarUrl: DEFAULT_AVATAR,
            icon: (
              <Avatar
                size={20}
                src={DEFAULT_AVATAR}
                icon={<UserOutlined />}
              />
            )
          };
        });

        // 2. 处理已选中的团队
        if (processedSelectTeams && processedSelectTeams.length > 0) {
          processedSelectTeams.forEach(team => {
            selectedTeamIds.add(team.teamId);
            const teamMembers = teamMembersMapData.get(team.teamId) || [];
            const teamSelected = new Set(teamMembers.map(m => m.userKey));
            teamSelectedMemberIds.set(team.teamId, teamSelected);
          });
        }

        // 3. 根据已选中的成员，同步更新所有团队的选中状态（确保切换标签页时人数正确显示）
        userList.forEach(member => {
          if (selectedMemberIds.has(member.userKey)) {
            // 找到该成员所属的所有团队
            teamMembersMapData.forEach((members, teamId) => {
              const isInTeam = members.some(m => m.userKey === member.userKey);
              if (isInTeam) {
                if (!teamSelectedMemberIds.has(teamId)) {
                  teamSelectedMemberIds.set(teamId, new Set());
                }
                teamSelectedMemberIds.get(teamId).add(member.userKey);
              }
            });
          }
        });

        const treeData = this.getCurrentTreeData(
          TAB_KEYS.MEMBER,
          userList,
          teamList,
          1,
          null,
          teamMembersMapData
        );

        this.setState({
          teamMembersMap: teamMembersMapData,
          allMembers: userList,
          allTeams: teamList,
          selectedMemberIds,
          selectedTeamIds,
          teamSelectedMemberIds,
          treeData,
          isSpinning: false,
        }, () => {
          this.refreshRightData();
          this.updateSelectedCount();
          this.updateCheckAllState();
          this.notifyParent();
          this.syncMembersToDeptTab();
        });

        return Promise.resolve();
      } else {
        this.setState({ isSpinning: false, showAlert: true });
        return Promise.resolve();
      }
    } catch (error) {
      console.error('获取初始数据失败:', error);
      this.setState({ isSpinning: false });
      message.error('初始化数据失败');
      return Promise.reject(error);
    }
  };

  // ==================== 部门Tab数据加载 ====================
  loadDeptTreeData = async () => {
    try {
      this.setState({ deptTreeLoading: true });
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
      });
    }
  };

  // ==================== 部门Tab选中状态同步 ====================

  /**
   * 同步成员Tab/团队Tab的选中状态到部门Tab
   * 统一使用 userKey 作为标识符
   */
  syncMembersToDeptTab = () => {
    const { selectedMemberIds } = this.state;
    // 直接使用 selectedMemberIds（已使用userKey）同步到部门Tab
    this.setState({ selectedDeptMemberIds: selectedMemberIds });
  };

  /**
   * 部门Tab中勾选/取消单个成员
   * 统一使用 userKey 作为标识符
   */
  handleDeptMemberCheck = (userKey, checked, memberItem) => {
    this.setState(prevState => {
      const newDeptMemberIds = new Set(prevState.selectedDeptMemberIds);
      const newSelectedMemberIds = new Set(prevState.selectedMemberIds);
      const newMemberOrderMap = new Map(prevState.memberOrderMap);
      let newAllMembers = prevState.allMembers;
      
      if (checked) {
        newDeptMemberIds.add(userKey);
        newSelectedMemberIds.add(userKey);
        // 记录成员添加顺序（如果尚未记录）
        if (!newMemberOrderMap.has(userKey)) {
          newMemberOrderMap.set(userKey, ++this.memberOrderCounter);
        }
        // 如果该成员不在 allMembers 中（来自 org/tree 而非席位列表），动态添加以支持右侧列表展示
        if (!prevState.allMembers.some(m => m.userKey === userKey) && memberItem) {
          newAllMembers = [...prevState.allMembers, {
            userKey: userKey,
            userName: memberItem.staffName || '',
            avatarUrl: memberItem.staffAvatarUrl || '',
          }];
        }
      } else {
        newDeptMemberIds.delete(userKey);
        newSelectedMemberIds.delete(userKey);
        // 删除时不移除 memberOrderMap，保持顺序一致性
      }
      
      // 同步更新团队内成员选择状态
      const newTeamSelected = this.rebuildTeamSelectedMemberIds(newSelectedMemberIds, prevState);
      
      return {
        selectedDeptMemberIds: newDeptMemberIds,
        selectedMemberIds: newSelectedMemberIds,
        teamSelectedMemberIds: newTeamSelected,
        memberOrderMap: newMemberOrderMap,
        allMembers: newAllMembers,
      };
    }, () => {
      this.refreshRightData();
      this.updateSelectedCount();
      this.updateCheckAllState();
      this.notifyParent();
    });
  };

  /**
   * 部门Tab中全选/取消某部门下所有员工
   * 统一使用 userKey 作为标识符
   */
  handleDeptSelectAllMembers = (deptId, members, checked) => {
    this.setState(prevState => {
      const newDeptMemberIds = new Set(prevState.selectedDeptMemberIds);
      const newSelectedMemberIds = new Set(prevState.selectedMemberIds);
      const newMemberOrderMap = new Map(prevState.memberOrderMap);
      let newAllMembers = prevState.allMembers;
      
      members.forEach(member => {
        // 统一使用 userKey 作为标识符
        const userKey = member.staffUserKey || member.staffId;
        if (checked) {
          newDeptMemberIds.add(userKey);
          newSelectedMemberIds.add(userKey);
          // 记录成员添加顺序（如果尚未记录）
          if (!newMemberOrderMap.has(userKey)) {
            newMemberOrderMap.set(userKey, ++this.memberOrderCounter);
          }
          // 如果该成员不在 allMembers 中（来自 org/tree 而非席位列表），动态添加以支持右侧列表展示
          if (!newAllMembers.some(m => m.userKey === userKey)) {
            newAllMembers = [...newAllMembers, {
              userKey: userKey,
              userName: member.staffName || '',
              avatarUrl: member.staffAvatarUrl || '',
            }];
          }
        } else {
          newDeptMemberIds.delete(userKey);
          newSelectedMemberIds.delete(userKey);
          // 删除时不移除 memberOrderMap，保持顺序一致性
        }
      });
      
      const newTeamSelected = this.rebuildTeamSelectedMemberIds(newSelectedMemberIds, prevState);
      
      return {
        selectedDeptMemberIds: newDeptMemberIds,
        selectedMemberIds: newSelectedMemberIds,
        teamSelectedMemberIds: newTeamSelected,
        memberOrderMap: newMemberOrderMap,
        allMembers: newAllMembers,
      };
    }, () => {
      this.refreshRightData();
      this.updateSelectedCount();
      this.updateCheckAllState();
      this.notifyParent();
    });
  };

  /**
   * 根据selectedMemberIds重建teamSelectedMemberIds
   */
  rebuildTeamSelectedMemberIds = (selectedMemberIds, prevState) => {
    const newTeamSelected = new Map();
    prevState.allTeams.forEach(team => {
      const teamMembers = prevState.teamMembersMap.get(team.teamId) || [];
      const teamSelected = new Set();
      teamMembers.forEach(member => {
        if (selectedMemberIds.has(member.userKey)) {
          teamSelected.add(member.userKey);
        }
      });
      if (teamSelected.size > 0) {
        newTeamSelected.set(team.teamId, teamSelected);
      }
    });
    return newTeamSelected;
  };

  // 更新右侧选中数据（仅计算，不触发 setState）
  updateRightSelectedData = () => {
    const { allMembers, allTeams, selectedMemberIds, selectedTeamIds, memberOrderMap } = this.state;
    
    // 所有选中的团队
    const selectedTeams = allTeams.filter(t => selectedTeamIds.has(t.teamId));
    
    // 优化点1：不再排除属于已选团队的成员，所有选中的成员都作为独立项展示
    const selectedUsers = allMembers.filter(m => selectedMemberIds.has(m.userKey));
    
    // 根据 memberOrderMap 排序：先添加的排在前面
    const sortedSelectedUsers = [...selectedUsers].sort((a, b) => {
      const orderA = memberOrderMap.get(a.userKey) ?? Infinity;
      const orderB = memberOrderMap.get(b.userKey) ?? Infinity;
      return orderA - orderB;
    });
    
    // 保持顺序：成员在前，团队在后
    return [...sortedSelectedUsers, ...selectedTeams];
  };

  // 更新全选状态
  updateCheckAllState = () => {
    const { treeData, activeTabKey, currentLevel, currentTeamId } = this.state;
    
    // 部门Tab不使用全选复选框（DepartmentTree组件内部有“全选以下员工”）
    if (activeTabKey === TAB_KEYS.DEPT) {
      this.setState({ checkAllState: { checked: false, indeterminate: false } });
      return;
    }
    
    if (!treeData.length) {
      this.setState({ checkAllState: { checked: false, indeterminate: false } });
      return;
    }

    let checkedCount = 0;
    const total = treeData.length;

    if (activeTabKey === TAB_KEYS.MEMBER) {
      treeData.forEach(item => {
        if (this.state.selectedMemberIds.has(item.userKey)) checkedCount++;
      });
    } else if (currentLevel === 2 && currentTeamId) {
      // 团队下级页面：根据 teamSelectedMemberIds 和 selectedMemberIds 判断选中状态
      const teamSelected = this.state.teamSelectedMemberIds.get(currentTeamId);
      treeData.forEach(item => {
        if (teamSelected?.has(item.userKey) || this.state.selectedMemberIds.has(item.userKey)) {
          checkedCount++;
        }
      });
    } else {
      treeData.forEach(item => {
        if (this.state.selectedTeamIds.has(item.teamId)) checkedCount++;
      });
    }

    this.setState({
      checkAllState: {
        checked: checkedCount === total,
        indeterminate: checkedCount > 0 && checkedCount < total
      }
    });
  };

  // 获取当前应该显示的数据
  getCurrentTreeData = (tabKey, allMembers, allTeams, currentLevel, currentTeamId, teamMembersMap) => {
    if (tabKey === TAB_KEYS.MEMBER) {
      return allMembers;
    }
    
    if (currentLevel === 2 && currentTeamId) {
      return teamMembersMap.get(currentTeamId) || [];
    }
    
    return allTeams;
  };

  // 获取团队选择状态
  getTeamSelectStatus = (teamId) => {
    // 只有用户手动全选团队时，才返回 'all'
    if (this.state.selectedTeamIds?.has(teamId)) return 'all';
    
    // 其他情况：根据团队内成员选中数量判断
    // 需要考虑两个来源：
    // 1. teamSelectedMemberIds 中记录的团队内选中成员
    // 2. selectedMemberIds 中单独选中的属于该团队的成员
    const teamSelected = this.state.teamSelectedMemberIds?.get(teamId);
    const teamMembers = this.state.teamMembersMap?.get(teamId) || [];
    
    // 计算该团队中实际被选中的成员数量
    let selectedCount = 0;
    teamMembers.forEach(member => {
      // 如果在 teamSelectedMemberIds 中有记录
      if (teamSelected?.has(member.userKey)) {
        selectedCount++;
      } 
      // 或者在 selectedMemberIds 中单独选中
      else if (this.state.selectedMemberIds?.has(member.userKey)) {
        selectedCount++;
      }
    });
    
    if (selectedCount > 0) {
      return 'partial';
    }
    return 'none';
  };

  // 检查项目是否选中
  isItemChecked = (item) => {
    const { activeTabKey, currentLevel, currentTeamId } = this.state;
    
    if (activeTabKey === TAB_KEYS.MEMBER) {
      return this.state.selectedMemberIds.has(item.userKey);
    }
    
    if (currentLevel === 2 && currentTeamId) {
      // 团队下级页面：检查成员是否被选中
      // 需要考虑两个来源：
      // 1. teamSelectedMemberIds 中记录的团队内选中成员
      // 2. selectedMemberIds 中单独选中的成员
      const teamSelected = this.state.teamSelectedMemberIds.get(currentTeamId);
      return (teamSelected?.has(item.userKey) || this.state.selectedMemberIds.has(item.userKey)) || false;
    }
    
    return this.state.selectedTeamIds.has(item.teamId);
  };

  // 搜索处理
  handleSearch = async () => {
    const { searchKey, activeTabKey, currentLevel, currentTeamId, allMembers, allTeams, teamMembersMap } = this.state;
    
    // 部门Tab搜索：将搜索关键词传递给DepartmentTree组件
    if (activeTabKey === TAB_KEYS.DEPT) {
      console.log(TAB_KEYS.DEPT, searchKey.trim());
      console.log('搜索关键词:', searchKey.trim());
      this.setState({
        deptSearchKey: searchKey.trim(),
        isDeptSearching: !!searchKey.trim()
      });
      return;
    }
    
    if (!searchKey.trim()) {
      this.leftCache.clearAll();
      this.setState({
        treeData: this.getCurrentTreeData(
          activeTabKey,
          allMembers,
          allTeams,
          currentLevel,
          currentTeamId,
          teamMembersMap
        ),
        isSearchingActive: false,
        isSearching: false,
        leftScrollTop: 0
      }, () => {
        this.scheduleGridUpdate('left');
        this.updateCheckAllState();
      });
      return;
    }

    try {
      this.setState({ isSpinning: true, isSearching: true });
      
      let res;
      const data = { query: searchKey.trim() };
      
      if (activeTabKey === TAB_KEYS.MEMBER) {
        res = await postSearchMember(data);
      } else if (activeTabKey === TAB_KEYS.TEAM) {
        if (currentLevel === 2 && currentTeamId) {
          res = await postSearchMember(data);
        } else {
          res = await querySeatAllUser({ teamName: data.query });
        }
      }
      
      if (res?.result) {
        let searchList = [];
        if (activeTabKey === '2' && currentLevel === 1) {
          searchList = res?.data?.teamList || [];
        } else {
          searchList = res.data;
        }
        
        const processedData = searchList.map(item => {
          const staffAvatarUrl = activeTabKey === TAB_KEYS.TEAM && currentLevel === 1
            ? DEFAULT_AVATAR
            : (item.staffAvatarUrl || DEFAULT_AVATAR);

          const staffId = activeTabKey === TAB_KEYS.MEMBER || (activeTabKey === TAB_KEYS.TEAM && currentLevel === 2) 
            ? item.staffUserKey 
            : item.teamId;
          const username = activeTabKey === TAB_KEYS.MEMBER || (activeTabKey === TAB_KEYS.TEAM && currentLevel === 2) 
            ? item.staffName 
            : item.teamName;
          const isUser = activeTabKey === TAB_KEYS.MEMBER || (activeTabKey === TAB_KEYS.TEAM && currentLevel === 2);
          
          const isTeamInSelected = !isUser && activeTabKey === TAB_KEYS.TEAM && this.state.selectedTeamIds.has(staffId);

          return {
            ...item,
            isUser,
            isLeaf: true,
            staffId,
            userName: username,
            username,
            userKey: item.staffUserKey || item.userKey,
            teamId: item.teamId,
            avatarUrl: staffAvatarUrl,
            staffAvatarUrl,
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

        this.leftCache.clearAll();
        
        this.setState({
          treeData: processedData,
          isSpinning: false,
          isSearching: false,
          leftScrollTop: 0
        }, () => {
          this.scheduleGridUpdate('left');
          this.updateCheckAllState();
        });
      } else {
        this.setState({ isSpinning: false });
        message.warning('搜索无结果');
      }
    } catch (error) {
      console.error('搜索失败:', error);
      this.setState({ isSpinning: false });
      message.error('搜索失败，请重试');
    }
  };

  // 处理选择变化
  handleCheckChange = (checkedValues) => {
    const { activeTabKey, currentLevel, currentTeamId } = this.state;
    const checkedSet = new Set(checkedValues);

    this.setState(prevState => {
      const updates = {};

      if (activeTabKey === TAB_KEYS.MEMBER) {
        // 成员标签页：更新独立成员选中状态
        updates.selectedMemberIds = checkedSet;
        
        // 记录新选中的成员的添加顺序
        const newMemberOrderMap = new Map(prevState.memberOrderMap);
        checkedSet.forEach(userKey => {
          if (!newMemberOrderMap.has(userKey)) {
            newMemberOrderMap.set(userKey, ++this.memberOrderCounter);
          }
        });
        updates.memberOrderMap = newMemberOrderMap;
        
        // 同步更新团队内成员选择（根据独立成员状态重新计算每个团队中哪些成员被选中）
        const newTeamSelected = new Map();
        prevState.allTeams.forEach(team => {
          const teamMembers = prevState.teamMembersMap.get(team.teamId) || [];
          const teamSelected = new Set();
          teamMembers.forEach(member => {
            if (checkedSet.has(member.userKey)) {
              teamSelected.add(member.userKey);
            }
          });
          if (teamSelected.size > 0) {
            newTeamSelected.set(team.teamId, teamSelected);
          }
        });
        updates.teamSelectedMemberIds = newTeamSelected;

      } else if (currentLevel === 2 && currentTeamId) {
        // 团队下级页面：更新该团队的成员选中状态
        // 1. 先获取当前团队的所有成员
        const currentTeamMembers = prevState.teamMembersMap.get(currentTeamId) || [];
        const currentTeamMemberIds = new Set(currentTeamMembers.map(m => m.userKey));
        
        // 2. 从现有选中成员中移除当前团队的所有成员（准备重新添加）
        const newSelectedMembers = new Set(prevState.selectedMemberIds);
        currentTeamMemberIds.forEach(id => newSelectedMembers.delete(id));
        
        // 3. 添加当前团队中选中的成员
        checkedSet.forEach(id => newSelectedMembers.add(id));
        updates.selectedMemberIds = newSelectedMembers;
        
        // 4. 同步更新所有团队内成员选择（根据更新后的独立成员状态重新计算）
        const newTeamSelected = new Map();
        prevState.allTeams.forEach(team => {
          const teamMembers = prevState.teamMembersMap.get(team.teamId) || [];
          const teamSelected = new Set();
          teamMembers.forEach(member => {
            if (newSelectedMembers.has(member.userKey)) {
              teamSelected.add(member.userKey);
            }
          });
          if (teamSelected.size > 0) {
            newTeamSelected.set(team.teamId, teamSelected);
          }
        });
        updates.teamSelectedMemberIds = newTeamSelected;

      } else {
        // 团队一级页面：更新团队选中状态
        updates.selectedTeamIds = checkedSet;
        
        const newTeamSelected = new Map(prevState.teamSelectedMemberIds);
        
        // 为新选中的团队添加所有成员到团队内选中状态
        checkedSet.forEach(teamId => {
          if (!prevState.selectedTeamIds.has(teamId)) {
            const members = prevState.teamMembersMap.get(teamId) || [];
            newTeamSelected.set(teamId, new Set(members.map(m => m.userKey)));
          }
        });

        // 移除未选中团队的成员状态
        prevState.selectedTeamIds.forEach(teamId => {
          if (!checkedSet.has(teamId)) {
            newTeamSelected.delete(teamId);
          }
        });

        updates.teamSelectedMemberIds = newTeamSelected;
        // 独立成员保持不变（团队全选时，不自动将成员添加到独立成员集合，仅标记团队内成员）
        updates.selectedMemberIds = prevState.selectedMemberIds;
      }

      return updates;
    }, () => {
      // 立即更新右侧数据、全选状态、人数统计和父组件
      this.refreshRightData();
      this.updateCheckAllState();
      this.updateSelectedCount();
      this.notifyParent();
      this.syncMembersToDeptTab();
    });
  };

  // 全选/全不选
  handleCheckAll = (e) => {
    const { checked } = e.target;
    const { treeData } = this.state;
    
    this.handleCheckChange(
      checked ? treeData.map(item => item.userKey || item.teamId) : []
    );
  };

  // 删除选中项
  handleDeleteSelected = (item, type) => {
    const id = type === 'user' ? item.userKey : item.teamId;

    this.setState(prevState => {
      const updates = {};

      if (type === 'user') {
        // 删除独立成员
        const newSelectedMembers = new Set(prevState.selectedMemberIds);
        newSelectedMembers.delete(id);
        updates.selectedMemberIds = newSelectedMembers;

        // 从所有团队的 teamSelectedMemberIds 中移除该成员
        const newTeamSelected = new Map();
        prevState.teamSelectedMemberIds.forEach((members, tid) => {
          const newMembers = new Set(members);
          newMembers.delete(id);
          if (newMembers.size > 0) {
            newTeamSelected.set(tid, newMembers);
          }
        });
        updates.teamSelectedMemberIds = newTeamSelected;

      } else {
        // 删除团队
        updates.selectedTeamIds = new Set(
          Array.from(prevState.selectedTeamIds).filter(tid => tid !== id)
        );
        
        const teamMembers = prevState.teamMembersMap.get(id) || [];
        const newTeamSelected = new Map(prevState.teamSelectedMemberIds);
        newTeamSelected.delete(id);
        
        // 保留该团队中在独立成员中存在的成员（这些成员可能同时属于其他团队）
        const newSelectedMembers = new Set(prevState.selectedMemberIds);
        teamMembers.forEach(member => {
          const inOtherTeam = Array.from(newTeamSelected.values()).some(set => 
            set.has(member.userKey)
          );
          if (!inOtherTeam) {
            // 如果成员不在其他任何团队中，则从独立成员中移除（因为删除团队后，该成员不再属于任何已选团队）
            // 但根据优化点2，即使团队被删除，该成员如果之前是独立选中的，应该保留？需要确认逻辑
            // 假设删除团队时，只移除团队本身，团队内的成员如果之前是独立选中的，应继续保留在独立成员中。
            // 当前逻辑：从独立成员中移除那些只属于该团队且不在其他团队中的成员。
            // 如果成员在其他团队中也被选中，则保留。这符合预期。
            newSelectedMembers.delete(member.userKey);
          }
        });
        
        updates.selectedMemberIds = newSelectedMembers;
        updates.teamSelectedMemberIds = newTeamSelected;
      }

      return updates;
    }, () => {
      this.refreshRightData();
      this.updateSelectedCount();
      this.notifyParent();
      this.syncMembersToDeptTab();
    });
  };

  // 清空所有选择
  handleClearAll = () => {
    this.setState({
      selectedMemberIds: new Set(),
      selectedTeamIds: new Set(),
      teamSelectedMemberIds: new Map()
    }, () => {
      this.refreshRightData();
      this.updateSelectedCount();
      this.notifyParent();
      this.syncMembersToDeptTab();
    });
  };

  // 通知父组件
  notifyParent = () => {
    const { selectedMemberIds, selectedTeamIds, allMembers, allTeams } = this.state;
    
    const selectedUsers = allMembers.filter(m => selectedMemberIds.has(m.userKey));
    const selectedDeparts = allTeams.filter(t => selectedTeamIds.has(t.teamId));
    
    if (this.props.getSelectedUser) {
      this.props.getSelectedUser({
        selectedDeparts,
        selectedUsers,
        selectedDepartIds: Array.from(selectedTeamIds),
        selectedUserIds: Array.from(selectedMemberIds),
        checkedKeys: []
      });
    }
  };

  // 更新已选人数 (去重统计)
  updateSelectedCount = () => {
    const { selectedMemberIds, selectedTeamIds, teamMembersMap, teamSelectedMemberIds, seatCount } = this.state;
      
    // 使用 Set 来存储所有唯一选中的成员 ID
    const uniqueSelected = new Set();
      
    // 1. 添加单独选中的成员（不在任何团队中的）
    Array.from(selectedMemberIds).forEach(id => uniqueSelected.add(id));
      
    // 2. 遍历所有选中的团队，添加团队中的所有成员
    selectedTeamIds.forEach(teamId => {
      const teamMembers = teamMembersMap.get(teamId) || [];
      teamMembers.forEach(member => {
        uniqueSelected.add(member.userKey);
      });
    });
      
    // 3. 添加在特定团队中单独选中的成员（这些成员可能不属于已选中的团队）
    teamSelectedMemberIds.forEach((members, teamId) => {
      // 只处理未被选中的团队内的成员
      if (!selectedTeamIds.has(teamId)) {
        members.forEach(id => uniqueSelected.add(id));
      }
    });
  
    const count = uniqueSelected.size;
    const seatTotal = seatCount.total || 0;
  
    if (count !== this.state.uniqueSelectedCount || seatTotal !== this.state.lastSeatTotal) {
      this.setState({ 
        uniqueSelectedCount: count,
        lastSeatTotal: seatTotal
      });
        
      if (typeof this.props.onSelectedCountChange === 'function') {
        this.props.onSelectedCountChange({ uniqueSelectedCount: count, seatTotal });
      }
    }
  };

  // 获取团队成员
  handleViewTeamMembers = (teamId, teamName, members) => {
    this.setState(prevState => ({
      currentLevel: 2,
      currentTeamId: teamId,
      teamName,
      treeData: members,
      breadcrumbItems: [
        { title: '全部团队', id: null },
        { title: teamName, id: teamId }
      ],
      leftScrollTop: 0,
      isSearchingActive: false,
      searchKey: ''
    }), () => {
      this.leftCache.clearAll();
      this.updateCheckAllState();
      this.forceUpdateGrid('left');
    });
  };

  // 返回团队列表
  handleBackToTeamList = () => {
    this.setState(prevState => ({
      currentLevel: 1,
      currentTeamId: null,
      teamName: "",
      treeData: prevState.allTeams,
      breadcrumbItems: [{ title: '全部团队', id: null }],
      leftScrollTop: 0,
      isSearchingActive: false,
      searchKey: ''
    }), () => {
      this.leftCache.clearAll();
      this.updateCheckAllState();
      this.forceUpdateGrid('left');
    });
  };

  // 切换标签页
  handleTabChange = (key) => {
    // 搜索进行中时禁止切换标签页
    if (this.state.isSearching) {
      return;
    }
    this.setState(prevState => {
      // 部门Tab不需要设置treeData，由DepartmentTree组件自行管理
      let treeData;
      if (key === TAB_KEYS.MEMBER) {
        treeData = prevState.allMembers;
      } else if (key === TAB_KEYS.TEAM) {
        treeData = prevState.allTeams;
      } else {
        treeData = []; // 部门Tab使用DepartmentTree组件
      }

      // 离开组织架构Tab时，重置部门搜索状态
      // DepartmentTree 是条件渲染（卸载后重新挂载），内部 searchResults 会被重置为空，
      // 但 props 中的 searchKey/isSearching 仍保留旧值，导致 showSearch=true 且 searchResults 为空 → 显示"暂无数据"
      const deptStateReset = key !== TAB_KEYS.DEPT ? {
        deptSearchKey: '',
        isDeptSearching: false,
      } : {};

      return {
        activeTabKey: key,
        currentLevel: 1,
        currentTeamId: null,
        searchKey: "",
        isSearchingActive: false,
        isSearching: false,
        treeData,
        breadcrumbItems: [{ title: '全部团队', id: null }],
        leftScrollTop: 0,
        ...deptStateReset,
      };
    }, () => {
      this.leftCache.clearAll();
      this.updateCheckAllState();
      if (this.state.activeTabKey !== TAB_KEYS.DEPT) {
        this.forceUpdateGrid('left');
      }
      // 切换到部门Tab时同步成员选中状态
      if (this.state.activeTabKey === TAB_KEYS.DEPT) {
        this.syncMembersToDeptTab();
      }
    });
  };

  // 切换团队展开
  toggleTeamExpand = (teamId) => {
    this.setState(prevState => {
      const newExpanded = new Set(prevState.expandedTeams);
      if (newExpanded.has(teamId)) {
        newExpanded.delete(teamId);
      } else {
        newExpanded.add(teamId);
      }
      return { expandedTeams: newExpanded };
    }, () => {
      this.rightCache.clearAll();
      this.forceUpdateGrid('right');
    });
  };

  // 渲染团队成员数量显示
  renderTeamMemberCount = (team) => {
    const { selectedTeamIds, teamSelectedMemberIds, teamMembersMap, selectedMemberIds } = this.state;
    const total = teamMembersMap.get(team.teamId)?.length || 0;
    
    if (selectedTeamIds.has(team.teamId)) {
      return `${total}/${total}`;
    }
    
    // 计算该团队中实际被选中的成员数量
    const teamSelected = teamSelectedMemberIds.get(team.teamId);
    const teamMembers = teamMembersMap.get(team.teamId) || [];
    let selectedCount = 0;
    
    teamMembers.forEach(member => {
      // 如果在 teamSelectedMemberIds 中有记录
      if (teamSelected?.has(member.userKey)) {
        selectedCount++;
      } 
      // 或者在 selectedMemberIds 中单独选中
      else if (selectedMemberIds?.has(member.userKey)) {
        selectedCount++;
      }
    });
    
    return `${selectedCount}/${total}`;
  };

  // 左侧行渲染器
  leftRowRenderer = ({ index, key, parent, style }) => {
    const { treeData, activeTabKey, currentLevel, currentTeamId, selectedMemberIds, selectedTeamIds, teamSelectedMemberIds, teamMembersMap } = this.state;
    const item = treeData[index];
    
    if (!item) return null;

    const isChecked = this.isItemChecked(item);
    const teamStatus = activeTabKey === TAB_KEYS.TEAM && currentLevel === 1 
      ? this.getTeamSelectStatus(item.teamId) 
      : null;
    return (
      <CellMeasurer
        cache={this.leftCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({ measure, registerChild }) => (
          <div style={style} ref={registerChild} onLoad={measure}>
            {activeTabKey === TAB_KEYS.TEAM && currentLevel === 1 ? (
              <div className="select-item" style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Checkbox
                  value={item.teamId}
                  checked={selectedTeamIds.has(item.teamId)}
                  indeterminate={teamStatus === 'partial'}
                  onChange={(e) => {
                    const currentValues = Array.from(selectedTeamIds);
                    const newValues = e.target.checked
                      ? [...currentValues, item.teamId]
                      : currentValues.filter(id => id !== item.teamId);
                    this.handleCheckChange(newValues);
                  }}
                >
                  <Avatar size={20} src={DEFAULT_AVATAR} icon={<UserOutlined />} />
                  <span className="select-item-txt" title={item.teamName} style={{ marginLeft: 8 }}>
                    {item.teamName}
                  </span>
                  <span className="team-teamMemberVoList-num" style={{ marginLeft: 4 }}>
                    ({this.renderTeamMemberCount(item)})
                  </span>
                </Checkbox>
                <Button
                  type="text"
                  size="small"
                  onClick={() => this.handleViewTeamMembers(
                    item.teamId, 
                    item.teamName, 
                    this.state.teamMembersMap.get(item.teamId) || []
                  )}
                  disabled={selectedTeamIds.has(item.teamId)}
                  style={{
                    padding: '0 6px',
                    fontSize: '12px',
                    color: selectedTeamIds.has(item.teamId) ? '#d9d9d9' : '#4247f6'
                  }}
                >
                  下级
                </Button>
              </div>
            ) : (
              <div className="select-item" style={{ padding: '4px 12px' }} key={item.userKey || item.teamId}>
                <Checkbox
                  value={item.userKey || item.teamId}
                  checked={isChecked}
                  onChange={(e) => {
                    let currentValues;
                    if (activeTabKey === TAB_KEYS.MEMBER) {
                      currentValues = Array.from(selectedMemberIds);
                    } else if (currentLevel === 2 && currentTeamId) {
                      // 团队下级页面：需要同时考虑 teamSelectedMemberIds 和 selectedMemberIds
                      const teamSelected = teamSelectedMemberIds.get(currentTeamId) || new Set();
                      const currentValuesSet = new Set(teamSelected);
                      // 添加 selectedMemberIds 中属于当前团队的成员
                      const currentTeamMembers = teamMembersMap.get(currentTeamId) || [];
                      currentTeamMembers.forEach(member => {
                        if (selectedMemberIds.has(member.userKey)) {
                          currentValuesSet.add(member.userKey);
                        }
                      });
                      currentValues = Array.from(currentValuesSet);
                    } else {
                      currentValues = Array.from(selectedTeamIds);
                    }
                    
                    const newValues = e.target.checked
                      ? [...currentValues, item.userKey || item.teamId]
                      : currentValues.filter(id => id !== (item.userKey || item.teamId));
                    
                    this.handleCheckChange(newValues);
                  }}
                >
                  {item.userKey ? (
                    <UserTag 
                      key={item.userKey}
                      userId={item.userKey} 
                      name={item.userName} 
                      avatar={item.avatarUrl || DEFAULT_AVATAR} 
                    />
                  ) : (
                    <>
                      <Avatar size={20} src={DEFAULT_AVATAR} icon={<UserOutlined />} />
                      <span className="select-item-txt" style={{ marginLeft: 8 }}>{item.teamName}</span>
                    </>
                  )}
                </Checkbox>
              </div>
            )}
          </div>
        )}
      </CellMeasurer>
    );
  };

  // 右侧行渲染器
  rightRowRenderer = ({ index, key, parent, style }) => {
    const { rightSelectedData, expandedTeams, teamMembersMap, selectedMemberIds, uniqueSelectedCount, seatCount } = this.state;
    const item = rightSelectedData[index];
    if (!item) return null;

    const isUser = !!item.userKey;
    const itemKey = item.userKey || item.teamId || `item-${index}`;
    const seatTotal = seatCount.total || 0;
    const isOverLimit = uniqueSelectedCount > seatTotal;

    // 计算灰色状态（超出限制）
    let isGrayed = false;
    if (isUser) {
      // 对于用户，位置索引（用户在前）
      const userIndex = rightSelectedData.filter(i => i.userKey).findIndex(i => i.userKey === item.userKey);
      isGrayed = isOverLimit && userIndex >= seatTotal;
    } else {
      // 对于团队，需要根据之前占用的席位计算
      let currentTotal = rightSelectedData.filter(i => i.userKey).length; // 独立成员数
      const teamIndex = rightSelectedData.filter(i => !i.userKey).findIndex(i => i.teamId === item.teamId);
      for (let i = 0; i < teamIndex; i++) {
        const prevTeam = rightSelectedData.filter(i => !i.userKey)[i];
        currentTotal += prevTeam.teamMemberVoList?.length || 0;
      }
      isGrayed = isOverLimit && currentTotal >= seatTotal;
    }

    return (
      <CellMeasurer
        cache={this.rightCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({ measure, registerChild }) => (
          <div style={style} ref={registerChild} onLoad={measure} key={itemKey}>
            {isUser ? (
              <div 
              title={isGrayed ? "暂无席位权限" : ""}
              className={`selected-item ${isGrayed ? 'selected-item-grayed' : ''}`}
              style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="selected-item-left">
                  <UserTag 
                    userId={item.userKey} 
                    name={item.userName} 
                    avatar={item.avatarUrl || DEFAULT_AVATAR} 
                  />
                </div>
                <Button
                  size="small"
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={() => this.handleDeleteSelected(item, "user")}
                  style={{ color: isGrayed ? '#ccc' : 'inherit' }}
                />
              </div>
            ) : (
               <Tooltip
                      key={`team-${item.teamId}`}
                      title={isGrayed ? "暂无席位权限" : ""}
                      placement="top"
                      trigger="hover"
                    >
                  <div>
                    <div className={`selected-item selected-team ${isGrayed ? 'selected-item-grayed' : ''}`} style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="selected-item-left">
                        <Button
                          type="text"
                          size="small"
                          icon={expandedTeams.has(item.teamId) ? <CaretDownOutlined /> : <CaretRightOutlined />}
                          onClick={() => this.toggleTeamExpand(item.teamId)}
                          style={{
                            width: '16px',
                            height: '16px',
                            minWidth: '16px',
                            marginRight: '8px',
                            color: isGrayed ? '#C6C6C6' : '#C6C6C6'
                          }}
                        />
                        <Avatar size={20} src={DEFAULT_AVATAR} icon={<UserOutlined />} style={{ filter: isGrayed ? 'grayscale(100%)' : 'none' }}/>
                        <span className="selected-item-name selected-item-team-name" title={item.teamName} style={{ marginLeft: 8 }}>
                          {item.teamName}
                        </span>
                        <span className="item-team-member-count" style={{ marginLeft: 4,color: isGrayed ? '#bbb' : '#999'}}>
                          ({teamMembersMap.get(item.teamId)?.length || 0})
                        </span>
                      </div>
                      <Button
                        size="small"
                        type="text"
                        icon={<CloseOutlined />}
                        onClick={() => this.handleDeleteSelected(item, "depart")}
                        style={{ color: isGrayed ? '#ccc' : 'inherit' }}
                      />
                    </div>
                    
                    {/* 团队成员列表（展开时） */}
                    {expandedTeams.has(item.teamId) && (
                      <div className="team-members-list" style={{ paddingLeft: 32 }}>
                        {teamMembersMap.get(item.teamId)?.map((member) => {
                          const isMemberSelected = selectedMemberIds.has(member.userKey);
                          return (
                            <div
                              key={member.userKey}
                              className={`selected-item team-member ${isMemberSelected ? 'selected' : ''}`}
                              style={{
                                padding: '4px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: isMemberSelected ? '#f5f5f5' : 'transparent'
                              }}
                            >
                              <div className="selected-item-left">
                                <Avatar
                                  size={20}
                                  src={member.avatarUrl || DEFAULT_AVATAR}
                                  icon={<UserOutlined />}
                                />
                                <span className="selected-item-name" style={{ marginLeft: 8 }}>{member.userName}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
              </Tooltip>
            )}
          </div>
        )}
      </CellMeasurer>
    );
  };

  // 处理左侧滚动
  handleLeftScroll = ({ scrollTop }) => {
    this.setState({ leftScrollTop: scrollTop });
  };

  // 处理右侧滚动
  handleRightScroll = ({ scrollTop }) => {
    this.setState({ rightScrollTop: scrollTop });
  };

  render() {
    const { 
      activeTabKey, treeData, isSpinning, searchKey,
      currentLevel, currentTeamId, breadcrumbItems,
      uniqueSelectedCount, seatCount, showAlert, checkAllState,
      leftListHeight, rightListHeight, overscanRowCount,
      leftScrollTop, rightScrollTop, rightSelectedData,
      isSearchingActive, isSearching
    } = this.state;

    const seatTotal = seatCount.total || 0;
    const isOverLimit = uniqueSelectedCount > seatTotal;

    // 根据 tenantModeInfo.install 字段动态控制部门Tab显示
    const tenantModeInfo = JSON.parse(sessionStorage.getItem('tenantModeInfo') || '{}');
    const showDeptTab = tenantModeInfo.install === true;

    const tabItems = [
      { key: TAB_KEYS.MEMBER, label: `成员` },
      { key: TAB_KEYS.TEAM, label: `团队` },
      ...(showDeptTab ? [{ key: TAB_KEYS.DEPT, label: `组织架构` }] : [])
    ];

    return (
      <div className="selected-setting-warp">
        {isOverLimit && showAlert && (
          <Alert 
            message={
              <span style={{ color: '#FDA500', fontSize: '14px' }}>
                <span style={{ marginRight: 8 }}>
                  <InfoCircleFilled className="icon" />
                </span>
                当前配置已超出 {uniqueSelectedCount - seatTotal} 人，请删减人员
              </span>
            } 
            type="warning" 
            style={{ marginBottom: 12 }}
          />
        )}

        <div className="selected-seat-content">
          {/* 左侧选择区 */}
          <div className="selected-user-left">
            <div className="select-input">
              <Input
                placeholder="请输入关键词"
                value={searchKey}
                suffix={
                  <SearchOutlined 
                    style={{ color: "#BBBBBB", cursor: 'pointer' }} 
                    onClick={() => this.handleSearch()}
                  />
                }
                onChange={(e) => {
                  this.setState({ searchKey: e.target.value });
                  this.handleSearchChange(e);
                }}
              />
            </div>

            <div className="select-tabs">
              <Tabs
                activeKey={activeTabKey}
                items={tabItems}
                onChange={this.handleTabChange}
                className={isSearching ? 'tabs-disabled' : ''}
                inkBarStyle={{
                  backgroundColor: '#1890ff',
                  height: 3,
                  borderRadius: 2
                }}
              />

              {activeTabKey === TAB_KEYS.TEAM && currentLevel === 2 && (
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
                          onClick={() => this.handleBackToTeamList()}
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

            {activeTabKey === TAB_KEYS.DEPT ? (
              <div className="select-content" style={{ height: leftListHeight, overflow: 'hidden', paddingLeft: '0px' }}>
                <DepartmentTree
                  deptTreeData={this.state.deptTreeData}
                  deptTreeLoading={this.state.deptTreeLoading}
                  selectedMemberIds={this.state.selectedDeptMemberIds}
                  onMemberCheck={this.handleDeptMemberCheck}
                  onSelectAllMembers={this.handleDeptSelectAllMembers}
                  searchKey={this.state.deptSearchKey}
                  isSearching={this.state.isDeptSearching}
                />
              </div>
            ) : (
            <Spin spinning={isSpinning} tip="数据加载中...">
              <div 
                className="select-content" 
                style={{ height: leftListHeight, position: 'relative' }}
              >
                {treeData.length > 0 && (
                  <div className="select-item select-all-item" style={{ 
                    marginTop: '6px', 
                    marginBottom: '0px', 
                    padding: '0 12px',
                    height: 40,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Checkbox
                      indeterminate={checkAllState.indeterminate}
                      checked={checkAllState.checked}
                      onChange={this.handleCheckAll}
                    >
                      全选
                    </Checkbox>
                  </div>
                )}

                <div style={{ 
                  height: treeData.length > 0 ? leftListHeight - 50 : leftListHeight 
                }}>
                  <AutoSizer key={`left-list-${treeData.length}`}>
                    {({ width, height }) => (
                      <List
                        ref={this.leftListRef}
                        width={width}
                        height={height}
                        rowCount={treeData.length}
                        rowHeight={this.leftCache.rowHeight}
                        deferredMeasurementCache={this.leftCache}
                        rowRenderer={this.leftRowRenderer}
                        overscanRowCount={overscanRowCount}
                        scrollTop={isSearchingActive ? 0 : leftScrollTop}
                        onScroll={this.handleLeftScroll}
                        style={{ outline: 'none' }}
                      />
                    )}
                  </AutoSizer>
                </div>

                {!treeData.length && !isSpinning && (
                  <div className="empty-data" style={{ 
                    position: 'absolute', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)' 
                  }}>
                    <Empty
                      image={require("../../../../image/no-data-table.png")}
                      styles={{
                        image: { height: 90, width: 90, margin: "auto", marginBottom: 10 }
                      }}
                      description={<span style={{ color: "#727272", fontSize: "12px" }}>暂无数据</span>}
                    />
                  </div>
                )}
              </div>
            </Spin>
            )}
          </div>

          {/* 右侧选中区域 */}
          <div className="selected-user-right selected-seat-right">
            <div className="selected-title" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              paddingLeft: 14,
              height: 40,
              alignItems: 'center'
            }}>
              {rightSelectedData.length > 0 ? (
                <>
                  <p>
                    {seatTotal >= 999999 ? 
                      `已选${uniqueSelectedCount}人` : 
                      <>
                        <span>可选{seatTotal}人</span>，
                        <span>
                          已选<span style={{ color: isOverLimit ? '#ff4d4f' : 'inherit' }}>{uniqueSelectedCount}</span>人
                        </span>
                      </>
                    }
                  </p>
                  <p onClick={this.handleClearAll} style={{ cursor: 'pointer', color: '#4247f6', marginRight: 12 }}>
                    清空
                  </p>
                </>
              ) : (
                <p>已选0人</p>
              )}
            </div>
            
            <div className="selected-content" style={{ height: rightListHeight, overflowX: 'hidden' }}>
              <AutoSizer>
                {({ width, height }) => (
                  <List
                    ref={this.rightListRef}
                    width={width}
                    height={height}
                    rowCount={rightSelectedData.length}
                    rowHeight={this.rightCache.rowHeight}
                    deferredMeasurementCache={this.rightCache}
                    rowRenderer={this.rightRowRenderer}
                    overscanRowCount={overscanRowCount}
                    scrollTop={rightScrollTop}
                    onScroll={this.handleRightScroll}
                    style={{ outline: 'none' }}
                  />
                )}
              </AutoSizer>

              {rightSelectedData.length === 0 && (
                <div className="empty-data" style={{ padding: '28px 0 0' }}>
                  <Empty
                    image={require("../../../../image/no-data-table.png")}
                    styles={{
                      image: { height: 90, width: 90, margin: "auto", marginBottom: 10 }
                    }}
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

export default TeamSettings;
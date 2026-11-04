
import React, { useMemo, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  Form,
  Button,
  Select,
  message,
  Switch,
  Space,
  Input,
  Table,
  Tooltip,
  Modal,
  Spin,
  Radio,
  Avatar
} from "antd";
import debounce from "lodash/debounce";
import { InfoCircleFilled, SyncOutlined, CloseOutlined, PlusOutlined } from "@ant-design/icons";
import {
  getApproveEditParam,
  postApproveEdit,
  getProjectConfig,
  getTeam,
  getRefreshTeam,
  getApprovalSettings,
  getWorkItemOptionNew,
  getWorkitemRole,
  postApprovalConfigInfo,
  getDataAuthConfig,
  searchAuthUser,
  saveDataAuthConfig
} from "../../../../../../api/api";
import { ExclamationCircleFilled } from "@ant-design/icons";
import "./permissionsSet.less";
import TeamPicker from "../../../team-picker/TeamPicker";
import SelectedAuthUser from "../auth-user/SelectedUser";
import deleteIcon from "../../../../../../image/delete.png";
import addIcon from "../../../../../../image/add.png";
import authLeftIcon from "../../../../../../image/auth_left.png";
import authRightIcon from "../../../../../../image/auth_right.png";
import defaultAvatar from "../../../../../../image/dept.png";
import { generateUuid} from "../../../../../../util/util";
import DeptSelector from "../../../dept-selector/DeptSelector";
const ApprovalSet = (props) => {
  const [isOpen, setIsOpen] = useState(true);
  const [approvalForm] = Form.useForm();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  // 创建表格容器ref用于滚动控制
  const tableContainerRef = useRef(null);
  // 记录当前编辑的行ID
  const [currentEditingRowId, setCurrentEditingRowId] = useState(null);
  const [dataSource, setDataSource] = useState([
    {
      approvalStageName: "工时审批",
      processingUserIds: [],
      approvalRule: "ANY",
    },
  ]);
  const [teamList, setTeamList] = useState([]);
  const [approvalData, setApprovalData] = useState({});
  // 添加审批模式状态
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
  const [roleApprovalData, setRoleApprovalData] = useState([
    {
      roleName: '角色A',
      approvalUserIds: [],
      workItemType: '',
      nodeType: '',
      projectRole: '',
    },
  ]);
  // 添加已选择的审批人状态
  const [selectedApprovalUsers, setSelectedApprovalUsers] = useState([]);
  // 添加审批人配置表格的数据源
  const [approvalTableData, setApprovalTableData] = useState([]);
  const [selected, setSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  });
  const [newSelected, setNewSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
  });
  const [noApprovalUserRule, setNoApprovalUserRule] = useState(0);
  const [teamNoApprovalUserRule, setTeamNoApprovalUserRule] = useState(0);
  const [roleNoApprovalUserRule, setRoleNoApprovalUserRule] = useState(0);
  // 当前正在编辑的用户列表类型（用于弹窗选择人员）
  const [currentUserListType, setCurrentUserListType] = useState('main'); // 'main', 'fallback', 'teamFallback'
  // 1. 为每种审批模式创建独立的状态

  // 添加错误信息显示状态
  const [showError, setShowError] = useState({
    main: false,
    fallback: false
  });
  // 新增：保存每行工作项对应的角色选项和加载状态
  const [rowRoleOptions, setRowRoleOptions] = useState({});
  const [rowRoleLoading, setRowRoleLoading] = useState({});
  // 新增：存储每行的错误信息（key: 行ID, value: { workItem: 工作项是否为空, role: 角色是否为空 }）
  const [rowErrors, setRowErrors] = useState({});
  // 新增：角色搜索相关状态
  const [roleSearchLoading, setRoleSearchLoading] = useState({});
  const [searchKeyword, setSearchKeyword] = useState({});
  const [authObj, setAuthObj] = useState('');
  const [dataAuthEnumList, setDataAuthEnumList] = useState([]);
  const [dataScopeEnumList, setDataScopeEnumList] = useState([]);
  const [dataScopeOpen, setDataScopeOpen] = useState(false);
  const [dataScope, setDataScope] = useState('');
  const [dataScopeDeptState, setDataScopeDeptState] = useState({
    selectedDepts: [],
    selectedDeptIds: [],
  });
  const [authConfigsData, setAuthConfigsData] = useState([]);
  // 记录当前编辑可见数据范围的行ID
  const [currentDataScopeRowId, setCurrentDataScopeRowId] = useState(null);
  const [currentDataScopeRow, setCurrentDataScopeRow] = useState({});
  // 新增：存储每行的数据权限错误信息（key: 行ID, value: { authObj: 成员是否为空, dataScope: 可见数据范围是否为空 }）
  const [authRowErrors, setAuthRowErrors] = useState({});
  // 根据value值返回对应的描述信息
  const getScopeDescription = (value) => {
    switch(value) {
      case 'isv_all_data':
        return '（可以查看所有成员、团队和部门数据）';
      case 'all_data':
        return '（可以查看所有成员和团队的数据）';
      case 'my_teams':
        return '（仅能查看自己管理的团队内所有成员的数据）';
      case 'specified_members':
        return '（手动选择可查看的成员数据）';
      case 'all_teams':
        return '（可查看该空间下所有授权团队）';
      case 'specified_teams':
        return '（手动选择可查看的团队数据）';
      case 'specified_department':
        return '（手动选择可查看的部门数据）';
      default:
        return '';
    }
  };
  // 搜索用户可查询的用户
  const saveDataAuthConfigData = async () => {
    const data=authConfigsData
    const res = await saveDataAuthConfig(data);
    if (res?.result) {
    }
  };
  useEffect(() => {
  }, [JSON.stringify(currentDataScopeRow)]);
  useEffect(() => {
    getDataAuthConfigInfo()
  }, []);
  const getDataAuthConfigInfo = async () => {
      const res = await getDataAuthConfig();
      if (res?.result) {
        if(res?.data && res.data?.dataAuthEnumList && res.data?.dataAuthEnumList.length>0){
          res.data?.dataAuthEnumList.forEach(item=>{
            item.label=item.value
            item.value=item.level
          })
          setDataAuthEnumList(res.data?.dataAuthEnumList);
        }
        if(res?.data && res.data?.dataScopeEnumList && res.data?.dataScopeEnumList.length>0){
          //临时添加
          res.data?.dataScopeEnumList.forEach(item=>{
            item.label=item.value
            item.value=item.level
          })
          setDataScopeEnumList(res.data?.dataScopeEnumList);
        }
         if(res?.data && res.data?.authConfigs && res.data?.authConfigs.length>0){
          let tenantModeInfo=JSON.parse(sessionStorage.getItem('tenantModeInfo'))
          if(tenantModeInfo?.install && tenantModeInfo?.mode == 'space'){
            let authConfigsList=res.data.authConfigs || [];
            if(authConfigsList && authConfigsList.length > 0){
              let isexist=authConfigsList.some(item => item?.authObj == "admin_administrator" && item?.isDefault == true);
              if(!isexist){
                authConfigsList.unshift({
                    "id": null,
                    "projectKey": null,
                    "tenantKey": "null",
                    "authObj": "admin_administrator",
                    "authObjValue": "应用管理员",
                    "isDefault": true,
                    "sort": 1,
                    "dataAuthUserVos": [],
                    "dataAuthExtraVos": [
                        {
                            "id": null,
                            "authId": 4993,
                            "dataScope": "isv_all_data",
                            "dataScopeValue": "所有成员、团队和部门",
                            "outId": null,
                            "userKey": null,
                            "userName": null,
                            "avatarUrl": null,
                            "teamId": null,
                            "teamName": null,
                            "isDefault": true,
                            "isAll": null,
                            "tag": null,
                            "departmentName": null,
                            "departmentId": null
                        }
                    ]
                })
               res.data.authConfigs=authConfigsList
              }
            }
          }
          res.data?.authConfigs.sort((a, b) => (a.sort || 0) - (b.sort || 0));
          res.data?.authConfigs.forEach(item=>{
            if(item?.dataAuthExtraVos && item?.dataAuthExtraVos.length>0 && item?.dataAuthExtraVos[0]?.dataScope==="specified_teams"){
              // 按照sort字段升序排序
              item?.dataAuthExtraVos.forEach(teamItem=>{
                teamItem.userKey=teamItem.teamId
                teamItem.userName=teamItem.teamName
                teamItem.avatarUrl='https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png'
              })
            }
          })
          setAuthConfigsData(res.data?.authConfigs);
        }
      }else{
        //window.JSSDK.toast.error("获取数据权限配置失败");
      }
  };
  useEffect(() => {
  }, [JSON.stringify(authConfigsData)]);
  /** 提交配置 */
  const onFinish = async () => {
    try {
      // 新增：验证表格每行的数据权限配置
      const newAuthRowErrors = {};
      let hasError = false;
      
      authConfigsData.forEach((row, index) => {
        const errors = {};
        
        // 验证成员是否为空
        if (!row.authObjValue || (Array.isArray(row.authObjValue) && row.authObjValue.length === 0)) {
          errors.authObj = true;
          hasError = true;
        }
        
        // 验证可见数据范围是否为空
        if (!row.dataAuthExtraVos || row.dataAuthExtraVos.length === 0 || !row.dataAuthExtraVos[0].dataScope) {
          errors.dataScope = true;
          hasError = true;
        }
        
        if (Object.keys(errors).length > 0) {
          newAuthRowErrors[row.id] = errors;
        }
      });
      
      // 更新错误状态
      setAuthRowErrors(newAuthRowErrors);
      
      // 若存在错误，阻止提交
      if (hasError) {
        window.JSSDK.toast.error("请完善成员和可见数据范围配置");
        return;
      }
      
      let data=JSON.parse(JSON.stringify(authConfigsData))
      data.forEach((item,index)=>{
        if(item.authObj=='specified_members'){
            item.dataAuthUserVos=item.dataAuthUserVos.map(user=>user.userKey)
        }else{
          item.dataAuthUserVos=[]
        }
        item.sort=index+1
        if(item.dataAuthExtraVos[0]?.dataScope=='specified_teams'){
            item.dataAuthExtraVos.forEach(teamItem=>{
                teamItem.userKey=null
                teamItem.userName=null
            })
          //item.dataAuthExtraVos=item.dataAuthExtraVos.filter(teamItem=>teamItem.tag !=false)
        }
      })
      const res = await saveDataAuthConfig(data);
      if (res?.result) {
        window.JSSDK.toast.success("数据权限配置保存成功");
        props.setIsApprovalSetOpen(true);
      } else {
        props.setIsApprovalSetOpen(true);
      }
    } catch (errorInfo) {
    }
  };
  // 修改添加行函数，确保新行包含所有必要字段
  const handleAddRow = () => {
    // 创建新行数据，遵循authConfigsData的数据结构
    let newId = 1;
    if (authConfigsData.length > 0) {
      // 获取最后一条数据的id，转换为数字后加1
      const lastRow = authConfigsData[authConfigsData.length - 1];
      const lastId = typeof lastRow.id === 'string' ? parseInt(lastRow.id) : lastRow.id;
      newId = lastId + 1;
    }
    const newRow = {
      id: newId,
      projectKey: sessionStorage.getItem('jwtMeegoTeamworkProjectKey'), // 假设使用固定的projectKey，实际可能需要从其他地方获取
      authObj: "", // 默认选择指定成员
      authObjValue: "", // 初始化为空数组，使授权对象列显示为空
      isDefault: false, // 新添加的行不是默认项
      dataAuthUserVos: [], // 初始化为空数组，用户可以后续添加
      dataAuthExtraVos: [
        {
          id: newId,
          authId: newId,
          dataScope: "", // 默认选择指定成员，使其显示请选择提示
          dataScopeValue: "", // 初始化为空数组，使可见数据范围列显示为空
          userKey: null,
          userName: null,
          avatarUrl: null,
          teamId: null,
          teamName: null,
          isDefault: false
        }
      ]
    };
    // 更新authConfigsData状态，添加新行
    setAuthConfigsData([...authConfigsData, newRow]);
    
    // 表格自动滚动到底部
    setTimeout(() => {
      if (tableContainerRef.current) {
        const tableBody = tableContainerRef.current.querySelector('.ant-table-body');
        if (tableBody && typeof tableBody.scrollTop !== 'undefined') {
          tableBody.scrollTop = tableBody.scrollHeight;
        }
      }
    }, 100);
  };

  const handleDeleteRow = (record) => {
    const newData = authConfigsData.filter(item => item.id !== record.id);
    setAuthConfigsData(newData);
    
    // 删除行时清除对应的错误信息
    setRowErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[record.id];
      return newErrors;
    });
    
    // 清除数据权限错误信息
    setAuthRowErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[record.id];
      return newErrors;
    });
  };
  /** 关闭选择人员弹窗 */
  const onSelectedUserCancel = () => {
    const person = newSelected.selectedUsers.concat(
      newSelected.selectedDeparts
    );
    setIsSelectedUserOpen(false);
    setSelected({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
    setNewSelected({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
  };
  /** 关闭选择人员弹窗 */
  const onDataScopeCancel = () => {
   setDataScopeOpen(false);
  };
  /** 确定可见数据范围 */
  const onDataScopeOk=()=>{
    try {
      if(selected.selectedUsers.length==0 && dataScope=='specified_members'){
        window.JSSDK.toast.error("请选择成员")
        return;
      }
      if(dataScope=='specified_teams'){
        let selectedTeams = selected.selectedUsers.filter(user => user.tag !== false);
        if(selectedTeams.length==0){
          window.JSSDK.toast.error("请选择团队")
          return;
        }
      }
      if(dataScope=='specified_department'){
        if(dataScopeDeptState.selectedDepts.length==0){
          window.JSSDK.toast.error("请选择部门")
          return;
        }
      }
      if (currentDataScopeRowId) {;
      setAuthConfigsData(prevData => 
        prevData.map(row => {
          if (row.id === currentDataScopeRowId) {
            // 处理不同的数据范围类型
            let dataScopeValue = [];
            const dataScopeType = dataScopeEnumList.find(item=>item.value===dataScope)?.label;
            if (dataScope === 'specified_members') {
              // 处理指定成员
              dataScopeValue = selected.selectedUsers.map(user => ({
              dataScope: dataScope,
              dataScopeValue: dataScopeType,
              userKey: user.userKey,
              userName: user.userName,
              avatarUrl: user.avatarUrl,
              teamId: null,
              teamName: null,
              isDefault: false,
              isAll: null
              }));
              // return {
              // ...row,
              // dataAuthExtraVos: updatedDataAuthExtraVos
              // };
            } else if (dataScope === 'specified_teams') {
              // 处理指定团队
              dataScopeValue = selected.selectedUsers.filter(user => user.tag !== false).map(user => ({
              dataScope: dataScope,
              dataScopeValue: dataScopeType,
              userKey: null,
              userName: null,
              avatarUrl: null,
              teamId: user.teamId,
              teamName: user.teamName,
              avatarUrl: user.avatarUrl,
              isDefault: false,
              isAll: null
              }));
            } else if (dataScope === 'specified_department') {
              // 处理指定部门
              dataScopeValue = dataScopeDeptState.selectedDepts.map(dept => ({
                dataScope: dataScope,
                dataScopeValue: dataScopeType,
                userKey: null,
                userName: null,
                avatarUrl: dept.avatarUrl || 'https://sf3-cn.feishucdn.com/obj/meego-static/front/static/20250221-145326.png',
                teamId: null,
                teamName: null,
                departmentId: dept.departmentId,
                departmentName: dept.departmentName,
                parentPath: dept.parentPath,
                isDefault: false,
                isAll: null
              }));
            } else {
              // 其他类型（如all_data, my_teams等）直接使用dataScope作为值
              let newDataScopeValue = {
                dataScope: dataScope,
                dataScopeValue: dataScopeType,
                userKey: null,
                userName: null,
                avatarUrl: null,
                teamId: null,
                teamName: null,
                avatarUrl: null,
                isDefault: false,
                isAll: null
              }
              dataScopeValue.push(newDataScopeValue)
            }
            return {
              ...row,
              dataAuthExtraVos: dataScopeValue
            };
          }
          return row;
        })
      );
      }
    // 关闭弹窗
    setDataScopeOpen(false);
    // 清空选择状态
    //resetSelected();
    // 重置当前编辑行ID
    setCurrentDataScopeRowId(null);
    setCurrentDataScopeRow({});
    // 清除当前行的可见数据范围错误提示
    setAuthRowErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[currentDataScopeRowId]?.dataScope) {
        // 如果只有dataScope错误，则删除整个错误对象
        if (!newErrors[currentDataScopeRowId]?.authObj) {
          delete newErrors[currentDataScopeRowId];
        } else {
          // 否则只删除dataScope错误
          delete newErrors[currentDataScopeRowId].dataScope;
        }
      }
      return newErrors;
    });
    } catch (error) {
      
    }
  }
  /** 确定选择人员 */
 const onSelectedUserOk = () => {
    if(selected.selectedUsers.length==0 && authObj=='specified_members'){
      window.JSSDK.toast.error("请选择成员")
      return;
    }
    // 如果有当前编辑的行ID，将选中的成员数据回显到表格中
    if (currentEditingRowId) {
      setAuthConfigsData(prevData => {
        return prevData.map(row => {
          if (row.id === currentEditingRowId) {
            // // 将选中的用户数据转换为authObjValue需要的格式
            const dataAuthUserVosArr = []
            selected?.selectedUsers.forEach((user) => {
              dataAuthUserVosArr.push({
                userKey: user.userKey,
                userName: user.userName,
                avatarUrl: user.avatarUrl
              })
            })
            const authType=dataAuthEnumList.find(item=>item.value===authObj)?.label;
            // 更新当前行的授权对象数据
            return {
              ...row,
              authObj: authObj,
              authObjValue: authType,
              dataAuthUserVos: dataAuthUserVosArr
            };
          }
          //console.log('dataAuthUserVos',row)
          return row;
        });
      });
      
      // 重置当前编辑行ID
      setCurrentEditingRowId(null);
      
      // 清除当前行的成员错误提示
      setAuthRowErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[currentEditingRowId]?.authObj) {
          // 如果只有authObj错误，则删除整个错误对象
          if (!newErrors[currentEditingRowId]?.dataScope) {
            delete newErrors[currentEditingRowId];
          } else {
            // 否则只删除authObj错误
            delete newErrors[currentEditingRowId].authObj;
          }
        }
        return newErrors;
      });
    }
    
    // 关闭模态框
    setIsSelectedUserOpen(false);
    setDataScopeOpen(false);
    
    // // 根据当前模式和类型保存数据
    // setSelectedUsersByMode(prev => ({
    //   ...prev,
    //   [currentUserListType]: {
    //     ...prev[currentUserListType],
    //     [approvalMode]: JSON.parse(JSON.stringify(selected.selectedUsers))
    //   }
    // }));
    
    // 3. 当用户添加审批人后，隐藏对应错误信息
    if (selected.selectedUsers.length > 0) {
      setShowError(prev => ({
        ...prev,
        [currentUserListType]: false
      }));
    }
    
    // 重置选择状态
    setSelected({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
    setNewSelected({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: [],
    });
  };

  /** 获取选择的人员 */
  const getSelectedUser = (e) => {
    setSelected(e);
  };
  // 解决未定义的状态问题
  const [searchWorkItemIds, setSearchWorkItemIds] = useState([]);
  const [workItemIds, setWorkItemIds] = useState([]);
  const [workItemIdsFilter, setWorkItemIdsFilter] = useState([]);
  const [isOnDeselect, setIsOnDeselect] = useState(false);
  const [isWorkItemChanged, setIsWorkItemChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  return (
    <div className="permissions-set-warp">
      <div className="approval-set-top">
        <div className="guifan-f16">数据权限</div>
        <div className="guifan-f14">可配置成员在资源管理、工时日志、工时管理页面的数据可见权限；用户最终权限 = 所有可查看的数据。</div>
      </div>
      <div className="approval-set-content">
          <div className="approval-config-section">
              <div className="role-approval-list">
                {roleApprovalData.map((item, index) => (
                  <div key={index} className="role-approval-item">
                    <div className="config-item">
                      <div className="approval-table-container" ref={tableContainerRef}>
                        <Table
                          footer={() => (
                            <div className="add-row-container">
                              <span onClick={handleAddRow} className="add-row-text">
                                <img src={addIcon} alt="添加" width={18} className="add-role-row"/>
                                添加数据权限
                              </span>
                            </div>
                          )}
                          bordered
                          dataSource={authConfigsData}
                          pagination={false}
                          rowKey="id"
                          columns={[
                            {
                              title: '成员',
                              dataIndex: 'authObj',
                              key: 'authObj',
                              render: (_, record, index) => {
                                const isDisabled = record.isDefault;
                                return (
                                  <div>
                                    <div 
                                      onClick={() => { 
                                        if (!isDisabled) {
                                          setCurrentEditingRowId(record.id);
                                          setIsSelectedUserOpen(true);
                                          setAuthObj(record.authObj);
                                          // 始终清空之前的选择值
                                          if(record.authObj === 'specified_members'){
                                            setSelected({
                                              selectedDeparts: [],
                                              selectedUsers: record.dataAuthUserVos,
                                              selectedDepartIds: [],
                                              selectedUserIds:record.dataAuthUserVos.map(item => item.userKey),
                                              checkedKeys: [],
                                            });
                                          } else {
                                            setSelected({
                                              selectedDeparts: [],
                                              selectedUsers: [],
                                              selectedDepartIds: [],
                                              selectedUserIds: [],
                                              checkedKeys: [],
                                            });
                                          }
                                        }
                                      }} 
                                      className="auth-obj-item"
                                      style={{ 
                                        color: isDisabled ? "#ccc" : "#333",
                                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      {record.authObj === 'specified_members' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px'}}>
                                          {record.dataAuthUserVos?.length > 0 ? (
                                            <>
                                              {/* 显示前两个成员 */}
                                              {record.dataAuthUserVos.slice(0, 2).map((item, idx) => (
                                                <span key={idx} className="user-item-area">
                                                  <img 
                                                    src={item.avatarUrl || 'default-avatar-url'} 
                                                    alt={item.userName} 
                                                    style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                                  />
                                                  <span>{item.userName}{item.tag === 0 ? ' [已删除]' : ''}</span>
                                                </span>
                                              ))}
                                              {/* 如果超过两个成员，显示+数字并添加Tooltip */}
                                              {record.dataAuthUserVos.length > 2 && (
                                                <Tooltip 
                                                  title={
                                                    <div style={{ maxHeight: '300px', overflowY: 'auto',width:'100px'}}>
                                                      {record.dataAuthUserVos.slice(2).map((item, idx) => (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                          <img 
                                                            src={item.avatarUrl || 'default-avatar-url'} 
                                                            alt={item.userName} 
                                                            style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                                          />
                                                          <span>{item.userName}{item.tag === 0 ? ' [已删除]' : ''}</span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  }
                                                  placement="top"
                                                >
                                                  <span 
                                                    className="user-item-area-num"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      // 处理添加更多人员的逻辑
                                                    }}
                                                  >
                                                    +{record.dataAuthUserVos.length - 2}
                                                  </span>
                                                </Tooltip>
                                              )}
                                              {/* {!isDisabled && (
                                                <span 
                                                  style={{ color: '#165DFF', cursor: 'pointer' }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    // 处理添加更多人员的逻辑
                                                  }}
                                                >
                                                  +
                                                </span>
                                              )} */}
                                            </>
                                          ) : (
                                            <span style={{ color: '#999' }}>请选择授权对象</span>
                                          )}
                                        </div>
                                      ) : (
                                        <span>{record.authObjValue ? record.authObjValue : <span style={{ color: '#999' }}>请选择成员</span>}</span>
                                      )}
                                      <span className="auth-user-head"><img src={authLeftIcon} alt="auth_left" width="18px" /></span>
                                    </div>
                                    {/* 显示成员为空的错误提示 */}
                                    {authRowErrors[record.id]?.authObj && (
                                      <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                                        请选择成员
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            },
                            {
                              title: '可见数据范围',
                              dataIndex: 'dataScope',
                              key: 'dataScope',
                              render: (_, record, index) => {
                                const isDisabled = record.isDefault;
                                return (
                                  <div>
                                    <div 
                                      onClick={() => { 
                                        if (!isDisabled) {
                                          setCurrentDataScopeRowId(record.id);
                                          setCurrentDataScopeRow(record);
                                          // 打开模态框前设置当前行的数据范围
                                          if (record.dataAuthExtraVos && record.dataAuthExtraVos.length > 0) {
                                            const currentScope = record.dataAuthExtraVos[0].dataScope || '';
                                            setDataScope(currentScope);
                                            
                                            // 只有当当前数据范围类型是指定成员、指定团队或指定部门时，才设置selected状态
                                            // 其他类型时清空选择数据
                                            if (currentScope === 'specified_members' || currentScope === 'specified_teams') {
                                              setSelected({
                                                selectedDeparts: [],
                                                selectedUsers: record.dataAuthExtraVos,
                                                selectedDepartIds: [],
                                                selectedUserIds: record.dataAuthExtraVos.map(item => item.userKey || item.teamId),
                                                checkedKeys: [],
                                              });
                                              setDataScopeDeptState({
                                                selectedDepts: [],
                                                selectedDeptIds: [],
                                              });
                                            } else if (currentScope === 'specified_department') {
                                              // 处理指定部门回显
                                              const deptData = record.dataAuthExtraVos.map(item => ({
                                                departmentId: item.departmentId,
                                                departmentName: item.departmentName,
                                                parentPath: item.parentPath || '',
                                                avatarUrl: item.avatarUrl,
                                              }));
                                              setDataScopeDeptState({
                                                selectedDepts: deptData,
                                                selectedDeptIds: deptData.map(d => d.deptId),
                                              });
                                              setSelected({
                                                selectedDeparts: [],
                                                selectedUsers: [],
                                                selectedDepartIds: [],
                                                selectedUserIds: [],
                                                checkedKeys: [],
                                              });
                                            } else {
                                              // 其他数据范围类型时清空选择数据
                                              setSelected({
                                                selectedDeparts: [],
                                                selectedUsers: [],
                                                selectedDepartIds: [],
                                                selectedUserIds: [],
                                                checkedKeys: [],
                                              });
                                              setDataScopeDeptState({
                                                selectedDepts: [],
                                                selectedDeptIds: [],
                                              });
                                            }
                                          } else {
                                            // 没有dataAuthExtraVos时清空选择
                                            setDataScopeDeptState({
                                              selectedDepts: [],
                                              selectedDeptIds: [],
                                            });
                                          }
                                          setDataScopeOpen(true);
                                        }
                                      }} 
                                      className="auth-obj-item"
                                      style={{ 
                                        color: isDisabled ? "#ccc" : "#333",
                                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      {/* 添加调试信息 */}
                                      {record.dataAuthExtraVos && record.dataAuthExtraVos.length > 0 ? (
                                        record.dataAuthExtraVos[0].dataScope === 'specified_members' || 
                                        record.dataAuthExtraVos[0].dataScope === 'specified_teams' ||
                                        record.dataAuthExtraVos[0].dataScope === 'specified_department' ? (
                                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px'}}>
                                            {/* 显示前两个成员/团队/部门 */}
                                            {record.dataAuthExtraVos.slice(0, 2).map((scopeItem, scopeIndex) => {
                                              // 判断是否为指定部门类型
                                              const isDeptScope = record.dataAuthExtraVos[0].dataScope === 'specified_department';
                                              // 根据类型选择头像：部门使用默认部门头像，其他使用 scopeItem.avatarUrl
                                              const avatarSrc = isDeptScope ? defaultAvatar : (scopeItem.avatarUrl || 'default-avatar-url');
                                              
                                              return (
                                                <span 
                                                  key={scopeIndex} 
                                                  className="user-item-area"
                                                >
                                                  <img 
                                                    src={avatarSrc} 
                                                    alt={scopeItem.userName || scopeItem.teamName || scopeItem.departmentName} 
                                                    style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                                  />
                                                  <Tooltip title={(scopeItem.userName || scopeItem.teamName || scopeItem.departmentName) + (scopeItem.tag === 0 ? ' [已删除]' : '')}>
                                                    <span className="team-name-jx">
                                                      {scopeItem.userName || scopeItem.teamName || scopeItem.departmentName}{scopeItem.tag === 0 ? ' [已删除]' : ''}
                                                    </span>
                                                  </Tooltip>
                                                </span>
                                              );
                                            })}
                                            {/* 如果超过两个成员/团队/部门，显示+数字并添加Tooltip */}
                                            {record.dataAuthExtraVos.length > 2 && (
                                              <Tooltip 
                                                title={
                                                  <div style={{ maxHeight: '300px', overflowY: 'auto', width: '150px' }}>
                                                    {record.dataAuthExtraVos.slice(2).map((scopeItem, scopeIndex) => {
                                                      // 判断是否为指定部门类型
                                                      const isDeptScope = record.dataAuthExtraVos[0].dataScope === 'specified_department';
                                                      // 根据类型选择头像：部门使用默认部门头像，其他使用 scopeItem.avatarUrl
                                                      const avatarSrc = isDeptScope ? defaultAvatar : (scopeItem.avatarUrl || scopeItem.teamAvatarUrl || 'default-avatar-url');
                                                      
                                                      return (
                                                        <div key={scopeIndex} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }} title={(scopeItem.userName || scopeItem.teamName || scopeItem.departmentName) + (scopeItem.tag === 0 ? ' [已删除]' : '')}>
                                                          <img 
                                                            src={avatarSrc} 
                                                            alt={scopeItem.userName || scopeItem.teamName || scopeItem.departmentName} 
                                                            style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                                          />
                                                          <span className="teams-long-show">{scopeItem.userName || scopeItem.teamName || scopeItem.departmentName}{scopeItem.tag === 0 ? ' [已删除]' : ''}</span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                }
                                                placement="top"
                                              >
                                                <span 
                                                  className="user-item-area-num"
                                                >
                                                  +{record.dataAuthExtraVos.length - 2}
                                                </span>
                                              </Tooltip>
                                            )}
                                          </div>
                                        ) : (
                                          <span>{record.dataAuthExtraVos[0].dataScopeValue ? record.dataAuthExtraVos[0].dataScopeValue : <span style={{ color: '#999' }}>请选择可见数据范围</span>}</span>
                                        )
                                      ) : (
                                        <span style={{ color: '#999', background: '#fff' }}>请选择可见数据范围</span>
                                      )}
                                       <span className="auth-user-head"><img src={authRightIcon} alt="auth_left" width="18px" /></span>
                                    </div>
                                    {/* 显示可见数据范围为空的错误提示 */}
                                    {authRowErrors[record.id]?.dataScope && (
                                      <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                                        请选择可见数据范围
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            },
                            {
                              title: '操作',
                              key: 'action',
                              width: '70px',
                              render: (_, record, index) => {
                                const isDisabled = record.isDefault;
                                return (
                                  <div 
                                    className="delete-text"
                                    onClick={() => !isDisabled && handleDeleteRow(record)}
                                    style={{ 
                                      opacity: isDisabled ? 0.5 : 1,
                                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                                      color: isDisabled ? '#ccc' : '#4247f6'
                                    }}
                                  >
                                    删除
                                  </div>
                                );
                              }
                            }
                          ]}
                          scroll={{ y: '250px' }}
                        />

                      </div>
                    </div>
                  </div>
                ))}
              </div>
          </div>
          <Modal
            destroyOnClose
            title="可见数据范围"
            open={dataScopeOpen}
            onCancel={onDataScopeCancel}
            width={"745px"}
            footer={[
              <Button className="cancel-btn" onClick={onDataScopeCancel}>
                取消
              </Button>,
              <Button
                //disabled={!selected.selectedUserIds.length}
                type="primary"
                onClick={onDataScopeOk}
              >
                确定
              </Button>,
            ]}
          >
            <div style={{ padding: '8px 0' }}>
               <Radio.Group
                //style={style}
                onChange={(val) => {
                  const newDataScope = val.target.value;
                  // 当切换数据范围类型时，清空之前选择的成员/团队数据
                  if (newDataScope !== dataScope) {
                    // 获取当前行的第一个数据范围项
                    const currentScopeItem = currentDataScopeRow?.dataAuthExtraVos?.[0];
                    // 获取当前数据范围类型
                    const currentScopeType = currentScopeItem?.dataScope;
                    
                    // 检查当前数据范围是否为指定成员、指定团队或指定部门，且与新数据范围一致
                    const isSameScopeType = currentScopeType === newDataScope && 
                      ['specified_members', 'specified_teams', 'specified_department'].includes(currentScopeType);
                    
                    if (isSameScopeType && currentDataScopeRow?.dataAuthExtraVos) {
                      // 当数据范围类型相同时，保留之前的选择
                      setSelected({
                        selectedDeparts: [],
                        selectedUsers: currentDataScopeRow.dataAuthExtraVos,
                        selectedDepartIds: [],
                        selectedUserIds: currentDataScopeRow.dataAuthExtraVos.map(item => item.userKey || item.teamId),
                        checkedKeys: [],
                      });
                      // 如果是部门类型，初始化部门选择状态
                      if (currentScopeType === 'specified_department') {
                        const deptData = currentDataScopeRow.dataAuthExtraVos.map(item => ({
                          departmentId: item.departmentId,
                          departmentName: item.departmentName,
                          parentPath: item.parentPath || '',
                          avatarUrl: item.avatarUrl,
                        }));
                        setDataScopeDeptState({
                          selectedDepts: deptData,
                          selectedDeptIds: deptData.map(d => d.deptId),
                        });
                      }
                    } else {
                      // 当数据范围类型不同时，清空之前的选择
                      setSelected(prev => ({
                        ...prev,
                        selectedUsers: [],
                        selectedUserIds: [],
                        checkedKeys: []
                      }));
                      setDataScopeDeptState({
                        selectedDepts: [],
                        selectedDeptIds: [],
                      });
                    }
                  }
                  setDataScope(newDataScope);
                }}
                value={dataScope}
                style={{ display: 'flex', flexDirection: 'column',gap: 8,marginBottom:10}}
                options={(() => {
                  // 根据 tenantModeInfo.install 字段动态控制指定部门选项显示
                  const tenantModeInfo = JSON.parse(sessionStorage.getItem('tenantModeInfo') || '{}');
                  const showDeptOption = tenantModeInfo.install === true;
                  
                  return dataScopeEnumList
                    .filter(item => item.value !== 'only_myself')
                    .filter(item => showDeptOption ? true : item.value !== 'specified_department')
                    .map(item => ({
                      ...item,
                      label: (
                        <span>
                          {item.label}
                          <span style={{ color: '#999', marginLeft: '8px' }}>
                            {getScopeDescription(item.value)}
                          </span>
                        </span>
                      )
                    }));
                })()}
              />
            </div>
            {dataScope === 'specified_members' && (
              <SelectedAuthUser
                type="authority"
                getSelectedUser={getSelectedUser}
                selectedUser={selected}
              />
            )}
            {dataScope === 'specified_teams' && (
              <SelectedAuthUser
                type="teams"
                getSelectedUser={getSelectedUser}
                selectedUser={selected}
              />
            )}
            {dataScope === 'specified_department' && (
              <DeptSelector
                selectedDepts={dataScopeDeptState.selectedDepts}
                onChange={(deptState) => {
                  setDataScopeDeptState(deptState);
                }}
              />
            )}
          </Modal>
           <Modal
            destroyOnClose
            title="成员"
            open={isSelectedUserOpen}
            onCancel={onSelectedUserCancel}
            width={"680px"}
            footer={[
              <Button className="cancel-btn" onClick={onSelectedUserCancel}>
                取消
              </Button>,
              <Button
                //disabled={!selected.selectedUserIds.length}
                type="primary"
                onClick={onSelectedUserOk}
              >
                确定
              </Button>,
            ]}
          >
            <div style={{ padding: '15px 0' }}>
              <span>选择成员：</span>
              <Radio.Group
                 onChange={(val) => {
                  setAuthObj(val.target.value);
                 }}
                value={authObj}
                options={dataAuthEnumList}
              />
            </div>
            {authObj === 'specified_members' && (
              <SelectedAuthUser
                type="authority"
                getSelectedUser={getSelectedUser}
                selectedUser={selected}
              />
            )}
          </Modal>
          <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '16px 0 8px' }}>
            <Space size="middle">
              <Button type="primary" onClick={onFinish} loading={isSubmitLoading}>保存设置</Button>
            </Space>
          </div>
      </div>
    </div>
  );
};
export default ApprovalSet;



import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Input, TextArea, DatePicker, Toast, Dialog, Mask } from "antd-mobile";
import {
  LeftOutlined,
  CloseOutlined,
  RightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import WorkItemCascader from "../../components/WorkItemCascader";
import { postInsertNodeWorkHour, postUpdateNodeWorkHour, postQueryNodeWorkHourSumByUser, postDeleteNodeWorkHour, getApprovalSettings, getRegistrationSettings } from "../../../../api/api";
import { canShowTenantAdminFeature } from "../../../../util/util";
import { useWorkHourSaturation, toFiniteNumber } from "../../hooks/useWorkHourSaturation";
import "./Registration.less";

const Registration = ({ visible: propsVisible, onClose: propsOnClose, onSubmit: propsOnSubmit, editData: propsEditData }) => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 判断是否为路由模式（没有传入 onClose 则为路由模式）
  const isRouteMode = !propsOnClose;
  const routeEditData = location.state?.editData;
  // 获取路由传递的登录用户信息，优先从 state 获取，fallback 到 sessionStorage
  // 使用 useMemo 缓存，避免每次渲染创建新对象导致 useEffect 重复执行
  const loginUser = useMemo(() => {
    if (location.state?.loginUser) {
      return location.state.loginUser;
    }
    // 从 sessionStorage 获取
    const storedUser = sessionStorage.getItem('jwtMeegoTeamworkLoginUser');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        console.error('解析 loginUser 失败:', e);
      }
    }
    return null;
  }, [location.state?.loginUser]);
  console.log('[Registration] loginUser:', loginUser);
  
  // 路由模式下始终显示，props模式下由visible控制
  const shouldShow = isRouteMode ? true : propsVisible;
  
  // 合并编辑数据
  const editData = propsEditData || routeEditData;
  
  // 判断是否为编辑模式
  const isEditMode = !!editData?.id || !!params.id;
  // 判断是否为详情页模式
  const viewMode = location.state?.viewMode || false;
  
  // 提交加载状态 - 分开跟踪两个按钮
  const [submitLoading, setSubmitLoading] = useState(false); // 提交审批/编辑提交
  const [continueLoading, setContinueLoading] = useState(false); // 提交并继续
  
  // 弹窗状态
  const [workItemPickerVisible, setWorkItemPickerVisible] = useState(false);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false); // 退出确认弹窗
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    taskHourId: '',
    memberId: loginUser?.id || '',
    memberName: loginUser?.name || '',
    targetId: '',
    targetName: '',
    workItemId: '',
    workItemName: '',
    workItemEntityId: '',
    workItemEntityName: '',
    nodeId: '',
    nodeName: '',
    subNodeId: '',
    subNodeName: '',
    workDate: '',
    workHour: '',
    description: '',
    pathValues: [], // 存储选择路径
  });
  
  // 登记对象统计信息
  const [registrationStats, setRegistrationStats] = useState(null);
  
  // 表单初始值引用，用于检测变化
  const initialFormDataRef = useRef(null);
  // 标记表单是否已提交成功
  const hasSubmittedRef = useRef(false);

  // 工时饱和度提示逻辑（移植自 Web 单项登记 RegWorkHour，含考勤四场景 / 编辑扣旧值 / 竞态守卫）
  // space 模式考勤门控：是否已选登记对象（对应 Web 的 hasSelectedWorkItem）
  const hasSelectedWorkItem = !!(formData.workItemId || formData.workItemEntityId
    || formData.nodeId || formData.subNodeId || formData.targetId);
  const workItemKey = [formData.workItemId, formData.workItemEntityId, formData.nodeId, formData.subNodeId]
    .map((value) => value ?? "").join("|");
  const {
    alertDetail,
    attendanceReady,
    attendanceHours,
    attendanceEnabled,
    missPunchPolicy,
    regWorkingHours,
    attendanceSyncing,
    canShowAttendance,
    mode: saturationMode,
    recalcForInput,
    handleSyncAttendance,
  } = useWorkHourSaturation({
    enabled: shouldShow && !!loginUser?.id,
    workDate: formData.workDate,
    userKey: loginUser?.id || "",
    editRegistrationValue: editData || null,
    hasSelectedWorkItem,
    workItemKey,
    getActWorkHourInput: () => parseFloat(formData.workHour) || 0,
  });
  
  // 审批设置
  const [approvalSettings, setApprovalSettings] = useState(null);
  
  // 登记设置（工作描述必填等）
  const [registrationSettings, setRegistrationSettings] = useState(null);

  // 组件加载时获取登记设置（标准工时/容量配置已移入 useWorkHourSaturation）
  useEffect(() => {
    const fetchRegistrationSettings = async () => {
      try {
        const res = await getRegistrationSettings();
        console.log('[Registration] 登记设置接口返回:', res);
        if ((res?.code === 200 || res?.result) && res.data) {
          setRegistrationSettings(res.data);
        }
      } catch (error) {
        console.error('获取登记设置失败:', error);
      }
    };
    
    if (shouldShow) {
      fetchRegistrationSettings();
    }
  }, [shouldShow]);

  // 编辑模式下初始化表单数据
  useEffect(() => {
    if (shouldShow && editData?.id) {
      console.log('[Registration] 编辑模式，初始化数据:', editData);
      console.log('[Registration] editData字段检查:', {
        workItemId: editData.workItemId,
        workItemEntityId: editData.workItemEntityId,
        nodeId: editData.nodeId,
        taskId: editData.taskId,
        workItemName: editData.workItemName,
        workItemEntityName: editData.workItemEntityName,
        nodeName: editData.nodeName,
        taskName: editData.taskName
      });
      
      // 构建登记对象显示名称
      const targetName = [
        editData.workItemName,
        editData.workItemEntityName,
        editData.nodeName,
        editData.taskName
      ].filter(Boolean).join('/');
      
      // 构建路径数组，包含所有层级的值
      const pathValues = [];
      if (editData.workItemId) pathValues.push(editData.workItemId);
      if (editData.workItemEntityId) pathValues.push(editData.workItemEntityId);
      if (editData.nodeId) pathValues.push(editData.nodeId);
      if (editData.taskId && editData.taskId !== editData.nodeId) pathValues.push(editData.taskId);
      
      // 初始化表单数据
      const initialData = {
        id: editData.id,
        taskHourId: editData.taskHourId || '',
        memberId: editData.registrantUserKey || '',
        memberName: editData.registrantName || '八九',
        targetId: editData.nodeId || editData.taskId || editData.workItemEntityId || '',
        targetName: targetName || editData.nodeName || editData.workItemEntityName || '',
        workItemId: editData.workItemId || '',
        workItemName: editData.workItemName || '',
        workItemEntityId: editData.workItemEntityId || '',
        workItemEntityName: editData.workItemEntityName || '',
        // 如果没有nodeId，使用workItemEntityId作为fallback（工作项实例级别的工时）
        nodeId: editData.nodeId || editData.workItemEntityId || '',
        nodeName: editData.nodeName || '',
        subNodeId: editData.taskId || '',
        subNodeName: editData.taskName || '',
        workDate: editData.workDate ? dayjs(editData.workDate).format('YYYY-MM-DD') : '',
        workHour: editData.actWorkHour || editData.act_hour || '',
        description: editData.workDesc || '',
        pathValues: pathValues
      };
      setFormData(initialData);
      console.log('[Registration] 设置后的formData:', initialData);
      // 保存初始值用于变化检测
      initialFormDataRef.current = { ...initialData };
      hasSubmittedRef.current = false;
      
      // 调用接口获取审批设置
      const fetchApprovalSettings = async () => {
        try {
          const res = await getApprovalSettings();
          console.log('[Registration] 审批设置接口返回:', res);
          if ((res?.code === 200 || res?.result) && res.data) {
            setApprovalSettings(res.data);
          }
        } catch (error) {
          console.error('获取审批设置失败:', error);
        }
      };
      fetchApprovalSettings();
      
      // 设置统计信息 或者调用接口获取
      if (editData.schedule || editData.estimatedWorkingHours) {
        setRegistrationStats({
          schedule: editData.schedule || '--',
          estimatedWorkingHours: editData.estimatedWorkingHours || '--/--',
          registeredWorkingHours: editData.registeredWorkingHours || '--/--',
          remainingWork: editData.remainingWork || '--/--'
        });
      } else {
        // 编辑模式下调用接口获取登记对象统计信息
        fetchRegistrationStats({
          workItemId: editData.workItemId,
          workItemEntityId: editData.workItemEntityId,
          nodeId: editData.nodeId,
          taskId: editData.taskId,
          subNodeId: editData.taskId || '',
          logId: editData.id || params.id, // 使用 editData.id 或 params.id 作为 logId
        });
      }
    } else if (shouldShow && !editData?.id) {
      // 新增模式，重置表单，使用 loginUser 信息
      const initialData = {
        id: '',
        taskHourId: '',
        memberId: loginUser?.id || '',
        memberName: loginUser?.name || '',
        targetId: '',
        targetName: '',
        workItemId: '',
        workItemName: '',
        workItemEntityId: '',
        workItemEntityName: '',
        nodeId: '',
        nodeName: '',
        subNodeId: '',
        subNodeName: '',
        workDate: '',
        workHour: '',
        description: '',
        pathValues: [],
      };
      setFormData(initialData);
      // 保存初始值用于变化检测
      initialFormDataRef.current = { ...initialData };
      hasSubmittedRef.current = false;
      setRegistrationStats(null);
      // 新增模式也要获取审批设置
      const fetchApprovalSettings = async () => {
        try {
          const res = await getApprovalSettings();
          console.log('[Registration] 审批设置接口返回:', res);
          if ((res?.code === 200 || res?.result) && res.data) {
            setApprovalSettings(res.data);
          }
        } catch (error) {
          console.error('获取审批设置失败:', error);
        }
      };
      fetchApprovalSettings();
    }
  }, [shouldShow, editData?.id, loginUser]);

  // 「工作日期变化 → 重新请求」与「登记工时变化 → 本地重算」的逻辑
  // 已整体移入 useWorkHourSaturation（主 effect + recalcForInput），此处不再重复实现。
  // 日期变化时按当前已填工时计算，无需额外处理。

  // 登记工时变化时本地重算（不调接口），联动「当前拟提交工时 / 剩余可登记工时 / 工作饱和度」
  useEffect(() => {
    recalcForInput(parseFloat(formData.workHour) || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.workHour]);

  // 获取登记对象统计信息
  const fetchRegistrationStats = async (workItemData) => {
    console.log('[Registration] 获取登记对象统计信息:', workItemData);
    try {
//       workItemId
// issue
// workItemEntityId
// 6226224792
// nodeId
// registrantUseKey
// 7485181754219692033
// logId
// 277764
      // const userKey = sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '';
      const res = await postQueryNodeWorkHourSumByUser({
        workItemEntityId: workItemData.workItemEntityId,
        registrantUseKey: loginUser?.id || '',
        // flowType: 'node',
        logId: workItemData.logId || '',
        ...(workItemData.workItemId ? { workItemId: workItemData.workItemId } : {}),
        ...((workItemData.nodeId || workItemData.targetId) ? { nodeId: workItemData.nodeId || workItemData.targetId } : {}),
        ...(workItemData.taskId ? { taskId: workItemData.taskId } : {}),
      });
      
      console.log('[Registration] 登记对象统计接口返回:', res);
      
      if ((res?.code === 200 || res?.result) && res.data) {
        setRegistrationStats({
          schedule: res.data.schedule || '--',
          estimatedWorkingHours: res.data.estimatedWorkingHours || '--/--',
          registeredWorkingHours: res.data.registeredWorkingHours || '--/--',
          remainingWork: res.data.remainingWork || '--/--'
        });
      }
    } catch (error) {
      console.error('获取登记对象统计失败:', error);
      setRegistrationStats({
        schedule: '--',
        estimatedWorkingHours: '--/--',
        registeredWorkingHours: '--/--',
        remainingWork: '--/--'
      });
    }
  };

  const handleFieldChange = (field, value) => {
    // 对工时字段进行小数处理，保留两位小数
    if (field === 'workHour') {
      // 移除所有非数字和小数点的字符
      const cleanedValue = value.replace(/[^\d.]/g, '');
      // 确保只有一个小数点
      const parts = cleanedValue.split('.');
      const processedValue = parts.length > 1 
        ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}` 
        : cleanedValue;
      setFormData(prev => ({ ...prev, [field]: processedValue }));
    } else if (field === 'description') {
      // 工作描述限制200字
      const limitedValue = value.slice(0, 200);
      setFormData(prev => ({ ...prev, [field]: limitedValue }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };
  
  // 选择登记对象确认
  const handleWorkItemConfirm = (result) => {
    console.log('[Registration] 选择登记对象:', result);
    
    // 构建路径数组，包含所有层级的值
    const pathValues = [];
    if (result.workItemId) pathValues.push(result.workItemId);
    if (result.workItemEntityId) pathValues.push(result.workItemEntityId);
    if (result.nodeId) pathValues.push(result.nodeId);
    if (result.subNodeId && result.subNodeId !== result.nodeId) pathValues.push(result.subNodeId);
    
    setFormData(prev => ({
      ...prev,
      targetId: result.targetId,
      targetName: result.targetName,
      workItemId: result.workItemId,
      workItemName: result.workItemName,
      workItemEntityId: result.workItemEntityId,
      workItemEntityName: result.workItemEntityName,
      nodeId: result.nodeId,
      nodeName: result.nodeName,
      // 任务层数据（第四层）
      subNodeId: result.subNodeId || '',
      subNodeName: result.subNodeName || '',
      taskId: result.taskId || result.subNodeId || '',
      taskName: result.taskName || result.subNodeName || '',
      pathValues: pathValues
    }));
    // 保存统计信息并调用接口获取详细数据
    if (result.registrationStats) {
      setRegistrationStats(result.registrationStats);
    } else {
      // 调用接口获取登记对象统计信息
      fetchRegistrationStats({
        workItemId: result.workItemId,
        workItemEntityId: result.workItemEntityId,
        nodeId: result.nodeId,
        subNodeId: result.subNodeId || '',
        logId: editData?.id || params.id, // 使用 editData.id 或 params.id 作为 logId
      });
    }
    setWorkItemPickerVisible(false);
  };
  
  // 选择工作日期确认
  const handleDateConfirm = (date) => {
    const formattedDate = dayjs(date).format('YYYY-MM-DD');
    console.log('[Registration] 选择日期:', formattedDate);
    setFormData(prev => ({
      ...prev,
      workDate: formattedDate,
    }));
    setDatePickerVisible(false);
  };

  // 检测表单是否有变化
  const hasFormChanged = useCallback(() => {
    if (!initialFormDataRef.current) return false;
    if (hasSubmittedRef.current) return false;
    
    const initial = initialFormDataRef.current;
    // 只检测用户可编辑的关键字段
    const fieldsToCheck = ['targetId', 'targetName', 'workDate', 'workHour', 'description'];
    
    return fieldsToCheck.some(field => {
      const initialValue = initial[field] || '';
      const currentValue = formData[field] || '';
      return String(initialValue).trim() !== String(currentValue).trim();
    });
  }, [formData]);

  // 执行实际的关闭操作
  const doClose = useCallback(() => {
    if (isRouteMode) {
      navigate(-1);
    } else {
      propsOnClose && propsOnClose();
    }
  }, [isRouteMode, navigate, propsOnClose]);

  // 处理删除操作
  const handleDelete = async () => {
    const dialogHandler = Dialog.show({
      title: '确认删除？',
      content: "您即将删除该条记录，此操作不可撤销",
      className: 'delete-dialog',
      actions: [
        {
          key: 'confirm',
          text: '确定删除',
          style: {
            backgroundColor: '#ff4d4f',
            color: '#ffffff',
            fontSize: '16px',
            // height: '48px',
            borderRadius: '8px',
          },
          onClick: async () => {
            try {
              const data = {
                id: formData.id || editData?.id,
                taskHourId: formData.taskHourId || editData?.taskHourId,
              };
              const res = await postDeleteNodeWorkHour(data);
              if (res?.code === 200 || res?.result) {
                Toast.show({ content: '删除成功', position: 'top' });
                 doClose();
                dialogHandler.close();
              } else {
                Toast.show({ content: res?.msg || '删除失败', position: 'top' });
              }
            } catch (error) {
              console.error('删除失败:', error);
              Toast.show({ content: '删除失败，请重试', position: 'top' });
            }
          },
        },
        {
          key: 'cancel',
          text: '取消',
          style: {
            color: '#8c8c8c',
            fontSize: '16px',
            // height: '48px',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            border: 'none',
          },
          onClick: () => {
            dialogHandler.close();
          },
        },
        
      ],
    });
  };

  // 处理编辑操作
  const handleEdit = () => {
    // 切换到编辑模式，确保传递完整的数据
    const editDataToPass = {
      ...editData,
      ...formData,
      // 确保 workDesc 字段正确传递（Registration 初始化时使用 workDesc）
      workDesc: formData.description,
      // 确保使用 editData 中的关键字段，避免 formData 中为空
      workItemId: formData.workItemId || editData?.workItemId,
      workItemEntityId: formData.workItemEntityId || editData?.workItemEntityId,
      nodeId: formData.nodeId || editData?.nodeId,
      taskId: formData.subNodeId || editData?.taskId,
    };
    console.log('[Registration] handleEdit 传递的数据:', editDataToPass);
    navigate(`/mb/log/registration/${formData.id || editData?.id}`, { state: { editData: editDataToPass, loginUser } });
  };

  // 关闭/返回处理（带确认）
  const handleClose = useCallback(() => {
    if (hasFormChanged()) {
      setExitConfirmVisible(true);
    } else {
      doClose();
    }
  }, [hasFormChanged, doClose]);

  // 确认退出
  const handleConfirmExit = useCallback(() => {
    setExitConfirmVisible(false);
    doClose();
  }, [doClose]);

  // 监听浏览器返回事件（Android物理返回键/手势返回）
  useEffect(() => {
    if (!shouldShow || !isRouteMode) return;
    
    // 添加一个历史记录，用于拦截返回
    const handlePopState = (e) => {
      e.preventDefault();
      if (hasFormChanged()) {
        // 重新推入历史记录，阻止返回
        window.history.pushState(null, '', window.location.href);
        Dialog.confirm({
          title: '提示',
          content: '未提交，确定退出吗？',
          confirmText: '确认',
          cancelText: '取消',
          onConfirm: () => {
            // 用户确认退出，执行返回
            window.history.go(-1);
            setTimeout(() => doClose(), 50);
          },
        });
      } else {
        doClose();
      }
    };
    
    // 推入一个历史记录用于拦截
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldShow, isRouteMode, hasFormChanged, doClose]);

  const handleSubmit = async (continueAdd = false) => {
    // 验证必填字段
    if (!isEditMode) {
      const submitNodeId = formData.subNodeId || formData.nodeId || formData.targetId;
      if (!submitNodeId) {
        Toast.show({ content: '请选择登记对象', position: 'top' });
        return;
      }
    } else {
      // 编辑模式下，验证必要的字段
      // 编辑接口需要：workItemId, workItemEntityId, nodeId
      // 注意：nodeId 可以是真实的nodeId、taskId或workItemEntityId（工作项实例级别）
      const hasWorkItemId = formData.workItemId;
      const hasWorkItemEntityId = formData.workItemEntityId;
      const hasNodeId = formData.nodeId || formData.subNodeId || formData.workItemEntityId;
      
      if (!hasNodeId) {
        Toast.show({ content: '登记对象数据不完整，无法提交', position: 'top' });
        console.error('[Registration] 编辑提交失败 - 缺少nodeId:', formData);
        return;
      }
      
      // 如果缺少工作项相关字段，给出警告但允许继续
      if (!hasWorkItemId || !hasWorkItemEntityId) {
        console.warn('[Registration] 警告 - 工作项字段不完整，可能是历史数据:', {
          workItemId: hasWorkItemId,
          workItemEntityId: hasWorkItemEntityId,
          nodeId: hasNodeId
        });
      }
    }
    if (!formData.workDate) {
      Toast.show({ content: '请选择工作日期', position: 'top' });
      return;
    }
    if (!formData.workHour) {
      Toast.show({ content: '请输入登记工时', position: 'top' });
      return;
    }
    
    // 验证工时必须为正数
    const workHour = parseFloat(formData.workHour);
    if (isNaN(workHour) || workHour <= 0) {
      Toast.show({ content: '登记工时必须为正数', position: 'top' });
      return;
    }
    // 验证工时不超过24小时
    if (workHour > 24) {
      Toast.show({ content: '登记工时不能超过24小时', position: 'top' });
      return;
    }
    // // 验证工作描述不超过200字符
    // if (formData.description && formData.description.length >= 200) {
    //   Toast.show({ content: '工作描述不能超过200字符', position: 'top' });
    //   return;
    // }
    
    // 根据按钮类型设置不同的加载状态
    if (continueAdd) {
      setContinueLoading(true);
    } else {
      setSubmitLoading(true);
    }
    
    // 构建提交参数
    const submitData = {
      workItemId: formData.workItemId,
      workItemEntityId: formData.workItemEntityId,
      actWorkHour: workHour,
      workDesc: formData.description || '',
      workDate: dayjs(formData.workDate).toISOString(),
      staffUserKey: sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
      registrantUserKey: sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
      schedule: registrationStats?.schedule === '--' ? null : registrationStats?.schedule,
      estimatedWorkingHoursAll: null,
      estimatedWorkingHoursSelf: null,
      estimatedWorkingHours: registrationStats?.estimatedWorkingHours,
      workItemName: formData.workItemName,
      workItemEntityName: formData.workItemEntityName,
      // 第三层节点（仅当有值时才添加）
      ...(formData.nodeId ? { nodeId: formData.nodeId } : {}),
      ...(formData.nodeName ? { nodeName: formData.nodeName } : {}),
      // 第四层任务（仅当有值时才添加）
      ...((formData.taskId || formData.subNodeId) ? { taskId: formData.taskId || formData.subNodeId } : {}),
      ...((formData.taskName || formData.subNodeName) ? { taskName: formData.taskName || formData.subNodeName } : {}),
    };
    
    console.log('[Registration] 提交参数:', submitData, '模式:', isEditMode ? '编辑' : '新增');
    console.log('[Registration] 当前formData:', {
      workItemId: formData.workItemId,
      workItemEntityId: formData.workItemEntityId,
      nodeId: formData.nodeId,
      subNodeId: formData.subNodeId
    });
    
    try {
      let res;
      if (isEditMode) {
        // 编辑模式：调用更新接口
        const editSubmitData = {
          id: formData.id || editData?.id,
          workItemId: formData.workItemId || '',
          workItemEntityId: formData.workItemEntityId || '',
          // nodeId优先级：subNodeId > nodeId > workItemEntityId（工作项实例级别）
          nodeId: formData.subNodeId || formData.nodeId || formData.workItemEntityId || '',
          taskId: formData.subNodeId || '',
          actWorkHour: workHour,
          workDesc: formData.description || '',
          workDate: dayjs(formData.workDate).toISOString(),
          taskHourId: formData.taskHourId || editData?.taskHourId || '',
          registrantUserKey: sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
        };
        console.log('[Registration] 编辑提交参数:', editSubmitData);
        res = await postUpdateNodeWorkHour(editSubmitData);
      } else {
        // 新增模式：调用插入接口
        res = await postInsertNodeWorkHour(submitData);
      }
      console.log('[Registration] 提交结果:', res);
      
      if (res?.code === 200 || res?.result) {
        // 标记已提交成功，避免退出时弹出确认
        hasSubmittedRef.current = true;
        const successMsg = (approvalSettings?.enableApproval === 1 ? '提交审批成功' : '提交成功');
        Toast.show({ icon: 'success', content: successMsg, position: 'top' });
        
        if (continueAdd) {
          // 清空表单继续添加
          const resetData = {
            ...formData,
            targetId: '',
            targetName: '',
            workItemId: '',
            workItemName: '',
            workItemEntityId: '',
            workItemEntityName: '',
            nodeId: '',
            nodeName: '',
            subNodeId: '',
            subNodeName: '',
            taskId: '',
            taskName: '',
            workDate: '',
            workHour: '',
            description: '',
          };
          setFormData(resetData);
          // 更新初始值为重置后的值
          initialFormDataRef.current = { ...resetData };
          hasSubmittedRef.current = false;
          setRegistrationStats(null);
        } else {
          // 关闭页面
          handleClose();
        }
        
        // 回调父组件（仅在 Props 模式下）
        if (!isRouteMode && propsOnSubmit) {
          propsOnSubmit(submitData, continueAdd);
        }
      } else {
        // Toast.show({ content: res?.msg || '提交失败', position: 'top' });
      }
    } catch (error) {
      console.error('提交失败:', error);
      // Toast.show({ content: '提交失败，请重试', position: 'top' });
    } finally {
      // 重置对应的加载状态
      if (continueAdd) {
        setContinueLoading(false);
      } else {
        setSubmitLoading(false);
      }
    }
  };

  // 判断是否可以提交
  const canSubmit = isEditMode ? (
    // 编辑模式下，只要有 id 就可以提交，其他字段可以为空
    formData.id && (formData.workDate && formData.workHour)
  ) : (
    // 新增模式下，需要所有必填字段都有值
    formData.targetId && formData.workDate && formData.workHour
  );

  if (!shouldShow) return null;

  return (
    <div className="registration-page">
      {/* 导航栏 */}
      <div className="reg-navbar">
        <LeftOutlined className="navbar-icon" onClick={handleClose} />
        <span className="navbar-title">{viewMode ? '工时详情' : isEditMode ? '编辑工时' : '工时登记'}</span>
      </div>

      {/* 内容区域 */}
      <div className="reg-content">
        {/* 工时统计横幅（逻辑与 Web 单项登记 RegWorkHour 顶部 Alert 对齐，含考勤四场景） */}
        <div className="reg-stats-banner">
          <div className="stats-text">
            <div>
              该成员当前工作日期
              {attendanceReady && canShowAttendance && attendanceEnabled === 1 && saturationMode !== "space" && !formData.workDate && attendanceHours === null && (
                <span>考勤工时<span className="highlight">--小时</span>，</span>
              )}
              {!attendanceReady && canShowAttendance && attendanceEnabled === 1 && formData.workDate && (
                <span>考勤工时<span className="highlight">--小时</span>，</span>
              )}
              {attendanceReady && canShowAttendance && attendanceEnabled === 1 && formData.workDate
                && attendanceHours !== null && Number(attendanceHours) > 0 && (
                <span>考勤工时<span className="highlight">{toFiniteNumber(attendanceHours)}小时</span>，</span>
              )}
              {attendanceReady && canShowAttendance && attendanceEnabled === 1 && formData.workDate
                && (attendanceHours === null || Number(attendanceHours) === 0) && missPunchPolicy === 2 && (
                <span>无考勤记录，</span>
              )}
              {attendanceReady && canShowAttendance && attendanceEnabled === 1 && formData.workDate
                && (attendanceHours === null || Number(attendanceHours) === 0) && missPunchPolicy === 1 && (
                <span>无考勤记录，暂不可登记工时，</span>
              )}
              总登记工时
              <span className="highlight">
                {regWorkingHours !== null && regWorkingHours !== undefined
                  ? toFiniteNumber(regWorkingHours)
                  : "--"}
                小时
              </span>
              ，待审批工时
              <span className="highlight">
                {alertDetail?.approvalingWork !== undefined && alertDetail?.approvalingWork !== null
                  ? toFiniteNumber(alertDetail.approvalingWork)
                  : "--"}
                小时
              </span>
            </div>
            <div>
              当前拟提交工时
              <span className="highlight">
                {formData.workHour !== "" && formData.workHour !== null && formData.workHour !== undefined
                  && alertDetail?.displayActWorkHour !== undefined
                  ? toFiniteNumber(alertDetail.displayActWorkHour)
                  : "--"}
                小时
              </span>
              ，剩余可登记工时
              <span className="highlight">
                {alertDetail?.remainingWork !== undefined && alertDetail?.remainingWork !== null
                  ? toFiniteNumber(alertDetail.remainingWork)
                  : "--"}
                小时
              </span>
              ，工作饱和度
              <span className="highlight">
                {alertDetail?.saturation !== undefined && alertDetail?.saturation !== null
                  ? toFiniteNumber(alertDetail.saturation)
                  : "--"}
                %
              </span>
              {attendanceReady && canShowAttendance && attendanceEnabled === 1 && formData.workDate && (
                <span
                  className={`attendance-sync-btn${attendanceSyncing ? " syncing" : ""}`}
                  onClick={handleSyncAttendance}
                >
                  同步考勤
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 表单区域1：成员和登记对象 */}
        <div className="reg-form-card">
          <div className="form-item">
            <div className="form-label">
              成员 <span className="required">*</span>
            </div>
            <div className="form-value">
              {loginUser?.avatar ? (
                <img className="member-avatar-img" src={loginUser.avatar} alt="" />
              ) : (
                <div className="member-avatar">{(loginUser?.name || formData.memberName || '').slice(0, 1)}</div>
              )}
              <span className="member-name">{loginUser?.name || formData.memberName || '--'}</span>
            </div>
          </div>

          <div 
            className={`form-item ${(!isEditMode && !viewMode) ? 'clickable' : ''}`} 
            onClick={() => !isEditMode && !viewMode && setWorkItemPickerVisible(true)}
          >
            <div className="form-label">
              登记对象  <span className="required">*</span>
            </div>
            <div className={`form-value ${(!isEditMode && !viewMode) ? 'clickable' : ''}`}>
              <span className={`target-name-text ${formData.targetName ? '' : 'placeholder'} ${(isEditMode || viewMode) ? 'full-display' : ''}`}>
                {formData.targetName || '请选择登记对象'}
              </span>
              {!isEditMode && !viewMode && <RightOutlined className="arrow-icon" />}
            </div>
            
          </div>
              {/* 登记对象统计信息 - 单独卡片 */}
        {registrationStats && (
          <div className="reg-form-card stats-card">
            <div className="form-item">
              <div className="form-label">排期:</div>
              <div className="form-value">{registrationStats.schedule}</div>
            </div>
            <div className="form-item">
              <div className="form-label">预估工时:</div>
              <div className="form-value">{registrationStats.estimatedWorkingHours?.replace(/\([^)]*\)/g, '') || ''}</div>
            </div>
            <div className="form-item">
              <div className="form-label">已登记工时:</div>
              <div className="form-value">{registrationStats.registeredWorkingHours?.replace(/\([^)]*\)/g, '')}</div>
            </div>
            <div className="form-item">
              <div className="form-label">剩余工时:</div>
              <div className="form-value">{registrationStats.remainingWork?.replace(/\([^)]*\)/g, '')}</div>
            </div>
          </div>
        )}
        </div>
        
    

        {/* 表单区域2：工作日期、登记工时、工作描述 */}
        <div className="reg-form-card">
          <div className={`form-item ${!viewMode ? 'clickable' : ''}`} onClick={() => !viewMode && setDatePickerVisible(true)}>
            <div className="form-label">
              工作日期 <span className="required">*</span>
            </div>
            <div className={`form-value ${!viewMode ? 'clickable' : ''}`}>
              <span className={formData.workDate ? '' : 'placeholder'}>
                {formData.workDate || '请选择工作日期'}
              </span>
              {!viewMode && <RightOutlined className="arrow-icon" />}
            </div>
          </div>

          <div className="form-item">
            <div className="form-label">
              登记工时 <span className="required">*</span>
            </div>
            <div className="form-value">
              {viewMode ? (
                <span>{formData.workHour || '0'} 小时</span>
              ) : (
                <>
                  <Input
                    className="hour-input"
                    placeholder="请输入"
                    value={formData.workHour}
                    onChange={(val) => handleFieldChange('workHour', val)}
                    type="number"
                    onFocus={(e) => {
                      // 输入框获得焦点时，延迟一段时间后滚动，确保键盘已弹出
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // 同时滚动内容容器，确保输入框在可视区域内
                        const contentElement = document.querySelector('.reg-content');
                        if (contentElement) {
                          const rect = e.target.getBoundingClientRect();
                          const contentRect = contentElement.getBoundingClientRect();
                          const offset = rect.top - contentRect.top;
                          contentElement.scrollTop = offset - 100; // 减去一个偏移量，确保输入框在可视区域内
                        }
                      }, 300);
                    }}
                  />
                  <span className="unit">小时</span>
                </>
              )}
            </div>
          </div>

          <div className="form-item textarea-item">
            <div className="form-label-row">
              <span className="form-label">工作描述{registrationSettings?.workDescReq === 1 && <span className="required">*</span>}</span>
              {/* {!viewMode && <span className="char-count">{formData.description.length}/200</span>} */}
            </div>
            {viewMode ? (
              <div className="desc-textarea view-mode" style={{ fontSize: '16px' }}>
                {formData.description || '--'}
              </div>
            ) : (
              <TextArea
                className="desc-textarea"
                placeholder="请输入"
                value={formData.description}
                onChange={(val) => handleFieldChange('description', val)}
                maxLength={200}
                showCount
               
                rows={4}
                onFocus={(e) => {
                  // 输入框获得焦点时，延迟一段时间后滚动，确保键盘已弹出
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // 同时滚动内容容器，确保输入框在可视区域内
                    const contentElement = document.querySelector('.reg-content');
                    if (contentElement) {
                      const rect = e.target.getBoundingClientRect();
                      const contentRect = contentElement.getBoundingClientRect();
                      const offset = rect.top - contentRect.top;
                      contentElement.scrollTop = offset - 100; // 减去一个偏移量，确保输入框在可视区域内
                    }
                  }, 300);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="reg-footer">
        {viewMode ? (
          // 详情页模式：编辑和删除按钮
          <>
            {/* 删除按钮 */}
            {editData?.isApproving ? (
              <button
                className="footer-btn secondary disabled"
                title="当前工时日志存在待审批的工时变更"
              >
                删除
              </button>
            ) : ((editData?.tag === 0 && canShowTenantAdminFeature()==false) ? (
              <button
                className="footer-btn secondary disabled"
                title="此登记对象已删除，无法进行删除，请联系插件管理员进行操作"
              >
                删除
              </button>
            ) : (
              <button
                className="footer-btn secondary"
                onClick={handleDelete}
              >
                删除
              </button>
            ))}
            
            {/* 编辑按钮 */}
            {editData?.isApproving ? (
              <button
                className="footer-btn primary disabled"
                title="当前工时日志存在待审批的工时变更"
              >
                编辑
              </button>
            ) : ((editData?.tag === 0 && canShowTenantAdminFeature()==false) ? (
              <button
                className="footer-btn primary disabled"
                title="此登记对象已删除，无法进行编辑，请联系插件管理员进行操作"
              >
                编辑
              </button>
            ) : (
              <button
                className="footer-btn primary"
                onClick={handleEdit}
              >
                编辑
              </button>
            ))}
          </>
        ) : isEditMode ? (
          // 编辑模式：取消和确认按钮
          <>
            {/* <button
              className="footer-btn secondary-filled"
              onClick={handleClose}
            >
              取消
            </button> */}
            <button
              className={`footer-btn primary-filled ${!canSubmit || submitLoading ? 'disabled' : ''}`}
              onClick={() => handleSubmit(false)}
              disabled={!canSubmit || submitLoading}
            >
              {submitLoading ? '保存中...' : (approvalSettings?.enableApproval === 1 ? '提交审批' : '提交')}
            </button>
          </>
        ) : (
          // 新增模式：提交并继续和提交审批
          <>
            <button
              className={`footer-btn secondary-filled ${!canSubmit || continueLoading ? 'disabled' : ''}`}
              onClick={() => handleSubmit(true)}
              disabled={!canSubmit || continueLoading}
            >
              {continueLoading ? '提交中...' : '提交并继续'}
            </button>
            <button
              className={`footer-btn primary-filled ${!canSubmit || submitLoading ? 'disabled' : ''}`}
              onClick={() => handleSubmit(false)}
              disabled={!canSubmit || submitLoading}
            >
              {submitLoading ? '提交中...' : (approvalSettings?.enableApproval === 1 ? '提交审批' : '提交')}
            </button>
          </>
        )}
      </div>
      
      {/* 登记对象选择器 */}
      <WorkItemCascader
        visible={workItemPickerVisible}
        onClose={() => setWorkItemPickerVisible(false)}
        value={formData.pathValues}
        onConfirm={handleWorkItemConfirm}
        loginUser={loginUser}
        isRegistration={true}
      />
      
      {/* 日期选择器 - 滚轮式 */}
      <DatePicker
        visible={datePickerVisible}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={handleDateConfirm}
        value={formData.workDate ? dayjs(formData.workDate).toDate() : new Date()}
        min={new Date(2020, 0, 1)}
      />

      {/* 自定义退出确认弹窗 */}
      <Mask
        visible={exitConfirmVisible}
        onMaskClick={() => setExitConfirmVisible(false)}
        opacity={0.55}
      >
        <div className="exit-confirm-wrapper">
          <div className="exit-confirm-popup">
            <div className="exit-confirm-title">提示</div>
            <div className="exit-confirm-content">
              {approvalSettings?.enableApproval === 1
                ? '您还未提交审批，确定要退出吗？'
                : '您还未提交，确定要退出吗？'}
            </div>
            <div className="exit-confirm-btns">
              <button
                className="exit-btn cancel"
                onClick={() => setExitConfirmVisible(false)}
              >
                取消
              </button>
              <button
                className="exit-btn confirm"
                onClick={handleConfirmExit}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </Mask>
    </div>
  );
};

export default Registration;

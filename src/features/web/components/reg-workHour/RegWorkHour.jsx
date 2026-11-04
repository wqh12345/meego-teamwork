/**
 * @file RegWorkHour.jsx
 * @description 工时登记组件，用于单个或批量工时登记、审批及管理
 * @author TeamMeego
 * @date 2024
 */

import React, { useState, useEffect, useRef, useMemo } from "react";

// Ant Design 组件导入
import {
  DatePicker,
  InputNumber,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Avatar,
  Spin,
  Radio,
  Typography,
  Alert,
  Tooltip,
} from "antd";

// 图标导入
import { UserOutlined, InfoCircleFilled } from "@ant-design/icons";

// 工具函数导入
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  timeStamp2Text,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  isNumber,
  validateNumber,
  canShowTenantAdminFeature,
  buildAttendanceIndex,
  getAttendance,
  getAppModeInfo,
} from "../../../../util/util";

// API 接口导入
import {
  postQueryNodeWorkHourSumByUser,
  postInsertNodeWorkHour,
  postUpdateNodeWorkHour,
  getStandWorkHour,
  getWorkInstance,
  getUserRole,
  getProjectConfig,
  getWorkSaturationTips,
  getApprovalSettings,
  postApproveHandle,
  postUserActive,
  getDisplayLogic,
  getRegistrationSettings,
  // getItemEntityOptionNew,
  getEntityNodeOptionNew,
  getItemEntityOptions,
  getUserStandWorkHour,
  getTenantModeInfo,
  getAttendanceConfig,
  getUserAttendanceConfig,
  syncAttendanceConfig
} from "../../../../api/api";

// 样式导入
import "./RegWorkHour.less";

// 第三方库导入
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import Decimal from "decimal.js";

// 自定义组件导入
import RegWorkHourBatchNew from "../reg-workHour-batch-new/RegWorkHourBatchNew";
import WorkNodeSelect from "../workNode-cascader/WorkNodeSelect";
import UserPicker from "../user-picker/UserPicker";
import TaskDetail from "../task-detail/TaskDetail";
import WorkNodeCascaderControl from "../workNode-cascader/WorkNodeSelectControl";

// 扩展 dayjs 插件
dayjs.extend(customParseFormat);

// 组件别名
const { TextArea } = Input;
const { Text } = Typography;

const normalizeAttendanceEnabled = (value) => (
  value === true || value === 1 || value === "1" ? 1 : 0
);

const toFiniteNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const normalizeAttendanceConfig = (source = {}, fallback = {}) => {
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);
  const enabledValue = source.isEnable ?? source.enable ?? fallback.enabled ?? 0;
  const policyValue = source.missPunchPolicy ?? fallback.missPunchPolicy ?? 1;
  const customLimitValue = hasOwn("missPunchCustomLimit")
    ? source.missPunchCustomLimit
    : fallback.missPunchCustomLimit ?? null;
  const attendanceHoursValue = hasOwn("attendanceHours")
    ? source.attendanceHours
    : hasOwn("hours") ? source.hours : fallback.attendanceHours ?? null;
  const enabled = normalizeAttendanceEnabled(enabledValue);
  const missPunchPolicy = Number(policyValue) === 2 ? 2 : 1;
  const missPunchCustomLimit = toOptionalNumber(customLimitValue);
  const attendanceHours = toOptionalNumber(attendanceHoursValue);

  return {
    enabled,
    attendanceHours,
    missPunchPolicy,
    missPunchCustomLimit,
    // 0 表示无有效考勤工时，缺卡允许提交时使用自定义上限。
    syncHours: attendanceHours !== null && attendanceHours > 0
      ? attendanceHours
      : missPunchPolicy === 2 ? missPunchCustomLimit : null,
    upperLimitSource: toFiniteNumber(
      source.upperLimitSource ?? fallback.upperLimitSource,
      1
    ),
  };
};

/**
 * 工时登记主组件
 * @param {Object} props - 组件属性
 * @param {string} props.registrationType - 登记类型 (single/batch)
 * @param {Object} props.setRegistrationValue - 预设登记值
 * @param {Function} props.getRegistrationValue - 获取登记值回调
 * @param {string} props.type - 类型 (normal/approval)
 * @param {Object} props.workItem - 工作项信息
 * @param {string} props.flowMode - 流程模式
 * @param {Object} props.loginUser - 当前登录用户信息
 * @param {string} props.point - 入口点 (normal/control)
 */
const RegWorkHour = (props) => {
  // 表单实例
  const [registrationForm] = Form.useForm();
  const workItemValue = Form.useWatch("workItem", registrationForm);
  const hasSelectedWorkItem = Array.isArray(workItemValue)
    && workItemValue.some((value) => value !== undefined && value !== null && value !== "");
  
  // 状态管理
  const [isAllowRegister, setIsAllowRegister] = useState(false); // 是否允许代填工时
  const [submitBtnTxt, setSubmitBtnTxt] = useState("提交"); // 提交按钮文本
  const workNodeSelectRef = useRef(null);
  const [submitDisabled, setSubmitBtnDisabled] = useState(false); // 提交按钮是否禁用
  const [canSubmitByLevel, setCanSubmitByLevel] = useState(true); // 根据层级判断是否可以提交(新增)
  const [submitLoadings, setSubmitLoadings] = useState(false); // 提交按钮加载状态
  const [saveHourLoadings, setSaveHourLoadings] = useState(false); // 暂存按钮加载状态
  const [id, setId] = useState(""); // 当前操作ID
  const [registrationType, setRegistrationType] = useState(
    props?.registrationType || "single" // 登记类型：single-单个 / batch-批量
  );
  const [spinning, setSpinning] = useState(false); // 加载状态
  const [workDate, setWorkDate] = useState(""); // 工作日期
  const [curFlowType, setCurFlowType] = useState(""); // 当前流程类型
  const [workItem, setWorkItem] = useState([]); // 选中的工作项
  const [workItemName, setWorkItemName] = useState(""); // 工作项名称
  const [workItemId, setWorkItemId] = useState(""); // 工作项ID
  const [workItemEntityId, setWorkItemEntityId] = useState(""); // 工作项实体ID
  const [selectedCustomFieldValue, setSelectedCustomFieldValue] = useState(
    props?.setRegistrationValue?.customFieldValue ?? null
  );
  const [nodeId, setNodeId] = useState(""); // 节点ID
  const [taskId, setTaskId] = useState(""); // 任务ID
  const [registeredName, setRegisteredName] = useState({}); // 登记名称信息
  const [standWorkHour, setStandWorkHour] = useState(0); // 标准工时
  const [capacitySet, setCapacitySet] = useState({}); // 容量设置
  const [actDay, setActDay] = useState(0); // 实际天数
  const [isShowDetailBtnOpen, setIsShowDetailBtnOpen] = useState(false); // 是否显示详情按钮
  const [isDetailOpen, setIsDetailOpen] = useState(false); // 详情弹窗是否打开
  const [registrantUserKey, setRegistrantUserKey] = useState(
    props?.loginUser?.id // 登记人ID
  );
  const [alertDetail, setAlertDetail] = useState({}); // 提示详情
  const [alertDetailOld, setAlertDetailOld] = useState({}); // 原始提示详情
  const [workItemInfo, setWorkItemInfo] = useState({}); // 工作项详情
  const [isEditChangeAlert, setIsEditChangeAlert] = useState(false); // 编辑时是否更改提示
  const [regDisplayLogic, setRegDisplayLogic] = useState({}); // 登记展示逻辑
  const [regWorkingHours, setRegWorkingHours] = useState(null); // 已登记工时
  const [windowHeight, setWindowHeight] = useState(570); // 默认高度为570px
  const [ingsConfig, setingsConfig] = useState(1);
  const [canSubmitByLevelInfo, setCanSubmitByLevelInfo] = useState("");
  const [registrationSettings, setRegistrationSettings] = useState({}); // 登记设置数据
  const ingsConfigRef = useRef(1);
  const granularityRef = useRef({ enabled: 0, hour: null }); // 工时颗粒度配置
  // 组件是否仍在挂载：登记设置接口可能晚于弹窗关闭才返回，用于避免对已卸载的表单补校验
  const isMountedRef = useRef(true);
  const [isComposing, setIsComposing] = React.useState(false);
  const [workDescRequired, setWorkDescRequired] = useState(0);
  const [projectName, setProjectName] = useState("");
  const logActualHour = useRef(0);
  // ---------- 考勤配置状态 ----------
  const [mode, setMode] = useState("");
  const [attendanceEnabled, setAttendanceEnabled] = useState(0);
  const [upperLimitSource, setUpperLimitSource] = useState(1);
  const [missPunchPolicy, setMissPunchPolicy] = useState(0);
  const [missPunchCustomLimit, setMissPunchCustomLimit] = useState(null);
  const [attendanceHours, setAttendanceHours] = useState(null);
  const [attendanceSyncing, setAttendanceSyncing] = useState(false);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const isAttendanceEnabled = normalizeAttendanceEnabled(attendanceEnabled) === 1;
  const canShowAttendanceForContext = mode !== "space" || hasSelectedWorkItem;
  const attendanceWorkItemKey = mode === "space" && Array.isArray(workItemValue)
    ? workItemValue.map((value) => value ?? "").join("|")
    : "";
  const attendanceConfigRef = useRef({
    enabled: 0,
    attendanceHours: null,
    missPunchPolicy: 1,
    missPunchCustomLimit: null,
    syncHours: null,
    upperLimitSource: 1,
  });
  const capacitySnapshotRef = useRef(null);
  const alertRequestIdRef = useRef(0);
  //实时监听高度
  const getIframeHeight = async () => {
  try {
    // 方法1: 检查是否在iframe中，并获取iframe元素
    const isInIframe = window.self !== window.top;
    let iframeHeight = 0;
    
    if (isInIframe) {
      try {
        // 尝试通过JSSDK获取上下文信息
        const context = await window.JSSDK.Context.load();
        setProjectName(context?.mainSpace?.name || "");
        // 立即获取当前高度
        if (context?.containerInfo?.height) {
          iframeHeight = context.containerInfo.height;
        }
        // 监听上下文变化
        context.watch((ctx) => {
          if (ctx?.containerInfo?.height) {
            setWindowHeight(ctx.containerInfo.height - 70);
          }
        });
      } catch (error) {
        //console.warn('JSSDK获取失败，尝试其他方式:', error);
      }
      
      // 如果JSSDK获取失败或没有返回高度，使用文档高度作为备选
      if (!iframeHeight) {
        // 方法2: 通过offsetHeight获取当前文档高度
        iframeHeight = document.documentElement.offsetHeight;
        }
      
      const height = iframeHeight - 70;
      setWindowHeight(height); // 更新状态
    } else {
      // 不在iframe中时使用窗口高度
      const height = window.innerHeight - 70;
      setWindowHeight(height);
    }
    
    return iframeHeight;
  } catch (error) {
    console.error('获取iframe高度时出错:', error);
    // 出错时使用默认高度
    setWindowHeight(570);
    return 0;
  }
};

// 优化防抖函数，确保正确处理异步操作
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await func.apply(null, args);
          resolve(result);
        } catch (error) {
          console.error('防抖函数执行出错:', error);
          resolve(null);
        }
      }, delay);
    });
  };
};
 useEffect(() => {
    if (props?.windowHeight) setFromHeight(props?.windowHeight);
  }, [props?.windowHeight]);
/**
 * 根据可登记层级信息设置提示信息
 * @param {Object} registeredName - 登记名称信息
 */
const handleLevelValidation = (registeredName) => {
  const levelNames = registeredName?.canRegisterLevelName;
  if (levelNames?.length === 1) {
    if (levelNames[0] === 'work_item_entity' || levelNames[0] === 'workitem') {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例层级');
    } else if (levelNames[0] === 'node') {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至节点层级');
    } else if (levelNames[0] === 'task') {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至任务层级');
    }
  } else if (levelNames?.length === 2) {
    if (levelNames.includes('work_item_entity') && levelNames.includes('node')) {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例或节点层级');
    } else if (levelNames.includes('work_item_entity') && levelNames.includes('task')) {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至工作项实例或任务层级');
    } else if (levelNames.includes('node') && levelNames.includes('task')) {
      setCanSubmitByLevelInfo('根据管理员设置，请登记至节点或任务层级');
    }
  }
};
useEffect(() => {
  // 使用新的状态变量canSubmitByLevel来控制层级验证,而不影响表单输入框的禁用状态
  if(registeredName && Object.keys(registeredName).length > 0){
    if(props?.currItem?.noCanRegisterWorkItem){
      setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
      setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
    }else{
    if(registeredName?.canRegister===true){
      if(registeredName?.canRegisterLevel === false){
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
        handleLevelValidation(registeredName);
      }else{
        setCanSubmitByLevel(true); // 可以提交
      }
    }else{
     if(registeredName?.canRegister===false){
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
        setCanSubmitByLevelInfo('非当前登记用户的负责人，无法登记');
      }
    }
  }
  }else{
    if(props?.currItem?.noCanRegisterWorkItem){
      setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
      setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
    }
  }
}, [JSON.stringify(registeredName)]);

// 处理登记对象失焦事件
const handleWorkItemBlur = () => {
  if(tempRegisteredName && Object.keys(tempRegisteredName).length > 0){
    setRegisteredName({...tempRegisteredName});
  }
};
// 添加窗口大小变化监听
useEffect(() => {
  // 计算高度函数
  const calculateHeight = async () => {
    await getIframeHeight();
  };
  
  // 创建防抖处理函数
  const debouncedCalculateHeight = debounce(calculateHeight, 300);
  
  // 组件挂载时立即计算一次
  calculateHeight();
  
  // 监听窗口大小变化
  window.addEventListener('resize', debouncedCalculateHeight);
  // 监听全屏变化
  window.addEventListener('fullscreenchange', debouncedCalculateHeight);
  // 监听方向变化（移动端）
  window.addEventListener('orientationchange', debouncedCalculateHeight);
  
  // 额外添加对可视区域变化的监听（针对现代浏览器）
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === document.documentElement) {
          debouncedCalculateHeight();
          break;
        }
      }
    });
    resizeObserver.observe(document.documentElement);
    
    // 组件卸载时清理ResizeObserver
    return () => {
      window.removeEventListener('resize', debouncedCalculateHeight);
      window.removeEventListener('fullscreenchange', debouncedCalculateHeight);
      window.removeEventListener('orientationchange', debouncedCalculateHeight);
      resizeObserver.disconnect();
    };
  } else {
    // 组件卸载时移除监听
    return () => {
      window.removeEventListener('resize', debouncedCalculateHeight);
      window.removeEventListener('fullscreenchange', debouncedCalculateHeight);
      window.removeEventListener('orientationchange', debouncedCalculateHeight);
    };
  }
}, []);

  
  /**
   * 组件初始化时获取基础配置信息
   */
  useEffect(() => {
    getApprovalSettingsData(); // 获取审批配置
    getCapacity(); // 获取登记设置
    //getWorkHour(); // 获取标准工时
    getRole(); // 获取用户角色
  }, []);
  // 维护挂载标记（StrictMode 下会卸载重挂，因此 effect 内重新置 true）
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  /**
   * 监听登记类型变化
   */
  useEffect(() => {
    if (props?.registrationType) setRegistrationType(props?.registrationType);
  }, [props?.registrationType]);
  useEffect(() => {
    ingsConfigRef.current=ingsConfig
  }, [ingsConfig]);
  /**
   * 监听预设登记值变化，初始化表单数据
   */
  useEffect(() => {
    if (props?.setRegistrationValue) {
      // 编辑模式下设置禁用状态
      setSubmitBtnDisabled(true);
      if(props?.setRegistrationValue?.canRegisterLevel === false){
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
        handleLevelValidation(props?.setRegistrationValue);
      }
       if(props?.currItem?.noCanRegisterWorkItem){
       setCanSubmitByLevelInfo(`根据管理员设置，[${props?.currItem?.workItemName}]不可被[编辑]`);
        setCanSubmitByLevel(false); // 不可提交,但不影响表单输入
      }
      // 设置日期和登记人信息
      setWorkDate(
        dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD")
      );
      setRegistrantUserKey(props?.setRegistrationValue?.registrantUserKey);
      
      // 设置工作项相关信息
      setWorkItemId(props.setRegistrationValue?.workItemId);
      setWorkItemEntityId(props.setRegistrationValue?.workItemEntityId);
      setSelectedCustomFieldValue(
        props.setRegistrationValue?.customFieldValue ?? null
      );
      setNodeId(props.setRegistrationValue?.nodeId);
      setTaskId(props.setRegistrationValue?.taskId);
      
      // 设置工作项数组
      setWorkItem([
        props.setRegistrationValue?.workItemId,
        props.setRegistrationValue?.workItemEntityId,
        props.setRegistrationValue?.nodeId,
        props.setRegistrationValue?.taskId,
      ]);
      
      // 构建工作项名称路径
      setWorkItemName(
        `${props.setRegistrationValue?.workItemName}/${
          props.setRegistrationValue?.workItemEntityName
        }${
          props.setRegistrationValue?.nodeName
            ? `/${props.setRegistrationValue?.nodeName}`
            : ""
        }${
          props.setRegistrationValue?.taskName
            ? `/${props.setRegistrationValue?.taskName}`
            : ""
        }`
      );
      
      // 初始化表单字段
      registrationForm.setFieldsValue({
        workItem: [
          props.setRegistrationValue?.workItemId,
          props.setRegistrationValue?.workItemEntityId,
          props.setRegistrationValue?.nodeId,
          props.setRegistrationValue?.taskId,
        ],
        scheduleDate: props.setRegistrationValue?.scheduleDate,
        workDate: dayjs(props.setRegistrationValue?.workDate),
        actWorkHour:
          props?.type === "approval"
            ? props.setRegistrationValue?.actWorkHour || 0
            : props.setRegistrationValue?.act_hour ||0,
        workDesc: props.setRegistrationValue?.workDesc,
        id: props.setRegistrationValue?.id,
        registrantUserKey: props.setRegistrationValue?.registrantUserKey,
      });
    } else {
      setSelectedCustomFieldValue(null);
      // 新增模式下记录用户行为
      if (props?.point === "control") {
        getUserActive("ControlOpenBatchRegistrationWorkingHours");
      } else {
        getUserActive("OpenRegistrationWorkingHours");
        // getRegDisplayLogic(); // 暂时注释掉的函数调用
      }
      
      // 设置当前登录用户为默认登记人
      registrationForm.setFieldValue("registrantUserKey", props?.loginUser?.id);
    }
  }, [props?.setRegistrationValue, props?.type]);

  /**
   * 监听工作项变化，根据不同入口点设置工作项信息
   */
  useEffect(() => {
    if (props?.workItem) {
      //console.log(props);
      if (props?.point === "control") {
        // 控制面板入口，工作项为对象格式
        setRegisteredName({ ...props?.registeredName });
        setWorkItemId(props?.workItem?.workItemId);
        setWorkItemEntityId(props?.workItem?.workItemEntityId);
        setSelectedCustomFieldValue(
          props?.workItem?.customFieldValue
            ?? props?.registeredName?.customFieldValue
            ?? null
        );
        setNodeId(props?.workItem?.nodeId);
        setTaskId(props?.workItem?.taskId);
        setWorkItem([
          props?.workItem?.workItemId,
          props?.workItem?.workItemEntityId,
          props?.workItem?.nodeId,
          props?.workItem?.taskId,
        ]);
        registrationForm.setFieldValue("workItem", [
          props?.workItem?.workItemId,
          props?.workItem?.workItemEntityId,
          props?.workItem?.nodeId,
          props?.workItem?.taskId,
        ]);
       // 确保getCapacity()完成后再执行后续函数
        if(props?.workItem?.nodeId){
          if(props?.point === "control"){
            getControlItemEntityOption(props)
          }
          getEntityNodeOption(props)
        }else{
          getItemEntityOptio(props)
        }
      } else {
        // 常规入口，工作项为数组格式
        setSelectedCustomFieldValue(
          props?.registeredName?.customFieldValue ?? null
        );
        setWorkItemId(props?.workItem[0]);
        setWorkItemEntityId(props?.workItem[1]);
        setNodeId(props?.workItem[2]);
        setTaskId(props?.workItem[3]);
        setWorkItem([
          props?.workItem[0],
          props?.workItem[1],
          props?.workItem[2],
          props?.workItem[3],
        ]);
        registrationForm.setFieldValue("workItem", [
          props?.workItem[0],
          props?.workItem[1],
          props?.workItem[2],
          props?.workItem[3],
        ]);
      }
    }
  }, [props?.workItem, props?.type,ingsConfig]);


  /**
   * 监听流程模式变化
   */
  useEffect(() => {
    setCurFlowType(props?.flowMode);
  }, [props?.flowMode]);

  /**
   * 监听登录用户变化，更新登记人信息
   */
  useEffect(() => {
    setRegistrantUserKey(props?.loginUser?.id);
    registrationForm.setFieldValue("registrantUserKey", props?.loginUser?.id);
  }, [props?.loginUser?.id]);
  /**
   * 获取登记工作项实例类型
   */
  const [canRegister, setCanRegister] = useState(true);
  const getControlItemEntityOption = async (workItem) => {
    const myselfFlag = ingsConfigRef.current == 1 ? true : false;
    const res = await getItemEntityOptions({
      workItemId: workItem.workItem?.workItemId,
      workItemEntityId: workItem.workItem?.workItemEntityId,
      userKey: workItem.loginUser?.id,
      myselfFlag: myselfFlag,
    });
      if (res?.result && Array.isArray(res.data.data) && res.data.data.length > 0 && res.data.data[0]) {
          setSelectedCustomFieldValue(res?.data?.data?.[0]?.customFieldValue || null);
      }
  };
  const getItemEntityOptio = async (workItem) => {
    //console.log('workItem888888',workItem);
      const myselfFlag = ingsConfigRef.current == 1 ? true : false;
    const res = await getItemEntityOptions({
      workItemId: workItem.workItem?.workItemId,
      workItemEntityId: workItem.workItem?.workItemEntityId,
      
      userKey: workItem.loginUser?.id,
      myselfFlag: myselfFlag,
    });
        if (res?.result && Array.isArray(res.data.data) && res.data.data.length > 0 && res.data.data[0]) {
        if(props?.point === "control"){
          setSelectedCustomFieldValue(res?.data?.data?.[0]?.customFieldValue || null);
        }
        // 安全地获取myselfStatus，避免访问不存在的属性
        const myselfStatus = res.data.data[0].canRegister;
        if (myselfStatus === false) {
          setSubmitBtnDisabled(true);
         
        }else{
           if(!res.data.data[0].canRegisterLevel){
              setCanSubmitByLevel(false);
              handleLevelValidation(res.data.data[0]);
           }
           setSubmitBtnDisabled(false);
        }
        if (myselfStatus !== undefined) {
          setCanRegister(myselfStatus);
         
        } else {
          console.warn('登记设置中未找到myselfStatus属性');
        } 
      }else{
        setSubmitBtnDisabled(true);
        setCanRegister(false);
      }
  };


  const getEntityNodeOption = async (workItem) => {
      const myselfFlag = ingsConfig == 1 ? true : false;
    const res = await getEntityNodeOptionNew({
      workItemId: workItem.workItem?.workItemId,
      workItemEntityId: workItem.workItem?.workItemEntityId,
      pageNum:1,
     pageSize:10,
      userKey: workItem.loginUser?.id,
      myselfFlag: myselfFlag,
    });
      if (res?.result && Array.isArray(res.data) && res.data.length > 0 && res.data[0]) {
        try {
        if(props?.point === "control"){
          setSelectedCustomFieldValue(res?.data?.[0]?.customFieldValue || null);
        }
           // 安全地获取myselfStatus，避免访问不存在的属性
          let currentNodeData = res.data.find(item => item.value === props?.workItem?.nodeId);
          const myselfStatus = currentNodeData?.canRegister || false;  
          if (myselfStatus === false) {
            setSubmitBtnDisabled(true);
          
          }else{
            if(!res.data[0].canRegisterLevel){
              setCanSubmitByLevel(false);
              handleLevelValidation(res.data[0]);
            }
            setSubmitBtnDisabled(false);
          }
          if (myselfStatus !== undefined) {
            setCanRegister(myselfStatus);
          
          } else {
            console.warn('登记设置中未找到myselfStatus属性');
          } 
        } catch (error) {
          setSubmitBtnDisabled(true);
          setCanRegister(false);
        }

      }else{
        setSubmitBtnDisabled(true);
        setCanRegister(false);
      }
  }
  /**
   * 记录用户行为埋点
   * @param {string} data - 活动类型
   */
  const getUserActive = async (data) => {
    await postUserActive({
      activeType: data,
    });
  };

  /**
   * 获取登记展示逻辑配置
   * 设置默认展示类型（单个或批量）
   */
  const getRegDisplayLogic = async () => {
    const res = await getDisplayLogic();
    if (res?.result) {
      setRegDisplayLogic(res.data);
      // 根据配置设置默认登记类型
      if (res.data?.defaultShowRegistrationType === "batch") {
        setRegistrationType(1); // 批量
      } else if (res.data?.defaultShowRegistrationType === "single") {
        setRegistrationType(0); // 单个
      }
    }
  };
    /** 查询登记设置 */
  const getCapacity = async () => {
    try {
      const res = await getRegistrationSettings();
      setWorkDescRequired(res?.data?.workDescReq || 0);
      // 存储工时颗粒度配置
      granularityRef.current = {
        enabled: res?.data?.isEnableGranularity ?? 0,
        hour: res?.data?.granularityHour ?? null,
      };
      // 补一次工时校验：弹窗首轮校验由 getAlertDetail 完成后触发，可能跑在本接口返回之前，
      // 那时 ref 还是「未开启」，颗粒度整数倍错误会被静默放行且不再重跑（偶发不提示的根因）。
      // 只在颗粒度确实开启且输入框已有值时补触发，不改变其它规则的触发时机与交互。
      if (granularityRef.current.enabled === 1 && granularityRef.current.hour) {
        const currentHour = registrationForm.getFieldValue("actWorkHour");
        if (
          isMountedRef.current &&
          currentHour !== undefined &&
          currentHour !== null &&
          currentHour !== ""
        ) {
          registrationForm.validateFields(["actWorkHour"]).catch(() => {});
        }
      }
      if (res?.result && Array.isArray(res.data.list) && res.data.list.length > 0 && res.data.list[0]) {
        // 安全地获取myselfStatus，避免访问不存在的属性
        const myselfStatus = res.data.list[0].myselfStatus;
        ingsConfigRef.current = myselfStatus;
        if (myselfStatus !== undefined) {
          setingsConfig(myselfStatus);
        } else {
          console.warn('登记设置中未找到myselfStatus属性');
        }
        // 保存登记设置数据，用于字段必填判断
        setRegistrationSettings(res.data.list[0]);
      } else {
        console.warn('登记设置数据格式不正确或为空');
      }
    } catch (error) {
      console.error('获取登记设置失败:', error);
      // 可以在这里添加错误状态设置或用户提示
    }
  };
  /**
   * 
   * 获取当前用户角色
   * 将角色信息存储到sessionStorage，并在角色为Admin时获取配置信息
   */
  const getRole = async () => {
    const res = await getUserRole();
    if (res?.result) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
      if (canShowTenantAdminFeature()) getConfig();
    }
    // 读取租户模式（tenant/space），驱动考勤查询的 projectKey 传递
    try {
      const modeRes = await getTenantModeInfo();
      if (modeRes?.result && modeRes?.data) {
        sessionStorage.setItem("tenantModeInfo", JSON.stringify(modeRes.data));
        setMode(modeRes.data?.mode || "");
      } else {
      }
    } catch (error) {
      console.error("读取租户模式信息失败:", error);
    }
  };
  /**
   * 查询考勤配置状态（租户/项目级）
   * @param {string} currentMode - 当前模式：tenant / space
   */
  const getAttendanceConfigInfo = async (context, throwOnFailure = false) => {
    try {
      const params = [{
        projectKey: context.mode === "space" ? context.projectKey : null,
        userKey: context.userKey,
      }];
      const res = await getAttendanceConfig(params);
      if (res?.result && res?.data) {
        const payload = res.data;
        const configs = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.projects)
            ? payload.projects
            : [payload];
        const config = context.mode === "space"
          ? (configs.find((item) => item?.projectKey === context.projectKey) || configs[0])
          : (configs.find((item) => item?.projectKey === null || item?.projectKey === "") || configs[0]);
        if (config) return normalizeAttendanceConfig(config);
      }
      if (throwOnFailure) throw new Error("获取考勤配置失败");
    } catch (error) {
      if (throwOnFailure) throw error;
    }
    return normalizeAttendanceConfig();
  };

  const applyAttendanceConfig = (config) => {
    attendanceConfigRef.current = config;
    setAttendanceEnabled(config.enabled);
    setUpperLimitSource(config.upperLimitSource);
    setMissPunchPolicy(config.missPunchPolicy);
    setMissPunchCustomLimit(config.missPunchCustomLimit);
    setAttendanceHours(config.attendanceHours);
  };

  /**
   * 获取用户考勤数据（成员 + 日期粒度）
   * 根据考勤配置 + 考勤记录，确定四类场景：
   *   场景1 考勤关闭；场景2 有考勤记录；场景3 缺卡-允许提交；场景4 缺卡-不允许提交
   */
  const getUserAttendanceConfigData = async (context, baseConfig, throwOnFailure = false) => {
    if (!baseConfig.enabled || !context.userKey || !context.workDate) {
      return normalizeAttendanceConfig({ attendanceHours: null }, baseConfig);
    }
    const data = {
      items: [{
        projectKey: context.mode === "space" ? context.projectKey : null,
        userKey: context.userKey,
      }],
      startDate: context.workDate,
      endDate: context.workDate,
    };

    try {
      const res = await getUserAttendanceConfig(data);
      if (!res?.result || !res?.data) {
        if (throwOnFailure) throw new Error("获取成员考勤数据失败");
        return normalizeAttendanceConfig({ attendanceHours: null }, baseConfig);
      }

      const payload = res.data;
      const isDirectAttendance = !Array.isArray(payload)
        && !Array.isArray(payload?.projects)
        && ("hasAttendance" in payload || "attendanceHours" in payload);
      if (isDirectAttendance) {
        const directConfig = normalizeAttendanceConfig(payload, baseConfig);
        const hasAttendance = payload.hasAttendance === true
          || (payload.hasAttendance !== false && directConfig.attendanceHours !== null);
        return normalizeAttendanceConfig({
          ...payload,
          attendanceHours: hasAttendance ? directConfig.attendanceHours : null,
        }, directConfig);
      }

      const list = Array.isArray(payload?.projects)
        ? payload.projects
        : Array.isArray(payload) ? payload : [payload];
      const index = buildAttendanceIndex(list);
      const configuredProjectKey = props?.setRegistrationValue?.projectKey
        || context.projectKey
        || "";
      const lookupProjectKeys = context.mode === "tenant"
        ? ["tenant", null, ""]
        : [configuredProjectKey];
      list.forEach((item) => {
        if (!lookupProjectKeys.includes(item?.projectKey)) {
          lookupProjectKeys.push(item?.projectKey);
        }
      });

      let attendance = null;
      for (const projectKey of lookupProjectKeys) {
        attendance = getAttendance(index, projectKey, context.userKey, context.workDate);
        if (attendance !== null) break;
      }

      const projectConfig = context.mode === "space"
        ? (list.find((item) => item?.projectKey === configuredProjectKey) || {})
        : (list.find((item) => item?.projectKey === "tenant"
          || item?.projectKey === null
          || item?.projectKey === "") || {});
      const mergedConfig = normalizeAttendanceConfig(projectConfig, baseConfig);
      if (attendance === null) {
        return normalizeAttendanceConfig({ attendanceHours: null }, mergedConfig);
      }

      const attendanceConfig = normalizeAttendanceConfig(attendance, mergedConfig);
      const hasAttendance = attendance.hasAttendance === true
        || (attendance.hasAttendance !== false && attendanceConfig.attendanceHours !== null);
      return normalizeAttendanceConfig({
        ...attendance,
        attendanceHours: hasAttendance ? attendanceConfig.attendanceHours : null,
      }, attendanceConfig);
    } catch (error) {
      console.error('获取用户考勤配置时出错:', error);
      if (throwOnFailure) throw error;
      return normalizeAttendanceConfig({ attendanceHours: null }, baseConfig);
    }
  };
  /**
   * 手动同步考勤数据（当前仅展示入口，不触发调用）
   */
  const syncAttendanceConfigData = async () => {
    try {
      const res = await syncAttendanceConfig();
      if (res?.result && res?.data) {
        const payload = Array.isArray(res.data)
          ? res.data[0]
          : Array.isArray(res.data?.projects) ? res.data.projects[0] : res.data;
        if (payload) applyAttendanceConfig(normalizeAttendanceConfig(payload));
      }
    } catch (error) {
      console.error('同步考勤配置失败:', error);
    }
  };
    /**
   * 获取审批设置配置
   * 根据配置设置提交按钮的文本（提交或提交审批）
   */
  const getApprovalSettingsData = async () => {
    const res = await getApprovalSettings();
    if (res?.result) {
      res?.data?.enableApproval ? setSubmitBtnTxt("提交审批") : setSubmitBtnTxt("提交");
    }
  }
  /** 获取个人工作饱和度提示 */
  const [remainingWork, setRemainingWork] = useState(0);

  const getAttendanceUpperLimit = (config = attendanceConfigRef.current) => {
    const normalLimit = Number(dayUp) || Number(capacitySet?.dayUp) || 24;
    if (normalizeAttendanceEnabled(config.enabled) !== 1) return normalLimit;
    if (config.attendanceHours !== null
      && config.attendanceHours !== undefined
      && Number(config.attendanceHours) > 0) {
      return Number(config.attendanceHours);
    }
    if (config.missPunchPolicy === 2
      && config.missPunchCustomLimit !== null
      && config.missPunchCustomLimit !== undefined) {
      return Number(config.missPunchCustomLimit);
    }
    return 0;
  };

  /**
   * 统一计算工作饱和度相关字段
   * 饱和度公式：(已登记工时 + 待审批工时 + 当前拟提交工时) / 单位人天标准工时 × 100%
   * @param {Object} baseData - 基础数据（alertDetailOld，接口返回的原始数据）
   * @param {number} actWorkHourInput - 当前输入框的工时值
   * @param {Object} setRegistrationValue - 编辑回显数据
   * @param {boolean} isSameDate - 编辑时工作日期是否与原记录一致
   * @returns {Object} 新的 alertDetail 对象
   */
  const calcSaturationData = (baseData, actWorkHourInput, setRegistrationValue, isSameDate) => {
    const result = { ...(baseData || {}) };
    const inputHour = toFiniteNumber(actWorkHourInput);
    const originalRegistered = toFiniteNumber(result.registeredWorkingHours); // 接口返回的已登记工时(不变)
    const approvalingWork = toFiniteNumber(result.approvalingWork);           // 待审批工时(不变)
    const standWorkHour = toFiniteNumber(capacitySet?.standWorkHour);
    const upperLimit = getAttendanceUpperLimit();
    let oldActWorkHour = setRegistrationValue
      ? toFiniteNumber(setRegistrationValue?.actWorkHour ?? setRegistrationValue?.act_hour)
      : 0;
     if(props?.type === "approval" && props?.setRegistrationValue?.modifyType === "edit"){
        oldActWorkHour = logActualHour.current || 0;
     }
     if(props?.type === "approval" && props?.setRegistrationValue?.modifyType === "create"){
        oldActWorkHour =  0
     }
    // 当前拟提交工时（用于显示）
    // - 新增登记：等于输入值
    // - 编辑且日期相同：输入值 - 旧值（差值）
    // - 编辑且日期不同：等于输入值
    let displayActWorkHour;
    if (!setRegistrationValue) {
      displayActWorkHour = inputHour;
    } else if (isSameDate) {
      displayActWorkHour = inputHour - oldActWorkHour;
    } else {
      displayActWorkHour = inputHour;
    }
    result.displayActWorkHour = Number(displayActWorkHour.toFixed(2));

    // 剩余工时 = 日上限 - (已登记 + 待审批 + 拟提交)
    // 编辑同日期时，已登记需减去旧值（因旧值已包含在registered中，替换为新值）
    const registeredForCalc = (setRegistrationValue && isSameDate)
      ? (originalRegistered - oldActWorkHour)
      : originalRegistered;
    result.remainingWork = Number((upperLimit - registeredForCalc - approvalingWork - inputHour).toFixed(2));

    // 登记后工时显示（已登记 + 本次净变化）
    result.registeredWorkingHours = Number((registeredForCalc + inputHour).toFixed(2));

    // 饱和度 = (已登记 + 待审批 + 拟提交) / 标准工时 × 100
    const total = registeredForCalc + approvalingWork + inputHour;
    result.saturation = standWorkHour ? Number(((total / standWorkHour) * 100).toFixed(2)) : 0;

    return result;
  };

  const getAlertDetail = async (throwOnFailure = false) => {
    const requestId = ++alertRequestIdRef.current;
    const appMode = getAppModeInfo();
    const context = {
      mode: appMode,
      userKey: registrantUserKey,
      workDate: workDate ? dayjs(workDate).format("YYYY-MM-DD") : "",
      projectKey: sessionStorage.getItem("jwtMeegoTeamworkProjectKey") || "",
      canLoadAttendance: (appMode || "tenant") !== "space" || hasSelectedWorkItem,
    };
    const isCurrentRequest = () => requestId === alertRequestIdRef.current
      && context.mode === appMode
      && context.userKey === registrantUserKey
      && context.workDate === (workDate ? dayjs(workDate).format("YYYY-MM-DD") : "");
    setAttendanceReady(false);
    applyAttendanceConfig(normalizeAttendanceConfig());
    const config = context.canLoadAttendance
      ? await getAttendanceConfigInfo(context, throwOnFailure)
      : normalizeAttendanceConfig();
    if (!isCurrentRequest()) return;
    applyAttendanceConfig(config);
    let attendanceConfig = config;
    if (context.canLoadAttendance && context.workDate) {
      attendanceConfig = await getUserAttendanceConfigData(context, config, throwOnFailure);
      if (!isCurrentRequest()) return;
    }
    applyAttendanceConfig(attendanceConfig);

    if (!context.workDate || !context.userKey) {
      capacitySnapshotRef.current = null;
      setAlertDetail({});
      setAlertDetailOld({});
      setRegWorkingHours(null);
      setAttendanceReady(true);
      return;
    }

    const data = {
      workDate: context.workDate,
      registrantUseKey: context.userKey,
    };
    if (props?.type === "approval" && props?.setRegistrationValue?.modifyType === "edit") {
      data.registerRecordId = props?.setRegistrationValue?.registerRecordId || "";
    }
    const res = await getWorkSaturationTips(data);
    if (!isCurrentRequest()) return;
    if (!res?.result || !res?.data) {
      capacitySnapshotRef.current = null;
      setAttendanceReady(true);
      if (throwOnFailure) throw new Error("刷新工时饱和度失败");
      return;
    }

    const rawData = { ...res.data };
    const registeredWorkingHours = toFiniteNumber(rawData.registeredWorkingHours);
    const approvalingWork = toFiniteNumber(rawData.approvalingWork);
    const logHour = toFiniteNumber(rawData.logActualHour);
    const attendanceUpperLimit = getAttendanceUpperLimit(attendanceConfig);
    const remaining = Number((attendanceUpperLimit - registeredWorkingHours - approvalingWork).toFixed(2));
    const snapshot = {
      workDate: context.workDate,
      userKey: context.userKey,
      remainingWork: remaining,
      registeredWorkingHours,
      approvalingWork,
      dayUp: toFiniteNumber(capacitySet?.dayUp, 24),
      logActualHour: logHour,
      attendanceEnabled: attendanceConfig.enabled,
      attendanceHours: attendanceConfig.attendanceHours,
      missPunchPolicy: attendanceConfig.missPunchPolicy,
      missPunchCustomLimit: attendanceConfig.missPunchCustomLimit,
    };
    capacitySnapshotRef.current = snapshot;
    logActualHour.current = logHour;
    setRegWorkingHours(registeredWorkingHours);
    setRemainingWork(remaining);
    const normalizedRawData = {
      ...rawData,
      registeredWorkingHours,
      approvalingWork,
    };
    const inputActWorkHour = toFiniteNumber(registrationForm.getFieldValue("actWorkHour"));
    const isSameDate = props?.setRegistrationValue
      ? context.workDate === dayjs(props.setRegistrationValue.workDate).format("YYYY-MM-DD")
      : false;
    setAlertDetailOld(normalizedRawData);
    setAlertDetail(calcSaturationData(
      normalizedRawData,
      inputActWorkHour,
      props?.setRegistrationValue,
      isSameDate
    ));
    setAttendanceReady(true);
    return true;
  };

  /** 点击同步考勤：重新查询当前成员/日期考勤，并刷新 Alert 与工时校验。 */
  const handleSyncAttendance = async () => {
    if (attendanceSyncing) return;
    setAttendanceSyncing(true);
    try {
      const refreshed = await getAlertDetail(true);
      if (!refreshed) throw new Error("刷新考勤信息失败");
      // getAlertDetail 已写入最新快照，放到下一 tick 触发字段重校验。
      setTimeout(() => {
        const value = registrationForm.getFieldValue("actWorkHour");
        if (value !== undefined && value !== null && value !== "") {
          registrationForm.validateFields(["actWorkHour"]).catch(() => {});
        }
      }, 0);
      window.JSSDK.toast.success("同步成功");
    } catch (error) {
      console.error("同步考勤失败:", error);
      window.JSSDK.toast.error("同步失败");
    } finally {
      setAttendanceSyncing(false);
    }
  };

   useEffect(() => {
    // 编辑回显时：当接口返回alertDetail后，初始化displayActWorkHour（只执行一次，避免死循环）
    if(alertDetail && Object.keys(alertDetail).length > 0 && alertDetail.displayActWorkHour === undefined){
       const inputActWorkHour = toFiniteNumber(registrationForm.getFieldValue('actWorkHour'));
      const isSameDate = props?.setRegistrationValue
        ? workDate === dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD")
        : false;
      const newAlertDetail = calcSaturationData(
        alertDetailOld || alertDetail,
        inputActWorkHour,
        props?.setRegistrationValue,
        isSameDate
      );
      setAlertDetail(newAlertDetail);
    }
   },[alertDetail, props.setRegistrationValue, dayUp, capacitySet])
  useEffect(() => {
    let validateTimer = null;
    let cancelled = false;

    const validateActWorkHour = () => {
      const hourValue = registrationForm.getFieldValue('actWorkHour');
      // 不用真值判断：回显 0 会被当成「无值」而整体跳过重校验
      if (hourValue !== undefined && hourValue !== null && hourValue !== '') {
        registrationForm.validateFields(['actWorkHour']).catch(() => {});
      }
    };
    const canRefreshAlert = registrantUserKey
      && (!workDate || "standWorkHour" in capacitySet);
    if (canRefreshAlert) {
      capacitySnapshotRef.current = null;
      setAlertDetail({});
      setAlertDetailOld({});
      setRegWorkingHours(null);
      if (props.type === "web" || props?.type === "approval") {
        const refreshAlertAndValidate = async () => {
          await getAlertDetail();
          if (cancelled) return;

          // 等待接口返回的数据完成渲染，使 actWorkHour 校验器使用最新的剩余工时。
          if (workDate) validateTimer = setTimeout(validateActWorkHour, 0);
        };
        refreshAlertAndValidate();
      } else {
        const refreshAlertAndValidate = async () => {
          await getAlertDetail();
          if (!cancelled && workDate) validateActWorkHour();
        };
        refreshAlertAndValidate();
      }
    } else {
      capacitySnapshotRef.current = null;
      setAttendanceReady(false);
      setAlertDetail({});
      setAlertDetailOld({});
    }

    return () => {
      cancelled = true;
      alertRequestIdRef.current += 1;
      if (validateTimer) clearTimeout(validateTimer);
    };
  }, [mode, workDate, registrantUserKey, capacitySet, attendanceWorkItemKey]);

  /** 查询是否开启代填工时功能 */
  const getConfig = async () => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    };
    const res = await getProjectConfig(data);
    if (res?.result) {
      setIsAllowRegister(res.data?.value ? true : false);
    }
  };

  useEffect(() => {
    if (workItem?.length && workItem?.length > 2) {
      fetchNodeWorkHourSumData();
    }
  }, [JSON.stringify(workItem), registrantUserKey]);
  useEffect(() => {
    if (registrantUserKey){
      getWorkHour()
    }
  }, [registrantUserKey]);
  /**
   * 查询组织标准工时配置
   * 设置标准工时和容量配置信息
   */
  const [dayUp ,setDayUp] = useState(0);
    const [onceDown ,setOnceDown] = useState(0);
  const getWorkHour = async () => {
    const data = {
      userKey: registrantUserKey
    };
    const res = await getUserStandWorkHour(data);
    if (res?.result) {
      setDayUp(res.data.dayUp);
      setOnceDown(res.data.onceDown);
      setStandWorkHour(res.data.standWorkHour);
      setCapacitySet(res.data);
    }
  };

  /** 查询工时登记节点总和 */
  const fetchNodeWorkHourSumData = async () => {
    const data = {
      workItemId: workItem[0],
      workItemEntityId: workItem[1],
      nodeId: workItem[2],
      taskId: workItem[3],
      registrantUseKey: registrantUserKey,
      flowType: curFlowType,
      logId: props?.setRegistrationValue?.id,
    };
    if (props?.type === "approval") delete data.logId;
    const res = await postQueryNodeWorkHourSumByUser(data);
    if (res?.result) {
      setWorkItemInfo(res.data);
      setWorkItemName(
        `${res.data.workItemName}${
          res.data.workItemEntityName ? `/${res.data.workItemEntityName}` : ""
        }${res.data.nodeName ? `/${res.data.nodeName}` : ""}${
          res.data?.taskName ? `/${res.data.taskName}` : ""
        }`
      );
    }
    setSpinning(false);
  };

  const traverseTree = (node) => {
    let tree = [];
    const getStr = function (list) {
      list.forEach(function (row) {
        row.key = JSON.stringify(row);
        row.workDesc = "";
        row.taskDesc = "";
        if ("children" in row && row.children?.length) {
          getStr(row.children);
        }
      });
    };
    getStr(node);
    return node;
  };

  /**
   * 查看已登记工时明细
   * 检查是否已选择工作项，然后打开详情弹窗
   */
  const onWorkDetailClick = () => {
    const workItem = registrationForm.getFieldValue("workItem");
    if (!workItem) {
      window.JSSDK.toast.warning("请先选择登记对象");
      return;
    }
    setIsDetailOpen(true);
  };

  /** 工作项改变 */
  const onWorkItemChange = (value) => {
    if (!value) {
      registrationForm.setFieldValue("workItem", []);
      setWorkItemInfo({});
      setIsShowDetailBtnOpen(false);
      setWorkItemId("");
      setWorkItemEntityId("");
      setSelectedCustomFieldValue(null);
      setNodeId("");
      setTaskId("");
    } else {
      setWorkItemId(value[0]);
      setWorkItemEntityId(value[1]);
      setNodeId(value[2]);
      setTaskId(value[3]);
      if(value[3] && registeredName?.taskName){
        if(registeredName?.canRegisterLevel){
          setCanSubmitByLevel(true)
        }else{
          setCanSubmitByLevel(false)
          handleLevelValidation(registeredName)
        }
      }
    }
    setWorkItem(value);
    if (value?.length > 1) {
      registrationForm.setFieldValue("workItem", value);
    }
  };

  const onRegisteredNameChange = (value) => {
    setRegisteredName(value);
    if (Object.prototype.hasOwnProperty.call(value || {}, "customFieldValue")) {
      setSelectedCustomFieldValue(value.customFieldValue ?? null);
    }
  };

  /** 分页点击 */
  /**
   * 分页变化处理函数
   * @param {number} page - 当前页码
   * @param {number} pageSize - 每页显示条数
   */
  const onPaginationChange = (page, pageSize) => {
    if (workInstancePagination.pageSize !== pageSize) {
      // 更改页大小时重置为第一页
      setWorkInstancePagination({ ...{ pageSize, pageNum: 1 } });
    } else {
      // 仅更改页码
      setWorkInstancePagination({ ...{ pageSize, pageNum: page } });
    }
  };

  /**
   * 实际工时变化处理函数
   * 根据标准工时计算人天数
   * @param {number} e - 输入的实际工时
   */
  const onActWorkHour = (e) => {
    if (!standWorkHour) return;
    setActDay((e / standWorkHour).toFixed(2));
  };

  /** 时间改变 */
  /**
   * 时间范围变化处理函数
   * @param {Array} date - 日期对象数组
   * @param {Array} dateString - 日期字符串数组
   */
  const onTimeChange = (date, dateString) => {
    setBeginTime(dateString[0]);
    setEndTime(dateString[1]);
  };

  /**
   * 工作日期变化处理函数
   * @param {Object} date - 日期对象
   * @param {string} dateString - 日期字符串
   */
  const onWorkDateChange = (date, dateString) => {
    if (!date) return;
    setWorkDate(date.$d);
  };

  /**
   * 工时登记提交处理函数
   * @param {Object} values - 表单提交的值
   */
  const onRegistrationOk = async (values) => {
    setSubmitLoadings(true);
    
    // 仅处理单个登记类型
    if (registrationType === "single") {
      // 判断是否为编辑模式
      if (registrationForm.getFieldValue("id")) {
        // 审批模式下的编辑处理
        if (props?.type === "approval") {
          await handleApprovalEdit(values);
        } else {
          // 普通模式下的编辑处理
          await handleNormalEdit(values);
        }
      } else {
        // 新增工时登记
        await handleNewRegistration(values);
      }
    }
    
    setSubmitLoadings(false);
  };

  /**
   * 处理审批模式下的编辑操作
   * @param {Object} values - 表单值
   */
  const handleApprovalEdit = async (values) => {
    const data = {
      id: registrationForm.getFieldValue("id"),
      type: "again_launch",
      actWorkHour: values?.actWorkHour,
      workDesc: values?.workDesc,
      workDate: values?.workDate,
      modifyType: values?.modifyType,
      projectName,
      customFieldValue: props?.setRegistrationValue?.customFieldValue ?? null,
    };
    
    const res = await postApproveHandle(data);
    if (res?.result) {
      window.JSSDK.toast.success("编辑成功");
      props.getRegistrationValue(true);
      registrationForm.resetFields();
    } else {
      // 处理特定错误码，避免重复提示
      if(res?.data?.code){
        if (![10024, 10025, 30068, 30073, 30074, 30075].includes(res?.data?.code)) {
          window.JSSDK.toast.warning("编辑失败，请重试");
        }
      }
    }
  };

  /**
   * 处理普通模式下的编辑操作
   * @param {Object} values - 表单值
   */
  const handleNormalEdit = async (values) => {
    const data = {
      id: registrationForm.getFieldValue("id"),
      workItemId,
      workItemEntityId,
      nodeId,
      taskId,
      actWorkHour: values.actWorkHour,
      workDesc: values.workDesc,
      workDate: values.workDate,
      taskHourId: props.setRegistrationValue.taskHourId,
      registrantUserKey: values?.registrantUserKey,
      projectName,
      customFieldValue: props?.setRegistrationValue?.customFieldValue ?? null,
    };
    
    const res = await postUpdateNodeWorkHour(data);
    if (res?.result) {
      window.JSSDK.toast.success("编辑成功");
      props.getRegistrationValue(true);
      registrationForm.resetFields();
    } else {
      // 处理特定错误码，避免重复提示
      if(res?.data?.code){
        if (![10024, 10025, 30068, 30073, 30074, 30075].includes(res?.data?.code)) {
          window.JSSDK.toast.warning("编辑失败，请重试");
        }
      }
    }
  };

  /**
   * 处理新增工时登记
   * @param {Object} values - 表单值
   */
  const handleNewRegistration = async (values) => {
    const data = {
      projectName,
      workItemId,
      workItemEntityId,
      nodeId,
      taskId,
      actWorkHour: values.actWorkHour,
      workDesc: values.workDesc,
      workDate: values.workDate,
      staffUserKey: values?.registrantUserKey,
      registrantUserKey: values?.registrantUserKey,
      schedule: workItemInfo?.schedule,
      scheduleStart: workItemInfo?.schedule?.split("~")[0],
      scheduleEnd: workItemInfo?.schedule?.split("~")[1],
      estimatedWorkingHoursAll: Number(
        workItemInfo?.estimatedWorkingHours?.split("/")[0]
      ),
      estimatedWorkingHoursSelf: Number(
        workItemInfo?.estimatedWorkingHours?.split("/")[1]
      ),
      estimatedWorkingHours: workItemInfo?.estimatedWorkingHours,
      workItemName: registeredName?.workItemName,
      workItemEntityName: registeredName?.workItemEntityName,
      nodeName: registeredName?.nodeName,
      taskName: registeredName?.taskName,
      customFieldValue: selectedCustomFieldValue ?? null,
    };
    
    const res = await postInsertNodeWorkHour(data);
    if (res?.result) {
      window.JSSDK.toast.success(`${submitBtnTxt}成功`);
      registrationForm.resetFields();
      props.getRegistrationValue(true);
      
      // 记录用户操作行为
      if (props?.point === "control") {
        getUserActive("ControlActBatchRegistrationWorkingHours");
      } else {
        getUserActive("PageActOnceRegistrationWorkingHours");
      }
    } else {
      // 处理特定错误码，避免重复提示
      if(res?.data?.code){
        if (![10024, 10025, 30068, 30073, 30074, 30075].includes(res?.data?.code)) {
          window.JSSDK.toast.warning(`${submitBtnTxt}失败，请重试`);
        }
      }
    }
  };

  /**
   * 取消工时登记
   * 重置表单并通知父组件关闭
   */
  const onRegistrationCancel = () => {
    registrationForm.resetFields();
    props.getRegistrationValue(false);
  };

  /**
   * 选择被登记人处理函数
   * @param {string} val - 选择的用户ID
   */
  const onSearchPersonChange = (val) => {
    if (val) {
      // 先设置用户
      setRegistrantUserKey(val);
      registrationForm.setFieldValue("registrantUserKey", val);
    
      if(props?.point === "control"){
        const { workItem, registeredName, loginUser } = props;
        const queryData = {
          workItem: {
            workItemEntityId: workItem.workItemEntityId,
            workItemId: workItem.workItemId,
          },
          loginUser: {
            id:val ,
          }
        };
        // 调用API获取工作项实例选项数据
      
          if(workItem?.nodeId){
          return getEntityNodeOption(queryData);
          }else{
         return  getItemEntityOptio(queryData);
          }
       

        // getEntityNodeOptionNew(queryData);
      }

      if(ingsConfig==1){
        // 彻底注释掉清空登记对象的逻辑，保留原有逻辑
        
        // 使用ref调用组件的resetSelection方法彻底清空选择
        if (workNodeSelectRef.current && typeof workNodeSelectRef.current.resetSelection === 'function') {
          workNodeSelectRef.current.resetSelection();
        }
        
        // 全面清空本地状态和表单
    
        setWorkItem([]); // 清空本地状态
        registrationForm.setFieldValue("workItem", []); // 清空表单
        setCurFlowType(null); // 清空流程类型
        setRegisteredName(''); // 清空已登记名称
        setWorkItemInfo({}); // 清空工作项信息
        setWorkItemId(""); // 清空工作项ID
        setWorkItemEntityId(""); // 清空工作项实体ID
        setNodeId(""); // 清空节点ID
        setTaskId(""); // 清空任务ID
        onWorkItemChange([]); // 通知父组件
        setIsShowDetailBtnOpen(false); // 隐藏详情按钮
       
      }
    } else {
      // 未选择用户时默认设置为当前登录用户
      setRegistrantUserKey(props?.loginUser?.id);
      registrationForm.setFieldValue("registrantUserKey", props?.loginUser?.id);
    }
  };

  const onValuesChange = (values, allValues) => {
    //  成员判断，如果没成员为空自动变更为当前填报人
    if (!allValues.registrantUserKey) {
      setRegistrantUserKey(props?.loginUser?.id);
      registrationForm.setFieldValue("registrantUserKey", props?.loginUser?.id);
    } else {
      setRegistrantUserKey(allValues.registrantUserKey);
    }
    if (values?.actWorkHour) {
      values.actWorkHour = Number(values?.actWorkHour.toFixed(2));
      registrationForm.setFieldValue(
        "actWorkHour",
        Number(values?.actWorkHour.toFixed(2))
      );
    }
    // 计算人员饱和度咯...
    if ("actWorkHour" in values && allValues?.workDate) {
      values.actWorkHour = values.actWorkHour ? values.actWorkHour : 0;
      const actWorkHourNum = Number(values.actWorkHour) || 0;
      const isSameDate = props?.setRegistrationValue
        ? dayjs(allValues?.workDate).format("YYYY-MM-DD") === dayjs(props?.setRegistrationValue?.workDate || props?.setRegistrationValue?.workDate).format("YYYY-MM-DD")
        : false;
      const newAlertDetail = calcSaturationData(
        alertDetailOld,
        actWorkHourNum,
        props?.setRegistrationValue,
        isSameDate
      );
      setAlertDetail(newAlertDetail);
    }
    if (values?.workDate) {
      if (props?.setRegistrationValue) setIsEditChangeAlert(true);
      setWorkDate(dayjs(values?.workDate).format("YYYY-MM-DD"));
    }
    if (!allValues?.workDate) {
      setWorkDate("");
    }
    if (registrationForm.getFieldValue("id")) {
      if (!allValues?.workDesc) allValues.workDesc = "";
      let workDesc = "";
      if (props?.setRegistrationValue?.workDesc)
        workDesc = props?.setRegistrationValue?.workDesc;
      if (
        allValues.actWorkHour !==
          (props?.type === "approval"
            ? props.setRegistrationValue?.actWorkHour
            : props.setRegistrationValue?.act_hour) ||
        dayjs(allValues.workDate).format("YYYY-MM-DD") !==
          dayjs(props?.setRegistrationValue?.workDate).format("YYYY-MM-DD") ||
        allValues.workDesc !== workDesc
      ) {
        setSubmitBtnDisabled(false);
      } else {
        setSubmitBtnDisabled(true);
      }
    }
  };

  return (
    <div className="registration-warp" style={{overflowY:"hidden"}}>
      <Spin
        spinning={spinning || attendanceSyncing}
        // tip={attendanceSyncing ? "同步考勤中..." : undefined}
        style={{ height: "100%" }}
      >
        {/* {props.setRegistrationValue || props?.point === "control" ? null : (
          <Radio.Group
            value={registrationType}
            onChange={(e) => setRegistrationType(e.target.value)}
            className="registration-top"
          >
            {regDisplayLogic?.showSingleRegistration ? (
              <Radio value="single">单项工作登记</Radio>
            ) : null}
            {regDisplayLogic?.showBatchRegistration ? (
              <Radio value="batch">批量登记工时</Radio>
            ) : null}
          </Radio.Group>
        ) : null} */}
        {registrationType === "batch" ? (
         <div
            className="registration-content"
            style={props?.type === "tab" ? 
              { height: "675px", position: "relative" } : 
              props?.wHeight >718 ? 
                { height: "645px", position: "relative" } : 
                { height: "85vh", position: "relative" }
            }
          >
            <RegWorkHourBatchNew
              {...props}
              loginUser={props?.loginUser}
              type="regWorkHour"
              getRegistrantUserKey={(val) => setRegistrantUserKey(val)}
              setSubmitLoadings={(val) => setSubmitLoadings(val)}
              setSaveHourLoadings={(val) => setSaveHourLoadings(val)}
              submitLoadings={submitLoadings}
              saveHourLoadings={saveHourLoadings}
              submitResult={(val) => {
                if (val==2) {window.JSSDK.toast.success(`${submitBtnTxt}成功`)};
                if (val==1) {props?.openType === "tab"? window.JSSDK.toast.success(`已暂存`):window.JSSDK.toast.success(`已暂存，下次打开将自动恢复`)};
                props.getRegistrationValue(val);
              }}
            />
            <div
              className="content-footer"
              style={{ position: "absolute", bottom: 0, width: "400px",right:'0'}}
            >
              <Space>
                <Button onClick={onRegistrationCancel}>取消</Button>
                {props?.openType === "again_launch" ? null : (
                  <Button
                  loading={saveHourLoadings}
                  onClick={() => setSaveHourLoadings(true)}
                >
                  暂存
                </Button>
                )}
                <Button
                  loading={submitLoadings}
                  type="primary"
                  onClick={() => setSubmitLoadings(true)}
                >
                  {submitBtnTxt}
                </Button>
              </Space>
            </div>
          </div>
        ) : (
	   <div style={{ height:windowHeight,overflowY:"auto",paddingRight:"5px"}}>
          <Form
            form={registrationForm}
            name="basic"
            labelCol={{
              span: 6,
            }}
            wrapperCol={{
              span: 18,
            }}
            initialValues={{
              remember: true,
            }}
            onFinish={onRegistrationOk}
            autoComplete="off"
            labelAlign="left"
            className="reg-form"
            onValuesChange={onValuesChange}
          >
            <Alert
              className="registration-alert"
              message={
                <>
                   <div>
                  该成员当前工作日期
                  {attendanceReady && canShowAttendanceForContext && isAttendanceEnabled && mode !== 'space' && !workDate && attendanceHours === null && (
                    <span>考勤工时<span className="num">--小时</span>，</span>
                  )}
                  {!attendanceReady && canShowAttendanceForContext && isAttendanceEnabled && workDate && (
                    <span>考勤工时<span className="num">--小时</span>，</span>
                  )}
                  {attendanceReady && canShowAttendanceForContext && isAttendanceEnabled && workDate
                    && attendanceHours !== null && Number(attendanceHours) > 0 && (
                    <span>考勤工时<span className="num">{toFiniteNumber(attendanceHours)}小时</span>，</span>
                  )}
                  {attendanceReady && canShowAttendanceForContext && isAttendanceEnabled && workDate
                    && (attendanceHours === null || Number(attendanceHours) === 0) && missPunchPolicy === 2 && (
                    <span>无考勤记录，</span>
                  )}
                  {attendanceReady && canShowAttendanceForContext && isAttendanceEnabled && workDate
                    && (attendanceHours === null || Number(attendanceHours) === 0) && missPunchPolicy === 1 && (
                    <span>无考勤记录，暂不可登记工时，</span>
                  )}
                  总登记工时
                  <span className="num">
                    {regWorkingHours !== null && regWorkingHours !== undefined
                      ? toFiniteNumber(regWorkingHours)
                      : "--"}
                    小时
                  </span>
                  ，待审批工时  <span className="num">
                    {alertDetail?.approvalingWork !== undefined && alertDetail?.approvalingWork !== null
                      ? toFiniteNumber(alertDetail.approvalingWork)
                      : "--"}
                    小时
                  </span>
                   
                  <Tooltip
                    placement="bottom"
                    title={
                      <>
                        <div>
                         已登记工时：指该「成员」在当前「工作日期」成功登记的工时（已经在工时日志的工时）
                        </div>
                        <div>
                         待审批工时：指该「成员」在当前「工作日期」下处于待审批状态的工时
                        </div>
                        <div>
                         当前拟提交工时：指该「成员」在当前「工作日期」，正准备提交的工时
                        </div>
                         <div>
                         剩余可登记工时：「单天填报工时上限」减去该「成员」在当前「工作日期」的「已登记工时」「待审批工时」及「当前拟提交工时」之和
                        </div>
                         <div>
                        工作饱和度：（该「成员」在当前「工作日期」的「已登记工时」+「待审批工时」+「当前拟提交工时」）÷「单位人天标准工时」× 100%
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="icon" />
                  </Tooltip>
                  
                </div>
                <div>
                当前拟提交工时  <span className="num">
                    {registrationForm.getFieldValue('actWorkHour') !== undefined && registrationForm.getFieldValue('actWorkHour') !== null && alertDetail?.displayActWorkHour !== undefined
                       ? toFiniteNumber(alertDetail.displayActWorkHour)
                      : "--"}
                    {/* {typeof registrationForm.getFieldValue('actWorkHour') === "number"
                      ? registrationForm.getFieldValue('actWorkHour')
                      : "--"} */}
                    小时
                  </span> 
                  ，剩余可登记工时
                  <span className="num">
                    {alertDetail?.remainingWork !== undefined && alertDetail?.remainingWork !== null
                      ? toFiniteNumber(alertDetail.remainingWork)
                      : "--"}
                    小时
                  </span>
                  ，工作饱和度
                  <span className="num">
                    {alertDetail?.saturation !== undefined && alertDetail?.saturation !== null
                      ? toFiniteNumber(alertDetail.saturation)
                      : "--"}
                    %
                  </span>
                  {attendanceReady && canShowAttendanceForContext && isAttendanceEnabled && workDate && (
                    <span
                      className="attattendance-sync-btn"
                      // style={attendanceSyncing ? { opacity: 0.6, pointerEvents: "none" } : undefined}
                      onClick={handleSyncAttendance}
                    >
                      同步考勤
                      {/* {attendanceSyncing ? "同步中..." : "同步考勤"} */}
                    </span>
                  )}
                   

                </div>
                </>
                
                
              }
              type="info"
              showIcon
            />
            <Form.Item
              label="登记对象"
              name="workItem"
              rules={[
                {
                  required: true,
                  message: "登记对象不能为空",
                },
              ]}
              
       
            >
        
              {props.setRegistrationValue ? (
                workItem?.length ? (
                  <WorkNodeSelect
                    ref={workNodeSelectRef}
                    workItemName={workItemName}
                    disabled={props.setRegistrationValue || !canRegister}
                    userKey={registrantUserKey}
                    myselfFlag={ingsConfig}
                    filterWorkItem={true}
                    getWorkItem={onWorkItemChange}
                    getFlowType={(val) => setCurFlowType(val)}
                    getRegisteredName={onRegisteredNameChange}
                  />
                ) : null
              ) : props?.point === "control" ? (
                <WorkNodeCascaderControl
                  flowMode={props?.flowMode}
                  point={props?.point}
                  userKey={registrantUserKey}
                  myselfFlag ={ingsConfig}
                  workItem={props?.workItem}
                  getWorkItem={onWorkItemChange}
                  getFlowType={(val) => setCurFlowType(val)}
                  registeredName={registeredName}
                  getRegisteredName={onRegisteredNameChange}
                  disabled={!canRegister}
                />
              ) : (
                <WorkNodeSelect
                  ref={workNodeSelectRef}
                  point={props?.point}
                  filterWorkItem={true}
                  workItem={props?.workItem}
                  userKey={registrantUserKey}
                  myselfFlag={ingsConfig}
                  getWorkItem={onWorkItemChange}
                  getFlowType={(val) => setCurFlowType(val)}
                  getRegisteredName={onRegisteredNameChange}
                  disabled={!canRegister}
                />
              )}
               {!canRegister && (
                  <p style={{color: '#df000e', margin: '5px 0'}}>
                  非当前登记用户的负责人，无法登记
                  </p>
               )}
              {/* window.JSSDK.toast.success(`已暂存，下次打开将自动恢复`) */}
            </Form.Item>
            {canRegister && !canSubmitByLevel && (
               <p style={{color: '#df000e', margin: '-10px 0 5px 174px'}}>
                  {canSubmitByLevelInfo}
                  </p>
            )}
            <Form.Item label="排期">
              {workItemInfo?.schedule ? workItemInfo?.schedule : "--"}
            </Form.Item>
            <Form.Item
              label={
                <div className="form-item-label">
                  <span className="label-txt">预估工时</span>
                  <Tooltip
                    title={
                      <>
                        <div>
                          前者：指个人的预估工时，即当前「成员」在当前「登记对象」的「估分」
                        </div>
                        <div>
                          后者：指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              {workItemInfo?.estimatedWorkingHours
                ? workItemInfo?.estimatedWorkingHours
                : "--/--"}
            </Form.Item>
            <Form.Item
              label={
                <div className="form-item-label">
                  <span className="label-txt">已登记工时</span>
                  <Tooltip
                    title={
                      <>
                        <div>
                          前者：指个人已登记的总实际工时，即当前「成员」在当前「登记对象」已登记的总「实际工时」
                        </div>
                        <div>
                          后者：指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              {workItemInfo?.registeredWorkingHours ? (
                <>
                  {workItemInfo?.registeredWorkingHours}
                  {workItemInfo?.registered ? (
                    <Button type="link" onClick={onWorkDetailClick}>
                      查看明细
                    </Button>
                  ) : null}
                </>
              ) : (
                "--/--"
              )}
            </Form.Item>
            <Form.Item
              label={
                <div className="form-item-label">
                  <span className="label-txt">剩余工时</span>
                  <Tooltip title="计算方式：「剩余工时」 = 「预估工时」 - 「已登记工时」">
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              {workItemInfo?.remainingWork
                ? workItemInfo?.remainingWork
                : "--/--"}
            </Form.Item>
            <Form.Item
              label="工作日期"
              name="workDate"
              rules={[
                {
                  required: true,
                  message: "工作日期不能为空",
                },
              ]}
            >
            <DatePicker size="small" disabled={!canRegister || !canSubmitByLevel} onChange={(date, dateString) => {
              const hourValue = registrationForm.getFieldValue('actWorkHour');
              // 不用真值判断：回显 0 会被当成「无值」而跳过重校验
              if (hourValue !== undefined && hourValue !== null && hourValue !== '') {
                registrationForm.validateFields(['actWorkHour']).catch(() => {});
              }
            }}/>
            </Form.Item>
            <Form.Item
              label="成员"
              name="registrantUserKey"
              rules={[
                {
                  required: true,
                  message: "成员不能为空",
                },
              ]}
            >
              {props.setRegistrationValue ? (
                <div
                  style={{
                    width: "inherit",
                    padding: "0 7px",
                    background: "rgba(0, 0, 0, 0.04)",
                    color: "#BBBBBB",
                    border: "1px solid #EDEDED",
                    borderRadius: "6px",
                    lineHeight: "25px",
                  }}
                >
                  <div className="selected-item">
                    <Avatar
                      className="selected-item-icon"
                      size={20}
                      src={props.setRegistrationValue?.avatarUrl}
                      icon={<img alt="" src={UserOutlined} />}
                    />
                    <span className="selected-item-name">
                      {props.setRegistrationValue?.userName}
                    </span>
                  </div>
                </div>
              ) : (
                <UserPicker
                  size="small"
                  loginUser={props?.loginUser}
                  disabled={
                    !isAllowRegister ||
                    !canShowTenantAdminFeature()
                    // !canRegister
                  }
                  registrantUserKey={registrantUserKey}
                  getUserIds={onSearchPersonChange}
                />
              )}
            </Form.Item>
            <Form.Item
              label={
                <div>
                  <span style={{ color: "#df000e", fontSize: 14 }}>* </span>
                  登记工时
                </div>
              }
            >
              <Space>
                <Form.Item
                  shouldUpdate
                  name="actWorkHour"
                  validateFirst
                  rules={[
                    {
                      required: true,
                      message: "工时不能为空",
                    },
                    {
                      validator: (_, value) => {
                        // 场景4: 缺卡-不允许提交，提示不可登记工时
                        const workDateVal = registrationForm.getFieldValue("workDate");
                        const workDateStr = workDateVal ? dayjs(workDateVal).format("YYYY-MM-DD") : '';
                        if (!workDateStr) return Promise.resolve();
                        if (mode === 'space' && !hasSelectedWorkItem) return Promise.resolve();
                        const snap = capacitySnapshotRef.current;
                        const snapMatches = snap && snap.workDate === workDateStr && snap.userKey === registrantUserKey;
                        if (!snapMatches) return Promise.resolve();
                        // 使用snap中的考勤配置值（由getAlertDetail写入，避免闭包state过时）
                        const _snapEnabled = snap.attendanceEnabled ?? 0;
                        const _snapHours = snap.attendanceHours;
                        const _snapPolicy = snap.missPunchPolicy ?? 1;
                        if (_snapEnabled === 1
                          && (_snapHours === null || Number(_snapHours) === 0)
                          && Number(_snapPolicy) === 1) {
                          return Promise.reject(new Error('当天无考勤记录，不可登记工时'));
                        }
                        return Promise.resolve();
                      },
                    },
                    {
                      validator: (_, value) => {
                        if (value === undefined || value === null || value === '') {
                          return Promise.resolve();
                        }
                        const numVal = Number(value);
                        if (!Number.isFinite(numVal)) {
                          return Promise.reject(new Error('请输入有效数字'));
                        }
                        // 下限校验
                        const min = Number(capacitySet?.onceDown) || 0;
                        if (numVal < min) {
                          return Promise.reject(new Error(`低于单次填报工时下限${min}小时`));
                        }
                        const workDateVal = registrationForm.getFieldValue("workDate");
                        const workDateStr = workDateVal ? dayjs(workDateVal).format("YYYY-MM-DD") : '';
                        if (mode === 'space' && !hasSelectedWorkItem) return Promise.resolve();
                        const snap = capacitySnapshotRef.current;
                        const snapMatches = snap && snap.workDate === workDateStr && snap.userKey === registrantUserKey;
                        // 快照未就绪：暂不做上限校验，避免误报；getAlertDetail 返回后会重校验。
                        if (!snapMatches) {
                          return Promise.resolve();
                        }
                        // 使用snap中的考勤配置值（由getAlertDetail写入，避免闭包state过时）
                        const _snapEnabled = snap.attendanceEnabled ?? 0;
                        const _snapHours = snap.attendanceHours;
                        const _snapPolicy = snap.missPunchPolicy ?? 1;
                        const _snapCustomLimit = snap.missPunchCustomLimit;
                        const snapRemaining = Number(snap.remainingWork);
                        // 根据场景确定单天填报上限（用于错误提示）
                        let upperLimit;
                        if (_snapEnabled === 0) {
                          upperLimit = Number(snap.dayUp) || Number(capacitySet?.dayUp) || 24; // 场景1: dayUp
                        } else if (_snapHours !== null && _snapHours !== undefined && Number(_snapHours) > 0) {
                          upperLimit = _snapHours; // 场景2: 考勤工时
                        } else if (_snapPolicy === 2 && _snapCustomLimit !== null) {
                          upperLimit = _snapCustomLimit; // 场景3: 缺卡自定义提交上限
                        } else {
                          upperLimit = 0; // 场景4: 不应到达（已由前置校验器拦截）
                        }
                        const isEditSameDate = !!props?.setRegistrationValue && workDateStr &&
                          workDateStr === dayjs(props.setRegistrationValue?.workDate).format("YYYY-MM-DD");
                        const editOldHour = isEditSameDate
                          ? (Number(props?.type === "approval"
                              ? props.setRegistrationValue?.actWorkHour
                              : props.setRegistrationValue?.act_hour) || 0)
                          : 0;
                        // 提交后剩余工时
                        const remainingAfterSubmit = Number(
                          ((isEditSameDate ? snapRemaining + editOldHour : snapRemaining) - numVal).toFixed(2)
                        );
                        // 缺卡不允许提交由前一条规则单独提示；其余三种场景均需要校验单日上限。
                        const hasUsableUpperLimit = _snapEnabled === 0
                          || (_snapHours !== null && Number(_snapHours) > 0)
                          || (_snapPolicy === 2 && _snapCustomLimit !== null);
                        if (alertDetail?.remainingWork < 0 && hasUsableUpperLimit) {
                          return Promise.reject(new Error(`当天填报工时超过上限工时 ${upperLimit} 小时`));
                        }
                        return Promise.resolve();
                      },
                    },
                    {
                      validator: (_, value) => {
                        const { enabled, hour } = granularityRef.current;
                        if (enabled !== 1 || !hour) return Promise.resolve();
                        if (value === undefined || value === null || value === '') return Promise.resolve();
                        const numVal = Number(value);
                        if (!Number.isFinite(numVal)) return Promise.resolve();
                        // 整数倍校验（浮点精度容差）
                        const remainder = Math.round((numVal % hour) * 1e6) / 1e6;
                        if (remainder !== 0 && Math.abs(remainder - hour) > 1e-6) {
                          return Promise.reject(new Error(`填报工时必须是 ${hour} 的整数倍`));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                  noStyle
                >
                  <InputNumber 
                    placeholder="请输入工时"
                    size="small" 
                    style={{ 
                      width: "140px",
                    }}
                    onChange={onActWorkHour} 
                    disabled={!canRegister || !canSubmitByLevel}
                    precision={2}
                    formatter={(value) => {
                      if (value === null || value === undefined) {
                        return value;
                      }
                      if (value && value.toString().includes('.')) {
                        const parts = value.toString().split('.');
                        if (parts[1] && parts[1].length > 2) {
                          return `${parts[0]}.${parts[1].slice(0, 2)}`;
                        }
                      }
                      return value;
                    }}
                    parser={(value) => {
                      if (value === null || value === undefined) {
                        return value;
                      }
                      if (typeof value === 'string') {
                        // 将全角小数点转换为半角
                        const normalizedValue = value.replace('。', '.');
                        // 只保留数字和小数点
                        const filteredValue = normalizedValue.replace(/[^0-9.]/g, '');
                        if (filteredValue.includes('.')) {
                          const parts = filteredValue.split('.');
                          if (parts[1] && parts[1].length > 2) {
                            return parseFloat(`${parts[0]}.${parts[1].slice(0, 2)}`);
                          }
                        }
                        return filteredValue === '' ? null : parseFloat(filteredValue) || filteredValue;
                      }
                      return value === '' ? null : parseFloat(value) || value;
                    }}
                    // 处理中文输入法开始组合输入
                    onCompositionStart={() => {
                      setIsComposing(true);
                    }}
                    // 处理中文输入法结束组合输入
                    onCompositionEnd={(e) => {
                      setIsComposing(false);
                      // 组合输入结束后，清理输入内容
                      if (e.target && e.target.value) {
                        const value = e.target.value;
                        // 只保留数字、半角小数点和全角小数点
                        const filteredValue = value.replace(/[^0-9.。]/g, '')
                          .replace('。', '.'); // 转换全角为半角
                        
                        // 更新输入框值
                        e.target.value = filteredValue;
                        
                        // 触发onChange事件
                        if (onActWorkHour) {
                          onActWorkHour(filteredValue === '' ? null : parseFloat(filteredValue) || filteredValue);
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // 阻止输入超过两位小数
                      if (!e || !e.target) {
                        return;
                      }
                      
                      // 允许控制键
                      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || 
                          e.key === 'ArrowRight' || e.key === 'Tab' || e.key === 'Enter' || 
                          e.ctrlKey || e.metaKey) {
                        return;
                      }
                      
                      // 在中文输入法组合输入期间，不处理字符限制
                      if (isComposing) {
                        return;
                      }
                      
                      // 只允许数字 0-9、半角小数点和全角小数点
                      if (!((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === '。')) {
                        e.preventDefault();
                        return;
                      }
                      
                      const target = e.target;
                      let value = target.value || '';
                      
                      // 处理全角小数点
                      if (e.key === '。') {
                        // 立即阻止默认行为
                        e.preventDefault();
                        
                        // 检查是否已经存在小数点
                        if (value.includes('.') || value.includes('。')) {
                          return;
                        }
                        
                        // 将全角小数点转换为半角并插入到输入框
                        const normalizedValue = value.replace('。', '.');
                        const cursorPosition = target.selectionStart;
                        const newValue = normalizedValue.slice(0, cursorPosition) + '.' + normalizedValue.slice(cursorPosition);
                        
                        // 更新输入框值
                        target.value = newValue;
                        
                        // 设置光标位置到小数点后
                        const newCursorPosition = cursorPosition + 1;
                        target.setSelectionRange(newCursorPosition, newCursorPosition);
                        
                        // 触发onChange事件
                        if (onActWorkHour) {
                          onActWorkHour(parseFloat(newValue) || newValue);
                        }
                        
                        return;
                      }
                      
                      // 处理半角小数点
                      if (e.key === '.') {
                        // 检查是否已经存在小数点
                        if (value.includes('.') || value.includes('。')) {
                          e.preventDefault();
                          return;
                        }
                      }
                        
                      // 如果已经有小数点，检查小数位数
                      const normalizedValue = value.replace('。', '.');
                      if (normalizedValue.includes('.')) {
                        const parts = normalizedValue.split('.');
                        // 只有当光标在小数点之后才检查小数位数
                        const cursorPosition = target.selectionStart;
                        const decimalPosition = normalizedValue.indexOf('.') + 1;
                            
                        if (parts[1] && parts[1].length >= 2 && cursorPosition > decimalPosition) {
                          e.preventDefault();
                          return;
                        }
                      }
                    }}
                    // 添加 onInput 事件进行最后的验证
                    onInput={(e) => {
                      if (!isComposing && e.target && e.target.value) {
                        const value = e.target.value;
                        // 只保留数字和小数点
                        const filteredValue = value.replace(/[^0-9.]/g, '');
                        
                        if (value !== filteredValue) {
                          e.target.value = filteredValue;
                          
                          if (onActWorkHour) {
                            onActWorkHour(filteredValue === '' ? null : parseFloat(filteredValue) || filteredValue);
                          }
                        }
                      }
                    }}
                  />
                </Form.Item>
                <span>小时</span>
                <span>{actDay ? `（${actDay} 人天）` : ""}</span>
              </Space>
            </Form.Item>
            <Form.Item 
              label={
                <span>
                  {/* {workDescRequired===1 && <span style={{ color: "#df000e", fontSize: 14 }}>*</span>} */}
                  工作描述
                </span>
              } 
              name="workDesc"
              rules={[
                {
                  required: workDescRequired?true:false,
                  message: '请输入工作描述'
                }
              ]}
            >
              <Input.TextArea
                style={{
                  resize: "none",
                  margin: "5px 0",
                }}
                showCount
                maxLength={200}
                placeholder="请输入"
                rows={4}
                disabled={!canRegister || !canSubmitByLevel}
              />
            </Form.Item>
            {props.type === "mob" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-around",
                  lineHeight: 3,
                }}
              >
                <Button
                  style={{ width: "40%" }}
                  htmlType="reset"
                  onClick={onRegistrationCancel}
                >
                  取消
                </Button>
                <Button
                  style={{ width: "40%" }}
                  type="primary"
                  htmlType="submit"
                  loading={submitLoadings}
                >
                  {submitBtnTxt}
                </Button>
              </div>
            ) : (
              <div
                style={{
                  textAlign: "right",
                  position: "absolute",
                  right: "0",
                  bottom: "0",
                }}
              >
                <Space>
                  <Button htmlType="reset" onClick={onRegistrationCancel}>
                    取消
                  </Button>
                  <Button
                    disabled={submitDisabled || !canSubmitByLevel}
                    loading={submitLoadings}
                    type="primary"
                    htmlType="submit"
                  >
                    {submitBtnTxt}
                  </Button>
                </Space>
              </div>
            )}
          </Form>
	   </div>
        )}
      </Spin>
      <Modal
        // title="已登记工时明细"
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        width={"700px"}
        footer={null}
        style={{ top: 80 }}
        destroyOnClose
      >
        <TaskDetail
          logId={props?.setRegistrationValue?.id}
          type={props?.type}
          flowMode={curFlowType}
          workItem={{
            workItemId,
            workItemEntityId,
            nodeId,
            taskId,
          }}
          workItemName={workItemName}
        />
      </Modal>
    </div>
  );
};

export default RegWorkHour;

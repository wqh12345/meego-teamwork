import React, { Component, useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Table,
  Button,
  Avatar,
  Modal,
  message,
  Space,
  Tooltip,
  Switch,
  Tag
} from "antd";
import {
  UserOutlined,
  CloseOutlined,
  InfoCircleFilled,
  ExclamationCircleFilled,
  SyncOutlined,
  RightOutlined,
  ArrowLeftOutlined,
  DownOutlined,
  UpOutlined
} from "@ant-design/icons";
import {
  getStandWorkHour,
  getRegistrationSettings,
  getProjectAdminList,
  postSetProjectAdmin,
  postSetProjectMember,
  getProjectConfig,
  postProjectConfig,
  getMeasureProjectConfig,
  getApproveConfig,
  getRefreshTeam,
  getApprovalSettings,
  queryDataAuthConfigCount,
  getDataAuthConfig,
  getWorkHourReminderConfig,
  getStandardsConfig,
  getStandardsConfigDetail,
  deleteSpecialNodeFlowConfig,
  deleteDataAuthConfig
} from "../../../../api/api";
import SelectedUser from "../selected-user/SelectedUser";
import "./Set.less";
import MeasureSet from "./components/measure-set/MeasureSet";
import WorkHourSettings from "./components/capacity-set/WorkHourSettings";
import ApprovalSet from "./components/approval-set/ApprovalSet";
import NotificationSet from "./components/notification-set/notificationSet";
import PermissionsSet from "./components/permissions-set/permissionsSet";
import StandardsSet from "./components/standards-set/StandardsSet";
import { isIsvInstalled } from "./components/standards-set/attendance-config/attendanceConfig";
import { UserTag } from '@lark-project/ui-kit-plugin';
import deptAvatar from "../../../../image/dept.png";
import teamAvatar from "../../../../image/team.png";
import setIcon1 from "../../../../image/set/1.png";
import setIcon1Active from "../../../../image/set/1_active.png";
import setIcon2 from "../../../../image/set/2.png";
import setIcon2Active from "../../../../image/set/2_active.png";
import setIcon3 from "../../../../image/set/3.png";
import setIcon3Active from "../../../../image/set/3_active.png";
import setIcon4 from "../../../../image/set/4.png";
import setIcon4Active from "../../../../image/set/4_active.png";
import setIcon5 from "../../../../image/set/5.png";
import setIcon5Active from "../../../../image/set/5_active.png";
import setIcon6 from "../../../../image/set/6.png";
import setIcon6Active from "../../../../image/set/6_active.png";
import setIcon7 from "../../../../image/set/7.png";
import setIcon7Active from "../../../../image/set/7_active.png";

const SETTING_SECTIONS = [
  { key: 'registration', label: '登记设置', icon: setIcon1, activeIcon: setIcon1Active },
  { key: 'measure', label: '统计设置', icon: setIcon2, activeIcon: setIcon2Active },
  { key: 'standards', label: '记录规范设置', icon: setIcon3, activeIcon: setIcon3Active },
  { key: 'approval', label: '工时审批设置', icon: setIcon4, activeIcon: setIcon4Active },
  { key: 'permissions', label: '权限设置', icon: setIcon5, activeIcon: setIcon5Active },
  { key: 'notification', label: '消息通知', icon: setIcon6, activeIcon: setIcon6Active },
  { key: 'admin', label: '插件管理员', icon: setIcon7, activeIcon: setIcon7Active },
];

const Set = (props) => {
  const [capacityInitialValues, setCapacityInitialValues] = useState({});
  const [isCapacityFormOpen, setIsCapacityFormOpen] = useState(false);
  const [isMeasureFormOpen, setIsMeasureFormOpen] = useState(false);
  const [isApprovalFormOpen, setIsApprovalFormOpen] = useState(false);
  const [authorityLoading, setAuthorityLoading] = useState(false);
  const [config, setConfig] = useState({});
  const [configMeasure, setConfigMeasure] = useState({});
  const [configApproval, setConfigApproval] = useState({});
  // 是否已安装 ISV：飞书审批信息展示的总开关。判定与 StandardsSet / ApprovalSet 共用 isIsvInstalled，
  // 数据源为 api/tenant/mode/info 下发到 sessionStorage 的 tenantModeInfo。
  const isvInstalled = useMemo(() => {
    try {
      return isIsvInstalled(JSON.parse(sessionStorage.getItem('tenantModeInfo') || '{}'));
    } catch (_) {
      return false;
    }
  }, []);
  // 飞书审批模式：仅在已安装 ISV 且后端 approvalType 为 2 时成立。
  // 未安装场景下即使后端返回 2 也不成立，保证摘要区与迁移前完全一致。
  const isFeishuApproval = isvInstalled && Number(configApproval?.approvalType) === 2;
  const [isAdd, setIsAdd] = useState(1);
  const [standardsConfigList, setStandardsConfigList] = useState([]);
  const [isStandardsFormOpen, setIsStandardsFormOpen] = useState(false);
  const authorityColumns = [
    {
      title: "成员",
      dataIndex: "name",
      key: "name",
      width: 130,
      render: (_, record) => (
        <div className="table-columns-item">
          {record.staffUserKey?<UserTag userId={record.staffUserKey} name={record.staffName} avatar={record.staffAvatarUrl}/>:null}
        </div>
      ),
    },
    {
      title: "添加人",
      dataIndex: "operateUser",
      key: "operateUser",
      width: 130,
      render: (_, record) => (
        <div className="table-columns-item">
          {record.operatorUserKey?<UserTag userId={record.operatorUserKey} name={record.operatorName} avatar={record.operatorAvatarUrl}/>:null}
        </div>
      ),
    },
    {
      title: "添加时间",
      dataIndex: "operationTime",
      key: "operationTime",
      width: 130,
    },
    {
        title: "操作",
        key: "operate",
        width: 120,
        fixed: "right",
        render: (_, record) => {
          // 定义单独的处理函数
          const handleDelete = () => {
            onDelAuthorityClick(record);
          };
          
          return (
            <Space size="middle">
              {record.staffUserKey === props?.loginUser.id ? (
                "当前账号"
              ) : (
                <Button
                  className="opt-btn"
                  type="link"
                  onClick={handleDelete} // 使用单独的处理函数
                >
                  删除
                </Button>
              )}
            </Space>
          );
        },
      },
  ];
  const [authorityList, setAuthorityList] = useState([]);
  const [authorityPagination, setAuthorityPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
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
  const [registrationSettingsConfig, setRegistrationSettingsConfig] = useState({});
  // 添加已选择的审批人状态
  const [selectedApprovalUsers, setSelectedApprovalUsers] = useState([
    {
      id: '1',
      name: '八九 八九'
    },
    {
      id: '2',
      name: '小林丹',
      isBlue: true
    },
    {
      id: '3',
      name: '小林丹',
      isBlue: true
    }
  ]);
  const [isPermissionsFormOpen, setIsPermissionsFormOpen] = useState(false);
  const [hasConfigCount, setHasConfigCount] = useState(0);
  const [authConfigs, setAuthConfigs] = useState([]);
  const [showAllAuthRules, setShowAllAuthRules] = useState(false);
  const [isPermissionsCollapsed, setIsPermissionsCollapsed] = useState(false);
  const [registerRecordEnumList, setRegisterRecordEnumList] = useState([]);
  const [registerLevelConfigVos, setRegisterLevelConfigVos] = useState([]);
  const [workFlowObjectList, setWorkFlowObjectList] = useState([]); //过滤点飞书项目的状态流节点
  const [workItemKeyTypes, setWorkItemKeyTypes] = useState([]);
  const [isNotificationFormOpen, setIsNotificationFormOpen] = useState(false);
  const [remindCommonConfig, setRemindCommonConfig] = useState({});
  const [remindCommonConfigData, setRemindCommonConfigData] = useState({});
  const [remindAllUser, setRemindAllUser] = useState([]);
  const [standardConfigData, setStandardConfigData] = useState({});

  const [settingSections, setSettingSections] = useState(SETTING_SECTIONS);
  const [activeSection, setActiveSection] = useState(SETTING_SECTIONS[0].key);
  const [wrapHeight, setWrapHeight] = useState(0);
  const setWrapRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const sectionRefs = useRef({});
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef(null);
  const resizeRafRef = useRef(null);

  // 距底部预留间距，避免贴边
  const BOTTOM_RESERVED = 12;
  // 最小可用高度，防止极端情况下高度计算为负
  const MIN_AVAILABLE_HEIGHT = 320;

  const recalcWrapHeight = useCallback(() => {
    const wrapEl = setWrapRef.current;
    if (!wrapEl) return;
    const { top } = wrapEl.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const next = Math.max(viewportH - top - BOTTOM_RESERVED, MIN_AVAILABLE_HEIGHT);
    setWrapHeight((prev) => (prev === next ? prev : next));
  }, []);

  const registerSectionRef = useCallback((key) => (el) => {
    sectionRefs.current[key] = el || null;
  }, []);
  // useEffect(() => {
  //   console.log('configMeasure', configMeasure);
  // }, [configMeasure]);
  const scrollToSection = useCallback((key) => {
    // 当前是否处于某个二级页面
    const isInSecondary =
      isCapacityFormOpen ||
      isMeasureFormOpen ||
      isStandardsFormOpen ||
      isApprovalFormOpen ||
      isPermissionsFormOpen ||
      isNotificationFormOpen;

    // 先关闭所有二级页面
    if (isInSecondary) {
      isAutoScrollingRef.current = true; // 提前阻止自动更新 activeSection
      setIsCapacityFormOpen(false);
      setIsMeasureFormOpen(false);
      setIsStandardsFormOpen(false);
      setIsApprovalFormOpen(false);
      setIsPermissionsFormOpen(false);
      setIsNotificationFormOpen(false);
    }

    setActiveSection(key);

    // 等待 DOM 更新后再执行滚动
    const doScroll = () => {
      const targetEl = sectionRefs.current[key];
      const container = scrollContainerRef.current;
      if (!targetEl || !container) return;
      if (autoScrollTimerRef.current) clearTimeout(autoScrollTimerRef.current);
      // 使用 getBoundingClientRect 计算相对于滚动容器的精确位置，避免 offsetTop 受 offsetParent 影响导致偏差
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({
        top: Math.max(relativeTop, 0),
        behavior: 'smooth',
      });
      autoScrollTimerRef.current = setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 600);
    };

    if (isInSecondary) {
      // 二级页面关闭后需要等 React 重新渲染出 section 内容
      setTimeout(doScroll, 50);
    } else {
      isAutoScrollingRef.current = true;
      doScroll();
    }
  }, [
    isCapacityFormOpen,
    isMeasureFormOpen,
    isStandardsFormOpen,
    isApprovalFormOpen,
    isPermissionsFormOpen,
    isNotificationFormOpen,
  ]);

  const handleContainerScroll = useCallback(() => {
    // 二级页面打开时跳过，避免孤儿 DOM 节点或空内容干扰 activeSection 判定
    if (
      isCapacityFormOpen ||
      isMeasureFormOpen ||
      isStandardsFormOpen ||
      isApprovalFormOpen ||
      isPermissionsFormOpen ||
      isNotificationFormOpen
    )
      return;
    if (isAutoScrollingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const containerTop = container.getBoundingClientRect().top;
    let currentKey = settingSections[0]?.key || SETTING_SECTIONS[0].key;
    // 使用 getBoundingClientRect 精确计算每个 section 相对于容器顶部的距离
    settingSections.forEach((item) => {
      const el = sectionRefs.current[item.key];
      if (el) {
        const elTop = el.getBoundingClientRect().top - containerTop + scrollTop;
        if (elTop <= scrollTop + 8) {
          currentKey = item.key;
        }
      }
    });
    setActiveSection((prev) => (prev === currentKey ? prev : currentKey));
  }, [
    isCapacityFormOpen,
    isMeasureFormOpen,
    isStandardsFormOpen,
    isApprovalFormOpen,
    isPermissionsFormOpen,
    isNotificationFormOpen,
    settingSections,
  ]);

  // 进入二级页面时，将滚动容器 scrollTop 归零，避免残留旧滚动位置导致内容显示在底部
  useEffect(() => {
    if (
      isCapacityFormOpen ||
      isMeasureFormOpen ||
      isStandardsFormOpen ||
      isApprovalFormOpen ||
      isPermissionsFormOpen ||
      isNotificationFormOpen
    ) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 0);
    }
  }, [
    isCapacityFormOpen,
    isMeasureFormOpen,
    isStandardsFormOpen,
    isApprovalFormOpen,
    isPermissionsFormOpen,
    isNotificationFormOpen,
  ]);

  /** 二级页面返回：关闭内联页、刷新数据、恢复导航定位 */
  const handleBackToOverview = useCallback(() => {
    isAutoScrollingRef.current = true; // 提前阻止自动更新 activeSection
    setIsCapacityFormOpen(false);
    setIsMeasureFormOpen(false);
    setIsStandardsFormOpen(false);
    setIsApprovalFormOpen(false);
    setIsPermissionsFormOpen(false);
    setIsNotificationFormOpen(false);
    getCapacity();
    setActiveSection('registration');
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      // 滚动完成后恢复自动更新，但再给一点时间让 DOM 稳定
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }, 0);
  }, []);

  /** 统计设置二级页面返回 */
  const handleBackFromMeasure = useCallback((shouldRefresh = true) => {
    isAutoScrollingRef.current = true; // 提前阻止自动更新 activeSection
    setIsMeasureFormOpen(false);
    if (shouldRefresh) getMeasureConfig();
    setActiveSection('measure');
    setTimeout(() => {
      const targetEl = sectionRefs.current['measure'];
      const container = scrollContainerRef.current;
      if (targetEl && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({
          top: Math.max(relativeTop, 0),
          behavior: 'auto',
        });
      }
      // 滚动完成后恢复自动更新，但再给一点时间让 DOM 稳定
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }, 0);
  }, []);

  /** 记录规范设置二级页面返回 */
  const handleBackFromStandards = useCallback((shouldRefresh = true) => {
    isAutoScrollingRef.current = true; // 提前阻止自动更新 activeSection
    setIsStandardsFormOpen(false);
    if (shouldRefresh) getStandardsConfigInfo();
    setActiveSection('standards');
    setTimeout(() => {
      const targetEl = sectionRefs.current['standards'];
      const container = scrollContainerRef.current;
      if (targetEl && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({
          top: Math.max(relativeTop, 0),
          behavior: 'auto',
        });
      }
      // 滚动完成后恢复自动更新，但再给一点时间让 DOM 稳定
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }, 0);
  }, []);

  /** 工时审批设置二级页面返回 */
  const handleBackFromApproval = useCallback((shouldRefresh = true) => {
    isAutoScrollingRef.current = true; // 提前阻止自动更新 activeSection
    setIsApprovalFormOpen(false);
    if (shouldRefresh) {
      getConfig();
      getApprovalSettingsData();
    }
    setActiveSection('approval');
    setTimeout(() => {
      const targetEl = sectionRefs.current['approval'];
      const container = scrollContainerRef.current;
      if (targetEl && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({
          top: Math.max(relativeTop, 0),
          behavior: 'auto',
        });
      }
      // 滚动完成后恢复自动更新，但再给一点时间让 DOM 稳定
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }, 0);
  }, []);

  /** 消息通知二级页面返回 */
  const handleBackFromNotification = useCallback((shouldRefresh = true) => {
    isAutoScrollingRef.current = true; // 提前阻止自动更新 activeSection
    setIsNotificationFormOpen(false);
    if (shouldRefresh) getWorkHourReminderConfigInfo(false);
    setActiveSection('notification');
    setTimeout(() => {
      const targetEl = sectionRefs.current['notification'];
      const container = scrollContainerRef.current;
      if (targetEl && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({
          top: Math.max(relativeTop - 8, 0),
          behavior: 'auto',
        });
      }
      // 滚动完成后恢复自动更新，但再给一点时间让 DOM 稳定
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }, 0);
  }, []);

  /** 权限设置二级页面返回 */
  const handleBackFromPermissions = useCallback((shouldRefresh = true) => {
    isAutoScrollingRef.current = true; // 提前阻止自动更新 activeSection
    setIsPermissionsFormOpen(false);
    if (shouldRefresh) queryDataAuthConfigCountInfo();
    setActiveSection('permissions');
    setTimeout(() => {
      const targetEl = sectionRefs.current['permissions'];
      const container = scrollContainerRef.current;
      if (targetEl && container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({
          top: Math.max(relativeTop - 8, 0),
          behavior: 'auto',
        });
      }
      // 滚动完成后恢复自动更新，但再给一点时间让 DOM 稳定
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }, 0);
  }, []);

  // 初始化 + 监听窗口尺寸变化，确保右侧滚动容器自适应视窗高度
  useEffect(() => {
    recalcWrapHeight();

    const onResize = () => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(recalcWrapHeight);
    };

    window.addEventListener('resize', onResize);

    // 监听根元素尺寸变化（如侧边栏伸缩、字体缩放等导致的布局变化）
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(document.documentElement);
      // 监听父容器 config-warp 的尺寸变化，当 TopAlert 等动态内容出现/消失时重新计算高度
      const parentEl = setWrapRef.current?.parentElement;
      if (parentEl) {
        ro.observe(parentEl);
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      if (ro) ro.disconnect();
    };
  }, [recalcWrapHeight]);

  useEffect(() => {
    return () => {
      if (autoScrollTimerRef.current) clearTimeout(autoScrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let tenantModeInfo = JSON.parse(sessionStorage.getItem('tenantModeInfo'))
    // 根据租户模式动态设置左侧菜单项
    if(tenantModeInfo?.install && tenantModeInfo?.mode=="tenant"){
      // 租户模式：不显示记录规范设置和权限设置
      //console.log('租户模式')
      setSettingSections(SETTING_SECTIONS.filter(item => item.key !== 'standards' && item.key !== 'permissions'));
    }else if(tenantModeInfo?.install && tenantModeInfo?.mode=="space"){
      // 空间模式：显示全部菜单
      //console.log('空间模式')
      setSettingSections(SETTING_SECTIONS);
    }else if(!tenantModeInfo?.install && sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin"){
      // 未安装且为管理员：显示全部菜单
      //console.log('未安装应用')
      setSettingSections(SETTING_SECTIONS);
    }
    getCapacity();
    getAuthorityList();
    getConfig();
    getMeasureConfig();
    getStandardsConfigInfo()
    getRefreshTeamMember()
    getApprovalSettingsData()
    queryDataAuthConfigCountInfo()
    getWorkHourReminderConfigInfo(false)
  }, []);

  // 锁定页面本身不可滚动，滚动仅发生在右侧内容区
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);
  const allWorkObjectList=async()=>{
        try {
          const context = await window.JSSDK.Context.load();
          const space = await window.JSSDK.Space.load(context.mainSpace.id);
          let filterFlowMode=[]
          const getFilterFlowMode= async(workObjectId)=>{
            try {
              const data = await window.JSSDK.WorkObject.load({
                spaceId: context.mainSpace.id, // 请传入需查询的空间 id
                workObjectId: workObjectId, // 请传入需查询的工作项类型 id
              });
              if(data?.flowMode=='workflow'){
                  filterFlowMode.push(data.id)
              }
            } catch (error) {
              //console.error(`获取工作项类型${workObjectId}失败:`, error);
            }
          }
          // 使用Promise.all等待所有异步请求完成
          if (space.allWorkObjectList && Array.isArray(space.allWorkObjectList)) {
            //console.log('开始处理工作项类型，共', space.allWorkObjectList.length, '个');
            await Promise.all(
              space.allWorkObjectList.map(item => getFilterFlowMode(item.id))
            )
          } else {
            console.error('space.allWorkObjectList不是有效的数组:', space.allWorkObjectList);
          }
         setWorkFlowObjectList(filterFlowMode)
        } catch (error) {
          console.error('allWorkObjectList函数执行失败:', error);
        }
      }

  /** 查询登记设置 */
  const getCapacity = async () => {
    const res = await getRegistrationSettings();
    if (res?.result) {
      if(res?.data){
        const capacityInitialValuesData={
        "standWorkHour": res?.data?.standWorkHour || 0,//该空间标准工时
        "onceDown": res?.data?.onceDown || 0,//单次下线
        "dayUp": res?.data?.dayUp || 0,//单天上限
        }
        if(res?.data?.list && res?.data?.list.length==0){
          res?.data?.list?.push({
            "id": null,
            "projectKey": "68c954cd1a048327f3025e68",
            "canRegistWorkItemId": "0",
            "canRegistWorkItemName": "全部工作项",
            "entityStatus": [2],
            "nodeStatus": 0,
            "taskStatus": 0,
          })
        }else{
          res?.data?.list?.forEach((item)=>{
            if(item?.tag==0){
              item.canRegistWorkItemName=item.canRegistWorkItemName+'[已删除]'
            }
          })
        }
        res?.data?.registerRecordEnumList.forEach((item)=>{
          item.label=item.typeDescribe
          item.value=item.typeName
        })
        let registerLevelConfigVos=res?.data?.registerLevelConfigVos || []
        setRegisterLevelConfigVos(registerLevelConfigVos)
        let registerRecordEnumList=res?.data?.registerRecordEnumList || []
        setRegisterRecordEnumList(registerRecordEnumList)
        setCapacityInitialValues(capacityInitialValuesData);
        setRegistrationSettingsConfig(res.data);
        setWorkItemKeyTypes(res?.data?.workItemKeyTypes || [])
      }
    }else{
    }
  };

  const getStandardsConfigDetailInfo = async (item) => {
     const data = {
      id: item.id ? item.id : null,
      isDefault: item.isDefault,
    };
    const res = await getStandardsConfigDetail(data);
    if (res?.result) {
      setStandardConfigData(res.data);
      setIsStandardsFormOpen(true);
    } else {
      setIsStandardsFormOpen(true);
    }
  }
  /** 查询代填设置 */
  const getConfig = async () => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    };
    const res = await getProjectConfig(data);
    if (res?.result) {
      setConfig(res.data);
    }
  };

  /** 查询度量设置 */
  const getMeasureConfig = async () => {
    const data = {
      type: "ALLOW_MEASUREMENT",
    };
    const res = await getMeasureProjectConfig(data);
    if (res?.result) {
      setConfigMeasure(res.data);
    }
  };
   /** 获取配置 */
  const getApprovalSettingsData = async () => {
    const res = await getApprovalSettings();
    if (res?.result) {
      const data = res.data;
      let approvalName = '--';
      let approvalUser = [];
      let teamNames = [];
      let designatedMembers = [];

      if (data?.pattern == 1) {
        approvalName = '指定成员';
        data?.userIds?.forEach(item => {
          approvalUser.push({
            name: item.nameCn || item.name || '--',
            avatarUrl: item.avatarUrl || item.avatar || '',
          });
        });
      }
      if (data?.pattern == 2) {
        approvalName = '团队审批';
        approvalUser.push({ name: '团队管理员', avatarUrl: teamAvatar });
        // 提取团队名称用于“启用团队”字段
        data?.teamIds?.forEach(item => {
          teamNames.push(item.teamName || item.name || '');
        });
      }
      if (data?.pattern == 3) {
        approvalName = '角色审批';
        data?.roles?.forEach(item => {
          approvalUser.push({
            name: item.roleName || '--',
            avatarUrl: '',
          });
        });
      }

      // 提取指定成员：非指定成员模式下，若有userIds也作为指定成员展示
      if (Array.isArray(data?.userIds) && data.userIds.length > 0) {
        designatedMembers = data.userIds
          .map(item => ({
            name: item.nameCn || item.name || '--',
            avatarUrl: item.avatarUrl || item.avatar || '',
          }))
          .filter(item => item.name !== '--');
      }
      if (Array.isArray(data?.noApprovalUserIds) && data.noApprovalUserIds.length > 0) {
        designatedMembers = data.noApprovalUserIds
          .map(item => ({
            name: item.nameCn || item.name || '--',
            avatarUrl: item.avatarUrl || item.avatar || '',
          }))
      }
      // 审批方式映射
      const approvalMethodMap = {
        1: '或签（任一审批人同意即可）',
        2: '会签（需所有审批人同意）',
      };

      // 审批人为空时处理方式映射
      const emptyApproverMap = {
        1: '指定人员审批',
        2: '自动通过',
        3: '自动拒绝',
      };

      const approvalInfo = {
        value: data?.enableApproval,
        // 审批方式：1 默认（自研审批），2 飞书审批。仅已安装 ISV 时用于切换摘要区展示
        approvalType: data?.approvalType,
        // 飞书审批规则条数（后端下发，缺省按 0 处理）
        ruleCount: data?.ruleCount || 0,
        approvalName,
        approvalUser: approvalUser.length > 0 ? approvalUser : undefined,
        teamNames: teamNames.length > 0 ? teamNames : undefined,
        approvalMethod: data?.approvalMethod != null
          ? (approvalMethodMap[data.approvalMethod] || data.approvalMethod)
          : undefined,
        emptyApproverAction: data?.noApprovalUserRule || undefined,
        designatedMembers: designatedMembers.length > 0 ? designatedMembers : undefined,
      };
      setConfigApproval(approvalInfo);
    }
  }
  /** 获取权限设置列表 */
  const queryDataAuthConfigCountInfo = async () => {
    const res = await queryDataAuthConfigCount();
    if (res?.result) {
        if(res?.data && res.data != null){
          setHasConfigCount(res.data);
        }
    }
    // 同时获取详细的权限配置数据
    const configRes = await getDataAuthConfig();
    if (configRes?.result && configRes?.data?.authConfigs) {
      let tenantModeInfo=JSON.parse(sessionStorage.getItem('tenantModeInfo'))
      if(tenantModeInfo?.install && tenantModeInfo?.mode == 'space'){
        let authConfigsList=configRes.data.authConfigs || [];
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
          }
        }
        setAuthConfigs(authConfigsList);
      }else{
        setAuthConfigs(configRes.data.authConfigs || []);
      }
    }
  };
    /** 记录规范设置 */
  const getStandardsConfigInfo = async () => {
    const res = await getStandardsConfig();
    if (res?.result) {
        if(res?.data && res.data){
          // 将isDefault为true的对象排在第一位
          const sortedData = [...res.data].sort((a, b) => {
            if (a.isDefault === true && b.isDefault !== true) {
              return -1; // a排在b前面
            } else if (a.isDefault !== true && b.isDefault === true) {
              return 1; // b排在a前面
            }
            return 0; // 保持原有顺序
          });
          setStandardsConfigList(sortedData);
        }
    }else{
    }
  };
    /** 获取消息通知配置 */
  const getWorkHourReminderConfigInfo= async (point) => {
    const data = {
     isInner:point
    };
    const res = await getWorkHourReminderConfig(data);
    if (res?.result) {
        if(res?.data){
          let time=res.data?.remindTime || ''
          if (time.includes(':')) {
              const parts = time.split(':');
              if (parts.length >= 2) {
                time = `${parts[0]}:${parts[1]}`;
              }
            }
          res.data.remindTime=time
          const selectUserListData = [].concat(
            res.data?.selectUserList || [],
            res.data?.selectTeamVos || [],
            res.data?.selectDepartmentIds || []
          );
          if(res.data?.commonConfigVo?.value){
            setRemindAllUser(selectUserListData)
          }else{
            setRemindAllUser([])
          }
          //console.log("selectUserListData",selectUserListData)
          if(point){
            setRemindCommonConfigData(res.data)           
            setIsNotificationFormOpen(true);
          }else{
            setRemindCommonConfig(res.data)
          }
        }
    }
  };
  /** 获取管理员列表 */
  const getAuthorityList = async () => {
    const res = await getProjectAdminList();
    if (res?.result) {
      setAuthorityList(res.data);
    }
  };

  /** 刷新团队成员 */
  const getRefreshTeamMember = async () => {
    const res = await getRefreshTeam();
    if (res?.result) {
      //window.JSSDK.toast.success("刷新成功");
      //getApprovalConfig();
    }
  };

  /** 添加管理员 */
  const onAddAuthorityClick = async () => {
    const data = {
      userId: selected.selectedUserIds,
    };
    const res = await postSetProjectAdmin(data);
    if (res?.result) {
      window.JSSDK.toast.success("添加成功");
      getAuthorityList();
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
    }
  };

  /** 删除管理员 */
  const onDelAuthorityClick = (item) => {
    Modal.confirm({
      title: "确定删除？",
      icon: <ExclamationCircleFilled />,
      content: "您即将删除该成员的插件管理权限，此操作不可撤销。",
      closeIcon: <CloseOutlined />,
      okText: "确定",
      cancelText: "取消",
      async onOk() {
        const data = {
          userId: [item.staffId],
        };
        const res = await postSetProjectMember(data);
        if (res?.result) {
          getAuthorityList();
          window.JSSDK.toast.success("删除成功");
        }
      },
      onCancel() {
        // window.JSSDK.toast.success('操作成功');
      },
    });
  };

  /** 删除特殊节点流配置 */
  const onDeleteSpecialFlowConfig = async (record) => {
    const data = {
      id: record.id,
    };
    const res = await deleteSpecialNodeFlowConfig(data);
    if (res?.result) {
      getCapacity();
      window.JSSDK.toast.success("删除成功");
    } else {
      window.JSSDK.toast.error(res?.message || "删除失败");
    }
    // Modal.confirm({
    //   title: "确定删除？",
    //   icon: <ExclamationCircleFilled />,
    //   content: `您即将删除「${record.workItemName}」的特殊节点流配置，此操作不可撤销。`,
    //   closeIcon: <CloseOutlined />,
    //   okText: "确定",
    //   cancelText: "取消",
    //   async onOk() {
    //     const data = {
    //       id: record.id,
    //     };
    //     const res = await deleteSpecialNodeFlowConfig(data);
    //     if (res?.result) {
    //       getCapacity();
    //       window.JSSDK.toast.success("删除成功");
    //     } else {
    //       window.JSSDK.toast.error(res?.message || "删除失败");
    //     }
    //   },
    // });
  };

  /** 删除数据权限配置 */
  const onDeleteDataAuthConfig = async (item) => {
    const data = {
      id: item.id,
    };
    const res = await deleteDataAuthConfig(data);
    if (res?.result) {
      queryDataAuthConfigCountInfo();
      window.JSSDK.toast.success("删除成功");
    } else {
      window.JSSDK.toast.error(res?.message || "删除失败");
    }
  };

  /** 打开选择人员弹窗 */
  const onSelectedUserOpen = () => {
    setIsSelectedUserOpen(true);
    setNewSelected(selected);
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

  /** 确定选择人员 */
  const onSelectedUserOk = () => {
    setIsSelectedUserOpen(false);
    setNewSelected(selected);
    onAddAuthorityClick();
  };

  /** 获取选择的人员 */
  const getSelectedUser = (e) => {
    setSelected(e);
  };

  /** 校验容量填报规则 */
  const validateTwoDecimalPlaces = (_, value) => {
    const reg = /^\d+(\.\d{1,2})?$/;
    if (value && !reg.test(value)) {
      return Promise.reject(new Error("请输入保留两位小数的数字"));
    }
    return Promise.resolve();
  };

  /** 管理员代填工时设置 */
  const onProjectConfigChange = async (val) => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
      id: config?.id,
      value: val ? 1 : 0,
    };
    const res = await postProjectConfig(data);
    if (res?.result) {
      getConfig();
      window.JSSDK.toast.success("设置成功");
    }
  };
  // 添加审批人相关处理函数
  const handleAddApprovalUser = () => {
    // 最多只能添加10个审批人
    if (selectedApprovalUsers.length >= 10) {
      return;
    }
    // 这里应该弹出选择人员的对话框
    // 为了示例，这里直接添加一个模拟用户
    const newUser = {
      id: Date.now().toString(),
      name: '新用户',
      isBlue: true
    };
    setSelectedApprovalUsers([...selectedApprovalUsers, newUser]);
  };
  
  const handleRemoveApprovalUser = (userId) => {
    const newUsers = selectedApprovalUsers.filter(user => user.id !== userId);
    setSelectedApprovalUsers(newUsers);
  };

  // 数据权限 - 可见范围描述映射
  const getScopeLabel = (dataScope) => {
    const map = {
      plugin_administrator: '插件管理员',
      team_administrator: '团队管理员',
      my_teams: '我的团队',
      specified_members: '指定成员',
      all_teams: '全部团队',
      specified_teams: '指定团队',
      specified_dept: '指定部门',
    };
    return map[dataScope] || dataScope || '--';
  };

  // 数据权限 - 授权对象显示
  const getAuthObjLabel = (row) => {
    if (row.authObj === 'all_members') return '全部成员';
    const users = row.authObjValue;
    if (!users || users.length === 0) return '--';
    return users;
  };

  // 数据权限 - 可见数据范围渲染
  const renderScopeContent = (item, scopeItem) => {
    if (!scopeItem?.dataScope) return <span className="empty-text">--</span>;
    const { dataScope, dataScopeValue } = scopeItem;
    // 文本类范围：直接显示文字
    const textScopes = ['isv_all_data', 'all_data', 'all_teams', 'my_teams', 'only_myself', 'plugin_administrator', 'team_administrator'];
    if (textScopes.includes(dataScope)) {
      return <span className="scope-value">{dataScopeValue || '--'}</span>;
    }
    // 实体列表类范围：头像 + 名称
    const entityConfigMap = {
      specified_members:    { src: null,      nameKey: 'userName' },
      specified_teams:      { src: teamAvatar, nameKey: 'teamName' },
      specified_department: { src: deptAvatar, nameKey: 'departmentName' },
      specified_dept:       { src: deptAvatar, nameKey: 'departmentName' },
    };
    const config = entityConfigMap[dataScope];
    if (!config) return <span className="empty-text">--</span>;
    const extraVos = item?.dataAuthExtraVos;
    if (!Array.isArray(extraVos) || extraVos.length === 0) {
      return <span className="empty-text">--</span>;
    }
    return (
      <div className="auth-users-wrap">
        {extraVos.map((user, ui) => (
          <span key={user.id || ui} className="auth-user-chip">
            <Avatar
              size={20}
              src={config.src || user.avatarUrl}
              icon={!(config.src || user.avatarUrl) && <UserOutlined />}
              className="auth-user-avatar"
            />
            <Tooltip title={user[config.nameKey] || '--'}>
              <span className="auth-user-name">{user[config.nameKey] || '--'}</span>
            </Tooltip>
          </span>
        ))}
      </div>
    );
  };

  // 最多展示的规则数
  const MAX_VISIBLE_RULES = 3;
  const sortedAuthConfigs = [...(authConfigs || [])].sort((a, b) => {
    const sortA = typeof a?.sort === 'number' ? a.sort : Infinity;
    const sortB = typeof b?.sort === 'number' ? b.sort : Infinity;
    return sortA - sortB;
  });
  const visibleAuthConfigs = showAllAuthRules
    ? sortedAuthConfigs
    : sortedAuthConfigs.slice(0, MAX_VISIBLE_RULES);
  // 提醒成员渲染函数
  const renderRemindMemberItem = (item, index) => {
    let avatar, name, title;
    
    if (item.teamId) {
      // 团队类型
      avatar = teamAvatar;
      name = item.teamName || '--';
      title = name;
    } else if (item.departmentId) {
      // 部门类型
      avatar = deptAvatar;
      name = item.departmentName || '--';
      title = name;
    } else if (item.userKey) {
      // 用户类型
      avatar = item.avatarUrl;
      name = item.userName || '--';
      title = name;
    } else {
      // 默认情况
      avatar = item.avatarUrl;
      name = item.userName || '--';
      title = name;
    }
    
    return (
      <Tooltip key={index} title={title} placement="top">
        <span className="info-remind-obj remind-ellipsis-single-line w60">
          <Avatar
            size={20}
            src={avatar}
            icon={!avatar && <UserOutlined />}
            className="auth-user-avatar"
          />
          <span className="auth-user-name">{name}</span>
        </span>
      </Tooltip>
    );
  };

  // 计算"允许管理员代填工时"的提示文案
  const getAdminRegisterTooltip = () => {
    let isInstalled = false;
    let isv_userMode = '';
    try {
      const raw = sessionStorage.getItem("tenantModeInfo");
      if (raw) {
        const tenantModeInfo = JSON.parse(raw);
        isInstalled = tenantModeInfo.install;
        isv_userMode = tenantModeInfo.mode || '';
      }
    } catch (_) {}
    if (!isInstalled) {
      return "开启后「插件管理员」可为全部成员进行 [登记工时] 的填报、编辑、删除";
    } else {
      if (isv_userMode === 'tenant') {
        return "开启后，应用管理员可在全部空间为成员进行「登记工时」的填报、编辑、删除；插件管理员可在其管理的空间内为成员进行「登记工时」的填报、编辑、删除。";
      } else {
        return "开启后，应用管理员和插件管理员可在该空间为成员进行「登记工时」的填报、编辑、删除。";
      }
    }
  };

  return (
    <div
      id="set"
      className="set-warp"
      ref={setWrapRef}
      style={wrapHeight ? { height: wrapHeight } : undefined}
    >
      <aside className="set-side-menu">
        <header className="side-menu-header">插件设置</header>
        <nav className="side-menu-nav">
          {settingSections.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`side-menu-item${activeSection === item.key ? ' active' : ''}`}
              onClick={() => scrollToSection(item.key)}
            >
              <span className="side-menu-icon">
                <img src={activeSection === item.key ? item.activeIcon : item.icon} alt={item.label} />
              </span>
              <span className="side-menu-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div
        className="set-scroll-container"
        ref={scrollContainerRef}
        onScroll={handleContainerScroll}
      >
      {isCapacityFormOpen ? (
        <div className="reg-settings-page">
          <div className="reg-settings-header">
            <ArrowLeftOutlined className="reg-settings-back-icon" onClick={handleBackToOverview} />
            <span className="reg-settings-title">登记设置</span>
          </div>
          <WorkHourSettings
            workItemKeyTypes={workItemKeyTypes}
            workFlowObjectList={workFlowObjectList}
            registerLevelConfigVos={registerLevelConfigVos}
            registerRecordEnumList={registerRecordEnumList}
            capacityInitialValues={capacityInitialValues}
            registrationSettingsConfig={registrationSettingsConfig}
            setIsCapacityFormOpen={handleBackToOverview}
          />
        </div>
      ) : isMeasureFormOpen ? (
        <div className="reg-settings-page">
          <div className="reg-settings-header">
            <ArrowLeftOutlined className="reg-settings-back-icon" onClick={() => handleBackFromMeasure(true)} />
            <span className="reg-settings-title">统计设置</span>
          </div>
          <MeasureSet
            configMeasure={configMeasure}
            setIsMeasureSetOpen={handleBackFromMeasure}
          />
        </div>
      ) : isStandardsFormOpen ? (
        <div className="reg-settings-page">
          <div className="reg-settings-header">
            <ArrowLeftOutlined className="reg-settings-back-icon" onClick={() => handleBackFromStandards(true)} />
            <span className="reg-settings-title">{isAdd ? '添加记录规范' : '编辑记录规范'}</span>
          </div>
          <StandardsSet
            isAdd={isAdd}
            standardConfigData={standardConfigData}
            setStandardsSetOpen={handleBackFromStandards}
          />
        </div>
      ) : isApprovalFormOpen ? (
        <div className="reg-settings-page">
          <div className="reg-settings-header">
            <ArrowLeftOutlined className="reg-settings-back-icon" onClick={() => handleBackFromApproval(true)} />
            <span className="reg-settings-title">工时审批设置</span>
          </div>
          <ApprovalSet
            setIsApprovalSetOpen={handleBackFromApproval}
          />
        </div>
      ) : isPermissionsFormOpen ? (
        <div className="reg-settings-page">
          <div className="reg-settings-header">
            <ArrowLeftOutlined className="reg-settings-back-icon" onClick={() => handleBackFromPermissions(true)} />
            <span className="reg-settings-title">权限设置</span>
          </div>
          <PermissionsSet
            setIsApprovalSetOpen={handleBackFromPermissions}
          />
        </div>
      ) : isNotificationFormOpen ? (
        <div className="reg-settings-page">
          <div className="reg-settings-header">
            <ArrowLeftOutlined className="reg-settings-back-icon" onClick={() => handleBackFromNotification(true)} />
            <span className="reg-settings-title">消息通知</span>
          </div>
          <NotificationSet
            remindCommonConfigData={remindCommonConfigData}
            setIsNotificationSetOpen={handleBackFromNotification}
          />
        </div>
      ) : (
      <>
      <div className="set-box">
        <div className="set-content content-style" ref={registerSectionRef('registration')}>
          <div className="content-top">
            <div>
              <div className="title">登记设置</div>
              <div className="desc">设置后，基于此标准约束工时填报</div>
            </div>
            <div>
              <Button
                onClick={async () => {
                  allWorkObjectList();
                  await getCapacity();
                  setIsCapacityFormOpen(true);
                }}
              >
                设置
              </Button>
            </div>
          </div>

          {/* 登记规则 */}
          <div className="reg-section">
            <div className="reg-section-header">
              <span>登记规则</span>
            </div>
            <div className="reg-grid-3col">
              <div className="reg-item">
                <span className="reg-label">管理员填报设置：</span>
                <span className="reg-tag-warn">{registrationSettingsConfig?.adminImpact ? '已启用' : '未启用'}</span>
              </div>
              <div className="reg-item">
                <span className="reg-label">工作描述是否必填：</span>
                <span
                  style={registrationSettingsConfig?.workDescReq
                    ? { color: '#1FC168', background: '#E9F9F0' }
                    : { color: '#646A73', background: '#EFF0F1' }}
                  className="reg-tag"
                >
                  {registrationSettingsConfig?.workDescReq ? '必填' : '非必填'}
                </span>
              </div>
              <div className="reg-item">
                <span className="reg-label">提前天数限制：</span>
                {registrationSettingsConfig?.enableAdvanceDay == 1 ? (
                  <span className="reg-value-highlight">{registrationSettingsConfig?.inAdvanceDay ?? '--'} 天</span>
                ) : (
                  <span className="reg-tag-warn">未启用</span>
                )}
              </div>
              <div className="reg-item">
                <span className="reg-label">未来日期限制：</span>
                {registrationSettingsConfig?.enableFutureDay == 1 ? (
                  <span className="reg-value-highlight">{registrationSettingsConfig?.futureDay ?? '--'} 天</span>
                ) : (
                  <span className="reg-tag-warn">未启用</span>
                )}
              </div>
            </div>
          </div>
          {/* 登记范围 */}
          <div className="reg-section">
            <div className="reg-section-header">登记范围</div>
            <div className="reg-row">
              <span className="reg-label">成员可登记范围：</span>
              <span>{registrationSettingsConfig?.list?.[0]?.myselfStatus === 1 ? '仅限当前成员负责的登记对象' : '全部登记对象'}</span>
            </div>
            <div className="reg-row" style={{ alignItems: 'flex-start' }}>
              <span className="reg-label" style={{ whiteSpace: 'nowrap', lineHeight: '28px' }}>可登记工作项：</span>
              <div className="reg-tags-wrap">
                {registrationSettingsConfig?.list?.map((item, index) => (
                  <Tooltip key={index} title={item.canRegistWorkItemName} placement="top">
                    <span className="reg-tag-item">{item.canRegistWorkItemName}</span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
          {/* 禁填设置 */}
          <div className="reg-section">
            <div className="reg-section-header">禁填设置</div>
             <div className="reg-grid-3col">
              <div className="reg-item">
                <span className="reg-label">工作项实例：</span>
                {registrationSettingsConfig?.list && registrationSettingsConfig?.list[0]?.entityStatus?.length > 0 ? (
                  registrationSettingsConfig.list[0].entityStatus.map((status, index) => (
                    <span key={index} className="reg-tag-status">
                      {status === 1 ? '已冻结' : status === 2 ? '已终止' : status === 3 ? '已完成' : ''}
                    </span>
                  ))
                ) : (
                  <span>--</span>
                )}
              </div>
              <div className="reg-item">
                <span className="reg-label">节点：</span>
               {registrationSettingsConfig?.list && registrationSettingsConfig?.list[0]?.nodeStatus === 1 ? (
                  <span className="reg-tag-status">已完成</span>
                ) : (
                  <span>--</span>
                )}
              </div>
              <div className="reg-item">
                <span className="reg-label">任务：</span>
                {registrationSettingsConfig?.list && registrationSettingsConfig?.list[0]?.taskStatus === 1 ? (
                  <span className="reg-tag-status">已完成</span>
                ) : (
                  <span>--</span>
                )}
              </div>
            </div>
          </div>
          {/* 节点流默认可登记层级 */}
          <div className="reg-section">
            <div className="reg-section-header">节点流默认可登记层级</div>
            <div className="reg-row">
            {(() => {
              const defaultLevelList = registerLevelConfigVos?.find(item => item.configType === 'global')?.registerLevelVoList || [];
              return defaultLevelList?.length > 0 ? (
                defaultLevelList.map((item, index) => (
                  <span key={index} className="reg-tag-level">{item.label || item.typeDescribe}</span>
                ))
              ) : (
                <span>--</span>
              );
            })()}
            </div>
          </div>
          {/* 特殊节点流配置 */}
          {(() => {
            const specialConfigs = (registerLevelConfigVos || []).filter(item => item.configType !== 'global');
            if (specialConfigs.length === 0) return null;
            return (
              <div className="reg-section">
                <div className="reg-section-header">特殊节点流配置</div>
                <Table
                  className="reg-table reg-special-flow-table"
                  size="small"
                  pagination={false}
                  dataSource={specialConfigs}
                  rowKey={(record, index) => record.id || index}
                  columns={[
                    {
                      title: '工作项',
                      dataIndex: 'workItemName',
                      key: 'workItemName',
                      width: '30%',
                      render: (text) => <span className="reg-special-flow-workitem">{text}</span>,
                    },
                    {
                      title: '可登记层级',
                      dataIndex: 'registerLevelVoList',
                      key: 'registerLevelVoList',
                      width: '50%',
                      render: (list) => (
                        <span className="reg-special-flow-levels">
                          {(list || []).map(item => item.typeDescribe || item.label).join('、')}
                        </span>
                      ),
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: '10%',
                      render: (_, record) => (
                        <span className="reg-special-flow-action">
                          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onDeleteSpecialFlowConfig(record)}>删除</Button>
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            );
          })()}
        </div>
        <div className="set-content content-style" ref={registerSectionRef('measure')}>
          <div className="content-top" style={{ borderBottom: configMeasure?.value ? '1px solid #e8e8e8' : 'none' }}>
            <div>
              <div className="title">
                统计设置
                {configMeasure?.value ? <span className="reg-tag-enabled">已启用</span> : <span className="reg-tag-gray">未启用</span>}
              </div>
              <div className="desc">设置部分工作项的工时数据被度量消费</div>
            </div>
            <div>
              <Button onClick={() => {
                setIsMeasureFormOpen(true);
              }}>设置</Button>
            </div>
          </div>
           {configMeasure?.value ?<div className="reg-section">
            <div className="reg-grid-2col">
              <div className="reg-field">
                <div className="reg-field-label">
                  工时统计工作项
                  <Tooltip title={<div>此工作项将用于存放工时日志的原始数据，实现工时的度量消费，详情请&nbsp;<Button type="link" style={{ padding: 0 }} onClick={() => { window.JSSDK.navigation.open(`https://ldkj.feishu.cn/wiki/SLGKwWQN6ij5pIkZSmbclm1InYf#FrYcdUHQOoH2wSxyT44ccWX0nN9`); }}>查看教程</Button></div>}>
                    <InfoCircleFilled style={{ marginLeft: 4, color: '#bbb' }} />
                  </Tooltip>
                </div>
                <div className="reg-field-value">{configMeasure?.measureWorkItemName || '--'}</div>
              </div>
              <div className="reg-field">
                <div className="reg-field-label">
                  启用工作项
                  <Tooltip title="仅已启用工作项支持被度量消费">
                    <InfoCircleFilled style={{ marginLeft: 4, color: '#bbb' }} />
                  </Tooltip>
                </div>
                <div className="reg-field-value">
                  {configMeasure?.bindWorkItemName ? (
                      configMeasure.bindWorkItemName.split(';').map((name, i) => (
                        <Tag key={i} color="default">{name}</Tag>
                      ))
                    ) : '--'}
                  {/* <div className="reg-tags-wrap">
                    
                  </div> */}
                </div>
              </div>
            </div>
          </div> : null}
        </div>
        {settingSections.some(s => s.key === 'standards') && (
         <div className="set-content content-style" ref={registerSectionRef('standards')}>
          <div className="content-top">
            <div>
              <div className="title">记录规范设置</div>
              <div className="desc">
                设置不同记录组，规范不同人员的记录规则
              </div>
            </div>
            <div>
              <span className="add-standards-btn" onClick={() => {
                setIsAdd(1)
                setStandardConfigData({
                  "id": null,
                  "dayUp": 24,
                  "onceDown": 1,
                  "standWorkHour": 8,
                  "standardsName": "",
                  "defaultUsers": []
                })
                setIsStandardsFormOpen(true)
              }}>添加记录规范</span>
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-grid">
              {standardsConfigList.map((item, index) => (
                <div className="content-bottom-box" key={index}>
                  <div className="box-title standard-column">
                     <Tooltip title={item.standardsName}>
                       <span className="standards-record-item ellipsis-single-line" onClick={() => {
                        setIsAdd(0)
                        getStandardsConfigDetailInfo(item)
                      }}>{item.standardsName}</span>
                     </Tooltip>
                      {item.isDefault && <span className="defalut-standards-tag">默认</span>}
                      <RightOutlined  onClick={() => {
                        setIsAdd(0)
                        getStandardsConfigDetailInfo(item)
                      }} className="standards-record-detail"/>
                  </div>
                  <div className="box-value">
                    <span className="standards-people-num">{item?.count ? `${item.count}人` : '0人'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
        <div className="set-content content-style" ref={registerSectionRef('approval')}>
          <div className="content-top" style={{ borderBottom: configApproval?.value ? '1px solid #e8e8e8' : 'none' }}>
            <div>
              <div className="title">
                工时审批设置
                {configApproval?.value ? <span className="reg-tag-enabled">已启用</span> : <span className="reg-tag-gray">未启用</span>}
              </div>
              <div className="desc">工时审批的规则配置，若开启工时审批，登记工时需通过审批后才算有效工时</div>
            </div>
            <div>
              <Button onClick={() => {
                setIsApprovalFormOpen(true);
              }}>设置</Button>
            </div>
          </div>
          {configApproval?.value ? <div className="reg-section">
            {isFeishuApproval ? (
              /* 飞书审批模式：仅展示「审批方式」「审批规则」两项，与 ISV 一致 */
              <div className="reg-grid-3col">
                <div className="reg-field">
                  <div className="reg-field-label">审批方式</div>
                  <div className="reg-field-value">飞书审批</div>
                </div>
                <div className="reg-field">
                  <div className="reg-field-label">审批规则</div>
                  <div className="reg-field-value">已配置 {configApproval?.ruleCount || 0} 条</div>
                </div>
              </div>
            ) : (
            <div className="reg-grid-3col">
              <div className="reg-field">
                <div className="reg-field-label">
                  审批模式
                  <Tooltip title="提供指定成员、团队审批、角色审批三种模式，适配不同审批场景">
                    <InfoCircleFilled style={{ marginLeft: 4, color: '#bbb' }} />
                  </Tooltip>
                </div>
                <div className="reg-field-value">{configApproval?.value ? (configApproval?.approvalName || '--') : '--'}</div>
              </div>
              {/* <div className="reg-field">
                <div className="reg-field-label">启用团队</div>
                <div className="reg-field-value">
                  <div className="reg-tags-wrap">
                    {configApproval?.value && Array.isArray(configApproval?.teamNames) && configApproval.teamNames.length > 0 ? (
                      configApproval.teamNames.map((name, i) => (
                        <Tooltip key={i} title={name}>
                          <span className="reg-tag-item">
                            <Avatar
                              size={20}
                              src={teamAvatar}
                              className="auth-user-avatar"
                            />
                            <span className="auth-user-name">{name}</span>
                          </span>
                        </Tooltip>
                      ))
                    ) : '--'}
                  </div>
                </div>
              </div> */}
              <div className="reg-field">
                <div className="reg-field-label">多人审批时采用的审批方式</div>
                <div className="reg-field-value">{configApproval?.value ? (configApproval?.approvalMethod || '或签（任一审批人同意即可）') : '--'}</div>
              </div>
              <div className="reg-field">
                <div className="reg-field-label">
                  审批人
                  <Tooltip title="负责审批工时的人员">
                    <InfoCircleFilled style={{ marginLeft: 4, color: '#bbb' }} />
                  </Tooltip>
                </div>
                <div className="reg-field-value">
                  <div className="reg-tags-wrap">
                    {configApproval?.value && Array.isArray(configApproval?.approvalUser) && configApproval.approvalUser.length > 0 ? (
                      configApproval.approvalUser.map((user, i) => (
                        <Tooltip key={i} title={user.name}>
                          <span className="reg-tag-item">
                            <Avatar
                              size={20}
                              src={user.avatarUrl}
                              icon={!user.avatarUrl && <UserOutlined />}
                              className="auth-user-avatar"
                            />
                            <span className="auth-user-name">{user.name}</span>
                          </span>
                        </Tooltip>
                      ))
                    ) : '--'}
                  </div>
                </div>
              </div>
              {/* <div className="reg-field">
                <div className="reg-field-label">
                  审批人为空时
                  <Tooltip title="当审批人为空时的处理方式">
                    <InfoCircleFilled style={{ marginLeft: 4, color: '#bbb' }} />
                  </Tooltip>
                </div>
                <div className="reg-field-value">{configApproval?.value && configApproval?.emptyApproverAction ? '指定人员审批' : '自动通过'}</div>
              </div>
              <div className="reg-field">
                <div className="reg-field-label">指定成员</div>
                <div className="reg-field-value">
                  <div className="reg-tags-wrap">
                    {configApproval?.value && configApproval?.designatedMembers?.length > 0 ? (
                      configApproval.designatedMembers.map((member, i) => (
                        <Tooltip key={i} title={member.name}>
                          <span className="reg-tag-item">
                            <Avatar
                              size={20}
                              src={member.avatarUrl}
                              icon={!member.avatarUrl && <UserOutlined />}
                              className="auth-user-avatar"
                            />
                            <span className="auth-user-name">{member.name}</span>
                          </span>
                        </Tooltip>
                      ))
                    ) : '--'}
                  </div>
                </div>
              </div> */}
            </div>
            )}
          </div> : null}
        </div>
        {settingSections.some(s => s.key === 'permissions') && (
        <div className="set-content content-style permission-settings-card" ref={registerSectionRef('permissions')}>
          <div className="content-top">
            <div>
              <div className="title">权限设置</div>
              <div className="desc">管理用户权限，控制成员操作范围及能力</div>
            </div>
            <div>
              <Button className="settings-btn" onClick={() => setIsPermissionsFormOpen(true)}>设置</Button>
            </div>
          </div>

          {/* 允许管理员代填工时 */}
          <div className="permission-section permission-toggle-row">
            <div className="permission-row between">
              <span className="permission-label">
                允许管理员代填工时
                <Tooltip title={getAdminRegisterTooltip()}>
                  <InfoCircleFilled className="info-icon" />
                </Tooltip>
              </span>
            </div>
            <span className="permission-action">
                <Switch
                  size="small"
                  checked={config?.value ? true : false}
                  onChange={onProjectConfigChange}
                />
              </span>
          </div>

          {/* 数据权限区域 */}
          {!isPermissionsCollapsed && (
            <div className="permission-section data-permission-area">
              <div className="permission-row between data-permission-top">
                <div className="data-permission-info">
                  <div className="data-permission-title">数据权限</div>
                  <div className="data-permission-desc">
                    配置成员在资源管理、工时日志、工时管理页面的数据可见权限。已配置 <span className="highlight-count">{authConfigs.length}</span> 个权限规则
                  </div>
                </div>
                {authConfigs.length > MAX_VISIBLE_RULES && (
                  <span className="expand-text" onClick={() => setShowAllAuthRules(!showAllAuthRules)}>
                    {showAllAuthRules ? (
                      <><UpOutlined className="expand-icon" />收起</>
                    ) : (
                      <><DownOutlined className="expand-icon" />展开</>
                    )}
                  </span>
                )}
              </div>

              {authConfigs.length > 0 && (
                <>
                  {/* <div className="rules-hint">最多展示{MAX_VISIBLE_RULES}个规则，超过需要点击展开</div> */}
                  <div className="rules-list">
                    {visibleAuthConfigs.map((item, index) => {
                      const authUsers = getAuthObjLabel(item);
                      const dataAuthUserVos = item?.dataAuthUserVos;
                      const isAllMembers = item.authObj !== 'specified_members';
                      const scopeItem = item?.dataAuthExtraVos?.[0];
                      const scopeLabel = scopeItem ? getScopeLabel(scopeItem.dataScope) : '--';
                      const isDisabled = item.isDefault;
                      return (
                        <div key={item.id || index} className="rule-card">
                          <div className="rule-card-layout">
                            <div className="rule-card-left">
                              <span className="rule-index">规则{index + 1}</span>
                            </div>
                            <div className="rule-card-middle">
                              <div className="rule-column">
                                <div className="rule-column-label">授权对象</div>
                                <div className="rule-column-content">
                                  {isAllMembers ? (
                                    <span className="all-members-text">{item.authObjValue}</span>
                                  ) : Array.isArray(dataAuthUserVos) && dataAuthUserVos.length > 0 ? (
                                    <div className="auth-users-wrap">
                                      {dataAuthUserVos.map((user, ui) => (
                                        <span key={ui} className="auth-user-chip">
                                          <Avatar
                                            size={20}
                                            src={user.avatarUrl}
                                            icon={!user.avatarUrl && <UserOutlined />}
                                            className="auth-user-avatar"
                                          />
                                          <Tooltip title={user.userName || user.name || '--'}>
                                            <span className="auth-user-name">{user.userName || user.name || '--'}</span>
                                          </Tooltip>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="empty-text">--</span>
                                  )}
                                </div>
                              </div>
                              <div className="rule-column rule-column-scope">
                                <div className="rule-column-label">可见数据范围</div>
                                <div className="rule-column-content">
                                  {renderScopeContent(item, scopeItem)}
                                </div>
                              </div>
                            </div>
                            <div className="rule-card-right">
                              <span 
                                className="rule-delete" 
                                style={{ 
                                  opacity: isDisabled ? 0.5 : 1,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  color: isDisabled ? '#ccc' : '#4247f6'
                                }}
                                onClick={() => { !isDisabled && onDeleteDataAuthConfig(item); }}
                              >
                                删除
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* {authConfigs.length > MAX_VISIBLE_RULES && (
                    <div className="expand-more-bar" onClick={() => setShowAllAuthRules(!showAllAuthRules)}>
                      {showAllAuthRules ? (
                        <><UpOutlined />收起</>
                      ) : (
                        <><DownOutlined />展开（共 {authConfigs.length} 条规则）</>
                      )}
                    </div>
                  )} */}
                </>
              )}
            </div>
          )}
        </div>
        )}
         <div className="set-content content-style" ref={registerSectionRef('notification')}>
          <div className="content-top">
            <div>
              <div className="title">消息通知</div>
              <div className="desc">支持配置各类消息的通知规则，触发飞书项目的消息提醒</div>
            </div>
            <div>
              <Button
                onClick={() => {
                  getWorkHourReminderConfigInfo(true);
                }}
              >
                设置
              </Button>
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-box box-switch">
              <div className="box-title">
                工时登记提醒
              <Tooltip
                className="user-tooltip"
                placement="bottom"
                title={
                  <>
                    <div>
                       <span style={{ fontWeight: 'bold' }}>对应提醒频率周期内</span>任意工作日未登记工时的用户，将按配置自动发送提醒
                      <div>工时登记提醒需同时配置：①本插件设置页的提醒时间、提醒成员；②飞书项目的触发器（触发器配置可参考帮助手册）</div>
                    </div>
                  </>
                }
              >
                <InfoCircleFilled className="icon" />
              </Tooltip>
              </div>
            </div>
          </div>
          <div className="content-bottom">
            <div className="content-bottom-box">
              <div className="box-title">
                <span className="info-remind-item">提醒状态：</span>
                {remindCommonConfig?.commonConfigVo?.value ? <span className="reg-tag-enabled">开启</span> : <span className="reg-tag-gray">关闭</span>}
                {/* <span className="info-remind-ml-10 info-remind-open">{remindCommonConfig?.commonConfigVo?.value ? "开启" : "关闭"}</span>  */}
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span className="info-remind-item">提醒频率：</span>
                {remindCommonConfig?.commonConfigVo?.value && remindCommonConfig?.remindFrequencyDescribe ? (
                    <span className="info-remind-ml-10">{remindCommonConfig?.remindFrequencyDescribe}</span>
                ) : (
                   <span className="info-remind-ml-10">--</span>
                )}
              </div>
            </div>
            <div className="content-bottom-box">
              <div className="box-title">
                <span className="info-remind-item">提醒时间：</span>
                {remindCommonConfig?.commonConfigVo?.value && remindCommonConfig?.remindDateDescribe && remindCommonConfig?.remindTime? (
                  <span className="info-remind-ml-10">{remindCommonConfig?.remindDateDescribe}{remindCommonConfig?.remindTime}</span>
                ) : (
                  <span className="info-remind-ml-10">--</span>
                )}
              </div>
            </div>
          </div>
          <div className="content-bottom" style={{marginTop:'8px'}}>
            <div className="content-bottom-box">
              <div className="box-title" style={{display:'flex'}}>
                <div className="info-remind-item" style={{width:'80px'}}>提醒成员：</div>
                <div className="info-remind-ml-10" style={{width:'calc(100% - 70px)',marginLeft:'8px'}}>
                  {remindCommonConfig?.commonConfigVo?.value===1 && (
                  <div className="remind-ellipsis-3-lines" style={{ cursor: 'pointer', width: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {Array.isArray(remindAllUser) && remindAllUser.length > 0 ? (
                      remindAllUser.map((item, index) => {
                        // 当超过30个对象时，显示前30个和省略号
                        if (remindAllUser.length > 30 && index > 30) return null;
                        if (remindAllUser.length > 30 && index === 30) {
                          return (
                            <span key={index} className="info-remind-obj" style={{ width:'20px', textAlign:'center' }}>
                              ...
                            </span>
                          );
                        }
                        return renderRemindMemberItem(item, index);
                      })
                    ) : null}
                  </div>
                  )}
                  {remindCommonConfig?.commonConfigVo?.value==0 && 
                    <div className="remind-ellipsis-3-lines">
                      --
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="set-box" ref={registerSectionRef('admin')} style={{backgroundColor:'#ffffff',padding:'0',borderRadius:'8px',marginTop:'12px',gap: 0}}>
        <div className="set-title" style={{paddingLeft:'24px',paddingTop:'24px',fontSize:'16px',marginTop:'0'}}>插件管理员</div>
        <div className="set-content between">
          <div className="add-plugin-user">
            即拥有【工时资源管理】插件的管理权限（即编辑当前页）与全局数据查询权限的成员。<br/>无插件管理员时，空间管理员可在插件设置-配置页中管理插件。
          </div>
          <Button className="settings-btn" onClick={onSelectedUserOpen} style={{marginRight:'24px',height:'36px',transform:'translateY(-25px)'}}>
            添加插件管理员
          </Button>
        </div>
        <Table
          className="set-table"
          size="small"
          rowKey="staffId"
          loading={authorityLoading}
          columns={authorityColumns}
          dataSource={authorityList}
          pagination={false}
          scroll={{ x: 510 }}
        />
      </div>
      </>
      )}
      </div>

      <Modal
        destroyOnClose
        title="选择成员"
        open={isSelectedUserOpen}
        onCancel={onSelectedUserCancel}
        width={"745px"}
        footer={[
          <Button className="cancel-btn" onClick={onSelectedUserCancel}>
            取消
          </Button>,
          <Button
            disabled={!selected.selectedUserIds.length}
            type="primary"
            onClick={onSelectedUserOk}
          >
            确定
          </Button>,
        ]}
        centered
        maskClosable={false}
      >
        <SelectedUser
          type="authority"
          getSelectedUser={getSelectedUser}
          selectedUser={selected}
        />
      </Modal>
    </div>
  );
};
export default Set;

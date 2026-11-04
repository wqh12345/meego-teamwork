import React, {
  useMemo,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import {
  Alert,
  DatePicker,
  InputNumber,
  Table,
  Input,
  Space,
  Tooltip,
  Modal,
  message,
  Radio,
  Select,
  Popover,
  Form,
  Button,
  Spin,
  Cascader,
  Divider,
  Checkbox,
  Tree
} from "antd";
import {
  InfoCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  DragOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getLastWeekRange,
  getLastMonthRange,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  validateDecimalPlaces,
  getDatesInRange,
  canShowTenantAdminFeature,
  buildAttendanceIndex,
  getAttendance,
  getAppModeInfo
} from "../../../../util/util";
import {
  getStandWorkHour,
  getUserRole,
  getProjectConfig,
  getWorkSaturationTips,
  postBatchInsertNodeWorkHourNew,
  postUserActive,
  getWorkItemOptionNew,
  postQueryBatch,
  postItemEntityOptionNew,
  getEntityNodeOptionNew,
  postEntityNodeTaskSchedule,
  postEntityNodeTask,
  getDisplayLogic,
  getBatchRegTableSortConfig,
  postBatchRegTableSortConfig,
  postBatchApprovalAgain,
  getWorkItemOptionForRegister,
  saveRegisterCache,
  getRegisterCache,
  getRegisterMemory,
  clearRegisterCache,
  getRegistrationSettings,
  queryExpandLevelNode,
  queryWorkHoursTotalDetail,
  getUserStandWorkHour,
  getBatchMemorySetting,
  getTenantModeInfo,
  getAttendanceConfig,
  getUserAttendanceConfig,
  syncAttendanceConfig
} from "../../../../api/api";
import "./RegWorkHourBatchNew.less";
import dayjs from "dayjs";
import SmartSelect, { getWorkItemEntityOptionKey } from "./SmartSelect";
import SmartSelect2 from "./SmartSelect2";
import TableColumnsSet from "./TableColumnsSet";
import LevelSet from "./levelSet";
import customParseFormat from "dayjs/plugin/customParseFormat";
import UserPicker from "../user-picker/UserPicker";
import Decimal from "decimal.js";
import RegisterWorkItemTable from "./RegisterWorkItemTable";
import { useTenantCustomFieldConfig } from "../../hooks/useTenantCustomFieldConfig";
dayjs.extend(customParseFormat);
import debounce from "lodash/debounce";
const { RangePicker } = DatePicker;
const { TextArea } = Input;
import taskIcon from "../../../../image/task.png";
import nodeIcon from "../../../../image/node.png";
import workItemEntityIcon from "../../../../image/workItemEntity.png";
import zhankai from "../../../../image/zhankai.png";

const CUSTOM_FIELD_COLUMN_WIDTH = 120;

const CustomFieldValueCell = ({ value }) => {
  const valueRef = useRef(null);
  const [isOverflowed, setIsOverflowed] = useState(false);
  const hasValue =
    value !== null &&
    value !== undefined &&
    !(typeof value === "string" && value.trim() === "");
  const displayValue = hasValue ? String(value) : "--";

  const updateOverflow = () => {
    const element = valueRef.current;
    setIsOverflowed(
      Boolean(element && element.scrollWidth > element.clientWidth)
    );
  };

  useLayoutEffect(() => {
    updateOverflow();
    const element = valueRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [displayValue]);

  return (
    <Tooltip title={hasValue && isOverflowed ? String(value) : null}>
      <div
        ref={valueRef}
        className="custom-field-column-value"
        onMouseEnter={updateOverflow}
      >
        {displayValue}
      </div>
    </Tooltip>
  );
};

const rangePresets = [
  {
    label: "本周",
    value: [
      dayjs(getWeekStartAndEnd().Monday),
      dayjs(getWeekStartAndEnd().Sunday),
    ],
  },
  {
    label: "本月",
    value: [
      dayjs(getFirstDayOfNaturalMonth()),
      dayjs(getLastDayOfNaturalMonth()),
    ],
  },
  {
    label: "本季度",
    value: [
      dayjs(getQuarterStartAndEnd().start),
      dayjs(getQuarterStartAndEnd().end),
    ],
  },
];

const isWorkDateRangeWithinThreeMonths = (dates) => {
  const [firstDate, secondDate] = dates || [];
  if (!firstDate || !secondDate) return true;

  const first = dayjs(firstDate);
  const second = dayjs(secondDate);
  const [startDate, endDate] = first.isAfter(second, "day")
    ? [second, first]
    : [first, second];

  return !endDate.isAfter(startDate.add(3, "month"), "day");
};

const isWorkDateDisabled = (current, info) => {
  if (!current || !info?.from) return false;
  return !isWorkDateRangeWithinThreeMonths([current, info.from]);
};

const RegWorkHourBatchNew = (props) => {
  const [regBatchForm] = Form.useForm();
  const [addWorkItemForm] = Form.useForm();
  const { isEnabled: isCustomFieldEnabled } = useTenantCustomFieldConfig();
  const workHourInputNumRef = useRef(null);
  const activeRegFormDateRef = useRef(null);
  const formValidationTimerRef = useRef(null);
  const [isAddWorkItemOpen, setIsAddWorkItemOpen] = useState(false);
  const [point, setPoint] = useState(props.type === 'tab' ? props?.workItemEntityId : '');
  const [registrantUserKey, setRegistrantUserKey] = useState(props?.loginUser?.id);
  const [pickerUser, setPickerUser] = useState({
    userKey: props?.loginUser?.id,
    nameCn: props?.loginUser?.name,
    avatarUrl: props?.loginUser?.avatar,
  });
  const [loading, setLoading] = useState(false);
  const [registerCacheLoading, setRegisterCacheLoading] = useState(true); // 新增状态，用于控制区域禁用
  const [hasMore, setHasMore] = useState(false);
  const [workItemOptions, setWorkItemOptions] = useState([]);
  // 工作项下拉顶部内嵌搜索词：按 label 本地模糊过滤（不区分大小写）
  const [workItemSearch, setWorkItemSearch] = useState("");
  const workItemKeyword = workItemSearch.trim().toLowerCase();
  const filteredWorkItemOptions = (workItemOptions || []).filter(
    (item) => !workItemKeyword || (item?.label ?? "").toLowerCase().includes(workItemKeyword),
  );
  const [beginWorkDate, setBeginWorkDate] = useState(
    getWeekStartAndEnd().Monday
  );
  const [endWorkDate, setEndWorkDate] = useState(getWeekStartAndEnd().Sunday);
  const [beginWorkDateCP, setBeginWorkDateCP] = useState(
    getWeekStartAndEnd().Monday
  );
  const [endWorkDateCP, setEndWorkDateCP] = useState(
    getWeekStartAndEnd().Sunday
  );
  // 工作日期快捷类型：0-自定义，1-今天，2-本周，3-上周，4-上个月（默认本周）
  const [workDateType, setWorkDateType] = useState(2);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [isPersonInCharge, setIsPersonInCharge] = useState(0);
  const [regTableColumns, setRegTableColumns] = useState([]);
  const [workItemIds, setWorkItemIds] = useState([]);
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [isWorkItemChanged, setIsWorkItemChanged] = useState(false);
  const [workDate, setWorkDate] = useState("");
  const [capacitySet, setCapacitySet] = useState({});
  const [isAllowRegister, setIsAllowRegister] = useState(false);
  const [workInstanceDataSource, setWorkInstanceDataSource] = useState({});
  // 来自下拉筛选项的数据
  const [tableDataSource, setTableDataSource] = useState([]);
  // 来自单个新增的数据
  const [tableAddDataSource, setTableAddDataSource] = useState([]);
  const [workInstancePagination, setWorkInstancePagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [alertDetail, setAlertDetail] = useState({});
  const [alertDetailOld, setAlertDetailOld] = useState({});
  const [curRecord, setCurRecord] = useState({});
  const [nodeTaskOptions, setNodeTaskOptions] = useState([]);
  const tableRef = useRef(null);
  const summaryRef = useRef(null);
  const filterMemoryRequestRef = useRef(null);
  const hasRestoredFilterMemoryRef = useRef(false);
  const tableRenderPendingRef = useRef(false);
  // 表格 loading 收尾的绝对兜底计时器（首次进入等待时启动，关闭成功后清空）
  const loadingFallbackTimerRef = useRef(null);
  // 仅 again_launch 初始加载使用：外层 Spin 的硬兜底计时器，
  // 防止请求被去重/提前 return/长时间不返回导致外层 Spin 常驻
  const againLaunchWatchdogRef = useRef(null);
  const filterRegistrationRef = useRef([]);
  const [isComposing, setIsComposing] = React.useState(false);
  const workDescReq= useRef(0);
  const [projectName, setProjectName] = useState("");
  const getProjectName = async () => {
    const context = await window.JSSDK.Context.load();
    setProjectName(context?.mainSpace?.name || "");
  }

  // 加载批量登记的「筛选条件记忆」开关，并通过回调通知父组件
  useEffect(() => {
    if (
      !props.onFilterMemoryLoaded &&
      !props.onFilterMemoryConfigLoaded
    ) return undefined;

    // 标记组件是否仍挂载，避免卸载后触发回调
    let isActive = true;
    const configType = props.type === 'tab' ? "TAB_REGISTER_FILTER_MEMORY" : "BATCH_REGISTER_FILTER_MEMORY";

    // 默认配置对象：无数据或异常时兜底，保证下游始终能读取到 type/value 字段
    const buildDefaultMemoryConfig = () => ({ type: configType, value: 0 });

    // 通过 ref 缓存请求 Promise，防止重复调用接口
    if (!filterMemoryRequestRef.current) {
      filterMemoryRequestRef.current = getBatchMemorySetting({
        type: configType,
      })
        .then((res) => (res?.result && res?.data ? res.data : buildDefaultMemoryConfig()))
        .catch(() => buildDefaultMemoryConfig());
    }

    // 请求完成后，若组件仍挂载则把结果回传给父组件
    filterMemoryRequestRef.current.then((config) => {
      if (!isActive) return;
      props.onFilterMemoryLoaded?.(config?.value === 1);
      props.onFilterMemoryConfigLoaded?.(config);
    });

    // 卸载时取消回调
    return () => {
      isActive = false;
    };
  }, [props.onFilterMemoryLoaded, props.onFilterMemoryConfigLoaded]);

  // 表格和总结栏滚动同步
  useEffect(() => {
    getProjectName();
    const handleTableScroll = () => {
      if (summaryRef.current) {
        // 查找表格的滚动容器
        const tableScrollContainer = document.querySelector('.table-warp .ant-table-body');
        if (tableScrollContainer && summaryRef.current) {
          // 获取表格的水平滚动位置
          const tableScrollLeft = tableScrollContainer.scrollLeft;
          // 使用transform移动总结栏内容，而不是设置scrollLeft
          const summaryContent = summaryRef.current.querySelector('.summary-content');
          if (summaryContent) {
            summaryContent.style.transform = `translateX(-${tableScrollLeft}px)`;
          }
        }
      }
    };

    // 监听表格的滚动事件
    const tableScrollContainer = document.querySelector('.table-warp .ant-table-body');
    if (tableScrollContainer) {
      tableScrollContainer.addEventListener('scroll', handleTableScroll);

      return () => {
        tableScrollContainer.removeEventListener('scroll', handleTableScroll);
      };
    }

  }, []);
  const [isAddWorkItemLoading, setIsAddWorkItemLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableLoading2, setTableLoading2] = useState(false);
  const [regDisplayLogic, setRegDisplayLogic] = useState({});
  const [workItemIdsFilter, setWorkItemIdsFilter] = useState([]);
  const [isOnDeselect, setIsOnDeselect] = useState(false);
  const [searchWorkItemIds, setSearchWorkItemIds] = useState([]);
  const [workItemEntityIds, setWorkItemEntityIds] = useState([]);
  const [workItemEntityCustomFieldValues, setWorkItemEntityCustomFieldValues] = useState({});
  const [searchWorkItemEntityIds, setSearchWorkItemEntityIds] = useState([]);
  const [editData, setEditData] = useState([]);
  const [num, setNum] = useState(0);
  const [hasCache, setHasCache] = useState(false);
  const [excludeWorkItemEntityIdListCache, setExcludeWorkItemEntityIdListCache] = useState([]);
  const excludeWorkItemEntityIdListCacheRef = useRef([]);
  const [columnsSet, setColumnsSet] = useState([
    {
      label: "登记对象",
      value: "workItemEntityName",
      checked: true,
      disabled: true,
    },
    {
      label: "成员排期",
      value: "scheduleDate",
      checked: true,
      disabled: false,
    },
    {
      label: "预估工时",
      value: "estimatedScore",
      checked: true,
      disabled: false,
    },
    { label: "合计", value: "total", checked: true, disabled: false },
    {
      label: "填报工作日期",
      value: "regDate",
      checked: true,
      disabled: true,
    },
  ]);
  const [updateEditData, setUpdateEditData] = useState([]);
  // 新增：控制负责人选项显示的条件
  const [showAllResponsibleOptions, setShowAllResponsibleOptions] = useState(0);
  // ==== 新增：用 ref 保存最新的 workInstanceDataSource ====
  const workInstanceDataSourceRef = useRef(null);
  // 在组件顶部添加 ref
  const tableAddDataSourceRef = useRef(null);
  const tableDataSourceRef = useRef(null);
  const editDataRef = useRef(null);
  const tableScrollPositionRef = useRef(0); // 保存表格滚动位置的引用
  const [cacheWorkInstanceDataSource, setCacheWorkInstanceDataSource] = useState([]);
  const cacheWorkInstanceDataSourceRef = useRef([]);
  const workItemListRef = useRef(null)
  const hasCacheRef = useRef(false)
  const [saveHourLoadings, setSaveHourLoadings] = useState(false);
  // 新增：控制负责人筛选Radio.Group是否显示的状态
  const [showResponsibleFilter, setShowResponsibleFilter] = useState(false);
  // 添加新状态控制
  const [isInitialized, setIsInitialized] = useState(false);
  const [invoke, setInvoke] = useState(false);
  // 在组件顶部添加新的状态
  const [previousWorkItemIds, setPreviousWorkItemIds] = useState([]);
  const [previousWorkItemEntityIds, setPreviousWorkItemEntityIds] = useState([]);
  const [previousWorkItemIdsFilter, setPreviousWorkItemIdsFilter] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  //const [beforeAddWorkItemIds, setBeforeAddWorkItemIds] = useState([]);
  const beforeAddWorkItemIdsRef = useRef([]);
  const beforeWorkItemIdsFilterRef = useRef([]);
  const modalLockRef = useRef(false);
  const capacitySetRef = useRef({});
  const granularityRef = useRef({ enabled: 0, hour: null }); // 工时颗粒度配置（isEnableGranularity + granularityHour）
  const callCountRef = useRef(1);
  const [expandPopoverVisible, setExpandPopoverVisible] = useState(false);
  const [expandLevel, setExpandLevel] = useState(props.type === 'tab' ? -1 : 1);
  const [expandOptions, setExpandOptions] = useState([
    { levelName: "展开至第一级", level: 1 },
    { levelName: "展开至第二级", level: 2 },
    { levelName: "展开至第三级", level: 3 }
  ]);
  const [workHoursTotalDetail, setWorkHoursTotalDetail] = useState({});
  const againNum = useRef(1);
  const addExtraRef = useRef([]);
  const manualSelection = useRef(false);
  // ---------- 考勤配置状态 ----------
  const [mode, setMode] = useState(""); // 当前模式：tenant（租户模式）/ space（空间模式）
  const [attendanceEnabled, setAttendanceEnabled] = useState(0);
  const [upperLimitSource, setUpperLimitSource] = useState(1); // 1-班内工作时长(scheduled) 2-实际出勤时长(actual)
  const [missPunchPolicy, setMissPunchPolicy] = useState(0); // 1-不允许提交(block) 2-允许提交-自定义提交上限(custom_limit)
  const [missPunchCustomLimit, setMissPunchCustomLimit] = useState(null); // 缺卡自定义提交上限（小时）
  const [attendanceHours, setAttendanceHours] = useState(null); // 考勤工时（小时）
  const [attendanceSyncing, setAttendanceSyncing] = useState(false);
  const attendanceRequestIdRef = useRef(0);
  const saturationRequestIdRef = useRef(0);
  const attendanceIndexRef = useRef({ dataMap: new Map(), configMap: new Map() });
  const attendanceContextRef = useRef(null);
  const attendanceStatusConfigRef = useRef(null);
  const attendanceInitializedRef = useRef(false);
  const attendanceLastQueryKeyRef = useRef(null);
  // 考勤启动时编排：同一查询条件只发一次请求，避免 useEffect 与 initData 重复打接口。
  const attendanceBootstrapRef = useRef(null);
  // 编排期间关闭 useEffect 的自动触发，改由 initData 统一驱动考勤请求。
  const attendanceGateOpenRef = useRef(false);
  // 暂存「等考勤数据到位后再渲染」的缓存表格任务：{ dataAll, level, begin, end }
  const pendingCacheRenderRef = useRef(null);
  // 缓存表格是否已经真正渲染过：兜底回填只在这之后生效，避免初始化窗口期被误判成「被写空」
  const cacheRenderedRef = useRef(false);
  // 缓存兜底回填次数上限，防止「回填→被覆盖→再回填」形成无限循环
  const cacheSelfHealCountRef = useRef(0);
  // 等待考勤数据的上限，超时后强制渲染缓存表格，避免接口慢导致表格一直 loading。
  const ATTENDANCE_WAIT_TIMEOUT = 5000;
  const [attendanceSnapshotMap, setAttendanceSnapshotMap] = useState({});
  const attendanceSyncHoursRef = useRef(null);
  // 同步存储最新考勤配置（ref供同步访问，避免state异步更新导致的时序问题）
  const attendanceConfigRef = useRef({
    enabled: 0,
    hours: null,
    syncHours: null,
    policy: 1,
    customLimit: null,
  });
  // 保存接口返回的"饱和度/剩余工时"原始快照（date/user 维度），供 validator 使用
  const capacitySnapshotRef = useRef(null);
  const localHourCache = useRef([]);
  const cacheModeRef = useRef(false);
  useEffect(() => {
  }, [JSON.stringify(expandedRowKeys)])
  const workItemEntityIdsRef = useRef([])
  useEffect(() => {
    workItemEntityIdsRef.current = workItemEntityIds;
  }, [JSON.stringify(workItemEntityIds)]);
  useEffect(() => {
    workInstanceDataSourceRef.current = workInstanceDataSource;
    // 数据源里还没有 entities 时不做 flag 回写：
    // 缓存表格是被异步编排写入的，这个 effect 的旧闭包（空数据源）若在写入之后再回写，
    // 会把刚渲染出来的缓存数据整个覆盖成空对象，表现为"有缓存但表格没有数据"。
    // 没有 entities 时本来也没有 flag 可算（calculateDateFlag 会直接返回 null），跳过不影响任何逻辑。
    if (!Object.prototype.hasOwnProperty.call(workInstanceDataSource || {}, "entities")) {
      return;
    }
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    // flag 必须基于「最新」数据源计算：缓存表格是异步编排写入的，
    // 若用本次 render 闭包里的旧数据源做绝对覆盖，会把刚写入的 entities 覆盖回空数组，
    // 关闭考勤时缓存渲染提前、这些 effect 后跑，表现就是「有缓存但表格空白」。
    // updater 内只做纯计算，不引入任何副作用。
    setWorkInstanceDataSource((prev) => {
      const prevSource = prev || {};
      if (!Object.prototype.hasOwnProperty.call(prevSource, "entities")) return prev;
      let newWorkInstanceDataSource = JSON.parse(JSON.stringify(prevSource));
      // 日期级 flag 独立计算，切换当前弹窗日期不能覆盖其他日期的高亮状态。
      rangeDates?.forEach((date) => {
        const currentDateDetail = getDateCapacitySnapshot(date?.date)
          || (date?.date === workDate && Object.keys(alertDetailOld || {}).length > 0 ? alertDetailOld : null);
        const flagValue = calculateDateFlag(date?.date, newWorkInstanceDataSource, currentDateDetail);
        if (flagValue !== null) {
          newWorkInstanceDataSource = {
            ...newWorkInstanceDataSource,
            entities: updateDateFlag(newWorkInstanceDataSource.entities, date?.date, flagValue),
          };
        }
      });
      return newWorkInstanceDataSource;
    });
    //console.log('newWorkInstanceDataSource',newWorkInstanceDataSource)
  }, [JSON.stringify(workInstanceDataSource), workHoursTotalDetail, attendanceSnapshotMap, workDate, alertDetailOld]);
  useEffect(() => {
    countAlertDetail();
  }, [alertDetailOld, JSON.stringify(workInstanceDataSource), attendanceEnabled, attendanceHours, missPunchPolicy, missPunchCustomLimit]);
  useEffect(() => {
    excludeWorkItemEntityIdListCacheRef.current = excludeWorkItemEntityIdListCache;
  }, [JSON.stringify(excludeWorkItemEntityIdListCache)])
  // 同步最新值到 ref
  useEffect(() => {
    cacheWorkInstanceDataSourceRef.current = cacheWorkInstanceDataSource;
  }, [JSON.stringify(cacheWorkInstanceDataSource)]);
  useEffect(() => {
    tableAddDataSourceRef.current = tableAddDataSource;
  }, [JSON.stringify(tableAddDataSource)]);
  useEffect(() => {
    tableDataSourceRef.current = tableDataSource;
    //console.log('最新tableDataSource',tableDataSourceRef.current)
  }, [JSON.stringify(tableDataSource)]);

  // 记忆/暂存数据写入数据源后，再让外层 loading 退出，避免表格尚未显示时出现空白区域。
  // 有缓存时数据源是异步编排写入的，必须等表格真正绘制出来再收 loading，判据有三层：
  // ① 数据源已有 entities；② 表格列已生成；③ 表格 DOM 里已经画出数据行。
  // 全部满足后再连等两帧，覆盖 flag 重算等后续 effect 引起的补渲染。
  // 缺任何一层都会出现"loading 先消失、表格后出现"的空白闪烁。
  useEffect(() => {
    if (!tableRenderPendingRef.current) return undefined;
    if (!Object.prototype.hasOwnProperty.call(workInstanceDataSource || {}, "entities")) return undefined;

    const raf = (typeof window !== "undefined" && window.requestAnimationFrame)
      ? window.requestAnimationFrame.bind(window)
      : (callback) => setTimeout(callback, 0);
    const caf = (typeof window !== "undefined" && window.cancelAnimationFrame)
      ? window.cancelAnimationFrame.bind(window)
      : clearTimeout;

    let frameIds = [];
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 最多再等 30 帧（约 500ms），只在异常情况下才会走到

    const closeLoading = () => {
      if (!tableRenderPendingRef.current) return;
      const current = workInstanceDataSourceRef.current || {};
      const dataReady = Object.prototype.hasOwnProperty.call(current, "entities");
      const columnsReady = Array.isArray(regTableColumns) && regTableColumns.length > 0;
      // 用本组件自己的容器作为查询范围，避免页面上同时存在多个实例时误判
      const domReady = Boolean(
        tableRef.current?.querySelector(".ant-table-tbody tr[data-row-key]")
      );
      // 任何一层没到就继续等下一帧，绝不让 loading 先于表格内容消失
      if ((!dataReady || !columnsReady || !domReady) && attempts < MAX_ATTEMPTS) {
        attempts += 1;
        frameIds.push(raf(closeLoading));
        return;
      }
      tableRenderPendingRef.current = false;
      if (loadingFallbackTimerRef.current !== null) {
        clearTimeout(loadingFallbackTimerRef.current);
        loadingFallbackTimerRef.current = null;
      }
      setTableLoading2(false);
    };

    // 绝对兜底：避免 rAF 被浏览器节流、或列反复重建导致本 effect 重跑时，loading 一直转。
    // 计时器独立于本 effect 的生命周期（挂在 ref 上），只在首次进入等待时启动一次。
    if (loadingFallbackTimerRef.current === null) {
      loadingFallbackTimerRef.current = setTimeout(() => {
        loadingFallbackTimerRef.current = null;
        if (tableRenderPendingRef.current) {
          tableRenderPendingRef.current = false;
          setTableLoading2(false);
        }
      }, 2000);
    }

    frameIds.push(raf(() => {
      frameIds.push(raf(closeLoading));
    }));

    return () => {
      frameIds.forEach((id) => caf(id));
      frameIds = [];
    };
  }, [workInstanceDataSource, regTableColumns]);

  // 成员切换的批量查询使用独立的 loading 生命周期；数据源提交并绘制后才能结束。
  useEffect(() => {
    const pendingRequestId = batchTableRenderPendingRef.current;
    if (
      pendingRequestId === null ||
      batchTableDataAppliedRef.current !== pendingRequestId ||
      lastRequestIdRef.current !== pendingRequestId ||
      !Object.prototype.hasOwnProperty.call(workInstanceDataSource || {}, "entities")
    ) {
      return undefined;
    }

    let frameId;
    const finishLoading = () => {
      if (
        batchTableRenderPendingRef.current !== pendingRequestId ||
        batchTableDataAppliedRef.current !== pendingRequestId ||
        lastRequestIdRef.current !== pendingRequestId
      ) {
        return;
      }
      batchTableRenderPendingRef.current = null;
      batchTableDataAppliedRef.current = null;
      setTableLoading(false);
    };
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      frameId = window.requestAnimationFrame(finishLoading);
    } else {
      frameId = setTimeout(finishLoading, 0);
    }

    return () => {
      if (typeof window !== "undefined" && window.cancelAnimationFrame && typeof frameId === "number") {
        window.cancelAnimationFrame(frameId);
      } else {
        clearTimeout(frameId);
      }
    };
  }, [workInstanceDataSource]);

  useEffect(() => {
    if (props?.submitStatus) {
      setWorkDate("");
      setAlertDetail({});
      setAlertDetailOld({});
      if (props.type === "tab") {
        //console.log('props.type88888',props.type)
        getSelectWorkInstanceTable();
      }
    }
  }, [props?.submitStatus]);
  useEffect(() => {
    const initData = async () => {
      setLoading(false)
      // 编排期间先关闭 useEffect 的考勤自动触发，改由 initData 按「缓存 → 考勤配置 → 考勤数据」的顺序驱动
      attendanceGateOpenRef.current = false;
      // 读取租户模式（tenant/space），驱动考勤查询的 projectKey 传递
      let tenantMode = "";
      try {
        const modeRes = await getTenantModeInfo();
        if (modeRes?.result && modeRes?.data) {
          sessionStorage.setItem("tenantModeInfo", JSON.stringify(modeRes.data));
          tenantMode = modeRes.data?.mode || "";
          setMode(tenantMode);
        }
      } catch (error) {
        console.error("读取租户模式信息失败:", error);
      }
      // 等待getCapacity和getRole都执行完成
      await Promise.all([getCapacity(), getRole()]);
      const authData = await getCapacity();
      // 当openType不为"again_launch"时，优先执行queryCache()
      if (props?.openType !== "again_launch") {
        const cacheResult = await queryCache();
        // 有缓存时：先取考勤配置（isEnable），isEnable=1 再取考勤数据，都回来后才渲染缓存表格。
        // 用 try/catch 包住：考勤相关的任何异常都不能中断 initData 后续流程（否则表格不渲染）。
        if (cacheResult.hasCacheEntities) {
          try {
            await runPendingCacheRender({
              isSpaceMode: tenantMode === "space",
              projectKey: sessionStorage.getItem("jwtMeegoTeamworkProjectKey") || "",
              userKey: cacheResult.registerUserKey,
              beginWorkDate: cacheResult.beginWorkDate,
              endWorkDate: cacheResult.endWorkDate,
            });
          } catch (error) {
            console.error("缓存表格渲染编排失败:", error);
          }
        }
        const memoryResult = cacheResult.shouldQueryMemory
          ? await queryFilterMemory()
          : { hasMemory: false, workItemIds: [] };
        const latestWorkItemIds = cacheResult.hasCache
          ? cacheResult.workItemIds
          : memoryResult.workItemIds;
        const hasMemoryWorkItemIds = memoryResult.workItemIds?.length > 0;

        // 无缓存时的考勤查询上下文：
        //   - 有记忆数据 → 取记忆里的登记起止日期
        //   - 没有记忆数据 → 取默认（本周）起止日期
        // 有缓存时已由上面的 runPendingCacheRender 用缓存接口区间驱动，这里不重复触发。
        // 必须把日期/登记人显式传给 getAttendanceContext：initData 是 mount 一次性 effect，
        // 闭包里的 beginWorkDate/registrantUserKey 还是初始值，空参调用会取到默认区间和错误成员。
        if (!cacheResult.hasCache) {
          const memoryUserKey = memoryResult.staffUserKey || cacheResult.registerUserKey || "";
          if (memoryUserKey) {
            const defaultRange = getWeekStartAndEnd();
            ensureAttendanceReady(getAttendanceContext(
              memoryResult.beginWorkDate || defaultRange.Monday,
              memoryResult.endWorkDate || defaultRange.Sunday,
              memoryUserKey,
            ));
          }
        }

        // 筛选记忆恢复后，外层 loading 要等查询结果写入表格并完成一次渲染后再结束。
        if (!cacheResult.hasCache && hasMemoryWorkItemIds) {
          tableRenderPendingRef.current = true;
          setTableLoading2(true);
        }

        // 没有暂存缓存时，外层 loading 由筛选记忆和登记对象查询共同决定。
        // 有效筛选记忆会继续等待登记对象查询完成；没有工作项类型则在筛选记忆完成后结束 loading。
        if (!cacheResult.hasCache && !hasMemoryWorkItemIds) {
          setTableLoading2(false);
        }
        if (!cacheResult.hasCache) await getRegDisplayLogic();
        // 标记初始化完成
        setIsInitialized(true);
        // 等待queryCache执行完成后再获取workItemIds的最新值
        // 使用setTimeout确保state更新完成后再检查
        if (cacheWorkInstanceDataSourceRef.current?.length > 0 && hasCacheRef.current && props?.type !== "tab") {
          setWorkInstancePagination({
            pageNum: 0,
            pageSize: 10,
          });
        }
        const hasCacheData = cacheResult.hasCache;
        const hasWorkItemIds = latestWorkItemIds?.length > 0;
        if (
          !hasCacheData &&
          (props?.type === "tab" || (memoryResult.hasMemory && hasWorkItemIds))
        ) {
          //getSelectWorkInstanceTable();
          setInvoke(true);
        }
      }
      if (props?.openType === "again_launch") {
        setTableLoading2(true);
        //console.log('props?.batchRegVal?.approvalRecordInfoVoList',props?.batchRegVal?.approvalRecordInfoVoList)
        setInvoke(true);
        //setIsPersonInCharge(1);
        //const abc=aggregateWorkHours(props?.batchRegVal?.approvalRecordInfoVoList)
        setEditData(
          aggregateWorkHours(props?.batchRegVal?.approvalRecordInfoVoList)
        );
        setUpdateEditData(props?.batchRegVal?.approvalRecordInfoVoList)
        setBeginWorkDate(props?.batchRegVal?.registrationStartDate);
        setEndWorkDate(props?.batchRegVal?.registrationEndDate);
        setBeginWorkDateCP(props?.batchRegVal?.registrationStartDate);
        setEndWorkDateCP(props?.batchRegVal?.registrationEndDate);
        const workItemIds = [];
        const workItemEntityIds = [];
        const workItemIdsFilter = [];
        const customFieldValues = {};
        const workItemList = []
        let deleteRegObject = []
        let deleteRegItem = ''
        props?.batchRegVal?.approvalRecordInfoVoList.map((item) => {
          if (item.tag === 0) {
            deleteRegItem = ''
            if (item.workItemEntityName) {
              deleteRegItem = item.workItemEntityName.replace('[已删除]', '')
            }
            if (item.nodeName) {
              deleteRegItem = deleteRegItem + '/' + item.nodeName.replace('[已删除]', '')
            }
            if (item.taskName) {
              deleteRegItem = deleteRegItem + '/' + item.taskName.replace('[已删除]', '')
            }
            // 去重：只有当deleteRegItem不存在于deleteRegObject中时才添加
            if (!deleteRegObject.includes(deleteRegItem)) {
              deleteRegObject.push(deleteRegItem)
            }
          }
          if (item.tag === 1) {
            if (!workItemIds.includes(item.workItemId)) {
              workItemIds.push(item.workItemId);
              workItemList.push({
                workItemId: item.workItemId,
                workItemName: item.workItemName,
              })
            }
            if (
              !workItemEntityIds.includes(
                JSON.stringify({
                  workItemId: item.workItemId,
                  label: item.workItemEntityName,
                  value: item.workItemEntityId,
                })
              )
            ) {
              workItemEntityIds.push(
                JSON.stringify({
                  workItemId: item.workItemId,
                  label: item.workItemEntityName,
                  value: item.workItemEntityId,
                })
              );
              workItemIdsFilter.push({
                workItemId: item.workItemId,
                workItemEntityId: item.workItemEntityId,
              });
              customFieldValues[
                getWorkItemEntityOptionKey(item.workItemId, item.workItemEntityId)
              ] = item.customFieldValue;
            }
          }
        });
        if (deleteRegObject.length > 0) {
          window.JSSDK.toast.error(`${deleteRegObject.join(',')}已删除,无法登记工时,相关内容已移除`);
        }
        if (props?.batchRegVal?.showClearleLevel) {
          window.JSSDK.toast.error(`根据最新登记规则，部分暂存工时因登记层级不符已被清除。建议先检查数据后，重新提交。`);
        }
        setWorkItemIds(workItemIds);
        setWorkItemIdsFilter(workItemIdsFilter);
        if (workItemIdsFilter.length == 0) {
          // 没有可查询的登记对象：保持原有行为，立即关闭外层 Spin
          tableRenderPendingRef.current = false;
          if (againLaunchWatchdogRef.current !== null) {
            clearTimeout(againLaunchWatchdogRef.current);
            againLaunchWatchdogRef.current = null;
          }
          setTableLoading2(false);
        } else {
          // 有可查询登记对象：挂起标记，交由 505-563 就绪 effect 在"表格 DOM 画出数据行之后"关闭外层 Spin；
          // 同时使 getSelectWorkInstanceTable 的 finally 不再"请求一返回就关外层"。
          tableRenderPendingRef.current = true;
          // 硬兜底：若请求未真正发出（capacitySet 未就绪提前 return）、被同参数去重、或长时间不返回，
          // 限时强制关闭外层 Spin，避免常驻。
          if (againLaunchWatchdogRef.current === null) {
            againLaunchWatchdogRef.current = setTimeout(() => {
              againLaunchWatchdogRef.current = null;
              if (isMountedRef.current && tableRenderPendingRef.current) {
                tableRenderPendingRef.current = false;
                setTableLoading2(false);
              }
            }, 8000);
          }
        }
        setWorkItemEntityIds(workItemEntityIds);
        setWorkItemEntityCustomFieldValues(customFieldValues);
        setRegisterCacheLoading(false)
      }
    };
    // 确保capacitySet有值后再继续执行
    initData().finally(() => {
      // 编排结束（含异常）一律放行自动触发
      attendanceGateOpenRef.current = true;
      // 终极兜底：渲染任务若仍未被消费（编排中途抛错等异常路径），这里补渲染一次，避免表格空白
      if (pendingCacheRenderRef.current) {
        const pendingTask = pendingCacheRenderRef.current;
        pendingCacheRenderRef.current = null;
        flushPendingCacheRender(pendingTask);
      }
      // 已在 initData 中发过考勤请求的不重复触发
      if (!attendanceBootstrapRef.current) syncAttendanceForCurrentContext();
    });
  }, []);
  useEffect(() => {
    hasCacheRef.current = hasCache
  }, [hasCache]);
  useEffect(() => {
    editDataRef.current = editData;
    //console.log('editData',editData)
  }, [JSON.stringify(editData)]);
  useEffect(() => {
    if (beginWorkDate && endWorkDate) {
      const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
      queryWorkHoursTotalDetailData(rangeDates[0]?.date, rangeDates[rangeDates.length - 1]?.date)
    }
  }, [beginWorkDate, endWorkDate, registrantUserKey]);
  //查询区间日期的登记工时情况
  const queryWorkHoursTotalDetailData = async (beginDate, endDate) => {
    if (!beginDate || !endDate || !registrantUserKey) {
      return;
    }
    const data = {
      workDateStart: beginDate,
      workDateEnd: endDate,
      registrantUserKey,
    };
    try {
      const res = await queryWorkHoursTotalDetail(data);
      if (res?.result && res?.data) {
        setWorkHoursTotalDetail({ ...res?.data || {} });
      }
    } catch (error) {
      console.error('查询工时详情失败:', error);
    }
  };
  useEffect(() => {
  }, [expandedRowKeys]);
  useEffect(() => {
    if (registrantUserKey){
      getUserStandWorkHourData()
    }
  }, [registrantUserKey]);
  //展开层级逻辑
  const handleExpandLevelChange = (level, list, expandCache, holdState, beginWorkDateInfo, endWorkDateInfo) => {
    level = level ? level : expandLevel
    let registerList = list || []
    let targetIds = new Set()
    let beginWorkDateData = beginWorkDateInfo ? beginWorkDateInfo : beginWorkDate
    let endWorkDateData = endWorkDateInfo ? beginWorkDateInfo : endWorkDate
    const rangeDates = getDatesInRange(beginWorkDateData, endWorkDateData);
    if (level == 1) {
      // 当holdState不存在时清空expandedRowKeys，存在时保持原状态
      // if (!holdState) {
      //   setExpandedRowKeys([])
      // }
      if (expandCache) {
        rangeDates?.forEach((date, dateIndex) => {
          registerList.forEach(item => {
            // 检查子级是否有actWorkHour值          
            item?.children?.forEach(child => {
              if (child[date.date]?.actWorkHour) {
                // 如果子级有值，展开父级和子级
                targetIds.add(item.id)
              }
              // 检查孙级是否有actWorkHour值
              child?.children?.forEach(grandchild => {
                if (grandchild[date.date]?.actWorkHour) {
                  // 如果孙级有值，展开父级、子级和孙级
                  targetIds.add(child.id)
                }
              })
            })
          })
        })
      }
      // 创建新的展开数组：只包含当前数据源中存在的目标id
      const expandedRowKeysData = Array.from(targetIds)
      // 当holdState存在时，在原有展开状态基础上追加新的展开数组
      if (holdState) {
        setExpandedRowKeys(prev => [...new Set([...prev, ...expandedRowKeysData])])
      } else {
        setExpandedRowKeys(expandedRowKeysData)
      }
    } else {
      if (level == 2) {
        // 展开级别2：只展开一级（父级）
        registerList.forEach(i => {
          targetIds.add(i.id)
        })
      }
      if (level == 3 || level == -1) {
        // 展开级别3或-1：展开所有层级（父级和子级）
        registerList.forEach(i => {
          targetIds.add(i.id)
          i?.children?.forEach(j => {
            targetIds.add(j.id)
          })
        })
      }
      if (expandCache) {
        rangeDates?.forEach((date, dateIndex) => {
          registerList.forEach(item => {
            // 检查子级是否有actWorkHour值
            item?.children?.forEach(child => {
              if (child[date.date]?.actWorkHour) {
                // 如果子级有值，展开父级和子级
                //console.log('子级有值',child);
                targetIds.add(item.id)
              }
              // 检查孙级是否有actWorkHour值
              child?.children?.forEach(grandchild => {
                if (grandchild[date.date]?.actWorkHour) {
                  //console.log('孙级有值',grandchild);
                  // 如果孙级有值，展开父级、子级和孙级
                  targetIds.add(child.id)
                }
              })
            })
          })
        })
      }
      // 创建新的展开数组：只包含当前数据源中存在的目标id
      //console.log('targetIds',targetIds);
      const expandedRowKeysData = Array.from(targetIds)
      // 当holdState存在时，在原有展开状态基础上追加新的展开数组
      if (holdState) {
        setExpandedRowKeys(prev => [...new Set([...prev, ...expandedRowKeysData])])
      } else {
        setExpandedRowKeys(expandedRowKeysData)
      }
    }
  }
  //转化缓存的数据
  const transformWorkHourData = (originalData) => {
    if (!originalData || !Array.isArray(originalData)) return [];
    //console.log('originalData',originalData);
    return originalData.map(item => {
      // 转换根节点（工作项实例）
      const transformedItem = {
        workItemId: item.workItemId,
        workItemName: item.workItemName,
        workItemEntityId: item.workItemEntityId,
        workItemEntityName: item.workItemEntityName,
        pattern: item.pattern,
        newPattern: item.newPattern,
        scheduleStart: item.scheduleStart,
        scheduleEnd: item.scheduleEnd,
        estimatedWorkingHoursAll: item.estimatedWorkingHoursAll,
        estimatedWorkingHoursSelf: item.estimatedWorkingHoursSelf,
        children: item.workItemType === 'workflow' ? [] : null
      };

      // 转换子节点（节点）
      if (item.children && Array.isArray(item.children)) {
        transformedItem.children = item.children.map(childNode => {
          const transformedNode = {
            nodeId: childNode.nodeId,
            nodeName: childNode.nodeName,
            scheduleStart: childNode.scheduleStart,
            scheduleEnd: childNode.scheduleEnd,
            estimatedWorkingHoursAll: childNode.estimatedWorkingHoursAll,
            estimatedWorkingHoursSelf: childNode.estimatedWorkingHoursSelf,
            children: childNode.children && Array.isArray(childNode.children) ? childNode.children : null
          };

          // 转换孙子节点（任务）
          if (childNode.children && Array.isArray(childNode.children)) {
            transformedNode.children = childNode.children.map(task => ({
              taskId: task.taskId,
              taskName: task.taskName,
              scheduleStart: task.scheduleStart,
              scheduleEnd: task.scheduleEnd,
              estimatedWorkingHoursAll: task.estimatedWorkingHoursAll,
              estimatedWorkingHoursSelf: task.estimatedWorkingHoursSelf
            }));
          }

          return transformedNode;
        });
      }

      return transformedItem;
    });
  };

  // flag 是基于当前考勤和工时快照计算的临时状态，暂存/接口数据中的历史 flag 不参与恢复渲染。
  const clearPersistedDateFlags = (nodes) => (nodes || []).map((node) => {
    const nextNode = { ...node };
    Object.keys(nextNode).forEach((key) => {
      if (dayjs(key, "YYYY-MM-DD", true).isValid() && nextNode[key] && typeof nextNode[key] === "object") {
        const { flag, ...dateValue } = nextNode[key];
        nextNode[key] = dateValue;
      }
    });
    if (Array.isArray(nextNode.children)) {
      nextNode.children = clearPersistedDateFlags(nextNode.children);
    }
    return nextNode;
  });
  /*
  查找匹配的项
  data1: 工作项实例数据
  data2: 右下角添加实例
  返回值: 匹配的项数组
  */
  // 查找匹配的项
  const findMatchingItems = (data1, data2) => {
    const results = [];
    const { workItemIds, workItemEntityId, nodeIds } = data2;
    let allNodeIds = []
    // 遍历data1找到匹配的项
    data1.forEach(item1 => {
      // 检查workItemId和workItemEntityId是否匹配
      if (workItemIds.includes(item1.workItemId) &&
        workItemEntityId === item1.workItemEntityId) {
        if (nodeIds.length > 0) {
          // 检查nodeId是否匹配
          nodeIds.forEach(nodeInfo => {
            const { nodeId, taskIds } = nodeInfo;

            // 检查item1的children中是否有匹配的nodeId
            if (item1.children && item1.children.length > 0) {
              item1.children.forEach(child => {
                allNodeIds.push(child.nodeId)
                if (child.nodeId === nodeId) {
                  if (taskIds && taskIds.length > 0) {
                    // 检查taskId是否匹配
                    // 过滤出满足task.taskId === taskId条件的数据
                    const filteredTasks = child.children?.filter(task => taskIds.includes(task.taskId)) || [];
                    // 将过滤后的结果赋值给child.children
                    child.children = filteredTasks;

                  } else {
                    child.children = null
                  }
                }
              });
            }
          });
        } else {
          item1.children = null
        }
      }
    });
    const allTaskIdsEmpty = nodeIds.every(nodeInfo =>
      nodeInfo.taskIds?.length === 0
    );
    if (allTaskIdsEmpty && nodeTaskOptions.length === nodeIds.length) {
      if (data1.length > 0) {
        data1[0].children = null
      }
    }
    return data1;
  };
  const getQueryCache = async (num) => {
       //setLoading(true); // 开始加载
    // setRegisterCacheLoading(true); // 设置区域为加载状态
    // // setTableLoading(true); // 开始加载
    // setTableLoading2(true); // 开始加载
    //setIsModalVisible(true);
    try {
      const res = await getRegisterCache({ type: num });
      let latestWorkItemIds = [];
      if (res?.result) {
        if (res?.data) {
          // if (props?.type !== "tab") { setHasMore(true) }
          // setHasCache(true);
          // hasCacheRef.current = true
          //setEditData(aggregateWorkHours(res?.data?.addWorkHours));
          //editDataRef.current = aggregateWorkHours(res?.data?.addWorkHours)
          //localHourCache.current = aggregateWorkHours(res?.data?.addWorkHours)
          localHourCache.current = res?.data?.addWorkHours
          //setUpdateEditData(res?.data?.addWorkHours)
        }
        //setLoading(false)
      } else {
        //setTableLoading2(false); // 开始加载
      }
      // setIsInitialized(true);
      // setLoading(false)
    } catch (error) {
      // setLoading(false)
      // setTableLoading2(false); // 开始加载
      // setIsModalVisible(false);
     
    } finally {
      // setIsInitialized(true);
      // setRegisterCacheLoading(false); // 设置区域为非加载状态
    }
  }
  const querySaveWorkHour = async (temporary) => {
      await saveWorkHour(temporary)
      await getQueryCache(temporary)
  }
  //保存工时
  const saveWorkHour = async (temporary) => {
    setSaveHourLoadings(true);
    try {
      let point = '';
      if (temporary) {
        point = -1;
      }else{
        if (props.type === "tab") {
          point = props?.workItemEntityId;
        }
      }
      const data = {
        point: point, //实例id
        queryRegistrationReq: {
          level: expandLevel,
          isLaunchAgain: false,
          pageNum: workInstancePagination.pageNum,
          pageSize: workInstancePagination.pageSize,
          scheduleStart,
          scheduleEnd,
          beginWorkDate: beginWorkDateCP,
          endWorkDate: endWorkDateCP,
          isPersonInCharge: isPersonInCharge,
          personInCharge: isPersonInCharge == 0 ? registrantUserKey : null,
          workItemIds: workItemIds,
          registerUserKey: registrantUserKey,
          workItemIdsFilter: workItemIdsFilter
        }
      };
      if (tableAddDataSourceRef.current?.length > 0 || addExtraRef.current?.length > 0) {
        let addExtra = []
        tableAddDataSourceRef.current.forEach((item) => {
          addExtra.push(item.workItemEntityId)
        })
        // 合并addExtraRef.current并去重
        const mergedAddExtra = [...new Set([...addExtra, ...addExtraRef.current])];
        data.queryRegistrationReq.addExtra = mergedAddExtra;
        data.queryRegistrationReq.addExtraEntities = {
          entities: filterRegistrationRef.current
        }
      }
      const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
      const addWorkHourRequests = [];
      rangeDates?.forEach((date, dateIndex) => {
        addWorkHourRequests[dateIndex] = {
          workDate: date.date,
          staffUserKey: registrantUserKey,
          addEntities: [],
        };
        workInstanceDataSource?.entities?.forEach((item) => {
          if (item[date.date]?.actWorkHour) {
            const entity = {
              workItemId: item.workItemId,
              workItemEntityId: item.workItemEntityId,
              actWorkHour: item[date.date].actWorkHour,
              workDesc: item[date.date].workDesc,
              workItemName: item.workItemName,
              workItemEntityName: item.workItemEntityName,
              scheduleStart: item.scheduleStart,
              scheduleEnd: item.scheduleEnd,
              estimatedWorkingHoursAll: item.estimatedWorkingHoursAll,
              estimatedWorkingHoursSelf: item.estimatedWorkingHoursSelf,
            };
            if (item.workItemEntityName.includes("[已删除]")) {
              entity.workItemEntityName = item.workItemEntityName.includes('[已删除]') ? item.workItemEntityName.replace('[已删除]', '') : item.workItemEntityName
              entity.tag = 0
            }
            const addNodes = [];
            item?.children?.forEach((node) => {
              if (node[date.date]?.actWorkHour) {
                const nodeItem = {
                  nodeId: node.nodeId,
                  nodeName: node.nodeName,
                  actWorkHour: node[date.date]?.actWorkHour,
                  workDesc: node[date.date]?.workDesc,
                  scheduleStart: node.scheduleStart,
                  scheduleEnd: node.scheduleEnd,
                  estimatedWorkingHoursAll: node.estimatedWorkingHoursAll,
                  estimatedWorkingHoursSelf: node.estimatedWorkingHoursSelf,
                };
                if (item.workItemEntityName.includes("[已删除]")) {
                  nodeItem.tag = 0
                }
                if (node.nodeName.includes("[已删除]")) {
                  nodeItem.tag = 0
                }
                nodeItem.nodeName = node.nodeName.includes('[已删除]') ? node.nodeName.replace('[已删除]', '') : node.nodeName
                const addTasks = [];
                node?.children?.forEach((task) => {
                  if (task[date.date]?.actWorkHour) {
                    const taskItem = {
                      taskId: task.taskId,
                      taskName: task.taskName,
                      actWorkHour: task[date.date]?.actWorkHour,
                      workDesc: task[date.date]?.workDesc,
                      scheduleStart: task.scheduleStart,
                      scheduleEnd: task.scheduleEnd,
                      estimatedWorkingHoursAll: task.estimatedWorkingHoursAll,
                      estimatedWorkingHoursSelf: task.estimatedWorkingHoursSelf,
                    };
                    if (node.nodeName.includes("[已删除]")) {
                      taskItem.tag = 0
                    }
                    if (task.taskName.includes("[已删除]")) {
                      taskItem.tag = 0
                    }
                    taskItem.taskName = task.taskName.includes('[已删除]') ? task.taskName.replace('[已删除]', '') : task.taskName
                    addTasks.push(taskItem);
                  }
                });
                nodeItem.addTasks = addTasks;
                addNodes.push(nodeItem);
              }
            });
            entity.addNodes = addNodes;
            addWorkHourRequests[dateIndex].addEntities.push(entity);
          }
        });
      });
      data.registrationData = addWorkHourRequests.filter(
        (item) => item.addEntities.length > 0
      );
      let registrationObjects = transformWorkHourData(workInstanceDataSource.entities)
      data.registrationObjects = {
        "pageNum": 1,
        "pageSize": 10,
        "total": 1,
        "hasNext": true,
        "entities": transformWorkHourData(workInstanceDataSource.entities)
      }
      const res = await saveRegisterCache(data);
      if (res?.result) {
        //window.JSSDK.toast.success('保存成功')
      } else {
        if (res?.data && res?.data?.code && (res?.data?.code == 10024 || res?.data?.code == 10025 || res?.data?.code == 10026)) {
        } else {
          window.JSSDK.toast.error(res?.msg || '保存失败')
        }
      }
      if (props?.openType === 'tab') {
        props.setSubmitLoadings(false);
      } else {
        props.setSaveHourLoadings(false);
        setSaveHourLoadings(false);
        if (res?.data && res?.data?.code && (res?.data?.code == 10024 || res?.data?.code == 10025 || res?.data?.code == 10026)) {
        } else {
          if(point !== -1){
            props.submitResult(1);
          }
        }
      }
    } catch (e) {
      console.log('e', e)
    }
  }
  const getUserStandWorkHourData = async () => {
    try {
      const res = await getUserStandWorkHour({ userKey: registrantUserKey });
      if (res?.result) {
        if (res?.data) {
          const capacityData = {
            "dayUp": res?.data?.dayUp || 24.0,
            "onceDown": res?.data?.onceDown || 0.1,
            "standWorkHour": res?.data?.standWorkHour || 8.0
          }
          capacitySetRef.current = capacityData;
          setCapacitySet(capacityData);
        }
      } else {
        // 设置默认值
        const defaultCapacityData = {
          "dayUp": 24,
          "onceDown": 0.1,
          "standWorkHour": 8
        };
        setCapacitySet(defaultCapacityData);
      }
    } catch (e) {
      console.log('e', e)
    }
  }
  /** 查询登记设置 */
  const getCapacity = async () => {
    try {
      const res = await getRegistrationSettings();
      let authData = null
      if (res?.result) {
        if (res?.data) {
          setShowAllResponsibleOptions(res?.data?.myselfStatus); //1- 表示可以自己负责，0-表示全部负责
          if (res?.data?.myselfStatus === 0 && props?.openType === "again_launch") {
            setIsPersonInCharge(1);
          }
          setShowResponsibleFilter(true);
          // 获取工作描述必填状态：1-必填，其他 - 非必填
          workDescReq.current = res?.data?.workDescReq || 0;
          // 存储工时颗粒度配置，供颗粒度整数倍校验使用
          granularityRef.current = {
            enabled: res?.data?.isEnableGranularity ?? 0,
            hour: res?.data?.granularityHour ?? null,
          };
          authData = {
            "isPersonInCharge": res?.data?.myselfStatus == 0 ? 1 : 0 || 0,
          }
        } else {
        }
      } else {
      }
      return authData;
    } catch (error) {
      return authData;
    }
  };
  useEffect(() => {
    if (showAllResponsibleOptions == 1) {
      setIsPersonInCharge(0);
    }
  }, [showAllResponsibleOptions, isPersonInCharge])

  /** 获取上次登记的筛选条件 */
  const queryFilterMemory = async () => {
    setRegisterCacheLoading(true);
    setTableLoading2(true);
    try {
      const res = await getRegisterMemory({
        point: props?.type === "tab" ? "tab" : "batch",
      });
      if (!res?.result || !res?.data) {
        hasRestoredFilterMemoryRef.current = false;
        return { hasMemory: false, workItemIds: [], beginWorkDate: "", endWorkDate: "", staffUserKey: "" };
      }

      const memoryData = res.data;
      const queryRegistrationReq = Array.isArray(memoryData.queryRegistrationReq)
        ? memoryData.queryRegistrationReq
        : [];
      const memoryWorkItems = queryRegistrationReq.reduce(
        (result, item) => result.concat(
          Array.isArray(item?.workItemIds) ? item.workItemIds : []
        ),
        []
      );
      const memoryWorkItemFilters = queryRegistrationReq.reduce(
        (result, item) => result.concat(
          Array.isArray(item?.workItemIdsFilter) ? item.workItemIdsFilter : []
        ),
        []
      );
      const memoryWorkItemIds = [
        ...new Set(
          memoryWorkItems
            .map((item) => item?.workItemId)
            .filter(Boolean)
        ),
      ];
      const memoryWorkItemEntityIds = memoryWorkItemFilters.map((item) =>
        JSON.stringify({
          projectKey: item.projectKey,
          workItemId: item.workItemId,
          label: item.workItemEntityName,
          value: item.workItemEntityId,
        })
      );

      setWorkItemIds(memoryWorkItemIds);
      setSearchWorkItemIds(memoryWorkItemIds);
      setWorkItemIdsFilter(memoryWorkItemFilters);
      beforeAddWorkItemIdsRef.current = memoryWorkItemIds;
      beforeWorkItemIdsFilterRef.current = memoryWorkItemFilters;
      setWorkItemEntityIds(memoryWorkItemEntityIds);
      setSearchWorkItemEntityIds(memoryWorkItemEntityIds);
      setWorkItemEntityCustomFieldValues({});

      if (memoryData.staffUserKey) {
        setRegistrantUserKey(memoryData.staffUserKey);
        props.getRegistrantUserKey(memoryData.staffUserKey);
      }
      if (typeof memoryData.isPersonInCharge === "number") {
        setIsPersonInCharge(memoryData.isPersonInCharge);
      }
      if (memoryData.beginWorkDate && memoryData.endWorkDate) {
        setBeginWorkDate(memoryData.beginWorkDate);
        setEndWorkDate(memoryData.endWorkDate);
        setBeginWorkDateCP(memoryData.beginWorkDate);
        setEndWorkDateCP(memoryData.endWorkDate);
        setWorkDateType(
          resolveWorkDateType(memoryData.beginWorkDate, memoryData.endWorkDate)
        );
      }
      setScheduleStart(memoryData.scheduleStart || null);
      setScheduleEnd(memoryData.scheduleEnd || null);
      manualSelection.current = true;
      hasRestoredFilterMemoryRef.current = true;

      // 一并回传记忆里的登记区间与登记人：无缓存时用它构造考勤查询上下文
      // （有记忆数据用记忆日期，没有记忆数据则回退默认日期，见 initData 无缓存分支）
      return {
        hasMemory: true,
        workItemIds: memoryWorkItemIds,
        beginWorkDate: memoryData.beginWorkDate || "",
        endWorkDate: memoryData.endWorkDate || "",
        staffUserKey: memoryData.staffUserKey || "",
      };
    } catch (error) {
      console.error("查询筛选条件记忆失败:", error);
      hasRestoredFilterMemoryRef.current = false;
      return { hasMemory: false, workItemIds: [], beginWorkDate: "", endWorkDate: "", staffUserKey: "" };
    } finally {
      setRegisterCacheLoading(false);
    }
  };

  //获取暂存内容
  const queryCache = async () => {
    //setLoading(true); // 开始加载
    setRegisterCacheLoading(true); // 设置区域为加载状态
    // setTableLoading(true); // 开始加载
    setTableLoading2(true); // 开始加载
    //setIsModalVisible(true);
    try {
      const res = await getRegisterCache({ type: point });
      let latestWorkItemIds = [];
      // 供 initData 编排考勤请求用：缓存的登记人与日期范围
      let cacheRenderInfo = {
        hasCacheEntities: false,
        registerUserKey: "",
        beginWorkDate: "",
        endWorkDate: "",
      };
      if (res?.result) {
        if (res?.data) {
          cacheModeRef.current = true;
          if (props?.type !== "tab") { setHasMore(true) }
          setHasCache(true);
          hasCacheRef.current = true
          setEditData(
            aggregateWorkHours(res?.data?.addWorkHours)
          );
          editDataRef.current = aggregateWorkHours(res?.data?.addWorkHours)
          setUpdateEditData(res?.data?.addWorkHours)
          if (res?.data?.queryRegistrationReq?.workItemIdsFilter.length > 0) {
            // 标记已删除的工作项实例
            const workItemEntityIdsList = []
            const customFieldValues = {};
            res?.data?.queryRegistrationReq?.workItemIdsFilter.forEach((item) => {
              workItemEntityIdsList.push(JSON.stringify({
                workItemId: item.workItemId,
                label: item.workItemEntityName,
                value: item.workItemEntityId
              }));
              customFieldValues[
                getWorkItemEntityOptionKey(item.workItemId, item.workItemEntityId)
              ] = item.customFieldValue;
            });
            setWorkItemEntityIds(workItemEntityIdsList);
            setWorkItemEntityCustomFieldValues(customFieldValues);
          } else {
            setWorkItemEntityIds([]);
            setWorkItemEntityCustomFieldValues({});
          }
          setExpandLevel(res?.data?.queryRegistrationReq?.level || 1);
          setWorkItemIds(res?.data?.queryRegistrationReq?.workItemIds || []);
          beforeAddWorkItemIdsRef.current = res?.data?.queryRegistrationReq?.workItemIds || [];
          latestWorkItemIds = res?.data?.queryRegistrationReq?.workItemIds || [];
          setWorkItemIdsFilter(res?.data?.queryRegistrationReq?.workItemIdsFilter || []);
          beforeWorkItemIdsFilterRef.current = res?.data?.queryRegistrationReq?.workItemIdsFilter || [];
          // 保留原有的children结构，不强制设置为空数组
          const cacheEntities = clearPersistedDateFlags(
            JSON.parse(JSON.stringify(res?.data?.registrationObjectResponse?.entities || []))
          );
          cacheEntities.forEach((item) => {
            item.cache = true;
            item.refresh = 0;
          })
         
          setCacheWorkInstanceDataSource(cacheEntities);
          cacheWorkInstanceDataSourceRef.current = cacheEntities;
          if (cacheWorkInstanceDataSourceRef.current?.length) {
            setExcludeWorkItemEntityIdListCache(cacheWorkInstanceDataSourceRef.current.map(item => item.workItemEntityId))
          }
          let beginWorkDateInfo = res?.data?.queryRegistrationReq?.beginWorkDate || getWeekStartAndEnd().Monday;
          let endWorkDateInfo = res?.data?.queryRegistrationReq?.endWorkDate || getWeekStartAndEnd().Sunday;
          let dataAll = [];
          if (hasCacheRef.current) {
            if (cacheWorkInstanceDataSourceRef.current?.length) {
              const cacheTableSource = JSON.parse(JSON.stringify(cacheWorkInstanceDataSourceRef.current));
              cacheTableSource?.forEach((item) => {
                traverseTreeClearDate(item);
                traverseTreeRecursively(item, beginWorkDateInfo, endWorkDateInfo);
              });
              dataAll.push(...cacheTableSource);
            }
          }
          dataAll = [...new Set(dataAll?.map((item) => item.id))].map((id) => {
            return dataAll?.find((item) => item.id === id);
          });
          // 缓存表格不在此时渲染：开启考勤时要等考勤数据回来再渲染，
          // 否则缓存先渲染、考勤后到的中间态会把单元格误判成超出上限（红色一闪即逝）。
          // 具体渲染时机见 runPendingCacheRender / flushPendingCacheRender。
          // 关键修改：重置分页状态，确保后续请求从第一页开始
          setWorkInstancePagination({
            pageNum: 1,
            pageSize: 10,
          });
          if (res?.data?.canNotRegisterLevelPromptStr) {
            window.JSSDK.toast.error(`${res?.data?.canNotRegisterLevelPromptStr}`);
          }
          if (res?.data?.removePromptStr) {
            window.JSSDK.toast.error(`${res?.data?.removePromptStr}`);
          }
          if (res?.data?.queryRegistrationReq) {
            setRegistrantUserKey(res?.data?.queryRegistrationReq?.registerUserKey || '');
            props.getRegistrantUserKey(res?.data?.queryRegistrationReq?.registerUserKey || '');
            setIsPersonInCharge(res?.data?.queryRegistrationReq?.isPersonInCharge);
            setBeginWorkDate(res?.data?.queryRegistrationReq?.beginWorkDate || getWeekStartAndEnd().Monday);
            setEndWorkDate(res?.data?.queryRegistrationReq?.endWorkDate || getWeekStartAndEnd().Sunday);
            setBeginWorkDateCP(res?.data?.queryRegistrationReq?.beginWorkDate || getWeekStartAndEnd().Monday);
            setEndWorkDateCP(res?.data?.queryRegistrationReq?.endWorkDate || getWeekStartAndEnd().Sunday);
            setScheduleEnd(res?.data?.queryRegistrationReq?.scheduleEnd || null);
            setScheduleStart(res?.data?.queryRegistrationReq?.scheduleStart || null);
            addExtraRef.current = res?.data?.queryRegistrationReq?.addExtra || [];
            filterRegistrationRef.current = res?.data?.queryRegistrationReq?.addExtraEntities?.entities || [];
          }
          if (cacheEntities?.length > 0) {
            tableRenderPendingRef.current = true;
            // 挂起渲染任务，等 initData 里考勤数据就绪（或超时）后再执行
            pendingCacheRenderRef.current = {
              dataAll,
              level: res?.data?.queryRegistrationReq?.level || 1,
              begin: beginWorkDateInfo,
              end: endWorkDateInfo,
            };
            cacheRenderInfo = {
              hasCacheEntities: true,
              registerUserKey: res?.data?.queryRegistrationReq?.registerUserKey || "",
              beginWorkDate: beginWorkDateInfo,
              endWorkDate: endWorkDateInfo,
            };
          } else {
            // 缓存里没有工作项实体（没有工时会被误判）时，保持原逻辑立即渲染
            setWorkInstanceDataSource({
              ...workInstanceDataSource,
              entities: dataAll,
            });
            handleExpandLevelChange(res?.data?.queryRegistrationReq?.level || 1, dataAll, 1, 1, beginWorkDateInfo, endWorkDateInfo);
            if(workItemIds.length==0){
              setTableLoading2(false)
            }
          }
          //setTableLoading2(false); // 开始加载
        } else {
          cacheModeRef.current = false;
          setExcludeWorkItemEntityIdListCache([]);
          excludeWorkItemEntityIdListCacheRef.current = [];
          setCacheWorkInstanceDataSource([]);
          cacheWorkInstanceDataSourceRef.current = [];
          if (props?.type === "tab") {
            setWorkItemIds([props?.workItemId]);
            latestWorkItemIds = [props?.workItemId];
            setWorkItemEntityId(props?.workItemEntityId);
          }
          manualSelection.current = true;
        }
        setLoading(false)
        // setTableLoading(false);
        //setIsModalVisible(false); 
      } else {
        // API调用失败的情况
        setExcludeWorkItemEntityIdListCache([]);
        excludeWorkItemEntityIdListCacheRef.current = [];
        setCacheWorkInstanceDataSource([]);
        cacheWorkInstanceDataSourceRef.current = [];
        if (props?.type === "tab") {
          setWorkItemIds([props?.workItemId]);
          latestWorkItemIds = [props?.workItemId];
          setWorkItemEntityId(props?.workItemEntityId);
        }
        manualSelection.current = true;
        // loading 由筛选记忆查询完成后统一决定
      }
      setIsInitialized(true);
      setLoading(false)
      //setTableLoading2(false); // 开始加载
      return {
        hasCache: Boolean(res?.result && res?.data),
        shouldQueryMemory: !Boolean(res?.result && res?.data),
        workItemIds: latestWorkItemIds,
        ...cacheRenderInfo,
      };
    } catch (error) {
      cacheModeRef.current = false;
      setLoading(false)
      setIsModalVisible(false);
      // setLoading(false)
      // setTableLoading(false); // 
      // 异常情况下也清空缓存数据
      setExcludeWorkItemEntityIdListCache([]);
      excludeWorkItemEntityIdListCacheRef.current = [];
      setCacheWorkInstanceDataSource([]);
      cacheWorkInstanceDataSourceRef.current = [];
      return {
        hasCache: false,
        shouldQueryMemory: true,
        workItemIds: [],
      };
    } finally {
      setIsInitialized(true);
      setRegisterCacheLoading(false); // 设置区域为非加载状态
    }
  }
  /** 弹窗登记展示逻辑及判断是不是标品 */
  const getRegDisplayLogic = async () => {
    const res = await getDisplayLogic();
    if (res?.result) {
      setRegDisplayLogic(res.data);
      if ("standardProduct" in res.data && !res.data?.standardProduct) {
        if (!hasRestoredFilterMemoryRef.current) {
          setScheduleStart(beginWorkDate);
          setScheduleEnd(endWorkDate);
        }
      }
    }
  };

  /** 埋点：记录用户使用批量登记频次 */
  const getUserActive = async (data) => {
    await postUserActive({
      activeType: data,
    });
  };

  /** 获取配置表格展示排序 */
  const getTableSortConfig = async () => {
    const res = await getBatchRegTableSortConfig();
    if (res?.result) {
      setColumnsSet(res.data);
    }
  };

  useEffect(() => {
    getTableSortConfig();
  }, []);

  /** 保存配置表格展示排序 */
  const saveTableSortConfig = async (value) => {
    const data = {
      registrationHead: value,
    };
    await postBatchRegTableSortConfig(data);
  };

  /** 获取工作项类型 */
  const getWorkItemOptions = async (searchKey) => {
    const params = {
      workItemName: searchKey
    };
    if (props?.openType === "again_launch") {
      params.needDisable = true
    }
    const res = await getWorkItemOptionForRegister(params);
    if (res?.result) {
      // if (props.openType === "again_launch") {
      //   // 合并workItemList和res.data
      //   const mergedData = [...res.data];
      //   // 遍历workItemList，检查每个对象是否在res.data中存在
      //   let workItemListArr = workItemListRef.current
      //   if(workItemListArr?.length){
      //     workItemListArr.forEach(workItem => {
      //       // 检查是否在res.data中已存在（通过workItemId判断）
      //       const existsInResData = res?.data?.some(item => item.value === workItem.workItemId);

      //       // 如果不存在，则添加到合并结果中，并修改名称
      //       if (!existsInResData) {
      //         mergedData.push({
      //           ...workItem,
      //           label: workItem.workItemName.includes('[已删除]')
      //             ? workItem.workItemName
      //             : `${workItem.workItemName}[已删除]`,
      //           value: workItem.workItemId
      //         });
      //       }
      //     });
      //   }
      //   // 使用合并后的数据
      //   res.data = mergedData;
      // }
      if (regDisplayLogic?.defaultBatchRegisWorkItemType?.length && regDisplayLogic?.standardProduct === false) {
        setWorkItemOptions(
          res.data?.filter((item) =>
            regDisplayLogic?.defaultBatchRegisWorkItemType.includes(item.value)
          )
        );
        if (!hasRestoredFilterMemoryRef.current) {
          setWorkItemIds(regDisplayLogic?.defaultBatchRegisWorkItemType);
          setInvoke(true);
        }
      } else {
        setWorkItemOptions([...res.data]);
      }
    }
  };

  useEffect(() => {
    getWorkItemOptions();
  }, [regDisplayLogic]);

  /** 获取当前用户角色 */
  const getRole = async () => {
    const res = await getUserRole();
    if (res?.result) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
      if (canShowTenantAdminFeature()) getConfig();
    }
  };

  /**
   * 查询考勤配置状态（租户/项目级）
   * 租户模式：页面初始化时调用；空间模式：传 sessionStorage 的 projectKey
   * @param {string} currentMode - 当前模式：tenant / space
   */
  const getAttendanceConfigInfoLegacy = async (currentMode) => {
    try {
      // 租户模式：projectKey 传空（全局配置）；空间模式：传 sessionStorage 的 projectKey
      const data = currentMode === "space"
        ? { projectKey: sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || '' }
        : {};
      const res = await getAttendanceConfig(data);
      if (res?.result && res?.data) {
        const data = res.data;
        const isEnable = data.enable ?? data.isEnable ?? 0;
        setAttendanceEnabled(isEnable);
        setUpperLimitSource(data.upperLimitSource ?? 1);
        setMissPunchPolicy(data.missPunchPolicy ?? 1);
        setMissPunchCustomLimit(data.missPunchCustomLimit ?? null);
        // 同步更新ref
        attendanceConfigRef.current.enabled = isEnable;
        attendanceConfigRef.current.policy = data.missPunchPolicy ?? 1;
        attendanceConfigRef.current.customLimit = data.missPunchCustomLimit ?? null;
        // 考勤开启时串行拉取成员考勤数据
        if (isEnable === 1) {
          await getUserAttendanceConfigData(isEnable);
        }
      }
    } catch (error) {
      console.error('获取考勤配置状态失败:', error);
      // 配置查询失败时兜底开启考勤标记（与 H5 容错行为一致）
      setAttendanceEnabled(1);
      attendanceConfigRef.current.enabled = 1;
    }
  };

  /**
   * 获取用户考勤数据（成员 + 日期粒度）
   * 根据考勤配置 + 考勤记录，确定四类场景：
   *   场景1 考勤关闭；场景2 有考勤记录；场景3 缺卡-允许提交；场景4 缺卡-不允许提交
   * @param {number} enabled - 当前考勤启用状态（避免 state 异步更新问题）
   */
  const getUserAttendanceConfigData = async (enabled) => {
    const isEnabled = enabled !== undefined ? enabled : attendanceConfigRef.current.enabled;
    if (!isEnabled) return;
    // 日期统一为 YYYY-MM-DD 字符串，确保考勤索引（projectKey|userKey|date）查询匹配
    const attDateStr = workDate ? dayjs(workDate).format("YYYY-MM-DD") : '';
    const data = {
      items: [{
        projectKey: mode === 'space'
          ? (sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || '')
          : null,
        userKey: registrantUserKey,
      }],
      startDate: attDateStr,
      endDate: attDateStr
    };
    try {
      const res = await getUserAttendanceConfig(data);
      if (res?.result && res?.data) {
        // res.data 可能是项目数组（含 userKeys 明细）或单配置对象；
        // 数组不含 enable 字段，跳过开关状态覆盖（开关状态由 getAttendanceConfig 决定）
        const cfgData = res.data;
        if (!Array.isArray(cfgData)) {
          setAttendanceEnabled(cfgData.isEnable ?? cfgData.enable ?? 0);
          setUpperLimitSource(cfgData.upperLimitSource ?? 1);
          setMissPunchPolicy(cfgData.missPunchPolicy ?? 1);
          setMissPunchCustomLimit(cfgData.missPunchCustomLimit ?? null);
          attendanceConfigRef.current.enabled = cfgData.isEnable ?? cfgData.enable ?? 0;
          attendanceConfigRef.current.policy = cfgData.missPunchPolicy ?? 1;
          attendanceConfigRef.current.customLimit = cfgData.missPunchCustomLimit ?? null;
        }
        // 单对象直接含 hasAttendance/attendanceHours（H5 批量登记返回结构）时直接处理
        if (!Array.isArray(cfgData) && cfgData && typeof cfgData === 'object' && 'hasAttendance' in cfgData) {
          if (cfgData.attendanceHours) {
            attendanceConfigRef.current.hours = cfgData.attendanceHours;
            attendanceConfigRef.current.syncHours = cfgData.attendanceHours;
            setAttendanceHours(cfgData.attendanceHours);
          } else {
            attendanceConfigRef.current.hours = null;
            if ((cfgData.missPunchPolicy ?? attendanceConfigRef.current.policy) === 2) {
              attendanceConfigRef.current.syncHours = cfgData.missPunchCustomLimit;
            } else {
              attendanceConfigRef.current.syncHours = null;
            }
            setAttendanceHours(null);
          }
          return;
        }
        // 解析考勤索引，O(1) 查询成员/日期考勤数据
        const list = Array.isArray(cfgData) ? cfgData : [cfgData];
        const index = buildAttendanceIndex(list);
        let lookupProjectKey = sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || '';
        const attendance = getAttendance(index, lookupProjectKey, registrantUserKey, attDateStr);
        if (attendance !== null) {
          // 有考勤配置数据，赋值对应配置字段
          if (attendance.attendanceHours) {
            // 有实际打卡记录 → attendanceHours取考勤工时
            attendanceConfigRef.current.hours = attendance.attendanceHours;
            attendanceConfigRef.current.syncHours = attendance.attendanceHours;
            setAttendanceHours(attendance.attendanceHours);
          } else {
            // 缺卡：attendanceHours保持为null，Alert显示"无考勤记录"
            attendanceConfigRef.current.hours = null;
            if (attendance.missPunchPolicy === 2) {
              // 缺卡允许提交(自定义上限)：ref保存自定义上限供剩余工时计算使用
              attendanceConfigRef.current.syncHours = attendance.missPunchCustomLimit;
            } else {
              // 缺卡不允许提交
              attendanceConfigRef.current.syncHours = null;
            }
            setAttendanceHours(null);
          }
        } else {
          // 情况1：无考勤记录 → 缺卡，不允许提交
          attendanceConfigRef.current.hours = null;
          attendanceConfigRef.current.syncHours = null;
          setAttendanceHours(null);
          setMissPunchPolicy(1);
          attendanceConfigRef.current.policy = 1;
        }
      }
    } catch (error) {
      console.error('获取用户考勤配置失败:', error);
      setAttendanceHours(0);
      setMissPunchPolicy(1);
      attendanceConfigRef.current.hours = null;
      attendanceConfigRef.current.syncHours = null;
    }
  };

  const syncAttendanceConfigData = async () => {
    try {
      const res = await syncAttendanceConfig();
      if (res?.result && res?.data) {
        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!data) return;
        const enabled = normalizeAttendanceNumber(data.enable ?? data.isEnable, 0);
        const policy = normalizeAttendanceNumber(data.missPunchPolicy, 1);
        const customLimit = normalizeAttendanceNumber(data.missPunchCustomLimit);
        setAttendanceEnabled(enabled);
        setUpperLimitSource(normalizeAttendanceNumber(data.upperLimitSource, 1));
        setMissPunchPolicy(policy);
        setMissPunchCustomLimit(customLimit);
        // 同步更新ref
        attendanceConfigRef.current.enabled = enabled;
        attendanceConfigRef.current.policy = policy;
        attendanceConfigRef.current.customLimit = customLimit;
      }
    } catch (error) {
      console.error('同步考勤配置失败:', error);
    }
  };

  /** 查询是否开启代填工时功能 */
  const getAttendanceContext = (
    dateBegin = beginWorkDate,
    dateEnd = endWorkDate,
    userKey = registrantUserKey
  ) => {
    const appMode=getAppModeInfo();
    const isSpaceMode = appMode === "space";
    const projectKey = isSpaceMode
      ? (sessionStorage.getItem("jwtMeegoTeamworkProjectKey") || "")
      : null;
    return { isSpaceMode, projectKey, userKey, beginWorkDate: dateBegin, endWorkDate: dateEnd };
  };

  // 考勤接口的数值字段可能返回数字或数字字符串；统一归一化后再参与场景判断。
  const normalizeAttendanceNumber = (value, fallback = null) => {
    if (value === null || value === undefined || value === "") return fallback;
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : fallback;
  };

  // 考勤已开启、但该日期的考勤快照还没查回来时，单天上限属于"未知"，不能按 0 参与判定。
  // 否则暂存缓存先渲染出来的工时会全部被判成"超出单天上限"而闪现红色背景，
  // 等考勤数据回来重算又恢复正常，表现为红色一闪即逝。
  // 真正"缺卡"的日期是能取到快照的（attendanceHours = 0），不属于未知，仍按原规则判红。
  const isAttendanceLimitUnknown = (dateAttendance, enabled) =>
    Number(normalizeAttendanceNumber(enabled, 0)) === 1 && !dateAttendance;

  // attendanceHours 为 0 表示没有有效考勤工时，缺卡允许提交时应回退到自定义上限。
  const resolveAttendanceUpperLimit = ({ enabled, hours, policy, customLimit, dayUp }) => {
    const normalizedEnabled = normalizeAttendanceNumber(enabled, 0);
    const normalizedHours = normalizeAttendanceNumber(hours);
    const normalizedPolicy = normalizeAttendanceNumber(policy, 1);
    const normalizedCustomLimit = normalizeAttendanceNumber(customLimit);
    if (normalizedEnabled === 0) {
      return normalizeAttendanceNumber(dayUp, 24) || 24;
    }
    if (normalizedHours !== null && normalizedHours > 0) {
      return normalizedHours;
    }
    if (normalizedPolicy === 2 && normalizedCustomLimit !== null) {
      return normalizedCustomLimit;
    }
    return 0;
  };

  const getAttendanceSnapshot = (date, context = attendanceContextRef.current) => {
    //console.log('date', date,attendanceContextRef.current);
    if (!date || !context?.userKey) return null;
    const projectKey = context.isSpaceMode ? (context.projectKey || "") : "tenant";
    const index = attendanceIndexRef.current;
    let attendance = getAttendance(index, projectKey, context.userKey, date);
    let config = index.configMap.get(projectKey) || {};
    if (!attendance && !context.isSpaceMode) {
      attendance = getAttendance(index, null, context.userKey, date);
      config = index.configMap.get(null) || config;
    }
    if (!attendance && !Object.keys(config).length) return null;
    // 查询成功但当前成员在该日期没有考勤明细时，按缺卡且不允许提交处理。
    // 项目级配置仍保留用于判断考勤是否开启，但不能用其缺卡策略覆盖日期缺失状态。
    const attendanceEnabled = normalizeAttendanceNumber(
      attendance?.isEnable ?? attendance?.enable ?? config.isEnable ?? config.enable,
      0
    );
    const isMissingDateAttendance = !attendance && attendanceEnabled === 1;
    const rawAttendanceHours = attendance ? attendance.attendanceHours : null;
    return {
      ...config,
      ...(attendance || {}),
      attendanceEnabled,
      // 保留 0 给 Alert 识别“无考勤记录”，上限解析会把 0 视为无有效考勤工时。
      attendanceHours: isMissingDateAttendance
        ? 0
        : normalizeAttendanceNumber(rawAttendanceHours),
      missPunchPolicy: normalizeAttendanceNumber(
        attendance?.missPunchPolicy ?? config.missPunchPolicy,
        1
      ),
      missPunchCustomLimit: normalizeAttendanceNumber(
        attendance?.missPunchCustomLimit ?? config.missPunchCustomLimit
      ),
      projectKey,
      userKey: context.userKey,
      workDate: date,
    };
  };

  const getDateCapacitySnapshot = (date) => {
    const attendance = attendanceSnapshotMap[date] || getAttendanceSnapshot(date);
    const saturationSnapshot = capacitySnapshotRef.current?.workDate === date
      && capacitySnapshotRef.current?.userKey === registrantUserKey
      ? capacitySnapshotRef.current
      : null;
    const registered = saturationSnapshot || workHoursTotalDetail?.[date] || {};
    if (!attendance && !Object.keys(registered).length) return null;
    // 区间统计接口使用 approvalingWorkHours，单日饱和度接口使用 approvalingWork。
    // 统一为 approvalingWork 后再参与各日期的 flag 计算，避免切换日期时待审批工时被当成 0。
    const registeredWorkingHours = normalizeAttendanceNumber(
      registered.registeredWorkingHours,
      0
    ) || 0;
    const approvalingWork = normalizeAttendanceNumber(
      registered.approvalingWork ?? registered.approvalingWorkHours,
      0
    ) || 0;
    const enabled = normalizeAttendanceNumber(attendance?.attendanceEnabled, 0);
    const attendanceHours = normalizeAttendanceNumber(attendance?.attendanceHours);
    const policy = normalizeAttendanceNumber(attendance?.missPunchPolicy, 1);
    const customLimit = normalizeAttendanceNumber(attendance?.missPunchCustomLimit);
    const dayUp = normalizeAttendanceNumber(capacitySet?.dayUp, 24) || 24;
    const upperLimit = resolveAttendanceUpperLimit({
      enabled,
      hours: attendanceHours,
      policy,
      customLimit,
      dayUp,
    });
    return {
      ...attendance,
      ...registered,
      registeredWorkingHours,
      approvalingWork,
      attendanceEnabled: enabled,
      attendanceHours,
      missPunchPolicy: policy,
      missPunchCustomLimit: customLimit,
      dayUp,
      remainingWork: upperLimit
        - registeredWorkingHours
        - approvalingWork,
    };
  };

  const applyAttendanceSnapshot = (date) => {
    const snapshot = getAttendanceSnapshot(date);
    const next = {
      ...attendanceConfigRef.current,
      enabled: normalizeAttendanceNumber(snapshot?.attendanceEnabled, 0),
      hours: normalizeAttendanceNumber(snapshot?.attendanceHours),
      policy: normalizeAttendanceNumber(snapshot?.missPunchPolicy, 1),
      customLimit: normalizeAttendanceNumber(snapshot?.missPunchCustomLimit),
    };
    next.syncHours = resolveAttendanceUpperLimit(next) || null;
    if (next.enabled === 0) next.syncHours = null;
    attendanceConfigRef.current = next;
    setAttendanceEnabled(next.enabled);
    setAttendanceHours(next.hours);
    setMissPunchPolicy(next.policy);
    setMissPunchCustomLimit(next.customLimit);
    setUpperLimitSource(snapshot?.upperLimitSource ?? 1);
    attendanceSyncHoursRef.current = next.syncHours;
    return next;
  };

  const getAttendanceConfigForDate = (date) => {
    const snapshot = getAttendanceSnapshot(date);
    if (!snapshot) {
      // 考勤开启但该日期快照还没返回时，上限未知。这里只把"未知"标记出来，
      // 其余字段与原来保持一致（仍回退到全局考勤配置）。
      const fallback = attendanceConfigRef.current;
      const fallbackEnabled = normalizeAttendanceNumber(fallback?.enabled, 0);
      const unknown = isAttendanceLimitUnknown(snapshot, fallbackEnabled);
      return {
        ...fallback,
        ready: !unknown,
      };
    }
    const hours = normalizeAttendanceNumber(snapshot.attendanceHours);
    const policy = normalizeAttendanceNumber(snapshot.missPunchPolicy, 1);
    const customLimit = normalizeAttendanceNumber(snapshot.missPunchCustomLimit);
    return {
      enabled: normalizeAttendanceNumber(snapshot.attendanceEnabled, 0),
      hours,
      policy,
      customLimit,
      ready: true,
      syncHours: resolveAttendanceUpperLimit({
        enabled: snapshot.attendanceEnabled,
        hours,
        policy,
        customLimit,
        dayUp: capacitySet?.dayUp,
      }) || null,
    };
  };

  // 配置关闭或配置查询失败时，不请求成员考勤数据，但保留可供表格和校验使用的关闭状态。
  const applyAttendanceConfigWithoutData = (context, statusConfig = {}) => {
    const projectKey = context.isSpaceMode ? (context.projectKey || "") : "tenant";
    const config = {
      ...statusConfig,
      projectKey,
      isEnable: normalizeAttendanceNumber(
        statusConfig?.isEnable ?? statusConfig?.enable,
        0
      ),
    };
    attendanceIndexRef.current = {
      dataMap: new Map(),
      configMap: new Map([[projectKey, config]]),
    };
    attendanceContextRef.current = context;
    attendanceStatusConfigRef.current = statusConfig;
    const fallbackSnapshots = {};
    getDatesInRange(context.beginWorkDate, context.endWorkDate).forEach(({ date }) => {
      const snapshot = getAttendanceSnapshot(date, context);
      if (snapshot) fallbackSnapshots[date] = snapshot;
    });
    setAttendanceSnapshotMap(fallbackSnapshots);
    applyAttendanceSnapshot(fallbackSnapshots[workDate] ? workDate : context.beginWorkDate);
    return true;
  };

  const loadAttendanceData = async (context, requestId, statusConfig, throwOnFailure = false) => {
    if (normalizeAttendanceNumber(statusConfig?.isEnable ?? statusConfig?.enable, 0) !== 1) {
      applyAttendanceConfigWithoutData(context, statusConfig);
      return true;
    }
    // 考勤数据的查询区间跟随本次考勤上下文：有缓存时即缓存接口返回的登记起止日期。
    // 不能直接读 state 的 beginWorkDate/endWorkDate——initData 里刚 setBeginWorkDate，React 尚未提交，
    // 此处会拿到旧的本周日期，导致考勤数据查询区间与缓存登记区间不一致。
    const attendanceBeginDate = context?.beginWorkDate || beginWorkDate;
    const attendanceEndDate = context?.endWorkDate || endWorkDate;
    const rangeDates = getDatesInRange(attendanceBeginDate, attendanceEndDate);
    const startDate = rangeDates[0]?.date;
    const endDate = rangeDates[rangeDates.length - 1]?.date;
    const pro_key=sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || ''
    const appMode = getAppModeInfo();
    const params = {
      items: [{
        projectKey: appMode=='space' ? pro_key : null,
        userKey: context.userKey,
      }],
      startDate: startDate,
      endDate:endDate,
    }; 
    const applyMissingAttendanceFallback = () => {
      if (normalizeAttendanceNumber(statusConfig?.isEnable ?? statusConfig?.enable, 0) !== 1) {
        return false;
      }
      const projectKey = context.isSpaceMode ? (context.projectKey || "") : "tenant";
      attendanceIndexRef.current = {
        dataMap: new Map(),
        configMap: new Map([[projectKey, {
          ...statusConfig,
          projectKey,
          isEnable: 1,
        }]]),
      };
      attendanceContextRef.current = context;
      const fallbackSnapshots = {};
      getDatesInRange(context.beginWorkDate, context.endWorkDate).forEach(({ date }) => {
        const snapshot = getAttendanceSnapshot(date, context);
        if (snapshot) fallbackSnapshots[date] = snapshot;
      });
      setAttendanceSnapshotMap(fallbackSnapshots);
      applyAttendanceSnapshot(fallbackSnapshots[workDate] ? workDate : context.beginWorkDate);
      return true;
    };
    let res;
    try {
      res = await getUserAttendanceConfig(params);
    } catch (error) {
      // 配置已成功但成员考勤查询失败时，按配置中的缺卡策略生成日期快照。
      if (!isMountedRef.current || requestId !== attendanceRequestIdRef.current) {
        if (throwOnFailure) throw new Error("考勤请求已过期");
        return false;
      }
      if (!applyMissingAttendanceFallback()) {
        if (throwOnFailure) throw error;
        return false;
      }
      return true;
    }
    if (!isMountedRef.current || requestId !== attendanceRequestIdRef.current) {
      if (throwOnFailure) throw new Error("考勤请求已过期");
      return false;
    }
    if (!res?.result || !res?.data) {
      // 接口返回失败结构与网络异常采用相同缺卡兜底。
      if (!applyMissingAttendanceFallback()) {
        if (throwOnFailure) throw new Error("获取成员考勤数据失败");
        return false;
      }
      return true;
    }
    const rawData = res?.result && res?.data;
    const list = Array.isArray(rawData?.projects)
      ? rawData.projects
      : Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];
    const index = buildAttendanceIndex(list);
    if (statusConfig) {
      const projectKey = context.isSpaceMode ? (context.projectKey || "") : "tenant";
      index.configMap.set(projectKey, {
        ...statusConfig,
        isEnable: statusConfig.isEnable ?? statusConfig.enable ?? 0,
        projectKey,
      });
    }
    attendanceIndexRef.current = index;
    attendanceContextRef.current = context;
    const nextSnapshots = {};
    getDatesInRange(context.beginWorkDate, context.endWorkDate).forEach(({ date }) => {
      const snapshot = getAttendanceSnapshot(date, context);
      if (snapshot) nextSnapshots[date] = snapshot;
    });
    setAttendanceSnapshotMap(nextSnapshots);
    applyAttendanceSnapshot(nextSnapshots[workDate] ? workDate : context.beginWorkDate);
    return true;
  };

  const getAttendanceConfigInfo = async (context = getAttendanceContext(), throwOnFailure = false) => {
    if (!context.userKey || !context.beginWorkDate || !context.endWorkDate
      || (context.isSpaceMode && !context.projectKey)) {
      if (throwOnFailure) throw new Error("考勤查询条件不完整");
      return false;
    }
    const requestId = ++attendanceRequestIdRef.current;
    attendanceLastQueryKeyRef.current = `${context.userKey}|${context.beginWorkDate}|${context.endWorkDate}|${context.isSpaceMode ? context.projectKey : "tenant"}`;
    attendanceIndexRef.current = { dataMap: new Map(), configMap: new Map() };
    attendanceContextRef.current = null;
    attendanceStatusConfigRef.current = null;
    attendanceConfigRef.current = {
      enabled: 0,
      hours: null,
      policy: 1,
      customLimit: null,
      syncHours: null,
    };
    setAttendanceSnapshotMap({});
    setAttendanceEnabled(0);
    setAttendanceHours(null);
    setUpperLimitSource(1);
    setMissPunchPolicy(1);
    setMissPunchCustomLimit(null);
    try {
      let res;
      try {
        const pro_key=sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || ''
        const appMode = getAppModeInfo();
        res = await getAttendanceConfig([{
          projectKey: appMode === "space" ? pro_key : null,
          userKey: context.userKey,
        }]);
      } catch (error) {
        if (!isMountedRef.current || requestId !== attendanceRequestIdRef.current) {
          if (throwOnFailure) throw new Error("考勤请求已过期");
          return false;
        }
        applyAttendanceConfigWithoutData(context);
        if (throwOnFailure) throw error;
        return false;
      }
      if (!isMountedRef.current || requestId !== attendanceRequestIdRef.current) {
        if (throwOnFailure) throw new Error("考勤请求已过期");
        return false;
      }
      if (!res?.result || !res?.data) {
        applyAttendanceConfigWithoutData(context);
        if (throwOnFailure) throw new Error("获取考勤配置失败");
        return false;
      }
      const configPayload = res?.data;
      const configList = Array.isArray(configPayload)
        ? configPayload
        : Array.isArray(configPayload?.projects)
          ? configPayload.projects
          : configPayload ? [configPayload] : [];
      const requestedProjectKey = context.isSpaceMode ? context.projectKey : null;
      const validConfigList = configList.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item)
      );
      const config = validConfigList.find((item) => item?.projectKey === requestedProjectKey)
        || validConfigList[0];
      if (!config || typeof config !== "object") {
        applyAttendanceConfigWithoutData(context);
        if (throwOnFailure) throw new Error("获取考勤配置失败");
        return false;
      }
      attendanceStatusConfigRef.current = config || attendanceStatusConfigRef.current;
      const enabled = normalizeAttendanceNumber(config?.isEnable ?? config?.enable, 0);
      const policy = normalizeAttendanceNumber(config?.missPunchPolicy, 1);
      const customLimit = normalizeAttendanceNumber(config?.missPunchCustomLimit);
      attendanceConfigRef.current = {
        ...attendanceConfigRef.current,
        enabled,
        policy,
        customLimit,
      };
      setAttendanceEnabled(enabled);
      setUpperLimitSource(normalizeAttendanceNumber(config?.upperLimitSource, 1));
      setMissPunchPolicy(policy);
      setMissPunchCustomLimit(customLimit);

      if (enabled === 0) {
        applyAttendanceConfigWithoutData(context, config);
        handleRegTableColumns("changeColumns");
        // 关闭考勤时仍刷新当前日期的饱和度，但不请求 attendance/data/query。
        if (!throwOnFailure && workDate && registrantUserKey) {
          const refreshed = await getAlertDetail(false);
          if (!refreshed) return false;
        }
        return true;
      }

      const loaded = await loadAttendanceData(context, requestId, config, throwOnFailure);
      if (!loaded) return false;
      handleRegTableColumns("changeColumns");
      // 考勤快照写入后重新计算当前日期的 Alert，避免饱和度请求先返回时展示旧场景。
      if (!throwOnFailure && workDate && registrantUserKey) {
        const refreshed = await getAlertDetail(throwOnFailure);
        if (!refreshed && throwOnFailure) throw new Error("刷新工时饱和度失败");
      }
      return true;
    } catch (error) {
      if (requestId === attendanceRequestIdRef.current) {
        console.error("获取考勤数据失败:", error);
      }
      if (throwOnFailure) throw error;
      return false;
    }
  };

  const handleSyncAttendance = async () => {
    if (attendanceSyncing) return;
    setAttendanceSyncing(true);
    try {
      const context = getAttendanceContext();
      const refreshed = await getAttendanceConfigInfo(context, true);
      if (!refreshed) throw new Error("刷新考勤数据失败");
      const alertRefreshed = await getAlertDetail(true);
      if (!alertRefreshed) throw new Error("刷新考勤信息失败");
      setTimeout(() => {
        const value = regBatchForm.getFieldValue("realActWorkHour");
        if (value !== undefined && value !== null && value !== "") {
          regBatchForm.validateFields(["realActWorkHour"]).catch(() => {});
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

  const refreshAttendanceRange = async (context) => {
    const requestKey = `${context.userKey}|${context.beginWorkDate}|${context.endWorkDate}|${context.isSpaceMode ? context.projectKey : "tenant"}`;
    if (attendanceLastQueryKeyRef.current === requestKey) return;
    await getAttendanceConfigInfo(context);
  };

  // 考勤查询条件的唯一键，格式与 getAttendanceConfigInfo 写入 attendanceLastQueryKeyRef 的一致。
  const buildAttendanceKey = (context) =>
    `${context.userKey}|${context.beginWorkDate}|${context.endWorkDate}|${context.isSpaceMode ? context.projectKey : "tenant"}`;

  // 同一查询条件只发一次考勤请求；失败一律 resolve(false)，绝不 reject，保证调用方一定能继续往下走。
  const ensureAttendanceReady = (context) => {
    if (!context?.userKey || !context.beginWorkDate || !context.endWorkDate) return Promise.resolve(false);
    attendanceInitializedRef.current = true;
    const key = buildAttendanceKey(context);
    if (attendanceBootstrapRef.current?.key === key) return attendanceBootstrapRef.current.promise;
    const promise = getAttendanceConfigInfo(context)
      .catch((error) => {
        console.error("考勤数据加载失败:", error);
        return false;
      });
    attendanceBootstrapRef.current = { key, promise };
    return promise;
  };

  // 真正把缓存表格写入数据源（延后到考勤数据就绪之后执行）。
  // 内部全程吞异常：渲染动作一旦抛错，绝不能反过来中断 initData 的后续流程。
  const flushPendingCacheRender = (task) => {
    if (!task) return;
    try {
      // 函数式更新，避免依赖 ref 的同步时机被其它 effect 覆盖
      setWorkInstanceDataSource((prev) => ({
        ...(prev || {}),
        entities: task.dataAll,
      }));
      // 缓存表格确实渲染出来了，之后才允许「被写空」兜底生效
      cacheRenderedRef.current = true;
      cacheSelfHealCountRef.current = 0;
    } catch (error) {
      console.error("缓存表格数据源写入失败:", error);
    }
    try {
      handleExpandLevelChange(task.level, task.dataAll, 1, 1, task.begin, task.end);
    } catch (error) {
      console.error("缓存表格展开层级处理失败:", error);
    }
  };

  // 开启考勤且有缓存时：等考勤配置 + 考勤数据都回来再渲染缓存表格，
  // 避免缓存先渲染、考勤后到产生的中间态把单元格误判成超出上限（红色闪现）。
  // 无论考勤成功、失败、超时还是抛错，最后都一定会把缓存表格渲染出来。
  const runPendingCacheRender = async (context) => {
    const task = pendingCacheRenderRef.current;
    if (!task) return;
    pendingCacheRenderRef.current = null;
    let timer = null;
    try {
      await Promise.race([
        ensureAttendanceReady(context),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve("timeout"), ATTENDANCE_WAIT_TIMEOUT);
        }),
      ]);
    } catch (error) {
      console.error("等待考勤数据失败:", error);
    } finally {
      if (timer) clearTimeout(timer);
    }
    // 不在 finally 里做渲染：放在 finally 外的唯一出口，确保只执行一次且不会因异常被跳过
    flushPendingCacheRender(task);
  };

  // 有缓存渲染的兜底：缓存表格渲染之后，若数据源被任何晚到的异步写入清空，
  // 用暂存缓存重新回填，保证「有缓存但表格空白」不再出现。
  // 仅在确实渲染过（cacheRenderedRef）且仍处于缓存模式时生效，最多回填 2 次。
  useEffect(() => {
    if (!hasCacheRef.current || !cacheRenderedRef.current) return;
    if (workInstanceDataSource?.entities?.length) return;
    if (!cacheWorkInstanceDataSourceRef.current?.length) return;
    if (cacheSelfHealCountRef.current >= 2) {
      console.warn("[批量登记] 缓存表格数据源被写空，兜底回填已达上限，请排查最后写入方", {
        entities: workInstanceDataSource?.entities,
      });
      return;
    }
    cacheSelfHealCountRef.current += 1;
    console.warn("[批量登记] 缓存表格数据源被写空，已用暂存缓存回填", {
      attempt: cacheSelfHealCountRef.current,
      cacheRows: cacheWorkInstanceDataSourceRef.current.length,
    });
    const cacheTableSource = JSON.parse(JSON.stringify(cacheWorkInstanceDataSourceRef.current));
    cacheTableSource.forEach((item) => {
      traverseTreeClearDate(item);
      traverseTreeRecursively(item);
    });
    setWorkInstanceDataSource((prev) => ({
      ...(prev || {}),
      entities: cacheTableSource,
    }));
  }, [workInstanceDataSource]);

  // 考勤请求的统一入口：由 useEffect 与 initData 共用，靠 key 去重避免重复请求。
  const syncAttendanceForCurrentContext = () => {
    const context = getAttendanceContext();
    if (!context.userKey || !context.beginWorkDate || !context.endWorkDate) return;
    if (context.isSpaceMode && !context.projectKey) return;
    if (attendanceBootstrapRef.current?.key === buildAttendanceKey(context)) return;
    if (!attendanceInitializedRef.current) {
      attendanceInitializedRef.current = true;
      ensureAttendanceReady(context);
      return;
    }
    refreshAttendanceRange(context);
  };

  const getConfig = async () => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    };
    const res = await getProjectConfig(data);
    if (res?.result) {
      setIsAllowRegister(res.data?.value ? true : false);
    }
  };

  /** 查询组织标准工时 */
  const getWorkHour = async () => {
    const res = await getStandWorkHour();
    if (res?.result) {
      setCapacitySet(res.data);
    }
  };

  /** 获取个人工作饱和度提示 */
  const getAlertDetail = async (throwOnFailure = false) => {
    const requestId = ++saturationRequestIdRef.current;
    const requestWorkDate = workDate;
    const requestUserKey = registrantUserKey;
    const data = {
      workDate: requestWorkDate,
      registrantUseKey: requestUserKey,
    };
    // 先获取用户考勤数据（H5 迁移：查询饱和度前先拉考勤，确保场景计算准确）
    const _attConfig = applyAttendanceSnapshot(workDate);
    // 从ref中读取最新考勤配置（避免state异步更新导致的时序问题）
    const _attendanceHours = _attConfig.hours; // 实际考勤工时（缺卡时为 null）
    const _attSyncHours = _attConfig.syncHours; // 用于计算剩余工时的基数（有记录=考勤工时，缺卡允许=自定义上限，缺卡不允许=null）
    const res = await getWorkSaturationTips(data);
    if (!res?.result || !res?.data) {
      if (throwOnFailure) throw new Error("刷新工时饱和度失败");
      return false;
    }
    if (res?.result
      && isMountedRef.current
      && requestId === saturationRequestIdRef.current
      && requestWorkDate === workDate
      && requestUserKey === registrantUserKey) {
      const rawData = JSON.parse(JSON.stringify(res.data));
      setAlertDetailOld(rawData);
      // 记录接口原始快照（供 validator 使用）
      capacitySnapshotRef.current = {
        workDate,
        userKey: registrantUserKey,
        remainingWork: Number(res.data.remainingWork),
        registeredWorkingHours: Number(res.data.registeredWorkingHours) || 0,
        approvalingWork: Number(res.data.approvalingWork) || 0,
        dayUp: Number(capacitySet?.dayUp) || 24,
        attendanceEnabled: _attConfig.enabled,
        attendanceHours: _attendanceHours,
        missPunchPolicy: _attConfig.policy,
        missPunchCustomLimit: _attConfig.customLimit,
      };
      // 计算剩余可登记工时（根据考勤场景）
      // 场景1(考勤关闭): dayUp; 场景2(有考勤记录): 考勤工时; 场景3(缺卡-允许提交): 缺卡自定义上限; 场景4(缺卡-不允许提交): 0
      const _origRegistered = Number(res.data.registeredWorkingHours) || 0;
      const _origApprovaling = Number(res.data.approvalingWork) || 0;
      const _dayUp = Number(capacitySet?.dayUp) || 24;
      let _remainingBase;
      if (_attConfig.enabled === 0) {
        _remainingBase = _dayUp; // 场景1：考勤关闭
      } else if (_attSyncHours !== null && _attSyncHours !== undefined) {
        _remainingBase = _attSyncHours; // 场景2/3：考勤工时 或 缺卡自定义上限
      } else {
        _remainingBase = 0; // 场景4：缺卡不允许提交
      }
      const alertDetail = JSON.parse(JSON.stringify(res.data));
      alertDetail.remainingWork = Number(
        (_remainingBase - _origRegistered - _origApprovaling).toFixed(2)
      );
      // 工作饱和度
      alertDetail.saturation = Number(
        (((_origRegistered + _origApprovaling) / (_dayUp || 1)) * 100).toFixed(2)
      );
      setAlertDetail(alertDetail);
      return true;
    }
    if (throwOnFailure) throw new Error("工时饱和度请求已过期");
    return false;
  };
  //监听填报工时的日期查询该日期的个人工作饱和度
  useEffect(() => {
    if (workDate && registrantUserKey) {
      getAlertDetail();
    } else {
      setAlertDetail({});
      setAlertDetailOld({});
    }
  }, [workDate, registrantUserKey]);

  // H5 迁移：考勤/饱和度快照异步就绪后，若日期弹窗仍打开且已填工时，
  // 重新触发上限校验，避免首次校验发生在快照就绪前被短路而无任何提示。
  useEffect(() => {
    const activeDate = activeRegFormDateRef.current;
    const activeUserKey = registrantUserKey;
    if (!activeDate || activeDate !== workDate || !activeUserKey) return undefined;
    const value = regBatchForm.getFieldValue("realActWorkHour");
    if (value === null || value === undefined || value === "") return undefined;
    const timer = setTimeout(() => {
      if (
        activeRegFormDateRef.current !== activeDate
        || workDate !== activeDate
        || registrantUserKey !== activeUserKey
      ) return;
      regBatchForm.validateFields(["realActWorkHour"]).catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [
    alertDetailOld,
    attendanceSnapshotMap,
    attendanceEnabled,
    attendanceHours,
    missPunchPolicy,
    missPunchCustomLimit,
    workHoursTotalDetail,
    workDate,
    registrantUserKey,
  ]);

  useEffect(() => {
    // 启动编排期间由 initData 按「缓存 → 考勤配置 → 考勤数据」的顺序驱动，这里不抢先发请求
    if (!attendanceGateOpenRef.current) return;
    syncAttendanceForCurrentContext();
  }, [registrantUserKey, beginWorkDate, endWorkDate, mode]);

  useEffect(() => {
    if (workDate) applyAttendanceSnapshot(workDate);
  }, [workDate, attendanceSnapshotMap]);

  useEffect(() => {
    if (attendanceContextRef.current) handleRegTableColumns("changeColumns");
  }, [attendanceSnapshotMap]);
  const getEntityNodeOption = async (data) => {
    data.userKey = registrantUserKey;
    const res = await getEntityNodeOptionNew(data);
    if (res.result) {
      if (res.data?.length > 0) {
        // 递归过滤掉所有canRegister为false的节点
        const filterNodes = (nodes) => {
          return nodes.filter(item => {
            if (item.canRegister === false) {
              return false;
            }
            // 递归处理子节点
            if (item.children && Array.isArray(item.children)) {
              item.children = filterNodes(item.children);
            }
            return true;
          });
        };
        res.data = filterNodes(res.data);
        setNodeTaskOptions(res.data);
      }
    }
  };
  const getDateWorkHourTotal = (date, dataSource, currentRecordId, currentValue) => {
    const entities = dataSource?.entities || [];
    const total = entities.reduce((sum, item) => {
      return sum.plus(normalizeAttendanceNumber(item?.[date]?.actWorkHour, 0) || 0);
    }, new Decimal(0));
    if (currentRecordId === undefined || currentValue === undefined) return total;

    // 顶层工作项的 actWorkHour 已包含子节点汇总；只将当前编辑节点的新旧差值叠加，避免重复累计树节点。
    const findCurrentHour = (nodes) => {
      for (const node of nodes || []) {
        if (node?.id === currentRecordId) {
          return normalizeAttendanceNumber(node?.[date]?.actWorkHour, 0) || 0;
        }
        const childHour = findCurrentHour(node?.children);
        if (childHour !== null) return childHour;
      }
      return null;
    };
    const previousValue = findCurrentHour(entities);
    if (previousValue === null) return total;
    return total.plus(
      (normalizeAttendanceNumber(currentValue, 0) || 0) - previousValue
    );
  };

  const calculateDateFlag = (date, dataSource, dateCapacity) => {
    if (!date || !dataSource?.entities?.length || !dateCapacity || Object.keys(dateCapacity).length === 0) {
      return null;
    }
    const workHour = getDateWorkHourTotal(date, dataSource);
    const _attCfg = getAttendanceConfigForDate(date);
    // 考勤已开启但快照未返回时上限未知，此时不算 flag，避免缓存数据首帧被误标红。
    if (_attCfg?.ready === false) return null;
    const _dayUp = Number(capacitySet?.dayUp) || Number(capacitySetRef.current?.dayUp) || 24;
    let _remainingBase;
    if (_attCfg.enabled === 0) {
      _remainingBase = _dayUp;
    } else if (_attCfg.syncHours !== null && _attCfg.syncHours !== undefined) {
      _remainingBase = _attCfg.syncHours;
    } else {
      _remainingBase = 0;
    }
    const remainingWork = _remainingBase
      - (Number(dateCapacity.registeredWorkingHours) || 0)
      - (Number(dateCapacity.approvalingWork) || 0);
    return remainingWork < workHour.toNumber() ? 1 : 0;
  };

  const updateDateFlag = (nodes, date, flagValue) => nodes?.map((node) => {
    const nextNode = {
      ...node,
      ...(node[date] && node[date].actWorkHour !== null
        ? { [date]: { ...node[date], flag: flagValue } }
        : {}),
    };
    if (node.children?.length) {
      nextNode.children = updateDateFlag(node.children, date, flagValue);
    }
    return nextNode;
  }) || [];
  /** 计算个人工作饱和度 */
  const countAlertDetail = () => {
    if (
      !workInstanceDataSource?.entities?.length ||
      Object.keys(alertDetailOld).length === 0
    )
      return;
    const workHour = getDateWorkHourTotal(workDate, workInstanceDataSource);

    // 剩余工时基数：根据考勤场景计算（H5 迁移）
    // 场景1(考勤关闭): dayUp; 场景2(有考勤记录): 考勤工时; 场景3(缺卡-允许提交): 缺卡自定义上限; 场景4(缺卡-不允许提交): 0
    const _attCfg = getAttendanceConfigForDate(workDate);
    const _dayUp = Number(capacitySet?.dayUp) || Number(capacitySetRef.current?.dayUp) || 24;
    let _remainingBase;
    if (_attCfg.enabled === 0) {
      _remainingBase = _dayUp; // 场景1：考勤关闭
    } else if (_attCfg.syncHours !== null && _attCfg.syncHours !== undefined) {
      _remainingBase = _attCfg.syncHours; // 场景2/3：考勤工时 或 缺卡自定义上限
    } else {
      _remainingBase = 0; // 场景4：缺卡不允许提交
    }
    const mergeHours2 = _remainingBase - (Number(alertDetailOld.registeredWorkingHours) || 0) - (Number(alertDetailOld.approvalingWork) || 0);

    const flagValue = mergeHours2 < workHour.toNumber() ? 1 : 0;
    alertDetail.submitHours = workHour.toNumber();
    alertDetail.registeredWorkingHours = new Decimal(
      alertDetailOld.registeredWorkingHours
    ).toNumber();
    // 「单天填报工时上限」减去该「成员」在当前「工作日期」的「已登记工时」「待审批工时」及「当前拟提交工时」之和
    // 上限基数：考勤关闭用 dayUp；考勤开启用考勤场景基数
    alertDetail.remainingWork = new Decimal(_remainingBase)
      .minus(alertDetailOld.registeredWorkingHours)
      .toNumber();
    alertDetail.remainingWork = new Decimal(alertDetail.remainingWork)
      .minus(alertDetail.approvalingWork)
      .toNumber();
    alertDetail.remainingWork = new Decimal(alertDetail.remainingWork)
      .minus(alertDetail.submitHours)
      .toNumber();
    //工作饱和度：（该「成员」在当前「工作日期」的「已登记工时」+「待审批工时」+「当前拟提交工时」）÷「单位人天标准工时」× 100%
    let mergeHours = new Decimal(alertDetail.registeredWorkingHours)
      .plus(alertDetail.approvalingWork)
      .plus(alertDetail.submitHours)
      .toNumber();
    alertDetail.saturation = (mergeHours / capacitySet?.standWorkHour) * 100
    alertDetail.saturation = Math.round(alertDetail.saturation * 100) / 100;
    //alertDetail.saturation = Math.round(alertDetail.saturation * 100) / 100;
    // alertDetail.saturation =
    //   (alertDetail.registeredWorkingHours / capacitySet?.standWorkHour) * 100;
    // alertDetail.saturation = Math.round(alertDetail.saturation * 100) / 100;
    setAlertDetail({ ...alertDetail });
  };

  // 1. 检查workItemEntityId是否存在于trea中
  const checkAndUpdateTree = (trea, objList) => {
    try {
      // 提取trea中所有workItemEntityId（处理trea可能包含多个根节点的情况）
      const treaEntityIds = trea.map(item => item.workItemEntityId);
      // 遍历obj中的每个节点
      objList.forEach(objItem => {
        const targetEntityId = objItem.workItemEntityId;
        // 检查工作实例是否存在
        if (!treaEntityIds.includes(targetEntityId)) {
          // //渲染工作项实例标签
          // const shili=workItemEntityIds.current || []
          // if(shili.length>0){
          //   shili.forEach(item=>{
          //     const parsedItem = JSON.parse(item);
          //     if(targetEntityId && parsedItem.value === targetEntityId){
          //         parsedItem.label = objItem.workItemEntityName.includes('[已删除]') 
          //   ? objItem.workItemEntityName 
          //   : `${objItem.workItemEntityName}[已删除]`,
          //         shili[shili.indexOf(item)] = JSON.stringify(parsedItem);
          //     }else{
          //       if(!targetEntityId ){
          //         parsedItem.label = objItem.workItemEntityName.includes('[已删除]') 
          //         ? objItem.workItemEntityName 
          //         : `${objItem.workItemEntityName}[已删除]`,
          //         shili[shili.indexOf(item)] = JSON.stringify(parsedItem);
          //       }
          //     }
          //   })
          // }else{
          //   shili.push(
          //     JSON.stringify({
          //       workItemId: objItem.workItemId,
          //       label: objItem.workItemEntityName.includes('[已删除]') 
          //       ? objItem.workItemEntityName 
          //       : `${objItem.workItemEntityName}[已删除]`,
          //       value: objItem.workItemEntityId,
          //     })
          //   )
          // }
          // //console.log("shili99999=====",shili);
          // setWorkItemEntityIds(shili)
          let newWorklishi = {
            "workItemId": objItem.workItemId,
            "workItemName": objItem.workItemName,
            "workItemEntityId": objItem.workItemEntityId,
            "workItemEntityName": objItem.workItemEntityName.includes('[已删除]')
              ? objItem.workItemEntityName
              : `${objItem.workItemEntityName}[已删除]`,
            "pattern": null,
            "scheduleStart": null,
            "scheduleEnd": null,
            "estimatedWorkingHoursAll": 0.00,
            "estimatedWorkingHoursSelf": 0.00,
            "children": !objItem.nodeId && !objItem.taskId ? null : []
          }
          trea.push(newWorklishi)
        }
        if (objItem.tag && objItem.tag === 1) {
          return;
        }

        //console.log("objItem",objItem);
        // 2. 工作实例存在，查找对应的trea节点
        const treaNode = trea.find(item => item.workItemEntityId === targetEntityId);
        if (!treaNode || !treaNode.children) return; // 容错处理

        // 提取当前trea节点下所有children的nodeId
        const existingNodeIds = treaNode.children.map(child => child.nodeId);
        const targetNodeId = objItem.nodeId;
        const targetTaskId = objItem.taskId;
        if (!existingNodeIds.includes(targetNodeId) && targetNodeId) {
          // 添加节点到children
          treaNode.children.push({
            "nodeId": targetNodeId,
            "nodeName": objItem.nodeName || targetNodeId, // 优先使用obj中的名称
            "scheduleStart": null,
            "scheduleEnd": null,
            "estimatedWorkingHoursAll": null,
            "estimatedWorkingHoursSelf": null,
            "children": null
          });
          if (targetTaskId) {
            const treaNodeList = treaNode.children.find(item => item.nodeId === targetNodeId);
            if (!treaNodeList.children) { treaNodeList.children = [] }
            const existingTaskId = treaNodeList.children.map(child => child.taskId);
            if (!existingTaskId.includes(targetTaskId) && targetTaskId) {
              // 添加节点到children
              treaNodeList.children.push({
                "taskId": targetTaskId,
                "taskName": objItem.taskName || targetTaskId, // 优先使用obj中的名称
                "scheduleStart": null,
                "scheduleEnd": null,
                "estimatedWorkingHoursAll": null,
                "estimatedWorkingHoursSelf": null
              });
            }
          }
        } else {
          if (targetTaskId) {
            const treaNodeList = treaNode.children.find(item => item.nodeId === targetNodeId);
            if (!treaNodeList.children) { treaNodeList.children = [] }
            const existingTaskId = treaNodeList.children.map(child => child.taskId);
            if (!existingTaskId.includes(targetTaskId) && targetTaskId) {
              // 添加节点到children
              treaNodeList.children.push({
                "taskId": targetTaskId,
                "taskName": objItem.taskName || targetTaskId, // 优先使用obj中的名称
                "scheduleStart": null,
                "scheduleEnd": null,
                "estimatedWorkingHoursAll": null,
                "estimatedWorkingHoursSelf": null
              });
            }
          }
        }
      })
      //console.log("处理树结构", trea);
      return trea; // 返回更新后的树
    } catch (error) {
      console.error("处理树结构时出错:", error);
      return trea; // 返回原始树，避免错误影响
    }
  }
  // useEffect(() => {
  // console.log("workItemEntityId888888====",workItemEntityIds);
  // }, [workItemEntityIds]);
  /** 分页获取工作实例 */
  const lastRequestIdRef = useRef(null);
  const batchQueryInFlightKeyRef = useRef(null);
  const batchRequestSequenceRef = useRef(0);
  const batchTableRenderPendingRef = useRef(null);
  const batchTableDataAppliedRef = useRef(null);
  const isMountedRef = useRef(true);
  const getSelectWorkInstanceTable = async (workItemEntityId) => {
    const capacitySetInfo = capacitySetRef.current;
    if (typeof capacitySetInfo?.onceDown !== "number") return;
    const requestKey = JSON.stringify({
      pageNum: workInstancePagination.pageNum,
      pageSize: workInstancePagination.pageSize,
      scheduleStart,
      scheduleEnd,
      workItemIds: props.type === "tab" ? [props?.workItemId] : workItemIds,
      workItemEntityId: props.type === "tab" ? props?.workItemEntityId : workItemEntityId,
      registrantUserKey,
      workItemIdsFilter,
      excludeWorkItemEntityIdList: props.type === "tab" ? [] : excludeWorkItemEntityIdListCacheRef.current,
      isPersonInCharge,
      openType: props?.openType,
    });
    // 初始化和成员切换可能在同一轮状态更新中触发多个 effect，只保留同参数的在途请求。
    if (batchQueryInFlightKeyRef.current === requestKey) return;
    batchQueryInFlightKeyRef.current = requestKey;
    const requestId = ++batchRequestSequenceRef.current;
    let hasAppliedTableData = false;
    lastRequestIdRef.current = requestId;
    setWorkDate("");
    if (props?.type === "tab") {
      getUserActive("TabOpenBatchRegistrationWorkingHours");
    } else if (!workItemIds?.length) {
      setTableLoading(false);
      setTableDataSource([]);
      if (tableAddDataSource?.length) {
        const workDataSource = {
          ...workInstanceDataSource,
          entities: [...tableAddDataSource],
        };
        workDataSource?.entities?.forEach((item) => {
          //traverseTreeRefresh(item);
          traverseTreeRecursively(item);
        });
        setWorkInstanceDataSource(() => ({
          ...workDataSource,
        }));
      } else {
        setWorkInstanceDataSource({});
      }
      setHasMore(false);
      tableRenderPendingRef.current = false;
      setTableLoading2(false);
      batchTableRenderPendingRef.current = null;
      batchTableDataAppliedRef.current = null;
      setTableLoading(false);
      batchQueryInFlightKeyRef.current = null;
      return;
    }
    beforeAddWorkItemIdsRef.current = workItemIds;
    beforeWorkItemIdsFilterRef.current = workItemIdsFilter;
    const data = {
      level: -1,
      pageNum: workInstancePagination.pageNum,
      pageSize: workInstancePagination.pageSize,
      scheduleStart,
      scheduleEnd,
      workItemIds: props.type === "tab" ? [props?.workItemId] : workItemIds,
      workItemEntityId:
        props.type === "tab" ? props?.workItemEntityId : workItemEntityId,
      registerUserKey: registrantUserKey,
      workItemIdsFilter,
      excludeWorkItemEntityIdList: props.type === "tab" ? [] : excludeWorkItemEntityIdListCacheRef.current,
    };
    if (isPersonInCharge === 0) {
      data.personInCharge = registrantUserKey;
    }
    if (props?.openType === 'again_launch') {
      data.isLaunchAgain = true
    }
    const isFirstPage = workInstancePagination.pageNum === 1;
    if (isFirstPage) {
      batchTableRenderPendingRef.current = requestId;
      batchTableDataAppliedRef.current = null;
      setTableLoading(true);
      //setTableLoading(true);
      const tableBody = tableRef.current?.querySelector(".ant-table-body");
      tableBody?.scrollTop &&
        setTimeout(() => {
          tableBody.scrollTop = 0;
        }, 0);
    } else {
      setLoading(true);
    }

    try {
      const res = await postQueryBatch(data);
      // 检查是否为最新请求
      if (lastRequestIdRef.current !== requestId) return;
      if (res?.result) {
        setHasMore(workItemIdsFilter?.length ? false : res.data.hasNext);
        if (props?.openType === "again_launch" && res.data.entities.length > 0 && callCountRef.current === 1) {
          callCountRef.current = 2
          const workItemEntityIdsList = [];
          const customFieldValues = {};
          props?.batchRegVal?.approvalRecordInfoVoList.forEach(item => {
            if (item.tag == 1) {
              const existsInResponse = res.data.entities.find(entity =>
                entity.workItemEntityId === item.workItemEntityId
              );
              const existsInList = workItemEntityIdsList.some(entry =>
                JSON.parse(entry).value === item.workItemEntityId
              );

              if (existsInResponse && !existsInList) {
                // 标记已删除的工作项实例
                workItemEntityIdsList.push(JSON.stringify({
                  workItemId: item.workItemId,
                  label: `${existsInResponse.workItemEntityName}`,
                  value: item.workItemEntityId
                }));
                customFieldValues[
                  getWorkItemEntityOptionKey(item.workItemId, item.workItemEntityId)
                ] = existsInResponse.customFieldValue;
              } else {
                if (!existsInResponse && !existsInList) {
                  workItemEntityIdsList.push(JSON.stringify({
                    workItemId: item.workItemId,
                    label: item.workItemEntityName,
                    value: item.workItemEntityId
                  }));
                  customFieldValues[
                    getWorkItemEntityOptionKey(item.workItemId, item.workItemEntityId)
                  ] = item.customFieldValue;
                }
              }
            }
          });
          // 更新工作项实例状态
          //workItemEntityIdsRef.current = workItemEntityIdsList;
          try {
            // 转换数据结构
            const transformedData = workItemEntityIdsList.map(item => {
              // 解析JSON字符串为对象
              const parsed = JSON.parse(item);
              // 映射为目标格式（注意补充缺失的逗号）
              return {
                workItemEntityId: parsed.value,       // 对应原始value
                workItemEntityName: parsed.label,     // 对应原始label
                workItemId: parsed.workItemId         // 对应原始workItemId
              };
            });
            beforeWorkItemIdsFilterRef.current = transformedData
            setWorkItemEntityIds(workItemEntityIdsList);
            setWorkItemEntityCustomFieldValues(customFieldValues);
          } catch (error) {
            console.log("error====", error);
          }
        }
        const responseEntities = Array.isArray(res?.data?.entities)
          ? clearPersistedDateFlags(JSON.parse(JSON.stringify(res.data.entities)))
          : [];
        if (res?.data?.entities != null && !Array.isArray(res.data.entities)) {
          console.error("批量登记查询返回的 entities 不是数组:", res.data.entities);
        }
        const trdata = JSON.parse(JSON.stringify(responseEntities))
        let updatedTree = trdata
        updatedTree.forEach((item) => {
          item.id = item.workItemEntityId;
          switch (item?.pattern) {
            case "Node":
              break;
            case "State":
              item.children = null;
              break;
            default:
              break;
          }
        });
        // 构建登记对象标识集合（使用 Map 提升查找性能）
        const dengjiMap = new Map();
        const buildDengjiMap = (nodes) => {
          if (!nodes || nodes.length === 0) return;
          nodes.forEach(item => {
            const workItemKey = `${item.workItemId}-${item.workItemEntityId}`;
            dengjiMap.set(`WORKITEM-${workItemKey}`, true);
            
            if (item.children && item.children.length > 0) {
              item.children.forEach(child => {
                const nodeKey = `${workItemKey}-${child.nodeId}`;
                dengjiMap.set(`NODE-${nodeKey}`, true);
                
                if (child.children && child.children.length > 0) {
                  child.children.forEach(child2 => {
                    const taskKey = `${nodeKey}-${child2.taskId}`;
                    dengjiMap.set(`TASK-${taskKey}`, true);
                  });
                }
              });
            }
          });
        };
        buildDengjiMap(updatedTree);
        // 过滤缓存的工时数据
        if (localHourCache.current?.length && updatedTree?.length) {
          const filteredWorkHours = localHourCache.current.filter(item => {
            const { recordType, workItemId, workItemEntityId, nodeId, taskId } = item;
            let key;
            
            if (recordType === 'WORKITEM') {
              key = `WORKITEM-${workItemId}-${workItemEntityId}`;
            } else if (recordType === 'NODE') {
              key = `NODE-${workItemId}-${workItemEntityId}-${nodeId}`;
            } else if (recordType === 'TASK') {
              key = `TASK-${workItemId}-${workItemEntityId}-${nodeId}-${taskId}`;
            }
            
            return key && dengjiMap.has(key);
          });
          localHourCache.current =filteredWorkHours;
          //console.log('localHourCache.current8888',localHourCache.current,filteredWorkHours);
          // if (filteredWorkHours.length > 0) {
          //   localHourCache.current = aggregateWorkHours(filteredWorkHours);
          // }
        }
        if (workInstancePagination.pageNum === 1) {
          setTableDataSource([
            ...JSON.parse(JSON.stringify(updatedTree)),
          ]);
          const cacheWorkInstanceDataSourceArr = cacheWorkInstanceDataSourceRef.current
          let workDataSource = {}
          if (props?.type === "tab") {
            workDataSource = {
              ...res.data,
              entities: [
                ...(Array.isArray(tableAddDataSource) ? tableAddDataSource : []),
                ...updatedTree,
              ]
            }
          } else {
            if (cacheWorkInstanceDataSourceArr?.length) {
              //console.log('cacheWorkInstanceDataSourceArr',cacheWorkInstanceDataSourceArr,workInstanceDataSourceRef);
              // const tableDataList = workInstanceDataSourceRef.current.entities || []
              // workDataSource = {
              //   ...res.data,
              //   entities: [...tableDataList, ...updatedTree],
              // }
              const dataSource = {
                ...JSON.parse(JSON.stringify(res.data)),
                entities: JSON.parse(JSON.stringify(responseEntities)),
              };
              dataSource.entities.forEach((item) => {
                traverseTreeRecursively(item);
              });
              workDataSource = {
                ...res.data,
                entities: [
                  // 确保 workInstanceDataSource?.entities 是数组
                  ...(Array.isArray(workInstanceDataSource?.entities) ? workInstanceDataSource.entities : []),
                  // 确保 dataSource?.entities 是数组
                  ...(Array.isArray(dataSource?.entities) ? dataSource.entities : []),
                ],
              };
              setTableDataSource([
                ...(Array.isArray(tableDataSource) ? tableDataSource : []),
                ...JSON.parse(JSON.stringify(responseEntities)),
              ]);
            } else {
              workDataSource = {
                ...res.data,
                entities: [
                  ...(Array.isArray(tableAddDataSource) ? tableAddDataSource : []),
                  ...updatedTree,
                ],
              }
            }
          }
          // const workDataSource = {
          //   ...res.data,
          //   entities: [...tableAddDataSource, ...updatedTree],
          // };
          if (cacheWorkInstanceDataSourceArr?.length===0) {
            workDataSource?.entities?.forEach((item) => {
              traverseTreeRecursively(item);
            });
          }
          workDataSource.entities = [
            ...new Set(workDataSource?.entities?.map((item) => item.id)),
          ].map((id) => {
            return workDataSource?.entities?.find((item) => item.id === id);
          });
          if (props?.openType === "again_launch" && editData?.length) {
            editData?.forEach((item) => {
              workDataSource.entities = handleWorkItemEntityNodeAndTask(
                dayjs(item?.workDate).format("YYYY-MM-DD"),
                workDataSource.entities
              );
            });
            setEditData([]);
          }
          if (props.type != 'tab') {
            if (props.openType === "again_launch" && againNum.current === 1) {
              handleExpandLevelChange(expandLevel, workDataSource.entities, 1)
              againNum.current++
            } else {
              if (hasCacheRef.current) {
                handleExpandLevelChange(expandLevel, workDataSource.entities, 1, 1)
              } else {
                handleExpandLevelChange(expandLevel, workDataSource.entities)
              }
            }
          }
          setWorkInstanceDataSource({
            ...workDataSource,
          });
          batchTableDataAppliedRef.current = requestId;
          hasAppliedTableData = true;
        } else {
          setTableDataSource([
            ...(Array.isArray(tableDataSource) ? tableDataSource : []),
            ...JSON.parse(JSON.stringify(responseEntities)),
          ]);
          const dataSource = {
            ...JSON.parse(JSON.stringify(res.data)),
            entities: JSON.parse(JSON.stringify(responseEntities)),
          };
          dataSource?.entities?.forEach((item) => {
            traverseTreeRecursively(item);
          });
          const workDataSource = {
            ...res.data,
            entities: [
              ...(Array.isArray(workInstanceDataSource?.entities) ? workInstanceDataSource.entities : []),
              ...dataSource.entities,
            ],
          };
          workDataSource.entities = [
            ...new Set(workDataSource?.entities?.map((item) => item.id)),
          ].map((id) => {
            return workDataSource?.entities?.find((item) => item.id === id);
          });
          if (responseEntities.length) {
            handleExpandLevelChange(expandLevel, workDataSource.entities, '', 1)
          }
          setWorkInstanceDataSource({
            ...workDataSource,
          });
          batchTableDataAppliedRef.current = requestId;
          hasAppliedTableData = true;
        }
        setWorkInstancePagination({
          ...workInstancePagination,
          pageNum: res.data.pageNum,
        });
      }
    } finally {
      if (
        tableRenderPendingRef.current &&
        lastRequestIdRef.current === requestId &&
        !hasAppliedTableData
      ) {
        tableRenderPendingRef.current = false;
        setTableLoading2(false);
      } else if (!tableRenderPendingRef.current && lastRequestIdRef.current === requestId) {
        setTableLoading2(false);
      }
      if (lastRequestIdRef.current === requestId) {
        setLoading(false);
        if (!isFirstPage || !hasAppliedTableData) {
          batchTableRenderPendingRef.current = null;
          batchTableDataAppliedRef.current = null;
          setTableLoading(false);
        }
      }
      if (batchQueryInFlightKeyRef.current === requestKey) {
        batchQueryInFlightKeyRef.current = null;
      }
    }
  };

  // 添加清理函数防止内存泄漏
  useEffect(() => {
    // 挂载（含 StrictMode 下的二次挂载）时恢复标记：上一次 cleanup 会把它置为 false，
    // 若不恢复，后续所有依赖它的异步回写（考勤数据、缓存表格渲染）都会被误判为"已卸载"而跳过。
    isMountedRef.current = true;
    return () => {
      lastRequestIdRef.current = null;
      batchQueryInFlightKeyRef.current = null;
      batchTableRenderPendingRef.current = null;
      batchTableDataAppliedRef.current = null;
      tableRenderPendingRef.current = false;
      if (againLaunchWatchdogRef.current !== null) {
        clearTimeout(againLaunchWatchdogRef.current);
        againLaunchWatchdogRef.current = null;
      }
      isMountedRef.current = false;
      attendanceRequestIdRef.current += 1;
      saturationRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!workInstanceDataSource?.entities) return;
    if (props?.type === "tab") checkWorkInstanceDataSource();
    if (
      props?.type !== "tab" &&
      !workItemIds?.length &&
      !tableAddDataSource?.length
    ) {
      if (batchTableRenderPendingRef.current === null) {
        setTableLoading(false);
      }
      setTableDataSource([]);
      setHasMore(false);
    } else {
      const tableBody = tableRef.current?.querySelector(".ant-table-body");
      if (tableBody && !hasCache) {
        tableBody.addEventListener("scroll", handleRefreshScroll);
        return () => {
          if (tableBody)
            tableBody.removeEventListener("scroll", handleRefreshScroll);
        };
      }
    }
  }, [JSON.stringify(workInstanceDataSource)]);

  /** 获取实例下的节点和任务（非tab页使用） */
  const getEntityNodeTaskTable = async (data, record) => {
    setTableLoading(true);
    data = {
      ...data,
      scheduleStart,
      scheduleEnd
    };
    if (props?.openType === "again_launch") {
      data.isLaunchAgain = true;
    }
    if (addExtraRef.current && addExtraRef.current.length > 0) {
      data.addExtra = addExtraRef.current
    }
    if (filterRegistrationRef.current && filterRegistrationRef.current.length > 0) {
      data.addExtraEntities = {
        entities: filterRegistrationRef.current
      }
    }
    let registerTaskIds = []
    let registerNodeIds = []
    if (isPersonInCharge === 0) data.personInCharge = registrantUserKey;
    if (record?.cache) {
      data.workItemId = record.workItemId,
        data.workItemEntityId = record.workItemEntityId
      data.isCache = true;
      const addWorkHoursData = editDataRef.current
      if (addWorkHoursData && addWorkHoursData.length > 0) {
        addWorkHoursData.forEach((item) => {
          if (item.workItemEntityId == record.workItemEntityId) {
            if (item.nodeId && !registerNodeIds.includes(item.nodeId)) {
              registerNodeIds.push(item.nodeId);
            }
            if (item.taskId && !registerTaskIds.includes(item.taskId)) {
              registerTaskIds.push(item.taskId);
            }
          }
        });
      }
      data.registerTaskIds = registerTaskIds;
      data.registerNodeIds = registerNodeIds;
    }
    const res = await postEntityNodeTask(data);
    if (res?.result) {
      workInstanceDataSource?.entities?.forEach((entity) => {
        if (
          entity.workItemEntityId === data.workItemEntityId &&
          entity.workItemId === data.workItemId
        ) {
          res?.data?.forEach((node) => {
            node.workItemEntityId = data.workItemEntityId;
            node.workItemId = data.workItemId;
            traverseTreeRecursively(node);
          });
          entity.children = res?.data;
        }
      });
      const dataSource = JSON.parse(JSON.stringify(workInstanceDataSource));
      setWorkInstanceDataSource({ ...dataSource });
    }
    if (batchTableRenderPendingRef.current === null) {
      setTableLoading(false);
    }
  };

  /** 获取节点下的任务（非tab页使用） */
  const getNodeTaskTable = async (data) => {
    const res = await postEntityNodeTaskSchedule(data);
    let dataSource = null;
    if (res?.result) {
      workInstanceDataSource?.entities?.forEach((entity) => {
        if (
          entity.workItemEntityId === data.workItemEntityId &&
          entity.workItemId === data.workItemId
        ) {
          entity.children?.forEach((node) => {
            if (node.nodeId === data.nodeId) {
              if (res?.data?.length) {
                res?.data?.forEach((task) => {
                  task = {
                    ...task,
                    ...data,
                  };
                  traverseTreeRecursively(task);
                  task.children = null;
                  node.children = [...node.children, task];
                });
              } else {
                node.children = null;
              }
            }
          });
        }
      });
      setWorkInstanceDataSource({ ...workInstanceDataSource });
    }
  };

  /** 遍历树节点（添加唯一标识id） */
  const traverseTreeRecursively = (node, beginWorkDateInfo, endWorkDateInfo) => {
    // 生成唯一ID
    node.id = `${node.workItemId}-${node.workItemEntityId}-${node?.nodeId || "null"
      }-${node?.taskId || "null"}`;
    let beginWorkDateData = beginWorkDateInfo ? beginWorkDateInfo : beginWorkDate
    let endWorkDateData = endWorkDateInfo ? endWorkDateInfo : endWorkDate
    // 为日期范围添加工作小时记录
    const rangeDates = getDatesInRange(beginWorkDateData, endWorkDateData);
    rangeDates?.forEach(({ date }) => {
      node[date] = {
        realActWorkHour: null,
        actWorkHour: null,
        workDesc: null,
        isRegFormOpen: false,
      };
    });
    if (props?.openType === "again_launch" || hasCacheRef.current || localHourCache.current.length > 0) {
      let lastEditData = editDataRef.current && editDataRef.current.length > 0 ? editDataRef.current : aggregateWorkHours(localHourCache.current);
      lastEditData?.forEach((approvalItem) => {
        const date = dayjs(approvalItem?.workDate).format("YYYY-MM-DD");
        if (
          `${approvalItem.workItemId}-${approvalItem.workItemEntityId}-${approvalItem?.nodeId || "null"
          }-${approvalItem?.taskId || "null"}` === node.id &&
          date in node
        ) {
          node[date] = {
            realActWorkHour: approvalItem.realActWorkHour,
            actWorkHour: approvalItem.actWorkHour,
            workDesc: approvalItem.workDesc,
            isRegFormOpen: false,
          };
        }
      });
    }
    const capacitySetInfo = capacitySetRef.current;
    node.dayUp = capacitySetInfo?.dayUp;
    node.onceDown = capacitySetInfo?.onceDown;

    // 处理tab类型展开逻辑
    if (props.type === "tab" && hasCacheRef.current === false) {
      setExpandedRowKeys((prev) => [...new Set([...prev, node.id])]);
    }

    // 递归处理子节点
    if (node?.children?.length > 0) {
      node.children.forEach((child) => {
        child.workItemId = child.workItemId || node.workItemId;
        child.workItemEntityId =
          child.workItemEntityId || node.workItemEntityId;
        child.nodeId = child.nodeId || node.nodeId;
        traverseTreeRecursively(child, beginWorkDateInfo, endWorkDateInfo);
      });
    }

    // 清除任务节点的子节点
    if (node.taskId) node.children = null;
  };

  /** 遍历树节点（清除日期） */
  const traverseTreeClearDate = (node) => {
    node = Object.fromEntries(
      Object.entries(node).filter(([key]) =>
        dayjs(key, "YYYY-MM-DD", true).isValid()
      )
    );
    if (node?.children && node?.children?.length > 0) {
      node?.children?.forEach((child) => {
        traverseTreeRecursively(child);
      });
    }
  };

  useEffect(() => {
    if (typeof capacitySet?.onceDown !== "number") return;
    if (!invoke) return;
    switch (props.type) {
      case "tab":
        getSelectWorkInstanceTable(props?.workItemEntityId);
        break;
      default:
        getSelectWorkInstanceTable();
        break;
    }
  }, [
    isPersonInCharge,
    workInstancePagination.pageNum,
    workInstancePagination.pageSize,
    isInitialized,
    invoke
  ]);

  useEffect(() => {
    if (typeof capacitySet?.onceDown !== "number") return;
    capacitySetRef.current = capacitySet;
    // 缓存渲染路径不能清空 flushPendingCacheRender 刚写入的 entities：
    // 1) hasCacheRef 在 queryCache 里才置真，capacitySet 早于 queryCache 回来时它还是假；
    // 2) 只要暂存缓存里已有行，本次就只是「按新 onceDown 重建表头/单元格」，不该重建数据源。
    if (hasCacheRef.current || cacheWorkInstanceDataSourceRef.current?.length > 0) {
      // 有缓存渲染：capacitySet 到位仅用于重建表头/单元格按新 onceDown 重算，
      // 不能清空 flushPendingCacheRender 刚写入的 entities，避免竞态导致表格空白。
      handleRegTableColumns("changeColumns");
    } else {
      handleRegTableColumns();
    }
  }, [capacitySet]);

  useEffect(() => {
    if (!invoke) return;
    const timer = setTimeout(() => {
      if (workInstancePagination.pageNum === 1) {
        getSelectWorkInstanceTable();
      } else {
        setWorkInstancePagination((prev) => ({
          ...prev,
          pageNum: 1,
        }));
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [scheduleStart, scheduleEnd]);

  useEffect(() => {
    if (!invoke) return;
    const timer = setTimeout(() => {
      if (workInstancePagination.pageNum === 1) {
        getSelectWorkInstanceTable();
      } else {
        setWorkInstancePagination((prev) => ({
          ...prev,
          pageNum: 1,
        }));
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [registrantUserKey]);

  /** 处理「再次发起」的工时 */
  const aggregateWorkHours = (data) => {
    try {
      const result = {};
      // 1. 按日期分组
      data.forEach((item) => {
        const date = dayjs(item.workDate).format("YYYY-MM-DD");
        if (!result[date]) {
          result[date] = {};
        }

        // 2. 确保workItemEntityId存在
        const workItemEntityKey = `${item.workItemId}_${item.workItemEntityId || "default"
          }`;
        if (!result[date][workItemEntityKey]) {
          result[date][workItemEntityKey] = {
            workItemId: item.workItemId,
            workItemEntityId: item.workItemEntityId || "default",
            workItemName: item.workItemName,
            workDesc: item.workDesc,
            workItemEntityName: item.workItemEntityName,
            realActWorkHour: item.actWorkHour || 0,
            actWorkHour: 0,
            nodes: {},
          };
        }
        result[date][workItemEntityKey].realActWorkHour =
          !item.nodeId && !item.taskId ? item.actWorkHour || null : null;
        result[date][workItemEntityKey].workDesc =
          !item.nodeId && !item.taskId ? item.workDesc || "" : "";

        // 3. 处理有nodeId的情况
        if (item.nodeId) {
          const nodeKey = item.nodeId;
          if (!result[date][workItemEntityKey].nodes[nodeKey]) {
            result[date][workItemEntityKey].nodes[nodeKey] = {
              nodeId: item.nodeId,
              nodeName: item.nodeName,
              workDesc: item.workDesc,
              realActWorkHour: item.actWorkHour || 0,
              actWorkHour: 0,
              tasks: {},
            };
          }
          result[date][workItemEntityKey].nodes[nodeKey].realActWorkHour =
            item.nodeId && !item.taskId ? item.actWorkHour || null : null;
          result[date][workItemEntityKey].nodes[nodeKey].workDesc = !item.taskId
            ? item.workDesc || ""
            : "";

          // 4. 处理有taskId的情况
          if (item.taskId) {
            const taskKey = item.taskId;
            if (!result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey]) {
              result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey] = {
                taskId: item.taskId,
                taskName: item.taskName,
                workDesc: item.workDesc,
                realActWorkHour: item.actWorkHour || 0,
                actWorkHour: 0,
              };
            }

            result[date][workItemEntityKey].nodes[nodeKey].tasks[
              taskKey
            ].workDesc = item.workDesc || "";

            // 累加task的actWorkHour
            result[date][workItemEntityKey].nodes[nodeKey].tasks[
              taskKey
            ].actWorkHour = new Decimal(result[date][workItemEntityKey].nodes[nodeKey].tasks[taskKey].actWorkHour)
              .plus(item.actWorkHour).toNumber();
          }
          // 累加node的actWorkHour
          result[date][workItemEntityKey].nodes[nodeKey].actWorkHour =
            new Decimal(result[date][workItemEntityKey].nodes[nodeKey].actWorkHour)
              .plus(item.actWorkHour).toNumber();
        }
        // 累加workItemEntity的actWorkHour
        result[date][workItemEntityKey].actWorkHour = new Decimal(result[date][workItemEntityKey].actWorkHour).plus(item.actWorkHour).toNumber();
      });
      return restoreOriginalStructure(result);
    } catch (error) {
      console.error("聚合工时时出错:", error);
    }
  };

  const restoreOriginalStructure = (result) => {
    const restoredData = [];

    // 遍历日期分组
    Object.entries(result).forEach(([date, entities]) => {
      // 遍历workItemEntity分组
      Object.values(entities).forEach((entity) => {
        // 添加workItemEntity级别的记录
        restoredData.push({
          workItemId: entity.workItemId,
          workItemEntityId:
            entity.workItemEntityId === "default"
              ? null
              : entity.workItemEntityId,
          workItemName: entity.workItemName,
          workItemEntityName: entity.workItemEntityName,
          realActWorkHour: entity.realActWorkHour,
          actWorkHour: entity.actWorkHour,
          workDate: date, // 恢复原始日期格式
          workDesc: entity.workDesc,
          nodeId: null,
          taskId: null,
          type: "workitem",
        });

        // 遍历node分组
        Object.values(entity.nodes).forEach((node) => {
          // 添加node级别的记录
          restoredData.push({
            workItemId: entity.workItemId,
            workItemEntityId:
              entity.workItemEntityId === "default"
                ? null
                : entity.workItemEntityId,
            workItemName: entity.workItemName,
            workItemEntityName: entity.workItemEntityName,
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            realActWorkHour: node.realActWorkHour,
            actWorkHour: node.actWorkHour,
            workDate: date,
            workDesc: node.workDesc,
            taskId: null,
            type: "node",
          });

          // 遍历task分组
          Object.values(node.tasks).forEach((task) => {
            // 添加task级别的记录
            restoredData.push({
              workItemId: entity.workItemId,
              workItemEntityId:
                entity.workItemEntityId === "default"
                  ? null
                  : entity.workItemEntityId,
              workItemName: entity.workItemName,
              workItemEntityName: entity.workItemEntityName,
              nodeId: node.nodeId,
              nodeName: node.nodeName,
              taskId: task.taskId,
              taskName: task.taskName,
              realActWorkHour: task.realActWorkHour,
              actWorkHour: task.actWorkHour,
              workDate: date,
              workDesc: task.workDesc,
              type: "task",
            });
          });
        });
      });
    });
    return restoredData;
  };

  /** 根据起止日期推导工作日期快捷类型：0-自定义，1-今天，2-本周，3-上周，4-上个月 */
  const resolveWorkDateType = (begin, end) => {
    if (!begin || !end) return 0;
    const today = dayjs(new Date()).format("YYYY-MM-DD");
    if (begin === today && end === today) return 1;
    const week = getWeekStartAndEnd();
    if (begin === week.Monday && end === week.Sunday) return 2;
    const lastWeek = getLastWeekRange();
    if (begin === lastWeek.Monday && end === lastWeek.Sunday) return 3;
    const lastMonth = getLastMonthRange();
    if (begin === lastMonth.start && end === lastMonth.end) return 4;
    return 0;
  };

  /** 工作日期变更 */
  const onWorkDateChange = (dates, dateStrings) => {
    if (!isWorkDateRangeWithinThreeMonths(dates)) {
      window.JSSDK.toast.warning("填报工作日期范围不能超过三个月");
      return;
    }

    manualSelection.current = true;
    //setInvoke(true);
    const isHasContent = checkWorkInstanceDataSource();
    setHasCache(false);
    // 检查是否已经有 Modal 显示
    if (modalLockRef.current || isModalVisible) {
      return;
    }
    // 额外检查：确保 DOM 中没有已存在的 confirm modal
    if (isHasContent && document.querySelector('.ant-modal-confirm')) {
      return;
    }
    if (isHasContent) {
      // 设置锁
      modalLockRef.current = true;
      setIsModalVisible(true);
      
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          await querySaveWorkHour(-1)
          setInvoke(true);
          //setCacheWorkInstanceDataSource([]);
          goTableTop()
          setExcludeWorkItemEntityIdListCache([])
          excludeWorkItemEntityIdListCacheRef.current = [];
          cacheWorkInstanceDataSourceRef.current = [];
          if(!workItemIds.length){
            if (workInstanceDataSource?.entities?.length) {
              const registerData2 = transformWorkHourData(workInstanceDataSource.entities);
              setTableDataSource([
                ...JSON.parse(JSON.stringify(registerData2)),
              ]);
            }
          }
          setEditData([]);
          setWorkInstanceDataSource({});
          setExpandedRowKeys([]);
          setBeginWorkDate(dateStrings[0] ? dateStrings[0] : null);
          setEndWorkDate(dateStrings[1] ? dateStrings[1] : null);
          setBeginWorkDateCP(dateStrings[0] ? dateStrings[0] : null);
          setEndWorkDateCP(dateStrings[1] ? dateStrings[1] : null);
          setWorkDateType(resolveWorkDateType(dateStrings[0], dateStrings[1]));
          setWorkInstancePagination((prev) => ({
            ...prev,
            pageNum: 1,
          }));
          // 解锁
          modalLockRef.current = false;
          setIsModalVisible(false);
        },
        onCancel() {
          // 解锁
          modalLockRef.current = false;
          setIsModalVisible(false);
        },
        afterClose: () => {
          // 确保在 Modal 关闭后解锁
          modalLockRef.current = false;
          setIsModalVisible(false);
        }
      });
      return;
    } else {
      setInvoke(true);
    }
    localHourCache.current = []
    goTableTop()
    setExpandedRowKeys([]);
    setExcludeWorkItemEntityIdListCache([])
    excludeWorkItemEntityIdListCacheRef.current = [];
    cacheWorkInstanceDataSourceRef.current = [];
    setBeginWorkDate(dateStrings[0] ? dateStrings[0] : null);
    setEndWorkDate(dateStrings[1] ? dateStrings[1] : null);
    setBeginWorkDateCP(dateStrings[0] ? dateStrings[0] : null);
    setEndWorkDateCP(dateStrings[1] ? dateStrings[1] : null);
    setWorkDateType(resolveWorkDateType(dateStrings[0], dateStrings[1]));
    if(!workItemIds.length){
      if (workInstanceDataSource?.entities?.length) {
        const registerData = transformWorkHourData(workInstanceDataSource.entities);
        setTableDataSource([
          ...JSON.parse(JSON.stringify(registerData)),
        ]);
      }
    }
    setWorkInstancePagination((prev) => ({
            ...prev,
            pageNum: 1,
    }));
    // setCacheWorkInstanceDataSource([]);
    // setExcludeWorkItemEntityIdListCache([])
    // excludeWorkItemEntityIdListCacheRef.current = [];
    // setExpandedRowKeys([]);
    // setTableDataSource([]);
    // setWorkInstanceDataSource({});
    // setHasMore(false);
    // setWorkInstancePagination({
    //   ...workInstancePagination,
    //   pageNum: 1,
    // });
  };
  const goTableTop = () => {
    // 切换填报工作日期时，立即将滚动条重置到开始位置
    const tableContainer = document.querySelector('.ant-table-body');
    if (tableContainer) {
      tableContainer.scrollTop = 0;
    }
  }
  /** 时间工作日筛选按钮处理 */
  const onWorkDateBtnChange = (e) => {
    manualSelection.current = true;
    const isHasContent = checkWorkInstanceDataSource();
    setHasCache(false);
    if (isHasContent) {
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          //setCacheWorkInstanceDataSource([]);
          await querySaveWorkHour(-1)
          setInvoke(true);
          goTableTop()
          if(!workItemIds.length){
            if (workInstanceDataSource?.entities?.length) {
              const registerData2 = transformWorkHourData(workInstanceDataSource.entities);
              setTableDataSource([
                ...JSON.parse(JSON.stringify(registerData2)),
              ]);
            }
          }
          setExcludeWorkItemEntityIdListCache([])
          excludeWorkItemEntityIdListCacheRef.current = [];
          cacheWorkInstanceDataSourceRef.current = [];
          setEditData([]);
          setExpandedRowKeys([]);
          setWorkInstanceDataSource({});
          const workDateArr = e.target.value?.split("~");
          setBeginWorkDate(workDateArr[0]);
          setEndWorkDate(workDateArr[1]);
          setBeginWorkDateCP(workDateArr[0]);
          setEndWorkDateCP(workDateArr[1]);
          setWorkDateType(resolveWorkDateType(workDateArr[0], workDateArr[1]));
          setWorkInstancePagination((prev) => ({
            ...prev,
            pageNum: 1,
          }));
        },
        onCancel() {
          // window.JSSDK.toast.success('操作成功');
        },
      });
      return;
    }
    setInvoke(true);
    editDataRef.current = [];
    localHourCache.current = [];
    goTableTop();
    setExpandedRowKeys([]);
    setExcludeWorkItemEntityIdListCache([])
    excludeWorkItemEntityIdListCacheRef.current = [];
    cacheWorkInstanceDataSourceRef.current = [];
    const workDateArr = e.target.value?.split("~");
    setBeginWorkDate(workDateArr[0]);
    setEndWorkDate(workDateArr[1]);
    setBeginWorkDateCP(workDateArr[0]);
    setEndWorkDateCP(workDateArr[1]);
    setWorkDateType(resolveWorkDateType(workDateArr[0], workDateArr[1]));
    if(!workItemIds.length){
      if (workInstanceDataSource?.entities?.length) {
        const registerData = transformWorkHourData(workInstanceDataSource.entities);
        setTableDataSource([
          ...JSON.parse(JSON.stringify(registerData)),
        ]);
      }
    }
    setWorkInstancePagination((prev) => ({
      ...prev,
      pageNum: 1,
    }));
  };
  // 清空函数 - 修改版本，清空工时数据并设置 flag=0
  const clearAllWorkHours = (data) => {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map(item => clearAllWorkHours(item));
    }

    if (typeof data === 'object' && data !== null) {
      const newData = { ...data };

      Object.keys(newData).forEach(key => {
        if (dayjs(key, 'YYYY-MM-DD', true).isValid() &&
          typeof newData[key] === 'object' &&
          newData[key] !== null) {

          newData[key] = {
            ...newData[key],
            realActWorkHour: null,
            actWorkHour: null,     // 清空工时
            workDesc: null,        // 清空工作描述
            flag: 0,               // 设置 flag=0
            isRegFormOpen: false   // 关闭弹窗
          };
        } else if (key === 'children' && Array.isArray(newData[key])) {
          newData[key] = clearAllWorkHours(newData[key]);
        }
      });

      return newData;
    }

    return data;
  };
  /** 点击图标清空填报内容 */
  const clearRegisterWorkingHours = () => {
    const isHasContent = checkWorkInstanceDataSource();
    if (isHasContent) {
      Modal.confirm({
        title: "确认重置",
        icon: <ExclamationCircleFilled />,
        content: "重置将清除所有已填写内容，是否继续?",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          // 清空所有工时数据
          // 清空所有工时数据并设置 flag=0
          const clearedData = clearAllWorkHours(workInstanceDataSourceRef.current?.entities);
          setWorkInstanceDataSource({
            ...workInstanceDataSource,
            entities: clearedData
          });
          setExcludeWorkItemEntityIdListCache([])
          excludeWorkItemEntityIdListCacheRef.current = [];
          // const clearedData = clearAllWorkHours(workInstanceDataSourceRef.current?.entities);
          // setWorkInstanceDataSource({
          //   ...workInstanceDataSource,
          //   entities: clearedData
          // });
          //setEditData([]);
          // setExpandedRowKeys([]);
          //setWorkInstanceDataSource({});
          //setWorkDate(null);
          //editDataRef.current = [];
          //handleRegTableColumns();
        },
        onCancel() {
          // 取消操作
        },
      });
      return;
    } else {
      Modal.confirm({
        title: "提示",
        content: "无工时数据，无法执行重置操作",
        closeIcon: <CloseOutlined />,
        cancelButtonProps: {
          style: { display: 'none' }
        },
        async onOk() {
        },
        onCancel() {
          // 取消操作
        },
      });
      return;
    }
  };
  useEffect(() => {
    handleRegTableColumns("changeColumns");
  }, [columnsSet]);
  /** 处理表头展示 */
  const handleRegTableColumns = (type, isExpand) => {
    const latestTableAddDataSource = tableAddDataSourceRef.current;
    const latestTableDataSource = tableDataSourceRef.current;
    setTableLoading(true);
    if (type !== "changeColumns") {
      setWorkInstanceDataSource({});
    }
    if (type !== "changeColumns") setWorkDate("");
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    const regTableColumns = [
      {
        title: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontWeight: 'bold' }}>登记对象</div>
            <div>
              <DeleteOutlined
                title="清空"
                style={{ cursor: "pointer", marginRight: 10, color: '#757579' }}
                onClick={() => clearRegisterWorkingHours()}
              />
              <Popover
                placement="bottom"
                trigger="click"
                content={
                  <TableColumnsSet
                    columnsSet={columnsSet}
                    setColumnsSet={(value) => {
                      saveTableSortConfig(value);
                      setColumnsSet(value);
                    }}
                  />
                }
              >
                <SettingOutlined style={{ color: '#757579' }} />
              </Popover>
            </div>
          </div>
        ),
        dataIndex: "workItemEntityName",
        key: "workItemEntityName",
        width: 180,
        ellipsis: true,
        fixed: "left",
        render: (_, record) => {
          let name = "--";
          let icon = null;
          if (record?.workItemEntityName) {
            name = record?.workItemEntityName;
            icon = <img src={workItemEntityIcon} className="custom-levelIcon" />;
          } else if (record?.nodeName) {
            name = record?.nodeName;
            icon = <img src={nodeIcon} className="custom-levelIcon" />;
          } else if (record?.taskName) {
            name = record?.taskName;
            icon = <img src={taskIcon} className="custom-levelIcon" />;
          }
          // 将图标和名称组合
          name = icon ? <>{icon}{name}</> : name;
          return (
            <Tooltip placement="topLeft" title={<><div >{name}</div></>}>
              <div
                style={{
                  width: "170px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  wordBreak: "break-all",
                  verticalAlign: "middle",
                  cursor: "pointer",
                }}
              >
                {name}
              </div>
            </Tooltip>
          );
        },
      },
    ];
    columnsSet.forEach((item) => {
      switch (item.value) {
         case "customFieldValue":
          regTableColumns.push({
            title: <span style={{ fontWeight: 'bold' }}>{item.label}</span>,
            dataIndex: "customFieldValue",
            key: "customFieldValue",
            hidden: !columnsSet.find((item) => item.value === "customFieldValue")
              ?.checked,
            width: CUSTOM_FIELD_COLUMN_WIDTH,
            ellipsis: true,
            onHeaderCell: () => ({
              style: {
                width: CUSTOM_FIELD_COLUMN_WIDTH,
                minWidth: CUSTOM_FIELD_COLUMN_WIDTH,
                maxWidth: CUSTOM_FIELD_COLUMN_WIDTH,
              },
            }),
            onCell: () => ({
              style: {
                width: CUSTOM_FIELD_COLUMN_WIDTH,
                minWidth: CUSTOM_FIELD_COLUMN_WIDTH,
                maxWidth: CUSTOM_FIELD_COLUMN_WIDTH,
              },
            }),
            render: (_, record) => (
              <CustomFieldValueCell value={record?.customFieldValue} />
            ),
          });
          break;
        case "scheduleDate":
          regTableColumns.push({
            title: <span style={{ fontWeight: 'bold' }}>{item.label}</span>,
            dataIndex: "scheduleDate",
            key: "scheduleDate",
            hidden: !columnsSet.find((item) => item.value === "scheduleDate")
              ?.checked,
            width: 220,
            ellipsis: true,
            render: (_, record) => {
              let scheduleDate = "--";
              if (record?.scheduleStart && record?.scheduleEnd) {
                scheduleDate = `${record?.scheduleStart}~${record?.scheduleEnd}`;
              } else if (record?.scheduleStart) {
                scheduleDate = `${record?.scheduleStart}~--`;
              } else if (record?.scheduleEnd) {
                scheduleDate = `--~${record?.scheduleEnd}`;
              }
              return `${scheduleDate}`;
            },
          });
          break;
        case "estimatedScore":
          regTableColumns.push({
            title: <span style={{ fontWeight: 'bold' }}>{item.label}</span>,
            dataIndex: "estimatedScore",
            key: "estimatedScore",
            hidden: !columnsSet.find((item) => item.value === "estimatedScore")
              ?.checked,
            width: 80,
            ellipsis: true,
            render: (_, record) =>
              `${record?.estimatedWorkingHoursSelf
                ? `${record?.estimatedWorkingHoursSelf}h`
                : "--"
              } / ${record?.estimatedWorkingHoursAll
                ? `${record?.estimatedWorkingHoursAll}h`
                : "--"
              }`,
          });
          break;
        case "total":
          regTableColumns.push({
            title: <span style={{ fontWeight: 'bold' }}>{item.label}</span>,
            dataIndex: "total",
            key: "total",
            hidden: !columnsSet.find((item) => item.value === "total")?.checked,
            width: 70,
            ellipsis: true,
            render: (_, record) => {
              let total = new Decimal(0);
              for (const key in record) {
                if (
                  typeof record[key] === "object" &&
                  record[key]?.actWorkHour
                ) {
                  total = total.plus(record[key]?.actWorkHour);
                }
              }
              return total.toNumber() ? total.toNumber() : null;
            },
          });
          break;
        case "regDate":
          rangeDates?.map((item) =>
            regTableColumns.push({
              title: (
                <div style={{ textAlign: "center" }}>
                  <div>{item.dayOfWeek}</div>
                  <div>{item.date}</div>
                </div>
              ),
              dataIndex: `${item.date}`,
              key: `${item.date}`,
              width: 120,
              render: (_, record, index) => {
                // 动态"单天填报上限"：跟随考勤场景取值（未开启考勤时回退固定 dayUp）
                const onceDown = capacitySetRef.current?.onceDown || 0.1;
                const dateAttendance = attendanceSnapshotMap[item.date] || getAttendanceSnapshot(item.date);
                //console.log('dateAttendance', dateAttendance);
                const _snapEnabled = dateAttendance?.attendanceEnabled ?? attendanceConfigRef.current.enabled ?? 0;
                const _snapHours = dateAttendance
                  ? dateAttendance.attendanceHours
                  : attendanceConfigRef.current.hours ?? null;
                const _snapPolicy = dateAttendance?.missPunchPolicy ?? attendanceConfigRef.current.policy ?? 1;
                const _snapCustomLimit = dateAttendance?.missPunchCustomLimit ?? attendanceConfigRef.current.customLimit ?? null;
                // 考勤开启但该日期的考勤快照还没查回来时，单天上限未知，不能按 0 参与判定，
                // 否则缓存工时先渲染会被误判成"超出上限"而闪现红色背景。
                const limitUnknown = isAttendanceLimitUnknown(dateAttendance, _snapEnabled);
                const dynamicDayUp = limitUnknown
                  ? null
                  : resolveAttendanceUpperLimit({
                    enabled: _snapEnabled,
                    hours: _snapHours,
                    policy: _snapPolicy,
                    customLimit: _snapCustomLimit,
                    dayUp: record?.dayUp,
                  });
                const isOverDayUp = dynamicDayUp !== null && _?.actWorkHour > dynamicDayUp;
                // 工时颗粒度整数倍判定：开启后将不满足整数倍的单元格同共享红底提醒
                const isGranularityViolated = (() => {
                  const { enabled, hour } = granularityRef.current;
                  if (enabled !== 1 || !hour || !_?.actWorkHour) return false;
                  const numVal = Number(_?.actWorkHour);
                  if (!Number.isFinite(numVal)) return false;
                  const remainder = Math.round((numVal % hour) * 1e6) / 1e6;
                  return remainder !== 0 && Math.abs(remainder - hour) > 1e-6;
                })();
                const isCurrentDateOverLimit = Boolean(
                  _?.actWorkHour &&
                  (_?.actWorkHour < onceDown ||
                    isOverDayUp ||
                    _?.flag ||
                    isGranularityViolated)
                );
                return (
                <>
                  <Tooltip
                    title={record.canRegisterLevel === false ? "该层级禁止登记" : ""}
                    placement="top"
                  >
                    <Popover
                      style={{ display: "block", width: "100%", height: "100%" }}
                      placement="bottom"
                      trigger="click"
                      destroyTooltipOnHide
                      content={
                        <>
                          <Form
                            form={regBatchForm}
                            className="regBatchNew-form"
                            onValuesChange={(values, allValues) => {
                              // 创建新的record对象引用，确保React能检测到变化
                              const updatedRecord = {
                                ...record,
                                [`${item.date}`]: {
                                  ...record[`${item.date}`],
                                  ...allValues,
                                  // 确保actWorkHour与realActWorkHour保持同步
                                  actWorkHour: allValues.realActWorkHour
                                },
                                // 添加时间戳确保每次key都不同，强制重新渲染组件
                                timestamp: Date.now()
                              };
                              setCurRecord(updatedRecord);
                            }}
                          >
                            <Form.Item label={<span style={{ marginLeft:8 }}>登记日期</span>}>
                              {record?.date}（{item?.dayOfWeek}）
                            </Form.Item>
                            <div style={{ height: 30, overflow: "hidden", width: '300px' }}>
                              <RegisterWorkItemTable
                                registerDate={item.date}
                                key={curRecord?.id ? `${curRecord.id}-${Date.now()}` : `table-${Date.now()}`}
                                dataSource={record}
                              />
                            </div>
                            <Form.Item
                              label={
                                <div>
                                  <span style={{ color: "#df000e", fontSize: 14 }}>* </span>
                                  登记工时
                                </div>
                              }
                              name="realActWorkHour"
                              validateFirst
                              rules={[
                                {
                                  validator: (rule, value) => {
                                    // 考勤记录校验（H5 迁移）：考勤开启 && 无考勤记录 && 缺卡策略为不允许提交 → 拦截
                                    // 该日期考勤快照还没查回来时不做判定，避免把"未查到"当成"无考勤记录"误拦截。
                                    if (isAttendanceLimitUnknown(
                                      getAttendanceSnapshot(item.date),
                                      attendanceConfigRef.current?.enabled
                                    )) return Promise.resolve();
                                    const dateCapacity = getDateCapacitySnapshot(item.date);
                                    const _snapEnabled = dateCapacity?.attendanceEnabled ?? attendanceConfigRef.current.enabled ?? 0;
                                    const _snapHours = dateCapacity
                                      ? dateCapacity.attendanceHours
                                      : attendanceConfigRef.current.hours ?? null;
                                    const _snapPolicy = dateCapacity?.missPunchPolicy ?? attendanceConfigRef.current.policy ?? 1;
                                    if (Number(_snapEnabled) === 1
                                      && (normalizeAttendanceNumber(_snapHours) === null
                                        || normalizeAttendanceNumber(_snapHours) === 0)
                                      && Number(_snapPolicy) === 1) {
                                      return Promise.reject(new Error('当天无考勤记录，不可登记工时'));
                                    }
                                    return Promise.resolve();
                                  },
                                },
                                {
                                  validator: (rule, value) => {
                                    const normalizedValue = normalizeAttendanceNumber(value);
                                    if (normalizedValue === null) return Promise.resolve();
                                    if (normalizedValue < onceDown && record?.[record.date]?.flag == 1) {
                                      return Promise.reject(
                                        [
                                          <div key="line1">低于单次填报工时下限{onceDown}小时</div>
                                        ]
                                      );
                                    }
                                    if (normalizedValue < onceDown) {
                                      return Promise.reject(
                                        `低于单次填报工时下限${onceDown}小时`
                                      );
                                    }
                                    // 上限校验（H5 迁移）：使用快照中的考勤配置确定单天填报上限
                                    const dateCapacity = getDateCapacitySnapshot(item.date);
                                    // 考勤/饱和度快照未完成时暂不进行上限校验，避免用默认值误报。
                                    if (!dateCapacity) return Promise.resolve();
                                    const _snapEnabled = dateCapacity?.attendanceEnabled ?? attendanceConfigRef.current.enabled ?? 0;
                                    const _snapHours = dateCapacity?.attendanceHours ?? attendanceConfigRef.current.hours ?? null;
                                    const _snapPolicy = dateCapacity?.missPunchPolicy ?? attendanceConfigRef.current.policy ?? 1;
                                    const _snapCustomLimit = dateCapacity?.missPunchCustomLimit ?? attendanceConfigRef.current.customLimit ?? null;
                                    const normalizedHours = normalizeAttendanceNumber(_snapHours);
                                    const normalizedPolicy = normalizeAttendanceNumber(_snapPolicy, 1);
                                    // 缺卡且不允许提交由前一条规则负责提示，不能再生成上限 0 小时错误。
                                    if (Number(_snapEnabled) === 1
                                      && (normalizedHours === null || normalizedHours === 0)
                                      && normalizedPolicy === 1) return Promise.resolve();
                                    const upperLimit = isAttendanceLimitUnknown(
                                      getAttendanceSnapshot(item.date),
                                      _snapEnabled
                                    )
                                      ? null
                                      : resolveAttendanceUpperLimit({
                                        enabled: _snapEnabled,
                                        hours: normalizedHours,
                                        policy: normalizedPolicy,
                                        customLimit: _snapCustomLimit,
                                        dayUp: dateCapacity?.dayUp ?? record?.dayUp,
                                      });
                                    // 上限未知（考勤快照未返回）时跳过上限校验。
                                    if (upperLimit === null) return Promise.resolve();
                                    if (Number(_snapEnabled) === 1
                                      && upperLimit === 0
                                      && normalizedPolicy !== 2) return Promise.resolve();
                                    const currentValue = normalizedValue;
                                    const workHour = getDateWorkHourTotal(
                                      item.date,
                                      workInstanceDataSourceRef.current || workInstanceDataSource,
                                      record?.id,
                                      currentValue
                                    );
                                    const registeredWorkingHours = Number(dateCapacity.registeredWorkingHours) || 0;
                                    const approvalingWork = Number(dateCapacity.approvalingWork) || 0;
                                    const remainingAfterSubmit = upperLimit
                                      - registeredWorkingHours
                                      - approvalingWork
                                      - workHour.toNumber();
                                    if (remainingAfterSubmit < 0) {
                                      return Promise.reject(`当天填报工时超过上限 ${upperLimit} 小时`);
                                    }
                                    return Promise.resolve();
                                  },
                                },
                                {
                                  validator: (rule, value) => {
                                    // 工时颗粒度：开启后填报工时必须为颗粒度值的整数倍
                                    const { enabled, hour } = granularityRef.current;
                                    if (enabled !== 1 || !hour) return Promise.resolve();
                                    const numVal = normalizeAttendanceNumber(value);
                                    if (numVal === null) return Promise.resolve();
                                    // 整数倍校验（浮点精度容差，与单项登记一致）
                                    const remainder = Math.round((numVal % hour) * 1e6) / 1e6;
                                    if (remainder !== 0 && Math.abs(remainder - hour) > 1e-6) {
                                      return Promise.reject(new Error(`填报工时必须是 ${hour} 的整数倍`));
                                    }
                                    return Promise.resolve();
                                  },
                                },
                              ]}

                            >
                            <InputNumber
                              size="small"
                              style={{ 
                                width: "195px",
                                borderColor: _?.realActWorkHour &&isCurrentDateOverLimit ? '#F0144A' : undefined
                              }}
                              placeholder="请输入工时"
                              precision={2}
		                        max={9999} // 设置最大值为9999.99，确保整数部分不超过4位
                              formatter={(value) => {
                                if (value === null || value === undefined) {
                                  return value;
                                }
                                let stringValue = value.toString();
                                // 将全角小数点转换为半角
                                stringValue = stringValue.replace('。', '.');
                                if (stringValue.includes('.')) {
                                  const parts = stringValue.split('.');
                                  if (parts[1] && parts[1].length > 2) {
                                    return `${parts[0]}.${parts[1].slice(0, 2)}`;
                                  }
                                }
                                return stringValue;
                              }}
                              parser={(value) => {
                                // 确保解析后的值最多保留两位小数
                                if (value === null || value === undefined) {
                                  return null;
                                }
                                if (typeof value === 'string') {
                                  // 将全角小数点转换为半角
                                  value = value.replace('。', '.');
                                  if (value.includes('.')) {
                                    const parts = value.split('.');
                                    if (parts[1] && parts[1].length > 2) {
                                      return parseFloat(`${parts[0]}.${parts[1].slice(0, 2)}`);
                                    }
                                  }
                                }
                                return value === '' ? null : parseFloat(value) || value;
                              }}
                              onChange={(value) => {
                                // 当值改变时，如果小数位超过两位则截取
                                if (value && value.toString().includes('.')) {
                                  const parts = value.toString().split('.');
                                  if (parts[1] && parts[1].length > 2) {
                                    const newValue = parseFloat(`${parts[0]}.${parts[1].slice(0, 2)}`);
                                    // 更新表单字段值
                                    regBatchForm.setFieldsValue({
                                      realActWorkHour: newValue
                                    });
                                  }
                                }
                              }}
                              onKeyDown={(e) => {
                                // 阻止输入超过两位小数
                                if (!e || !e.target) {
                                  return;
                                }
                                const target = e.target;
                                let value = target.value || '';
                                                               
                                // 允许控制键
                                if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || 
                                    e.key === 'ArrowRight' || e.key === 'Tab' || e.key === 'Enter' || 
                                    e.ctrlKey || e.metaKey || e.altKey) {
                                  return;
                                }
                                                              
                                // 处理中文输入法的小数点
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
                                                                
                                  // 更新表单字段值
                                  regBatchForm.setFieldsValue({
                                    realActWorkHour: parseFloat(newValue) || newValue
                                  });
                                                                
                                  return;
                                }
                                                              
                                // 只处理数字和小数点
                                if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
                                  // 如果输入的是小数点，检查是否已经存在
                                  if (e.key === '.') {
                                    // 同时检查全角和半角小数点
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
                                } else {
                                  // 阻止其他字符输入
                                  e.preventDefault();
                                }
                              }}
                              onCompositionStart={(e) => {
                                // 中文输入开始时，不做任何限制
                              }}
                              onCompositionEnd={(e) => {
                                // 中文输入结束时，立即过滤掉非数字字符
                                const target = e.target;
                                let value = target.value;
                                                              
                                // 限制只能输入数字、小数点和全角小数点
                                let filteredValue = value.replace(/[^\d.。]/g, '');
                                                              
                                // 确保只有一个（半角或全角）小数点
                                const dotIndex = filteredValue.indexOf('.');
                                const fullDotIndex = filteredValue.indexOf('。');
                                                              
                                if (dotIndex !== -1 && fullDotIndex !== -1) {
                                  // 如果同时存在两种小数点，保留第一个，移除后面的
                                  const firstDotPos = Math.min(dotIndex, fullDotIndex);
                                  const firstDot = dotIndex < fullDotIndex ? '.' : '。';
                                  const remainingPart = filteredValue.substring(firstDotPos + 1);
                                  const remainingWithoutDots = remainingPart.replace(/[.。]/g, '');
                                  filteredValue = filteredValue.substring(0, firstDotPos + 1) + firstDot + remainingWithoutDots;
                                }
                                                              
                                // 检查是否包含全角小数点，如果有则转换为半角
                                if (filteredValue && filteredValue.includes('。')) {
                                  filteredValue = filteredValue.replace('。', '.');
                                }
                                                              
                                // 防止整数部分超过4位
                                if (filteredValue && filteredValue.includes('.')) {
                                  const [integerPart, decimalPart] = filteredValue.split('.');
                                  if (integerPart && integerPart.length > 4) {
                                    filteredValue = integerPart.substring(0, 4) + '.' + decimalPart;
                                  }
                                  // 限制小数部分最多2位
                                  if (decimalPart && decimalPart.length > 2) {
                                    filteredValue = integerPart + '.' + decimalPart.substring(0, 2);
                                  }
                                } else if (filteredValue && filteredValue.length > 4) {
                                  // 如果没有小数点，限制整数部分最多4位
                                  filteredValue = filteredValue.substring(0, 4);
                                }
                                                              
                                // 更新输入框值
                                if (value !== filteredValue) {
                                  target.value = filteredValue;
                                  // 更新表单字段值
                                  regBatchForm.setFieldsValue({
                                    realActWorkHour: parseFloat(filteredValue) || filteredValue
                                  });
                                }
                              }}
                              onInput={(e) => {
                                if (!e || !e.target) {
                                  return;
                                }
                                const target = e.target;
                                let value = target.value;
                              
                                // 限制只能输入数字、小数点和全角小数点
                                // 使用正则表达式过滤掉非数字字符（除了小数点）
                                let filteredValue = value.replace(/[^\d.。]/g, '');
                              
                                // 确保只有一个（半角或全角）小数点
                                const dotIndex = filteredValue.indexOf('.');
                                const fullDotIndex = filteredValue.indexOf('。');
                              
                                if (dotIndex !== -1 && fullDotIndex !== -1) {
                                  // 如果同时存在两种小数点，保留第一个，移除后面的
                                  const firstDotPos = Math.min(dotIndex, fullDotIndex);
                                  const firstDot = dotIndex < fullDotIndex ? '.' : '。';
                                  const remainingPart = filteredValue.substring(firstDotPos + 1);
                                  const remainingWithoutDots = remainingPart.replace(/[.。]/g, '');
                                  filteredValue = filteredValue.substring(0, firstDotPos + 1) + firstDot + remainingWithoutDots;
                                }
                              
                                // 检查是否包含全角小数点，如果有则转换为半角
                                if (filteredValue && filteredValue.includes('。')) {
                                  filteredValue = filteredValue.replace('。', '.');
                                }
                              
                                // 防止整数部分超过4位
                                if (filteredValue && filteredValue.includes('.')) {
                                  const [integerPart, decimalPart] = filteredValue.split('.');
                                  if (integerPart && integerPart.length > 4) {
                                    filteredValue = integerPart.substring(0, 4) + '.' + decimalPart;
                                  }
                                  // 限制小数部分最多2位
                                  if (decimalPart && decimalPart.length > 2) {
                                    filteredValue = integerPart + '.' + decimalPart.substring(0, 2);
                                  }
                                } else if (filteredValue && filteredValue.length > 4) {
                                  // 如果没有小数点，限制整数部分最多4位
                                  filteredValue = filteredValue.substring(0, 4);
                                }
                              
                                // 更新输入框值
                                if (value !== filteredValue) {
                                  target.value = filteredValue;
                                  // 更新表单字段值
                                  regBatchForm.setFieldsValue({
                                    realActWorkHour: parseFloat(filteredValue) || filteredValue
                                  });
                                }
                              }}
                              ref={workHourInputNumRef}
                            />
                            
                            </Form.Item>
                            <span style={{ position: 'absolute',right: '3px',top: '75px' }}>小时</span>
                             <Form.Item 
                              label={
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                                  {workDescReq.current === 1 && <span style={{ color: "#df000e", fontSize: 14, marginRight: 4 }}>*</span>}
                                  {workDescReq.current === 0 && <span style={{ marginLeft: 8 }}></span>}
                                  <span>工作描述</span>
                                </div>
                              } 
                              name="workDesc"
                              rules={[
                                {
                                  validator: (rule, value) => {
                                    // 如果工作描述必填且为空，返回错误
                                    // 只有当 Popover 打开时才进行校验，避免关闭后仍显示红色提示
                                    if (workDescReq.current === 1 && (!value || value.trim() === '') && record[item.date]?.realActWorkHour > 0 && record[item.date]?.isRegFormOpen) {
                                      return Promise.reject('请填写工作描述');
                                    }
                                    return Promise.resolve();
                                  },
                                },
                              ]}
                            >
                            <Input.TextArea
                              size="small"
                              style={{
                                resize: "none",
                                margin: "5px 0",
                              }}
                              showCount
                              maxLength={200}
                              placeholder="请输入"
                              rows={3}
                            />
                            </Form.Item>
                          </Form>
                        </>
                      }
                      onOpenChange={(newOpen) => {
                        // 如果该层级禁止登记，则阻止打开弹窗
                        if (record.canRegisterLevel === false && newOpen) {
                          return;
                        }
                                              
                        if (formValidationTimerRef.current) {
                          clearTimeout(formValidationTimerRef.current);
                          formValidationTimerRef.current = null;
                        }

                        // 所有日期弹窗共用一个 Form，切换日期前清理上一日期的校验状态，
                        // 避免延迟校验结果短暂显示在新日期上。
                        regBatchForm.setFields([
                          { name: 'realActWorkHour', errors: [] },
                          { name: 'workDesc', errors: [] },
                        ]);

                        record.date = item.date;
                        record.dayOfWeek = item.dayOfWeek;
                        record.index = index;
                        record[item.date] = {
                          ...record[item.date],
                          isRegFormOpen: newOpen,
                        };
                        //console.log("info",_);
                        regBatchForm.setFieldsValue(_);
                        setWorkDate(item.date);
                        setCurRecord({ ...record });
                                              
                        if (newOpen) {
                          activeRegFormDateRef.current = item.date;
                          // 使用 setTimeout 确保在 DOM 更新后执行 focus
                          formValidationTimerRef.current = setTimeout(() => {
                            formValidationTimerRef.current = null;
                            if (activeRegFormDateRef.current !== item.date) return;
                            regBatchForm.validateFields(['realActWorkHour', 'workDesc']).catch(() => {});
                            workHourInputNumRef.current?.focus();
                          }, 100);
                        } else {
                          if (activeRegFormDateRef.current === item.date) {
                            activeRegFormDateRef.current = null;
                          }
                          // 关闭弹窗时进行校验
                          const workHour = record[item.date]?.actWorkHour || record[item.date]?.realActWorkHour;
                          const workDesc = record[item.date]?.workDesc;
                          // 如果关闭弹窗时删除了工时（没有填写工作描述），清除表单校验错误
                          if ((!workHour || workHour === 0) && (!workDesc || workDesc.trim() === '')) {
                            // 清除 workDesc 字段的校验状态
                            regBatchForm.setFields([
                              {
                                name: 'workDesc',
                                errors: []
                              }
                            ]);
                          }
                          
                          // 保存当前状态，不重新打开弹窗
                          // 单元格背景色会根据条件自动设置为 #FEF1F4
                        }
                      }}
                      open={_?.isRegFormOpen}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          display: "inline-block",
                          width: "100%",
                          height: _?.isRegFormOpen
                            ? 39 : 40,
                          padding: "8px",
                          boxSizing: "border-box",
                          color: record.canRegisterLevel === false
                            ? "#999"
                            : _?.actWorkHour &&
                              (_?.actWorkHour < onceDown || isOverDayUp || _?.flag || isGranularityViolated)
                              ? "#F0144A" : "#1C1C24",
                          border: `1px solid ${_?.isRegFormOpen
                            ? "#4247f6"
                            : _?.actWorkHour &&
                              (_?.actWorkHour < onceDown || isOverDayUp || isGranularityViolated)
                              ? "#f0f0f0"
                              : _?.flag || record.canRegisterLevel === false
                                ? "#f0f0f0"
                                : "transparent"
                            }`,
                          backgroundColor: record.canRegisterLevel === false
                            ? "#F8F9FA"
                            : _?.actWorkHour &&
                              (_?.actWorkHour < onceDown || isOverDayUp || isGranularityViolated)
                              ? "#FEF1F4"
                              : (_?.actWorkHour && _?.flag)
                                ? "#FEF1F4"
                                : // 如果填写了工时但没有填写工作描述，且工作描述为必填，显示红色背景
                                  (workDescReq.current === 1 && _?.realActWorkHour && (!_?.workDesc || _?.workDesc?.trim() === '') && _?.isRegFormOpen==false)
                                  ? "#FEF1F4"
                                  : isDateInSchedule(`${item.date}`, record)
                                    ? "#F4F4FE"
                                    : "transparent",
                          cursor: record.canRegisterLevel === false ? "not-allowed" : "pointer",
                          borderRight: record.canRegisterLevel === false ? "none" : "",
                        }}
                      >
                        {_?.actWorkHour ? _?.actWorkHour : ""}
                      </div>
                    </Popover>
                  </Tooltip>
                </>
                );
              },
            })
          );
          break;
        default:
          break;
      }
    });
    setRegTableColumns(regTableColumns);
    if (type === "changeColumns") {
      if (batchTableRenderPendingRef.current === null) {
        setTableLoading(false);
      }
      return;
    }
    let dataAll = [];
    if (hasCacheRef.current) {
      if (cacheWorkInstanceDataSourceRef.current?.length) {
        const cacheTableSource = JSON.parse(JSON.stringify(cacheWorkInstanceDataSourceRef.current));
        cacheTableSource?.forEach((item) => {
          traverseTreeClearDate(item);
          traverseTreeRecursively(item);
        });
        dataAll.push(...cacheTableSource);
      }
    } else {
      if (latestTableAddDataSource?.length) {
        const dataAddSource = JSON.parse(JSON.stringify(latestTableAddDataSource));
        dataAddSource?.forEach((item) => {
          traverseTreeClearDate(item);
          traverseTreeRecursively(item);
        });
        dataAll.push(...dataAddSource);
      }
      if (latestTableDataSource?.length) {
        const dataSource = JSON.parse(JSON.stringify(latestTableDataSource));
        dataSource?.forEach((item) => {
          traverseTreeClearDate(item);
          traverseTreeRecursively(item);
        });
        dataAll.push(...dataSource);
      }
    }
    dataAll = [...new Set(dataAll?.map((item) => item.id))].map((id) => {
      return dataAll?.find((item) => item.id === id);
    });
    if (isExpand && dataAll?.length && manualSelection.current) {
      handleExpandLevelChange(expandLevel, dataAll)
    }
    //handleExpandLevelChange(expandLevel,dataAll)
    setWorkInstanceDataSource({
      ...workInstanceDataSource,
      entities: dataAll,
    });
    //console.log('expandedRowKeys88888', expandedRowKeys);
    //if (props?.type !== "tab") setExpandedRowKeys([]);
    if (batchTableRenderPendingRef.current === null) {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    //if (!invoke) return;
    //console.log('beginWorkDate, endWorkDate',beginWorkDate, endWorkDate);
    if (beginWorkDate && endWorkDate) {
      setWorkDate(null);
      // handleRegTableColumns('', 'expandFlag');
      if (workInstancePagination.pageNum === 1) {
        if (!hasCacheRef.current) {
          const handleDateChange = async () => {
            await getSelectWorkInstanceTable();
            handleRegTableColumns("changeColumns",'expandFlag');
          };
          handleDateChange();
        }else{
          handleRegTableColumns("changeColumns",'expandFlag');
        }
      }
       if (workInstancePagination.pageNum === 0) {
        handleRegTableColumns("changeColumns");
      }
      if (
        "standardProduct" in regDisplayLogic &&
        !regDisplayLogic?.standardProduct
      ) {
        setScheduleStart(beginWorkDate);
        setScheduleEnd(endWorkDate);
        setTableDataSource([]);
        setWorkInstanceDataSource({});
        return;
      }
    }
  }, [beginWorkDate, endWorkDate]);

  /** 项目排期筛选变更 */
  const onScheduleChange = debounce((date, dateString) => {
    //setInvoke(true);
    const isHasContent = checkWorkInstanceDataSource();
    if (isHasContent) {
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          await querySaveWorkHour(-1)
          setInvoke(true);
          //setCacheWorkInstanceDataSource([]);
          addExtraRef.current = [];
          filterRegistrationRef.current = [];
          cacheWorkInstanceDataSourceRef.current = [];
          setCacheWorkInstanceDataSource([]);
          setExcludeWorkItemEntityIdListCache([])
          excludeWorkItemEntityIdListCacheRef.current = [];
          setEditData([]);
          setExpandedRowKeys([]);
          setScheduleStart(dateString[0] ? dateString[0] : null);
          setScheduleEnd(dateString[1] ? dateString[1] : null);
          setTableDataSource([]);
          setWorkInstanceDataSource({});
        },
        onCancel() {
          // window.JSSDK.toast.success('操作成功');
        },
      });
      return;
    } else {
      setInvoke(true);
    }
    localHourCache.current = [];
    addExtraRef.current = [];
    filterRegistrationRef.current = [];
    cacheWorkInstanceDataSourceRef.current = [];
    setCacheWorkInstanceDataSource([]);
    setExcludeWorkItemEntityIdListCache([])
    excludeWorkItemEntityIdListCacheRef.current = [];
    setExpandedRowKeys([]);
    setScheduleStart(dateString[0] ? dateString[0] : null);
    setScheduleEnd(dateString[1] ? dateString[1] : null);
    setTableDataSource([]);
    setWorkInstanceDataSource({});
  }, 800);
  /** 检查日期是否在排期内 */
  const isDateInSchedule = (date, row) => {
    // 检查是否有有效的排期范围
    if (!row.scheduleStart || !row.scheduleEnd) return false;

    try {
      const dateObj = new Date(date);
      const startDate = new Date(row.scheduleStart);
      const endDate = new Date(row.scheduleEnd);

      // 设置时间为同一天的开始，避免时间部分影响比较
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      dateObj.setHours(0, 0, 0, 0);

      return dateObj >= startDate && dateObj <= endDate;
    } catch (error) {
      return false;
    }
  };
  /** 查看是否有填报内容 */
  const checkWorkInstanceDataSource = () => {
    // let isHasContent = false;
    // if (workInstanceDataSource?.entities?.length) {
    //   const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    //   for (const date of rangeDates) {
    //     for (const item of workInstanceDataSource.entities) {
    //       if (item[date.date]?.actWorkHour) {
    //         isHasContent = true;
    //         break;
    //       }
    //     }
    //     if (isHasContent) break;
    //   }
    // }
    // if (props?.setSubmitDisabled) props?.setSubmitDisabled(!isHasContent);
    // return isHasContent;
    let isHasContent = false;
    const latestDataSource = workInstanceDataSourceRef.current;
    if (latestDataSource?.entities?.length) {
      const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
      for (const date of rangeDates) {
        for (const item of latestDataSource.entities) {
          if (item[date.date]?.actWorkHour) {
            isHasContent = true;
            break;
          }
        }
        if (isHasContent) break;
      }
    }

    if (props?.setSubmitDisabled) props?.setSubmitDisabled(!isHasContent);
    return isHasContent;
  };
  /** 填报处理 */
  const onRefreshTableClick = (record, workInstanceDataSource) => {
    try {
      setCurRecord({});
      const nextWorkInstanceDataSource = {
        ...workInstanceDataSource,
        entities: JSON.parse(JSON.stringify(workInstanceDataSource?.entities || [])),
      };
      const traverseTree = (node) => {
        if (node.id === record?.id) {
          for (const key in node) {
            if (key === record?.date) {
              const nextDateValue = { ...(record[key] || {}) };
              delete nextDateValue.flag;
              node[key] = {
                ...node[key],
                ...nextDateValue,
              };
              // 如果工时被清空，设置 flag=0
              if (record[key]?.actWorkHour === null) {
                node[key].flag = 0;
              }
            } else {
              if (node[key]?.isRegFormOpen)
                node[key] = {
                  ...node[key],
                  isRegFormOpen: false,
                };
            }
          }
        } else {
          for (const key in node) {
            if (node[key]?.isRegFormOpen) {
              node[key].isRegFormOpen = false;
            }
          }
        }
        if (node?.children && node?.children?.length > 0) {
          node?.children?.forEach((child) => {
            traverseTree(child);
          });
        }
      };
      nextWorkInstanceDataSource.entities.forEach((item) => {
        traverseTree(item);
      });
      nextWorkInstanceDataSource.entities = handleWorkItemEntityNodeAndTask(
        record?.date,
        nextWorkInstanceDataSource.entities
      );

      setWorkInstanceDataSource(nextWorkInstanceDataSource);
    } catch (error) {
      console.log("error", error);
    }
  };

  useEffect(() => {
    if (
      Object.keys(curRecord).length &&
      workInstanceDataSource?.entities?.length
    ) {
      onRefreshTableClick(curRecord, workInstanceDataSource);
    }
  }, [curRecord]);

  /** 处理工时累加关系 */
  const handleWorkItemEntityNodeAndTask = (dateKey, data) => {
    //console.log("dateKey", dateKey, data);
    // 递归处理数据树，实现向上汇总逻辑
    const processTreeNode = (node) => {
      // 确保dateKey对象存在
      if (!node[dateKey]) {
        node[dateKey] = {};
      }

      // 获取节点自身的登记工时
      const nodeRealHour = node[dateKey]?.realActWorkHour || 0;
      // 如果节点有子节点，先递归处理子节点
      if (node.children && node.children.length > 0) {
        // 使用Decimal处理小数精度，累加所有子节点的汇总工时
        let childrenTotalHour = new Decimal(0);

        for (const child of node.children) {
          // 递归处理子节点
          processTreeNode(child);
          // 累加子节点的汇总工时，使用Decimal确保精度
          childrenTotalHour = childrenTotalHour.plus(new Decimal(child[dateKey]?.actWorkHour || 0));
        }

        // 计算当前节点的汇总工时 = 自身登记工时 + 所有子节点汇总工时
        // 使用Decimal确保精度，并保留两位小数
        const totalHour = new Decimal(nodeRealHour).plus(childrenTotalHour);
        node[dateKey].actWorkHour = totalHour.isZero() ? null : totalHour.toDecimalPlaces(2).toNumber();
      } else {
        // 叶子节点（任务节点）的汇总工时就是其自身登记工时
        // 保留两位小数
        const totalHour = new Decimal(nodeRealHour);
        node[dateKey].actWorkHour = totalHour.isZero() ? null : totalHour.toDecimalPlaces(2).toNumber();
      }

      // 始终保留原始的realActWorkHour值
      if (nodeRealHour) {
        node[dateKey].realActWorkHour = nodeRealHour;
      }
    };

    // 处理每个工作项实例
    data?.forEach((entity) => {
      processTreeNode(entity);
    });
    return data;
  };

  /** 选择被登记人 */
  const onSearchPersonChange = (val) => {
    //setInvoke(true);
    const isHasContent = checkWorkInstanceDataSource();
    if (isHasContent) {
      Modal.confirm({
        title: "确认修改",
        icon: <ExclamationCircleFilled />,
        content: "修改后，已登记的工时及其工作描述将被清空。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          setInvoke(true);
              setHasCache(false);
          //await querySaveWorkHour(-1)
          localHourCache.current = [];
          addExtraRef.current = []
          filterRegistrationRef.current = [];
          setCacheWorkInstanceDataSource([]);
          setExcludeWorkItemEntityIdListCache([])
          cacheWorkInstanceDataSourceRef.current = [];
          excludeWorkItemEntityIdListCacheRef.current = [];
          setEditData([]);
          setExpandedRowKeys([]);
          setTableDataSource([]);
          setWorkInstanceDataSource({});
          if (val) {
            setRegistrantUserKey(val);
            props.getRegistrantUserKey(val);
          } else {
            setRegistrantUserKey(props?.loginUser?.id);
            props.getRegistrantUserKey(props?.loginUser?.id);
            setPickerUser({
              userKey: props?.loginUser?.id,
              nameCn: props?.loginUser?.name,
              avatarUrl: props?.loginUser?.avatar,
            });
          }
        },
        onCancel() {
          // window.JSSDK.toast.success('操作成功');
          // setRegistrantUserKey(props?.loginUser?.id);
          // props.getRegistrantUserKey(props?.loginUser?.id);
          // setPickerUser({
          //   userKey: props?.loginUser?.id,
          //   nameCn: props?.loginUser?.name,
          //   avatarUrl: props?.loginUser?.avatar,
          // });
        },
      });
      return;
    }
    setInvoke(true);
    setHasCache(false);
    if (val) {
      setRegistrantUserKey(val);
      props.getRegistrantUserKey(val);
    } else {
      setRegistrantUserKey(props?.loginUser?.id);
      props.getRegistrantUserKey(props?.loginUser?.id);
      setPickerUser({
        userKey: props?.loginUser?.id,
        nameCn: props?.loginUser?.name,
        avatarUrl: props?.loginUser?.avatar,
      });
    }
    localHourCache.current = [];
    addExtraRef.current = []
    filterRegistrationRef.current = [];
    setExcludeWorkItemEntityIdListCache([])
    cacheWorkInstanceDataSourceRef.current = [];
    excludeWorkItemEntityIdListCacheRef.current = [];
    setExpandedRowKeys([]);
    setTableDataSource([]);
    setWorkInstanceDataSource({});
  };

  /** 批量登记提交 */
  const onBatchSubmit = async () => {
    const sourceEntities = Array.isArray(workInstanceDataSource?.entities)
      ? workInstanceDataSource.entities
      : [];
    if (workInstanceDataSource?.entities != null && !Array.isArray(workInstanceDataSource.entities)) {
      console.error("批量登记提交数据中的 entities 不是数组:", workInstanceDataSource.entities);
    }
    if (!sourceEntities.length) {
      window.JSSDK.toast.warning("登记内容不能为空");
      props.setSubmitLoadings(false);
      return;
    }
    try {
      const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
      const addWorkHourRequests = [];
      rangeDates?.forEach((date, dateIndex) => {
        addWorkHourRequests[dateIndex] = {
          workDate: date.date,
          staffUserKey: registrantUserKey,
          addEntities: [],
          projectName: projectName || ""
        };
        sourceEntities.forEach((item) => {
          if (item[date.date]?.actWorkHour) {
            const entity = {
              customFieldValue: item.customFieldValue,
              workItemId: item.workItemId,
              workItemEntityId: item.workItemEntityId,
              actWorkHour: item[date.date].actWorkHour,
              workDesc: item[date.date].workDesc,
              workItemName: item.workItemName,
              workItemEntityName: item.workItemEntityName,
              scheduleStart: item.scheduleStart,
              scheduleEnd: item.scheduleEnd,
              estimatedWorkingHoursAll: item.estimatedWorkingHoursAll,
              estimatedWorkingHoursSelf: item.estimatedWorkingHoursSelf,
              workItemType: item.workItemType,
            };
            if (item.workItemEntityName.includes("[已删除]")) {
              entity.workItemEntityName = item.workItemEntityName.includes('[已删除]') ? item.workItemEntityName.replace('[已删除]', '') : item.workItemEntityName
              entity.tag = 0
            }
            const addNodes = [];
            item?.children?.forEach((node) => {
              if (node[date.date]?.actWorkHour) {
                const nodeItem = {
                  nodeId: node.nodeId,
                  nodeName: node.nodeName,
                  actWorkHour: node[date.date]?.actWorkHour,
                  workDesc: node[date.date]?.workDesc,
                  scheduleStart: node.scheduleStart,
                  scheduleEnd: node.scheduleEnd,
                  estimatedWorkingHoursAll: node.estimatedWorkingHoursAll,
                  estimatedWorkingHoursSelf: node.estimatedWorkingHoursSelf,
                };
                if (item.workItemEntityName.includes("[已删除]")) {
                  nodeItem.tag = 0
                }
                if (node.nodeName.includes("[已删除]")) {
                  nodeItem.tag = 0
                }
                nodeItem.nodeName = node.nodeName.includes('[已删除]') ? node.nodeName.replace('[已删除]', '') : node.nodeName
                const addTasks = [];
                node?.children?.forEach((task) => {
                  if (task[date.date]?.actWorkHour) {
                    const taskItem = {
                      taskId: task.taskId,
                      taskName: task.taskName,
                      actWorkHour: task[date.date]?.actWorkHour,
                      workDesc: task[date.date]?.workDesc,
                      scheduleStart: task.scheduleStart,
                      scheduleEnd: task.scheduleEnd,
                      estimatedWorkingHoursAll: task.estimatedWorkingHoursAll,
                      estimatedWorkingHoursSelf: task.estimatedWorkingHoursSelf,
                    };
                    if (node.nodeName.includes("[已删除]")) {
                      taskItem.tag = 0
                    }
                    if (task.taskName.includes("[已删除]")) {
                      taskItem.tag = 0
                    }
                    taskItem.taskName = task.taskName.includes('[已删除]') ? task.taskName.replace('[已删除]', '') : task.taskName
                    addTasks.push(taskItem);
                  }
                });
                nodeItem.addTasks = addTasks;
                addNodes.push(nodeItem);
              }
            });
            entity.addNodes = addNodes;
            addWorkHourRequests[dateIndex].addEntities.push(entity);
          }
        });
      });
      const data = addWorkHourRequests.filter(
        (item) => item.addEntities.length > 0
      );
      if (!data.length) {
        window.JSSDK.toast.warning("登记内容不能为空");
        return;
      }
      let res = {};
      if (props?.openType === "again_launch") {
        res = await postBatchApprovalAgain({
          collectId: props?.batchRegVal?.id,
          addWorkHourBatchReqs: data,
        });
      } else {
        if (props?.type === "tab" && props?.workItemEntityId) {
          data.forEach((item) => {
            item.cachePointEntityId = props?.workItemEntityId
          })
        }
        // const requestData = {
        //   registerData: data,
        // };
        if (props.filterMemoryEnabled === true) {
          const workItemNameMap = new Map(
            sourceEntities.map((item) => [item.workItemId, item.workItemName])
          );
          const optionNameMap = new Map(
            workItemOptions.map((item) => [
              item.value,
              item.label || item.workItemName,
            ])
          );
          const memoryWorkItemIds = workItemIds.map((workItemId) => ({
            workItemId,
            workItemName:
              workItemNameMap.get(workItemId) ||
              optionNameMap.get(workItemId) ||
              "",
          }));
          const workDateTypeValue = resolveWorkDateType(beginWorkDateCP, endWorkDateCP)
          let momery = {
            scheduleStart,
            scheduleEnd,
            beginWorkDate: beginWorkDateCP,
            endWorkDate: endWorkDateCP,
            isPersonInCharge,
            workDateType: workDateTypeValue,    // 0-自定义，1-今天，2-本周，3-上周，4-上个月
            point: props?.type === "tab" ? "tab" : "batch",
            staffUserKey: registrantUserKey,
            queryRegistrationReq: [
              {
                projectKey: sessionStorage.getItem('jwtMeegoTeamworkProjectKey') || '',
                workItemIds: memoryWorkItemIds,
                workItemIdsFilter: workItemIdsFilter.map((item) => ({
                  workItemId: item.workItemId,
                  workItemEntityId: item.workItemEntityId,
                  workItemEntityName: item.workItemEntityName,
                  ...(item.projectKey ? { projectKey: item.projectKey } : {}),
                })),
              },
            ],
          };
          if(data&&data.length>0){
            data[0].momery = momery
          }
        }
        res = await postBatchInsertNodeWorkHourNew(data);
      }
      if (res?.result) {
        localHourCache.current = []
        clearRegisterCache({ "point": point })
        setWorkDate("");
        setTableDataSource([]);
        setWorkInstanceDataSource({});
        setAlertDetail({});
        setAlertDetailOld({});
        props.submitResult(2);
        cacheWorkInstanceDataSourceRef.current = []
        setCacheWorkInstanceDataSource([]);
        setExcludeWorkItemEntityIdListCache([])
        excludeWorkItemEntityIdListCacheRef.current = [];
        setHasCache(false)
        if (props?.type === "tab") {
          getUserActive("TabActBatchRegistrationWorkingHours");
          getSelectWorkInstanceTable(props?.workItemEntityId);
        } else {
          getUserActive("PageActBatchRegistrationWorkingHours");
        }
      }
    } catch (error) {
      console.error("批量登记提交失败:", error);
      window.JSSDK.toast.error("提交失败，请重试");
    } finally {
      props.setSubmitLoadings(false);
    }
  };

  useEffect(() => {
    if (props?.submitLoadings) onBatchSubmit();
  }, [props?.submitLoadings]);
  useEffect(() => {
    if (props?.saveHourLoadings) saveWorkHour()
  }, [props?.saveHourLoadings]);
  /** 展开 */
  const onExpand = (expanded, record) => {
    if (expanded) {
      expandedRowKeys.push(record?.id);
    } else {
      const index = expandedRowKeys.indexOf(record?.id);
      if (index > -1) expandedRowKeys.splice(index, 1);
    }
    setExpandedRowKeys([...expandedRowKeys]);
    if (record?.cache && expanded && record?.refresh === 0) {
      record.refresh = 1;
      getEntityNodeTaskTable({
        nodeId: record.nodeId,
        workItemEntityId: record.workItemEntityId,
        workItemId: record.workItemId,
        registerUserKey: registrantUserKey,
      }, record);
      return
    }
    if (
      !record?.nodeId &&
      !record?.taskId &&
      expanded &&
      !record?.isAdd &&
      !record?.children?.length
    ) {
      getEntityNodeTaskTable({
        nodeId: record.nodeId,
        workItemEntityId: record.workItemEntityId,
        workItemId: record.workItemId,
        registerUserKey: registrantUserKey,
      });
    }
  };

  /** 新增实例联动节点/任务 */
  const onAddWorkItemValuesChange = (values, allValues) => {
    if (values?.workItemEntityId) {
      const data = JSON.parse(values.workItemEntityId);
      getEntityNodeOption({
        workItemId: data.workItemId,
        workItemEntityId: data.value,
      });
    }
  };

  /** 新增实例 */
  const onAddWorkItemFinish = async (values) => {
    setIsAddWorkItemLoading(true);
    setTableLoading(true);
    try {
      const workItem = JSON.parse(values.workItemEntityId);
      const nodeIds = [];
      values?.workItemInstanceIds?.forEach((item) => {
        if (item.length === 1) {
          if (!JSON.stringify(nodeIds).includes(item[0])) {
            nodeIds.push({ nodeId: item[0], taskIds: [] });
          }
        } else if (item.length === 2) {
          if (!JSON.stringify(nodeIds).includes(item[0])) {
            nodeIds.push({ nodeId: item[0], taskIds: [item[1]] });
          } else {
            nodeIds?.forEach((i) => {
              if (i.nodeId === item[0]) {
                i.taskIds.push(item[1]);
              }
            });
          }
        }
      });
      const data = {
        workItemIds: [workItem.workItemId],
        workItemEntityId: workItem.value,
        nodeIds,
        registerUserKey: registrantUserKey,
      };
      if (props?.openType === 'again_launch') {
        data.isLaunchAgain = true
      }
      const res = await postQueryBatch(data);
      if (res?.result) {
        if (!Array.isArray(res?.data?.entities)) {
          console.error("添加已有工作项实例返回的 entities 不是数组:", res?.data?.entities);
          window.JSSDK.toast.error("工作项实例数据格式异常");
          return;
        }
        const responseEntities = res.data.entities;
        let leftBottomAddworkItemIds = {
          workItemIds: workItem.workItemId,
          workItemEntityId: workItem.value,
          nodeIds,
        }
        if (addExtraRef.current.length > 0) {
          if (!addExtraRef.current.includes(data.workItemEntityId)) {
            addExtraRef.current.push(data.workItemEntityId)
          }
        } else {
          addExtraRef.current.push(data.workItemEntityId)
        }
        if (responseEntities.length) {
          // 判断workItemEntityId是否已存在，实现去重
          const isExists = filterRegistrationRef.current.some(item => item.workItemEntityId === leftBottomAddworkItemIds.workItemEntityId && item.workItemId === leftBottomAddworkItemIds.workItemIds);
          if (!isExists) {
            let entitiesData = JSON.parse(JSON.stringify(responseEntities))
            let matchedItems = findMatchingItems(entitiesData, leftBottomAddworkItemIds)
            filterRegistrationRef.current.push(...matchedItems)
          }
        }
        responseEntities.forEach((item) => {
          item.isAdd = true;
        });
        setTableAddDataSource([
          ...(Array.isArray(tableAddDataSource) ? tableAddDataSource : []),
          ...responseEntities,
        ]);
        const dataSource = {
          ...JSON.parse(JSON.stringify(res.data)),
          entities: JSON.parse(JSON.stringify(responseEntities)),
        };
        dataSource.entities.forEach((item) => {
          traverseTreeRecursively(item);
        });

        const entities = [
          ...(Array.isArray(workInstanceDataSource?.entities) ? workInstanceDataSource.entities : []),
          ...dataSource.entities,
        ];

        // 使用 Map 去重
        const seen = new Map();
        const uniqueEntities = entities.filter(
          (item) => !seen.has(item.id) && seen.set(item.id, true)
        );
        handleExpandLevelChange(expandLevel, uniqueEntities, '', 1)
        setWorkInstanceDataSource({
          ...workInstanceDataSource,
          entities: uniqueEntities,
        });
        setIsAddWorkItemOpen(false);
      }
    } catch (error) {
      console.error("添加已有工作项实例失败:", error);
      window.JSSDK.toast.error("添加失败，请重试");
    } finally {
      setNodeTaskOptions([]);
      setIsAddWorkItemLoading(false);
      if (batchTableRenderPendingRef.current === null) {
        setTableLoading(false);
      }
    }
  };

  const loadData = async (page = 1) => {
    const currentRequest = ++requestId.current;
    setLoading(true);

    try {
      const { list, total } = await fetchData({
        page,
        size: pageSize,
      });

      if (currentRequest !== requestId.current) return;

      setData((prev) => (page === 1 ? list : [...prev, ...list]));
      setHasMore(data.length + list.length < total);
    } finally {
      setLoading(false);
    }
  };

  /** 刷新始数据的弹窗 */
  const traverseTreeRefresh = (node) => {
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    rangeDates?.forEach((date) => {
      const key = date.date;
      if (node[key]) node[key].isRegFormOpen = false;
    });
    if (node?.children && node?.children?.length > 0) {
      node?.children?.forEach((child) => {
        traverseTreeRefresh(child);
      });
    }
  };

  const handleRefreshScroll = debounce((e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollTop && props?.type !== "tab" && !tableLoading) {
      workInstanceDataSource?.entities?.forEach((item) => {
        traverseTreeRefresh(item);
      });
      if (workInstanceDataSource?.entities)
        setWorkInstanceDataSource({ ...workInstanceDataSource });
    }
  }, 300);

  const handleScroll = debounce((e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.target;
    if (scrollTop === 0) return;
    if (scrollHeight - scrollTop <= clientHeight + 5 && hasMore && !loading) {
      setInvoke(true);
      setWorkInstancePagination((prev) => ({
        ...prev,
        pageNum: prev.pageNum + 1,
      }));
    }
  }, 300);

  useEffect(() => {
    const tableBody = tableRef.current?.querySelector(".ant-table-body");
    if (tableBody) {
      tableBody.addEventListener("scroll", handleScroll);
      return () => {
        if (tableBody) tableBody.removeEventListener("scroll", handleScroll);
      };
    }
  }, [hasMore, loading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const tableBody = tableRef.current?.querySelector(".ant-table-body"); // 可能需要根据antd版本调整选择器
      if (tableBody) {
        tableBody.scrollLeft = 0;
      }
    }, 0); // 使用setTimeout将恢复滚动位置的操作放入事件循环的下一个tick中执行
    return () => clearTimeout(timer);
  }, [regTableColumns]);
  const lastOptionsRequestIdRef = useRef(null);
  const fetchOptions = (params) => {
    const requestId = Date.now();
    lastOptionsRequestIdRef.current = requestId;
    params.userKey = registrantUserKey;
    if (
      !params?.workItemEntityName ||
      lastOptionsRequestIdRef.current !== requestId
    )
      return { data: { data: [], total: 0 } };
    return postItemEntityOptionNew(params).then((res) => {
      if (Array.isArray(res?.data?.data) && res?.data?.data?.length > 0) {
        res.data.data = res.data.data.filter(item => item.canRegister !== false);
      }
      const results = Array.isArray(res?.data?.data) ? res?.data?.data : [];
      return res;
    });
  };
  const fetchOptions2 = (params) => {
    const requestId = Date.now();
    lastOptionsRequestIdRef.current = requestId;
    params.userKey = registrantUserKey;
    if (
      !params?.workItemEntityName ||
      lastOptionsRequestIdRef.current !== requestId
    )
      return { data: { data: [], total: 0 } };
    return postItemEntityOptionNew(params).then((res) => {
      if (Array.isArray(res?.data?.data) && res?.data?.data?.length > 0) {
        res.data.data = res.data.data.filter(item => item.canRegister !== false);
      }
      const results = Array.isArray(res?.data?.data) ? res?.data?.data : [];
      return res;
    });
  };
  const updateEditDataRef = useRef(updateEditData);
  useEffect(() => {
    updateEditDataRef.current = updateEditData;
  }, [updateEditData]);
  // useEffect(() => {
  //   console.log("updateEditData 已更新:", updateEditData);
  // }, [updateEditData]);
  /** 工作项改变 */
  // 修改 onWorkItemChange 函数，处理新增后的取消操作
  const onWorkItemChange = useCallback(
    debounce(() => {
      if (!isWorkItemChanged) return;
      setIsWorkItemChanged(false);

      // 检查是否已经有 Modal 显示
      if (modalLockRef.current || isModalVisible) {
        return;
      }

      const isHasContent = checkWorkInstanceDataSource();

      // 在弹出确认框前保存当前值
      setPreviousWorkItemIds([...workItemIds]);
      setPreviousWorkItemEntityIds([...workItemEntityIds]);
      setPreviousWorkItemIdsFilter([...workItemIdsFilter]);

      if (isHasContent) {
        if (document.querySelector('.ant-modal-confirm')) {
          return;
        }

        // 设置锁
        modalLockRef.current = true;
        setIsModalVisible(true);
        Modal.confirm({
          title: "确认修改",
          icon: <ExclamationCircleFilled />,
          content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            await querySaveWorkHour(-1)
            setInvoke(true);
            // 解锁
            modalLockRef.current = false;
            setIsModalVisible(false);
            //setInvoke(true);
            addExtraRef.current = []
            filterRegistrationRef.current = [];
            setCacheWorkInstanceDataSource([]);
            setExcludeWorkItemEntityIdListCache([])
            excludeWorkItemEntityIdListCacheRef.current = [];
            setEditData([]);
            setUpdateEditData([]);

            if (props?.openType === "again_launch") {
              let filteredUpdateEditData = updateEditDataRef.current.filter(record =>
                workItemIds.includes(record.workItemId)
              );

              const validEntityIds = new Set();
              workItemEntityIdsRef.current.forEach(item => {
                try {
                  const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                  validEntityIds.add(parsed.value);
                } catch (error) {
                  console.error("解析 workItemEntityIds 失败:", error);
                }
              });

              filteredUpdateEditData = filteredUpdateEditData.filter(item => {
                const isValidEntity = validEntityIds.has(item.workItemEntityId);
                return isValidEntity;
              });
              setUpdateEditData(filteredUpdateEditData);
            }

            setSearchWorkItemIds(workItemIds);
            setSearchWorkItemEntityIds(workItemEntityIds);
            setExpandedRowKeys([]);
            setTableDataSource([]);
            setWorkInstanceDataSource({});
            if (workInstancePagination.pageNum !== 1) {
              setWorkInstancePagination((prev) => ({
                ...prev,
                pageNum: 1,
              }));
            } else {
              getSelectWorkInstanceTable();
            }

            // 清空新增前的状态
            beforeAddWorkItemIdsRef.current = [];
          },
          onCancel() {
            // 解锁
            modalLockRef.current = false;
            setIsModalVisible(false);
            // 检查是否是新增操作，如果是则恢复到新增前的状态
            if (beforeAddWorkItemIdsRef.current.length > 0) {
              setWorkItemIds(beforeAddWorkItemIdsRef.current);
              // 同时更新搜索状态
              setSearchWorkItemIds(beforeAddWorkItemIdsRef.current);
              // 清空新增前的状态
              const originalData = beforeWorkItemIdsFilterRef.current
              const transformedData = originalData.map(item => {
                return JSON.stringify({
                  workItemId: item.workItemId,
                  label: item.workItemEntityName,  // 对应原数据的 workItemEntityName
                  value: item.workItemEntityId     // 对应原数据的 workItemEntityId
                });
              });
              setWorkItemEntityIds(transformedData);
            } else {
              const originalData = beforeWorkItemIdsFilterRef.current
              const transformedData = originalData.map(item => {
                return JSON.stringify({
                  workItemId: item.workItemId,
                  label: item.workItemEntityName,  // 对应原数据的 workItemEntityName
                  value: item.workItemEntityId     // 对应原数据的 workItemEntityId
                });
              });
              setWorkItemEntityIds(transformedData);
              // 否则恢复到之前的状态
              setWorkItemIds(previousWorkItemIds);
              setWorkItemEntityIds(previousWorkItemEntityIds);
              setWorkItemIdsFilter(previousWorkItemIdsFilter);
              // 更新搜索状态
              setSearchWorkItemIds(previousWorkItemIds);
              setSearchWorkItemEntityIds(previousWorkItemEntityIds);
            }
          },
          afterClose: () => {
            // 确保在 Modal 关闭后解锁
            modalLockRef.current = false;
            setIsModalVisible(false);
          }
        });
        return;
      }
      setInvoke(true);
      // 如果没有内容，正常执行后续逻辑
      editDataRef.current = [];
      localHourCache.current = [];
      addExtraRef.current = []
      filterRegistrationRef.current = [];
      setExpandedRowKeys([]);
      setTableDataSource([]);
      setWorkInstanceDataSource({});
      setSearchWorkItemIds(workItemIds);
      setSearchWorkItemEntityIds(workItemEntityIds);

      if (workInstancePagination.pageNum !== 1) {
       // console.log('工作项',workInstancePagination.pageNum);
        setWorkInstancePagination((prev) => ({
          ...prev,
          pageNum: 1,
        }));
      } else {
        //console.log('工作项',workInstancePagination.pageNum);
        getSelectWorkInstanceTable();
      }

      // 清空新增前的状态
      //beforeAddWorkItemIdsRef.current = [];
    }, 300),
    [
      workItemIds,
      workItemEntityIds,
      workItemIdsFilter,
      workInstancePagination.pageNum,
      getSelectWorkInstanceTable,
      isWorkItemChanged,
      previousWorkItemIds,
      previousWorkItemEntityIds,
      previousWorkItemIdsFilter,
      isModalVisible
    ]
  );

  useEffect(() => {
    if (isOnDeselect) {
      onWorkItemChange();
      setIsOnDeselect(false);
    }
  }, [isOnDeselect, onWorkItemChange]);

  /** 手动删除工作项类型 */
  // 修改工作项类型删除处理函数
  // 修改删除处理函数，确保在删除时清空新增前的状态
  const debouncedWorkItemDeselect = useCallback(
    debounce((delVal) => {
      // 如果有 Modal 正在显示，不执行删除操作
      if (modalLockRef.current || isModalVisible) {
        return;
      }

      // 删除前清空新增前的状态
      //beforeAddWorkItemIdsRef.current = [];

      // 删除前保存当前状态
      setPreviousWorkItemIds([...workItemIds]);
      setPreviousWorkItemEntityIds([...workItemEntityIds]);
      setPreviousWorkItemIdsFilter([...workItemIdsFilter]);

      setSearchWorkItemIds((prevIds) =>
        prevIds.includes(delVal) ? prevIds : [...prevIds, delVal]
      );

      setWorkItemIds((prev) => prev.filter((id) => id !== delVal));
      setWorkItemIdsFilter((prevFilter) =>
        prevFilter.filter((item) => item.workItemId !== delVal)
      );
      setIsOnDeselect(true);
      setIsWorkItemChanged(true);
    }, 800),
    [workItemIds, workItemEntityIds, workItemIdsFilter, isModalVisible]
  );
  // useEffect(() => {
  //   console.log('JSON.stringify(earchWorkItemEntityIds)',JSON.stringify(searchWorkItemEntityIds));
  // },[JSON.stringify(searchWorkItemEntityIds)])
  /** 手动删除工作项实例 */
  const debouncedWorkItemEntityDeselect = useCallback(
    debounce((delVal) => {
      // 如果有 Modal 正在显示，不执行删除操作
      if (modalLockRef.current || isModalVisible) {
        return;
      }
      // 删除前保存当前状态
      setPreviousWorkItemIds([...workItemIds]);
      setPreviousWorkItemEntityIds([...workItemEntityIds]);
      setPreviousWorkItemIdsFilter([...workItemIdsFilter]);

      setSearchWorkItemEntityIds((prev) =>
        prev.includes(delVal) ? prev : [...prev, delVal]
      );

      try {
        const parsedDelVal = JSON.parse(delVal);
        setWorkItemIdsFilter((prevFilter) =>
          prevFilter.filter(
            (item) =>
              item.workItemEntityId + item.workItemId !==
              parsedDelVal.value + parsedDelVal.workItemId
          )
        );
      } catch (error) {
        console.error("解析 delVal 失败:", error);
      }

      setIsOnDeselect(true);
      setIsWorkItemChanged(true);
    }, 800),
    [workItemIds, workItemEntityIds, workItemIdsFilter]
  );
  // 替换原 toggleExpandPopover 方法
  const onVisibleChange = (visible) => {
    setExpandPopoverVisible(visible);
  };
  const mergeWorkItemTrees = (arr1, arr2) => {
    // 创建一个映射，用于快速查找arr1中的工作项
    const arr1WorkItemMap = new Map();

    // 递归收集所有节点的ID到映射
    const collectAllNodes = (items, map, isArr1 = true) => {
      if (!Array.isArray(items)) return;

      items.forEach(item => {
        // 生成唯一键
        let key;
        if (item.workItemEntityId) {
          key = `workItem_${item.workItemEntityId}`;
          if (isArr1) {
            map.set(key, item);
          }
        }

        // 递归处理子节点
        if (item.children && Array.isArray(item.children)) {
          collectAllNodes(item.children, map, isArr1);
        }
      });
    };

    // 收集arr1的所有节点
    collectAllNodes(arr1, arr1WorkItemMap, true);

    // 收集arr2的所有节点（但不添加到映射，只用于参考）
    const arr2AllNodes = [];
    collectAllNodes(arr2, new Map(), false);

    // 深度合并函数
    const deepMerge = (target, source) => {
      // 合并节点基本信息
      const result = { ...target };

      // 复制source中的所有属性到target（除了children）
      Object.keys(source).forEach(key => {
        if (key !== 'children' && key !== 'workItemEntityId' && key !== 'nodeId' && key !== 'taskId') {
          if (source[key] !== undefined && source[key] !== null) {
            // 对于排期等字段，如果target中没有，就用source的
            if (!result[key] || result[key] === null) {
              result[key] = source[key];
            }
          }
        }
      });

      // 处理children
      if (source.children && Array.isArray(source.children)) {
        if (!result.children) {
          result.children = [];
        }

        // 合并子节点
        source.children.forEach(sourceChild => {
          // 在target的children中查找匹配的节点
          let targetChild = null;
          let targetIndex = -1;

          // 根据节点类型使用不同的标识
          if (sourceChild.taskId) {
            // 任务节点
            targetIndex = result.children.findIndex(
              child => child.taskId === sourceChild.taskId
            );
          } else if (sourceChild.nodeId) {
            // 节点
            targetIndex = result.children.findIndex(
              child => child.nodeId === sourceChild.nodeId
            );
          } else if (sourceChild.workItemEntityId) {
            // 工作项实例（不应该出现在children中，但为了安全考虑）
            targetIndex = result.children.findIndex(
              child => child.workItemEntityId === sourceChild.workItemEntityId
            );
          }

          if (targetIndex >= 0) {
            // 递归合并
            result.children[targetIndex] = deepMerge(
              result.children[targetIndex],
              sourceChild
            );
          } else {
            // 添加新节点
            const newChild = convertToArr1Format(sourceChild);

            // 如果当前是工作项级别，需要确保workItemId传递下去
            if (result.workItemId && !newChild.workItemId) {
              newChild.workItemId = result.workItemId;
            }

            // 如果当前是工作项实例级别，需要确保workItemEntityId传递下去
            if (result.workItemEntityId && !newChild.workItemEntityId) {
              newChild.workItemEntityId = result.workItemEntityId;
            }

            // 如果当前是节点级别，需要确保nodeId传递下去
            if (result.nodeId && !newChild.nodeId) {
              newChild.nodeId = result.nodeId;
            }

            result.children.push(newChild);
          }
        });
      }

      return result;
    };

    // 遍历arr2，合并到arr1
    arr2.forEach(item2 => {
      const workItemEntityId = item2.workItemEntityId;
      const key = `workItem_${workItemEntityId}`;

      // 查找arr1中是否有相同的工作项
      const existingItemIndex = arr1.findIndex(
        item => item.workItemEntityId === workItemEntityId
      );

      if (existingItemIndex >= 0) {
        // 合并现有工作项
        arr1[existingItemIndex] = deepMerge(arr1[existingItemIndex], item2);
      } else {
        // 添加新工作项
        const newItem = convertToArr1Format(item2);
        arr1.push(newItem);
      }
    });

    return arr1;
  };

  // 增强的转换函数
  const convertToArr1Format = (item) => {
    // 创建新对象
    const newItem = {
      ...item,
      id: generateId(item),
      // 基础字段
      dayUp: capacitySet?.dayUp || 24,
      onceDown: capacitySet?.onceDown || 0.1,
      // 初始化其他必要字段
      pattern: item.pattern || null,
      newPattern: item.newPattern || null,
      canRegister: item.canRegister !== undefined ? item.canRegister : true,
      canNotRegisterReason: item.canNotRegisterReason || null,
      status: item.status || null,
      workItemType: item.workItemType || 'workflow'
    };

    // 添加日期字段
    addDateFields(newItem);

    // 确保id字段存在
    if (!newItem.id) {
      newItem.id = generateId(newItem);
    }

    // 处理子节点
    if (item.children && Array.isArray(item.children)) {
      newItem.children = item.children.map(child => {
        // 确保子节点继承父节点的关键信息
        const convertedChild = convertToArr1Format({
          ...child,
          workItemId: child.workItemId || item.workItemId || newItem.workItemId,
          workItemEntityId: child.workItemEntityId || item.workItemEntityId || newItem.workItemEntityId,
          nodeId: child.nodeId || item.nodeId || newItem.nodeId
        });

        // 确保子节点的id正确生成
        convertedChild.id = generateId(convertedChild);

        return convertedChild;
      });

      // 如果children是空数组，保持为空数组
      if (newItem.children.length === 0) {
        newItem.children = [];
      }
    } else {
      newItem.children = item.children; // 保持为null或undefined
    }

    return newItem;
  };

  // 生成ID函数
  const generateId = (item) => {
    if (item.id) return item.id;

    if (item.taskId) {
      return `${item.workItemId || ''}-${item.workItemEntityId || ''}-${item.nodeId || ''}-${item.taskId}`;
    } else if (item.nodeId) {
      return `${item.workItemId || ''}-${item.workItemEntityId || ''}-${item.nodeId}-null`;
    } else if (item.workItemEntityId) {
      return `${item.workItemId || ''}-${item.workItemEntityId}-null-null`;
    }

    // 默认生成一个随机ID作为fallback
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // 添加日期字段函数
  const addDateFields = (item) => {
    const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);
    rangeDates?.forEach(({ date }) => {
      // 如果已经有这个日期字段，保持原值
      if (!item[date]) {
        item[date] = {
          realActWorkHour: null,
          actWorkHour: null,
          workDesc: null,
          isRegFormOpen: false,
        };
      }
    });
  };
  const copyDateFields = (source, target) => {
    // 复制日期字段从源对象到目标对象
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    Object.keys(source).forEach(key => {
      if (datePattern.test(key) && source[key] && typeof source[key] === 'object') {
        target[key] = { ...source[key] };
      }
    });

    // 同时复制其他相关字段
    if (source.date) target.date = source.date;
    if (source.dayOfWeek) target.dayOfWeek = source.dayOfWeek;
    if (source.index !== undefined) target.index = source.index;
  }
  // 处理层级选择时，手动关闭 Popover
  const handleExpandLevelSelect = async (level) => {
    if (level == expandLevel) {
      setExpandPopoverVisible(false)
      return
    }
    if (level == 1) {
      setExpandedRowKeys([])
      setExpandPopoverVisible(false)
      setExpandLevel(level)
      return
    }
    let registerList = workInstanceDataSourceRef.current?.entities || []
    if (registerList?.length) {
      // 检查是否有任务数据
      // const hasTaskData = registerList.some(item => 
      //   item.children && item.children.length > 0
      // );
      const hasTaskData = false
      // 如果有任务数据，就不调用接口
      if (!hasTaskData) {
        let workItemsList = []
        registerList.forEach((i) => {
          if (props.type == 'tab') {
            workItemsList.push({
              "workItemId": i.workItemId,
              "workItemEntityId": i.workItemEntityId,
              "workItemEntityName": i.workItemEntityName,
              "workItemType": i.newPattern
            })
          } else {
            if (i.pattern == 'Node' || i.newPattern == 'Node') {
              workItemsList.push({
                "workItemId": i.workItemId,
                "workItemEntityId": i.workItemEntityId,
                "workItemEntityName": i.workItemEntityName,
                "workItemType": i.pattern || i.newPattern
              })
            }
          }
        })
        if (workItemsList?.length == 0) {
          if (batchTableRenderPendingRef.current === null) {
            setTableLoading(false);
          }
          setExpandPopoverVisible(false)
          setExpandLevel(level)
          return
        }
        const data = {
          registerUserKey: registrantUserKey,
          scheduleEnd: scheduleEnd,
          scheduleStart: scheduleStart,
          workItems: workItemsList
        }
        if (isPersonInCharge === 0) {
          data.personInCharge = registrantUserKey;
        }
        if (addExtraRef.current?.length) {
          data.addExtra = addExtraRef.current
        }
        if (filterRegistrationRef.current?.length) {
          data.addExtraEntities = {
            entities: filterRegistrationRef.current
          }
        }
        setTableLoading(true);
        const res = await queryExpandLevelNode(data)
        if (res?.result) {
          const registerDataSource = JSON.parse(JSON.stringify(workInstanceDataSource?.entities));
          let mergedArr = mergeWorkItemTrees(registerDataSource, res?.data);
          // 对mergedArr中所有层级的重复项进行去重处理
          const deduplicateArray = (items) => {
            if (!Array.isArray(items)) return items;

            const processedItems = [];
            const uniqueKeys = new Set();

            const processItem = (item) => {
              if (!item || typeof item !== 'object') return item;

              // 为每个对象生成唯一标识键
              const objectKey = item.id || Object.keys(item).sort().map(key => `${key}:${JSON.stringify(item[key])}`).join('|');

              // 如果已经处理过相同的对象，跳过
              if (uniqueKeys.has(objectKey)) return null;
              uniqueKeys.add(objectKey);

              // 创建新对象，递归处理所有属性
              const newItem = { ...item };

              // 处理children属性（数组类型）
              if (Array.isArray(item.children)) {
                newItem.children = [];
                item.children.forEach(child => {
                  const processedChild = processItem(child);
                  if (processedChild) {
                    newItem.children.push(processedChild);
                  }
                });
                // 如果children为空数组，保持为空数组
                if (newItem.children.length === 0) {
                  newItem.children = [];
                }
              }

              return newItem;
            };

            // 处理顶层数组中的每个项
            items.forEach(item => {
              const processedItem = processItem(item);
              if (processedItem) {
                processedItems.push(processedItem);
              }
            });

            return processedItems;
          };

          // 执行去重处理
          mergedArr = deduplicateArray(mergedArr);
          setWorkInstanceDataSource({
            ...workInstanceDataSource,
            entities: mergedArr,
          });
          handleExpandLevelChange(level, mergedArr)
        }
        if (batchTableRenderPendingRef.current === null) {
          setTableLoading(false);
        }
      } else {
        // 如果有任务数据，直接处理展开级别
        handleExpandLevelChange(level, registerList)
      }
    }
    setExpandPopoverVisible(false)
    setExpandLevel(level)
  };
  const tableScrollHeight = props.type === "tab" ? 280 : 280;
  return (
    <Spin
      spinning={tableLoading2 || attendanceSyncing}
      // tip={attendanceSyncing ? "同步考勤中..." : undefined}
    >
      <div className={`regWorkHourBatchNew-warp ${props.type === "tab" ? "" : "regWorkHourBatchNew-warp-no-tab"}`}>
        <div className="regWorkHourBatchNew-header">
          {/* {props.type !== "tab" && props.openType !== "again_launch" && <Button className="save-btn" loading={saveHourLoadings} onClick={() => { saveWorkHour() }}>
          保存
        </Button>} */}
          <div className={`batch-filter-grid ${props.type === "tab" ? "is-tab" : ""}`}>
          <Space className="header-box batch-filter-item batch-filter-member">
            <span className="batch-filter-title">当前登记工时成员</span>
            <UserPicker
              size="small"
              loginUser={props?.loginUser}
              registrantUserKey={props?.loginUser?.id}
              disabled={
                loading ||
                loading ||
                tableLoading ||
                !isAllowRegister ||
                !canShowTenantAdminFeature()
                || registerCacheLoading
              }
              value={registrantUserKey}
              allowClear={
                props?.loginUser?.id === registrantUserKey ? false : true
              }
              getUserIds={onSearchPersonChange}
              getPickerUser={(val) => { 
                setPickerUser(val); 
              }}
            />
          </Space>
          {props.type === "tab" ? (
            <br />
          ) : (
            <>
              <br />
              <Space className="header-box batch-filter-item batch-filter-work-type">
                <span className="batch-filter-title title">选择工作项类型</span>
                <Select
                  mode="multiple"
                  value={workItemIds}
                  // 禁用内联搜索，只用下拉顶部内嵌搜索框
                  showSearch={false}
                  // 注：Web 端 rc-select@14.16.6 不支持 popupRender/onOpenChange 新 API，用旧名
                  onDropdownVisibleChange={(open) => {
                    // 收起时清空搜索词，下次打开恢复完整列表
                    if (!open) setWorkItemSearch("");
                  }}
                  dropdownRender={(menu) => (
                    <>
                      <div style={{ padding: "8px 8px 4px", borderBottom: "1px solid #f0f0f0" }}>
                        <Input
                          size="small"
                          allowClear
                          placeholder="搜索"
                          prefix={<SearchOutlined />}
                          value={workItemSearch}
                          onChange={(e) => setWorkItemSearch(e.target.value)}
                          // 阻止冒泡：点搜索框不关闭下拉
                          onMouseDown={(e) => e.stopPropagation()}
                          // 阻止键盘事件冒泡给 Select（Portal 沿组件树冒泡），
                          // 避免 Backspace/Enter 被 rc-select 拦截误删已选工作项
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      </div>
                      {menu}
                    </>
                  )}
                  onChange={(val) => {
                    // 如果有 Modal 正在显示，不执行变更操作
                    if (modalLockRef.current || isModalVisible) {
                      return;
                    }

                    // // 在更新状态前，先保存当前的状态（即更新前的状态）
                    // const currentWorkItemIds = [...workItemIds];

                    // // 判断是否是新增操作（val 的长度比当前 workItemIds 长）
                    // if (val.length > workItemIds.length) {
                    //   // 这是新增操作，保存之前的状态到 ref
                    //   beforeAddWorkItemIdsRef.current = currentWorkItemIds;
                    //   console.log('新增操作，保存之前的状态:', currentWorkItemIds);
                    // }

                    // // 变更前保存当前状态到 previous 状态
                    // setPreviousWorkItemIds(currentWorkItemIds);
                    // setPreviousWorkItemEntityIds([...workItemEntityIds]);
                    // setPreviousWorkItemIdsFilter([...workItemIdsFilter]);
                    const isHasContent = checkWorkInstanceDataSource();
                    if (!isHasContent) {
                      setExcludeWorkItemEntityIdListCache([]);
                      excludeWorkItemEntityIdListCacheRef.current = [];
                      cacheWorkInstanceDataSourceRef.current = [];
                    }
                    setHasCache(false)
                    setIsWorkItemChanged(true);
                    setWorkItemIds(val);
                    setSearchWorkItemIds(val);
                    setSearchWorkItemEntityIds(workItemEntityIds);
                  }}
                  onBlur={onWorkItemChange}
                  size="small"
                  options={filteredWorkItemOptions}
                  maxTagCount="responsive"
                  maxTagPlaceholder={(omittedValues) => (
                    <Tooltip
                      title={
                        <div
                          style={{
                            maxWidth: "300px",
                            maxHeight: "200px",
                            overflow: "auto",
                            padding: "4px 0",
                          }}
                        >
                          {omittedValues.map((item, index) => (
                            <div key={index} style={{ padding: '2px 8px' }}>{item.label}</div>
                          ))}
                        </div>
                      }
                    >
                      <span>+{omittedValues?.length}</span>
                    </Tooltip>
                  )}
                  disabled={loading || tableLoading || isModalVisible || registerCacheLoading}
                  onDeselect={debouncedWorkItemDeselect}
                  filterOption={(input, option) => {
                    var _a;
                    return (
                      (_a = option?.label) !== null && _a !== void 0
                        ? _a
                        : ""
                    )
                      .toLowerCase()
                      .includes(input.toLowerCase());
                  }}
                />
              </Space>
              <br />
              <Space className="header-box batch-filter-item batch-filter-instance">
                <span className="batch-filter-title">工作项实例</span>
                <SmartSelect
                  type="search"
                  size="small"
                  mode="multiple"
                  workItemIds={workItemIds}
                  workItemEntityIds={workItemEntityIds}
                  isCustomFieldEnabled={isCustomFieldEnabled}
                  workItemEntityCustomFieldValues={workItemEntityCustomFieldValues}
                  disabled={loading || !workItemIds?.length || tableLoading || registerCacheLoading}
                  fetchOptions={fetchOptions}
                  onChange={(val) => {
                    if (!val?.length) {
                      setUpdateEditData([]);
                    }
                    setHasCache(false)
                    // 过滤掉label包含[已删除]的数据
                    // const filteredApprovalRecords = updateEditData.filter(record => {
                    //   const found = val.find(item => {
                    //     const parsed = JSON.parse(item);
                    //     return parsed.value === record.workItemEntityId && !parsed.label.includes('[已删除]');
                    //   });
                    //   return found !== undefined;
                    // });
                    // console.log("filteredApprovalRecords", filteredApprovalRecords);
                    //setUpdateEditData(JSON.parse(JSON.stringify(filteredApprovalRecords)))
                    setIsWorkItemChanged(true);
                    setWorkItemEntityIds(val);
                    setSearchWorkItemEntityIds(val);
                    setSearchWorkItemIds(workItemIds);
                  }}
                  getWorkItemIdsFilter={(val) => {
                    const customFieldValues = {};
                    const valArr = val.map((item) => {
                      const parsedItem = JSON.parse(item.value);
                      customFieldValues[
                        getWorkItemEntityOptionKey(parsedItem?.workItemId, parsedItem?.value)
                      ] = item.customFieldValue;
                      return {
                        workItemId: parsedItem?.workItemId,
                        workItemEntityId: parsedItem?.value,
                        workItemEntityName: parsedItem?.label,
                      };
                    });
                    setWorkItemEntityCustomFieldValues((prev) => ({
                      ...prev,
                      ...customFieldValues,
                    }));
                    setIsWorkItemChanged(true);
                    setWorkItemIdsFilter(valArr);
                    setWorkItemEntityIds(val.map((item) => item.value));
                    setSearchWorkItemEntityIds(val.map((item) => item.value));
                  }}
                  placeholder={
                    !workItemIds?.length
                      ? "请先选择工作项类型"
                      : "请搜索选择工作项实例"
                  }
                  onBlur={onWorkItemChange}
                  onDeselect={debouncedWorkItemEntityDeselect}
                  maxTagCount="responsive"
                  maxTagPlaceholder={(omittedValues) => (
                    <Tooltip
                      styles={{ root: { pointerEvents: "none" } }}
                      title={omittedValues.map(({ label }) => label).join("，")}
                    >
                      <span>
                        +{omittedValues?.length ? omittedValues?.length : ""}
                      </span>
                    </Tooltip>
                  )}
                />
              </Space>
              <br />
            </>
          )}
          <Space className="header-box batch-filter-item batch-filter-work-date">
            <div className="batch-filter-label">
              <span>填报工作日期</span>
              <Tooltip
                placement="bottom"
                title="按实际发生工作时间的日期筛选登记日期范围"
              >
                <InfoCircleFilled className="des-icon" />
              </Tooltip>
            </div>
            <div className="batch-date-filter-controls">
              <RangePicker
              size="small"
              allowClear={false}
              disabled={loading || tableLoading || registerCacheLoading}
              className="top-item time-picker batch-date-picker"
              onChange={onWorkDateChange}
              disabledDate={isWorkDateDisabled}
              value={
                beginWorkDateCP && endWorkDateCP
                  ? [dayjs(beginWorkDateCP), dayjs(endWorkDateCP)]
                  : []
              }
              />
              <Radio.Group
              value={`${beginWorkDate}~${endWorkDate}`}
              size="small"
              onChange={onWorkDateBtnChange}
              disabled={loading || tableLoading || registerCacheLoading}
            >
              <Radio.Button
                value={`${dayjs(new Date()).format("YYYY-MM-DD")}~${dayjs(
                  new Date()
                ).format("YYYY-MM-DD")}`}
              >
                今天
              </Radio.Button>
              <Radio.Button
                value={`${getWeekStartAndEnd().Monday}~${getWeekStartAndEnd().Sunday
                  }`}
              >
                本周
              </Radio.Button>
              <Radio.Button
                value={`${getLastWeekRange().Monday}~${getLastWeekRange().Sunday
                  }`}
              >
                上周
              </Radio.Button>
              <Radio.Button
                value={`${getLastMonthRange().start}~${getLastMonthRange().end}`}
              >
                上个月
              </Radio.Button>
              </Radio.Group>
            </div>
          </Space>
          <br />
          <Space className="header-box batch-filter-item batch-filter-schedule">
            <div className="batch-filter-label">
              <span>按项目排期筛选</span>
              <Tooltip placement="bottom" title="按登记对象所处的项目排期进行筛选">
                <InfoCircleFilled className="des-icon" />
              </Tooltip>
            </div>

            <RangePicker
              size="small"
              allowClear
              disabled={loading || tableLoading || registerCacheLoading}
              className="top-item time-picker batch-date-picker"
              presets={rangePresets}
              value={
                scheduleStart && scheduleEnd
                  ? [dayjs(scheduleStart), dayjs(scheduleEnd)]
                  : []
              }
              onChange={onScheduleChange}
            />
          </Space>
          <br />
          <Space className="header-box batch-filter-item batch-filter-responsible">
            <span className="batch-filter-title">按登记对象负责人筛选</span>
            {showResponsibleFilter && (<Radio.Group
              disabled={loading || tableLoading || registerCacheLoading}
              onChange={(val) => {
                setHasCache(false);
                //setInvoke(true);
                const isHasContent = checkWorkInstanceDataSource();
                if (isHasContent) {
                  Modal.confirm({
                    title: "确认修改",
                    icon: <ExclamationCircleFilled />,
                    content: "修改后，之前填写的工时及工作描述会保留到匹配到的登记对象中；若刷新后没有对应的登记对象，相关数据将被删除。",
                    closeIcon: <CloseOutlined />,
                    okText: "确定",
                    cancelText: "取消",
                    async onOk() {
                      localHourCache.current = []
                      await querySaveWorkHour(-1)
                      setInvoke(true);
                      addExtraRef.current = [];
                      filterRegistrationRef.current = [];
                      setCacheWorkInstanceDataSource([]);
                      setExcludeWorkItemEntityIdListCache([])
                      excludeWorkItemEntityIdListCacheRef.current = [];
                      setEditData([]);
                      setExpandedRowKeys([]);
                      setTableDataSource([]);
                      setWorkInstanceDataSource({});
                      setWorkInstancePagination({
                        ...workInstancePagination,
                        pageNum: 1,
                      });
                      setIsPersonInCharge(val.target.value);
                    },
                    onCancel() {
                      // window.JSSDK.toast.success('操作成功');
                    },
                  });
                  return;
                } else {
                  localHourCache.current = []
                  setInvoke(true);
                }
                localHourCache.current = [];
                addExtraRef.current = [];
                filterRegistrationRef.current = [];
                setCacheWorkInstanceDataSource([]);
                setExcludeWorkItemEntityIdListCache([])
                excludeWorkItemEntityIdListCacheRef.current = [];
                setExpandedRowKeys([]);
                setTableDataSource([]);
                setWorkInstanceDataSource({});
                setHasMore(false);
                setWorkInstancePagination({
                  ...workInstancePagination,
                  pageNum: 1,
                });
                setIsPersonInCharge(val.target.value);
              }}
              value={isPersonInCharge}
              options={
                showAllResponsibleOptions === 1
                  ? [
                    {
                      value: 0,
                      label: "当前成员为负责人",
                    },
                  ]
                  : [
                    {
                      value: 0,
                      label: "当前成员为负责人",
                    },
                    {
                      value: 1,
                      label: "全部负责人",
                    },
                  ]
              }
            />)}
          </Space>
        </div>
          {workDate ? (
            <Alert
              style={{ background: "#F4F4FE" }}
              className="registration-alert"
              message={
                <div>
                  <div>
                    该成员{dayjs(workDate).format("YYYY年MM月DD日")}
                    {/* 考勤开启 + 已选日期 + 有考勤记录 */}
                    {attendanceEnabled === 1 && typeof attendanceHours === "number" && attendanceHours > 0 && (
                      <span>考勤工时<span className="num">{attendanceHours}小时</span>，</span>
                    )}
                    {/* 考勤开启 + 已选日期 + 缺卡(允许提交) */}
                    {attendanceEnabled === 1 && attendanceHours === 0 && missPunchPolicy === 2 && (
                      <span>无考勤记录，</span>
                    )}
                    {/* 考勤开启 + 已选日期 + 缺卡(不允许提交) */}
                    {attendanceEnabled === 1 && attendanceHours === 0 && missPunchPolicy === 1 && (
                      <span>无考勤记录，暂不可登记工时，</span>
                    )}
                    已登记工时
                    <span className="num">
                      {typeof alertDetail?.registeredWorkingHours === "number"
                        ? alertDetail?.registeredWorkingHours
                        : "--"}
                      小时
                    </span>
                    ，待审批工时
                    <span className="num">
                      {typeof alertDetail?.approvalingWork === "number"
                        ? alertDetail?.approvalingWork
                        : "--"}
                      小时
                    </span>
                    ，当前拟提交工时
                    <span className="num">
                      {typeof alertDetail?.submitHours === "number"
                        ? alertDetail?.submitHours
                        : "--"}
                      小时
                    </span>
                    ，剩余可登记工时
                    <span className="num">
                      {typeof alertDetail?.remainingWork === "number"
                        ? alertDetail?.remainingWork
                        : "--"}
                      小时
                    </span>
                    ，工作饱和度
                    <span className="num">
                      {typeof alertDetail?.saturation === "number"
                        ? alertDetail?.saturation
                        : "--"}
                      %
                    </span>
                    <Tooltip
                      className="user-tooltip"
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
                    {/* 考勤开启时可重新拉取当前日期范围的考勤数据 */}
                    {attendanceEnabled === 1 && (
                      <span
                        className="attattendance-sync-btn"
                        onClick={handleSyncAttendance}
                      >
                        同步考勤
                      </span>
                    )}
                  </div>
                </div>
              }
              type="info"
              showIcon
            />
          ) : null}
        </div>
        <div className="regWorkHourBatchNew-body" ref={tableRef}>
          <div className="level-list">
            <Popover
              placement="bottomLeft"
              open={expandPopoverVisible}  // 替换 visible 为 open（部分版本中属性名调整）
              onOpenChange={onVisibleChange}  // 替换 onVisibleChange 为 onOpenChange
              trigger="click"  // 显式指定触发方式为点击
              content={
                <div style={{ width: 160 }}>
                  <div
                    style={{ padding: "6px 8px", cursor: "pointer", backgroundColor: expandLevel === -1 ? "#EFF1FD" : "transparent", }}
                    onClick={() => handleExpandLevelSelect(-1)}
                  >
                    展开所有层级
                  </div>
                  {/* <div style={{ color: "#999", fontSize: 12, padding: "4px 8px" }}>
                      展开至
                    </div> */}
                  {expandOptions.map(item => (
                    <div
                      key={item.level}
                      style={{
                        padding: "6px 8px",
                        cursor: "pointer",
                        backgroundColor: item.level === expandLevel ? "#EFF1FD" : "transparent",
                      }}
                      onClick={() => handleExpandLevelSelect(item.level)}
                    >
                      {item.levelName}
                    </div>
                  ))}
                </div>
              }
            >
              {/* 触发按钮 */}
              <div title="展开" className="zhankai-icon">
                <img src={zhankai} alt="展开" style={{ width: 20, height: 20 }} />
              </div>
            </Popover>
          </div>
          <Table
            loading={tableLoading && !(props?.openType === "again_launch" && tableLoading2)}
            className="table-warp"
            size="small"
            bordered
            rowKey="id"
            columns={regTableColumns}
            dataSource={workInstanceDataSource?.entities}
            pagination={false}
            expandable={{
              indentSize: 20,
              defaultExpandAllRows: true,
              expandedRowKeys: expandedRowKeys,
              onExpand: onExpand,
            }}
            scroll={{
              x: "max-content",
              y: tableScrollHeight,
            }}
            components={{
              body: {
                wrapper: VirtualTableBody,
              },
            }}
            footer={() => {
              if (!workInstanceDataSource?.entities?.length) return null;

              // 计算每列的汇总值
              const columnTotals = {};
              let totalCount = 0;

              // 获取日期范围 - 动态响应填报日期变化
              const rangeDates = getDatesInRange(beginWorkDate, endWorkDate);

              // 初始化日期列的汇总值
              rangeDates?.forEach(item => {
                columnTotals[item.date] = new Decimal(0);
              });

              // 遍历数据计算各列汇总
              workInstanceDataSource?.entities?.forEach(record => {
                // 计算日期列的汇总
                rangeDates?.forEach(item => {
                  if (record[item.date]?.actWorkHour) {
                    columnTotals[item.date] = columnTotals[item.date].plus(new Decimal(record[item.date].actWorkHour || 0));
                    totalCount++;
                  }
                });
              });

              // 过滤出可见的列
              const visibleColumns = regTableColumns.filter(column => !column.hidden);

              // 计算表格总宽度，确保与表格列完全对齐
              const tableTotalWidth = visibleColumns.reduce((total, column) => {
                return total + (column.width || 120); // 默认宽度120px
              }, 0);

              return (
                <>
                  <div
                    ref={summaryRef}
                    style={{
                      width: '100%',
                      backgroundColor: '#F8F9FA',
                      fontWeight: 'bold',
                      borderTop: '1px solid #f0f0f0',
                      overflow: 'hidden', // 隐藏滚动轴
                      position: 'relative',
                      maxHeight: '60px', // 限制高度避免占用过多空间
                      scrollbarWidth: 'none', // 隐藏滚动轴（Firefox）
                      msOverflowStyle: 'none', // 隐藏滚动轴（IE/Edge）
                      fontWeight: '400'
                    }}
                    className="summary-container"
                  >
                    <div style={{
                      width: `${tableTotalWidth}px`, // 设置与表格相同的总宽度
                      minWidth: '100%',
                      transform: 'translateX(0px)' // 初始位置
                    }}
                      className="summary-content"
                    >
                      <table
                        style={{
                          width: `${tableTotalWidth}px`, // 精确匹配表格宽度
                          borderCollapse: 'collapse',
                          tableLayout: 'fixed', // 固定表格布局以确保对齐
                          minWidth: '100%'
                        }}
                      >
                        <colgroup>
                          {visibleColumns.map((column, index) => (
                            <col
                              key={column.key || column.dataIndex || index}
                              style={{
                                width: column.width ? `${column.width}px` : '120px' // 精确匹配列宽
                              }}
                            />
                          ))}
                        </colgroup>
                        <tbody>
                          <tr>
                            {(() => {
                              // 计算非日期列、非总计列的数量
                              const nonDateColumns = visibleColumns.filter(col => {
                                const isDate = /^\d{4}-\d{2}-\d{2}$/.test(col.dataIndex);
                                const isTotal = col.dataIndex === 'total';
                                return !isDate && !isTotal;
                              });

                              // 计算日期列和总计列的数量
                              const dateAndTotalColumns = visibleColumns.filter(col => {
                                const isDate = /^\d{4}-\d{2}-\d{2}$/.test(col.dataIndex);
                                const isTotal = col.dataIndex === 'total';
                                return isDate || isTotal;
                              });

                              // 构建合并后的列数组
                              const mergedColumns = [];

                              // 添加合并列（非日期列、非总计列合并为一列）
                              if (nonDateColumns.length > 0) {
                                mergedColumns.push({
                                  key: 'merged-column',
                                  dataIndex: 'merged',
                                  colSpan: nonDateColumns.length,
                                  content: `每日工时登记数据（${rangeDates?.[0]?.date}至${rangeDates?.[rangeDates?.length - 1]?.date}）：`,
                                  isMerged: true
                                });
                              }

                              // 添加日期列和总计列
                              dateAndTotalColumns.forEach(col => {
                                const isDate = /^\d{4}-\d{2}-\d{2}$/.test(col.dataIndex);
                                const isTotal = col.dataIndex === 'total';

                                let content = '';
                                if (isDate) {
                                  // 日期列显示已提交和待审批工时信息（换行显示）
                                  const registeredHours = workHoursTotalDetail?.[col.dataIndex]?.registeredWorkingHours;
                                  const approvalHours = workHoursTotalDetail?.[col.dataIndex]?.approvalingWorkHours;
                                  content = (
                                    <div style={{ lineHeight: '1.5', color: '#646A73', fontSize: '12px', textAlign: 'left' }}>
                                      <div>已登记：{registeredHours != null ? registeredHours : '--'}h</div>
                                      <div>待审批：{approvalHours != null ? approvalHours : '--'}h</div>
                                    </div>
                                  );
                                } else if (isTotal) {
                                  // 总计列计算并显示总工时
                                  // let totalSum = new Decimal(0);
                                  // Object.values(columnTotals).forEach(value => {
                                  //   totalSum = totalSum.plus(value);
                                  // });
                                  // content = totalSum && !totalSum.isZero() ? totalSum.toFixed(2) : '';
                                  content = ''
                                }

                                mergedColumns.push({
                                  key: col.key || col.dataIndex,
                                  dataIndex: col.dataIndex,
                                  colSpan: 1,
                                  content: content,
                                  isDate: isDate,
                                  isTotal: isTotal,
                                  width: col.width
                                });
                              });

                              return mergedColumns.map((col, index) => (
                                <td
                                  key={col.key}
                                  colSpan={col.colSpan}
                                  style={{
                                    fontSize: '12px',
                                    color: '#646A73',
                                    padding: '5px 16px',
                                    textAlign: col.isDate || col.isTotal ? 'center' : 'left',
                                    boxSizing: 'border-box',
                                    overflow: 'hidden',
                                    textOverflow: col.isMerged ? 'unset' : 'ellipsis',
                                    whiteSpace: col.isMerged ? 'normal' : 'nowrap',
                                    width: col.isMerged ? 'auto' : (col.width ? `${col.width}px` : '120px'),
                                    minWidth: col.isMerged ? 'auto' : (col.width ? `${col.width}px` : '120px'),
                                    maxWidth: col.isMerged ? 'none' : (col.width ? `${col.width}px` : '120px')
                                  }}
                                >
                                  {col.content}
                                </td>
                              ));
                            })()}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {loading && <Spin size="small" />}
                    {!loading && hasMore ? (
                      <span style={{ color: "#727272" }}>滚动加载更多...</span>
                    ) : null}
                  </div>
                </>
              );
            }}
          />
          <Button
            icon={<PlusOutlined />}
            type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => {
              addWorkItemForm.resetFields();
              setIsAddWorkItemOpen(true);
            }}
          >
            添加已有工作实例/节点/任务
          </Button>
        </div>
        <Modal
          open={isAddWorkItemOpen}
          onCancel={() => {
            setNodeTaskOptions([]);
            addWorkItemForm.resetFields();
            setIsAddWorkItemOpen(false);
          }}
          footer={null}
        >
          <Form
            form={addWorkItemForm}
            layout="vertical"
            onValuesChange={onAddWorkItemValuesChange}
            onFinish={onAddWorkItemFinish}
          >
            <Form.Item
              label="选择所属工作项实例"
              rules={[
                {
                  required: true,
                  message: "请选择工作项实例",
                },
              ]}
              name="workItemEntityId"
            >
              <SmartSelect2
                workItemIds={[]}
                fetchOptions={fetchOptions2}
                isCustomFieldEnabled={isCustomFieldEnabled}
                placeholder="请搜索选择工作项实例"
                style={{ width: "100%" }}
                onChange={(value) => {
                  addWorkItemForm.setFieldValue("workItemEntityId", value)
                }}
              />
            </Form.Item>
            <Form.Item
              label="选择所属工作项实例节点/任务"
              name="workItemInstanceIds"
            >
              <Cascader
                options={nodeTaskOptions}
                multiple
                placeholder="请选择工作项实例节点/任务"
                maxTagCount="responsive"
              />
            </Form.Item>
            <div style={{ textAlign: "right" }}>
              <Space>
                <Button
                  htmlType="reset"
                  onClick={() => {
                    setNodeTaskOptions([]);
                    addWorkItemForm.resetFields();
                    setIsAddWorkItemOpen(false);
                  }}
                >
                  取消
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={isAddWorkItemLoading}
                >
                  确定
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    </Spin>
  );
};

// 虚拟滚动表格组件
const VirtualTableBody = ({ children, ...props }) => {
  const tbodyRef = useRef();
  const [visibleRange, setVisibleRange] = useState([0, 50]); // 默认显示50行
  const rowHeight = 40; // 预估行高
  const scrollPositionRef = useRef(0); // 保存滚动位置

  useEffect(() => {
    const handleScroll = () => {
      if (!tbodyRef.current) return;

      const tableContainer = tbodyRef.current.closest('.ant-table-body');
      if (!tableContainer) return;

      const scrollTop = tableContainer.scrollTop;
      const containerHeight = tableContainer.clientHeight;

      // 保存滚动位置
      scrollPositionRef.current = scrollTop;

      // 计算可见区域的行范围
      const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 10); // 预加载10行
      const endIndex = Math.min(
        React.Children.count(children) - 1,
        startIndex + Math.ceil(containerHeight / rowHeight) + 20 // 预加载20行
      );

      setVisibleRange([startIndex, endIndex]);
    };

    // 恢复滚动位置的函数
    const restoreScrollPosition = () => {
      const tableContainer = tbodyRef.current?.closest('.ant-table-body');
      if (tableContainer && scrollPositionRef.current > 0) {
        tableContainer.scrollTop = scrollPositionRef.current;
      }
    };

    // 确保在组件挂载后获取正确的容器元素
    const setupScrollListener = () => {
      const tableContainer = tbodyRef.current?.closest('.ant-table-body');
      if (tableContainer) {
        tableContainer.addEventListener('scroll', handleScroll);
        // 初始计算可见区域
        handleScroll();

        // 延迟恢复滚动位置，确保DOM已经更新
        setTimeout(() => {
          restoreScrollPosition();
        }, 50);
      }
    };

    const timer = setTimeout(setupScrollListener, 0);

    return () => {
      clearTimeout(timer);
      const tableContainer = tbodyRef.current?.closest('.ant-table-body');
      if (tableContainer) {
        tableContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [children]);

  // 如果数据量小于等于0行，直接返回空tbody
  if (!children || React.Children.count(children) <= 0) {
    return (
      <tbody {...props} ref={tbodyRef}>
        {children}
      </tbody>
    );
  }

  // 如果数据量较小(<= 50行)，使用普通tbody渲染避免虚拟滚动可能的问题
  if (React.Children.count(children) <= 50) {
    return (
      <tbody {...props} ref={tbodyRef}>
        {children}
      </tbody>
    );
  }

  const [startIndex, endIndex] = visibleRange;
  const totalRows = React.Children.count(children);

  // 计算占位高度
  const topPlaceholderHeight = startIndex * rowHeight;
  const bottomPlaceholderHeight = Math.max(0, (totalRows - endIndex - 1) * rowHeight);

  return (
    <tbody {...props} ref={tbodyRef}>
      {/* 顶部占位符 */}
      {topPlaceholderHeight > 0 && (
        <tr key="virtual-table-top-placeholder">
          <td
            colSpan={props.columns?.length || 1}
            style={{
              height: topPlaceholderHeight,
              padding: 0,
              border: 'none'
            }}
          />
        </tr>
      )}

      {/* 可见区域的行 */}
      {React.Children.toArray(children).slice(startIndex, endIndex + 1)}

      {/* 底部占位符 */}
      {bottomPlaceholderHeight > 0 && (
        <tr key="virtual-table-bottom-placeholder">
          <td
            colSpan={props.columns?.length || 1}
            style={{
              height: bottomPlaceholderHeight,
              padding: 0,
              border: 'none'
            }}
          />
        </tr>
      )}
    </tbody>
  );
};

export default RegWorkHourBatchNew;

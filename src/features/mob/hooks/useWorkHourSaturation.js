/**
 * 工时饱和度提示 Hook（移动端）
 *
 * 完整移植自 Web 端单项登记组件：
 *   src/features/web/components/reg-workHour/RegWorkHour.jsx
 * 对应关系（Web 行号）：
 *   - normalizeAttendanceEnabled / toFiniteNumber / toOptionalNumber / normalizeAttendanceConfig  L94-138
 *   - getAttendanceConfigInfo        L769-793   查询考勤配置状态（租户/项目级）
 *   - applyAttendanceConfig          L795-802
 *   - getUserAttendanceConfigData    L809-887   查询成员考勤数据（含 lookupProjectKeys）
 *   - getAttendanceUpperLimit        L917-931   单天填报上限（四场景）
 *   - calcSaturationData             L942-987   饱和度/剩余工时统一计算（含编辑同日期扣旧值）
 *   - getAlertDetail                 L989-1083  三段串行请求 + 竞态守卫 + 快照
 *   - handleSyncAttendance           L1086-1106 同步考勤
 *   - 回填 effect                    L1108-1123
 *   - 主 effect                      L1124-1168
 *   - 容量配置 getWorkHour           L1195-1208（getUserStandWorkHour）
 *   - 租户模式 getRole 内片段        L753-763（getTenantModeInfo → sessionStorage.tenantModeInfo）
 *
 * 与 Web 的差异（均为移动端无对应场景，非口径差异）：
 *   1. 无 antd Form / validator：不做 actWorkHour 上限校验，也不在请求后触发 validateFields。
 *   2. 无 props.type === "approval" 审批编辑场景：不传 registerRecordId，
 *      旧值一律取 editRegistrationValue.actWorkHour ?? act_hour。
 *   3. dayUp 不单独存 state，直接读 capacitySet.dayUp（Web 中两者同源同值）。
 *   4. toast 用 antd-mobile Toast（移动端无 window.JSSDK.toast 用法）。
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Toast } from "antd-mobile";
import dayjs from "dayjs";
import {
  getAttendanceConfig,
  getUserAttendanceConfig,
  getWorkSaturationTips,
  getUserStandWorkHour,
  getTenantModeInfo,
} from "../../../api/api";
import {
  getAppModeInfo,
  buildAttendanceIndex,
  getAttendance,
} from "../../../util/util";

const normalizeAttendanceEnabled = (value) => (
  value === true || value === 1 || value === "1" ? 1 : 0
);

export const toFiniteNumber = (value, fallback = 0) => {
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
 * 工时饱和度提示 Hook
 *
 * @param {Object}   params
 * @param {boolean}  params.enabled              总开关，false 时不发任何请求（移动端：shouldShow && !!userKey）
 * @param {string}   params.workDate             工作日期 'YYYY-MM-DD' 或 ''
 * @param {string}   params.userKey              登记人 userKey
 * @param {Object|null} params.editRegistrationValue 编辑回显数据（含 actWorkHour/act_hour/workDate），无编辑传 null
 * @param {boolean}  params.hasSelectedWorkItem  是否已选登记对象（space 模式下控制考勤可见性）
 * @param {string}   params.workItemKey          登记对象标识串，space 模式下变化时重新查询
 * @param {Function} params.getActWorkHourInput  () => number，当前输入框工时（移动端：parseFloat(formData.workHour) || 0）
 */
export const useWorkHourSaturation = ({
  enabled,
  workDate,
  userKey,
  editRegistrationValue,
  hasSelectedWorkItem,
  workItemKey,
  getActWorkHourInput,
}) => {
  // ---------- state（对应 Web L192-215） ----------
  const [mode, setMode] = useState("");
  const [alertDetail, setAlertDetail] = useState({});
  const [alertDetailOld, setAlertDetailOld] = useState({});
  const [regWorkingHours, setRegWorkingHours] = useState(null);
  const [attendanceEnabled, setAttendanceEnabled] = useState(0);
  const [upperLimitSource, setUpperLimitSource] = useState(1);
  const [missPunchPolicy, setMissPunchPolicy] = useState(0);
  const [missPunchCustomLimit, setMissPunchCustomLimit] = useState(null);
  const [attendanceHours, setAttendanceHours] = useState(null);
  const [attendanceSyncing, setAttendanceSyncing] = useState(false);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const [capacitySet, setCapacitySet] = useState({});

  // ---------- 派生（对应 Web L216-217） ----------
  const isAttendanceEnabled = normalizeAttendanceEnabled(attendanceEnabled) === 1;
  const canShowAttendance = mode !== "space" || hasSelectedWorkItem;

  // ---------- refs ----------
  // 输入/编辑上下文用 ref 镜像，保证 recalcForInput（useCallback 无依赖）读到最新值
  const getActWorkHourInputRef = useRef(getActWorkHourInput);
  getActWorkHourInputRef.current = getActWorkHourInput;
  const editRegistrationValueRef = useRef(editRegistrationValue);
  editRegistrationValueRef.current = editRegistrationValue;
  const workDateRef = useRef(workDate);
  workDateRef.current = workDate;
  const userKeyRef = useRef(userKey);
  userKeyRef.current = userKey;
  const hasSelectedWorkItemRef = useRef(hasSelectedWorkItem);
  hasSelectedWorkItemRef.current = hasSelectedWorkItem;
  const alertDetailOldRef = useRef(alertDetailOld);
  alertDetailOldRef.current = alertDetailOld;
  const capacitySetRef = useRef(capacitySet);
  capacitySetRef.current = capacitySet;

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
  const logActualHourRef = useRef(0);

  // ---------- 租户模式初始化（对应 Web getRole L753-763） ----------
  // 移动端此前从不写 sessionStorage.tenantModeInfo，getAppModeInfo() 会恒兜底 "space"，
  // 导致租户模式下考勤查询的 lookupProjectKeys=["tenant",null,""] 失效，这里补齐。
  useEffect(() => {
    let cancelled = false;
    const initMode = async () => {
      try {
        if (!sessionStorage.getItem("tenantModeInfo")) {
          const modeRes = await getTenantModeInfo();
          if (!cancelled && modeRes?.result && modeRes?.data) {
            sessionStorage.setItem("tenantModeInfo", JSON.stringify(modeRes.data));
          }
        }
      } catch (error) {
        console.error("读取租户模式信息失败:", error);
      }
      if (!cancelled) setMode(getAppModeInfo());
    };
    initMode();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- 容量配置（对应 Web getWorkHour L1195-1208） ----------
  useEffect(() => {
    if (!userKey) return undefined;
    let cancelled = false;
    const fetchCapacity = async () => {
      try {
        const res = await getUserStandWorkHour({ userKey });
        if (!cancelled && res?.result && res?.data) {
          setCapacitySet(res.data);
        }
      } catch (error) {
        console.error("获取标准工时/容量配置失败:", error);
      }
    };
    fetchCapacity();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  // ---------- 考勤配置（对应 Web L769-802） ----------
  const applyAttendanceConfig = (config) => {
    attendanceConfigRef.current = config;
    setAttendanceEnabled(config.enabled);
    setUpperLimitSource(config.upperLimitSource);
    setMissPunchPolicy(config.missPunchPolicy);
    setMissPunchCustomLimit(config.missPunchCustomLimit);
    setAttendanceHours(config.attendanceHours);
  };

  /**
   * 查询考勤配置状态（租户/项目级）
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
      const configuredProjectKey = editRegistrationValueRef.current?.projectKey
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

  // ---------- 单天填报上限（对应 Web L917-931） ----------
  const getAttendanceUpperLimit = (config = attendanceConfigRef.current) => {
    // Web 同位置为 Number(dayUp) || Number(capacitySet?.dayUp) || 24，两者同源同值
    const normalLimit = Number(capacitySetRef.current?.dayUp) || 24;
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

  // ---------- 饱和度统一计算（对应 Web L942-987） ----------
  const calcSaturationData = (baseData, actWorkHourInput, editValue, isSameDate) => {
    const result = { ...(baseData || {}) };
    const inputHour = toFiniteNumber(actWorkHourInput);
    const originalRegistered = toFiniteNumber(result.registeredWorkingHours); // 接口返回的已登记工时(不变)
    const approvalingWork = toFiniteNumber(result.approvalingWork);           // 待审批工时(不变)
    const standWorkHour = toFiniteNumber(capacitySetRef.current?.standWorkHour);
    const upperLimit = getAttendanceUpperLimit();
    // 旧值：编辑回显取 actWorkHour ?? act_hour。
    // Web 还有 type==='approval' 的 logActualHour / create 分支，移动端无该场景，不搬。
    let oldActWorkHour = editValue
      ? toFiniteNumber(editValue?.actWorkHour ?? editValue?.act_hour)
      : 0;

    // 当前拟提交工时（用于显示）
    // - 新增登记：等于输入值
    // - 编辑且日期相同：输入值 - 旧值（差值）
    // - 编辑且日期不同：等于输入值
    let displayActWorkHour;
    if (!editValue) {
      displayActWorkHour = inputHour;
    } else if (isSameDate) {
      displayActWorkHour = inputHour - oldActWorkHour;
    } else {
      displayActWorkHour = inputHour;
    }
    result.displayActWorkHour = Number(displayActWorkHour.toFixed(2));

    // 剩余工时 = 日上限 - (已登记 + 待审批 + 拟提交)
    // 编辑同日期时，已登记需减去旧值（因旧值已包含在registered中，替换为新值）
    const registeredForCalc = (editValue && isSameDate)
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

  // ---------- 主请求（对应 Web getAlertDetail L989-1083） ----------
  const getAlertDetail = async (throwOnFailure = false) => {
    const requestId = ++alertRequestIdRef.current;
    const appMode = getAppModeInfo();
    const currentWorkDate = workDateRef.current
      ? dayjs(workDateRef.current).format("YYYY-MM-DD")
      : "";
    const context = {
      mode: appMode,
      userKey: userKeyRef.current,
      workDate: currentWorkDate,
      projectKey: sessionStorage.getItem("jwtMeegoTeamworkProjectKey") || "",
      canLoadAttendance: (appMode || "tenant") !== "space" || hasSelectedWorkItemRef.current,
    };
    const isCurrentRequest = () => requestId === alertRequestIdRef.current
      && context.mode === appMode
      && context.userKey === userKeyRef.current
      && context.workDate === (workDateRef.current
        ? dayjs(workDateRef.current).format("YYYY-MM-DD")
        : "");
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

    // Web 在审批编辑场景会额外传 registerRecordId，移动端无该场景。
    const data = {
      workDate: context.workDate,
      registrantUseKey: context.userKey,
    };
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
      dayUp: toFiniteNumber(capacitySetRef.current?.dayUp, 24),
      logActualHour: logHour,
      attendanceEnabled: attendanceConfig.enabled,
      attendanceHours: attendanceConfig.attendanceHours,
      missPunchPolicy: attendanceConfig.missPunchPolicy,
      missPunchCustomLimit: attendanceConfig.missPunchCustomLimit,
    };
    capacitySnapshotRef.current = snapshot;
    logActualHourRef.current = logHour;
    setRegWorkingHours(registeredWorkingHours);
    const normalizedRawData = {
      ...rawData,
      registeredWorkingHours,
      approvalingWork,
    };
    const inputActWorkHour = toFiniteNumber(getActWorkHourInputRef.current());
    const editValue = editRegistrationValueRef.current;
    const isSameDate = editValue
      ? context.workDate === dayjs(editValue.workDate).format("YYYY-MM-DD")
      : false;
    setAlertDetailOld(normalizedRawData);
    setAlertDetail(calcSaturationData(
      normalizedRawData,
      inputActWorkHour,
      editValue,
      isSameDate
    ));
    setAttendanceReady(true);
    return true;
  };

  // ---------- 同步考勤（对应 Web L1086-1106） ----------
  const handleSyncAttendance = async () => {
    if (attendanceSyncing) return;
    setAttendanceSyncing(true);
    try {
      const refreshed = await getAlertDetail(true);
      if (!refreshed) throw new Error("刷新考勤信息失败");
      // 移动端无 antd Form，不需要像 Web 那样在下一 tick 重校验字段。
      Toast.show({ content: "同步成功", position: "top" });
    } catch (error) {
      console.error("同步考勤失败:", error);
      Toast.show({ content: "同步失败", position: "top" });
    } finally {
      setAttendanceSyncing(false);
    }
  };

  // ---------- 回填 effect（对应 Web L1108-1123） ----------
  useEffect(() => {
    // 编辑回显时：当接口返回alertDetail后，初始化displayActWorkHour（只执行一次，避免死循环）
    if (alertDetail && Object.keys(alertDetail).length > 0 && alertDetail.displayActWorkHour === undefined) {
      const inputActWorkHour = toFiniteNumber(getActWorkHourInputRef.current());
      const editValue = editRegistrationValueRef.current;
      const isSameDate = editValue
        ? dayjs(workDateRef.current || "").format("YYYY-MM-DD")
          === dayjs(editValue.workDate).format("YYYY-MM-DD")
        : false;
      const newAlertDetail = calcSaturationData(
        alertDetailOldRef.current || alertDetail,
        inputActWorkHour,
        editValue,
        isSameDate
      );
      setAlertDetail(newAlertDetail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertDetail, editRegistrationValue, capacitySet]);

  // ---------- 主 effect（对应 Web L1124-1168） ----------
  useEffect(() => {
    let cancelled = false;

    const canRefreshAlert = enabled
      && userKey
      && (!workDate || "standWorkHour" in capacitySet);
    if (canRefreshAlert) {
      capacitySnapshotRef.current = null;
      setAlertDetail({});
      setAlertDetailOld({});
      setRegWorkingHours(null);
      refreshAlertAndValidate();
    } else {
      capacitySnapshotRef.current = null;
      setAttendanceReady(false);
      setAlertDetail({});
      setAlertDetailOld({});
    }

    async function refreshAlertAndValidate() {
      await getAlertDetail();
      if (cancelled) return;
      // 移动端无表单校验器，接口返回后无需像 Web 那样延时触发 validateFields。
    }

    return () => {
      cancelled = true;
      alertRequestIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, workDate, userKey, capacitySet, workItemKey, enabled]);

  // ---------- 输入变化本地重算（对应 Web onValuesChange L1586-1599，不调接口） ----------
  const recalcForInput = useCallback((input) => {
    const base = alertDetailOldRef.current;
    const currentDate = workDateRef.current;
    if (!base || !currentDate) return;
    const editValue = editRegistrationValueRef.current;
    const isSameDate = editValue
      ? dayjs(currentDate).format("YYYY-MM-DD")
        === dayjs(editValue.workDate).format("YYYY-MM-DD")
      : false;
    setAlertDetail(calcSaturationData(base, toFiniteNumber(input), editValue, isSameDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    alertDetail,
    attendanceReady,
    attendanceHours,
    attendanceEnabled,
    isAttendanceEnabled,
    missPunchPolicy,
    regWorkingHours,
    attendanceSyncing,
    canShowAttendance,
    mode,
    recalcForInput,
    handleSyncAttendance,
  };
};

export default useWorkHourSaturation;

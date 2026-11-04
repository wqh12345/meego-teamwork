var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
          resolve(value);
        });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __rest =
  (this && this.__rest) ||
  function (s, e) {
    var t = {};
    for (var p in s)
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (
          e.indexOf(p[i]) < 0 &&
          Object.prototype.propertyIsEnumerable.call(s, p[i])
        )
          t[p[i]] = s[p[i]];
      }
    return t;
  };
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
  postApprovalConfigSave,
  getTenantModeInfo
} from "../../../../../../api/api";
import { ExclamationCircleFilled } from "@ant-design/icons";
import "./ApprovalSet.less";
import TeamPicker from "../../../team-picker/TeamPicker";
import SelectedUser from "../../../selected-user/SelectedUser";
import deleteIcon from "../../../../../../image/delete.png";
import addIcon from "../../../../../../image/add.png";
import { generateUuid} from "../../../../../../util/util";
import { UserTag } from '@lark-project/ui-kit-plugin';
import RuleEditModal from './RuleEditModal';
import { fetchRuleList } from './feishuRuleApi';
import { isIsvInstalled } from "../standards-set/attendance-config/attendanceConfig";
import ziyanIcon from "../../../../../../image/ziyan.png";
import feishuShenpiIcon from "../../../../../../image/feishu_shenpi.png";

/** 读取本地缓存的「是否已安装 ISV」状态（由 api/tenant/mode/info 写入 sessionStorage.tenantModeInfo） */
const readIsvInstalled = () => {
  try {
    const tenantModeInfo = JSON.parse(sessionStorage.getItem('tenantModeInfo') || '{}');
    return isIsvInstalled(tenantModeInfo);
  } catch {
    return false;
  }
};

const ApprovalSet = (props) => {
  //console.log("ApprovalSet", props);
  const [isOpen, setIsOpen] = useState(false);
  // 审批通过再次校验工时：开关（默认开启；后端字段 isReCheckAfterApprove，1 开启 / 0 关闭，null 或缺失按开启）
  const [isReCheckOnApprove, setIsReCheckOnApprove] = useState(true);
  const [approvalForm] = Form.useForm();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
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
  const [approvalMode, setApprovalMode] = useState(1); // 1: 指定成员, 2: 团队审批, 3: 角色审批
  const [selectedTeam, setSelectedTeam] = useState('');
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
  const [selectedFallbackApprovalUsers, setSelectedFallbackApprovalUsers] = useState([]); // 审批人为空时的指定人员
  const [selectedTeamApprovalUsers, setSelectedTeamApprovalUsers] = useState([]); // 团队审批指定人员
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
  const [submitterApprovalRule, setSubmitterApprovalRule] = useState(0);
  // 当前正在编辑的用户列表类型（用于弹窗选择人员）
  const [currentUserListType, setCurrentUserListType] = useState('main'); // 'main', 'fallback', 'teamFallback'
  // 1. 为每种审批模式创建独立的状态
  const [selectedUsersByMode, setSelectedUsersByMode] = useState({
    // 主审批人 - 按模式区分
    main: {
      1: [], // 指定成员模式
      2: [], // 团队审批模式
      3: []  // 角色审批模式
    },
    // 审批人为空时的指定人员 - 按模式区分
    fallback: {
      1: [],
      2: [],
      3: []
    }
  });
  // 添加错误信息显示状态
  const [showError, setShowError] = useState({
    main: false,
    fallback: false
  });
  const [workItemOptions, setWorkItemOptions] = useState([]);
  // 新增：保存每行工作项对应的角色选项和加载状态
  const [rowRoleOptions, setRowRoleOptions] = useState({});
  const [rowRoleLoading, setRowRoleLoading] = useState({});
  // 新增：存储每行的错误信息（key: 行ID, value: { workItem: 工作项是否为空, role: 角色是否为空 }）
  const [rowErrors, setRowErrors] = useState({});
  // 新增：角色搜索相关状态
  const [roleSearchLoading, setRoleSearchLoading] = useState({});
  const [searchKeyword, setSearchKeyword] = useState({});

  /* ================== 飞书审批 ================== */
  // 是否已安装 ISV：未安装时「审批方式」与飞书审批整块不渲染，
  // 保持原有自研审批的功能与样式不变。判定与 StandardsSet 一致，共用 isIsvInstalled。
  const [isvInstalled, setIsvInstalled] = useState(readIsvInstalled);
  // 审批方式：1 默认（自研审批），2 飞书审批
  const [approvalType, setApprovalType] = useState(1);
  // 飞书审批规则列表
  const [feishuRuleList, setFeishuRuleList] = useState([]);
  // 飞书规则列表是否已从服务端拉取过：首次拉取后置 true，之后切换审批方式复用内存列表（保留本地临时新增/编辑）
  const feishuRuleLoadedRef = useRef(false);
  // 飞书规则列表请求序号：仅最后一次请求的结果可落地，避免慢响应覆盖用户刚做的新增/删除
  const feishuRuleReqIdRef = useRef(0);
  // 飞书规则列表是否存在「本地已改但未点保存设置」的改动：为 true 时接口数据不覆盖列表
  const feishuRuleDirtyRef = useRef(false);
  // 飞书审批规则弹窗
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleModalMode, setRuleModalMode] = useState('add'); // 'add' | 'edit'
  const [editingRule, setEditingRule] = useState(null);

  /** 当前空间 key */
  const getProjectKey = () => props?.projectKey || sessionStorage.getItem('jwtMeegoTeamworkProjectKey');

  /** 同步 ISV 安装状态（与 StandardsSet 同款：接口回写 sessionStorage 并刷新本地状态） */
  const syncTenantModeInfo = async () => {
    try {
      const res = await getTenantModeInfo();
      if (!res?.result) return;
      const tenantModeInfo = res.data || {};
      sessionStorage.setItem('tenantModeInfo', JSON.stringify(tenantModeInfo));
      setIsvInstalled(isIsvInstalled(tenantModeInfo));
    } catch (_) {
      // 接口异常时保留首次渲染从 sessionStorage 读到（或默认 false）的状态
    }
  };

  /**
   * 规则的统一唯一标识：后端 id → 本地 _localKey → 「approvalCode + ruleName」兜底。
   * 列表 rowKey、编辑匹配、删除匹配统一用它，避免再按对象形状猜等值关系
   * （接口返回的规则若没有 id，也不会出现「删不掉 / 编辑错行」）。
   */
  const makeRuleKey = (rule) => {
    if (!rule) return '';
    if (rule.id !== undefined && rule.id !== null && rule.id !== '') return `id:${rule.id}`;
    if (rule._localKey) return `local:${rule._localKey}`;
    return `sig:${rule.approvalCode || ''}::${rule.ruleName || ''}`;
  };

  /** 规则内容签名（模板 + 名称），仅用于提交前 / 入库前去重 */
  const ruleSignature = (rule) => `${rule?.approvalCode || ''}::${rule?.ruleName || ''}`;

  /** 获取工作项类型 */
  const getWorkItemOptions = async (searchKey) => {
    const params = {
      workItemName: searchKey,
    };
    const res = await getWorkItemOptionNew(params);
    if (res?.result) {
      if (res.data) {
        setWorkItemOptions(res.data);
      }
    }
  };

  useEffect(() => {
    getWorkItemOptions();
  }, []);

  // 新增：当审批模式为角色审批且审批表格数据变化时，为每行数据加载角色信息
  useEffect(() => {
    if (approvalMode === 3 && approvalTableData.length > 0) {
      approvalTableData.forEach(record => {
        if (record.workItemId && !rowRoleOptions[record.id]) {
          fetchRolesByWorkItemId(record.workItemId, record.id);
        }
      });
    }
  }, [approvalMode, approvalTableData]);
  /** 获取配置 */
  const getApprovalSettingsData = async () => {
    const res = await getApprovalSettings();
    if (res?.result) {
      // 设置审批开关状态
      setIsOpen(res.data?.enableApproval === 1);
      // 审批通过再次校验工时：仅显式 0 为关闭，1 / null / 字段缺失均按开启处理
      setIsReCheckOnApprove(res.data?.isReCheckAfterApprove !== 0);

      // 是否已安装 ISV：未安装时隐藏「审批方式」，配置仍按 1（自研审批）处理
      const installed = readIsvInstalled();
      setIsvInstalled(installed);

      // 设置审批方式：1 默认（自研审批），2 飞书审批
      const type = installed && res.data?.approvalType === 2 ? 2 : 1;
      setApprovalType(type);
      // 飞书审批时加载规则列表
      if (type === 2) {
        loadFeishuRuleList();
      }

      // 设置审批模式
      setApprovalMode(res.data?.pattern || 1);

      // 审批人与提交人为同一人时：0 由提交人审批，1 自动跳过提交人
      setSubmitterApprovalRule(res.data?.submitterApprovalRule ?? 0);
      
      // 设置无审批人处理规则
      if (res.data?.pattern === 1) {
        setNoApprovalUserRule(res.data?.noApprovalUserRule || 0);
      } else if (res.data?.pattern === 2) {
        setTeamNoApprovalUserRule(res.data?.noApprovalUserRule || 0);
      } else if (res.data?.pattern === 3) {
        setRoleNoApprovalUserRule(res.data?.noApprovalUserRule || 0);
      }
      
      // 根据审批模式设置选中的用户/团队数据
      if (res.data?.pattern === 1) {
        // 指定成员模式
        if (res.data?.userIds?.length) {
          // 这里需要根据userIds获取用户信息，暂时用占位数据
          const mainUsers = res.data.userIds.map(item => ({
            staffId: item.id,
            staffName: item.nameCn, // 实际应该从API获取用户名
            staffAvatarUrl: item.avatarUrl,
            staffUserKey: item.userKey,
          }));
          setSelectedUsersByMode(prev => ({
            ...prev,
            main: { ...prev.main, 1: mainUsers }
          }));
        }
        // 指定人员（无审批人时）
        if (res.data?.noApprovalUserIds?.length && res.data.noApprovalUserRule === 1) {
          const fallbackUsers = res.data.noApprovalUserIds.map(item => ({
            staffId: item.id,
            staffName: item.nameCn, // 实际应该从API获取用户名
            staffAvatarUrl: item.avatarUrl,
            staffUserKey: item.userKey,
          }));
          setSelectedUsersByMode(prev => ({
            ...prev,
            fallback: { ...prev.fallback, 1: fallbackUsers }
          }));
        }
      } else if (res.data?.pattern === 2) {
        // 团队审批模式
        if (res.data?.teamIds?.length) {
          // 设置选中的团队
          const teamObjects = res.data.teamIds.map(team => ({
            teamId: team.teamId,
            teamName: team.teamName
          }));
          setSelectedUsersByMode(prev => ({
            ...prev,
            main: { ...prev.main, 2: teamObjects }
          }));
        }
        
        // 指定人员（无审批人时）
        if (res.data?.noApprovalUserIds?.length && res.data.noApprovalUserRule === 1) {
          const fallbackUsers = res.data.noApprovalUserIds.map(item => ({
            staffId: item.id,
            staffName: item.nameCn, // 实际应该从API获取用户名
            staffAvatarUrl: item.avatarUrl,
            staffUserKey: item.userKey,
          }));
          setSelectedUsersByMode(prev => ({
            ...prev,
            fallback: { ...prev.fallback, 2: fallbackUsers }
          }));
        }
      } else if (res.data?.pattern === 3) {
        // 角色审批模式 - 处理角色数据
        if (res.data?.roles?.length) {
          // 将角色数据转换为 approvalTableData 格式
          const roleDataMap = new Map();
          
          // 按工作项分组角色数据
          res.data.roles.forEach(role => {
            if (!roleDataMap.has(role.workItemId)) {
              roleDataMap.set(role.workItemId, {
                id: generateUuid(),
                workItem: role?.tag === 0 ? `${role.workItemName}[已删除]` : role.workItemName, //优化：简化条件判断，添加明确注释说明 tag=0 表示已删除状态
                workItemId: role.workItemId,
                roles: [],
                tag: role?.tag==0?0:1,
              });
            }
            
            const workItemData = roleDataMap.get(role.workItemId);
            workItemData.roles.push({
              roleId: role.roleId,
              roleName: role.roleName
            });
          });
          
          // 设置审批表格数据
          setApprovalTableData(Array.from(roleDataMap.values()));
        }
        
        // 指定人员（无审批人时）
        if (res.data?.noApprovalUserIds?.length && res.data.noApprovalUserRule === 1) {
          const fallbackUsers = res.data.noApprovalUserIds.map(item => ({
            staffId: item.id,
            staffName: item.nameCn, // 实际应该从API获取用户名
            staffAvatarUrl: item.avatarUrl,
            staffUserKey: item.userKey,
          }));
          setSelectedUsersByMode(prev => ({
            ...prev,
            fallback: { ...prev.fallback, 3: fallbackUsers }
          }));
        }
      }
    }
  };

  useEffect(() => {
    // 先同步租户模式（是否安装 ISV）再拉审批设置，避免「审批方式」晚一帧出现
    (async () => {
      await syncTenantModeInfo();
      await getApprovalSettingsData();
    })();
  }, []);

  /**
   * 加载飞书审批规则列表（接口已按 createTime 倒序）。
   *
   * 两道守卫，避免「删除/新增后列表又变回去」：
   *  1. 请求序号：await 期间用户可能已操作列表，过期响应直接丢弃；
   *  2. 本地改动：存在未点「保存设置」的本地改动时，不用接口数据覆盖内存列表。
   */
  const loadFeishuRuleList = async () => {
    const reqId = ++feishuRuleReqIdRef.current;
    const list = await fetchRuleList(getProjectKey());
    if (reqId !== feishuRuleReqIdRef.current) return;
    feishuRuleLoadedRef.current = true;
    if (feishuRuleDirtyRef.current) return;
    setFeishuRuleList(Array.isArray(list) ? list : []);
  };

  /** 切换审批方式 */
  const handleApprovalTypeChange = (type) => {
    if (type === approvalType) return;
    setApprovalType(type);
    // 只在首次进入飞书审批时拉服务端，之后切换复用内存列表，避免覆盖本地临时改动
    if (type === 2 && !feishuRuleLoadedRef.current) {
      loadFeishuRuleList();
    }
  };

  /** 打开新增 / 编辑规则弹窗 */
  const openRuleModal = (mode, rule) => {
    setRuleModalMode(mode);
    setEditingRule(rule || null);
    setRuleModalOpen(true);
  };

  /**
   * 规则弹窗保存：只改本地列表（不调后端规则接口），
   * 真实落库由页面「保存设置」调用 approval/config/save 全量覆盖完成。
   */
  const handleRuleSubmit = (rule) => {
    feishuRuleDirtyRef.current = true;
    setFeishuRuleList((prev) => {
      let next;
      if (ruleModalMode === 'edit' && editingRule) {
        const targetKey = makeRuleKey(editingRule);
        next = prev.map((item) => (makeRuleKey(item) === targetKey ? rule : item));
      } else {
        // 防御：同名同模板的规则不重复插入（即使提交防重被绕过，也不会出现两条重复行）
        const sig = ruleSignature(rule);
        const existed = prev.some((item) => ruleSignature(item) === sig);
        next = existed
          ? prev.map((item) => (ruleSignature(item) === sig ? rule : item))
          : [...prev, rule];
      }
      // 列表按创建时间倒序（最新的在最前）
      return [...next].sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')));
    });
    window.JSSDK.toast.success('保存成功');
    setRuleModalOpen(false);
    setEditingRule(null);
  };

  /** 删除规则：二次确认后只从本地列表移除 */
  const handleDeleteRule = (record) => {
    Modal.confirm({
      title: '确认删除该规则？',
      icon: <ExclamationCircleFilled style={{ color: '#faad14' }} />,
      content: '删除后，匹配该规则的工时将不再走飞书审批。',
      okText: '确认删除',
      // 确认删除按钮背景色按设计稿指定为 #F0144A
      okButtonProps: { danger: true, style: { background: '#F0144A', borderColor: '#F0144A' } },
      cancelText: '取消',
      onOk: () => {
        const recordKey = makeRuleKey(record);
        // 内容签名（仅当规则名称与模板都齐全时才参与匹配），用于清掉同名同模板的残留副本
        const recordSig =
          record?.ruleName && record?.approvalCode ? ruleSignature(record) : null;
        feishuRuleDirtyRef.current = true;
        // 三重匹配：引用相等 / 统一 key 相等 / 同名同模板 ——
        // 兼容「接口规则无 id」「本地新增」，也避免同名同模板的副本残留导致删除看起来没生效
        setFeishuRuleList((prev) =>
          prev.filter(
            (item) =>
              item !== record &&
              makeRuleKey(item) !== recordKey &&
              (recordSig ? ruleSignature(item) !== recordSig : true),
          ),
        );
      },
    });
  };

  /** 获取团队列表 */
  const getTeamList = async () => {
    const res = await getTeam();
    if (res?.result) {
      setTeamList(res.data);
      dataSource.forEach((item) => {
        item?.teamIds?.forEach((teamId, index) => {
          if (JSON.stringify(res.data).indexOf(teamId) === -1)
            item.teamIds.splice(index, 1);
        });
      });
      setDataSource(dataSource);
    }
  };
  /** 新增审批流程 */
  const handleAdd = () => {
    const newKey = dataSource.length.toString();
    setDataSource([
      ...dataSource,
      {
        key: newKey,
        approvalStageName: "工时审批",
        processingUserIds: [],
        approvalRule: "ANY",
      },
    ]);
  };

  /** 删除审批流程 */
  const handleDelete = (index) => {
    const newDataSource = [...dataSource];
    newDataSource.splice(index, 1);
    setDataSource(newDataSource);
  };

  /** 提交配置 */
  const onFinish = async () => {
    try {
      // 飞书审批：走独立保存接口，仅提交开关 + 审批方式 + 规则列表
      if (isvInstalled && approvalType === 2) {
        // 提交前按「approvalCode + ruleName」去重，避免重复行被一并提交
        const seenSignatures = new Set();
        const rules = [];
        (feishuRuleList || []).forEach((rule) => {
          const sig = ruleSignature(rule);
          if (seenSignatures.has(sig)) return;
          seenSignatures.add(sig);
          const item = {
            ruleName: rule.ruleName,
            approvalCode: rule.approvalCode,
            workItemIds: (rule.workItems || []).map((w) => w.workItemId),
            fieldMappings: rule.fieldMappings || [],
          };
          if (rule.id !== undefined && rule.id !== null) {
            item.id = rule.id;
          }
          rules.push(item);
        });
        // 校验：飞书审批 + 工时审批开关开启时，规则不能为空
        // 开关关闭（isOpen=false）时不校验、照常提交
        if (isOpen && rules.length === 0) {
          window.JSSDK.toast.error("请先添加审批规则");
          return;
        }
        const saveParam = {
          projectKey: getProjectKey(),
          approvalType: 2,
          enableApproval: isOpen ? 1 : 0,
          isReCheckAfterApprove: isReCheckOnApprove ? 1 : 0,
          rules,
        };
        // 仅飞书审批分支有 loading：调接口前置位全局 Spin，finally 里接口一返回即清除（成功/失败/异常都不卡转圈）
        setIsSubmitLoading(true);
        let feishuRes;
        try {
          feishuRes = await postApprovalConfigSave(saveParam);
        } finally {
          setIsSubmitLoading(false);
        }
        if (feishuRes?.result) {
          window.JSSDK.toast.success("设置成功");
          // 本地改动已落库：解除覆盖守卫；接口若回传了规则列表，用它（含真实 id）覆盖本地
          feishuRuleDirtyRef.current = false;
          const returned = feishuRes?.data?.rules ?? feishuRes?.data;
          // 形状校验：只接受「看起来是规则数组」的返回，避免用非规则数据覆盖列表
          const returnedRules =
            Array.isArray(returned) && returned.every((item) => item && typeof item.ruleName === 'string')
              ? returned
              : null;
          if (returnedRules) {
            feishuRuleReqIdRef.current += 1; // 作废在途的列表请求
            setFeishuRuleList(returnedRules);
          }
          props.setIsApprovalSetOpen(true);
        }
        return;
      }
      // 新增：角色审批模式 - 工作项/角色空值校验
       if (isOpen) {
      if (approvalMode === 3) {
        const newRowErrors = {};
        // 遍历所有表格行，检查工作项和角色是否为空
        approvalTableData.forEach(row => {
          const errors = {};
          // 工作项为空：未选择工作项（workItemId为空）
          if (!row.workItemId) {
            errors.workItem = true;
          }
          // 角色为空：未选择角色（roles数组长度为0）
          if (!row.roles || row.roles.length === 0) {
            errors.role = true;
          }
          // 若当前行有错误，存入newRowErrors
          if (Object.keys(errors).length > 0) {
            newRowErrors[row.id] = errors;
          }
        });
        // 更新错误状态
        setRowErrors(newRowErrors);
        // 若存在任何错误，阻止提交
        if (Object.keys(newRowErrors).length > 0) {
          message.warning("请完善所有工作项和角色配置");
          return;
        }
      }

      // 2. 检查选中审批模式的指定人员和审批人是否为空
      const hasError = approvalMode === 1 && selectedUsersByMode.main[1].length === 0;
      const hasTeamError = approvalMode === 2 && selectedUsersByMode.main[2].length === 0;
      const hasFallbackError = (approvalMode === 1 && noApprovalUserRule === 1 && selectedUsersByMode.fallback[1].length === 0) || 
                             (approvalMode === 2 && teamNoApprovalUserRule === 1 && selectedUsersByMode.fallback[2].length === 0) ||
                             (approvalMode === 3 && roleNoApprovalUserRule === 1 && selectedUsersByMode.fallback[3].length === 0);
      if (hasError || hasTeamError || hasFallbackError) {
        // 显示错误信息
        setShowError({
          main: hasError || hasTeamError,
          fallback: hasFallbackError
        });
        return; // 阻止提交
      }
      // 隐藏错误信息
      setShowError({ main: false, fallback: false });
      }
      dataSource?.forEach((item) => {
        if (item?.processingUserIds.indexOf("-222") !== -1) {
          item.processingUserIds = item.processingUserIds.filter(
            (item) => item !== "-222"
          );
        } else {
          item.teamIds = [];
        }
      });
      const data = {
        ...approvalData,
        value: isOpen ? 1 : 0,
        approvalList: dataSource,
      };
      const param = {
        "projectKey": sessionStorage.getItem("jwtMeegoTeamworkProjectKey"),
        "enableApproval": isOpen ? 1 : 0, //是否开启审批；0否，1是
        "isReCheckAfterApprove": isReCheckOnApprove ? 1 : 0, //审批通过再次校验工时；1开启(默认)，0关闭
        "approvalRule": "any", //审批规则，ALL、ANY
        "pattern": approvalMode, //审批模式；1指定成员，2团队审批，3角色审批
        "submitterApprovalRule": submitterApprovalRule, //审批人与提交人为同一人时；0由提交人审批，1自动跳过提交人
      }
      // 仅安装了 ISV（页面上才有「审批方式」）时透传审批方式；未安装时请求体与原来完全一致
      if (isvInstalled) {
        param.approvalType = 1; //审批方式；1默认（自研审批），2飞书审批
      }
      if (approvalMode === 1) {
        param.noApprovalUserRule = noApprovalUserRule //无审批人处理规则，0直接通过,1指定人员
        if (noApprovalUserRule === 1) {
          const noApprovalUserIdsArr = []
          selectedUsersByMode.fallback[1].forEach(i => {
            noApprovalUserIdsArr.push(i.staffId)
          })
          param.noApprovalUserIds = noApprovalUserIdsArr
        }
        const userIdsArr = []
        selectedUsersByMode.main[1].forEach(i => {
          userIdsArr.push(i.staffId)
        })
        param.userIds = userIdsArr
      }
      if (approvalMode === 2) {
        param.noApprovalUserRule = teamNoApprovalUserRule //无审批人处理规则，0直接通过,1指定人员
        if (teamNoApprovalUserRule === 1) {
          const teamnoApprovalUserIdsArr = []
          selectedUsersByMode.fallback[2].forEach(i => {
            teamnoApprovalUserIdsArr.push(i.staffId)
          })
          param.noApprovalUserIds = teamnoApprovalUserIdsArr
        }  
        param.teamIds = selectedUsersByMode.main[2] || [];
      }
      if (approvalMode === 3) {
        param.noApprovalUserRule = roleNoApprovalUserRule //无审批人处理规则，0直接通过,1指定人员
        if (roleNoApprovalUserRule === 1) {
          const roleNoApprovalUserIdsArr = []
          selectedUsersByMode.fallback[3].forEach(i => {
            roleNoApprovalUserIdsArr.push(i.staffId)
          })
          param.noApprovalUserIds = roleNoApprovalUserIdsArr
        }
        let roleArr = []
        approvalTableData.forEach(i => {
          i.roles.forEach(j => {
            roleArr.push({
              "id": 0,
              "workItemId": i.workItemId,
              "workItemName": i?.tag==0?i.workItem.replace(/\[已删除\]/g, ''):i.workItem,
              "roleId": j.roleId,
              "roleName": j.roleName,
            })
          })
        })
        param.roles = roleArr
      }
      const res = await postApprovalConfigInfo(param);
      if (res?.result) {
        window.JSSDK.toast.success("设置成功");
        props.setIsApprovalSetOpen(true);
      }
      // const res = await getProjectConfig({
      //   type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
      // });
      // if (res?.result) {
      //   if (res.data?.value) {
      //     Modal.confirm({
      //       title: "确认关闭 [允许管理员代填] ？",
      //       icon: <ExclamationCircleFilled />,
      //       content:
      //         "工时审批开启时，无法开启 [ 允许管理员代填 ] ，是否确认关闭 [ 允许管理员代填 ] 设置？",
      //       closeIcon: <CloseOutlined />,
      //       okText: "确定",
      //       cancelText: "取消",
      //       async onOk() {
      //         const res = await postApprovalConfigInfo(param);
      //         if (res?.result) {
      //           window.JSSDK.toast.success("设置成功");
      //           props.setIsApprovalSetOpen(true);
      //         }
      //       },
      //       onCancel() {
      //         // window.JSSDK.toast.success('操作成功');
      //       },
      //     });
      //   } else {
      //     const res = await postApprovalConfigInfo(param);
      //     if (res?.result) {
      //       window.JSSDK.toast.success("设置成功");
      //       props.setIsApprovalSetOpen(true);
      //     }
      //   }
      // }
    } catch (errorInfo) {
      //console.log("表单校验失败:", errorInfo);
      //window.JSSDK.toast.error("表单校验失败，请检查输入");
    }
  };

  // 修改工作项变更处理函数，添加获取角色数据的逻辑
  const handleWorkItemChange = (value, record) => {
    const newData = [...approvalTableData];
    const index = newData.findIndex(item => item.id === record.id);
    
    if (index !== -1) {
      // 处理工作项数据
      if (typeof value === 'object' && value !== null) {
        newData[index].workItem = value.label;
        newData[index].workItemId = value.value;
      } else {
        newData[index].workItem = value;
        const option = workItemOptions.find(opt => opt.label === value || opt.value === value);
        if (option) {
          newData[index].workItemId = option.value;
        }
      }
      setApprovalTableData(newData);
      
      // 清除当前行的角色选择（因为工作项变了）
      newData[index].roles = [];
      setApprovalTableData([...newData]);
      
      // 新增：清除当前行的工作项错误
      setRowErrors(prev => {
        const currentRowErrors = prev[record.id] || {};
        // 若工作项已选择（value存在），删除workItem错误标记
        if (value) {
          delete currentRowErrors.workItem;
        }
        // 若当前行已无其他错误，删除整行的错误记录
        return Object.keys(currentRowErrors).length > 0 
          ? { ...prev, [record.id]: currentRowErrors } 
          : { ...prev, [record.id]: undefined };
      });

      // 如果选择了工作项，根据工作项ID获取角色数据
      if (newData[index].workItemId) {
        fetchRolesByWorkItemId(newData[index].workItemId, record.id); // 修改这里，使用record.id作为rowId
      } else {
        // 清除角色选项
        setRowRoleOptions(prev => ({
          ...prev,
          [record.id]: []
        }));
      }
    }
  };
  
  // 新增：根据工作项ID获取角色数据的函数
  const fetchRolesByWorkItemId = async (workItemId, rowId) => {
    try {
      // 设置当前行的加载状态
      setRowRoleLoading(prev => ({
        ...prev,
        [rowId]: true
      }));
      // 调用API获取角色数据
      const res = await getWorkitemRole({ workItemId: workItemId, roleName: "" });
      if (res?.result && res?.data) {
        // 保存获取到的角色数据
        setRowRoleOptions(prev => ({
          ...prev,
          [rowId]: res.data.map(role => ({
            label: role.roleName, // 假设返回数据中有roleName字段
            value: role.roleId // 假设返回数据中有roleId字段
          }))
        }));
      } else {
        setRowRoleOptions(prev => ({
          ...prev,
          [rowId]: []
        }));
      }
    } catch (error) {
      console.error('获取角色数据失败:', error);
      setRowRoleOptions(prev => ({
        ...prev,
        [rowId]: []
      }));
    } finally {
      // 无论成功失败，都要清除加载状态
      setRowRoleLoading(prev => ({
        ...prev,
        [rowId]: false
      }));
    }
  };
  
  // 新增：角色搜索函数（防抖）
  const handleRoleSearch = debounce(async (value, workItemId, rowId) => {
    try {
      // 设置当前行的搜索加载状态
      setRoleSearchLoading(prev => ({
        ...prev,
        [rowId]: true
      }));
      
      // 保存搜索关键词
      setSearchKeyword(prev => ({
        ...prev,
        [rowId]: value
      }));
      
      // 如果搜索关键词为空或者没有工作项ID，显示所有角色
      if (!value.trim() || !workItemId) {
        // 调用获取所有角色的函数
        fetchRolesByWorkItemId(workItemId, rowId);
        return;
      }
      
      // 调用API搜索角色
      const res = await getWorkitemRole({ 
        workItemId: workItemId, 
        roleName: value.trim() 
      });
      
      if (res?.result && res?.data) {
        // 保存搜索结果
        setRowRoleOptions(prev => ({
          ...prev,
          [rowId]: res.data.map(role => ({
            label: role.roleName,
            value: role.roleId
          }))
        }));
      } else {
        setRowRoleOptions(prev => ({
          ...prev,
          [rowId]: []
        }));
      }
    } catch (error) {
      console.error('搜索角色失败:', error);
      setRowRoleOptions(prev => ({
        ...prev,
        [rowId]: []
      }));
    } finally {
      // 清除搜索加载状态
      setRoleSearchLoading(prev => ({
        ...prev,
        [rowId]: false
      }));
    }
  }, 300);
  
  // 修改角色变更处理函数
  const handleRolesChange = (values, record) => {
    const newData = [...approvalTableData];
    const index = newData.findIndex(item => item.id === record.id);
    
    if (index !== -1) {
      // 检查values的类型以确定如何处理
      if (values && values.length > 0 && typeof values[0] === 'object') {
        // 如果values是对象数组，转换为 {roleId: value, roleName: label} 格式
        newData[index].roles = values.map(v => ({
          roleId: v.value,
          roleName: v.label
        }));
      } else {
        // 如果values是简单值数组
        const currentOptions = rowRoleOptions[record.id] || [];
        newData[index].roles = values.map(role => {
          const option = currentOptions.find(opt => opt.label === role || opt.value === role);
          return {
            roleId: option ? option.value : role,
            roleName: option ? option.label : role
          };
        });
      }
      
      // 移除旧的roleIds字段
      delete newData[index].roleIds;
      setApprovalTableData(newData);

      // 新增：清除当前行的角色错误
      setRowErrors(prev => {
        const currentRowErrors = prev[record.id] || {};
        // 若角色已选择（values长度>0），删除role错误标记
        if (values && values.length > 0) {
          delete currentRowErrors.role;
        }
        // 若当前行已无其他错误，删除整行的错误记录
        return Object.keys(currentRowErrors).length > 0 
          ? { ...prev, [record.id]: currentRowErrors } 
          : { ...prev, [record.id]: undefined };
      });
    }
  };

  // 修改添加行函数，确保新行包含所有必要字段
  const handleAddRow = () => {
    const newRow = {
      id: generateUuid(),
      workItem: '',
      workItemId: '',
      roles: [],
      tag:1
    };
    setApprovalTableData([...approvalTableData, newRow]);
  };

  const handleDeleteRow = (record) => {
    // 至少保留一行
    if (approvalTableData.length <= 1) {
      // 显示提示信息或禁用删除按钮
      return;
    }
    const newData = approvalTableData.filter(item => item.id !== record.id);
    setApprovalTableData(newData);
    
    // 删除行时清除对应的错误信息
    setRowErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[record.id];
      return newErrors;
    });
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
    const newUsers = selectedApprovalUsers.filter(user => user.staffId !== userId);
    setSelectedApprovalUsers(newUsers);
  };
  /** 打开选择人员弹窗 */
  const onSelectedUserOpen = (userListType = 'main') => {
    setCurrentUserListType(userListType);
    setIsSelectedUserOpen(true);

    // 根据当前模式和类型设置初始选中状态
    const currentData = userListType === 'fallback'
      ? selectedUsersByMode.fallback[approvalMode]
      : selectedUsersByMode.main[approvalMode];

    // 深拷贝避免直接修改状态
    // 提取staffId设置selectedUserIds
    const selectedUserIds = currentData.map(user => user.staffId || user.staffUserKey);

    setSelected({
      selectedDeparts: [],
      selectedUsers: JSON.parse(JSON.stringify(currentData)),
      selectedDepartIds: [],
      selectedUserIds: selectedUserIds,
      checkedKeys: [],
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

  /** 确定选择人员 */
 const onSelectedUserOk = () => {
    if(selected.selectedUsers.length>10){
      message.error('不能超过10人');
      return;
    }
    setIsSelectedUserOpen(false);
    
    // 根据当前模式和类型保存数据
    setSelectedUsersByMode(prev => ({
      ...prev,
      [currentUserListType]: {
        ...prev[currentUserListType],
        [approvalMode]: JSON.parse(JSON.stringify(selected.selectedUsers))
      }
    }));
    
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
  /** 团队筛选 */
  const onSearchTeamChange = async (teams) => {
    // 更新选中的团队数据
    setSelectedUsersByMode(prev => ({
      ...prev,
      main: {
        ...prev.main,
        2: teams.map(team => ({
          teamId: team.value,
          teamName: team.label.replace("[已删除]", "")
        }))
      }
    }));
    // 清除团队审批的错误状态
    if (teams.length > 0 && showError.main) {
      setShowError(prev => ({
        ...prev,
        main: false
      }));
    }
  };
    /** 手动删除工作项类型 */
  const debouncedWorkItemDeselect = useCallback(
    debounce((delVal) => {
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
    []
  );

  // 解决未定义的状态问题
  const [searchWorkItemIds, setSearchWorkItemIds] = useState([]);
  const [workItemIds, setWorkItemIds] = useState([]);
  const [workItemIdsFilter, setWorkItemIdsFilter] = useState([]);
  const [isOnDeselect, setIsOnDeselect] = useState(false);
  const [isWorkItemChanged, setIsWorkItemChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  return (
    // 保存飞书审批配置时的全局 loading（与 StandardsSet 同款 Spin 包裹模式），遮罩覆盖整块设置区并拦截点击
    <Spin spinning={isSubmitLoading}>
    <div className="approval-set-warp">
      <div className="approval-set-top">
        <div>
          <div className="approval-set-label">工时审批 
            <Switch
            size="small"
            checked={isOpen}
            onChange={(e) => {
              setIsOpen(e);
            }}
          />
          </div>
          <div className="approval-set-des">
            开启后，符合条件的 [登记工时] 自动生成工时审批，此类 [登记工时]需通过审批才有效
          </div>
        </div>
        <div>
        </div>
      </div>
      <div className="approval-head-line" style={{marginBottom:isOpen ?'20px':'8px'}}></div>
      {isOpen ? (
        <div className="approval-set-content">
          {/* 审批通过再次校验工时：随「工时审批」开启而展示，自研 / 飞书两种方式通用 */}
          <div className="approval-recheck-section">
            <div className="approval-set-label">
              审批通过再次校验工时
              <Switch
                size="small"
                checked={isReCheckOnApprove}
                onChange={(e) => setIsReCheckOnApprove(e)}
              />
            </div>
            <div className="approval-set-des">
              开启后，审批通过时进行工时校验，关闭则不进行任何的校验
            </div>
          </div>
          {/* 审批方式：仅安装了 ISV 才展示。未安装时整块不渲染，下方仍是原有的自研审批配置 */}
          {isvInstalled && (
            <div className="approval-type-section">
              <div className="section-title approval-title-f16" style={{ paddingTop: '0' }}>审批方式</div>
              <div className="approval-type-cards">
                <div
                  className={`approval-type-card${approvalType === 1 ? ' approval-type-card-active' : ''}`}
                  onClick={() => handleApprovalTypeChange(1)}
                >
                  <span className="approval-type-card-icon"><img src={ziyanIcon} alt="系统内置审批" /></span>
                  <span className="approval-type-card-title">系统内置审批</span>
                  <Radio checked={approvalType === 1} className="approval-type-card-radio" />
                </div>
                <div
                  className={`approval-type-card${approvalType === 2 ? ' approval-type-card-active' : ''}`}
                  onClick={() => handleApprovalTypeChange(2)}
                >
                  <span className="approval-type-card-icon"><img src={feishuShenpiIcon} alt="飞书审批" /></span>
                  <span className="approval-type-card-title">飞书审批</span>
                  <Radio checked={approvalType === 2} className="approval-type-card-radio" />
                </div>
              </div>
            </div>
          )}
          {isvInstalled && approvalType === 2 ? (
            <div className="feishu-approval-section">
              <div className="feishu-approval-header">
                <div className="section-title approval-title-f16" style={{ paddingTop: '0' }}>飞书审批设置</div>
                <Button onClick={() => openRuleModal('add')}>添加审批规则</Button>
              </div>
              <Table
                dataSource={feishuRuleList}
                rowKey={(record) => makeRuleKey(record)}
                pagination={false}
                columns={[
                  { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName' },
                  {
                    title: '工作项',
                    dataIndex: 'workItems',
                    key: 'workItems',
                    render: (_, record) => (record.workItems || []).map((w) => w.workItemName).join('、'),
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 120,
                    render: (_, record) => (
                      <Space>
                        <a onClick={() => openRuleModal('edit', record)}>编辑</a>
                        <a onClick={() => handleDeleteRule(record)}>删除</a>
                      </Space>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
          <>
          <div className="approval-mode-section">
            <div className="section-title approval-title-f14" style={{ paddingTop: '0' }}>审批模式</div>
            <div className="approval-mode-options">
              <Radio.Group
                name="approvalMode"
                value={approvalMode}
                onChange={(e) => setApprovalMode(e.target.value)}
              >
                <Radio value={1}>指定成员</Radio>
                <Radio value={2}>团队审批</Radio>
                <Radio value={3}>角色审批</Radio>
              </Radio.Group>
            </div>
          </div>

          {/* 指定成员模式 */}
          {approvalMode === 1 && (
            <div className="approval-config-section">

              <div className="config-item">
                <div className="config-label approval-title-f14">审批人<span className="approval-set-tip">（不能超过10人）</span></div>
                <div className="config-value">
                  <div className="approval-users-container">
                    <span className="add-user-btn" onClick={() => onSelectedUserOpen('main')}>
                      <PlusOutlined style={{ color: '#646A73' }} />
                    </span>
                    {selectedUsersByMode.main[1].map(user => (
                      <div key={user.staffUserKey} className="approval-user-tag">
                        {/* <Avatar src={user.staffAvatarUrl} size={26} />
                        <span className="user-name">{user.staffName}</span> */}
                        {user.staffUserKey?<UserTag userId={user.staffUserKey} />:null}
                        <span className="remove-user-btn" onClick={() => {
                          setSelectedUsersByMode(prev => ({
                            ...prev,
                            main: {
                              ...prev.main,
                              1: prev.main[1].filter(u => (u.staffUserKey || u.id) !== (user.staffUserKey || user.id))
                            }
                          }));
                        }}>
                          <CloseOutlined />
                        </span>
                      </div>
                    ))}
                  </div>
                   {showError.main && <div className="approval-set-error">至少要有一位默认审批人</div>}
                </div>
              </div>
              <div className="config-item">
                <div className="config-label approval-title-f14">多人审批时采用的审批方式</div>
                <div className="config-value">
                  <Radio.Group defaultValue="ANY">
                    <Radio value="ANY">或签<span className="approval-set-tip">（任一审批人同意即可）</span></Radio>
                  </Radio.Group>
                </div>
              </div>
              <div className="config-item">
                <div className="config-label approval-title-f14">
                  审批人为空时
                  <Tooltip
                    title={
                      <>
                        <div>什么情况下会出现审批人为空？</div>
                        <div>1. 设置了「自动跳过提交人」，且审批人中除提交人外没有其他成员</div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="icon" />
                  </Tooltip>
                </div>
                <div className="config-value">
                  <Radio.Group value={noApprovalUserRule}
                    onChange={(e) => setNoApprovalUserRule(e.target.value)}
                  >
                    <Radio value={0}>自动通过</Radio>
                    <Radio value={1}>指定人员审批</Radio>
                  </Radio.Group>
                </div>
                {noApprovalUserRule === 1 && (
                  <div className="config-item">
                    <div className="config-label approval-title-f14" style={{ fontSize: '14px' }}>指定人员<span className="approval-set-tip">（不能超过10人）</span></div>
                    <div className="config-value">
                      <div className="approval-users-container">
                        <span className="add-user-btn" onClick={() => onSelectedUserOpen('fallback')}>
                          <PlusOutlined style={{ color: '#646A73' }} />
                        </span>
                        {selectedUsersByMode.fallback[1].map(user => (
                          <div key={user.staffUserKey} className="approval-user-tag">
                            {user.staffUserKey ? <UserTag userId={user.staffUserKey} /> : null}
                            <span className="remove-user-btn" onClick={() => {
                              setSelectedUsersByMode(prev => ({
                                ...prev,
                                fallback: {
                                  ...prev.fallback,
                                  1: prev.fallback[1].filter(u => (u.staffUserKey || u.id) !== (user.staffUserKey || user.id))
                                }
                              }));
                            }}>
                              <CloseOutlined />
                            </span>
                          </div>
                        ))}
                      </div>
                      {showError.fallback && <div className="approval-set-error">至少要有一位默认审批人</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 团队审批模式 */}
          {approvalMode === 2 && (
            <div className="approval-config-section">
              <div className="config-item">
                <div className="config-label approval-title-f14">启用团队<span className="approval-set-tip">（未配置的团队，成员提交工时无需审批）</span></div>
                <div className="config-value">
                  <TeamPicker
                    type="Gantt"
                    mode="multiple"
                    selectTeamList={selectedUsersByMode.main[2]|| []}
                    placeholder="搜索团队"
                    getUserIds={onSearchTeamChange}
                    value={selectedUsersByMode.main[2]?.map(team => team.teamId) || []}
                  />
                  {showError.main && approvalMode === 2 && <div className="approval-set-error">至少选择一个团队</div>}
                </div>
              </div>
              <div className="config-item">
                <div className="config-label approval-title-f14" style={{display: 'flex',alignItems: 'center'}}>
                  审批人
                  <Tooltip title="仅所属团队管理员能查看和审批自己团队成员的工时审批数据，若用户属于多个团队，则这些团队的管理员均可查看并审批该用户的工时数据">
                      <InfoCircleFilled />
                  </Tooltip>
                </div>
                <div className="config-value">
                  <Radio.Group defaultValue="teamManager">
                    <Radio value="teamManager">团队管理员</Radio>
                  </Radio.Group>
                </div>
              </div>
              <div className="config-item">
                <div className="config-label approval-title-f14">多人审批时采用的审批方式</div>
                <div className="config-value">
                  <Radio.Group defaultValue="ANY">
                    <Radio value="ANY">或签<span className="approval-set-tip">（任一审批人同意即可）</span></Radio>
                  </Radio.Group>
                </div>
              </div>
              <div className="config-item">
                <div className="config-label approval-title-f14">
                  审批人为空时
                  <Tooltip
                  title={
                    <>
                      <div>什么情况下会出现审批人为空？</div>
                      <div>1. 设置了「团队」审批，但提交人并非该空间授权的任何团队成员</div>
                      <div>2. 设置了「自动跳过提交人」，且跳过后没有其他团队成员可审批</div>
                    </>
                  }
                >
                  <InfoCircleFilled className="icon" />
                </Tooltip>
                </div>
                <div className="config-value">
                  <Radio.Group value={teamNoApprovalUserRule} onChange={(e) => setTeamNoApprovalUserRule(e.target.value)}>
                    <Radio value={0}>自动通过</Radio>
                    <Radio value={1}>指定人员审批</Radio>
                  </Radio.Group>
                </div>
                {teamNoApprovalUserRule === 1 && (
                  <div className="config-item">
                    <div className="config-label approval-title-f14" style={{ fontSize: '14px' }}>指定人员<span className="approval-set-tip">（不能超过10人）</span></div>
                    <div className="config-value">
                      <div className="approval-users-container">
                        <span className="add-user-btn" onClick={() => onSelectedUserOpen('fallback')}>
                          <PlusOutlined style={{ color: '#646A73' }} />
                        </span>
                        {selectedUsersByMode.fallback[2].map(user => (
                          <div key={user.staffUserKey} className="approval-user-tag">
                            {/* <Avatar src={user.staffAvatarUrl} size={26} />
                            <span className="user-name">{user.staffName}</span> */}
                             {user.staffUserKey?<UserTag userId={user.staffUserKey} />:null}
                            <span className="remove-user-btn" onClick={() => {
                              setSelectedUsersByMode(prev => ({
                                ...prev,
                                fallback: {
                                  ...prev.fallback,
                                  2: prev.fallback[2].filter(u => u.staffUserKey !== user.staffUserKey)
                                }
                              }));
                            }}>
                              <CloseOutlined />
                            </span>
                          </div>
                        ))}
                      </div>
                       {showError.fallback && <div className="approval-set-error">至少有有一位默认审批人</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 角色审批模式 */}
          {approvalMode === 3 && (
            <div className="approval-config-section">
              <div className="role-approval-list">
                {roleApprovalData.map((item, index) => (
                  <div key={index} className="role-approval-item">
                    <div className="config-item">
                      <div className="approval-table-container">
                        <div className="approval-table-header">
                          <div className="header-title approval-title-f14" style={{paddingBottom: '6px',display: 'flex',alignItems: 'center'}}>
                            配置审批人
                            <Tooltip title="工作项实例的工时审批人，由配置中选定的工作项角色决定。系统会自动从每个工作项实例中，获取这些角色对应的成员作为审批人。
未配置的工作项，登记工时无需审批">
                              <InfoCircleFilled />
                            </Tooltip>
                            </div>
                        </div>
                        <Table
                          footer={() => (
                            <div className="add-row-container">
                              <span onClick={handleAddRow}>
                                <img src={addIcon} alt="添加" width={18} className="add-role-row"/>
                                添加
                              </span>
                            </div>
                          )}
                          bordered
                          dataSource={approvalTableData}
                          pagination={false}
                          rowKey="id"
                          columns={[
                            {
                              title: '工作项',
                              dataIndex: 'workItem',
                              key: 'workItem',
                              render: (_, record) => (
                                <div>
                                  <Select
                                    placeholder="请选择工作项"
                                    labelInValue
                                    // 支持按工作项名称模糊搜索（本地过滤，不区分大小写）
                                    showSearch
                                    optionFilterProp="label"
                                    value={record.workItem ? { label: record.workItem, value: record.workItemId } : undefined}
                                    onChange={(value) => handleWorkItemChange(value, record)}
                                    style={{ width: '100%' }}
                                    options={workItemOptions.map(option => ({
                                      ...option,
                                      // 如果工作项已在其他行中选择，则禁用它
                                      disabled: approvalTableData.some(row => 
                                        row.id !== record.id && row.workItemId === option.value
                                      )
                                    }))}
                                    // 新增：若当前行工作项有错误，添加红色边框样式
                                    className={rowErrors[record.id]?.workItem ? "approval-error-select" : ""}
                                    // 将暂无数据提示文本改为暂无工作项
                                    notFoundContent="暂无工作项"
                                  />
                                  {/* 新增：工作项为空时显示错误提示 */}
                                  {rowErrors[record.id]?.workItem && (
                                    <div className="approval-set-error" style={{ marginTop: 4, fontSize: 12 }}>
                                      请选择工作项
                                    </div>
                                  )}
                                </div>
                              )
                            },
                            {
                              title: '角色（可多选）',
                              dataIndex: 'roles',
                              key: 'roles',
                              render: (_, record) => (
                                <div>
                                  <Select
                                    placeholder={!record.workItemId ? "请先选择工作项" : "请选择角色(可多选)"}
                                    mode="multiple"
                                    labelInValue
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
                                    disabled={!record.workItemId || rowRoleLoading[record.id]}
                                    value={record.roles.length > 0 
                                      ? record.roles.map(role => ({
                                          label: role.roleName,
                                          value: role.roleId
                                        }))
                                      : undefined
                                    }
                                    onChange={(values) => handleRolesChange(values, record)}
                                    style={{ width: '100%' }}
                                    maxTagCount="responsive"
                                    options={rowRoleOptions[record.id] || []}
                                    allowClear
                                    showSearch
                                    // 移除本地过滤filterOption，添加onSearch调用接口搜索
                                    onSearch={(value) => handleRoleSearch(value, record.workItemId, record.id)}
                                    loading={roleSearchLoading[record.id]}
                                    notFoundContent={!record.workItemId ? "请先选择工作项" : (roleSearchLoading[record.id] ? <Spin size="small" /> : "暂无角色")}
                                    // 新增：若当前行角色有错误，添加红色边框样式
                                    className={rowErrors[record.id]?.role ? "approval-error-select" : ""}
                                  />
                                  {/* 新增：角色为空时显示错误提示 */}
                                  {rowErrors[record.id]?.role && (
                                    <div className="approval-set-error" style={{ marginTop: 4, fontSize: 12 }}>
                                      请选择角色
                                    </div>
                                  )}
                                </div>
                              )
                            },
                            {
                              title: '操作',
                              key: 'action',
                              width: '70px',
                              render: (_, record) => (
                                <div className="action-buttons" onClick={() => handleDeleteRow(record)}>
                                  <span
                                    className={approvalTableData.length <= 1 ? 'delete-disabled' : 'delete-show'}
                                  >
                                    删除
                                  </span>
                                </div>
                              )
                            }
                          ]}
                          scroll={{ y: '250px' }}
                        />

                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="config-item">
                <div className="config-label approval-title-f14" style={{paddingTop:'8px'}}>多人审批时采用的审批方式</div>
                <div className="config-value">
                  <Radio.Group defaultValue="ANY">
                    <Radio value="ANY">或签<span className="approval-set-tip">（任一审批人同意即可）</span></Radio>
                  </Radio.Group>
                </div>
              </div>
              <div className="config-item">
                <div className="config-label approval-title-f14">
                  审批人为空时
                   <Tooltip
                  title={
                    <>
                      <div>什么情况下会出现审批人为空？</div>
                      <div>1. 设置了「角色」审批，但该角色在工作项实例中没有分配任何成员</div>
                      <div>2. 设置了「自动跳过提交人」，且跳过后没有其他角色成员可审批</div>
                    </>
                  }
                >
                  <InfoCircleFilled className="icon" />
                </Tooltip>
                </div>
                <div className="config-value">
                  <Radio.Group value={roleNoApprovalUserRule} onChange={(e) => setRoleNoApprovalUserRule(e.target.value)}>
                    <Radio value={0}>自动通过</Radio>
                    <Radio value={1}>指定人员审批</Radio>
                  </Radio.Group>
                </div>
                {roleNoApprovalUserRule === 1 && (
                  <div className="config-item">
                    <div className="config-label approval-title-f16" style={{ fontSize: '14px' }}>指定人员<span className="approval-set-tip">（不能超过10人）</span></div>
                    <div className="config-value">
                      <div className="approval-users-container">
                        <span className="add-user-btn" onClick={() => onSelectedUserOpen('fallback')}>
                          <PlusOutlined style={{ color: '#646A73' }} />
                        </span>
                        {selectedUsersByMode.fallback[3].map(user => (
                          <div key={user.staffUserKey} className="approval-user-tag">
                            {/* <Avatar src={user.staffAvatarUrl} size={26} />
                            <span className="user-name">{user.staffName}</span> */}
                            {user.staffUserKey?<UserTag userId={user.staffUserKey} />:null}
                            <span className="remove-user-btn" onClick={() => {
                              setSelectedUsersByMode(prev => ({
                                ...prev,
                                fallback: {
                                  ...prev.fallback,
                                  3: prev.fallback[3].filter(u => u.staffUserKey !== user.staffUserKey)
                                }
                              }));
                            }}>
                              <CloseOutlined />
                            </span>
                          </div>
                        ))}
                      </div>
                      {showError.fallback && <div className="approval-set-error">至少有有一位默认审批人</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="approval-config-section approval-same-user-section">
            <div className="config-item">
              <div className="config-label approval-title-f14">审批人与提交人为同一人时</div>
              <div className="config-value">
                <Radio.Group
                  value={submitterApprovalRule}
                  onChange={(e) => setSubmitterApprovalRule(e.target.value)}
                >
                  <Radio value={0}>由提交人对自己审批</Radio>
                  <Radio value={1}>
                    自动跳过提交人
                    <Tooltip
                      title={
                        <>
                          <div>提交人不能审批自己</div>
                          <div>如果还有其他审批人，则交由其他审批人进行审批</div>
                          <div>如果没有其他审批人，则走审批人为空逻辑</div>
                        </>
                      }
                    >
                      <InfoCircleFilled className="approval-same-user-tip" />
                    </Tooltip>
                  </Radio>
                </Radio.Group>
              </div>
            </div>
          </div>
          </>
          )}
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
          >
            <SelectedUser
              type="authority"
              getSelectedUser={getSelectedUser}
              selectedUser={selected}
              allStaff="1"
            />
          </Modal>
          {/* 飞书审批规则：新建 / 编辑弹窗（保存只写本地列表，由「保存设置」统一提交） */}
          {isvInstalled && (
            <RuleEditModal
              open={ruleModalOpen}
              mode={ruleModalMode}
              rule={editingRule}
              ruleList={feishuRuleList}
              projectKey={getProjectKey()}
              onCancel={() => {
                setRuleModalOpen(false);
                setEditingRule(null);
              }}
              onSubmit={handleRuleSubmit}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '24px 0 8px' }}>
            <Space size="middle">
              <Button type="primary" onClick={onFinish}>保存设置</Button>
            </Space>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '24px 0 8px' }}>
          <Space size="middle">
            <Button type="primary" onClick={onFinish}>保存设置</Button>
          </Space>
        </div>
      )}
    </div>
    </Spin>
  );
};
export default ApprovalSet;
function DebounceSelect(_a) {
  var { fetchOptions, debounceTimeout = 300 } = _a,
    props = __rest(_a, ["fetchOptions", "debounceTimeout"]);
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState([]);
  const fetchRef = useRef(0);

  const debounceFetcher = useMemo(() => {
    const loadOptions = (value) => {
      fetchRef.current += 1;
      const fetchId = fetchRef.current;
      setOptions([]);
      setFetching(true);
      fetchOptions(value).then((newOptions) => {
        if (fetchId !== fetchRef.current) {
          // for fetch callback order
          return;
        }
        setOptions(newOptions);
        setFetching(false);
      });
    };
    return debounce(loadOptions, debounceTimeout);
  }, [fetchOptions, debounceTimeout]);

  useEffect(() => {
    onfocus();
  }, []);

  useEffect(() => {
    if (props?.options?.length) setOptions(props?.options);
  }, [props?.options]);

  const onfocus = () => {
    setFetching(true);
    fetchOptions("").then((newOptions) => {
      setOptions(newOptions);
      setFetching(false);
    });
  };

  return (
    <Select
      labelInValue
      // onFocus={onfocus}
      filterOption={false}
      onSearch={debounceFetcher}
      notFoundContent={fetching ? <Spin size="small" /> : "暂无数据"}
      {...props}
      options={options}
      optionRender={(option) => (
        <div style={{ display: "flex", alignItems: "center" }}>
          {option.label}
        </div>
      )}
    />
  );
}
function fetchTeamList(username) {
  return __awaiter(this, void 0, void 0, function* () {
    return getTeam({ teamName: username }).then((res) => {
      const results = Array.isArray(res.data) ? res.data : [];
      return results.map((item) => ({
        label: item.teamName,
        value: item.teamId,
      }));
    });
  });
}

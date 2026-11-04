import React, { useState, useEffect, useRef } from "react";
import {
  DatePicker,
  Table,
  Button,
  Cascader,
  Modal,
  Space,
  message,
  Avatar,
  Dropdown,
  Checkbox,
  Tooltip,
  Form,
  Input,
} from "antd";
import {
  UserOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
  DownOutlined,
  RightCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  urlDownload,
  isNumber,
  handleModifyType,
  goWorkItemHref,
  getApproveStatusTag,
  canShowTenantAdminFeature
} from "../../../../util/util";
import {
  getWorkItemOption,
  getEntityNodeOption,
  getLastStatCondition,
  postQueryNodeWorkHour,
  postDeleteNodeWorkHour,
  postDeleteNodeWorkHourBatch,
  postExportNodeWorkHour,
  getExportNodeWorkHourResult,
  getApprovalSettings,
  getApproveDetailList,
  querySeatUserPermission,
  queryNeedShowTeamConfig,
  getRegisterableLevelMap
} from "../../../../api/api";
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegBtn from "../../components/reg-btn/RegBtn";
import SelectedUser from "../../components/team-settings/TeamSettings";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import WorkNodeCascader from "../../components/workNode-cascader/WorkNodeSelect";
import { SeatPermissionsModal } from '../../components/seat-permissions-modal/SeatPermissionsModal';
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from '../../hooks/useTenantCustomFieldConfig';
import axios from "axios";
import { UserTag } from '@lark-project/ui-kit-plugin';
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;

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

const Log = (props) => {
  const [beginTime, setBeginTime] = useState(
    localStorage.getItem("logBeginTime") || getFirstDayOfNaturalMonth()
  );
  const [endTime, setEndTime] = useState(
    localStorage.getItem("logEndTime") || getLastDayOfNaturalMonth
  );
  const [workItem, setWorkItem] = useState([]);
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [configApproval, setConfigApproval] = useState({});
  const [logLoading, setLogLoading] = useState(false);
  const [isApprovalInfoOpen, setIsApprovalInfoOpen] = useState(false);
  const dropdownItems = [
    {
      key: 0,
      onClick: () => onDropdownChange(0),
      label: "团队统计",
    },
    {
      key: 1,
      onClick: () => onDropdownChange(1),
      label: "个人统计",
    },
  ];
  const [currDropdownIndex, setCurrDropdownIndex] = useState(0);
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
  const [selected, setSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDeptIds: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    selectedDeptMemberIds: [],
    selectedDepts: [],
    checkedKeys: []
  });
  const [newSelected, setNewSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDeptIds: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    selectedDeptMemberIds: [],
    selectedDepts: [],
    checkedKeys: []
  });
  const [isSynchronous, setIsSynchronous] = useState(Boolean);
  const [isSelectedTeamAdmin, setIsSelectedTeamAdmin] = useState(false);
  const [logList, setLogList] = useState({
    nodeWorkHours: [],
    total: 0,
    pageNo: 1,
    pageSize: 10,
    total: 0,
  });
  const [logPagination, setLogPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [currItem, setCurrItem] = useState({});
  const [exportLoading, setExportLoading] = useState(false);
  // 批量删除：已选行与请求 loading
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [isApprove, setIsApprove] = useState(false);
  const [approvalNo, setApprovalNo] = useState("");
  const [registrationObject, setRegistrationObject] = useState("");
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [chatUrl, setChatUrl] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState();
  const [modalResponseData, setModalResponseData] = useState(undefined);
  const [showTeamConfig, setShowTeamConfig] = useState(false);
  const [removeTeamIds, setRemoveTeamIds] = useState([]);
  const [removeDepartmentIds, setRemoveDepartmentIds] = useState([]);
  const [removeUserIds, setRemoveUserIds] = useState([]);
  const [isAllUser, setIsAllUser] = useState(false);
  const [isAllTeam, setIsAllTeam] = useState(false);
  const isPersonal = useRef(false)
  const isInstalledIsv = useRef(false)
  const passParam = useRef(0)
  const {
    fieldName: customFieldName,
    showCustomField,
    loading: customFieldConfigLoading,
  } = useTenantCustomFieldConfig();
  const getTenantModeInfo = async () => {
    const raw = sessionStorage.getItem("tenantModeInfo");
    if (raw) {
      const tenantModeInfo = JSON.parse(raw);
      isInstalledIsv.current = tenantModeInfo.install;
    }
  }
  const onDelLogClick = async (item) => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true); // 显示模态框
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    Modal.confirm({
      title: "确定删除？",
      icon: <ExclamationCircleFilled />,
      content: item?.tag === 0 ? "此登记对象已删除，删除可能影响数据准确性，此操作不可恢复。" : "您即将删除该条记录，此操作不可撤销。",
      closeIcon: <CloseOutlined />,
      okText: configApproval?.enableApproval ? "提交审批" : "确定",
      cancelText: "取消",
      async onOk() {
        const data = {
          id: item.id,
          taskHourId: item.taskHourId,
        };
        const res = await postDeleteNodeWorkHour(data);
        if (res?.result) {
          fetchData(registrationObject);
          window.JSSDK.toast.success("删除成功");
        }
      },
      onCancel() {
        // window.JSSDK.toast.success('操作成功');
      },
    });
  };

  /** 复选框禁用判断：无删除权限 / 审批中 / 已删除对象且非租户管理员 */
  const isRowDeleteDisabled = (record) => {
    if (!record?.operationList?.includes("DELETE")) return true;
    if (record?.isApproving) return true;
    if (record?.tag === 0 && canShowTenantAdminFeature() == false) return true;
    return false;
  };

  /** 批量删除 */
  const onBatchDelete = async () => {
    if (!selectedRows.length) return;
    const res2 = await querySeatUserPermission();
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true);
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    const count = selectedRows.length;
    Modal.confirm({
      title: "确认删除所选工时？",
      icon: <ExclamationCircleFilled />,
      content: `您即将删除所选的 ${count} 条工时日志，此操作不可撤销。`,
      closeIcon: <CloseOutlined />,
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      async onOk() {
        const groupMap = {};
        selectedRows.forEach((row) => {
          const pk = sessionStorage.getItem('jwtMeegoTeamworkProjectKey');
          if (!groupMap[pk]) groupMap[pk] = [];
          groupMap[pk].push(row.id);
        });
        const items = Object.keys(groupMap).map((projectKey) => ({
          projectKey,
          ids: groupMap[projectKey],
        }));
        setBatchDeleteLoading(true);
        try {
          const res = await postDeleteNodeWorkHourBatch({ items });
          if (res?.result) {
            window.JSSDK.toast.success("删除成功");
            setSelectedRowKeys([]);
            setSelectedRows([]);
            fetchData(registrationObject);
          }
        } finally {
          setBatchDeleteLoading(false);
        }
      },
      onCancel() {},
    });
  };

  const filterApprovalRecords = (data, logItem) => {
    const dataKeys = Object.keys(data);
    // 获取第一个key的值
    const firstKeyValues = data[dataKeys[0]] || [];
    //logItem.
    // 过滤逻辑
    const { workItemId, type } = logItem;
    // 情况1：workItemId在data的key中
    if (data[workItemId]) {
      // 检查type是否存在于对应的数组中
      if (data[workItemId].includes(type)) {
      } else {
        logItem.canRegisterLevel = false
        logItem.canRegisterLevelName = data[workItemId]
      }
      return logItem
    } else {
      if (firstKeyValues.includes(type)) {
      } else {
        logItem.canRegisterLevel = false
        logItem.canRegisterLevelName = firstKeyValues
      }
      return logItem
    }
  };
  // 编辑工时日志详情弹窗
  const showEditLogModal = async (item) => {
    const res = await getRegisterableLevelMap();
    if (res?.result && res?.data) {
      let logItem = JSON.parse(JSON.stringify(item));
      const result = filterApprovalRecords(res?.data, logItem);
      let noCanRegisterWorkItem = false
      if (res?.data?.canRegister) {
        let noCanRegisterWorkItem = res?.data?.canRegister.some(item => item.canRegistWorkItemId === '0')
        if (noCanRegisterWorkItem) {
        } else {
          noCanRegisterWorkItem = res?.data?.canRegister.some(item => item.canRegistWorkItemId === logItem.workItemId)
          result.noCanRegisterWorkItem = !noCanRegisterWorkItem
        }
      }
      item = result
    }
    setCurrItem(item);
    const loginUser = { id: item?.userKey, name: item?.userName, avatar: item?.avatarUrl }
    const modal = await window.JSSDK.modal.open({
      entry: "RegModal",
      width: 745,
      height: 710,
      maskClosable: false,
      context: {
        title: "编辑工时日志",
        loginUser: loginUser,
        registrationType: "single",
        setRegistrationValue: item,
        currItem: item,
      }, // context 为任意值，仅可传递静态数据(不支持 ReactNode | Function)
      onSubmit: (confirm) => {
        modal.close(); // 关闭弹窗
        if (confirm.confirm) {
          onRegistrationOk(confirm.confirm);
        }
      },
    });
  }
  const onEditLogClick = async (item) => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true); // 显示模态框
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    if (item?.tag === 0) {
      Modal.confirm({
        title: "提示？",
        icon: <ExclamationCircleFilled />,
        content: "此登记对象已删除，编辑可能影响数据准确性，是否继续?",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        onOk() {
          showEditLogModal(item)
        },
        onCancel() {
        }
      })
    } else {
      showEditLogModal(item)
    }
  };
  const logColumns = [
    {
      title: "工作项",
      dataIndex: "workItemName",
      key: "workItemName",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作项实例",
      dataIndex: "workItemEntityName",
      key: "workItemEntityName",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    ...(showCustomField ? [{
      title: customFieldName,
      dataIndex: "customFieldValue",
      key: "customFieldValue",
      width: 180,
      ellipsis: true,
      render: (value) => {
        const displayValue = formatCustomFieldValue(value);
        return <span title={String(displayValue)}>{displayValue}</span>;
      },
    }] : []),
    {
      title: "节点",
      dataIndex: "nodeName",
      key: "nodeName",
      width: 100,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "任务",
      dataIndex: "taskName",
      key: "taskName",
      width: 100,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "成员",
      dataIndex: "userName",
      key: "userName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          {record.userKey ? <UserTag key={record.userKey} userId={record.userKey} name={record.userName} avatar={record.avatarUrl} /> : null}
          {/* <Avatar src={record.avatarUrl} size={18} icon={<UserOutlined />} />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.userName ? record.userName : "--"}
              {record?.status === "resigned" ? "(已离职)" : ""}
            </div>
          </div> */}
        </div>
      ),
    },
    {
      title: "成员排期",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 200,
      render: (_, record) => {
        if (record.scheduleDate_start && record.scheduleDate_end) {
          return (
            <div>
              {dayjs(record.scheduleDate_start).format("YYYY-MM-DD")}~
              {dayjs(record.scheduleDate_end).format("YYYY-MM-DD")}
            </div>
          );
        } else {
          return "--";
        }
      },
    },
    {
      title: "预估工时",
      dataIndex: "eval",
      key: "eval",
      width: 180,
      render: (_, record) => {
        if (record.eval_day_str !== null && record.eval_hour_str !== null) {
          return `${record.eval_hour_str}小时（${record.eval_day_str}人天）`;
        } else {
          return "--";
        }
      },
    },
    {
      title: "登记工时",
      dataIndex: "act",
      key: "act",
      width: 180,
      render: (_, record) => {
        if (record.act_hour !== null && record.act_day !== null) {
          return `${record.act_hour}小时（${isNumber(record.act_day)
            ? record.act_day.toFixed(2)
            : record.act_day
            }人天）`;
        } else {
          return "--";
        }
      },
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      ellipsis: true,
      width: 180,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 120,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD") : "--"),
    },
    {
      title: "登记人",
      dataIndex: "registrantStaffName",
      key: "registrantStaffName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          {record.registrantUserKey ? <UserTag key={record.registrantUserKey} userId={record.registrantUserKey} name={record.registrantStaffName} avatar={record.registrantStaffAvatarUrl} /> : null}
          {/* <Avatar
            src={record.registrantStaffAvatarUrl}
            size={18}
            icon={<UserOutlined />}
          />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.registrantStaffName ? record.registrantStaffName : "--"}
              {record?.registrantStaffStatus === "resigned" ? "(已离职)" : ""}
            </div>
          </div> */}
        </div>
      ),
    },
    {
      title: "登记时间",
      dataIndex: "registrationTime",
      key: "registrationTime",
      width: 180,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    {
      title: "更新人",
      dataIndex: "updateStaffName",
      key: "updateStaffName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          {!record.updateStaffUserKey &&
            <Avatar
              className="avatar-mr5"
              size={18}
              icon={<UserOutlined />}></Avatar>
          }
          {record.updateStaffUserKey ? (
            <UserTag key={record.updateStaffUserKey} userId={record.updateStaffUserKey} name={record.updateStaffName} avatar={record.updateStaffAvatarUrl} />
          ) : (
            "--"
          )}
          {/* <Avatar
            src={record.updateStaffAvatarUrl}
            size={18}
            icon={<UserOutlined />}
          />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.updateStaffName ? record.updateStaffName : "--"}
              {record?.updateStaffStatus === "resigned" ? "(已离职)" : ""}
            </div>
          </div> */}
        </div>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 180,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    {
      title: "是否为审批",
      dataIndex: "isApprove",
      key: "isApprove",
      width: 100,
      ellipsis: true,
      render: (_) => (_ === 1 ? "是" : "否"),
    },
    {
      title: "操作",
      key: "operate",
      dataIndex: "relatedEntityDeleted",
      fixed: "right",
      width: 165,
      fixed: "right",
      align: "right",
      render: (_, record) => (
        <Space size="middle" className="table-columns-h36">
          {record?.operationList?.includes("APPROVALINFO") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={() => {
                setCurrItem(record);
                setIsApprovalInfoOpen(true);
              }}
            >
              审批详情
            </Button>
          ) : null}
          {record?.operationList?.includes("EDIT") ? (
            record?.isApproving ? (
              <Tooltip title="当前工时日志存在待审批的工时变更">
                <Button
                  disabled={record?.isApproving}
                  className="opt-btn"
                  type="link"
                >
                  编辑
                </Button>
              </Tooltip>
            ) : (record?.tag === 0 && canShowTenantAdminFeature()==false) ? (
              <Tooltip title={isInstalledIsv.current ? "此登记对象已删除，无法进行编辑，请联系插件管理员或应用管理员进行操作" : "此登记对象已删除，无法进行编辑，请联系插件管理员进行操作"}>
                <Button
                  disabled={true}
                  className="opt-btn"
                  type="link"
                >
                  编辑
                </Button>
              </Tooltip>
            ) : (
              <Button
                className="opt-btn"
                type="link"
                onClick={() => onEditLogClick(record)}
              >
                编辑
              </Button>
            )
          ) : null}
          {record?.operationList?.includes("DELETE") ? (
            record?.isApproving ? (
              <Tooltip title="当前工时日志存在待审批的工时变更">
                <Button
                  disabled={record?.isApproving}
                  className="opt-btn"
                  type="link"
                >
                  删除
                </Button>
              </Tooltip>
            ) : (record?.tag === 0 && canShowTenantAdminFeature()==false) ? (
              <Tooltip title={"此登记对象已删除，无法进行删除，请联系管理员操作"}>
                <Button
                  disabled={true}
                  className="opt-btn"
                  type="link"
                >
                  删除
                </Button>
              </Tooltip>
            ) : (
              <Button
                className="opt-btn"
                type="link"
                onClick={() => onDelLogClick(record)}
              >
                删除
              </Button>
            )
          ) : null}
        </Space>
      ),
    },
  ];
  /** 是否显示团队设置 */
  const queryNeedShowTeamConfigData = async () => {
    const res = await queryNeedShowTeamConfig();
    if (res?.result) {
      if (res.data) {
        isPersonal.current = false;
      } else {
        isPersonal.current = true;
      }
      setShowTeamConfig(res.data || false);
    }
  };
  /** 获取审批配置 */
  const getApprovalSettingsData = async () => {
    const res = await getApprovalSettings();
    if (res?.result) {
      setConfigApproval(res.data);
    }
  }
  useEffect(() => {
    getTenantModeInfo();
    getApprovalSettingsData();
    queryNeedShowTeamConfigData();
  }, []);

  /** 获取以往查询条件 */
  const getHistoryState = async () => {
    const data = {
      flag: 2,
    };
    const res = await getLastStatCondition(data);
    if (res?.result) {
      selected.selectedUserIds = res.data.userId;
      let isSelectedTeamAdmin = res.data?.isSelectedTeamAdmin === undefined ? true : res.data?.isSelectedTeamAdmin === 1 ? true : false
      setSelected({ ...selected });
      setNewSelected({ ...selected });
      setIsSynchronous(res.data.isSynchronous);
      setRemoveTeamIds(res.data.removeTeamIds || []);
      setRemoveUserIds(res?.data?.removeUserKeys || []);
      setRemoveDepartmentIds(res.data.removeDepartmentIds  || []);
      setIsAllUser(res.data.isAllUser ? true : false);
      setIsAllTeam(res.data.isAllTeam ? true : false);
      setIsSelectedTeamAdmin(isSelectedTeamAdmin);
    }
  };

  /** 获取工时日志列表 */
  const fetchData = async (content = "") => {
    if (customFieldConfigLoading) return;
    setLogLoading(true);
    setSelectedRowKeys([]);
    setSelectedRows([]);
    let userIdList=[]
    if(Array.isArray(newSelected?.allUserList) && newSelected.allUserList.length > 0 && Array.isArray(newSelected?.selectedUserIds) && newSelected.selectedUserIds.length > 0){
      newSelected.allUserList.forEach(i=>{
        if(newSelected.selectedUserIds.includes(i.staffUserKey))
          userIdList.push(i.staffId)
      })
    }
    const data = {
      workItemId: workItem[0],
      workItemEntityId: workItem[1],
      nodeId: workItem[2],
      taskId: workItem[3],
      startDate: beginTime
        ? beginTime + " 00:00:00"
        : getFirstDayOfNaturalMonth() + " 00:00:00",
      endDate: endTime
        ? endTime + " 23:59:59"
        : getLastDayOfNaturalMonth() + " 23:59:59",
      pageNo: logPagination.current,
      pageSize: logPagination.pageSize,
      statisticType: currDropdownIndex,
      userKeyList: newSelected.selectedUserIds,
      userIdList: userIdList,
      teamIds: Array.isArray(newSelected?.selectedDepartIds) ? newSelected.selectedDepartIds : [],
      selectDepartmentIds: Array.isArray(newSelected?.selectedDeptIds) ? newSelected.selectedDeptIds : [],
      registrationObject: content,
      approvalNo
    };
    if (passParam.current === 1) {
      data.isSynchronous = isSynchronous || false;
      data.isAllDepartment = newSelected.isAllDepartment || false;
      data.isAllUser = newSelected.isAllUser || false
      data.isAllTeam = newSelected.isAllTeam || false
      data.isSelectedTeamAdmin = isSelectedTeamAdmin
    }
    if (isPersonal.current) {
      data.statisticType = 1
    }
    if (isApprove) data.isApprove = isApprove;
    // if (!data.userIdList.length && !data.teamIds.length) delete data.isSynchronous;
    const res = await postQueryNodeWorkHour(data);
    if (res?.result) {
      if (!res?.data?.nodeWorkHours?.length && logPagination.current > 1) {
        setLogPagination({
          ...logPagination,
          current: logPagination.current - 1,
        });
        return;
      }
      setLogList(res.data);
    }
    setLogLoading(false);
  };

  useEffect(() => {
    if (customFieldConfigLoading) return;
    fetchData(registrationObject);
  }, [
    customFieldConfigLoading,
    JSON.stringify([beginTime, endTime]),
    workItem,
    currDropdownIndex,
    logPagination,
    isApprove,
    approvalNo,
  ]);

  /** 时间改变 */
  const onTimeChange = (date, dateString) => {
    passParam.current = 0;
    localStorage.setItem("logBeginTime", dateString[0]);
    localStorage.setItem("logEndTime", dateString[1]);
    setLogPagination({ ...logPagination, current: 1 });
    setBeginTime(dateString[0] ? dateString[0] : getFirstDayOfNaturalMonth());
    setEndTime(dateString[1] ? dateString[1] : getLastDayOfNaturalMonth());
  };

  /** 统计纬度切换 */
  const onDropdownChange = (e) => {
    passParam.current = 0;
    setLogPagination({ ...logPagination, current: 1 });
    setCurrDropdownIndex(e);
    setLogPagination({ ...logPagination, current: 1 });
  };

  /** 打开人员选择器 */
  const onSelectedUserOpen = () => {
    getHistoryState().then(() => {
      setIsSelectedUserOpen(true);
    });
  };

  const handleSelectedUserCancel = () => {
    setIsSelectedUserOpen(false);
    const selectData = {
      selectedDeparts: [],
      selectedUsers: [],
      selectedDeptIds: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      selectedDeptMemberIds: [],
      selectedDepts: [],
      checkedKeys: []
    }
    setSelected({ ...selectData });
    setNewSelected({ ...selectData });
  };

  const handleSelectedUserOk = () => {
    if (!selected.selectedUserIds.length && !selected.selectedDepartIds.length && !selected.selectedDeptIds.length) {
      window.JSSDK.toast.warning("团队成员不能为空");
      return;
    }
    setIsSelectedUserOpen(false);
    setSelectedRowKeys([]);
    setSelectedRows([]);
    setNewSelected({ ...selected });
    setLogPagination({ ...logPagination, current: 1 });
    passParam.current = 1;
  };

  const getSelectedUser = (e) => {
    setSelected({ ...e });
  };

  /** 分页 */
  const onLogChange = (page, e) => {
    logPagination.current = page;
    setLogPagination(logPagination);
  };

  /** 切换数据量 */
  const onLogTableChange = (pagination, filters, sorter) => {
    if (pagination.pageSize !== logPagination.pageSize) {
      if (pagination.current !== 1) pagination.current = 1;
      logList.nodeWorkHours = [];
      setLogList({ ...logList });
    }
    setLogPagination(pagination);
  };

  /** 变更数据（提交+修改） */
  const onRegistrationOk = async (result) => {
    if (result) {
      fetchData(registrationObject);
    }
    setIsRegistrationOpen(false);
  };

  /** 工时日志导出 */
  const onExport = async () => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true); // 显示模态框
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    setExportLoading(true);
    const data = {
      workItemId: workItem[0],
      workItemEntityId: workItem[1],
      nodeId: workItem[2],
      taskId: workItem[3],
      startDate: beginTime
        ? beginTime + " 00:00:00"
        : getFirstDayOfNaturalMonth() + " 00:00:00",
      endDate: endTime
        ? endTime + " 23:59:59"
        : getLastDayOfNaturalMonth() + " 23:59:59",
      isSynchronous,
      statisticType: currDropdownIndex,
      userIdList: newSelected.selectedUserIds,
      approvalNo,
      registrationObject: registrationObject,
    };
    if (isApprove) data.isApprove = isApprove;
    if (!data.userIdList.length) delete data.isSynchronous;
    if (isPersonal.current) {
      data.statisticType = 1
    }
    const res = await postExportNodeWorkHour(data);
    if (res?.result) {
      message.loading({
        key: "exportNodeWorkHour",
        content: "数据准备中，请稍后",
        duration: 0,
      });

      let timer = setInterval(async () => {
        const getUrl = await getExportNodeWorkHourResult({
          uuid: res?.data,
        });
        if (getUrl?.result) {
          switch (getUrl?.data?.code) {
            case 1:
              clearInterval(timer);
              message.destroy("exportNodeWorkHour");
              window.JSSDK.toast.success("导出完成");
              urlDownload(getUrl?.data?.url, "工时日志");
              break;
            case 0:
              clearInterval(timer);
              message.destroy("exportNodeWorkHour");
              window.JSSDK.toast.error(getUrl?.data?.msg);
              break;
            case -1:
              clearInterval(timer);
              onExport();
              break;
            default:
              break;
          }
        }
      }, 1000);
    } else {
      message.destroy("exportNodeWorkHour");
      if (![10024, 10025].includes(res.data.code)) {
        window.JSSDK.toast.error("导出失败，请重新操作");
      }
    }
    setExportLoading(false);
  };

  const getWorkItem = (workItem) => {
    setLogPagination({ ...logPagination, current: 1 });
    if (!workItem) setWorkItem([]);
    if (workItem?.length > 2) {
      setWorkItem(workItem);
      if (workItem[0]) setWorkItemId(workItem[0]);
      if (workItem[1]) setWorkItemEntityId(workItem[1]);
      if (workItem[2]) setNodeId(workItem[2]);
      if (workItem[3]) setTaskId(workItem[3]);
    }
  };
  const handleSearchChange = (e) => {
    passParam.current = 0;
    const value = e.target.value;
    setRegistrationObject(value);
    // 清除之前的定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      fetchData(value);
    }, 300); // 300毫秒防抖延迟

    setDebounceTimer(timer);
  };

  useEffect(() => {
    return () => {
      // 组件卸载时清除定时器
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);
  return (
    <div className="log-warp">
      <div className="log-top">
        <div className="top-left">
          <Input
            allowClear
            placeholder="请输入审批单号"
            size="small"
            value={approvalNo}
            style={{ width: "180px" }}
            className="top-item"
            onChange={(e) => {
              passParam.current = 0;
              setApprovalNo(e.target.value);
            }}
            suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
          />
          <RangePicker
            size="small"
            allowClear={false}
            className="top-item time-picker"
            presets={rangePresets}
            value={
              beginTime && endTime ? [dayjs(beginTime), dayjs(endTime)] : []
            }
            onChange={onTimeChange}
          />
          {/* <span className="top-txt">登记对象</span> */}
          <WorkNodeCascader
            style={{ width: "220px" }}
            type="log"
            className="top-item"
            getWorkItem={getWorkItem}
            getFlowType={(val) => { }}
            getRegisteredName={(val) => { }}
          />
          <Input
            placeholder="请输入工作项实例/节点/任务"
            value={registrationObject}
            onClear={() => setRegistrationObject("")}
            onChange={handleSearchChange}
            className="registrationObject-input top-item"
            allowClear
            suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
          />
          <Checkbox
            value={isApprove}
            onChange={(e) => {
              passParam.current = 0;
              setLogPagination({ ...logPagination, current: 1 });
              setIsApprove(e.target.checked);
            }}
          >
            仅展示工时审批的数据
          </Checkbox>
        </div>
        <div className="top-right">
          {showTeamConfig && currDropdownIndex === 0 ? (
            <Button
              icon={<RightCircleOutlined />}
              iconPosition="end"
              type="link"
              onClick={onSelectedUserOpen}
            >
              团队设置
            </Button>
          ) : null}
          {showTeamConfig ? (
            <Dropdown
              className="top-item"
              menu={{
                items: dropdownItems,
              }}
            >
              <a onClick={(e) => e.preventDefault()}>
                <Space>
                  {dropdownItems[currDropdownIndex].label}
                  <DownOutlined />
                </Space>
              </a>
            </Dropdown>
          ) : null}
          <Space>
            <Button
              type="primary"
              danger
              size="small"
              disabled={selectedRowKeys.length === 0}
              loading={batchDeleteLoading}
              onClick={onBatchDelete}
            >
              批量删除
            </Button>
            <Button
              color="primary"
              variant="outlined"
              size="small"
              disabled={exportLoading}
              onClick={onExport}
            >
              导出
            </Button>
            <RegBtn
              loginUser={props?.loginUser}
              type="web"
              getRegStatus={onRegistrationOk}
              getRegistrationValue={onRegistrationOk}
              setRegistrationValue={false}
            />
          </Space>
        </div>
      </div>
      <div className="log-content">
        <Table
          size="small"
          rowKey="id"
          loading={logLoading}
          columns={logColumns}
          dataSource={logList?.nodeWorkHours}
          rowSelection={{
            selectedRowKeys,
            preserveSelectedRowKeys: false,
            onChange: (keys, rows) => {
              setSelectedRowKeys(keys);
              setSelectedRows(rows);
            },
            getCheckboxProps: (record) => ({ disabled: isRowDeleteDisabled(record) }),
          }}
          pagination={{
            current: logPagination.current, //当前页码
            pageSize: logPagination.pageSize, // 每页数据条数
            total: logList?.total, // 总条数
            onChange: (page) => onLogChange(page), //改变页码的函数
            showSizeChanger: logList?.total > 10 ? true : false,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: [10, 20, 50, 100],
            // hideOnSinglePage:
            //   logList?.total > 10 && logList?.total < 20 ? false : true,
          }}
          onChange={onLogTableChange}
          scroll={{
            // x: 1300,
            y: "calc(100vh - 300px)",
          }}
        />
      </div>
      <Modal
        destroyOnClose
        title="选择成员"
        open={isSelectedUserOpen}
        onCancel={handleSelectedUserCancel}
        width={"745px"}
        footer={[
          <Button className="cancel-btn" onClick={handleSelectedUserCancel}>
            取消
          </Button>,
          <Button
            disabled={!selected.selectedUserIds.length && !selected.selectedDepartIds.length && !selected.selectedDeptIds.length}
            type="primary"
            onClick={handleSelectedUserOk}
          >
            确定
          </Button>,
        ]}
      >
        <SelectedUser
          type="all"
          getSelectedUser={getSelectedUser}
          projectId={2}
          selectedUser={selected}
          removeTeamIds={removeTeamIds}
          removeUserIds={removeUserIds}
          removeDepartmentIds={removeDepartmentIds}
          isAllUser={isAllUser}
          isAllTeam={isAllTeam}
        />
        <Checkbox
          checked={isSynchronous}
          className="resource-selectUser-modal-tip"
          onChange={(e) => setIsSynchronous(e.target.checked)}
        >
          设置完成后，将配置同步到【资源管理】、【工时管理】模块
        </Checkbox>
        <div className="select-team-admin">
          <Checkbox
            checked={isSelectedTeamAdmin}
            className="resource-selectUser-modal-tip"
            onChange={(e) => setIsSelectedTeamAdmin(e.target.checked)}
          >
            选择团队时，同时选中团队管理员
          </Checkbox>
        </div>
      </Modal>
      <Modal
        destroyOnClose
        title={currItem.id ? "编辑工时日志" : "登记工时"}
        open={isRegistrationOpen}
        onCancel={() => setIsRegistrationOpen(false)}
        width={"745px"}
        footer={null}
      >
        <RegWorkHour
          loginUser={props?.loginUser}
          type="web"
          getRegistrationValue={onRegistrationOk}
          setRegistrationValue={currItem}
        />
      </Modal>
      <Modal
        title="审批详情"
        open={isApprovalInfoOpen}
        onCancel={() => setIsApprovalInfoOpen(false)}
        width={"745px"}
        footer={null}
        style={{ top: 200 }}
      >
        <Form className="approval-detail-form">
          <Form.Item style={{ marginBottom: 0 }} label="登记对象：">
            {currItem?.workItemEntityName ? (
              <span
                className="link"
                onClick={(e) => {
                  e.stopPropagation();
                  goWorkItemHref(currItem);
                }}
              >
                {currItem?.workItemName}/{currItem?.workItemEntityName}
                {currItem?.nodeName ? `/${currItem?.nodeName}` : ""}
                {currItem?.taskName ? `/${currItem?.taskName}` : ""}
              </span>
            ) : (
              "--"
            )}
          </Form.Item>
          <Form.Item style={{ marginBottom: 10 }} label="成员" name="act">
            <div className="table-columns-item">
              {/* <Avatar
                src={currItem?.avatarUrl}
                size={20}
                icon={<UserOutlined />}
              />
              <div className="table-columns-item-right">
                <div className="right-name">
                  {currItem?.userName ? currItem?.userName : "--"}
                </div>
              </div> */}
              {currItem?.userKey ? <UserTag userId={currItem?.userKey} /> : ""}
            </div>
          </Form.Item>
          <Form.Item style={{ marginBottom: 10 }} label="审批记录"></Form.Item>
          <ApprovalInfoTable id={currItem?.id} />
        </Form>
      </Modal>
      <SeatPermissionsModal
        open={modalOpen}
        code={modalCode}
        responseData={modalResponseData}
        chatUrl={chatUrl} // 可以从父组件传递，也可以在子组件固定
        onClose={() => {
          setModalOpen(false);
          // 重置状态，避免下次打开时显示旧内容
          setModalCode(undefined);
          setModalResponseData(undefined);
        }}
      />
    </div>
  );
};

export default Log;

const ApprovalInfoTable = (props) => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const renderTableUserInfo = (avatarUrl, name) => (
    <div className="table-columns-item">
      <Avatar src={avatarUrl} size={18} icon={<UserOutlined />} />
      <div className="table-columns-item-right">
        <div className="right-name">{name ? name : "--"}</div>
      </div>
    </div>
  );
  const columns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 60,
      ellipsis: true,
      render: (_, record, index) => index + 1,
    },
    {
      title: "审批单",
      dataIndex: "approvalNo",
      key: "approvalNo",
      width: 150,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "变更类型",
      dataIndex: "modifyType",
      key: "modifyType",
      width: 75,
      ellipsis: true,
      render: (_) => handleModifyType(_),
    },
    {
      title: "审批状态",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 80,
      ellipsis: true,
      render: (_) => getApproveStatusTag(_),
    },
    {
      title: "登记工时",
      dataIndex: "actWorkHour",
      key: "actWorkHour",
      width: 100,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD") : "--"),
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "审批人",
      dataIndex: "approvalUserName",
      key: "approvalUserName",
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        if (record?.approvalUserName === "自动通过") {
          return renderTableUserInfo(record.approvalUserAvatarUrl, record.approvalUserName);
        }
        return record.approvalStatus === 1 && record?.waitApprovalList && record?.waitApprovalList?.length > 0 ? (
          <div className="table-columns-item">
            {record.waitApprovalList[0]?.userKey ? (
              <UserTag
                userId={record.waitApprovalList[0].userKey}
                name={record.waitApprovalList[0].nameCn}
                avatar={record.waitApprovalList[0].avatarUrl}
              />
            ) : (
              record.waitApprovalList[0]?.nameCn || "--"
            )}
            {record.waitApprovalList?.length > 1 && (
              <Tooltip
                className="custom-tooltip"
                placement="top"
                title={
                  <div>
                    {record.waitApprovalList.slice(1).map((item, index) => (
                      <div key={item.userKey || index} style={{ marginBottom: 4 }}>
                        {item.userKey ? (
                          <UserTag
                            userId={item.userKey}
                            name={item.nameCn}
                            avatar={item.avatarUrl}
                          />
                        ) : (
                          item.nameCn
                        )}
                      </div>
                    ))}
                  </div>
                }
              >
                <span className="wait-approval-count">+{record.waitApprovalList?.length - 1}</span>
              </Tooltip>
            )}
          </div>
        ) :
          (record?.approvalUserAvatarUrl || record?.approvalUserName ? (
            <div className="table-columns-item">
              {record?.approvalUserKey && record?.approvalUserKey != '0' ? <UserTag userId={record.approvalUserKey} name={record.approvalUserName} avatar={record.approvalUserAvatarUrl} /> : record?.approvalUserKey == '0' ? record.approvalUserName : '--'}

            </div>
          ) : (
            "--"
          ))
      }
    },
    {
      title: "审批意见",
      dataIndex: "approvalReason",
      key: "approvalReason",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "审批时间",
      dataIndex: "approvalTime",
      key: "approvalTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
  ];

  /** 获取数据 */
  const getDataSource = async () => {
    setDataSource([]);
    setLoading(true);
    const res = await getApproveDetailList({
      id: props?.id,
    });
    if (res?.result) {
      setDataSource(res?.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (props?.id) getDataSource();
  }, [props?.id]);

  return (
    <Table
      size="small"
      rowKey="id"
      loading={loading}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{
        y: "100%",
      }}
    />
  );
};

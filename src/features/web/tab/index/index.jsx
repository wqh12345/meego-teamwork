import React, { useState, useEffect, useMemo, useRef } from "react";
import { getToken } from "../../../../config";
import { UserOutlined, CloseOutlined } from "@ant-design/icons";
import {
  DatePicker,
  Table,
  Button,
  Cascader,
  Space,
  message,
  Avatar,
  Spin,
  Result,
  Modal,
  Badge,
  Tooltip,
} from "antd";
import {
  getUserRole,
  postBatchInsertNodeWorkHour,
  getEntityNodeOption,
  getNodeUserList,
  getSyncMeego,
  getSyncStateMeego,
  getApprovalSettings,
  postUserActive,
  getDisplayLogic,
  getJudgeProjectHasAdmin,
  getWorkItemOptionNew
} from "../../../../api/api";
import "./index.less";
import "../../components/meegle-reg-modal/MeegleRegModal.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegWorkHourBatchNew from "../../components/reg-workHour-batch-new/RegWorkHourBatchNew";
import FilterMemorySetting from "../../components/meegle-reg-modal/FilterMemorySetting";
import UserPicker from "../../components/user-picker/UserPicker";
import ControlIndex from "../../control/index/index";
import ExpirationModal from "../../components/expiration-modal/ExpirationModal";
import noPermission from "../../../../image/meegle/noPermission.png";
import { UserTag } from '@lark-project/ui-kit-plugin';
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from "../../hooks/useTenantCustomFieldConfig";
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;

const Index = () => {
  const {
    isEnabled: isCustomFieldEnabled,
    fieldName: customFieldName,
  } = useTenantCustomFieldConfig();
  const [hasAuth, setHasAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitDisabled, setSubmitDisabled] = useState(true);
  const [flowMode, setFlowMode] = useState("");
  const [beginLogTime, setBeginLogTime] = useState("");
  const [endLogTime, setEndLogTime] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [workItemOption, setWorkItemOption] = useState([]);
  const [workItem, setWorkItem] = useState([]);
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [userId, setUserId] = useState([]);
  const [submitStatus, setSubmitStatus] = useState(false);
  const [submitLoadings, setSubmitLoadings] = useState(false);
  const [saveHourLoadings, setSaveHourLoadings] = useState(false);
  const [registrantUserKey, setRegistrantUserKey] = useState("");
  const [logList, setLogList] = useState({
    data: [],
    total: 0,
  });
  const [logPagination, setLogPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [loginUser, setLoginUser] = useState({
    id: "",
    name: "",
    avatar: "",
  });
  const [submitBtnTxt, setSubmitBtnTxt] = useState("提交");
  const [tabContext, setTabContext] = useState({});
  const [regDisplayLogic, setRegDisplayLogic] = useState({});
  const [workItemName, setWorkItemName] = useState("");
  const [filterMemoryEnabled, setFilterMemoryEnabled] = useState(false);
  const [filterMemoryConfig, setFilterMemoryConfig] = useState(null);
  /** 登记设置 */
  const [registrationSettingsConfig, setRegistrationSettingsConfig] = useState({});
  /** 获取当前实例详情 */
  const getWorkItemInfo = async () => {
    const tabContext = await window.JSSDK.tab.getContext();
    if (tabContext) {
      setTabContext({ ...tabContext });
      setWorkItemId(tabContext.workObjectId);
      setWorkItemEntityId(tabContext.workItemId);
      getWorkItemOptionNewData(tabContext.workObjectId)
      const workObject = await window.JSSDK.WorkObject.load({
        spaceId: tabContext.spaceId, // 请传入需查询的空间 id
        workObjectId: tabContext.workObjectId, // 请传入需查询的工作项类型 id
      });
      setFlowMode(workObject?.flowMode);
      window.JSSDK.Context.load().then(async (ctx) => {
        const mainSpace = ctx.mainSpace;
        const selectedWorkflowNode = ctx.selectedWorkflowNode;
        setLoginUser(ctx.loginUser);
        setRegistrantUserKey(ctx.loginUser.id);
        sessionStorage.setItem("jwtMeegoTeamworkUserId", ctx.loginUser.id);
        sessionStorage.setItem("jwtMeegoTeamworkProjectKey", mainSpace.id);
        getToken().then(async () => {
          checkedHasAuth();
          const res = await getUserRole();
          if (res?.result) {
            sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
          }
          getUserActive();
        });
      });
    }
  };
  const getWorkItemOptionNewData = async (workObjectId) => {
    const res = await getWorkItemOptionNew();
    if (res?.result) {
      const workItemInfo = res?.data.find((item) => item.value === workObjectId);
     if(workItemInfo){
      setWorkItemName(workItemInfo?.label);
     }
    }
  }
  useEffect(() => {
    getWorkItemInfo();
    getWorkItemOptionNewData()
  }, []);

  /** 判断是否有管理员 */
  const checkedHasAuth = async () => {
    const res = await getJudgeProjectHasAdmin();
    let tenantModeInfo=JSON.parse(sessionStorage.getItem("tenantModeInfo"));
    if(tenantModeInfo?.install){
      setHasAuth(true);
      getRegDisplayLogic();
      getSyncMeego();
      getApprovalSettingsData();
      return;
    }
    if (res?.result) {
      setHasAuth(res?.data);
      getRegDisplayLogic();
      getSyncMeego();
      getApprovalSettingsData();
      if (!res?.data)
        Modal.info({
          title: "使用提示",
          styles: {
            mask: {
              backgroundColor: "rgba(0, 0, 0, 0.15)",
            },
          },
          content: (
            <div>
              请联系空间管理员进入【
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={async () => {
                  const hostname = await window.JSSDK.navigation.getHostname();
                  window.JSSDK.Context.load().then(async (ctx) => {
                    const mainSpace = ctx.mainSpace;
                    const space = await window.JSSDK.Space.load(mainSpace?.id);
                    window.JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/setting/integrationManagement`
                    );
                  });
                }}
              >
                空间配置-插件管理
              </Button>
              -工时资源管理-配置】，分配管理员席位后，重新进入插件即可使用。
            </div>
          ),
          footer: (
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Button
                type="primary"
                onClick={async () => {
                  const hostname = await window.JSSDK.navigation.getHostname();
                  window.JSSDK.Context.load().then(async (ctx) => {
                    const mainSpace = ctx.mainSpace;
                    const space = await window.JSSDK.Space.load(mainSpace?.id);
                    window.JSSDK.navigation.open(
                      `https://${hostname}/${space?.simpleName}/setting/integrationManagement`
                    );
                  });
                }}
              >
                立即配置
              </Button>
            </div>
          ),
        });
    }
  };

  /** 弹窗登记展示逻辑及判断是不是标品 */
  const getRegDisplayLogic = async () => {
    try {
      const res = await getDisplayLogic();
      if (res?.result) {
        setRegDisplayLogic(res.data);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  /** 埋点：记录用户打开Tab页频次 */
  const getUserActive = async () => {
    await postUserActive({
      activeType: "TabPage",
    });
  };
   /** 获取审批配置 */
  const getApprovalSettingsData = async () => {
    const res = await getApprovalSettings();
    if (res?.result) {
      res?.data?.enableApproval ? setSubmitBtnTxt("提交审批") : setSubmitBtnTxt("提交");
    }
  }
  /** 实时同步数据 */
  const syncMeego = async () => {
    await getSyncMeego();
    await getSyncStateMeego();
  };

  /** 分页获取工时记录 */
  const getLogList = async () => {
    const data = {
      pageNum: logPagination.current,
      pageSize: logPagination.pageSize,
      workItemEntityId,
      workItemId,
      nodeId,
      taskId,
      startTime: beginLogTime,
      endTime: endLogTime,
      userId: userId.toString(),
    };
    const res = await getNodeUserList(data);
    if (res?.result) {
      setLogList(res.data);
    }
  };

  useEffect(() => {
    if (!loading && workItemEntityId && workItemId) getLogList();
  }, [
    loading,
    workItemEntityId,
    workItemId,
    registrantUserKey,
    JSON.stringify(userId),
    JSON.stringify([beginLogTime, endLogTime]),
    logPagination,
    JSON.stringify(workItem),
  ]);

  /** 工时记录时间改变 */
  const onTimeLogChange = (date, dateString) => {
    setBeginLogTime(dateString[0]);
    setEndLogTime(dateString[1]);
    logPagination.current = 1;
    setLogPagination(logPagination);
  };

  /** 工作项改变 */
  const onWorkItemChange = (value) => {
    if (value) {
      const workItem = [workItemId, workItemEntityId, value[0]];
      setNodeId(value[0]);
      if (value.length > 1) {
        workItem.push(value[1]);
        setTaskId(value[1]);
      }
      setWorkItem([...workItem]);
    } else {
      const workItem = [workItemId, workItemEntityId];
      setNodeId("");
      setTaskId("");
      setWorkItem([...workItem]);
    }
  };

  /** 获取工作项实例节点 */
  const fetchEntityNodeOptionData = async () => {
    const data = {
      workItemKey: workItemId,
      entityId: workItemEntityId,
    };
    const res = await getEntityNodeOption(data);
    if (res?.result && res?.data?.length) {
      setWorkItemOption([...res.data]);
    }
  };

  useEffect(() => {
    if (flowMode === "workflow" && loading && workItemEntityId && workItemId)
      fetchEntityNodeOptionData();
  }, [flowMode, loading, workItemEntityId, workItemId]);

  /** 切换数据量 */
  const onLogTableChange = (pagination, filters, sorter) => {
    if (pagination.pageSize !== logPagination.pageSize) {
      if (pagination.current !== 1) pagination.current = 1;
      logList.nodeWorkHours = [];
      setLogList({ ...logList });
    }
    setLogPagination({ ...pagination });
  };

  /** 填报记录的表头 */
  const logColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      render: (_, record, index) => index + 1,
      width: 50,
    },
    {
      title: "登记对象",
      dataIndex: "nodeName",
      key: "nodeName",
      width: 250,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    ...(isCustomFieldEnabled === true ? [{
      title: customFieldName,
      dataIndex: "customFieldValue",
      key: "customFieldValue",
      width: 180,
      ellipsis: { showTitle: false },
      render: (value) => {
        const displayValue = formatCustomFieldValue(value);
        return (
          <Tooltip title={displayValue === "--" ? null : String(displayValue)}>
            <span className="tab-custom-field-value">{displayValue}</span>
          </Tooltip>
        );
      },
    }] : []),
    {
      title: "成员",
      dataIndex: "userName",
      key: "userName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          {/* <Avatar src={record?.avatarUrl} size={18} icon={<UserOutlined />} />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record?.userName ? record?.userName : "--"}
              {record?.status === "resigned" ? "(已离职)" : ""}
            </div>
          </div> */}
          {record.userKey ? <UserTag userId={record.userKey} /> : ""}
        </div>
      ),
    },
    {
      title: "实际工时",
      dataIndex: "registeredWorkTimeTask",
      key: "registeredWorkTimeTask",
      width: 150,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 100,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
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
      title: "登记人",
      dataIndex: "userName",
      key: "userName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
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
          {record.registrantStaffUserKey ? <UserTag userId={record.registrantStaffUserKey} /> : ""}
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
          {record.updateStaffUserKey ? <UserTag userId={record.updateStaffUserKey} /> : ""}
        </div>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 180,
      render: (_) =>
        _ ? new Date(_).toLocaleString().replace(/\//g, "-") : "--",
    },
  ];

  /** 重置批量填报 */
  const onRegistrationCancel = () => {
    Modal.confirm({
      title: "确认重置？",
      content: "重置将清除所有已填写内容，是否继续？",
      closeIcon: <CloseOutlined />,
      okText: "确定",
      cancelText: "取消",
      async onOk() {
        setSubmitStatus(true);
        let timer = setTimeout(() => {
          clearTimeout(timer);
          setSubmitStatus(false);
        }, 30);
      },
      onCancel() {
        // window.JSSDK.toast.success('操作成功');
      },
    });
  };

  /** 工时记录人员筛选 */
  const onUserSelectChange = (value) => {
    setUserId(value);
    logPagination.current = 1;
    setLogPagination(logPagination);
  };

  /** 分页 */
  const onLogChange = (page, e) => {
    logPagination.current = page;
    setLogPagination(logPagination);
  };

  return loading ? (
    <Spin spinning={loading} style={{ width: "100%", marginTop: "20%" }}></Spin>
  ) : hasAuth ? (
    "defaultBatchRegisWorkItemType" in regDisplayLogic ? (
      !regDisplayLogic?.defaultBatchRegisWorkItemType?.length ||
      (regDisplayLogic?.defaultBatchRegisWorkItemType?.length &&
        regDisplayLogic?.defaultBatchRegisWorkItemType?.includes(
          workItemId
        )) ? (
        <div className="tab-warp">
          <ExpirationModal />
          <div className="tab-content">
            <div className="content-title">
              <div className="content-title-left">
                <div>批量登记工时</div>
                {flowMode === "workflow" ? (
                  <FilterMemorySetting
                    configType="TAB_REGISTER_FILTER_MEMORY"
                    memoryConfig={filterMemoryConfig}
                    memoryEnabled={filterMemoryEnabled}
                    onConfigLoaded={setFilterMemoryConfig}
                    onSaved={setFilterMemoryEnabled}
                    registrantUserKey={registrantUserKey || loginUser?.id}
                  />
                ) : null}
              </div>
              {flowMode === "workflow" ? (
                <Space>
                  {/* <Button
                    size="small"
                    disabled={submitDisabled}
                    onClick={onRegistrationCancel}
                  >
                    重置
                  </Button> */}
                   <Button
                    size="small"
                    loading={saveHourLoadings}
                    onClick={() => setSaveHourLoadings(true)}
                  >
                    暂存
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    disabled={submitDisabled}
                    onClick={() => setSubmitLoadings(true)}
                    loading={submitLoadings}
                  >
                    {submitBtnTxt}
                  </Button>
                </Space>
              ) : null}
            </div>
            <div className="content-header">
              {flowMode === "workflow" ? (
                <RegWorkHourBatchNew
                  loginUser={loginUser}
                  type="tab"
                  filterMemoryEnabled={filterMemoryEnabled}
                  onFilterMemoryConfigLoaded={setFilterMemoryConfig}
                  onFilterMemoryLoaded={setFilterMemoryEnabled}
                  submitStatus={submitStatus}
                  workItemId={workItemId}
                  workItemEntityId={workItemEntityId}
                  getRegistrantUserKey={(val) => setRegistrantUserKey(val)}
                  setSubmitLoadings={(val) => setSubmitLoadings(val)}
                  setSubmitDisabled={(val) => setSubmitDisabled(val)}
                  setSaveHourLoadings={(val) => setSaveHourLoadings(val)}
                  submitLoadings={submitLoadings}
                  saveHourLoadings={saveHourLoadings}
                  submitResult={(val) => {
                    if (val==2) {
                      window.JSSDK.toast.success(`${submitBtnTxt}成功`);
                      setLogPagination({
                        ...{
                          current: 1,
                          pageSize: 10,
                        },
                      });
                    }
                    if (val==1) {window.JSSDK.toast.success(`已暂存`)};
                  }}
                />
              ) : null}
              {flowMode === "stateflow" ? (
                <ControlIndex
                  flowMode={flowMode}
                  point="tab"
                  tabContext={tabContext}
                  getRegStatus={(val) => {
                    if (val) getLogList();
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="tab-content">
            <div className="content-title">工时记录</div>
            <div className="content-header">
              <Space className="top-left">
                <UserPicker
                  size="small"
                  placeholder="全部成员"
                  mode="multiple"
                  getUserIds={onUserSelectChange}
                  listHeight={200}
                />
                <RangePicker
                  size="small"
                  className="top-item time-picker"
                  value={
                    beginLogTime && endLogTime
                      ? [dayjs(beginLogTime), dayjs(endLogTime)]
                      : []
                  }
                  onChange={onTimeLogChange}
                />
                {flowMode === "workflow" ? (
                  <Cascader
                    size="small"
                    className="top-item"
                    options={workItemOption}
                    onChange={onWorkItemChange}
                    placeholder="请选择工作节点"
                    value={nodeId}
                    showSearch={true}
                  />
                ) : null}
              </Space>
            </div>
            <div className="content-body">
              <Table
                size="small"
                loading={logLoading}
                columns={logColumns}
                dataSource={logList.data}
                pagination={{
                  current: logPagination.current, //当前页码
                  pageSize: logPagination.pageSize, // 每页数据条数
                  total: logList.total, // 总条数
                  onChange: (page) => onLogChange(page), //改变页码的函数
                  showSizeChanger: logList.total > 10 ? true : false,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  pageSizeOptions: [10, 20, 50],
                  hideOnSinglePage:
                    logList.total > 10 && logList.total < 50 ? false : true,
                }}
                onChange={onLogTableChange}
                scroll={{
                  x: 800,
                  y: "100%",
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "calc(100vh - 200px)",
          }}
        >
          <img src={noPermission} style={{ marginBottom: "10px" }} alt="" />
          根据管理员设置，[{workItemName}]不可被[登记]
        </div>
      )
    ) : (
      <div className="tab-warp">
        <ExpirationModal />
        <div className="tab-content">
          <div className="content-title">
            <div className="content-title-left">
              <div>批量登记工时</div>
              {flowMode === "workflow" ? (
                <FilterMemorySetting
                  configType="TAB_REGISTER_FILTER_MEMORY"
                  memoryConfig={filterMemoryConfig}
                  memoryEnabled={filterMemoryEnabled}
                  onConfigLoaded={setFilterMemoryConfig}
                  onSaved={setFilterMemoryEnabled}
                  registrantUserKey={registrantUserKey || loginUser?.id}
                />
              ) : null}
            </div>
            {flowMode === "workflow" ? (
              <Space>
                <Button
                  size="small"
                  disabled={submitDisabled}
                  onClick={onRegistrationCancel}
                >
                  重置
                </Button>
                <Button
                  size="small"
                  type="primary"
                  disabled={submitDisabled}
                  onClick={() => setSubmitLoadings(true)}
                  loading={submitLoadings}
                >
                  {submitBtnTxt}
                </Button>
              </Space>
            ) : null}
          </div>
          <div className="content-header">
            {flowMode === "workflow" ? (
              <RegWorkHourBatchNew
                loginUser={loginUser}
                type="tab"
                filterMemoryEnabled={filterMemoryEnabled}
                onFilterMemoryConfigLoaded={setFilterMemoryConfig}
                onFilterMemoryLoaded={setFilterMemoryEnabled}
                submitStatus={submitStatus}
                workItemId={workItemId}
                workItemEntityId={workItemEntityId}
                getRegistrantUserKey={(val) => setRegistrantUserKey(val)}
                setSubmitLoadings={(val) => setSubmitLoadings(val)}
                setSubmitDisabled={(val) => setSubmitDisabled(val)}
                setSaveHourLoadings={(val) => setSaveHourLoadings(val)}
                submitLoadings={submitLoadings}
                saveHourLoadings={saveHourLoadings}
                submitResult={(val) => {
                  if (val) {
                    window.JSSDK.toast.success(`${submitBtnTxt}成功`);
                    setLogPagination({
                      ...{
                        current: 1,
                        pageSize: 10,
                      },
                    });
                  }
                }}
              />
            ) : null}
            {flowMode === "stateflow" ? (
              <ControlIndex
                flowMode={flowMode}
                point="tab"
                tabContext={tabContext}
                getRegStatus={(val) => {
                  if (val) getLogList();
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="tab-content">
          <div className="content-title">工时记录</div>
          <div className="content-header">
            <Space className="top-left">
              <UserPicker
                size="small"
                placeholder="全部成员"
                mode="multiple"
                getUserIds={onUserSelectChange}
                listHeight={200}
              />
              <RangePicker
                size="small"
                className="top-item time-picker"
                value={
                  beginLogTime && endLogTime
                    ? [dayjs(beginLogTime), dayjs(endLogTime)]
                    : []
                }
                onChange={onTimeLogChange}
              />
              {flowMode === "workflow" ? (
                <Cascader
                  size="small"
                  className="top-item"
                  options={workItemOption}
                  onChange={onWorkItemChange}
                  placeholder="请选择工作节点"
                  value={nodeId}
                  showSearch={true}
                />
              ) : null}
            </Space>
          </div>
          <div className="content-body">
            <Table
              size="small"
              loading={logLoading}
              columns={logColumns}
              dataSource={logList.data}
              pagination={{
                current: logPagination.current, //当前页码
                pageSize: logPagination.pageSize, // 每页数据条数
                total: logList.total, // 总条数
                onChange: (page) => onLogChange(page), //改变页码的函数
                showSizeChanger: logList.total > 10 ? true : false,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSizeOptions: [10, 20, 50],
                hideOnSinglePage:
                  logList.total > 10 && logList.total < 50 ? false : true,
              }}
              onChange={onLogTableChange}
              scroll={{
                x: 800,
                y: "100%",
              }}
            />
          </div>
        </div>
      </div>
    )
  ) : (
    <div className="tab-warp" style={{ background: "#fff" }}></div>
  );
};
export default Index;

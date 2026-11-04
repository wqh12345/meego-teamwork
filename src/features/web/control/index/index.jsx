import React, { useEffect, useState } from "react";
import {
  DatePicker,
  InputNumber,
  Table,
  Button,
  Form,
  Input,
  Space,
  Avatar,
  message,
  Spin,
  Result,
  Tooltip,
} from "antd";
import {
  getUserRole,
  postQueryNodeWorkHourSum,
  postInsertNodeWorkHour,
  getStandWorkHour,
  getProjectConfig,
  getSyncMeego,
  getSyncStateMeego,
  getWorkHourStatistics,
  getDisplayLogic,
  getJudgeProjectHasAdmin,
  querySeatUserPermission,
} from "../../../../api/api";
import {
  PlusOutlined,
  UserOutlined,
  InfoCircleFilled,
} from "@ant-design/icons";
import { getToken } from "../../../../config";
import { isNumber, validateNumber } from "../../../../util/util";
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import ExpirationModal from "../../components/expiration-modal/ExpirationModal";
import { SeatPermissionsModal } from '../../components/seat-permissions-modal/SeatPermissionsModal';
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;

const ControlIndex = (props) => {
  const [hasAuth, setHasAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flowMode, setFlowMode] = useState("");
  const [loginUser, setLoginUser] = useState({});
  const [registrantUserKey, setRegistrantUserKey] = useState("");
  const [actDay, setActDay] = useState(0);
  const [standWorkHour, setStandWorkHour] = useState(0);
  const [capacitySet, setCapacitySet] = useState({});
  const [workHourInfo, setWorkHourInfo] = useState({});
  const [actHour, setActHour] = useState(0);
  const [evalHour, setEvalHour] = useState(0);
  const [workItem, setWorkItem] = useState({});
  const [isAllowRegister, setIsAllowRegister] = useState(false);
  const [registeredName, setRegisteredName] = useState({});
  const [workItemName, setWorkItemName] = useState("");
  const [workItemEntityName, setWorkItemEntityName] = useState("");
  const [regDisplayLogic, setRegDisplayLogic] = useState({});
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [chatUrl, setChatUrl] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState();
  const [modalResponseData, setModalResponseData] = useState(undefined);
  // 获取插件信息
  const getWorkItemInfo = async () => {
    let controlContext = [];
    if (props?.point === "tab") {
      controlContext = props?.tabContext;
      setRegisteredName(props?.registeredName);
    } else {
      controlContext = await window.JSSDK.control.getContext();
    }
    if (controlContext) {
      const workObject = await window.JSSDK.WorkObject.load({
        spaceId: controlContext.spaceId, // 请传入需查询的空间 id
        workObjectId: controlContext.workObjectId, // 请传入需查询的工作项类型 id
        nodeId: controlContext?.nodeId,
      });
      if (workObject) setFlowMode(workObject?.flowMode);
      sessionStorage.setItem(
        "jwtMeegoTeamworkProjectKey",
        controlContext?.spaceId
      );
      const context = await window.JSSDK.Context.load();
      setRegisteredName({
        ...workItemName,
        workItemName: workObject?.name,
        workItemEntityName: context?.activeWorkItem?.name,
        nodeName: context?.selectedWorkflowNode?.name,
      });

      workItem.workItemId = controlContext?.workObjectId;
      workItem.workItemEntityId = controlContext?.workItemId;
      if (controlContext?.nodeId) workItem.nodeId = controlContext?.nodeId;
      setWorkItem({ ...workItem });
      getToken().then(async () => {
        checkedHasAuth();
        const res = await getUserRole();
        if (res?.result) {
          sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
          if (res.data === "Admin") getConfig();
        }
      });
    }
    window.JSSDK.Context.load().then((ctx) => {
      const loginUser = ctx.loginUser;
      setLoginUser(loginUser);
      setRegistrantUserKey(loginUser?.id);
    });
  };

  /** 判断是否有管理员 */
  const checkedHasAuth = async () => {
    let tenantModeInfo=JSON.parse(sessionStorage.getItem("tenantModeInfo"));
    if(tenantModeInfo?.install){
      setHasAuth(true);
      getRegDisplayLogic();
      getWorkHour();
      syncMeego();
      setLoading(false);
      return;
    }
    const res = await getJudgeProjectHasAdmin();
    if (res?.result) {
      setHasAuth(res?.data);
      getRegDisplayLogic();
      getWorkHour();
      // fetchNodeWorkHourSumData();
      syncMeego();
      setLoading(false);
    }
  };

  /** 弹窗登记展示逻辑及判断是不是标品 */
  const getRegDisplayLogic = async () => {
    const res = await getDisplayLogic();
    if (res?.result) {
      setRegDisplayLogic(res.data);
    }
  };

  // 同步飞书项目信息
  const syncMeego = async () => {
    await getSyncMeego();
    await getSyncStateMeego();
  };

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

  /** 查询组织标准工时 */
  const getWorkHour = async () => {
    const res = await getStandWorkHour();
    if (res?.result) {
      setStandWorkHour(res.data.standWorkHour);
      setCapacitySet(res.data);
    }
  };

  useEffect(() => {
    getWorkItemInfo();
  }, []);

  /** 查询工时登记节点总和 */
  const fetchNodeWorkHourSumData = async () => {
    const data = {
      ...workItem,
      flowType: flowMode,
    };
    const res = await getWorkHourStatistics(data);
    if (res?.result) {
      setWorkHourInfo(res.data);
    }
  };

  useEffect(() => {
    if (flowMode && workItem?.workItemId) fetchNodeWorkHourSumData();
  }, [flowMode, workItem]);

  /** 查看已登记工时明细 */
  const onWorkDetailClick = async () => {
    const modal = await window.JSSDK.modal.open({
      entry: "TaskDetailModal",
      width: 745,
      // height: 410,
      maskClosable: false,
      context: { loginUser, workItem, flowMode }, // context 为任意值，仅可传递静态数据(不支持 ReactNode | Function)
      onSubmit: () => {
        modal.close(); // 关闭弹窗
      },
    });
  };

  return (
    <Spin spinning={loading}>
      {!loading ? (
        hasAuth ? (
          "defaultBatchRegisWorkItemType" in regDisplayLogic ? (
            !regDisplayLogic?.defaultBatchRegisWorkItemType?.length ||
            (regDisplayLogic?.defaultBatchRegisWorkItemType?.length &&
              regDisplayLogic?.defaultBatchRegisWorkItemType?.includes(
                workItem.workItemId
              )) ? (
              <div className="control-warp">
                <ExpirationModal />
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
                {regDisplayLogic?.showSingleRegistration ? (
                  <div className="control-box">
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={async () => {
                      const res2 = await querySeatUserPermission();
                        // 如果接口返回true，显示SeatPermissionsModal
                        if (res2?.result && res2?.data?.msgCode) {
                          setModalCode(res2?.data?.msgCode);
                          setModalResponseData(res2?.data);
                          setModalOpen(true); // 显示模态框
                          setChatUrl(res2?.data?.chatUrl);
                          return;
                        }
                        const modalHeight = 710;
                        const modal = await window.JSSDK.modal.open({
                          entry: "RegModal",
                          width: 745,
                          height:  modalHeight,
                          maskClosable: false,
                          context: {
                            wHeight: modalHeight,
                            loginUser,
                            workItem,
                            flowMode,
                            registeredName,
                          }, // context 为任意值，仅可传递静态数据(不支持 ReactNode | Function)
                          onSubmit: (confirm) => {
                            modal.close(); // 关闭弹窗
                            if (confirm.confirm) {
                              fetchNodeWorkHourSumData();
                              if (props?.getRegStatus)
                                props?.getRegStatus(true);
                            }
                          },
                        });
                      }}
                      style={{ padding: 0 }}
                    >
                      登记工时
                    </Button>
                  </div>
                ) : null}
                <div className="control-box">
                  <div className="box-left">
                    <span className="left-label">已登记工时</span>
                    <Tooltip title="指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」">
                      <InfoCircleFilled className="label-icon" />
                    </Tooltip>
                  </div>
                  <div className="box-right">
                    {workHourInfo?.registeredWorkingHours ? (
                      <div>
                        {workHourInfo?.registeredWorkingHours}
                        <Button type="link" onClick={onWorkDetailClick}>
                          查看明细
                        </Button>
                      </div>
                    ) : (
                      "--"
                    )}
                  </div>
                </div>
                <div className="control-box">
                  <div className="box-left">
                    <span className="left-label">预估工时</span>
                    <Tooltip title="指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」">
                      <InfoCircleFilled className="label-icon" />
                    </Tooltip>
                  </div>
                  <div className="box-right">
                    {workHourInfo?.estimatedWorkingHours
                      ? workHourInfo?.estimatedWorkingHours
                      : "--"}
                  </div>
                </div>
                <div className="control-box">
                  <div className="box-left">
                    <span className="left-label">剩余工时</span>
                    <Tooltip
                      style={{ width: "350px" }}
                      title="计算方式：「剩余工时」 = 「预估工时」 - 「已登记工时」"
                    >
                      <InfoCircleFilled className="label-icon" />
                    </Tooltip>
                  </div>
                  <div className="box-right">
                    {workHourInfo?.remainingWork
                      ? workHourInfo?.remainingWork
                      : "--"}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "10px" }}>
                根据管理员设置，[{registeredName.workItemName}]不可被[登记]
              </div>
            )
          ) : (
            <div className="control-warp">
              <ExpirationModal />
              {regDisplayLogic?.showSingleRegistration ? (
                <div className="control-box">
                  <Button
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={async () => {
                      const modalHeight = 710;
                      const modal = await window.JSSDK.modal.open({
                        entry: "RegModal",
                        width: 745,
                        height: modalHeight,
                        maskClosable: false,
                        context: {
                          wHeight: modalHeight,
                          loginUser,
                          workItem,
                          flowMode,
                          registeredName,
                        }, // context 为任意值，仅可传递静态数据(不支持 ReactNode | Function)
                        onSubmit: (confirm) => {
                          modal.close(); // 关闭弹窗
                          if (confirm.confirm) {
                            fetchNodeWorkHourSumData();
                            if (props?.getRegStatus) props?.getRegStatus(true);
                          }
                        },
                      });
                    }}
                    style={{ padding: 0 }}
                  >
                    登记工时
                  </Button>
                </div>
              ) : null}
              <div className="control-box">
                <div className="box-left">
                  <span className="left-label">已登记工时</span>
                  <Tooltip title="指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」">
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
                <div className="box-right">
                  {workHourInfo?.registeredWorkingHours ? (
                    <div>
                      {workHourInfo?.registeredWorkingHours}
                      <Button type="link" onClick={onWorkDetailClick}>
                        查看明细
                      </Button>
                    </div>
                  ) : (
                    "--"
                  )}
                </div>
              </div>
              <div className="control-box">
                <div className="box-left">
                  <span className="left-label">预估工时</span>
                  <Tooltip title="指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」">
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
                <div className="box-right">
                  {workHourInfo?.estimatedWorkingHours
                    ? workHourInfo?.estimatedWorkingHours
                    : "--"}
                </div>
              </div>
              <div className="control-box">
                <div className="box-left">
                  <span className="left-label">剩余工时</span>
                  <Tooltip
                    style={{ width: "350px" }}
                    title="计算方式：「剩余工时」 = 「预估工时」 - 「已登记工时」"
                  >
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
                <div className="box-right">
                  {workHourInfo?.remainingWork
                    ? workHourInfo?.remainingWork
                    : "--"}
                </div>
              </div>
            </div>
          )
        ) : (
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
        )
      ) : null}
    </Spin>
  );
};
export default ControlIndex;

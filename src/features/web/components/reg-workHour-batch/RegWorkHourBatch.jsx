import React, { useState, useEffect, useRef } from "react";
import FeishuStyleInput from "../fs-style-input/FeishuStyleInput";
import {
  Alert,
  DatePicker,
  InputNumber,
  Table,
  Input,
  Space,
  Typography,
  Avatar,
  Tooltip,
  Modal,
  message,
} from "antd";
import {
  UserOutlined,
  InfoCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  validateDecimalPlaces,
} from "../../../../util/util";
import {
  getStandWorkHour,
  getSelectWorkInstance,
  getEntityNode,
  getEntityNodeSchedule,
  getUserRole,
  getProjectConfig,
  getWorkSaturationTips,
  postBatchInsertNodeWorkHour,
  postUserActive,
} from "../../../../api/api";
import "./RegWorkHourBatch.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import UserPicker from "../user-picker/UserPicker";
import Decimal from "decimal.js";
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Text } = Typography;

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

const RegWorkHourBatch = (props) => {
  const [loading, setLoading] = useState(false);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [beginTime, setBeginTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [registrantUserKey, setRegistrantUserKey] = useState(
    props?.loginUser?.id
  );
  const [pickerUser, setPickerUser] = useState({
    userKey: props?.loginUser?.id,
    nameCn: props?.loginUser?.name,
    avatarUrl: props?.loginUser?.avatar,
  });
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [expandedNodeRowKeys, setExpandedNodeRowKeys] = useState([]);
  const [capacitySet, setCapacitySet] = useState({});
  const [isAllowRegister, setIsAllowRegister] = useState(false);
  const [submitLoadings, setSubmitLLoadings] = useState(false);
  const [workInstanceDataSource, setWorkInstanceDataSource] = useState({
    total: 0,
    data: [],
  });
  const [workInstancePagination, setWorkInstancePagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [alertDetail, setAlertDetail] = useState({});
  const [alertDetailOld, setAlertDetailOld] = useState({});

  useEffect(() => {
    if (props?.submitStatus) {
      setWorkDate("");
      setWorkInstanceDataSource({
        total: 0,
        data: [],
      });
      setBeginTime("");
      setEndTime("");
      setAlertDetail({});
      setAlertDetailOld({});
    }
  }, [props?.submitStatus]);

  useEffect(() => {
    if (props.type === "tab") {
      setWorkItemId(props?.workItemId);
      setWorkItemEntityId(props?.workItemEntityId);
    }
    getWorkHour();
    getRole();
  }, []);

  /** 埋点：记录用户使用批量登记频次 */
  const getUserActive = async (data) => {
    await postUserActive({
      activeType: data,
    });
  };

  /** 获取当前用户角色 */
  const getRole = async () => {
    const res = await getUserRole();
    if (res?.result) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
      if (res.data === "Admin") getConfig();
    }
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
      setCapacitySet(res.data);
    }
  };

  /** 获取个人工作饱和度提示 */
  const getAlertDetail = async () => {
    const data = {
      workDate: workDate,
      registrantUseKey: registrantUserKey,
    };
    const res = await getWorkSaturationTips(data);
    if (res?.result) {
      setAlertDetail(JSON.parse(JSON.stringify(res.data)));
      setAlertDetailOld(JSON.parse(JSON.stringify(res.data)));
    }
  };

  useEffect(() => {
    if (workDate && registrantUserKey) {
      getAlertDetail();
    } else {
      setAlertDetail({});
      setAlertDetailOld({});
    }
  }, [workDate, registrantUserKey]);

  /** 计算个人工作饱和度 */
  const countAlertDetail = () => {
    if (
      !workInstanceDataSource?.data?.length ||
      Object.keys(alertDetailOld).length === 0
    )
      return;
    let workHour = new Decimal(0);
    workInstanceDataSource?.data.forEach((item) => {
      if (item?.actWorkHour) workHour = workHour.plus(item?.actWorkHour);
    });
    alertDetail.remainingWork = new Decimal(alertDetailOld.remainingWork)
      .minus(workHour)
      .toNumber();
    alertDetail.registeredWorkingHours = new Decimal(
      alertDetailOld.registeredWorkingHours
    )
      .plus(workHour)
      .toNumber();
    alertDetail.saturation =
      (alertDetail.registeredWorkingHours / capacitySet?.standWorkHour) * 100;
    alertDetail.saturation = Math.round(alertDetail.saturation * 100) / 100;
    setAlertDetail({ ...alertDetail });
  };

  useEffect(() => {
    countAlertDetail();
  }, [JSON.stringify(workInstanceDataSource)]);

  /** 分页获取工作实例 */
  const getSelectWorkInstanceTable = async (workItemEntityId) => {
    if (!workDate) return;
    if (props?.type === "tab")
      getUserActive("TabOpenBatchRegistrationWorkingHours");
    setLoading(true);
    const data = {
      pageNum: workInstancePagination.pageNum,
      pageSize: workInstancePagination.pageSize,
      startTime: beginTime,
      endTime: endTime,
      workItemEntityId: workItemEntityId,
      registrantUseKey: registrantUserKey,
    };
    const res = await getSelectWorkInstance(data);
    if (res?.result) {
      res.data.workDate = workDate;
      if (props?.type === "tab") {
        getEntityNodeTable(res.data);
      } else {
        setWorkInstanceDataSource(res.data);
      }
    }
    setLoading(false);
  };

  /** 获取工作实例实例下的节点 */
  const getEntityNodeTable = async (dataSource) => {
    if (!workDate || !workItemEntityId || !workItemId) return;
    setNodeLoading(true);
    const data = {
      startTime: beginTime,
      endTime: endTime,
      workTime: workDate,
      workItemEntityId,
      workItemId,
      registrantUserKey,
    };
    const res = await getEntityNode(data);
    if (res?.result) {
      if (!dataSource) {
        workInstanceDataSource.data.forEach((item) => {
          if (
            item.workItemId === workItemId &&
            item.workItemEntityId === workItemEntityId
          )
            if (!item?.nodes) item.nodes = res.data;
        });
        setWorkInstanceDataSource({ ...workInstanceDataSource });
      } else {
        dataSource.data.forEach((item) => {
          if (
            item.workItemId === workItemId &&
            item.workItemEntityId === workItemEntityId
          )
            if (!item?.nodes) item.nodes = res.data;
        });
        setWorkInstanceDataSource({ ...dataSource });
        setExpandedRowKeys([workItemEntityId]);
      }
    }
    setNodeLoading(false);
    setIsLoading(false);
  };

  useEffect(() => {
    if (props?.type !== "tab" && isLoading) getEntityNodeTable();
  }, [workItemEntityId, registrantUserKey, isLoading]);

  /** 获取工作实例实例下的节点的任务 */
  const getEntityNodeScheduleTable = async () => {
    if (!workDate || !workItemEntityId || !workItemId || !nodeId) return;
    setTaskLoading(true);
    const data = {
      startTime: beginTime,
      endTime: endTime,
      workTime: workDate,
      workItemEntityId,
      workItemId,
      nodeId,
      registrantUserKey,
    };
    const res = await getEntityNodeSchedule(data);
    if (res?.result) {
      workInstanceDataSource.data.forEach((item) => {
        if (
          item.workItemId === workItemId &&
          item.workItemEntityId === workItemEntityId
        )
          item.nodes.forEach((node) => {
            if (node.nodeId === nodeId && !node?.tasks) node.tasks = res.data;
          });
      });
      setWorkInstanceDataSource({ ...workInstanceDataSource });
    }
    setTaskLoading(false);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isLoading) getEntityNodeScheduleTable();
  }, [nodeId, registrantUserKey, isLoading]);

  useEffect(() => {
    setExpandedNodeRowKeys([]);
    switch (props.type) {
      case "tab":
        setWorkInstanceDataSource({});
        getSelectWorkInstanceTable(props?.workItemEntityId);
        break;
      default:
        setExpandedRowKeys([]);
        setWorkInstanceDataSource({});
        getSelectWorkInstanceTable();
        break;
    }
  }, [
    workDate,
    registrantUserKey,
    JSON.stringify([beginTime, endTime]),
    JSON.stringify(workInstancePagination),
  ]);

  /** 工作项改变 */
  const onWorkItemChange = (value) => {
    if (value.length > 2) {
      fetchNodeWorkHourSumData();
    }
  };

  /** 分页点击 */
  const onPaginationChange = (page, pageSize) => {
    let isReg = false;
    workInstanceDataSource.data.forEach((item) => {
      if (item?.actWorkHour) {
        isReg = true;
      }
    });
    if (isReg) {
      Modal.confirm({
        title: "当前页面存在登记工时，是否切换页面？",
        icon: <ExclamationCircleFilled />,
        content: "切换页面后，当前页登记工时无效。",
        closeIcon: <CloseOutlined />,
        okText: "确定",
        cancelText: "取消",
        async onOk() {
          if (workInstancePagination.pageSize !== pageSize) {
            setWorkInstancePagination({ ...{ pageSize, pageNum: 1 } });
          } else {
            setWorkInstancePagination({ ...{ pageSize, pageNum: page } });
          }
        },
        onCancel() {
          // window.JSSDK.toast.success('操作成功');
        },
      });
      return;
    }
    if (workInstancePagination.pageSize !== pageSize) {
      setWorkInstancePagination({ ...{ pageSize, pageNum: 1 } });
    } else {
      setWorkInstancePagination({ ...{ pageSize, pageNum: page } });
    }
  };

  /** 时间改变 */
  const onTimeChange = (date, dateString) => {
    setBeginTime(dateString[0]);
    setEndTime(dateString[1]);
  };

  /** 工作日期变更 */
  const onWorkDateChange = (date, dateString) => {
    setWorkDate(dateString);
  };

  const columns = [
    {
      title: "登记对象",
      dataIndex: "workItemEntityName",
      key: "workItemEntityName",
      width: 200,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: (
        <div className="table-columns-item-title">
          <span>成员排期</span>
          <Tooltip title="该数据同步自所选成员在飞书项目的「排期」字段的数据">
            <InfoCircleFilled />
          </Tooltip>
        </div>
      ),
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 200,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: (
        <div className="table-columns-item-title">
          <span>预估工时</span>
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
            <InfoCircleFilled />
          </Tooltip>
        </div>
      ),
      dataIndex: "estimatedScore",
      key: "estimatedScore",
      width: 200,
      render: (_) => (_ ? _ : "--/--"),
    },
    {
      title: (
        <div className="table-columns-item-title">
          <span>已登记工时</span>
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
            <InfoCircleFilled />
          </Tooltip>
        </div>
      ),
      dataIndex: "registeredWorkTime",
      key: "registeredWorkTime",
      width: 200,
      render: (_) => (_ ? _ : "--/--"),
    },
    {
      title: (
        <div className="table-columns-item-title">
          <span>剩余工时</span>
          <Tooltip title="计算方式：「剩余工时」 = 「预估工时」 - 「已登记工时」">
            <InfoCircleFilled />
          </Tooltip>
        </div>
      ),
      dataIndex: "residueWorkTime",
      key: "residueWorkTime",
      width: 200,
      render: (_) => (_ ? _ : "--/--"),
    },
    {
      title: "本次登记工时",
      dataIndex: "actWorkHour",
      key: "actWorkHour",
      width: 130,
      render: (_, record, index) => {
        if ("workItemEntityId" in record) {
          let min = new Decimal(0);
          if ("task" in record) {
            for (const item of record.task) {
              min =
                "actWorkHour" in item
                  ? min.plus(item.actWorkHour)
                  : min.plus(0);
            }
          }
          min = min.toNumber();
          return (
            <>
              <InputNumber
                status={
                  (typeof record.actWorkHour === "number" &&
                    record.actWorkHour < capacitySet?.onceDown) ||
                  (!record.actWorkHour && record.workDesc) ||
                  validateDecimalPlaces(record.actWorkHour, 2)
                    ? "error"
                    : ""
                }
                value={_}
                min={() => {
                  let min = new Decimal(0);
                  record?.tasks.forEach((item) => {
                    if (item?.actWorkHour) min = min.plus(item?.actWorkHour);
                  });
                  min = min.toNumber();
                  return min;
                }}
                size="small"
                onChange={(e) => onActWorkHourChange(e, record, index)}
              />
              <Text
                style={{
                  display:
                    typeof record.actWorkHour !== "number" && record.workDesc
                      ? "block"
                      : "none",
                }}
                type="danger"
              >
                工时不能为空
              </Text>
              <Text
                style={{
                  display: validateDecimalPlaces(record.actWorkHour, 2)
                    ? "block"
                    : "none",
                }}
                type="danger"
              >
                工时要保留2位小数
              </Text>
              <Text
                style={{
                  display:
                    typeof record.actWorkHour === "number" &&
                    record.actWorkHour < capacitySet?.onceDown
                      ? "block"
                      : "none",
                }}
                type="danger"
              >
                低于单次填报工时下限{capacitySet?.onceDown}小时
              </Text>
            </>
          );
        } else {
          return null;
        }
      },
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      width: 250,
      render: (text, record, index) =>
        "workItemEntityId" in record ? (
          <FeishuStyleInput
            value={text}
            onChange={(value) => onWorkDescChange(value, record, index)}
            width={230}
            placeholder="请输入"
          />
        ) : null,
    },
  ];

  /** 实例登记工时 */
  const onActWorkHourChange = (value, record, index) => {
    if (!value) {
      let actWorkHour = new Decimal(0);
      workInstanceDataSource.data[index]?.nodes?.forEach((item) => {
        if (item?.actWorkHour)
          actWorkHour = actWorkHour.plus(item?.actWorkHour);
      });
      workInstanceDataSource.data[index].actWorkHour = actWorkHour.toNumber()
        ? actWorkHour.toNumber()
        : value;
    } else {
      value = Number(value.toFixed(2));
      let actWorkHour = new Decimal(0);
      workInstanceDataSource.data[index]?.nodes?.forEach((item) => {
        if (item?.actWorkHour)
          actWorkHour = actWorkHour.plus(item?.actWorkHour);
      });
      actWorkHour = actWorkHour.toNumber();
      workInstanceDataSource.data[index].actWorkHour =
        value > actWorkHour ? value : actWorkHour;
      workInstanceDataSource.data[index].nodeActWorkHour = actWorkHour;
    }
    workInstanceDataSource.data[index].workDate = workDate;
    if ((!value && record?.workDesc) || validateDecimalPlaces(value, 2)) {
      workInstanceDataSource.data[index].status = false;
    } else {
      workInstanceDataSource.data[index].status = true;
    }
    setWorkInstanceDataSource({ ...workInstanceDataSource });
  };

  /** 实例登记描述 */
  const onWorkDescChange = (value, record, index) => {
    //value = value.target.value;
    workInstanceDataSource.data[index].workDate = workDate;
    workInstanceDataSource.data[index].workDesc = value;
    if (value && !record.actWorkHour) {
      workInstanceDataSource.data[index].status = false;
    } else {
      workInstanceDataSource.data[index].status = true;
    }
    setWorkInstanceDataSource({ ...workInstanceDataSource });
  };

  /** 展开节点 */
  const expandedNodeRowRender = (recordParent, indexParent) => {
    const nodeColumns = [
      {
        title: "登记对象",
        dataIndex: "nodeName",
        key: "nodeName",
        width: 180,
        ellipsis: true,
        render: (_) => (_ ? _ : "--"),
      },
      {
        title: (
          <div className="table-columns-item-title">
            <span>成员排期</span>
            <Tooltip title="该数据同步自所选成员在飞书项目的「排期」字段的数据">
              <InfoCircleFilled />
            </Tooltip>
          </div>
        ),
        dataIndex: "scheduleDate",
        key: "scheduleDate",
        width: 200,
        render: (_) => (_ ? _ : "--"),
      },
      {
        title: (
          <div className="table-columns-item-title">
            <span>预估工时</span>
            <Tooltip title="该数据同步自所选成员在飞书项目的「估分」字段的数据，用于「预估」完成该实例/节点/任务所需要花费的工时">
              <InfoCircleFilled />
            </Tooltip>
          </div>
        ),
        dataIndex: "estimatedScore",
        key: "estimatedScore",
        width: 200,
        render: (_) => (_ ? _ : "--"),
      },
      {
        title: (
          <div className="table-columns-item-title">
            <span>已登记工时</span>
            <Tooltip title="用于记录所选成员在该实例/节点/任务下实际花费的工时">
              <InfoCircleFilled />
            </Tooltip>
          </div>
        ),
        dataIndex: "registeredWorkTime",
        key: "registeredWorkTime",
        width: 200,
        render: (_) => (_ ? _ : "--"),
      },
      {
        title: (
          <div className="table-columns-item-title">
            <span>剩余工时</span>
            <Tooltip title="剩余工时，即还未通过登记实际消耗的预估工时，计算逻辑为预估工时-已登记工时。此处分别展示单个成员在当前工作（登记对象）下、当前工作总剩余工时。">
              <InfoCircleFilled />
            </Tooltip>
          </div>
        ),
        dataIndex: "residueWorkTime",
        key: "residueWorkTime",
        width: 200,
        render: (_) => (_ ? _ : "--"),
      },
      {
        title: "本次登记工时",
        dataIndex: "actWorkHour",
        key: "actWorkHour",
        width: 130,
        render: (_, record, index) => {
          if ("workItemEntityId" in record) {
            let min = new Decimal(1);
            if ("task" in record) {
              for (const item of record.task) {
                min =
                  "actWorkHour" in item
                    ? min.plus(item.actWorkHour)
                    : min.plus(0);
              }
            }
            min = min.toNumber();
            return (
              <>
                <InputNumber
                  status={
                    (typeof record.actWorkHour === "number" &&
                      record.actWorkHour < capacitySet?.onceDown) ||
                    (!record.actWorkHour && record.workDesc) ||
                    validateDecimalPlaces(record.actWorkHour, 2)
                      ? "error"
                      : ""
                  }
                  value={_}
                  min={() => {
                    let min = new Decimal(0);
                    record?.nodes.forEach((item) => {
                      if (item?.actWorkHour) min = min.plus(item.actWorkHour);
                    });
                    min = min.toNumber();
                    return min;
                  }}
                  size="small"
                  onChange={(e) => onNodeActWorkHourChange(e, record, index)}
                />
                <Text
                  style={{
                    display:
                      typeof record.actWorkHour !== "number" && record.workDesc
                        ? "block"
                        : "none",
                  }}
                  type="danger"
                >
                  工时不能为空
                </Text>
                <Text
                  style={{
                    display: validateDecimalPlaces(record.actWorkHour, 2)
                      ? "block"
                      : "none",
                  }}
                  type="danger"
                >
                  工时要保留2位小数
                </Text>
                <Text
                  style={{
                    display:
                      typeof record.actWorkHour === "number" &&
                      record.actWorkHour < capacitySet?.onceDown
                        ? "block"
                        : "none",
                  }}
                  type="danger"
                >
                  低于单次填报工时下限{capacitySet?.onceDown}小时
                </Text>
              </>
            );
          } else {
            return null;
          }
        },
      },
      {
        title: "工作描述",
        dataIndex: "workDesc",
        key: "workDesc",
        width: 250,
        render: (text, record, index) =>
          "workItemEntityId" in record ? (
            <FeishuStyleInput
              value={text}
              onChange={(value) => onNodeWorkDescChange(value, record, index)}
              width={230}
              placeholder="请输入"
            />
          ) : null,
      },
    ];

    const onNodeActWorkHourChange = (value, record, index) => {
      if (value) value = Number(value.toFixed(2));
      workInstanceDataSource.data[indexParent].nodes[index].workDate = workDate;
      let taskWorkHour = new Decimal(0);
      if (
        workInstanceDataSource.data[indexParent].nodes[index]?.tasks?.length
      ) {
        workInstanceDataSource.data[indexParent].nodes[index].tasks.forEach(
          (item) => {
            if (item?.actWorkHour)
              taskWorkHour = taskWorkHour.plus(item?.actWorkHour);
          }
        );
      }
      taskWorkHour = taskWorkHour.toNumber();
      workInstanceDataSource.data[indexParent].nodes[index].taskActWorkHour =
        taskWorkHour;
      workInstanceDataSource.data[indexParent].nodes[index].actWorkHour =
        taskWorkHour > value ? taskWorkHour : value;
      let nodeWorkHour = new Decimal(0);
      if (workInstanceDataSource.data[indexParent]?.nodes?.length) {
        workInstanceDataSource.data[indexParent].nodes.forEach((item) => {
          if (item?.actWorkHour)
            nodeWorkHour = nodeWorkHour.plus(item?.actWorkHour);
        });
      }
      nodeWorkHour = nodeWorkHour.toNumber();
      workInstanceDataSource.data[indexParent].nodeActWorkHour = nodeWorkHour;
      workInstanceDataSource.data[indexParent].actWorkHour =
        recordParent?.actWorkHour
          ? recordParent?.actWorkHour > nodeWorkHour
            ? recordParent?.actWorkHour
            : nodeWorkHour
          : nodeWorkHour;
      if ((!value && record.workDesc) || validateDecimalPlaces(value, 2)) {
        workInstanceDataSource.data[indexParent].nodes[index].status = false;
      } else {
        workInstanceDataSource.data[indexParent].nodes[index].status = true;
      }
      setWorkInstanceDataSource({ ...workInstanceDataSource });
    };

    const onNodeWorkDescChange = (value, record, index) => {
      //value = value.target.value;
      workInstanceDataSource.data[indexParent].nodes[index].workDate = workDate;
      workInstanceDataSource.data[indexParent].nodes[index].workDesc = value;
      if (value && !record.actWorkHour) {
        workInstanceDataSource.data[indexParent].nodes[index].status = false;
      } else {
        workInstanceDataSource.data[indexParent].nodes[index].status = true;
      }
      setWorkInstanceDataSource({ ...workInstanceDataSource });
    };

    const onNodeExpand = (expanded, record) => {
      if (expanded) {
        expandedNodeRowKeys.push(record.id);
        setNodeId(record.nodeId);
        if (!record?.tasks?.length) setIsLoading(true);
      } else {
        expandedNodeRowKeys.splice(expandedNodeRowKeys.indexOf(record.id), 1);
        setNodeId("");
      }
      setExpandedNodeRowKeys([...expandedNodeRowKeys]);
    };

    /** 展开任务 */
    const expandedTaskRowRender = (recordTaskParent, indexNodeParent) => {
      const taskColumns = [
        {
          title: "登记对象",
          dataIndex: "taskName",
          key: "taskName",
          width: 160,
          ellipsis: true,
          render: (_) => (_ ? _ : "--"),
        },
        {
          title: (
            <div className="table-columns-item-title">
              <span>成员排期</span>
              <Tooltip title="该数据同步自所选成员在飞书项目的「排期」字段的数据">
                <InfoCircleFilled />
              </Tooltip>
            </div>
          ),
          dataIndex: "scheduleDate",
          key: "scheduleDate",
          width: 200,
          render: (_) => (_ ? _ : "--"),
        },
        {
          title: (
            <div className="table-columns-item-title">
              <span>预估工时</span>
              <Tooltip title="该数据同步自所选成员在飞书项目的「估分」字段的数据，用于「预估」完成该实例/节点/任务所需要花费的工时">
                <InfoCircleFilled />
              </Tooltip>
            </div>
          ),
          dataIndex: "estimatedScore",
          key: "estimatedScore",
          width: 200,
          render: (_) => (_ ? _ : "--"),
        },
        {
          title: (
            <div className="table-columns-item-title">
              <span>已登记工时</span>
              <Tooltip title="用于记录所选成员在该实例/节点/任务下实际花费的工时">
                <InfoCircleFilled />
              </Tooltip>
            </div>
          ),
          dataIndex: "registeredWorkTime",
          key: "registeredWorkTime",
          width: 200,
          render: (_) => (_ ? _ : "--"),
        },
        {
          title: (
            <div className="table-columns-item-title">
              <span>剩余工时</span>
              <Tooltip title="剩余工时，即还未通过登记实际消耗的预估工时，计算逻辑为预估工时-已登记工时。此处分别展示单个成员在当前工作（登记对象）下、当前工作总剩余工时。">
                <InfoCircleFilled />
              </Tooltip>
            </div>
          ),
          dataIndex: "residueWorkTime",
          key: "residueWorkTime",
          width: 200,
          render: (_) => (_ ? _ : "--"),
        },
        {
          title: "本次登记工时",
          dataIndex: "actWorkHour",
          key: "actWorkHour",
          width: 130,
          render: (_, record, index) => {
            if ("workItemEntityId" in record) {
              return (
                <>
                  <InputNumber
                    status={
                      (typeof record.actWorkHour === "number" &&
                        record.actWorkHour < capacitySet?.onceDown) ||
                      (!record.actWorkHour && record.workDesc) ||
                      validateDecimalPlaces(record.actWorkHour, 2)
                        ? "error"
                        : ""
                    }
                    value={_}
                    size="small"
                    onChange={(e) => onTaskActWorkHourChange(e, record, index)}
                  />
                  <Text
                    style={{
                      display:
                        typeof record.actWorkHour !== "number" &&
                        record.workDesc
                          ? "block"
                          : "none",
                    }}
                    type="danger"
                  >
                    工时不能为空
                  </Text>
                  <Text
                    style={{
                      display: validateDecimalPlaces(record.actWorkHour, 2)
                        ? "block"
                        : "none",
                    }}
                    type="danger"
                  >
                    工时要保留2位小数
                  </Text>
                  <Text
                    style={{
                      display:
                        typeof record.actWorkHour === "number" &&
                        record.actWorkHour < capacitySet?.onceDown
                          ? "block"
                          : "none",
                    }}
                    type="danger"
                  >
                    低于单次填报工时下限{capacitySet?.onceDown}小时
                  </Text>
                </>
              );
            } else {
              return null;
            }
          },
        },
        {
          title: "工作描述",
          dataIndex: "workDesc",
          key: "workDesc",
          width: 250,
          render: (text, record, index) =>
            "workItemEntityId" in record ? (
              <FeishuStyleInput
                value={text}
                onChange={(value) => onTaskWorkDescChange(value, record, index)}
                width={230}
                placeholder="请输入"
              />
            ) : null,
        },
      ];

      const onTaskActWorkHourChange = (value, record, index) => {
        if (value) value = Number(value.toFixed(2));
        if ((!value && record?.workDesc) || validateDecimalPlaces(value, 2)) {
          workInstanceDataSource.data[indexParent].nodes[indexNodeParent].tasks[
            index
          ].status = false;
        } else {
          workInstanceDataSource.data[indexParent].nodes[indexNodeParent].tasks[
            index
          ].status = true;
        }
        workInstanceDataSource.data[indexParent].nodes[
          indexNodeParent
        ].workDate = workDate;
        workInstanceDataSource.data[indexParent].nodes[indexNodeParent].tasks[
          index
        ].workDate = workDate;
        workInstanceDataSource.data[indexParent].nodes[indexNodeParent].tasks[
          index
        ].actWorkHour = value;
        let taskWorkHour = new Decimal(0);
        if (
          workInstanceDataSource.data[indexParent].nodes[indexNodeParent]?.tasks
            ?.length
        ) {
          workInstanceDataSource.data[indexParent].nodes[
            indexNodeParent
          ]?.tasks.forEach((item) => {
            if (item?.actWorkHour)
              taskWorkHour = taskWorkHour.plus(item?.actWorkHour);
          });
        }
        taskWorkHour = taskWorkHour.toNumber();
        workInstanceDataSource.data[indexParent].nodes[
          indexNodeParent
        ].taskActWorkHour = taskWorkHour;
        workInstanceDataSource.data[indexParent].nodes[
          indexNodeParent
        ].actWorkHour = workInstanceDataSource.data[indexParent].nodes[
          indexNodeParent
        ].actWorkHour
          ? workInstanceDataSource.data[indexParent].nodes[indexNodeParent]
              .actWorkHour > taskWorkHour
            ? workInstanceDataSource.data[indexParent].nodes[indexNodeParent]
                .actWorkHour
            : taskWorkHour
          : taskWorkHour;
        let nodeWorkHour = new Decimal(0);
        if (workInstanceDataSource.data[indexParent]?.nodes?.length) {
          workInstanceDataSource.data[indexParent]?.nodes.forEach((item) => {
            if (item?.actWorkHour)
              nodeWorkHour = nodeWorkHour.plus(item?.actWorkHour);
          });
        }
        nodeWorkHour = nodeWorkHour.toNumber();
        workInstanceDataSource.data[indexParent].nodeActWorkHour = nodeWorkHour;
        workInstanceDataSource.data[indexParent].actWorkHour =
          workInstanceDataSource.data[indexParent].actWorkHour
            ? workInstanceDataSource.data[indexParent].actWorkHour >
              nodeWorkHour
              ? workInstanceDataSource.data[indexParent].actWorkHour
              : nodeWorkHour
            : nodeWorkHour;
        setWorkInstanceDataSource({ ...workInstanceDataSource });
      };

      const onTaskWorkDescChange = (value, record, index) => {
        //value = value.target.value;
        if (value && !record.actWorkHour) {
          workInstanceDataSource.data[indexParent].nodes[
            indexNodeParent
          ].status = false;
        } else {
          workInstanceDataSource.data[indexParent].nodes[
            indexNodeParent
          ].status = true;
        }
        workInstanceDataSource.data[indexParent].nodes[
          indexNodeParent
        ].workDate = workDate;
        workInstanceDataSource.data[indexParent].nodes[indexNodeParent].tasks[
          index
        ].workDate = workDate;
        workInstanceDataSource.data[indexParent].nodes[indexNodeParent].tasks[
          index
        ].workDesc = value;
        setWorkInstanceDataSource({ ...workInstanceDataSource });
      };

      if (recordTaskParent.hasNext) {
        return (
          <Table
            style={{ marginLeft: "50px" }}
            size="small"
            loading={taskLoading}
            columns={taskColumns}
            dataSource={recordTaskParent.tasks}
            pagination={false} // 子表格通常不需要分页
            rowKey="id" // 指定子表格行的唯一标识
            // bordered // 可选，增加边框
          />
        );
      }
    };

    if (recordParent.hasNext) {
      return (
        <Table
          size="small"
          loading={nodeLoading}
          columns={nodeColumns}
          dataSource={recordParent.nodes}
          pagination={false} // 子表格通常不需要分页
          rowKey="id" // 指定子表格行的唯一标识
          // bordered // 可选，增加边框
          expandable={{
            expandedRowKeys: expandedNodeRowKeys,
            indentSize: 0,
            expandedRowRender: (recordTaskParent, indexTaskParent) =>
              expandedTaskRowRender(
                recordTaskParent,
                indexTaskParent,
                indexParent
              ),
            rowExpandable: (record) => record.hasNext,
            onExpand: onNodeExpand,
          }}
        />
      );
    }
  };

  /** 展开实例 */
  const onWorkItemEntityExpand = (expanded, record) => {
    if (expanded) {
      expandedRowKeys.push(record.workItemEntityId);
      setWorkItemId(record?.workItemId);
      setWorkItemEntityId(record?.workItemEntityId);
      if (!record?.nodes?.length) setIsLoading(true);
    } else {
      record?.nodes?.forEach((item) => {
        if (expandedNodeRowKeys.includes(item.id)) {
          expandedNodeRowKeys.splice(expandedNodeRowKeys.indexOf(item.id), 1);
          setExpandedNodeRowKeys([...expandedNodeRowKeys]);
        }
      });
      expandedRowKeys.splice(
        expandedRowKeys.indexOf(record.workItemEntityId),
        1
      );
      setWorkItemId("");
      setWorkItemEntityId("");
      setNodeId("");
    }
    setExpandedRowKeys([...expandedRowKeys]);
  };

  /** 选择被登记人 */
  const onSearchPersonChange = (val) => {
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
  };

  /** 批量登记提交 */
  const onBatchSubmit = async () => {
    if (!workInstanceDataSource?.data?.length) {
      window.JSSDK.toast.warning("登记内容不能为空");
      props.setSubmitLoadings(false);
      return;
    }
    const addWorkHourRequests = [];
    const addEntities = [];
    let isSubmit = true;
    for (const workItemEntity of workInstanceDataSource?.data) {
      if (!workItemEntity?.actWorkHour) continue;
      if (!workItemEntity?.nodes?.length) {
        addEntities.push({
          schedule: workItemEntity.schedule,
          estimatedWorkingHours: workItemEntity.estimatedScore,
          workItemId: workItemEntity.workItemId,
          workItemEntityId: workItemEntity.workItemEntityId,
          workItemEntityName: workItemEntity.workItemEntityName,
          actWorkHour: workItemEntity.actWorkHour,
          workDesc: workItemEntity.workDesc,
          addNodes: [],
        });
        continue;
      }
      const addNodes = [];
      for (const workInstance of workItemEntity?.nodes) {
        // if ("status" in workInstance && !workInstance.status) {
        //   isSubmit = false;
        //   break;
        // }
        // if ("status" in workInstance && workInstance.status) {
        const addTasks = [];
        workInstance?.tasks?.forEach((item) => {
          if (item?.actWorkHour) {
            addTasks.push({
              actWorkHour: item.actWorkHour,
              taskId: item.taskId,
              workDesc: item.workDesc,
            });
          }
        });
        if (workInstance?.actWorkHour) {
          addNodes.push({
            actWorkHour: workInstance.actWorkHour,
            nodeId: workInstance.nodeId,
            workDesc: workInstance.workDesc,
            addTasks,
          });
        }
      }
      // }
      addEntities.push({
        workItemId: workItemEntity.workItemId,
        workItemEntityId: workItemEntity.workItemEntityId,
        actWorkHour: workItemEntity.actWorkHour,
        workDesc: workItemEntity.workDesc,
        addNodes,
      });
    }
    if (!isSubmit) {
      window.JSSDK.toast.warning("填报存在问题，请根据提示填写");
      props.setSubmitLoadings(false);
      return;
    }
    if (!addEntities?.length) {
      window.JSSDK.toast.warning("登记内容不能为空");
      props.setSubmitLoadings(false);
      return;
    }
    const res = await postBatchInsertNodeWorkHour({
      addEntities,
      workDate: workInstanceDataSource?.workDate,
      staffUserKey: registrantUserKey,
    });
    if (res?.result) {
      window.JSSDK.toast.success("登记成功");
      setWorkDate("");
      setWorkInstanceDataSource({
        total: 0,
        data: [],
      });
      setBeginTime("");
      setEndTime("");
      setAlertDetail({});
      setAlertDetailOld({});
      props.submitResult(true);
      if (props?.type === "tab") {
        getUserActive("TabActBatchRegistrationWorkingHours");
        setWorkItemId(props?.workItemId);
        setWorkItemEntityId(props?.workItemEntityId);
      } else {
        getUserActive("PageActBatchRegistrationWorkingHours");
      }
    }
    props.setSubmitLoadings(false);
  };

  useEffect(() => {
    if (props?.submitLoadings) onBatchSubmit();
  }, [props?.submitLoadings]);

  return (
    <div className="regWorkHourBatch-warp">
      {/* <Alert
        className="setting-alert"
        message="提示：请选择工作日期，当前工时基于工作日期登记，需注意单个工作日累计的登记工时不可超过24小时"
        type="info"
        showIcon
      /> */}
      <Alert
        className="registration-alert"
        message={
          <div>
            该成员当前工作日期总登记工时
            <span className="num">
              {typeof alertDetail?.registeredWorkingHours === "number"
                ? alertDetail?.registeredWorkingHours
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
              placement="bottom"
              title={
                <>
                  <div>
                    总登记工时：指该「成员」在当前「工作日期」填写的总「登记工时」
                  </div>
                  <div>
                    剩余可登记工时 = 「单天填报工时上限」-
                    当前「工作日期」的「已登记工时」
                  </div>
                  <div>
                    工作饱和度 = （当前「工作日期」的「已登记工时」/
                    「单天填报工时上限」）*100%
                  </div>
                </>
              }
            >
              <InfoCircleFilled className="icon" />
            </Tooltip>
          </div>
        }
        type="info"
        showIcon
      />
      <div className="regWorkHourBatch-header">
        <Space>
          <span>工作日期</span>
          <DatePicker
            size="small"
            value={workDate ? dayjs(workDate) : null}
            onChange={onWorkDateChange}
          />
          <span>成员</span>
          <UserPicker
            size="small"
            loginUser={props?.loginUser}
            registrantUserKey={props?.loginUser?.id}
            disabled={
              !isAllowRegister ||
              sessionStorage.getItem("jwtMeegoTeamworkUserRole") !== "Admin"
            }
            value={registrantUserKey}
            allowClear={
              props?.loginUser?.id === registrantUserKey ? false : true
            }
            getUserIds={onSearchPersonChange}
            getPickerUser={(val) => setPickerUser(val)}
          />
        </Space>
      </div>
      <div className="regWorkHourBatch-body">
        <div className="body-header">
          <span>登记表</span>
          {/* {props.type === "tab" ? (
            <RangePicker
              size="small"
              className="header-item time-picker"
              presets={rangePresets}
              value={
                beginTime && endTime ? [dayjs(beginTime), dayjs(endTime)] : []
              }
              onChange={onTimeChange}
            />
          ) : null} */}
        </div>
        <Table
          loading={loading}
          className="table-warp"
          size="small"
          rowKey={(record) => record.workItemEntityId}
          columns={columns}
          dataSource={workInstanceDataSource?.data}
          pagination={
            props.type === "tab"
              ? false
              : {
                  size: "small",
                  total: workInstanceDataSource.total,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50],
                  pageSize: workInstancePagination.pageSize,
                  current: workInstancePagination.pageNum,
                  onChange: onPaginationChange,
                }
          }
          expandable={{
            indentSize: 20,
            expandedRowKeys: expandedRowKeys,
            expandedRowRender: expandedNodeRowRender,
            rowExpandable: (record) => record.hasNext,
            onExpand: onWorkItemEntityExpand,
          }}
          scroll={{
            // x: 1200,
            y: 300,
          }}
        />
      </div>
    </div>
  );
};

export default RegWorkHourBatch;

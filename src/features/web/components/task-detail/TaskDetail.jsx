import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { Table, Tooltip, Avatar } from "antd";
import {
  postQueryNodeWorkHourDetail,
  getWorkHourStatistics,
} from "../../../../api/api";
import { InfoCircleFilled, UserOutlined } from "@ant-design/icons";
import { isNumber, goWorkItemHref } from "../../../../util/util";
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from "../../hooks/useTenantCustomFieldConfig";
import "./TaskDatail.less";
import { UserTag } from '@lark-project/ui-kit-plugin';

const CustomFieldValue = ({ value }) => {
  const valueRef = useRef(null);
  const [isOverflowed, setIsOverflowed] = useState(false);
  const displayValue = formatCustomFieldValue(value);

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
    <Tooltip title={isOverflowed ? String(displayValue) : null}>
      <div
        ref={valueRef}
        className="right-txt custom-field-value"
        onMouseEnter={updateOverflow}
      >
        {displayValue}
      </div>
    </Tooltip>
  );
};

const DetailTable = (props) => {
  const detailColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 50,
      render: (_, record, index) => index + 1,
    },
    {
      title: "成员",
      dataIndex: "staffName",
      key: "staffName",
      width: 120,
      render: (_, record) => (
        <div className="table-columns-item">
          { record.staffUserKey ? <UserTag userId={record.staffUserKey} /> : null}
          {/* <div className="table-columns-item-left">
            <Avatar
              src={record.staffAvatarUrl}
              size={18}
              icon={<UserOutlined />}
            />
          </div>
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.staffName ? record.staffName : "--"}
            </div>
          </div> */}
        </div>
      ),
    },
    {
      title: "登记工时",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 140,
      render: (_, record) => {
        if (record.act_hour !== null && record.act_day !== null) {
          return `${record.act_hour}小时（${
            isNumber(record.act_day)
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
      width: 110,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 180,
      render: (_) =>
        _
          ? new Date(_).toLocaleDateString().replace(/\//g, "-") +
            " " +
            new Date(_).toLocaleTimeString().replace(/\//g, "-")
          : "--",
    },
  ];

  return (
    <Table
      size="small"
      columns={detailColumns}
      dataSource={props?.dataSource}
      pagination={false}
      scroll={{ y: 300 }}
    />
  );
};

const TaskDetail = (props) => {
  const {
    isEnabled: isCustomFieldEnabled,
    fieldName: customFieldName,
  } = useTenantCustomFieldConfig();
  const [taskInfo, setTaskInfo] = useState({});
  const [dataSource, setDataSource] = useState([]);
  const getTaskInfo = async () => {
    const data = {
      workItemId: props?.workItem?.workItemId,
      workItemEntityId: props?.workItem?.workItemEntityId,
      nodeId: props?.workItem?.nodeId,
      taskId: props?.workItem?.taskId,
      logId: props?.logId,
    };
    if (props?.type === "approval") delete data.logId;
    const res = await postQueryNodeWorkHourDetail(data);
    if (res?.result) {
      setDataSource(res.data);
    }
    data.flowType = props?.flowMode;
    const taskInfo = await getWorkHourStatistics(data);
    if (taskInfo?.result) {
      setTaskInfo(taskInfo?.data);
    }
  };

  useEffect(() => {
    getTaskInfo();
  }, [props?.taskDetail]);

  return (
    <div className="task-info-warp">
      <div className="task-info-top">登记工时明细</div>
      <div className="task-info-middle">
        <div className="info-item">
          <div className="info-item-left">
            <div className="left-title">登记对象：</div>
          </div>
          <div className="info-item-right">
            <div className="right-txt">
              {taskInfo?.workItemName ? (
                <span
                  className="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    goWorkItemHref(props?.workItem);
                  }}
                >
                  {taskInfo?.workItemName}
                  {taskInfo?.workItemEntityName
                    ? `/${taskInfo?.workItemEntityName}`
                    : ""}
                  {taskInfo?.nodeName ? `/${taskInfo?.nodeName}` : ""}
                  {taskInfo?.taskName ? `/${taskInfo?.taskName}` : ""}
                </span>
              ) : (
                "--"
              )}
            </div>
          </div>
        </div>
        {isCustomFieldEnabled === true && (
          <div className="info-item custom-field-info-item">
            <div className="info-item-left">
              <div className="left-title">{customFieldName}：</div>
            </div>
            <div className="info-item-right">
              <CustomFieldValue value={taskInfo?.customFieldValue} />
            </div>
          </div>
        )}
        <div className="info-item">
          <div className="info-item-left">
            <div className="left-title">已登记工时</div>
            <Tooltip title="指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」">
              <InfoCircleFilled className="left-icon" />
            </Tooltip>
            <div className="left-title">：</div>
          </div>
          <div className="info-item-right">
            <div className="right-txt">
              {taskInfo?.registeredWorkingHours
                ? taskInfo?.registeredWorkingHours
                : "--"}
            </div>
          </div>
        </div>
        <div className="info-item">
          <div className="info-item-left">
            <div className="left-title">预估工时</div>
            <Tooltip title="指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」">
              <InfoCircleFilled className="left-icon" />
            </Tooltip>
            <div className="left-title">：</div>
          </div>
          <div className="info-item-right">
            <div className="right-txt">
              {taskInfo?.estimatedWorkingHours
                ? taskInfo?.estimatedWorkingHours
                : "--"}
            </div>
          </div>
        </div>
        <div className="info-item">
          <div className="info-item-left">
            <div className="left-title"> 剩余工时</div>
            <Tooltip title="计算方式：「剩余工时」 = 「预估工时」 - 「已登记工时」">
              <InfoCircleFilled className="left-icon" />
            </Tooltip>
            <div className="left-title">：</div>
          </div>
          <div className="info-item-right">
            <div className="right-txt">
              {taskInfo?.remainingWork ? taskInfo?.remainingWork : "--"}
            </div>
          </div>
        </div>
      </div>
      <div className="task-info-bottom">
        <DetailTable dataSource={dataSource} />
      </div>
    </div>
  );
};
export default TaskDetail;

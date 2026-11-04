import React, { useEffect, useState } from "react";
import {
  DatePicker,
  InputNumber,
  Table,
  Form,
  Input,
  Space,
  Avatar,
  message,
  Button,
  Spin,
} from "antd";
import { Calendar, Cascader, Modal, Popup, Stepper } from "antd-mobile";
import {
  postQueryNodeWorkHourSum,
  postQueryNodeWorkHourDetail,
  postInsertNodeWorkHour,
  getStandWorkHour,
} from "../../../../api/api";
import {
  PlusOutlined,
  UpOutlined,
  DownOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { getToken } from "../../../../config";
import { isNumber } from "../../../../util/util";
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;

const findNodeId = (nId) => {
  if (nId.startsWith("node_")) {
    const segs = nId.split("_");
    return segs.slice(1, segs.length - 1).join("_");
  }
  return nId;
};

const ControlIndex = () => {
  const [isShow, setIsShow] = useState(true);
  const [registrationForm] = Form.useForm();
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actDay, setActDay] = useState(0);
  const [standWorkHour, setStandWorkHour] = useState(0);
  const [capacitySet, setCapacitySet] = useState({});
  const [detailList, setDetailList] = useState([]);
  const [actHour, setActHour] = useState(0);
  const [evalHour, setEvalHour] = useState(0);
  const [workItem, setWorkItem] = useState([]);
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [workDate, setWorkDate] = useState(new Date());
  const detailColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 45,
      render: (_, record, index) => index + 1,
    },
    {
      title: "成员",
      dataIndex: "staffName",
      key: "staffName",
      width: 80,
      render: (_, record) => (
        <div className="table-columns-item">
          <Avatar
            src={record.staffAvatarUrl}
            size={18}
            icon={<UserOutlined />}
          />
          <div className="table-columns-item-right">
            <div className="right-name">
              {record.staffName ? record.staffName : "--"}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "实际工时",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 105,
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
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 100,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
    },
    {
      title: "登记时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 100,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
    },
  ];

  // 获取插件信息
  const getWorkItemInfo = () => {
    window.JSSDK.Context.load().then((ctx) => {
      const mainSpace = ctx.mainSpace;
      const activeWorkItem = ctx.activeWorkItem;
      const loginUser = ctx.loginUser;
      const { selectedWorkflowNode } = ctx.selectedWorkflowNode;
      workItem[0] = activeWorkItem?.workObjectId;
      workItem[1] = activeWorkItem?.id;
      workItem[2] = selectedWorkflowNode?.id;
      setWorkItem([...workItem]);
      registrationForm.setFieldValue("workItem", workItem);
      sessionStorage.setItem("jwtMeegoTeamworkProjectKey", mainSpace.id);
      getToken().then(() => {
        getWorkHour();
        fetchNodeWorkHourSumData();
      });
    });
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

  /** 查询工时登记节点明细 */
  const fetchQueryNodeWorkHourDetailData = async () => {
    if (!workItem) return;
    const data = {
      workItemId: workItem.length > 0 ? workItem[0] : "",
      workItemEntityId: workItem.length > 1 ? workItem[1] : "",
      nodeId: workItem.length > 2 ? workItem[2] : "",
    };
    const res = await postQueryNodeWorkHourDetail(data);
    if (res?.result) {
      setDetailList(res.data);
    }
  };
  useEffect(() => {
    if (isDetailOpen) {
      fetchQueryNodeWorkHourDetailData();
    }
  }, [isDetailOpen]);

  /** 查询工时登记节点总和 */
  const fetchNodeWorkHourSumData = async () => {
    const data = {
      workItemId: workItem.length > 0 ? workItem[0] : "",
      workItemEntityId: workItem.length > 1 ? workItem[1] : "",
      nodeId: workItem.length > 2 ? workItem[2] : "",
    };
    const res = await postQueryNodeWorkHourSum(data);
    if (res?.result) {
      registrationForm.setFieldValue(
        "workItemName",
        `${res.data.workItemName}/${res.data.workItemEntityName}/${res.data.nodeName}`
      );
      if (res.data.eval_hour)
        setEvalHour(
          `${res.data.eval_hour}小时（${
            isNumber(res.data.eval_day)
              ? res.data.eval_day.toFixed(2)
              : res.data.eval_day
          }人天）`
        );
      if (res.data.act_hour) {
        setActHour(
          `${res.data.act_hour}小时（${
            isNumber(res.data.act_day)
              ? res.data.act_day.toFixed(2)
              : res.data.act_day
          }人天）`
        );
      }
    }
  };

  /** 查看已登记工时明细 */
  const onWorkDetailClick = () => {
    if (isDetailOpen) {
      setIsDetailOpen(false);
    } else {
      setIsDetailOpen(true);
    }
  };

  /** 工时登记成功 */
  const onRegistrationOk = async (values) => {
    const data = {
      workItemId: workItem[0],
      workItemEntityId: workItem[1],
      nodeId: workItem[2],
      actWorkHour: values.actWorkHour,
      workDesc: values.workDesc,
      workDate: values.workDate,
    };
    const res = await postInsertNodeWorkHour(data);
    if (res?.result) {
      message.success("登记成功");
      registrationForm.resetFields();
      setIsRegistrationOpen(false);
      fetchNodeWorkHourSumData();
    } else {
      message.warning("登记失败，请重试");
    }
  };

  /** 工时登记取消 */
  const onRegistrationCancel = () => {
    registrationForm.resetFields();
    setIsRegistrationOpen(false);
  };

  /** 计算预估工时 */
  const onActWorkHour = (e) => {
    if (!standWorkHour) return;
    setActDay((e / standWorkHour).toFixed(2));
  };

  /** 时间改变 */
  const onTimeVisibleOpen = () => {
    setWorkDate(new Date());
    setCalendarPickerVisible(true);
  };
  const onTimeChange = (date) => {
    setWorkDate(date);
  };
  const onTimeConfirm = () => {
    registrationForm.setFieldValue(
      "workDate",
      dayjs(workDate).format("YYYY-MM-DD")
    );
    setCalendarPickerVisible(false);
  };

  return isShow ? (
    <div className="control-warp">
      {!isRegistrationOpen ? (
        <div className="control-box">
          <Button
            size="large"
            type="link"
            icon={<PlusOutlined />}
            onClick={() => {
              setIsRegistrationOpen(true);
            }}
            style={{ padding: 0 }}
          >
            登记工时
          </Button>
        </div>
      ) : null}
      <Popup
        destroyOnClose
        showCloseButton
        visible={isRegistrationOpen}
        onMaskClick={() => setIsRegistrationOpen(false)}
        onClose={() => setIsRegistrationOpen(false)}
        bodyStyle={{
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          minHeight: "100vh",
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
        <div className="popup-header">
          <span className="popup-title">实际工时登记</span>
        </div>
        <div className="popup-content">
          <Form
            size="small"
            form={registrationForm}
            name="basic"
            labelCol={{
              span: 4,
            }}
            wrapperCol={{
              span: 20,
            }}
            initialValues={{
              remember: true,
            }}
            onFinish={onRegistrationOk}
            autoComplete="off"
            labelAlign="left"
          >
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
              <Input
                readOnly
                onClick={onTimeVisibleOpen}
                placeholder="请选择日期"
                className="rel-input"
              />
            </Form.Item>
            <Popup
              destroyOnClose
              showCloseButton
              visible={calendarPickerVisible}
              onMaskClick={() => setCalendarPickerVisible(false)}
              onClose={() => setCalendarPickerVisible(false)}
              bodyStyle={{
                borderTopLeftRadius: "16px",
                borderTopRightRadius: "16px",
                minHeight: "60vh",
                padding: "20px",
                boxSizing: "border-box",
              }}
            >
              <div className="popup-header">
                <span className="popup-title">日期选择</span>
              </div>
              <div className="popup-content">
                <Calendar
                  selectionMode="single"
                  value={workDate}
                  onChange={onTimeChange}
                />
              </div>
              <div className="popup-footer">
                <Button
                  size="large"
                  className="confirm-btn"
                  onClick={() => setCalendarPickerVisible(false)}
                >
                  取消
                </Button>
                <Button
                  size="large"
                  className="confirm-btn"
                  type="primary"
                  onClick={onTimeConfirm}
                >
                  确认
                </Button>
              </div>
            </Popup>
            <Form.Item
              label={
                <div>
                  <span style={{ color: "#df000e" }}>* </span>登记工时
                </div>
              }
            >
              <Space>
                <Form.Item
                  shouldUpdate
                  name="actWorkHour"
                  rules={[
                    {
                      required: true,
                      message: "工时不能为空",
                    },
                  ]}
                  noStyle
                >
                  <Stepper onChange={onActWorkHour} max={24} />
                </Form.Item>
                <span>{actDay ? `（${actDay} 人天）` : ""}</span>
              </Space>
            </Form.Item>
            <Form.Item label="工作描述" name="workDesc">
              <Input.TextArea
                showCount
                style={{
                  resize: "none",
                }}
                maxLength={200}
                placeholder="请输入"
                rows={4}
              />
            </Form.Item>
            <div style={{ textAlign: "right", display: "flex" }}>
              <Button
                size="large"
                style={{ flex: 1, marginRight: 10 }}
                htmlType="reset"
                onClick={onRegistrationCancel}
              >
                取消
              </Button>
              <Button
                size="large"
                style={{ flex: 1, marginLeft: 10 }}
                type="primary"
                htmlType="submit"
              >
                确认
              </Button>
            </div>
          </Form>
        </div>
        <div className="popup-footer"></div>
      </Popup>
      <div className="control-box">
        <div className="box-left">已登记工时</div>
        <div className="box-right">
          {actHour ? (
            <div>
              {actHour}
              <Button size="large" type="link" onClick={onWorkDetailClick}>
                查看明细{isDetailOpen ? <UpOutlined /> : <DownOutlined />}
              </Button>
            </div>
          ) : (
            "--"
          )}
        </div>
      </div>
      <Popup
        destroyOnClose
        showCloseButton
        visible={isDetailOpen}
        onMaskClick={() => setIsDetailOpen(false)}
        onClose={() => setIsDetailOpen(false)}
        bodyStyle={{
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          minHeight: "60vh",
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
        <div className="popup-header">
          <span className="popup-title">已登记工时明细</span>
        </div>
        <div className="popup-content">
          <Table
            scroll={{
              x: 640,
              y: 300,
            }}
            pagination={false}
            size="small"
            columns={detailColumns}
            dataSource={detailList}
          />
        </div>
        <div className="popup-footer"></div>
      </Popup>

      <div className="control-box">
        <div className="box-left">预估工时</div>
        <div className="box-right">{evalHour ? evalHour : "--"}</div>
      </div>
    </div>
  ) : (
    <Spin style={{ width: "100%", marginTop: "20%" }}></Spin>
  );
};
export default ControlIndex;

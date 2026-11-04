import React, { useState, useEffect } from "react";
import { Stepper, Calendar, Cascader, Popup } from "antd-mobile";
import {
  DatePicker,
  Button,
  InputNumber,
  Table,
  Form,
  Input,
  Space,
  message,
  Avatar,
  Spin,
} from "antd";
import { UserOutlined } from "@ant-design/icons";
import {
  getWorkItemOption,
  getItemEntityOption,
  getEntityNodeOption,
  postQueryNodeWorkHour,
  postQueryNodeWorkHourSum,
  postQueryNodeWorkHourDetail,
  postInsertNodeWorkHour,
  postUpdateNodeWorkHour,
  postDeleteNodeWorkHour,
  getStandWorkHour,
} from "../../../../api/api";
import { isNumber, validateNumber } from "../../../../util/util";
import "./RegWorkHour.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

const RegWorkHour = (props) => {
  const [registrationForm] = Form.useForm();
  const [id, setId] = useState("");
  const [spinning, setSpinning] = React.useState(true);
  let [workItemOption, setWorkItemOption] = useState([]);
  const [workItem, setWorkItem] = useState([]);
  const [workDate, setWorkDate] = useState(new Date());
  const [workItemName, setWorkItemName] = useState("");
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [workItemCascaderVisible, setWorkItemCascaderVisible] = useState(false);
  const [workItemLoading, setWorkItemLoading] = useState(false);
  const [standWorkHour, setStandWorkHour] = useState(0);
  const [capacitySet, setCapacitySet] = useState({});
  const [actDay, setActDay] = useState(0);
  const [isShowDetailBtnOpen, setIsShowDetailBtnOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailList, setDetailList] = useState([]);
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
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD") : "--"),
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
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 100,
      render: _ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--",
    },
  ];

  useEffect(() => {
    getWorkHour();
    fetchWorkItemOptionData();
  }, []);

  /** 查询组织标准工时 */
  const getWorkHour = async () => {
    const res = await getStandWorkHour();
    if (res?.result) {
      setStandWorkHour(res.data.standWorkHour);
      setCapacitySet(res.data);
    }
  };

  /** 获取工作项 */
  const fetchWorkItemOptionData = async () => {
    const res = await getWorkItemOption();
    if (res && res.data) {
      res.data = traverseTree(res.data);
      for (const item of res.data) {
        item.isLeaf = false;
      }
      workItemOption = res.data;
      if (props.setRegistrationValue) {
        const _item = JSON.parse(JSON.stringify(props.setRegistrationValue));
        _item.workDate = dayjs(_item.workDate).format("YYYY-MM-DD");
        _item.actWorkHour = _item.act_hour;
        onActWorkHour(_item.act_hour);
        registrationForm.setFieldsValue(_item);
        registrationForm.setFieldValue("workItem", [
          _item.workItemId,
          _item.workItemEntityId,
          _item.nodeId,
        ]);
        fetchNodeWorkHourSumData();
      } else {
        setWorkItemOption([...workItemOption]);
        setSpinning(false);
      }
    } else {
      setSpinning(false);
    }
  };

  /** 获取工作项实例 */
  const fetchItemEntityOptionData = async (workItemKey) => {
    const data = {
      workItemKey,
    };
    const res = await getItemEntityOption(data);
    if (res?.result && res.data.length) {
      for (const item of res.data) {
        item.isLeaf = false;
      }
      return res.data;
    }
  };

  const traverseTree = (node) => {
    let tree = [];
    const getStr = function (list) {
      list.forEach(function (row) {
        if ("children" in row && row.children.length) {
          getStr(row.children);
        } else {
          delete row.children;
        }
      });
    };
    getStr(node);
    return node;
  };

  /** 获取工作项实例节点 */
  const fetchEntityNodeOptionData = async (workItemKey, entityId) => {
    const data = {
      workItemKey,
      entityId,
    };
    const res = await getEntityNodeOption(data);
    if (res?.result && res.data.length) {
      return res.data;
    }
  };

  /** 查询工时登记节点总和 */
  const fetchNodeWorkHourSumData = async () => {
    const workItem = registrationForm.getFieldValue("workItem");
    const data = {
      workItemId: workItem.length > 0 ? workItem[0] : "",
      workItemEntityId: workItem.length > 1 ? workItem[1] : "",
      nodeId: workItem.length > 2 ? workItem[2] : "",
      taskId: workItem.length > 3 ? workItem[3] : "",
    };
    const res = await postQueryNodeWorkHourSum(data);
    if (res?.result) {
      if (res.data.scheduleDate_start && res.data.scheduleDate_end) {
        registrationForm.setFieldValue(
          "scheduleDate",
          `${dayjs(res.data.scheduleDate_start).format("YYYY-MM-DD")}~${dayjs(
            res.data.scheduleDate_end
          ).format("YYYY-MM-DD")}`
        );
      } else {
        registrationForm.setFieldValue("scheduleDate", ``);
      }
      setWorkItemName(
        `${res.data.workItemName}/${res.data.workItemEntityName}/${
          res.data.nodeName
        }${
          res.data.taskName && res.data.taskName !== null
            ? `/${res.data.taskName}`
            : ""
        }`
      );
      registrationForm.setFieldValue(
        "eval",
        `${res.data.eval_hour}小时（${
          isNumber(res.data.eval_day)
            ? res.data.eval_day.toFixed(2)
            : res.data.eval_day
        }人天）`
      );
      registrationForm.setFieldValue(
        "act",
        `${res.data.act_hour}小时（${
          isNumber(res.data.act_day)
            ? res.data.act_day.toFixed(2)
            : res.data.act_day
        }人天）`
      );
      if (res.data.act_hour) {
        setIsShowDetailBtnOpen(true);
      } else {
        setIsShowDetailBtnOpen(false);
      }
    }
    setSpinning(false);
  };

  /** 查询工时登记节点明细 */
  const fetchQueryNodeWorkHourDetailData = async () => {
    const workItem = registrationForm.getFieldValue("workItem");
    if (!workItem) return;
    const data = {
      workItemId: workItem.length > 0 ? workItem[0] : "",
      workItemEntityId: workItem.length > 1 ? workItem[1] : "",
      nodeId: workItem.length > 2 ? workItem[2] : "",
      taskId: workItem.length > 3 ? workItem[3] : "",
    };
    const res = await postQueryNodeWorkHourDetail(data);
    if (res?.result) {
      setDetailList(res.data);
    }
  };

  /** 查看已登记工时明细 */
  const onWorkDetailClick = () => {
    const workItem = registrationForm.getFieldValue("workItem");
    if (!workItem) {
      window.JSSDK.toast.warning("请先选择登记对象");
      return;
    }
    fetchQueryNodeWorkHourDetailData();
    setIsDetailOpen(true);
  };

  /** 工作项改变 */
  const onWorkItemSelect = (val, extend) => {
    loadData(extend.items);
  };
  const onWorkItemConfirm = (val, extend) => {
    if (val.length > 2) {
      registrationForm.setFieldValue("workItem", val);
      setWorkItem(val);
      setWorkItemId(val[0]);
      setWorkItemEntityId(val[1]);
      setNodeId(val[2]);
      fetchNodeWorkHourSumData();
      setWorkItemCascaderVisible(false);
      let name = "";
      workItemOption.filter((item) => {
        if (item.value === val[0]) {
          name = item.label;
          item.children.filter((entity) => {
            if (entity.value === val[1]) {
              name += `/${entity.label}`;
              entity.children.filter((node) => {
                if (node.value === val[2]) {
                  name += `/${node.label}`;
                  setWorkItemName(name);
                }
              });
            }
          });
        }
      });
      for (const item of workItemOption) {
        if (item.value === val[0]) {
          name = item.label;
        }
      }
      return;
    } else {
      registrationForm.setFieldValue("workItem", []);
      window.JSSDK.toast.warning("当前工作项下没节点，请配置后再填报");
    }
    setWorkItemCascaderVisible(false);
  };

  const loadData = (selectedOptions) => {
    switch (selectedOptions.length) {
      case 1:
        fetchItemEntityOptionData(
          selectedOptions[selectedOptions.length - 1].value
        ).then((res) => {
          if (res?.result) {
            selectedOptions[selectedOptions.length - 1].children = res;
            setWorkItemId(selectedOptions[selectedOptions.length - 1].value);
          } else {
            selectedOptions[selectedOptions.length - 1].isLeaf = true;
            window.JSSDK.toast.warning("当前工作项下没节点，请配置后再填报");
            registrationForm.setFieldValue("workItem", []);
          }
          setWorkItemOption([...workItemOption]);
        });
        break;
      case 2:
        fetchEntityNodeOptionData(
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value
        ).then((res) => {
          if (res?.result) {
            selectedOptions[selectedOptions.length - 1].children = res;
          } else {
            selectedOptions[selectedOptions.length - 1].isLeaf = true;
            window.JSSDK.toast.warning("当前工作项下没节点，请配置后再填报");
            registrationForm.setFieldValue("workItem", []);
          }
          setWorkItemOption([...workItemOption]);
        });
        break;
      default:
        break;
    }
  };

  const onActWorkHour = (e) => {
    if (!standWorkHour) return;
    setActDay((e / standWorkHour).toFixed(2));
  };

  const onRegistrationOk = async (values) => {
    if (registrationForm.getFieldValue("id")) {
      const data = {
        id: registrationForm.getFieldValue("id"),
        workItemId: values.workItem[0],
        workItemEntityId: values.workItem[1],
        nodeId: values.workItem[2],
        taskId: values.workItem.length > 3 ? values.workItem[3] : "",
        actWorkHour: values.actWorkHour,
        workDesc: values.workDesc,
        workDate: dayjs(values.workDate),
      };
      const res = await postUpdateNodeWorkHour(data);
      if (res?.result) {
        message.success("编辑成功");
        props.getRegistrationValue(true);
        registrationForm.resetFields();
      } else {
        window.JSSDK.toast.warning("编辑失败，请重试");
      }
    } else {
      const data = {
        workItemId: values.workItem[0],
        workItemEntityId: values.workItem[1],
        nodeId: values.workItem[2],
        taskId: values.workItem.length > 3 ? values.workItem[3] : "",
        actWorkHour: values.actWorkHour,
        workDesc: values.workDesc,
        workDate: values.workDate,
      };
      const res = await postInsertNodeWorkHour(data);
      if (res?.result) {
        message.success("登记成功");
        registrationForm.resetFields();
        props.getRegistrationValue(true);
      } else {
        window.JSSDK.toast.warning("登记失败，请重试");
      }
    }
  };

  const onRegistrationCancel = () => {
    registrationForm.resetFields();
    props.getRegistrationValue(false);
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

  return (
    <Spin spinning={spinning}>
      <Form
        layout="horizontal"
        size="small"
        form={registrationForm}
        name="basic"
        initialValues={{
          remember: true,
        }}
        onFinish={onRegistrationOk}
        onFinishFailed={onRegistrationCancel}
        autoComplete="off"
        labelAlign="left"
      >
        <Form.Item
          label="登记对象"
          name="workItem"
          rules={[
            {
              required: true,
              message: "登记对象不能为空",
            },
          ]}
        >
          <span
            className="top-item-btn"
            onClick={() => {
              setWorkItemCascaderVisible(true);
            }}
          >
            {workItemName ? (
              workItemName
            ) : (
              <span style={{ color: "#BBBBBB" }}>请选择</span>
            )}
          </span>
          <Cascader
            className="top-item"
            // loading={workItemLoading}
            visible={workItemCascaderVisible}
            options={workItemOption}
            value={workItem}
            disabled={props.setRegistrationValue}
            // onSelect={onWorkItemSelect}
            onConfirm={onWorkItemConfirm}
            onClose={() => {
              setWorkItemCascaderVisible(false);
            }}
          />
        </Form.Item>
        <Form.Item shouldUpdate name="scheduleDate" label="排期">
          <Input className="rel-input" disabled />
        </Form.Item>
        <Form.Item shouldUpdate name="eval" label="预估工时">
          <Input className="rel-input" disabled />
        </Form.Item>
        <Form.Item label="已登记工时">
          <Space>
            <Form.Item
              shouldUpdate
              name="act"
              rules={[
                {
                  required: true,
                  message: "工时不能为空",
                },
              ]}
              noStyle
            >
              <Input className="rel-input" disabled />
            </Form.Item>
            {isShowDetailBtnOpen ? (
              <Button size="large" type="link" onClick={onWorkDetailClick}>
                查看明细
              </Button>
            ) : null}
          </Space>
        </Form.Item>
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
                {
                  validator: validateNumber(
                    capacitySet?.onceDown,
                    24,
                    "单次填报工时下限",
                    "小时"
                  ),
                },
              ]}
              noStyle
            >
              <Stepper onChange={onActWorkHour} />
              {/* <InputNumber
                type="number"
                onChange={onActWorkHour}
                min={1}
                max={24}
              /> */}
            </Form.Item>
            <span>{actDay ? `（${actDay} 人天）` : ""}</span>
          </Space>
        </Form.Item>
        <Form.Item label="工作描述" name="workDesc">
          <Input.TextArea
            style={{
              resize: "none",
            }}
            showCount
            maxLength={200}
            placeholder="请输入"
            rows={4}
          />
        </Form.Item>
        {props.type === "mob" ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              lineHeight: 3,
            }}
          >
            <Button
              size="large"
              style={{ flex: 1, marginRight: "5px" }}
              htmlType="reset"
              onClick={onRegistrationCancel}
            >
              取消
            </Button>
            <Button
              size="large"
              style={{ flex: 1, marginLeft: "5px" }}
              type="primary"
              htmlType="submit"
            >
              确认
            </Button>
          </div>
        ) : (
          <div style={{ textAlign: "right" }}>
            <Space>
              <Button
                size="large"
                htmlType="reset"
                onClick={onRegistrationCancel}
              >
                取消
              </Button>
              <Button size="large" type="primary" htmlType="submit">
                确认
              </Button>
            </Space>
          </div>
        )}
      </Form>
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
          <div style={{ marginBottom: 10, fontSize: 14 }}>
            登记对象: {workItemName}
          </div>
          <div style={{ marginBottom: 10, fontSize: 14 }}>已登记工时</div>
          <Table
            scroll={{
              x: 640,
              y: 300,
            }}
            pagination={false}
            columns={detailColumns}
            dataSource={detailList}
          />
        </div>
        <div className="popup-footer"></div>
      </Popup>
    </Spin>
  );
};

export default RegWorkHour;

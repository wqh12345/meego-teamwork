import React, { useEffect, useState } from "react";
import { Form, Button, InputNumber, message, Space, Typography } from "antd";
import {
  getStandWorkHour,
  postUpdateStandWorkHour,
} from "../../../../../../api/api";
import "./CapacitySet.less";
const { Text } = Typography;

const CapacitySet = (props) => {
  const [capacityInitialValues, setCapacityInitialValues] = useState(
    props?.capacityInitialValues
  );
  const [capacityForm] = Form.useForm();
  const [capacityFormVS, setCapacityFormVS] = useState({
    standWorkHour: false,
    standWorkHourMsg: "",
    dayUp: false,
    dayUpMsg: "",
    onceDown: false,
    onceDownMsg: "",
  });

  useEffect(() => {
    capacityForm.setFieldsValue({});
    validatorCapacityForm({});
  }, []);

  /** 校验容量填报规则 */
  const validateTwoDecimalPlaces = (_, value) => {
    const reg = /^\d+(\.\d{1,2})?$/;
    // 检查值是否存在且不为空字符串，然后进行正则验证
    if (value !== undefined && value !== null && value !== '') {
      // 如果值为0，拒绝输入
      if (parseFloat(value) === 0) {
        return Promise.reject(new Error("请输入大于0的数字"));
      }
      // 进行正则验证
      if (!reg.test(value)) {
        return Promise.reject(new Error("请输入保留两位小数的数字"));
      }
    }
    return Promise.resolve();
  };

  /** 登记设置字段值变化 */
  const onCapacityValuesChange = (changedValues, allValues) => {
    validatorCapacityForm(allValues);
  };

  /** 校验容量规则 */
  const validatorCapacityForm = (allValues) => {
    if (allValues.standWorkHour && allValues.dayUp) {
      if (allValues.standWorkHour > allValues.dayUp) {
        capacityFormVS.standWorkHour = true;
        capacityFormVS.standWorkHourMsg =
          "请注意，当前单位人天标准工时大于[单天填报工时上限]";
        capacityFormVS.dayUp = true;
        capacityFormVS.dayUpMsg =
          "请注意，当前单天填报工时上限小于[单位人天标准工时]";
      } else {
        capacityFormVS.standWorkHour = false;
        capacityFormVS.standWorkHourMsg = "";
        capacityFormVS.dayUp = false;
        capacityFormVS.dayUpMsg = "";
      }
      if (allValues.onceDown) {
        if (
          allValues.onceDown > allValues.standWorkHour &&
          allValues.onceDown > allValues.dayUp
        ) {
          capacityFormVS.onceDown = true;
          capacityFormVS.onceDownMsg =
            "请注意，当前填报大于[单位人天标准工时]且大于[单天填报工时上限]";
        } else if (allValues.onceDown > allValues.dayUp) {
          capacityFormVS.onceDown = true;
          capacityFormVS.onceDownMsg = "请注意，当前填报大于[单天填报工时上限]";
        } else if (allValues.onceDown > allValues.standWorkHour) {
          capacityFormVS.onceDown = true;
          capacityFormVS.onceDownMsg = "请注意，当前填报大于[单位人天标准工时]";
        } else {
          capacityFormVS.onceDown = false;
          capacityFormVS.onceDownMsg = "";
        }
      }
    } else {
      capacityFormVS.standWorkHour = false;
      capacityFormVS.standWorkHourMsg = "";
      capacityFormVS.dayUp = false;
      capacityFormVS.dayUpMsg = "";
      capacityFormVS.dayDown = false;
      capacityFormVS.dayDownMsg = "";
    }
    setCapacityFormVS({ ...capacityFormVS });
  };

  /** 设置容量 */
  const onCapacityFinish = async (values) => {
    const res = await postUpdateStandWorkHour(values);
    if (res?.result) {
      window.JSSDK.toast.success("修改成功");
      props.setIsCapacityFormOpen(true);
      setCapacityInitialValues(values);
    }
  };

  return (
    <Form
      form={capacityForm}
      onValuesChange={onCapacityValuesChange}
      onFinish={onCapacityFinish}
      initialValues={capacityInitialValues}
      layout="vertical"
      className="set-form"
    >
      <Form.Item
        label={
          <div>
            <div>单位人天标准工时</div>
            <div className="label-desc">
              设置后，成员登记的工时将按标准工作时长换算人天
            </div>
          </div>
        }
        style={{
          marginBottom: !capacityFormVS?.standWorkHour ? "24px" : 0,
        }}
        name="standWorkHour"
        rules={[
          {
            required: true,
            message: <div>单位人天标准工时不能为空</div>,
          },
          {
            validator: validateTwoDecimalPlaces,
          },
        ]}
      >
        <InputNumber min={0.01} max={24} addonAfter="小时" width={160} />
      </Form.Item>
      {capacityFormVS?.standWorkHour ? (
        <Text type="warning">{capacityFormVS?.standWorkHourMsg}</Text>
      ) : null}
      <Form.Item
        label={
          <div>
            <div>单天填报工时上限</div>
            <div className="label-desc">
              设置后，单个成员每自然天填报的工时数不可超过此数
            </div>
          </div>
        }
        name="dayUp"
        style={{
          marginBottom: !capacityFormVS?.dayUp ? "24px" : 0,
        }}
        rules={[
          {
            required: true,
            message: <div>单天填报工时上限不能为空</div>,
          },
          {
            validator: validateTwoDecimalPlaces,
          },
        ]}
      >
        <InputNumber min={0.01} max={24} addonAfter="小时" />
      </Form.Item>
      {capacityFormVS?.dayUp ? (
        <Text type="warning">{capacityFormVS?.dayUpMsg}</Text>
      ) : null}
      <Form.Item
        label={
          <div>
            <div>单次填报工时下限</div>
            <div className="label-desc">
              设置后，成员单次登记工时不得小于当前数量
            </div>
          </div>
        }
        name="onceDown"
        style={{
          marginBottom: !capacityFormVS?.onceDown ? "24px" : 0,
        }}
        rules={[
          {
            required: true,
            message: "单次填报下限不能为空",
          },
          {
            validator: validateTwoDecimalPlaces,
          },
        ]}
      >
        <InputNumber min={0.01} max={24} addonAfter="小时" />
      </Form.Item>
      {capacityFormVS?.onceDown ? (
        <Text
          style={{
            marginBottom: !capacityFormVS?.onceDown ? 0 : "24px",
            display: "block",
          }}
          type="warning"
        >
          {capacityFormVS?.onceDownMsg}
        </Text>
      ) : null}
      {/* <Space style={{ justifyContent: "flex-end", width: "100%" }}>
        <Button onClick={() => props.setIsCapacityFormOpen(false)}>取消</Button>
        <Button type="primary" htmlType="submit">
          确定
        </Button>
      </Space> */}
    </Form>
  );
};
export default CapacitySet;

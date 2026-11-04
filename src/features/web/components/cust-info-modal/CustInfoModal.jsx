import React, { useEffect, useState } from "react";
import { Button, Modal, Form, message, Input } from "antd";
import { NotificationFilled } from "@ant-design/icons";
import Marquee from "react-fast-marquee";
import {
  getJudgeHasRecord,
  postAddRetainPropertyInfo,
  getSendSms,
  getVerifySms,
} from "../../../../api/api";
import "./CustInfoModal.less";
import HeaderBg from "../../../../image/customer-info-modal-header.png";
import pluginConfig from "../../../../../plugin.config.json";
import { get } from "../../../../config";

const CustInfoModal = (props) => {
  const { open: controlledOpen, onClose, onNeedShow } = props;
  const [form] = Form.useForm();
  const [internalOpen, setInternalOpen] = useState(false);
  const [getCodeBtnDisabled, setGetCodeBtnDisabled] = useState(true);
  const [verifyBtnMsg, setVerifyBtnMsg] = useState("获取验证码");

  // 支持受控和非受控两种模式
  const isShow = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsShow = (val) => {
    if (controlledOpen === undefined) {
      setInternalOpen(val);
    }
    if (val && onNeedShow) onNeedShow(true);
  };
  const handleClose = () => {
    setInternalOpen(false);
    onNeedShow?.(false);
    onClose?.();
  };

  useEffect(() => {
    getIsShowModal();
  }, []);

  /** 是否显示留资弹窗 */
  const getIsShowModal = async () => {
    const res = await getJudgeHasRecord();
    if (res?.result && !res?.data) {
      setIsShow(true);
      onNeedShow?.(true);
    } else {
      props.isShowPublicModal?.(true);
    }
  };

  /** 提交留资信息 */
  const onSubmit = async (values) => {
    const res = await postAddRetainPropertyInfo(values);
    if (res?.result) {
      window.JSSDK.toast.success("提交成功");
      handleClose();
      props.isShowPublicModal?.(true);
    }
  };

  /** 获取手机验证码 */
  const getVerCode = async () => {
    let curTime = 60;
    let timer = setInterval(() => {
      setGetCodeBtnDisabled(true);
      setVerifyBtnMsg(`获取验证码（${curTime}秒）`);
      if (curTime === 0) {
        clearInterval(timer);
        if (form.getFieldValue("linkmanPhone")) setGetCodeBtnDisabled(false);
        setVerifyBtnMsg(`获取验证码`);
        return;
      }
      curTime--;
    }, 1000);
    const data = {
      linkmanPhone: form.getFieldValue("linkmanPhone"),
    };
    const res = await getSendSms(data);
    if (res?.result && res?.data) {
      window.JSSDK.toast.success("发送成功");
    }
  };

  /** 字段变化 */
  const onValuesChange = (changedValues, allValues) => {
    if (!allValues.linkmanPhone) {
      setGetCodeBtnDisabled(true);
    }
  };

  const validateWordCount = (min, max) => {
    return (_, value) => {
      if (value) {
        const length = value.length;
        // if (length < min) {
        //   return Promise.reject(new Error(`输入内容不能少于 ${min} 个字符`));
        // }
        if (length > max) {
          return Promise.reject(new Error(`输入内容不能超过 ${max} 个字符`));
        }
      }
      return Promise.resolve();
    };
  };

  return (
    <Modal
      className="customer-modal-warp"
      title={<div src={HeaderBg} className="customer-modal-header" />}
      open={isShow}
      width={500}
      closable={false}
      footer={null}
    >
      <Form form={form} onValuesChange={onValuesChange} onFinish={onSubmit}>
        <Form.Item
          name="companyName"
          label="公司名称"
          rules={[
            { required: true, message: "公司名称不能为空" },
            {
              validator: validateWordCount(0, 100),
            },
          ]}
        >
          <Input placeholder="请输入公司全称" />
        </Form.Item>
        <Form.Item
          name="position"
          label="您的职位"
          rules={[
            { required: true, message: "职位不能为空" },
            {
              validator: validateWordCount(0, 50),
            },
          ]}
        >
          <Input placeholder="请输入" />
        </Form.Item>
        <Form.Item
          name="linkman"
          label="您的姓名"
          rules={[
            { required: true, message: "姓名不能为空" },
            {
              validator: validateWordCount(0, 50),
            },
          ]}
        >
          <Input placeholder="请输入" />
        </Form.Item>
        {pluginConfig.siteDomain === "https://project.feishu.cn" ? (
          <>
            <Form.Item
              name="linkmanPhone"
              label="联系方式"
              rules={[
                { required: true, message: "联系方式不能为空" },
                {
                  validator: (_, value) => {
                    if (value && !/^1[3-9]\d{9}$/.test(value)) {
                      return Promise.reject(new Error("请输入有效的手机号码"));
                    }
                    setGetCodeBtnDisabled(false);
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input placeholder="请输入手机号" maxLength={11} />
            </Form.Item>
            <div className="customer-modal-item">
              <Form.Item
                name="code"
                label="验证码 "
                rules={[
                  { required: true, message: "验证码不能为空" },
                  {
                    validator: async (_, value) => {
                      if (value && value?.length !== 6) {
                        return Promise.reject(new Error("请输入有效的验证码"));
                      }
                      if (
                        value &&
                        value?.length === 6 &&
                        form.getFieldValue("linkmanPhone")
                      ) {
                        const data = {
                          linkmanPhone: form.getFieldValue("linkmanPhone"),
                          code: value,
                        };
                        const res = await getVerifySms(data);
                        if (res?.result && res?.data) {
                          return Promise.resolve();
                        } else {
                          return Promise.reject(new Error(res?.msg));
                        }
                      }
                    },
                  },
                ]}
              >
                <Input placeholder="请输入" style={{ marginLeft: "15px" }} />
              </Form.Item>
              <Button
                disabled={getCodeBtnDisabled}
                type="primary"
                onClick={getVerCode}
              >
                {verifyBtnMsg}
              </Button>
            </div>
          </>
        ) : null}
        {pluginConfig.siteDomain === "https://project.larksuite.com" ? (
          <>
            <Form.Item
              name="linkmanPhone"
              label="联系邮箱"
              rules={[
                {
                  type: "email",
                  message: "请输入正确的邮箱",
                },
                {
                  required: true,
                  message: "邮箱不能为空",
                },
              ]}
            >
              <Input placeholder="请输入邮箱地址" maxLength={100} />
            </Form.Item>
          </>
        ) : null}
        <Form.Item className="ant-modal-footer">
          <Button type="primary" htmlType="submit">
            提交
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};
export default CustInfoModal;

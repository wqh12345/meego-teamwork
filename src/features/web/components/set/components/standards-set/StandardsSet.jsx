import React, { useEffect, useState } from "react";
import { Form, Button, InputNumber, message, Space, Typography, Input, Tooltip, Modal, Spin, Radio} from "antd";
import {
  getStandWorkHour,
  postUpdateStandWorkHour,
  saveStandardsConfig,
  getTenantModeInfo,
  getStandardsConfigHoliday,
  queryCountryHoliday,
  deleteStandardsConfig,
  standardsClearByUuid
} from "../../../../../../api/api";
import { ExclamationCircleFilled,CloseOutlined } from '@ant-design/icons';
import authLeftIcon from "../../../../../../image/auth_left.png";
import RestDayConfigModal from './RestDayConfigModal';
import MemberModal from './MemberModal';
import UserSettings from '../standards-user/user';
import AttendanceToggle from './attendance-config/AttendanceToggle';
import {
  normalizeAttendanceConfig,
  buildAttendanceConfigPayload,
  isIsvInstalled,
  ATTENDANCE_DATA_SOURCE,
  MISSING_CARD_POLICY,
} from './attendance-config/attendanceConfig';
import "./StandardsSet.less";
const { Text } = Typography;
import { generateUuid} from "../../../../../../util/util";
const StandardsSet = (props) => {
  //console.log('props', props);
  const [capacityInitialValues, setCapacityInitialValues] = useState(
      props?.standardConfigData
  );
  const [uuid, setUuid] = useState(generateUuid());
  const [countryCode, setCountryCode] = useState(props?.standardConfigData?.countryCode || null);
  const [isDefault, setIsDefault] = useState(props?.standardConfigData?.isDefault || false);
  const [capacityForm] = Form.useForm();
  const [capacityFormVS, setCapacityFormVS] = useState({
    standWorkHour: false,
    standWorkHourMsg: "",
    dayUp: false,
    dayUpMsg: "",
    onceDown: false,
    onceDownMsg: "",
  });
  const [isAdd, setIsAdd] = useState(props?.isAdd?1:0);
  // 控制弹窗显隐
  const [updateMemberData, setUpdateMemberData] = useState(false);
  const [saveMemberData, setSaveMemberData] = useState({});
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [isSelectedUserOpen, setIsSelectedUserOpen] = useState(false);
  const [selected, setSelected] = useState({
      selectedDeparts: [],
      selectedUsers: [],
      selectedDepartIds: [],
      selectedUserIds: [],
      checkedKeys: []
    });
  const [newSelected, setNewSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: []
  });
  const [selectedSeatCount, setSelectedSeatCount] = useState({
      uniqueSelectedCount: 0,
      seatTotal: 0,
  });
  const [holidayConfigData, setHolidayConfigData] = useState({});
  const showModal = () => setVisible(true);
  const [standardUser, setStandardUser] = useState(props?.standardConfigData?.defaultUsers || []);
  const [stashRest, setStashRest] = useState(null);
  const [restTime, setRestTime] = useState(null);
  const [missingCardLimitError, setMissingCardLimitError] = useState("");
  const [isvInstalled, setIsvInstalled] = useState(() => {
    try {
      const tenantModeInfo = JSON.parse(sessionStorage.getItem('tenantModeInfo') || '{}');
      return isIsvInstalled(tenantModeInfo);
    } catch {
      return false;
    }
  });
  const [attendanceConfig, setAttendanceConfig] = useState(() => (
    normalizeAttendanceConfig(props?.standardConfigData)
  ));
  useEffect(() => {
    capacityForm.setFieldsValue({})
    validatorCapacityForm({}, attendanceConfig.attendanceEnabled)
    if(!props?.isAdd) {
      getStandardsConfigHolidayInfo(true)
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getTenantModeInfo().then((res) => {
      if (!mounted || !res?.result) return;
      const tenantModeInfo = res.data || {};
      sessionStorage.setItem('tenantModeInfo', JSON.stringify(tenantModeInfo));
      setIsvInstalled(isIsvInstalled(tenantModeInfo));
    }).catch(() => {
      // 保留首次渲染时从 sessionStorage 读取的状态
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (props?.isAdd === 0 && props?.standardConfigData) {
      const editData = props.standardConfigData;
      const nextAttendanceConfig = normalizeAttendanceConfig(editData);
      setAttendanceConfig(nextAttendanceConfig);
      validatorCapacityForm({
        standWorkHour: editData.standWorkHour,
        dayUp: editData.dayUp,
        onceDown: editData.onceDown,
      }, nextAttendanceConfig.attendanceEnabled);
    }
  }, [props?.isAdd, props?.standardConfigData, isvInstalled]);

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
  const validatorCapacityForm = (allValues, attendanceEnabled = attendanceConfig.attendanceEnabled) => {
    if (!attendanceEnabled && allValues.standWorkHour && allValues.dayUp) {
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
  const onFinish = async (values) => {
    let { standardsName, standWorkHour, dayUp, onceDown } = values;
    if (isvInstalled && attendanceConfig.attendanceEnabled && (dayUp === undefined || dayUp === null || dayUp === '')) {
      dayUp = capacityInitialValues?.dayUp || attendanceConfig.dayUp || 8;
    }
    if (
      isvInstalled &&
      attendanceConfig.attendanceEnabled &&
      attendanceConfig.missingCardPolicy === MISSING_CARD_POLICY.CUSTOM_LIMIT &&
      !(typeof attendanceConfig.missingCardLimit === 'number' && attendanceConfig.missingCardLimit > 0)
    ) {
      setMissingCardLimitError('缺卡自定义提交上限不能为空');
      return;
    }
    const userKeys = standardUser.map((user) => user.userKey);
    let holidayData=[]
    let operationDate = [];
    let sumbitCountryCode=null
    if(stashRest && stashRest.holidayDefaultConfigArr){
      // 将日期数组转换为对象数组
      holidayData=Array.from(stashRest.holidayDefaultConfigArr).map(date => ({"holiday": date }))
      sumbitCountryCode=stashRest.countryCode
    }
    if((stashRest && stashRest.holidayDefaultConfigArr)&& (stashRest &&  stashRest.operationDate)){
      stashRest.operationDate.forEach((val,key) => {
         operationDate.push(key)
        // if(stashRest.holidayDefaultConfigArr.has(key)){
        //     if(!val){
        //       operationDate.push(key);
        //     }
        // }else{
        //   if(val){
        //       operationDate.push(key);
        //   }
        // }
      });
      operationDate= operationDate.map(date => ({ holiday: date }))
    }
    if(!stashRest && holidayConfigData && holidayConfigData.holidayDefaultConfigArr){
      sumbitCountryCode=holidayConfigData.countryCode
      // 将日期数组转换为对象数组
      holidayData=Array.from(holidayConfigData.holidayDefaultConfigArr).map(date => ({"holiday": date }))
      operationDate=[]
    }
    //console.log('operationDate',holidayData,operationDate);
    const data={
      id: props?.standardConfigData?.id || null,
      standardsName,
      standWorkHour, 
      dayUp, 
      onceDown,
      userKeys:userKeys,
      isDefault: props?.standardConfigData?.isDefault || false,
      countryCode: sumbitCountryCode,
      holiday: holidayData,
      operationDate:operationDate,
      ...(isvInstalled
        ? buildAttendanceConfigPayload(attendanceConfig)
        : {
          attendanceEnabled: attendanceConfig.attendanceEnabled ? 1 : 0,
          attendanceDataSource: attendanceConfig.attendanceDataSource || null,
          missingCardPolicy: attendanceConfig.missingCardPolicy,
          missingCardLimit: attendanceConfig.missingCardLimit,
        }),
    }
     if (!data.id && (stashRest && stashRest.syncTime || stashRest && stashRest.restTime)) {
      data.uuid =  uuid
    }
    // if (!data.id && restTime) {
    //   data.restTime = restTime;
    // }
    // if (!data.id && stashRest.syncTime) {
    //   data.syncTime = stashRest.syncTime;
    // }
   setLoading(true);
    const res = await saveStandardsConfig(data);
    if (res?.result) {
      window.JSSDK.toast.success("保存成功");
      setLoading(false)
      props.setStandardsSetOpen(true)
    }else{
      setLoading(false)
    }

  };
  const getStandardsConfigHolidayInfo = async (flag) => {
     const data={
      isDefault: isDefault || false,
    }
    if (props?.standardConfigData?.id) {
      data.id = props?.standardConfigData?.id
    }
    if (props?.standardConfigData?.countryCode) {
      data.countryCode = props?.standardConfigData?.countryCode
    }
    setLoading(true);
    const res = await getStandardsConfigHoliday(data);
    if (res?.result) {
      if (res?.data?.holidayDefaultConfigVos) {
        const holidayDefaultConfigArr = new Set();
        res?.data?.holidayDefaultConfigVos.forEach((config) => {
          holidayDefaultConfigArr.add(config.holiday);
        });
        res.data.holidayDefaultConfigArr = holidayDefaultConfigArr;
      }
      setHolidayConfigData(res.data);
      //setVisible(true);
    } else {
    }
    if (!flag) {
      setVisible(true);
    }
    setLoading(false);
  };
  // 自定义初始休息日（可从接口获取）
  const customRestDays = [
    '2025-07-04', '2025-07-05', '2025-07-11'
  ];

  // 同步未来日历回调
  const deleteStandardsConfigData = async() => {
    const data = { id: props?.standardConfigData?.id };
    const res = await deleteStandardsConfig(data)
    if (res?.result) {
      window.JSSDK.toast.success("删除成功");
      props.setStandardsSetOpen(true)
    }
  };
  const deleteStandardsConfigModal = () => {
    //const deleteName=capacityForm.getFieldValue('standardsName')
    const deleteName=props?.standardConfigData?.standardsName
    // 模拟同步操作
     Modal.confirm({
      title: "确认删除？",
      icon: <ExclamationCircleFilled />,
      content: `删除后，该记录规范中的用户将加入默认记录规范！确认删除【${deleteName}】吗?`,
      closeIcon: <CloseOutlined />,
      width: 480,
      centered: true,
      async onOk() {
        deleteStandardsConfigData()
      },
      onCancel() {
      },
    });
  };
  const onClose = async() => {
    const data = { uuid: uuid };
    const res = await standardsClearByUuid(data)
    setVisible(false);
  };
  const getRestTime = (val) => {
    setRestTime(val);
  };
  const getHolidayConfig = (val) => {
    //console.log('val888888',val);
    setVisible(false);
    setStashRest(val);
  };
  const handleSelectedUserCancel = () => {
    setIsSelectedUserOpen(false);
    if(updateMemberData){
      //setUpdateMemberData(false);
    }else{

    }
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
  const handleSelectedUserOk = () => {
    setSaveMemberData({...selected});
    setStandardUser(selected.selectedUsers);
    setIsSelectedUserOpen(false);
  };
   const getSelectedUser = (user) => {
    user?.selectedUsers?.forEach(item => {
      item.userName = item.userName || item.staffName || item.username ||item.nameCn;
    })
    setSelected({ ...user});
  };
  const onSelectedCountChange = (count) => {
    setSelectedSeatCount({...count});
  }
  const showMemberModal = async () => {
    let memberData
    if(updateMemberData){
      memberData=saveMemberData
    }else{
      memberData=[]
    }
    setSaveMemberData({ ...memberData });
    //console.log('memberData88888', standardUser);
    setIsSelectedUserOpen(true);
    setSelected({
      selectedDeparts: [],
      selectedUsers: JSON.parse(JSON.stringify(standardUser)),
      selectedDepartIds: [],
      selectedUserIds: standardUser.map((user) => user.userKey) ,
      checkedKeys: [],
    });
  };
  return (
    <Spin spinning={loading}>
    <div className="set-container">
      <Form
        form={capacityForm}
        onValuesChange={onCapacityValuesChange}
        onFinish={onFinish}
        initialValues={capacityInitialValues}
        layout="vertical"
        className="set-form"
      >
        <Form.Item
          label={
            <div>
              <div className="guifan-f16">规范名称<span className="required-star">*</span></div>
            </div>
          }
          style={{
            marginBottom: !capacityFormVS?.standWorkHour ? "20px" : 0,
          }}
          required={false}
          name="standardsName"
          rules={[
            {
              required: true,
              message: <div>规范名称不能为空</div>,
            }
          ]}
        >
          <Input placeholder="请输入规范名称" showCount maxLength={50} allowClear autoComplete="off" style={{ width: 420 }} autoCapitalize="off" autoCorrect="off" spellCheck="false" />
        </Form.Item>
        <Form.Item
          label={
            <div>
              <div className="guifan-f16">成员</div>
            </div>
          }
          style={{
            marginBottom: !capacityFormVS?.standWorkHour ? "20px" : 0,
          }}
          name="name"
        >
          <div className="standards-user-list" onClick={() => { 
            if(isDefault){
              setMemberModalVisible(true);
            }else{
             showMemberModal()
            } 
            }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', height: '36px', lineHeight: '36px', }}>
              {standardUser.length > 0 ? (
                <>
                  {/* 显示前6个成员 */}
                  {standardUser.slice(0, 4).map((item, idx) => (
                    <span key={idx} className="user-item-area">
                      <img
                        src={item.avatarUrl || item.staffAvatarUrl }
                        alt={item.userName || item.staffName || item.username}
                        className="user-item-head-img"
                      />
                      <span>{item.userName || item.staffName || item.username}{item.tag === 0 ? ' [已删除]' : ''}</span>
                    </span>
                  ))}
                  {/* 如果超过6个成员，显示+数字并添加Tooltip */}
                  {standardUser.length > 4 && (
                    <Tooltip
                      title={
                        <div style={{ maxHeight: '300px', overflowY: 'auto', width: '100px' }}>
                          {standardUser.slice(4).map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <img
                                src={item.avatarUrl || item.staffAvatarUrl}
                                alt={item.userName || item.staffName || item.username}
                                style={{ width: '20px', height: '20px', borderRadius: '50%'}}
                              />
                              <span>{item.userName || item.staffName || item.username}{item.tag === 0 ? ' [已删除]' : ''}</span>
                            </div>
                          ))}
                        </div>
                      }
                      placement="top"
                    >
                      <span
                        className="user-item-area-num"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        +{standardUser.length - 4}
                      </span>
                    </Tooltip>
                  )}
                </>
              ) : (
                <span style={{ color: '#C9CDD4' }}>请选择成员</span>
              )}
            </div>
            <span className="auth-user-head"><img src={authLeftIcon} alt="auth_left" width="18px" /></span>
          </div>
        </Form.Item>
        <Form.Item
          style={{
            paddingBottom: 22,
            marginBottom:0
          }}
          label={
            <div>
              <div className="guifan-f16">单位人天标准工时<span className="required-star">*</span></div>
              <div className="label-desc">
                设置后，成员登记的工时将按标准工作时长换算人天
              </div>
            </div>
          }
          required={false}
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
          <InputNumber min={0.01} max={24} addonAfter="小时" style={{ width: 160}} />
        </Form.Item>
        {capacityFormVS?.standWorkHour ? (
          <Text type="warning">{capacityFormVS?.standWorkHourMsg}</Text>
        ) : null}
        {isvInstalled && (
          <AttendanceToggle
            attendanceEnabled={attendanceConfig.attendanceEnabled}
            onChange={(next) => {
              const enabled = Boolean(next?.attendanceEnabled);
              if (!enabled) {
                setMissingCardLimitError('');
              }
              if (enabled) {
                const fallback = capacityInitialValues?.dayUp || attendanceConfig.dayUp || 8;
                capacityForm.setFieldsValue({ dayUp: fallback });
              }
              setAttendanceConfig(normalizeAttendanceConfig({
                ...attendanceConfig,
                ...next,
                dayUp: capacityForm.getFieldValue('dayUp'),
              }));
              validatorCapacityForm(capacityForm.getFieldsValue(), enabled);
            }}
          />
        )}
        {isvInstalled && attendanceConfig.attendanceEnabled ? (
          <>
            <Form.Item
              label={
                <div>
                  <div className="guifan-f16">单天填报工时上限</div>
                  <div className="label-desc">成员当天可登记工时上限将取自考勤数据</div>
                </div>
              }
            >
              <Radio.Group
                value={attendanceConfig.attendanceDataSource || ATTENDANCE_DATA_SOURCE.SCHEDULED}
                onChange={(event) => setAttendanceConfig(normalizeAttendanceConfig({
                  ...attendanceConfig,
                  attendanceDataSource: event.target.value,
                  dayUp: capacityForm.getFieldValue('dayUp'),
                }))}
              >
                <Radio value={ATTENDANCE_DATA_SOURCE.SCHEDULED}>班内工作时长</Radio>
                <Radio value={ATTENDANCE_DATA_SOURCE.ACTUAL}>实际出勤时长</Radio>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label={
                <div>
                  <div className="guifan-f16">缺卡异常</div>
                  <div className="label-desc">考勤数据为缺卡时，记录和提交规则</div>
                </div>
              }
            >
              <Radio.Group
                value={attendanceConfig.missingCardPolicy || MISSING_CARD_POLICY.BLOCK}
                onChange={(event) => {
                  setMissingCardLimitError('');
                  setAttendanceConfig(normalizeAttendanceConfig({
                    ...attendanceConfig,
                    missingCardPolicy: event.target.value,
                    dayUp: capacityForm.getFieldValue('dayUp'),
                  }));
                }}
              >
                <Radio value={MISSING_CARD_POLICY.BLOCK}>不允许提交</Radio>
                <Radio value={MISSING_CARD_POLICY.CUSTOM_LIMIT}>允许提交-自定义提交上限</Radio>
              </Radio.Group>
            </Form.Item>
            {attendanceConfig.missingCardPolicy === MISSING_CARD_POLICY.CUSTOM_LIMIT ? (
              <Form.Item
                label={
                  <div>
                    <div className="guifan-f16">缺卡自定义提交上限</div>
                    <div className="label-desc">设置后，缺卡日期提交工时不可超过此数</div>
                  </div>
                }
                required
                validateStatus={missingCardLimitError ? 'error' : ''}
                help={missingCardLimitError}
              >
                <InputNumber
                  id="missingCardLimit"
                  min={0.01}
                  max={24}
                  addonAfter="小时"
                  value={attendanceConfig.missingCardLimit}
                  onChange={(value) => {
                    setMissingCardLimitError('');
                    setAttendanceConfig(normalizeAttendanceConfig({
                      ...attendanceConfig,
                      missingCardLimit: value,
                      dayUp: capacityForm.getFieldValue('dayUp'),
                    }));
                  }}
                  style={{ width: 160 }}
                />
              </Form.Item>
            ) : null}
          </>
        ) : (
          <Form.Item
            label={
              <div>
                <div className="guifan-f16">单天填报工时上限<span className="required-star">*</span></div>
                <div className="label-desc">
                  设置后，单个成员每自然天填报的工时数不可超过此数
                </div>
              </div>
            }
            required={false}
            name="dayUp"
            style={{
              paddingBottom: 22,
              marginBottom:0
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
            <InputNumber min={0.01} max={24} addonAfter="小时" style={{ width: 160}}/>
          </Form.Item>
        )}
        {(!isvInstalled || !attendanceConfig.attendanceEnabled) && capacityFormVS?.dayUp ? (
          <Text type="warning">{capacityFormVS?.dayUpMsg}</Text>
        ) : null}
        <Form.Item
          label={
            <div>
              <div className="guifan-f16">单次填报工时下限<span className="required-star">*</span></div>
              <div className="label-desc">
                设置后，成员单次登记工时不得小于当前数量
              </div>
            </div>
          }
          required={false}
          name="onceDown"
          style={{
            paddingBottom: 22,
            marginBottom:0
            // marginBottom: !capacityFormVS?.onceDown ? "20px" : 0,
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
          <InputNumber min={0.01} max={24} addonAfter="小时" style={{ width: 160}} />
        </Form.Item>
        {capacityFormVS?.onceDown ? (
          <Text
            style={{
              marginBottom: !capacityFormVS?.onceDown ? 0 : "20px",
              display: "block",
            }}
            type="warning"
          >
            {capacityFormVS?.onceDownMsg}
          </Text>
        ) : null}
        <div className="standards-holiday-set">
          <div>
            <div className="guifan-f16">休息日配置</div>
            <div className="xiuxu-desc">可配置工作日和休息日</div>
          </div>
          <div>
            <Button onClick={() => {
              if (stashRest) {
                setHolidayConfigData(stashRest);
                setVisible(true);
              } else {
                getStandardsConfigHolidayInfo(false)
              }
            }}>配置</Button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '14px 0 6px' }}>
          <Space size="middle">
            <Button type="primary" htmlType="submit">保存设置</Button>
            {isAdd === 0 && !isDefault ? (
              <Button
                color="danger" variant="outlined"
                onClick={() => deleteStandardsConfigModal()}
              >
                删除
              </Button>
            ) : null}
          </Space>
        </div>
      </Form>
      {/* 休息日配置组件 */}
      <Modal
            centered={true}
            title="休息日配置"
            open={visible}
            onCancel={onClose} // 点击弹窗关闭按钮/蒙层时触发父组件的关闭回调
            width={600}
            destroyOnClose={true} // 关闭时销毁组件，避免缓存状态
            maskClosable={false} // 点击蒙层不关闭（可选，根据业务需求调整）
            footer={null}
          >
            <RestDayConfigModal
              isDefault={isDefault} 
              editId={props?.standardConfigData && props?.standardConfigData?.id || null}
              holidayConfigData={holidayConfigData}
              getHolidayConfig={getHolidayConfig}
              getRestTime={getRestTime}
              uuid={uuid}
            />
      </Modal>
      {/* 查看成员组件 */}
      {memberModalVisible && (
        <MemberModal
          visible={memberModalVisible}
          onClose={() => setMemberModalVisible(false)}
          initialData={standardUser}
          destroyOnClose={true}
        />
      )}
      {/* 成员配置组件 */}
       <Modal
        centered
        destroyOnClose
        title={<div style={{ fontSize:'18px',color: 'color: #1F2329;' }}>成员配置</div>}
        open={isSelectedUserOpen}
        onCancel={handleSelectedUserCancel}
        width={"600px"}
        footer={[
          <Button className="cancel-btn" onClick={handleSelectedUserCancel}>
            取消
          </Button>,
          <Button
            type="primary"
            onClick={handleSelectedUserOk}
          >
            确定
          </Button>,
        ]}
      > 
        <UserSettings
          type="all"
          getSelectedUser={getSelectedUser}
          onSelectedCountChange={onSelectedCountChange}
          projectId={2}
          selectedUser={selected}
        />
      </Modal>
    </div>
    </Spin>
  );
};
export default StandardsSet;

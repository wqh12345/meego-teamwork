import React, { useState, useEffect, useRef } from 'react';
import { Form, Tabs, Switch, InputNumber, Button, Card, Typography, Space, Divider, Checkbox, message, Radio, Tooltip, Select, Table } from 'antd';
import { CloseOutlined, InfoCircleFilled } from '@ant-design/icons';
import CapacitySet from "./CapacitySet";
import './WorkHourSettings.less';
const { Title, Text } = Typography;
const { TabPane } = Tabs;
import WorkItemPicker from "../../../workItem-picker/workItemPicker";
import addIcon from "../../../../../../image/add.png";
import { generateUuid } from "../../../../../../util/util";
import {
  saveRegistrationSettings
} from "../../../../../../api/api";
const RegistrationSettings = (props) => {
  //console.log('props123456', props)
  const [workItemOptions, setWorkItemOptions] = useState([]);
  // 状态管理
  const [capacityInitialValues, setCapacityInitialValues] = useState(
    props?.capacityInitialValues
  );
  const [registerLevel, setRegisterLevel] = useState([]);
  // 成员可登记范围状态管理
  const [registrationScope, setRegistrationScope] = useState(
    props?.registrationSettingsConfig?.list?.length > 0
      && props.registrationSettingsConfig.list[0].myselfStatus !== undefined && props.registrationSettingsConfig.list[0].myselfStatus !== null
      ? props.registrationSettingsConfig.list[0].myselfStatus.toString() : '0'
  );
  // 添加工作项错误状态
  const [workItemError, setWorkItemError] = useState('');
  const [adminSetting, setAdminSetting] = useState(props.registrationSettingsConfig?.adminImpact || false);
  const [workDescReq, setWorkDescReq] = useState(props.registrationSettingsConfig?.workDescReq || 0);
  const [advanceLimitEnabled, setAdvanceLimitEnabled] = useState(props.registrationSettingsConfig?.enableAdvanceDay || false);
  const [advanceLimitDays, setAdvanceLimitDays] = useState(props.registrationSettingsConfig?.inAdvanceDay !== undefined &&
    props.registrationSettingsConfig?.inAdvanceDay !== null
    ? props.registrationSettingsConfig.inAdvanceDay
    : 30);
  const [futureLimitEnabled, setFutureLimitEnabled] = useState(props.registrationSettingsConfig?.enableFutureDay || false);
  const [futureLimitDays, setFutureLimitDays] = useState(props.registrationSettingsConfig?.futureDay !== undefined &&
    props.registrationSettingsConfig?.futureDay !== null
    ? props.registrationSettingsConfig.futureDay
    : 0);
  // 登记工时颗粒度
  const [granularityEnabled, setGranularityEnabled] = useState(
    props.registrationSettingsConfig?.isEnableGranularity === 1
  );
  const [granularityValue, setGranularityValue] = useState(
    props.registrationSettingsConfig?.granularityHour ?? null
  );
  // 初始化已选工作项，从props中获取或设置为空数组
  const [selectedWorkItems, setSelectedWorkItems] = useState(
    props.registrationSettingsConfig?.list ?
      props.registrationSettingsConfig.list.map(item => ({
        label: item.canRegistWorkItemName,
        value: item.canRegistWorkItemId,
        tag: item.tag
      })) :
      []
  );
  // 从props中获取初始值，如果没有则默认为false
  // 这里假设registrationSettingsConfig.list中至少有一项配置
  const [nodeStatus, setNodeStatus] = useState(
    props?.registrationSettingsConfig?.list && props.registrationSettingsConfig.list.length > 0
      ? props.registrationSettingsConfig.list[0].nodeStatus === 1
      : false
  );
  const [taskStatus, setTaskStatus] = useState(
    props?.registrationSettingsConfig?.list && props.registrationSettingsConfig.list.length > 0
      ? props.registrationSettingsConfig.list[0].taskStatus === 1
      : false
  );
  // 从props中获取初始值，如果没有则默认为[2]
  // 这里假设registrationSettingsConfig.list中至少有一项配置
  const [entityStatus, setEntityStatus] = useState(
    props?.registrationSettingsConfig?.list && props.registrationSettingsConfig.list.length > 0
      ? props.registrationSettingsConfig.list[0].entityStatus
      : [2]
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
  const [registerRecordEnumList, setRegisterRecordEnumList] = useState([]);
  const [specialworkItemConfig, setSpecialworkItemConfig] = useState([]);
  // 新增：存储每行的错误信息（key: 行ID, value: { workItem: 工作项是否为空, role: 角色是否为空 }）
  const [rowErrors, setRowErrors] = useState({});
  // 新增：角色搜索相关状态
  const [roleSearchLoading, setRoleSearchLoading] = useState({});
  const [rowRoleLoading, setRowRoleLoading] = useState({});
  const [rowRoleOptions, setRowRoleOptions] = useState({});
  const [allRegisterworkItemError, setAllRegisterworkItemError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [allRegisterworkItemConfig, setAllRegisterworkItemConfig] = useState([]);
  const [activeTab, setActiveTab] = useState('2');
  // 创建表格容器ref用于滚动控制
  const tableContainerRef = useRef(null);
  useEffect(() => {
    capacityForm.setFieldsValue({});
    validatorCapacityForm({});
  }, []);
  useEffect(() => {
    let registerLeveldata = [];
    let registerLevelConfigVosInfo = JSON.parse(JSON.stringify(props?.registerLevelConfigVos || []))
    if (registerLevelConfigVosInfo?.length > 0 && registerLevelConfigVosInfo[0].registerLevelVoList?.length > 0) {
      setAllRegisterworkItemConfig(registerLevelConfigVosInfo[0])
      registerLevelConfigVosInfo[0].registerLevelVoList.forEach((item) => {
        registerLeveldata.push(item.type)
      });
      let specialworkItemConfigList = registerLevelConfigVosInfo.filter(item => { return item.configType !== 'global' }) || [];
      setSpecialworkItemConfig(specialworkItemConfigList)
    }
    setRegisterLevel(registerLeveldata);
    let workItemOptionsInfo = props.workItemKeyTypes?.filter(item => { return props.workFlowObjectList.includes(item.typeKey) }) || [];
    workItemOptionsInfo.forEach(item => {
      item.label = item.name
      item.value = item.typeKey
    })
    setWorkItemOptions(workItemOptionsInfo);
  }, [JSON.stringify(props.workFlowObjectList), JSON.stringify(props.workItemKeyTypes)]);
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
    //console.log('values', values)
    const res = await postUpdateStandWorkHour(values);
    if (res?.result) {
      window.JSSDK.toast.success("修改成功");
      props.setIsCapacityFormOpen(true);
      //setCapacityInitialValues(values);
    }
  };
  const handleConfirm = async () => {
    try {
      // 校验基础设置表单
      //const formValues = await capacityForm.validateFields();
      const formValues = capacityInitialValues
      //console.log('formValues99999', formValues,capacityInitialValues)
      // 校验登记工时颗粒度
      if (granularityEnabled && (granularityValue === undefined || granularityValue === null || granularityValue === '')) {
        message.error('请填写登记工时颗粒度');
        return;
      }
      // 校验提前天数限制
      if (advanceLimitEnabled && (advanceLimitDays === undefined || advanceLimitDays === null || advanceLimitDays === '')) {
        message.error('时间设置：提前天数限制不能为空');
        return;
      }

      // 校验未来日期限制
      if (futureLimitEnabled && (futureLimitDays === undefined || futureLimitDays === null || futureLimitDays === '')) {
        message.error('时间设置：未来日期限制不能为空');
        return;
      }
      // 校验可登记工作项是否为空
      if (selectedWorkItems.length === 0) {
        setWorkItemError('必须选择一个工作项');
        message.error('必须选择一个工作项');
        return;
      } else {
        setWorkItemError('');
      }
      // 校验可登记工作项是否为空
      if (registerLevel.length === 0) {
        setAllRegisterworkItemError('请选择层级');
        message.error('请选择节点流默认可登记层级');
        return;
      } else {
        setAllRegisterworkItemError('');
      }
      // 新增：校验特殊工作项配置
      let hasSpecialWorkItemError = false;
      const newRowErrors = {};

      // 检查特殊工作项配置表格中的每一行
      specialworkItemConfig.forEach((row) => {
        const rowError = {};

        // 检查工作项是否被选择
        if (!row.workItemId || row.workItemId === '') {
          rowError.workItem = true;
          hasSpecialWorkItemError = true;
        }

        // 检查可登记层级是否被选择
        if (!row.registerLevelVoList || row.registerLevelVoList.length === 0) {
          rowError.role = true;
          hasSpecialWorkItemError = true;
        }

        // 如果该行有错误，记录错误信息
        if (Object.keys(rowError).length > 0) {
          newRowErrors[row.id] = rowError;
        }
      });

      // 如果有特殊工作项配置错误，显示气泡提示并更新错误状态
      if (hasSpecialWorkItemError) {
        setRowErrors(newRowErrors);
        message.error('请完善工作项和可登记层级配置');
        return;
      }

      // 清除错误状态
      setRowErrors({});
      let allConfiglevel = []
      props.registerRecordEnumList.forEach((item) => {
        if (registerLevel.includes(item.typeName)) {
          allConfiglevel.push({ type: item.typeName, typeDescribe: item.typeDescribe })
        }
      })
      let allRegisterworkItemConfigData = JSON.parse(JSON.stringify(allRegisterworkItemConfig))
      allRegisterworkItemConfigData.registerLevelVoList = allConfiglevel
      const projectKey = sessionStorage.getItem("jwtMeegoTeamworkProjectKey")
      let registerLevelConfigVosData = []
      registerLevelConfigVosData.push(allRegisterworkItemConfigData)
      specialworkItemConfig.forEach((item) => {
        registerLevelConfigVosData.push(item)
      })
      registerLevelConfigVosData.forEach((item, index) => {
        item.sort = index + 1
        if (item.configType != "global" && !item.tag) {
          item.id = null
          item.workItemName = item.workItemName.replace('[已删除]', '')
        }
      })
      //console.log('registerLevelConfigVosData8888', registerLevelConfigVosData)
      const data = {
        ...formValues,
        "workDescReq": workDescReq?1:0,
        "id": props.registrationSettingsConfig?.id || null,
        "projectKey": projectKey,
        "adminImpact": adminSetting ? 1 : 0,//管理员是否受填报时间影响；0否1是
        "enableFutureDay": futureLimitEnabled ? 1 : 0,//是否开启填报晚于今天的天数
        "futureDay": futureLimitDays,//填报晚于今天的天数
        "enableAdvanceDay": advanceLimitEnabled ? 1 : 0,//是否开启填报早于今天的天数
        "inAdvanceDay": advanceLimitDays,//填报早于今天的天数
        "isEnableGranularity": granularityEnabled ? 1 : 0,
        "granularityHour": granularityValue,
        "list": [
        ],
        "addRegisterLevelConfigReqs": registerLevelConfigVosData
      }
      selectedWorkItems.forEach(i => {
        data.list.push({
          "id": null,//
          "projectKey": projectKey,
          "canRegistWorkItemId": i.value,//可登记的工作项id
          "canRegistWorkItemName": i.label.replace('[已删除]', ''),//可登记的工作项名称
          "entityStatus": entityStatus,//限制不可填报的工作项实例状态；1已冻结，2已终止，3已完成
          "nodeStatus": nodeStatus ? 1 : 0,//限制不可填报节点状态；1已完成
          "taskStatus": taskStatus ? 1 : 0,//限制不可填报任务状态；1已完成
          "myselfStatus": Number(registrationScope)
        })
      })
      // 显示保存成功提示
      const res = await saveRegistrationSettings(data)
      if (res?.result) {
        setIsDirty(false);
        window.JSSDK.toast.success("保存成功");
        props.setIsCapacityFormOpen(true);
        // 关闭modal（如果需要）
        // if (props.closeModal) {
        //   props.closeModal();
        // } else if (props.setIsCapacityFormOpen) {
        //   props.setIsCapacityFormOpen(false);
        // }
      } else {
        //message.error(res?.msg || '保存失败');
      }
    } catch (error) {
      //console.log('error', error)
      // 表单校验失败，使用message.error显示错误信息
      // Ant Design的Form.validateFields会抛出一个包含errorFields的错误对象
      if (error.errorFields && error.errorFields.length > 0) {
        const firstError = error.errorFields[0];
        message.error(firstError.errors[0]);
      } else {
        message.error('保存失败，请检查填写内容');
      }
    }
  };
  const options = [
    { label: '已冻结', value: 1, className: 'label-1' },
    { label: '已终止', value: 2, className: 'label-2', disabled: true },
    { label: '已完成', value: 3, className: 'label-3' },
  ];
  const options2 = [
    { label: '已完成', value: '2', className: 'label-1' },
  ];
  const options3 = [
    { label: '已完成', value: '2', className: 'label-1' },
  ];
  const onChange = checkedValues => {
    //console.log('checked = ', checkedValues);
  };
  const onEntityStatusChange = (checkedValues) => {
    //console.log('entityStatus',checkedValues)
    setEntityStatus(checkedValues);
    setIsDirty(true);
  }
  /** 人员筛选 */
  const onSearchPersonChange = async (selectedItems) => {
    //console.log('selectedItems', selectedItems, selectedWorkItems)
    setSelectedWorkItems(selectedItems)
    setIsDirty(true);
    if (selectedItems.length > 0) {
      setWorkItemError('');
    }
  };
  // 处理取消按钮点击
  const handleCancel = () => {
    setIsDirty(false);
    if (props.closeModal) {
      props.closeModal();
    } else if (props.setIsCapacityFormOpen) {
      props.setIsCapacityFormOpen(false);
    }
  };
  const handleAddRow = () => {
    const newRow = {
      id: generateUuid(),
      "projectKey": sessionStorage.getItem('jwtMeegoTeamworkProjectKey'),
      "configType": "special",
      "configDescribe": "特殊配置",
      "workItemId": "",
      "workItemName": "",
      "tag": null,
      "registerLevelVoList": [
      ],
      "levelCodes": null
    }
    setSpecialworkItemConfig([...specialworkItemConfig, newRow]);
    setIsDirty(true);
    // 表格自动滚动到底部
    setTimeout(() => {
      if (tableContainerRef.current) {
        const tableBody = tableContainerRef.current.querySelector('.ant-table-body');
        if (tableBody && typeof tableBody.scrollTop !== 'undefined' && tableBody.scrollTop !== null) {
          // 使用 try-catch 来避免 Illegal invocation 错误
          try {
            tableBody.scrollTop = tableBody.scrollHeight;
          } catch (error) {
            console.warn('无法设置表格滚动位置:', error);
            // 使用更安全的方法
            if (typeof tableBody.scrollTo === 'function') {
              tableBody.scrollTo({
                top: tableBody.scrollHeight,
                behavior: 'smooth'
              });
            }
          }
        }
      }
    }, 100);
  }
  // 修改工作项变更处理函数，添加获取角色数据的逻辑
  const handleWorkItemChange = (value, record) => {
    const newData = [...specialworkItemConfig];
    const index = newData.findIndex(item => item.id === record.id);
    //console.log('index', index, newData)
    if (index !== -1) {
      // 处理工作项数据
      if (typeof value === 'object' && value !== null) {
        newData[index].workItemName = value.label;
        newData[index].workItemId = value.value;
      } else {
        newData[index].workItemName = value;
        const option = workItemOptions.find(opt => opt.label === value || opt.value === value);
        if (option) {
          newData[index].workItemId = option.value;
        }
      }

      // 清除当前行的角色选择（因为工作项变了）
      newData[index].registerLevelVoList = [];
      //console.log('newData', newData)
      setSpecialworkItemConfig([...newData]);
      setIsDirty(true);

      // 新增：清除当前行的工作项错误
      setRowErrors(prev => {
        const currentRowErrors = prev[record.id] || {};
        // 若工作项已选择（value存在），删除workItem错误标记
        if (value) {
          delete currentRowErrors.workItem;
        }
        // 若当前行已无其他错误，删除整行的错误记录
        return Object.keys(currentRowErrors).length > 0
          ? { ...prev, [record.id]: currentRowErrors }
          : { ...prev, [record.id]: undefined };
      });

      // 如果选择了工作项，根据工作项ID获取角色数据
      if (newData[index].workItemId) {
        //fetchRolesByWorkItemId(newData[index].workItemId, record.id); // 修改这里，使用record.id作为rowId
      } else {
        // 清除角色选项
        setRowRoleOptions(prev => ({
          ...prev,
          [record.id]: []
        }));
      }
    }
  };
  // 新增：根据工作项ID获取角色数据的函数
  const fetchRolesByWorkItemId = async (workItemId, rowId) => {
    try {
      // 设置当前行的加载状态
      setRowRoleLoading(prev => ({
        ...prev,
        [rowId]: true
      }));
      // 调用API获取角色数据
      const res = await getWorkitemRole({ workItemId: workItemId, roleName: "" });
      if (res?.result && res?.data) {
        // 保存获取到的角色数据
        setRowRoleOptions(prev => ({
          ...prev,
          [rowId]: res.data.map(role => ({
            label: role.roleName, // 假设返回数据中有roleName字段
            value: role.roleId // 假设返回数据中有roleId字段
          }))
        }));
      } else {
        setRowRoleOptions(prev => ({
          ...prev,
          [rowId]: []
        }));
      }
    } catch (error) {
      console.error('获取角色数据失败:', error);
      setRowRoleOptions(prev => ({
        ...prev,
        [rowId]: []
      }));
    } finally {
      // 无论成功失败，都要清除加载状态
      setRowRoleLoading(prev => ({
        ...prev,
        [rowId]: false
      }));
    }
  };
  // 修改角色变更处理函数
  const handleRolesChange = (values, record) => {
    const newData = [...specialworkItemConfig];
    const index = newData.findIndex(item => item.id === record.id);

    if (index !== -1) {
      // 检查values的类型以确定如何处理
      if (values && values.length > 0 && typeof values[0] === 'object') {
        // 如果values是对象数组，转换为 {roleId: value, roleName: label} 格式
        newData[index].registerLevelVoList = values.map(v => ({
          type: v.value,
          typeDescribe: v.label
        }));
      } else {
        // 如果values是简单值数组
        const currentOptions = rowRoleOptions[record.id] || [];
        newData[index].registerLevelVoList = values.map(role => {
          const option = currentOptions.find(opt => opt.label === role || opt.value === role);
          return {
            type: option ? option.value : role,
            typeDescribe: option ? option.label : role
          };
        });
      }

      // 移除旧的roleIds字段
      delete newData[index].type;
      setSpecialworkItemConfig(newData);
      setIsDirty(true);

      // 新增：清除当前行的角色错误
      setRowErrors(prev => {
        const currentRowErrors = prev[record.id] || {};
        // 若角色已选择（values长度>0），删除role错误标记
        if (values && values.length > 0) {
          delete currentRowErrors.role;
        }
        // 若当前行已无其他错误，删除整行的错误记录
        return Object.keys(currentRowErrors).length > 0
          ? { ...prev, [record.id]: currentRowErrors }
          : { ...prev, [record.id]: undefined };
      });
    }
  };
  const handleDeleteRow = (record) => {
    const newData = specialworkItemConfig.filter(item => item.id !== record.id);
    setSpecialworkItemConfig(newData);
    setIsDirty(true);

    // 删除行时清除对应的错误信息
    setRowErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[record.id];
      return newErrors;
    });
  };
  return (
    <div className='set-workhour-new-2'>
      {/* 标签页内容 */}
      <Tabs
        defaultActiveKey="2"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        style={{ marginBottom: activeTab === '4' ? 8 : activeTab === '2' ? 0 : 20 }}
      >
        <TabPane tab="登记规则" key="2">
          {/* 登记工时颗粒度 */}
          <div className='common-card-item'>
            <div className="setting-row">
              <span className="setting-label">登记工时颗粒度</span>
              <Switch
                checked={granularityEnabled}
                onChange={(val) => { setGranularityEnabled(val); setIsDirty(true); }}
                size='small'
              />
            </div>
            <span className="setting-desc">
              开启后，成员登记工时必须是颗粒度的整数倍（如 0.5 小时，则允许 0.5、1、1.5...）
            </span>
            {granularityEnabled && <div className="setting-input-area">
              <InputNumber
                // 不设 min/max：组件会在失焦时静默夹取越界值（25→24、0→0.01），onBlur 拿不到真实输入，提示永远弹不出来
                step={0.5}
                value={granularityValue}
                // 原样透传显示：短路掉组件默认 formatter，否则 step=0.5 反推出的隐式精度会把 10 补成 10.0
                // 这里不能做数值化（如 String(Number(v))），否则正在输入的 "10." 会被立即改回 "10"，小数点输不进去
                formatter={(value) => (value === null || value === undefined || value === '' ? '' : String(value))}
                // 不再用 precision 强制补零：输入 0.5 就显示 0.5，不变成 0.50
                // 小数部分截断到两位（不四舍五入），避免输入三位小数时直接被 onBlur 清空并弹警告
                parser={(text) => {
                  if (text === null || text === undefined) return null;
                  let raw = String(text).replace('。', '.').replace(/[^\d.]/g, '');
                  const dotIndex = raw.indexOf('.');
                  if (dotIndex !== -1) {
                    raw = raw.slice(0, dotIndex + 1) + raw.slice(dotIndex + 1).replace(/\./g, '');
                  }
                  if (raw === '' || raw === '.') return null;
                  if (raw.includes('.')) {
                    const [intPart, decPart = ''] = raw.split('.');
                    raw = `${intPart}.${decPart.slice(0, 2)}`;
                  }
                  const num = Number(raw);
                  return Number.isFinite(num) ? num : null;
                }}
                onChange={(val) => {
                  // 去掉步进箭头带来的浮点噪声（如 1.0100000000000002），保证存的是干净两位小数
                  setGranularityValue(
                    typeof val === 'number' && Number.isFinite(val) ? Math.round(val * 100) / 100 : val
                  );
                  setIsDirty(true);
                }}
                onBlur={() => {
                  if (granularityValue !== null && granularityValue !== undefined) {
                    const v = Number(granularityValue);
                    if (!Number.isFinite(v) || v < 0.01 || v > 24 || !/^\d+(\.\d{1,2})?$/.test(String(v))) {
                      setGranularityValue(null);
                      message.error('请输入 0.01~24 之间、最多两位小数的数字');
                    }
                  }
                }}
                style={{ width: 160 }}
                addonAfter="小时"
              />
            </div>}
          </div>
          {/* 管理员填报设置 */}
          <div className='common-card-item'>
            <div className="setting-row">
              <span className="setting-label">管理员填报设置</span>
              <Switch
                checked={adminSetting ? 1 : 0}
                onChange={(val) => { setAdminSetting(val); setIsDirty(true); }}
                size='small'
              />
            </div>
            <span className="setting-desc">开启后，管理员可以填报，不受时间设置影响</span>
          </div>
          <div className='common-card-item'>
            <div className="setting-row">
              <span className="setting-label">工作描述是否必填</span>
              <Switch
                checked={workDescReq ? 1 : 0}
                onChange={(val) => { setWorkDescReq(val); setIsDirty(true); }}
                size='small'
              />
            </div>
            <span className="setting-desc">开启后，登记工时时必须填写工作描述</span>
          </div>
          {/* 提前天数限制 */}
          <div className='common-card-item'>
            <div className="setting-row">
              <span className="setting-label">提前天数限制</span>
              <Switch
                checked={advanceLimitEnabled ? 1 : 0}
                onChange={(val) => { setAdvanceLimitEnabled(val); setIsDirty(true); }}
                size='small'
              />
            </div>
            <span className="setting-desc">
              开启后，禁止登记、修改或删除早于当前日期前N天的工时记录
            </span>
            {advanceLimitEnabled && <div className="setting-input-area">
              <InputNumber
                min={0}
                max={1000}
                value={advanceLimitDays}
                onChange={(val) => { setAdvanceLimitDays(val); setIsDirty(true); }}
                disabled={!advanceLimitEnabled}
                style={{ width: 160 }}
                onKeyPress={(event) => {
                  if (event.key === '.') {
                    event.preventDefault();
                  }
                }}
                addonAfter="天"
              />
            </div>}
          </div>
          {/* 未来日期限制 */}
          <div className='common-card-item' style={{marginBottom:futureLimitEnabled ? '13px' : '0px'}}>
            <div className="setting-row">
              <span className="setting-label">未来日期限制</span>
              <Switch
                checked={futureLimitEnabled ? 1 : 0}
                onChange={(val) => { setFutureLimitEnabled(val); setIsDirty(true); }}
                size='small'
              />
            </div>
            <span className="setting-desc">
              开启后，禁止登记、修改或删除晩于当前日期N天内的工时记录
            </span>
            {futureLimitEnabled && <div className="setting-input-area">
              <InputNumber
                min={0}
                max={1000}
                value={futureLimitDays}
                onChange={(val) => { setFutureLimitDays(val); setIsDirty(true); }}
                disabled={!futureLimitEnabled}
                style={{ width: 160 }}
                onKeyPress={(event) => {
                  if (event.key === '.') {
                    event.preventDefault();
                  }
                }}
                addonAfter="天"
              />
            </div>}
          </div>
        </TabPane>
        <TabPane tab="登记范围" key="3">
          <div className="registration-scope">
            <div className="setting-section">
              <Title level={5} style={{ margin: 0, marginBottom: 8, fontSize: '14px',paddingTop: '12px'}}>成员可登记范围</Title>
              <Radio.Group
                value={registrationScope}
                onChange={(e) => { setRegistrationScope(e.target.value); setIsDirty(true); }}
                className="registration-scope-radio"
              >
                <Radio value="1" className="scope-radio">仅限当前成员负责的登记对象<span className="radio-desc">(用户只能登记负责人为自己的登记对象)</span></Radio>
                <Radio value="0" className="scope-radio">全部登记对象<span className="radio-desc">(用户可登记所有登记对象)</span></Radio>
              </Radio.Group>
            </div>
            {/* 可登记工作项 */}
            <div className="setting-section">
              <Title level={5} style={{ margin: '20px 0px 8px', fontSize: '14px',}}>可登记工作项</Title>
              <div className='head-workitem-desc'>
                仅选中的工作项可被登记，未选中的工作项将不可登记
              </div>
              <div style={{ marginBottom: 18 }}>
                <WorkItemPicker
                  type="Gantt"
                  mode="multiple"
                  placeholder="选择可登记的工作项"
                  selectedWorkItemsArr={selectedWorkItems}
                  value={selectedWorkItems.map(item => item.value)} // 传递已选工作项的value数组
                  getUserIds={onSearchPersonChange}
                />
                {workItemError && (
                  <div style={{ color: '#df000e', fontSize: '14px', marginTop: '4px' }}>
                    {workItemError}
                  </div>
                )}
              </div>
            </div>
            {/* 禁填设置 */}
            <div className="setting-section">
              <Title level={5} style={{ margin: '24px 0px 8px', fontSize: '14px' }}>禁填设置</Title>

              {/* 工作项实例 */}
              <div className="setting-item">
                <div>工作项实例</div>
                <div className='setting-desc'>
                  若工作项实例存在以下任意选中状态，则该工作项实例不展示且不可填报
                </div>
                <Checkbox.Group
                  value={entityStatus}
                  onChange={onEntityStatusChange}
                >
                  {options.map(option => {
                    if (option.value === 2) {
                      return (
                        <Tooltip
                          key={option.value}
                          title="因飞书项目接口限制，无法查询“已终止”的数据，故默认禁填"
                          placement="top"
                        >
                          <Checkbox value={option.value} disabled>{option.label}</Checkbox>
                        </Tooltip>
                      );
                    }
                    return <Checkbox key={option.value} value={option.value}>{option.label}</Checkbox>;
                  })}
                </Checkbox.Group>
              </div>

              {/* 节点 */}
              <div className="setting-item">
                <div className='setting-level'>节点</div>
                <div className='setting-desc'>
                  若节点存在以下任意选中状态，则该节点不展示且不可填报
                </div>
                <Checkbox checked={nodeStatus} onChange={() => { setNodeStatus(!nodeStatus); setIsDirty(true); }}>已完成</Checkbox>
              </div>

              {/* 任务 */}
              <div className="setting-item">
                <div className='setting-level'>任务</div>
                <div className='setting-desc'>
                  若任务存在以下任意选中状态，则该任务不展示且不可填报
                </div>
                {/* <Checkbox.Group options={options3} defaultValue={[]} onChange={onChange} /> */}
                <Checkbox checked={taskStatus} onChange={() => { setTaskStatus(!taskStatus); setIsDirty(true); }}>已完成</Checkbox>
              </div>
            </div>
          </div>
        </TabPane>
        <TabPane tab="可登记层级" key="4">
          <div className="registration-scope">
            {/* 可登记工作项 */}
            <div className="setting-section">
              <Title level={5} style={{ margin: 0, marginBottom: 8, fontSize: '14px', paddingTop: '12px' }}>
                节点流默认可登记层级
                <Tooltip
                  className="user-tooltip"
                  placement="bottom"
                  title={
                    <>
                      <div>
                        此规则适用于所有<span style={{ fontWeight: 'bold' }}>未进行特殊配置的节点流工作项。</span>
                        例如：配置了“工作项实例”和“节点”层级，那么所有节点流工作项（不包括下方表格中单独配置的特殊工作项）
                        都只允许在这两个层级登记，“任务”层级将不可登记，用户端批量登记页面中对应单元格会置灰禁用。
                      </div>

                    </>
                  }
                >
                  <InfoCircleFilled className="icon" />
                </Tooltip>
              </Title>
              <div style={{ marginBottom: 18 }}>
                <Select
                  mode="multiple"
                  value={registerLevel}
                  style={{ width: 350, height: 36, lineHeight: '36px' }}
                  placeholder="请选择"
                  onChange={(val) => {
                    setRegisterLevel(val);
                    setIsDirty(true);
                    // 新增：选择层级后自动清除错误提示
                    if (val && val.length > 0) {
                      setAllRegisterworkItemError('');
                    }
                  }}
                  size="small"
                  options={props.registerRecordEnumList}
                  maxTagCount="responsive"
                  maxTagPlaceholder={(omittedValues) => (
                    <Tooltip
                      title={
                        <div
                          style={{
                            maxWidth: "300px",
                            maxHeight: "200px",
                            overflow: "auto",
                            padding: "4px 0",
                          }}
                        >
                          {omittedValues.map((item, index) => (
                            <div key={index} style={{ padding: '2px 8px' }}>{item.label}</div>
                          ))}
                        </div>
                      }
                    >
                      <span>+{omittedValues?.length}</span>
                    </Tooltip>
                  )}
                />
                {allRegisterworkItemError && (
                  <div className='level-set-error'>
                    请选择层级
                  </div>
                )}
              </div>
            </div>
            <div className="setting-section">
              <Title level={5} style={{ margin: 0, marginBottom: 8, fontSize: '14px' }}>
                特殊节点流配置
                <Tooltip
                  className="user-tooltip"
                  placement="bottom"
                  title={
                    <>
                      <div>
                        为<span style={{ fontWeight: 'bold' }}>特定节点流工作项</span>单独配置允许登记的层级范围。例如：为“项
                        目工时”这个节点流工作项配置了“节点”层级，则用户只能在“项目工时”的“节点”层级登记，其他层级（如任务）将不可登记，
                        用户端批量登记页面中对应单元格会置灰禁用。
                      </div>

                    </>
                  }
                >
                  <InfoCircleFilled className="icon" />
                </Tooltip>
              </Title>
              <div ref={tableContainerRef}>
                <Table
                  footer={() => (
                    <div className="add-row-container">
                      <span onClick={handleAddRow} className="add-row-btn">
                        <img src={addIcon} alt="添加" width={18} className="add-role-row" />
                        添加
                      </span>
                    </div>
                  )}
                  bordered
                  dataSource={specialworkItemConfig}
                  pagination={false}
                  rowKey="id"
                  columns={[
                    {
                      title: '工作项',
                      dataIndex: 'workItem',
                      key: 'workItem',
                      render: (_, record) => (
                        <div>
                          <Select
                            placeholder="请选择工作项"
                            labelInValue
                            // 支持按工作项名称模糊搜索（本地过滤，不区分大小写）
                            showSearch
                            optionFilterProp="label"
                            value={record.workItemId ? { label: record.workItemName, value: record.workItemId } : undefined}
                            onChange={(value) => handleWorkItemChange(value, record)}
                            style={{ width: '100%', height: 34, lineHeight: '34px' }}
                            options={workItemOptions.map(option => ({
                              ...option,
                              // 如果工作项已在其他行中选择，则禁用它
                              disabled: specialworkItemConfig.some(row =>
                                row.id !== record.id && row.workItemId === option.value
                              )
                            }))}
                            // 新增：若当前行工作项有错误，添加红色边框样式
                            className={rowErrors[record.id]?.workItem ? "approval-error-select" : ""}
                            // 将暂无数据提示文本改为暂无工作项
                            notFoundContent="暂无工作项"
                          />
                          {/* 新增：工作项为空时显示错误提示 */}
                          {rowErrors[record.id]?.workItem && (
                            <div className='level-set-error'>
                              请选择工作项
                            </div>
                          )}
                        </div>
                      )
                    },
                    {
                      title: '可登记层级',
                      dataIndex: 'registerLevelVoList',
                      key: 'registerLevelVoList',
                      render: (_, record) => (
                        <div>
                          <Select
                            placeholder={!record.workItemId ? "请先选择工作项" : "请选择层级"}
                            mode="multiple"
                            labelInValue
                            maxTagPlaceholder={(omittedValues) => (
                              <Tooltip
                                title={
                                  <div
                                    style={{
                                      maxWidth: "300px",
                                      maxHeight: "200px",
                                      overflow: "auto",
                                      padding: "4px 0",
                                    }}
                                  >
                                    {omittedValues.map((item, index) => (
                                      <div key={index} style={{ padding: '2px 8px' }}>{item.label}</div>
                                    ))}
                                  </div>
                                }
                              >
                                <span>+{omittedValues?.length}</span>
                              </Tooltip>
                            )}
                            disabled={!record.workItemId || rowRoleLoading[record.id]}
                            value={record.registerLevelVoList.length > 0
                              ? record.registerLevelVoList.map(role => ({
                                label: role.typeDescribe,
                                value: role.type
                              }))
                              : undefined
                            }
                            onChange={(values) => handleRolesChange(values, record)}
                            style={{ width: '100%' }}
                            maxTagCount="responsive"
                            options={props.registerRecordEnumList}
                            allowClear
                            showSearch
                            // 移除本地过滤filterOption，添加onSearch调用接口搜索
                            onSearch={(value) => handleRoleSearch(value, record.workItemId, record.id)}
                            loading={roleSearchLoading[record.id]}
                            notFoundContent={!record.workItemId ? "请先选择工作项" : (roleSearchLoading[record.id] ? <Spin size="small" /> : "暂无层级")}
                            // 新增：若当前行角色有错误，添加红色边框样式
                            className={rowErrors[record.id]?.role ? "approval-error-select" : ""}
                          />
                          {/* 新增：角色为空时显示错误提示 */}
                          {rowErrors[record.id]?.role && (
                            <div className='level-set-error'>
                              请选择层级
                            </div>
                          )}
                        </div>
                      )
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: '70px',
                      render: (_, record) => (
                        <div className="action-buttons" onClick={() => handleDeleteRow(record)}>
                          {/* <DeleteOutlined width={20} /> */}
                          删除
                        </div>
                      )
                    }
                  ]}
                  scroll={{ y: '50vh' }}
                />
              </div>
            </div>
          </div>
        </TabPane>
      </Tabs>

      {/* 底部按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '0', marginBottom: '13px'}}>
        <Space size="middle">
          <Button type="primary" disabled={!isDirty} onClick={handleConfirm}>保存设置</Button>
        </Space>
      </div>
    </div>
  );
};

export default RegistrationSettings;
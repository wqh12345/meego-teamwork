
import React, { useMemo, useContext, useEffect, useRef, useState, useCallback } from "react";
import {
  Form,
  Button,
  Select,
  message,
  Switch,
  Space,
  Input,
  Table,
  Tooltip,
  Modal,
  Spin,
  Radio,
  Avatar,
  TimePicker,
  Checkbox
} from "antd";
import debounce from "lodash/debounce";
import { InfoCircleFilled, SyncOutlined, CloseOutlined, PlusOutlined } from "@ant-design/icons";
import {
  getApproveEditParam,
  postApproveEdit,
  getProjectConfig,
  getTeam,
  getRefreshTeam,
  getApprovalSettings,
  getWorkItemOptionNew,
  getWorkitemRole,
  postApprovalConfigInfo,
  getWorkHourReminderConfig,
  setWorkHourReminderConfig
} from "../../../../../../api/api";
import { ExclamationCircleFilled } from "@ant-design/icons";
import "./notificationSet.less";
import dayjs from 'dayjs';
import TeamSettings from '../../../team-settings/TeamSettings';
import { UserTag } from '@lark-project/ui-kit-plugin';
const format = 'HH:mm';
const notificationSet = (props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [approvalForm] = Form.useForm();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [dataSource, setDataSource] = useState([
    {
      approvalStageName: "工时审批",
      processingUserIds: [],
      approvalRule: "ANY",
    },
  ]);
  const [teamList, setTeamList] = useState([]);
  const [approvalData, setApprovalData] = useState({});

  const [selected, setSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
    selectedDeptIds: [],
  });
  const [newSelected, setNewSelected] = useState({
    selectedDeparts: [],
    selectedUsers: [],
    selectedDepartIds: [],
    selectedUserIds: [],
    checkedKeys: [],
    selectedDeptIds: []
  });
  const [searchKeyword, setSearchKeyword] = useState({});
  const [selectFrequencyList, setSelectFrequencyList] = useState([]);
  const [remindFrequency, setRemindFrequency] = useState(props.remindCommonConfigData.remindFrequency || 'day');
  const [remindDate, setRemindDate] = useState(props.remindCommonConfigData.remindDate || '');
  const [remindTime, setRemindTime] = useState(props.remindCommonConfigData.remindTime || '18:00');
  const [selectedWeekday, setSelectedWeekday] = useState([]);
  const [selectedMonthDay, setSelectedMonthDay] = useState([]);
  const [isAllUser, setIsAllUser] = useState(props.remindCommonConfigData.isAllUser || false);
  const [isAllTeam, setIsAllTeam] = useState(props.remindCommonConfigData.isAllTeam || false);
  const [selectedDay, setSelectedDay] = useState('today');
  const selectRef = useRef(null);
  // 1. 添加ref定义（在组件顶部）
  const weekSelectRef = useRef(null);
  const monthSelectRef = useRef(null);
  const [isSelectedTeamAdmin, setIsSelectedTeamAdmin] = useState(false);
  // 2. 创建自定义点击处理函数
  /**
   * 处理周选择点击事件
   * @param {string} value - 选择的值
   */
  const handleWeekdayClick = (value) => {
    setSelectedWeekday(value);
    closeWeekDropdown();
  };

  /**
   * 处理月选择点击事件
   * @param {string} value - 选择的值
   */
  const handleMonthDayClick = (value) => {
    setSelectedMonthDay(value);
    closeMonthDropdown();
  };

  /**
   * 关闭周选择的下拉框
   */
  const closeWeekDropdown = () => {
    if (weekSelectRef.current) {
      try {
        if (weekSelectRef.current.blur) {
          weekSelectRef.current.blur();
        } else if (weekSelectRef.current.hideDropdown) {
          weekSelectRef.current.hideDropdown();
        } else if (weekSelectRef.current.input) {
          weekSelectRef.current.input.blur();
        }
      } catch (error) {
        console.error('关闭下拉框失败:', error);
      }
    }
  };

  /**
   * 关闭月选择的下拉框
   */
  const closeMonthDropdown = () => {
    if (monthSelectRef.current) {
      try {
        if (monthSelectRef.current.blur) {
          monthSelectRef.current.blur();
        } else if (monthSelectRef.current.hideDropdown) {
          monthSelectRef.current.hideDropdown();
        } else if (monthSelectRef.current.input) {
          monthSelectRef.current.input.blur();
        }
      } catch (error) {
        console.error('关闭下拉框失败:', error);
      }
    }
  };
  useEffect(() => {
    if (props?.remindCommonConfigData?.isTeamAdmin) {
      setIsSelectedTeamAdmin(true)
    } else {
      setIsSelectedTeamAdmin(false)
    }
    if (props?.remindCommonConfigData?.commonConfigVo.value) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
    setSelectFrequencyList(props.remindCommonConfigData.selectFrequencyList || []);
    if (props?.remindCommonConfigData?.remindFrequency === 'day') {
      setSelectedDay(props.remindCommonConfigData.remindDate || 'today');
    }
    if (props?.remindCommonConfigData?.remindFrequency === 'week') {
      setSelectedWeekday(props?.remindCommonConfigData?.remindDate || ['every_friday']);
    }
    if (props?.remindCommonConfigData?.remindFrequency === 'month') {
      setSelectedMonthDay(props?.remindCommonConfigData?.remindDate || ['The_last_seven_days_of_the_month']);
    }
  }, []);
  /** 获取团队列表 */
  const getTeamList = async () => {
    const res = await getTeam();
    if (res?.result) {
      setTeamList(res.data);
      dataSource.forEach((item) => {
        item?.teamIds?.forEach((teamId, index) => {
          if (JSON.stringify(res.data).indexOf(teamId) === -1)
            item.teamIds.splice(index, 1);
        });
      });
      setDataSource(dataSource);
    }
  };
  /** 提交配置 */
  const onFinish = async () => {
    try {
      if (isOpen) {
        if (selected.selectedUsers?.length === 0 && selected.selectedDeparts?.length === 0 && selected.selectedDeptIds?.length === 0) {
          window.JSSDK.toast.error("请至少选择一位提醒成员，否则无法保存配置");
          return;
        }
      }
      const remindFrequencyItem = selectFrequencyList.find(item => item.remindFrequency === remindFrequency);
      let remindDate = null;
      if (remindFrequency === 'day') {
        remindDate = selectedDay
      }
      if (remindFrequency === 'week') {
        remindDate = selectedWeekday
      }
      if (remindFrequency === 'month') {
        remindDate = selectedMonthDay
      }
      let remindDateDescribeObj = remindFrequencyItem.remindDateVoList.find(item => item.remindDate === remindDate);
      let teamMemberVos = [];

      selected?.selectedUsers?.forEach(item => {
        let userKey=item.userKey?item.userKey:item.staffUserKey?item.staffUserKey:null;
        teamMemberVos.push({
          "teamId": null,
          "userKey": userKey
        })
      })
      selected?.selectedDeparts?.forEach(item => {
        teamMemberVos.push({
          "teamId": item.teamId,
          "userKey": null
        })
      })
      //遍历部门数据
      selected?.selectedDeptIds?.forEach(item => {
        teamMemberVos.push({
          "teamId": null,
          "userKey": null,
          "departmentId": item
        })
      })
      const newCommonConfigVo = {
        ...props.remindCommonConfigData.commonConfigVo,
        "value": isOpen ? 1 : 0,
      }
      const data = {
        "id": props.remindCommonConfigData.id || null,
        "projectKey": sessionStorage.getItem("jwtMeegoTeamworkProjectKey"),
        "remindFrequency": remindFrequency,
        "remindFrequencyDescribe": remindFrequencyItem.remindFrequencyDescribe,
        "remindDate": remindDate,
        "remindDateDescribe": remindDateDescribeObj?.remindDateDescribe || '',
        "remindTime": remindTime + ":00",
        "isAllUser": selected.isAllUser==undefined?isAllUser:selected.isAllUser,
        "isAllTeam": selected.isAllTeam==undefined?isAllTeam:selected.isAllTeam,
        "teamMemberVos": teamMemberVos,
        "commonConfigVo": newCommonConfigVo,
        "isTeamAdmin": isSelectedTeamAdmin
      }
      const res = await setWorkHourReminderConfig(data);
      if (res?.result) {
        window.JSSDK.toast.success("设置成功");
        props.setIsNotificationSetOpen(true)
      } else {
        props.setIsNotificationSetOpen(true);
      }
    } catch (errorInfo) {
      console.log("表单校验失败:", errorInfo);
      //window.JSSDK.toast.error("表单校验失败，请检查输入");
    }
  };

  /** 打开选择人员弹窗 */
  const onSelectedUserOpen = (userListType = 'main') => {
    setCurrentUserListType(userListType);
    setIsSelectedUserOpen(true);

    // 根据当前模式和类型设置初始选中状态
    const currentData = userListType === 'fallback'
      ? selectedUsersByMode.fallback[approvalMode]
      : selectedUsersByMode.main[approvalMode];

    // 深拷贝避免直接修改状态
    // 提取staffId设置selectedUserIds
    const selectedUserIds = currentData.map(user => user.staffId || user.staffUserKey);
    setSelected({
      selectedDeparts: [],
      selectedUsers: JSON.parse(JSON.stringify(currentData)),
      selectedDepartIds: [],
      selectedUserIds: selectedUserIds,
      checkedKeys: [],
    });
  };

  /** 关闭选择人员弹窗 */
  const onSelectedUserCancel = () => {
    const person = newSelected.selectedUsers.concat(
      newSelected.selectedDeparts
    );
    setIsSelectedUserOpen(false);
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
  /** 获取选择的人员 */
  const getSelectedUser = (e) => {
    setSelected(e);
  };
  // 2. 添加onChange处理函数
  const handleTimeChange = (time) => {
    const timeStr = time ? time.format(format) : '';
    setRemindTime(timeStr);
    // 实时获取到值后可以进行的操作
    //console.log('TimePicker实时值:', timeStr);
  };
  /** 团队筛选 */
  const onSearchTeamChange = async (teams) => {
    // 更新选中的团队数据
    setSelectedUsersByMode(prev => ({
      ...prev,
      main: {
        ...prev.main,
        2: teams.map(team => ({
          teamId: team.value,
          teamName: team.label.replace("[已删除]", "")
        }))
      }
    }));
    // 清除团队审批的错误状态
    if (teams.length > 0 && showError.main) {
      setShowError(prev => ({
        ...prev,
        main: false
      }));
    }
  };
  /** 手动删除工作项类型 */
  const debouncedWorkItemDeselect = useCallback(
    debounce((delVal) => {
      setSearchWorkItemIds((prevIds) =>
        prevIds.includes(delVal) ? prevIds : [...prevIds, delVal]
      );

      setWorkItemIds((prev) => prev.filter((id) => id !== delVal));
      setWorkItemIdsFilter((prevFilter) =>
        prevFilter.filter((item) => item.workItemId !== delVal)
      );
      setIsOnDeselect(true);
      setIsWorkItemChanged(true);
    }, 800),
    []
  );
  // 解决未定义的状态问题
  const [searchWorkItemIds, setSearchWorkItemIds] = useState([]);
  const [workItemIds, setWorkItemIds] = useState([]);
  const [workItemIdsFilter, setWorkItemIdsFilter] = useState([]);
  const [isOnDeselect, setIsOnDeselect] = useState(false);
  const [isWorkItemChanged, setIsWorkItemChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const changeSelectedWeekday = (weekday) => {
    setSelectedWeekday(weekday);
  }
  return (
    <div className="remind-set-warp">
      <div className="approval-set-top">
        <div>
          <div className="approval-set-label">工时登记提醒<Switch
            size="small"
            checked={isOpen}
            onChange={(e) => {
              setIsOpen(e);
            }}
          /></div>
          <div className="approval-set-des">
            开启后，若周期内任意工作日未登记工时，将按配置自动发送提醒
          </div>
        </div>
        <div>
        </div>
      </div>
      <div className="approval-head-line"></div>
      {isOpen ? (
        <div className="approval-set-content">
          <div className="approval-mode-section">
            <div className="section-title approval-title-f16" style={{ paddingTop: '0',paddingTop:18}}>提醒频率</div>
            <div className="approval-mode-options">
              <Radio.Group
                name="approvalMode"
                value={remindFrequency}
                onChange={(e) => {
                  if (e.target.value === 'day') {
                    setSelectedDay('today');
                  }
                  if (e.target.value === 'week') {
                    setSelectedWeekday('every_friday');
                  }
                  if (e.target.value === 'month') {
                    setSelectedMonthDay('The_last_one_days_of_the_month');
                  }
                  setRemindTime('18:00')
                  setRemindFrequency(e.target.value)
                }}
              >

                {selectFrequencyList.map((item, index) => (
                  <Radio key={index} value={item.remindFrequency}>
                    {item.remindFrequencyDescribe}
                  </Radio>
                ))}
              </Radio.Group>
            </div>
          </div>

          {/* 日 */}
          {remindFrequency === 'day' && (
            <div className="approval-config-section">
              <div className="config-item">
                <div className="config-label approval-title-f16" style={{ paddingBottom: '0' }}>
                  提醒时间
                  <Tooltip
                    className="user-tooltip"
                    placement="bottom"
                    title={
                      <>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>对应提醒频率周期内</span>任意工作日未登记工时的用户，将按配置自动发送提醒
                          <div>工时登记提醒需同时配置：①本插件设置页的提醒时间、提醒成员；②飞书项目的触发器（触发器配置可参考帮助手册）</div>
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="icon" />
                  </Tooltip>
                </div>
                <div className="config-value">
                  <div>
                    <span>日期：</span>
                    <Radio.Group
                      name="approvalMode"
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                    >

                      {selectFrequencyList[0] && selectFrequencyList[0].remindDateVoList && selectFrequencyList[0].remindDateVoList.map((item, index) => (
                        <Radio key={index} value={item.remindDate}>
                          {item.remindDateDescribe}
                        </Radio>
                      ))}
                    </Radio.Group>
                    <span className="remind-time-label">时间：</span>
                    <span>
                      <TimePicker value={dayjs(remindTime, format)} format={format} onChange={handleTimeChange} allowClear={false} showNow={false} changeOnScroll needConfirm={false}/>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 周 */}
          {remindFrequency === 'week' && (
            <div className="approval-config-section">
              <div className="config-item">
                <div className="config-label approval-title-f16">
                  提醒时间
                  <Tooltip
                    className="user-tooltip"
                    placement="bottom"
                    title={
                      <>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>对应提醒频率周期内</span>任意工作日未登记工时的用户，将按配置自动发送提醒
                          <div>工时登记提醒需同时配置：①本插件设置页的提醒时间、提醒成员；②飞书项目的触发器（触发器配置可参考帮助手册）</div>
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="icon" />
                  </Tooltip>
                </div>
                <div className="config-value">
                  <div>
                    <span>日期：</span>
                    <Select
                      ref={weekSelectRef}
                      value={selectedWeekday}
                      onChange={setSelectedWeekday}
                      placeholder="选择日期"
                      style={{ width: 200 }}
                      dropdownRender={menu => (
                        <div style={{ padding: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ width: '48%' }}>

                              {selectFrequencyList[1].remindDateVoList && selectFrequencyList[1].remindDateVoList.filter(item => item.remindDate.startsWith('every_')).map(item => (
                                <div
                                  key={item.remindDate}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    marginBottom: 4,
                                    borderRadius: 4,
                                    color: selectedWeekday === item.remindDate ? '#4147F5' : '#000'
                                  }}
                                  onClick={() => handleWeekdayClick(item.remindDate)}
                                >
                                  {item.remindDateDescribe}
                                </div>
                              ))}
                            </div>
                            <div style={{ width: '48%' }}>
                              {selectFrequencyList[1].remindDateVoList && selectFrequencyList[1].remindDateVoList.filter(item => item.remindDate.startsWith('next_')).map(item => (
                                <div
                                  key={item.remindDate}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    marginBottom: 4,
                                    borderRadius: 4,
                                    color: selectedWeekday === item.remindDate ? '#4147F5' : '#000'
                                  }}
                                  onClick={() => handleWeekdayClick(item.remindDate)}
                                >
                                  {item.remindDateDescribe}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}>
                      {selectFrequencyList[1].remindDateVoList && selectFrequencyList[1].remindDateVoList.map(item => (
                        <Option key={item.remindDate} value={item.remindDate}>
                          {item.remindDateDescribe}
                        </Option>
                      ))}
                    </Select>
                    <span className="remind-time-label">时间：</span>
                    <span>
                      <TimePicker value={dayjs(remindTime, format)} format={format} onChange={handleTimeChange} allowClear={false} showNow={false} changeOnScroll needConfirm={false}/>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 月 */}
          {remindFrequency === 'month' && (
            <div className="approval-config-section">
              <div className="config-item">
                <div className="config-label approval-title-f16">
                  提醒时间
                  <Tooltip
                    className="user-tooltip"
                    placement="bottom"
                    title={
                      <>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>对应提醒频率周期内</span>任意工作日未登记工时的用户，将按配置自动发送提醒
                          <div>工时登记提醒需同时配置：①本插件设置页的提醒时间、提醒成员；②飞书项目的触发器（触发器配置可参考帮助手册）</div>
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="icon" />
                  </Tooltip>
                </div>
                <div className="config-value">
                  <div>
                    <span>日期：</span>
                    <Select
                      ref={monthSelectRef}
                      value={selectedMonthDay}
                      onChange={setSelectedMonthDay}
                      placeholder="选择日期"
                      style={{ width: 250 }}
                      dropdownRender={menu => (
                        <div style={{ padding: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ width: '48%' }}>

                              {selectFrequencyList[2].remindDateVoList && selectFrequencyList[2].remindDateVoList.filter(item => item.remindDate.startsWith('The_last_')).map(item => (
                                <div
                                  key={item.remindDate}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    marginBottom: 4,
                                    borderRadius: 4,
                                    color: selectedMonthDay === item.remindDate ? '#4147F5' : '#000'
                                  }}
                                  onClick={() => handleMonthDayClick(item.remindDate)}
                                >
                                  {item.remindDateDescribe}
                                </div>
                              ))}
                            </div>
                            <div style={{ width: '48%' }}>
                              {selectFrequencyList[2].remindDateVoList && selectFrequencyList[2].remindDateVoList.filter(item => item.remindDate.startsWith('The_next_')).map(item => (
                                <div
                                  key={item.remindDate}
                                  style={{
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    marginBottom: 4,
                                    borderRadius: 4,
                                    color: selectedWeekday === item.remindDate ? '#4147F5' : '#000'
                                  }}
                                  onClick={() => handleMonthDayClick(item.remindDate)}
                                >
                                  {item.remindDateDescribe}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}>
                      {selectFrequencyList[2].remindDateVoList && selectFrequencyList[2].remindDateVoList.map(item => (
                        <Option key={item.remindDate} value={item.remindDate}>
                          {item.remindDateDescribe}
                        </Option>
                      ))}
                    </Select>
                    <span className="remind-time-label">时间：</span>
                    <span>
                      <TimePicker value={dayjs(remindTime, format)} format={format} onChange={handleTimeChange} allowClear={false} showNow={false} changeOnScroll needConfirm={false}/>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="approval-config-section">
            <div className="config-item">
              <div className="config-label approval-title-f16">提醒成员</div>
              <div className="config-value">
                <TeamSettings
                  type="auth"
                  getSelectedUser={getSelectedUser}
                  selectedUser={selected}
                  isAllUser={isAllUser}
                  isAllTeam={isAllTeam}
                  remindUserInfo={props.remindCommonConfigData}
                />
                <div style={{ marginTop: 3 }}>
                  <Checkbox
                    checked={isSelectedTeamAdmin}
                    className="resource-selectUser-modal-tip"
                    onChange={(e) => setIsSelectedTeamAdmin(e.target.checked)}
                  >
                    选择团队时，同时选中团队管理员
                  </Checkbox>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '24px 0 0px' }}>
            <Space size="middle">
              <Button type="primary" onClick={onFinish} loading={isSubmitLoading}>保存设置</Button>
            </Space>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '24px 0 0px' }}>
          <Space size="middle">
            <Button type="primary" onClick={onFinish} loading={isSubmitLoading}>保存设置</Button>
          </Space>
        </div>
      )}
    </div>
  );
};
export default notificationSet;



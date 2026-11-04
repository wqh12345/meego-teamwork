import React, { useMemo, useState, useEffect, useRef, Component } from "react";
import {
  Checkbox,
  DatePicker,
  Button,
  Modal,
  Space,
  message,
  Dropdown,
  Divider,
  Switch,
  Popover,
  Tooltip,
  Spin,
} from "antd";
import {
  SettingOutlined,
  DownOutlined,
  RightCircleOutlined,
  InfoCircleFilled,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  urlDownload,
  canShowTenantAdminFeature
} from "../../../../util/util";
import {
  getUserRole,
  postWorkGanttChartNew,
  postWorkGanttChartNewV2,
  getResourceCondition,
  getUserNumeralConfig,
  postUserNumeralConfig,
  getUserCustomField,
  postUserCustomField,
  getRegistrantUser,
  getRefreshTeam,
  getProjectUserTeamAll,
  getreTeam,
  queryNeedShowTeamConfig,
  getResourceUserAttendanceConfig,
} from "../../../../api/api";
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegBtn from "../../components/reg-btn/RegBtn";
import SelectedUser from "../../components/team-settings/TeamSettings";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import Gantt from "../../components/gantt/Gantt";
import noData from "../../../../image/no-data-table.png";
import { gantt } from "dhtmlx-gantt";
import UserPicker from "../../components/user-picker/UserPicker";

dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;
const RESOURCE_TIME_RANGE_MONTHS = 6;

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

const getGanttUserKeys = (ganttItems) => {
  const userKeys = new Set();

  ganttItems.forEach((item) => {
    if (item?.isUser && item?.userKey) {
      userKeys.add(item.userKey);
    }
  });

  return Array.from(userKeys);
};

const buildLeaveFlagByUserAndDate = (attendanceData) => {
  const leaveFlagByUserAndDate = {};
  const projects = Array.isArray(attendanceData?.projects)
    ? attendanceData.projects
    : Array.isArray(attendanceData)
      ? attendanceData
      : attendanceData ? [attendanceData] : [];

  projects.forEach((project) => {
    const userKeys = project?.userKeys;
    if (!userKeys || typeof userKeys !== "object") return;

    Object.keys(userKeys).forEach((userKey) => {
      const attendanceByDate = userKeys[userKey];
      if (!attendanceByDate || typeof attendanceByDate !== "object") return;

      Object.keys(attendanceByDate).forEach((date) => {
        if (attendanceByDate[date]?.leaveFlag === true) {
          if (!leaveFlagByUserAndDate[userKey]) {
            leaveFlagByUserAndDate[userKey] = {};
          }
          leaveFlagByUserAndDate[userKey][date] = true;
        }
      });
    });
  });

  return leaveFlagByUserAndDate;
};

const isResourceTimeRangeExceeded = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  const earlierDate = startDate.isAfter(endDate, "day") ? endDate : startDate;
  const laterDate = startDate.isAfter(endDate, "day") ? startDate : endDate;
  return laterDate.isAfter(earlierDate.add(RESOURCE_TIME_RANGE_MONTHS, "month"), "day");
};

class Resource extends Component {
  constructor(props) {
    super(props);
    this.isPersonal = true;
    this.ganttRequestId = 0;
    // 缓存最近一次 queryMemberAndSpaceInfo 的原始返回，排序时据此重排，无需重新请求接口
    this.ganttRawRes = null;
    this.state = {
      leaveByUserInfo: {},
      beginTime:
        localStorage.getItem("resourceBeginTime") ||
        getFirstDayOfNaturalMonth(),
      endTime:
        localStorage.getItem("resourceEndTime") || getLastDayOfNaturalMonth(),
      currDropdownIndex:0,
      queryUserId: [],
      isSynchronous: Boolean,
      isSelectedTeamAdmin:false,
      proxyFillingPerson: 0,
      isSelectedUserOpen: false,
      selected: {
        selectedDeparts: [],
        selectedUsers: [],
        selectedDeptIds: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        selectedDeptMemberIds: [],
        selectedDepts: [],
        checkedKeys: []
      },
      newSelected: {
        selectedDeparts: [],
        selectedUsers: [],
        selectedDeptIds: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        selectedDeptMemberIds: [],
        selectedDepts: [],
        checkedKeys: []
        
      },
      isRegistrationOpen: false,
      dropdownItems: [
        {
          key: 0,
          onClick: () => this.onDropdownChange(0),
          label: "团队统计",
        },
        {
          key: 1,
          onClick: () => this.onDropdownChange(1),
          label: "个人统计",
        },
      ],
      ganttData: {
        data: [],
      },
      ganttUser: {
        data: [],
      },
      leaveFlagByUserAndDate: {},
      userConfig: {},
      userField: [],
      projectId: 0,
      showTeamConfig: false,
      removeTeamIds: [],
      removeUserIds:[],
      loading: false,
       /** 「登记工时」列排序方向：null(默认顺序) | 'asc' | 'desc'，仅在本次会话内生效 */
      registerWorkingHoursSort: null,
    };
  }
  componentDidMount() {
   this.init();
    // this.fetchCurrentTabData()
  }
  /** 刷新团队成员 */
 init  = async () => {
    this.checkedUserRole();
    this.getUserConfig();
    this.getUserField();
    this.getRefreshTeamMember();
    this.setState({
      loading: true,
    })
    // const res = await getreTeam();
    this.setState({
      loading: false,
    })
    // 先执行queryNeedShowTeamConfigData()获取团队配置
    await this.queryNeedShowTeamConfigData();
    // 确保currDropdownIndex值稳定后再执行fetchGanttData()
    this.fetchGanttData();
  };
  /** 刷新团队成员 */
 getRefreshTeamMember = async () => {
    const res = await getRefreshTeam();
    if (res?.result) {
    }
  };
  /** 校验管理员权限 */
  checkedUserRole = async () => {
    const res = await getUserRole();
    if (res?.result) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
    }
  };
  /** 是否显示团队设置 */
  queryNeedShowTeamConfigData = async () => {
    const res = await queryNeedShowTeamConfig();
    if (res?.result) {
      if(res.data){
        this.isPersonal = false;
      }else{
        this.isPersonal = true;
      }
      this.setState({
        showTeamConfig: res.data || false,
      });
    }
  };
  /** 获取以往查询条件 */
  getHistoryState = async () => {
    const res = await getResourceCondition();
    if (res?.result) {
      // 创建新的 selected 对象，避免引用污染
      const newSelectedData = {
        ...this.state.selected,
        selectedUserIds: res.data.userId || [],
      };
      this.setState({
        selected: newSelectedData,
        newSelected: { ...newSelectedData },  // 创建独立副本作为备份
        isSynchronous: res.data.isSynchronous || false,
        removeTeamIds: res.data.removeTeamIds || [],
        removeUserIds: res.data.removeUserKeys || [],
        removeDepartmentIds: res.data.removeDepartmentIds || [],
        isAllUser: res.data?.isAllUser?true:false,
        isAllTeam: res.data?.isAllTeam?true:false,
        isSelectedTeamAdmin: res.data?.isSelectedTeamAdmin === undefined ? true : res.data?.isSelectedTeamAdmin === 1 ? true : false
      });
    }
  };
  hideSortLoading = () => {
    const done = () => this.setState({ loading: false });
    requestAnimationFrame(() => requestAnimationFrame(done));
    // 兜底：后台标签页 rAF 可能不触发，避免 loading 卡住
    setTimeout(done, 500);
  };
  /**
   * 点击「登记工时」列头图标：升序 ↔ 降序 切换。
   * 点击后显示 loading，待排序数据经 applyGanttResponse 更新、甘特图重新渲染完成后再隐藏。
   */
  onRegisterWorkingHoursSortChange = async () => {
    const { leaveByUserInfo } = this.state;
    // 点击排序：先显示 loading，甘特图重绘完成后再隐藏
    this.setState({ loading: true });

    const rawRes = JSON.parse(JSON.stringify(this.ganttRawRes));
    // 无缓存/空数据：立即隐藏并返回（同时避免 rawRes.data.data 空指针报错导致 loading 卡住）
    if (!rawRes?.data?.length) {
      this.setState({ loading: false });
      return;
    }

    const nextSort = this.state.registerWorkingHoursSort === "asc" ? "desc" : "asc";

    function sortByField(list, key, order = "desc") {
      if (!Array.isArray(list)) return [];
      const sorted = [...list];
      sorted.sort((a, b) => {
        const valA = Number(a[key]) || 0;
        const valB = Number(b[key]) || 0;
        return order === "asc" ? valA - valB : valB - valA;
      });
      return sorted;
    }

    rawRes.data = sortByField(rawRes.data, "registerWorkingHours", nextSort);
    this.setState({
      registerWorkingHoursSort: nextSort,
    });

    const requestId = ++this.ganttRequestId;
    try {
      this.setState({
          ganttData:rawRes,
          ganttUser: JSON.parse(JSON.stringify(rawRes)),
          leaveFlagByUserAndDate:leaveByUserInfo,
          loading: false,
      });
    } finally {
      // 数据 setState 完成后，再等甘特图重绘完成隐藏 loading
      this.hideSortLoading();
    }
  };
  /** 获取甘特图 */
  fetchGanttData = async (n) => {
    const requestId = ++this.ganttRequestId;
    this.setState({ loading: true });

    try {
    const {
      selected,
      beginTime,
      endTime,
      currDropdownIndex,
      isSynchronous,
      queryUserId,
      proxyFillingPerson,
      showTeamConfig
    } = this.state;
    let searchUsers = [];
    if (queryUserId.indexOf("-111") !== -1) {
      const data = {
        startDate: beginTime,
        endDate: endTime,
      };
      const res = await getRegistrantUser(data);
      if (res?.result) {
        searchUsers = res?.data?.map((item) => item.userKey);
      }
    } else {
      searchUsers = queryUserId;
    }
    let userIdList=[]
    if(Array.isArray(selected?.allUserList) && selected.allUserList.length > 0 && Array.isArray(selected?.selectedUserIds) && selected.selectedUserIds.length > 0){
      selected.allUserList.forEach(i=>{
        if(selected.selectedUserIds.includes(i.staffUserKey))
          userIdList.push(i.staffId)
      })
    }
    const data = {
      userKeyList: selected.selectedUserIds,
      userIdList: userIdList,
      teamIds: Array.isArray(selected?.selectedDepartIds) ? selected.selectedDepartIds : [],
      statisticType: currDropdownIndex,
      selectDepartmentIds: Array.isArray(selected?.selectedDeptIds) ? selected.selectedDeptIds : [],
      startDate: beginTime,
      endDate: endTime,
      queryUserId: searchUsers,
      proxyFillingPerson,
    };
    if(n){
      if(n==2){
        delete data.isSynchronous
        data.userKeyList=[]
        data.userIdList=[]
       }else{
        if(n==1){
          data.isSynchronous=isSynchronous || false
        }
        data.isAllDepartment = selected.isAllDepartment || false;
        data.isAllUser = selected.isAllUser || false
        data.isAllTeam = selected.isAllTeam || false
        data.isSelectedTeamAdmin = this.state.isSelectedTeamAdmin
       }
    }
    if(this.isPersonal){
      data.statisticType = 1
    }
    const res = await postWorkGanttChartNewV2(data);
    if (requestId !== this.ganttRequestId) return;
    if (!res?.result) {
      this.setState({ loading: false });
      return;
    }

    const ganttPayload = res.data || {};
    const ganttItems = Array.isArray(ganttPayload.data) ? ganttPayload.data : [];
    const userKeys = getGanttUserKeys(ganttItems);
    let leaveFlagByUserAndDate = {};

    if (userKeys.length) {
      try {
        let tenantModeInfo = {};
        try {
          tenantModeInfo = JSON.parse(sessionStorage.getItem("tenantModeInfo") || "{}");
        } catch {
          tenantModeInfo = {};
        }
        const projectKey = tenantModeInfo?.mode === "space"
          ? (sessionStorage.getItem("jwtMeegoTeamworkProjectKey") || "")
          : null;
        const attendanceRes = await getResourceUserAttendanceConfig({
          items: userKeys.map((userKey) => ({ projectKey, userKey })),
          startDate: beginTime,
          endDate: endTime,
        });
        if (requestId !== this.ganttRequestId) return;
        if (attendanceRes?.result && attendanceRes?.data) {
          leaveFlagByUserAndDate = buildLeaveFlagByUserAndDate(attendanceRes.data);
        }
      } catch {
        if (requestId !== this.ganttRequestId) return;
      }
    }

    const formattedGanttItems = ganttItems.length === 0
      ? [
          {
            projectNo: "-",
            projectName: `<div style="color:#bbb;font-size:24px;margin-left: 50px;height:${
              window.screen.height - 490
            }px;"> 暂无数据 </div>`,
          },
        ]
      : ganttItems.map((item) => ({
          ...item,
          projectNo: item.id,
        }));
    const ganttData = {
      ...ganttPayload,
      data: formattedGanttItems,
    };
    this.setState({
        registerWorkingHoursSort: null,
    })
    if(ganttData?.data?.length > 0){
      this.ganttRawRes=JSON.parse(JSON.stringify(ganttData))
    }
    if(ganttData?.data?.length > 0){
      this.setState({
        leaveByUserInfo: leaveFlagByUserAndDate
      })
    }
    this.setState({
      ganttData,
      ganttUser: JSON.parse(JSON.stringify(ganttData)),
      leaveFlagByUserAndDate,
      loading: false,
    });
    } catch {
      if (requestId === this.ganttRequestId) {
        this.setState({ loading: false });
      }
    }
  };

  /** 时间改变 */
  onTimeChange = (date, dateString) => {
    const startDate = date?.[0] || dayjs(dateString?.[0], "YYYY-MM-DD", true);
    const endDate = date?.[1] || dayjs(dateString?.[1], "YYYY-MM-DD", true);

    if (!startDate?.isValid?.() || !endDate?.isValid?.()) {
      window.JSSDK.toast.warning("选择时间范围不能超过 6 个月");
      return;
    }

    if (isResourceTimeRangeExceeded(startDate, endDate)) {
      window.JSSDK.toast.warning("选择时间范围不能超过 6 个月");
      return;
    }

    localStorage.setItem("resourceBeginTime", dateString[0]);
    localStorage.setItem("resourceEndTime", dateString[1]);
    this.setState(
      {
        beginTime: dateString[0],
        endTime: dateString[1],
      },
      () => {
        this.fetchGanttData();
      }
    );
  };

  /** 统计纬度切换 */
  onDropdownChange = (e) => {
    this.setState({ currDropdownIndex: e }, () => {
      this.fetchGanttData();
    });
  };

  disabledResourceTimeDate = (currentDate, info) => {
    if (!info?.from) return false;
    return isResourceTimeRangeExceeded(info.from, currentDate);
  };

  /** 人员筛选 */
  onSearchPersonChange = async (user) => {
    user.length
      ? this.setState({ proxyFillingPerson: 1 })
      : this.setState({ proxyFillingPerson: 0 });
    const { beginTime, endTime } = this.state;
    this.setState({ queryUserId: user }, () => {
      this.fetchGanttData();
    });
  };

  /** 打开人员选择器 */
  onSelectedUserOpen = () => {
    const { newSelected } = this.state;
    this.getHistoryState().then(() => {
      this.setState({
        selected: newSelected,
        isSelectedUserOpen: true
      });
    });
  };

  handleSelectedUserCancel = () => {
    const { newSelected } = this.state;
    this.setState({ isSelectedUserOpen: false, selected: newSelected });
  };

  handleSelectedUserOk = () => {
    const { selected } = this.state;
    if (!selected.selectedUserIds.length && !selected.selectedDepartIds.length && !selected.selectedDeptIds.length) {
      window.JSSDK.toast.warning("团队成员不能为空");
      return;
    }
    this.setState({ isSelectedUserOpen: false, newSelected: selected }, () => {
      this.fetchGanttData(1);
    });
  };

  getSelectedUser = (e) => {
    this.setState({ selected: e });
  };

  /** 导出Gantt */
  onGanttExport = async () => {
    // const { newSelected, beginTime, endTime, currRangeType } = this.state;
    // const data = {
    //   userId: newSelected.selectedUserIds,
    //   startDate: beginTime + " 00:00:00",
    //   endDate: endTime + " 23:59:59",
    //   rangeType: currRangeType,
    // };
    // const res = await postAdminExportStaffStat(data);
    // if (res?.result) {
    //   urlDownload(res.data.url);
    // }
  };

  /** 提交实际工时 */
  onRegistrationOk = async (result) => {
    if (result) {
      this.fetchGanttData();
    }
    this.setState({ isRegistrationOpen: false });
  };

  onGanttChange = (result) => {
    if (result) {
      this.fetchGanttData();
    }
  };

  /** 获取用户级别配置 */
  getUserConfig = async () => {
    const data = {
      type: "ONLY_CALCULATE_WORKING_DAYS",
    };
    const res = await getUserNumeralConfig(data);
    if (res?.result) {
      this.setState({ userConfig: res.data });
    }
  };

  /** 用户级别配置修改 */
  onUserConfigChange = async (val) => {
    const data = {
      type: "ONLY_CALCULATE_WORKING_DAYS",
      id: this.state.userConfig?.id,
      value: val ? 1 : 0,
    };
    const res = await postUserNumeralConfig(data);
    if (res?.result) {
      this.getUserConfig();
      window.JSSDK.toast.success("设置成功");
      this.fetchGanttData(2);
    }
  };

  /** 获取用户自定义展示字段 */
  getUserField = async () => {
    const data = {
      type: "WORKING_HOURS_RESOURCES_GANTT_CHART",
    };
    const res = await getUserCustomField(data);
    if (res?.result) {
      this.setState({ userField: res.data });
    }
  };

  /** 用户自定义展示字段修改 */
  onUserFieldChange = async (val, index) => {
    const { userField } = this.state;
    userField[index].checked = val.target.checked;
    const data = userField;
    const res = await postUserCustomField(data);
    if (res?.result) {
      this.getUserField();
      window.JSSDK.toast.success("设置成功");
    }
  };

  render() {
    return (
      <Spin spinning={this.state.loading}>
        <div className="resource-warp">
          <div className="resource-top">
            <Space className="top-left">
              {this.state.userConfig?.value ? (
                <div>
                  工作日/非工作日（天）
                  <Tooltip
                    className="user-tooltip"
                    placement="bottom"
                    title={
                      <React.Fragment>
                        <div>此统计基于默认日历（周六日为休息日）计算。不同成员的工作日 / 休息日设置与记录规则设置相关，具体可查看成员行标准人天。</div>
                      </React.Fragment>
                    }
                  >
                    <InfoCircleFilled style={{ color: "#bbb" }} />
                  </Tooltip>
                  ：
                  <span style={{ fontWeight: "bold" }}>
                    {this.state.ganttData?.workingDayCount}/
                    {this.state.ganttData?.notWorkingDayCount}
                  </span>
                </div>
              ) : (
                <div></div>
              )}
            </Space>
            <Space className="top-right">
              <RangePicker
                className="time-picker"
                size="small"
                allowClear={false}
                presets={rangePresets}
                disabledDate={this.disabledResourceTimeDate}
                value={
                  this.state.beginTime && this.state.endTime
                    ? [dayjs(this.state.beginTime), dayjs(this.state.endTime)]
                    : []
                }
                onChange={this.onTimeChange}
              />
              {this.state.showTeamConfig && this.state.dropdownItems[this.state.currDropdownIndex].key === 0 ? (
                <Button
                  icon={<RightCircleOutlined />}
                  iconPosition="end"
                  type="link"
                  onClick={this.onSelectedUserOpen}
                >
                  团队设置
                </Button>
              ) : null}
              {this.state.showTeamConfig? (
                <Dropdown
                  menu={{
                    items: this.state.dropdownItems,
                  }}
                >
                  <a onClick={(e) => e.preventDefault()}>
                    <Space>
                      {
                        this.state.dropdownItems[this.state.currDropdownIndex]
                          .label
                      }
                      <DownOutlined />
                    </Space>
                  </a>
                </Dropdown>
              ) : null}
              <RegBtn
                loginUser={this.props?.loginUser}
                type="web"
                getRegStatus={this.onRegistrationOk}
                getRegistrationValue={this.onRegistrationOk}
                setRegistrationValue={false}
              />
              {/* <Button
                type="primary"
                onClick={() => {
                  window.JSSDK.navigation.open('https://applink.feishu.cn/client/web_app/open?appId=cli_a9572ba449785cc5&mode=appCenter&reload=false&lk_target_url=https%3A%2F%2Ftimeisv-web-dev.lundong.com.cn%2Fmanagement%3Flang%3Dzh-CN%26open_in_browser%3Dtrue');
                }}
              >
                测试跳转
              </Button> */}
            </Space>
          </div>
          <div className="resource-content">
            <div className="resource-content-top">
              <div className="resource-content-picker">
                <div
                  style={{
                    display: canShowTenantAdminFeature()? "": "none",
                  }}
                >
                  <UserPicker
                    type="Gantt"
                    mode="multiple"
                    placeholder="搜索成员"
                    getUserIds={this.onSearchPersonChange}
                  />
                </div>
              </div>
              <div className="resource-content-set">
                <Popover
                  className="popover-config"
                  placement="bottom"
                  trigger="click"
                  style={{ marginTop: -20, marginLeft: -12 }}
                  content={
                    <Space direction="vertical">
                      {this.state.userField.map((item, index) => {
                        return (
                          <div key={item.configType}>
                            <Checkbox
                              checked={item.checked}
                              onChange={(val) =>
                                this.onUserFieldChange(val, index)
                              }
                              disabled={true}
                            >
                              {item.configName}
                            </Checkbox>
                          </div>
                        );
                      })}
                      <Divider
                        style={{
                          margin: 0,
                        }}
                      />
                      <Space
                        style={{
                          padding: 0,
                        }}
                      >
                        仅计算工作日
                        <Tooltip title="开启后只合计工作日的数据">
                          <InfoCircleFilled color="#bbb" />
                        </Tooltip>
                        <Switch
                          size="small"
                          checked={this.state.userConfig?.value ? true : false}
                          onChange={this.onUserConfigChange}
                        />
                      </Space>
                    </Space>
                  }
                >
                  <SettingOutlined
                    className="set-icon"
                    style={{ marginLeft: 5 }}
                  />
                </Popover>
              </div>
            </div>
            {/* {this.state.userField.length ? ( */}
            <Gantt
              id="gantt"
              userConfig={this.state.userConfig?.value ? true : false}
              type={this.state.currDropdownIndex}
              userField={this.state.userField}
              time={[this.state.beginTime, this.state.endTime]}
              tasks={this.state.ganttData}
              ganttUser={this.state.ganttUser}
              leaveFlagByUserAndDate={this.state.leaveFlagByUserAndDate}
              getDataChange={this.onGanttChange}
              registerWorkingHoursSort={this.state.registerWorkingHoursSort}
              onRegisterWorkingHoursSortChange={this.onRegisterWorkingHoursSortChange}
            />
            {/* ) : null} */}
          </div>
          <Modal
            destroyOnClose
            title="选择成员"
            open={this.state.isSelectedUserOpen}
            onCancel={this.handleSelectedUserCancel}
            width={"745px"}
            footer={[
              <Button
                className="cancel-btn"
                onClick={this.handleSelectedUserCancel}
              >
                取消
              </Button>,
              <Button
                disabled={!this.state.selected.selectedUserIds.length && !this.state.selected.selectedDepartIds.length && !this.state.selected.selectedDeptIds.length}
                type="primary"
                onClick={this.handleSelectedUserOk}
              >
                确定
              </Button>,
            ]}
          >
            <SelectedUser
              type="all"
              getSelectedUser={this.getSelectedUser}
              projectId={this.state.projectId}
              selectedUser={this.state.selected}
              removeTeamIds={this.state.removeTeamIds}
              removeUserIds={this.state.removeUserIds}
              removeDepartmentIds={this.state.removeDepartmentIds}
              isAllUser={this.state.isAllUser}
              isAllTeam={this.state.isAllTeam}
            />
          
            <Checkbox
              checked={this.state.isSynchronous}
              className="resource-selectUser-modal-tip"
              onChange={(e) => this.setState({ isSynchronous: e.target.checked })}
            >
              设置完成后，将配置同步到【工时管理】、【工时日志】模块
              {!this.state.selected.selectedDepartIds.length}
            </Checkbox>
            
            <div className="select-team-admin">
             <Checkbox
             checked={this.state.isSelectedTeamAdmin}
              className="resource-selectUser-modal-tip"
              onChange={(e) => this.setState({ isSelectedTeamAdmin: e.target.checked })}
            >
             选择团队时，同时选中团队管理员
            </Checkbox>
            </div>
          </Modal>
          <Modal
            destroyOnClose
            title={"登记工时"}
            open={this.state.isRegistrationOpen}
            onCancel={() => this.setState({ isRegistrationOpen: false })}
            width={"745px"}
            footer={null}
          >
            <RegWorkHour
              loginUser={this.props?.loginUser}
              type="web"
              getRegistrationValue={this.onRegistrationOk}
              setRegistrationValue={false}
            />
          </Modal>
        </div>
      </Spin>
    );
  }
}

export default Resource;

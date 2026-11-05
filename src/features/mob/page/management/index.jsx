import React, { Component } from "react";
import {
  Table,
  Button,
  Dropdown,
  Input,
  Space,
  Divider,
  Select,
  message,
  Radio,
} from "antd";
import { Modal, Cascader, Popup, Calendar } from "antd-mobile";
import {
  SwapRightOutlined,
  CalendarOutlined,
  UserOutlined,
  DownOutlined,
  RightCircleOutlined,
  TeamOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  getQuarterStartAndEnd,
  urlDownload,
  isNumber
} from "../../../../util/util";
import {
  getLastStatCondition,
  postAdminQueryEntityStat,
  postAdminQueryStaffStat,
  postWorkHourQuerySelfStat,
  postAdminExportEntityStat,
  postAdminExportStaffStat,
  postWorkHourExportSelfStat,
  getUserRole,
} from "../../../../api/api";
import "./index.less";
import dayjs from "dayjs";
import MbSelectedUser from "../../components/selected-user/SelectedUser";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);

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

const rangeTypeOptions = [
  {
    value: "Month",
    label: "月",
  },
  {
    value: "Week",
    label: "周",
  },
  {
    value: "Day",
    label: "天",
  },
];

class MbManagement extends Component {
  constructor(props) {
    super(props);
    this.state = {
      beginTime: getFirstDayOfNaturalMonth(),
      endTime: getLastDayOfNaturalMonth(),
      startDate: "",
      endDate: "",
      calendarPickerVisible: false,
      currDropdownIndex:
        sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" ? 0 : 1,
      currRangeType: "Month",
      queryEntityStat: {
        table_rowData: [],
        staffSum: 0,
        workHourSum: 0,
        workItemSum: 0,
        workHourPerStaff: 0,
        table_columnName: [],
      },
      queryStaffStat: {
        table_rowData: [],
        table_columnName: [],
      },
      querySelfStat: {
        table_rowData: [],
        workHourSum: 0,
        workItemSum: 0,
        table_columnName: [],
      },
      isSelectedUserOpen: false,
      selected: {
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        checkedKeys: [],
      },
      newSelected: {
        selectedDeparts: [],
        selectedUsers: [],
        selectedDepartIds: [],
        selectedUserIds: [],
        checkedKeys: [],
      },
      isRegistrationOpen: false,
      queryEntityStatTableData: [],
      querySelfStatTableData: [],
      workItemEntityName: "",
      dropdownItems: [
        {
          value: 0,
          label: "部门统计",
        },
        {
          value: 1,
          label: "个人统计",
        },
      ],
    };
  }
  componentDidMount() {
    this.checkedUserRole();
    if (sessionStorage.getItem("jwtMeegoTeamworkUserRole") !== "Admin") {
      this.fetchQuerySelfStatData();
    } else {
      this.getHistoryState();
    }
  }

  /** 校验管理员权限 */
  checkedUserRole = async () => {
    const res = await getUserRole();
    if (res && res.data) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
    }
  };

  /** 获取以往查询条件 */
  getHistoryState = async () => {
    const { selected } = this.state;
    const data = {
      flag: 1,
    };
    const res = await getLastStatCondition(data);
    if (res?.result) {
      selected.selectedUserIds = res.data.userId;
      this.setState({ selected, newSelected: selected }, () => {
        this.fetchQueryEntityStatData();
        this.fetchQueryStaffStatData();
        this.fetchQuerySelfStatData();
      });
    }
  };

  /** 获取部门统计-工作项登记工时 */
  fetchQueryEntityStatData = async () => {
    const {
      newSelected,
      beginTime,
      endTime,
      currDropdownIndex,
      workItemEntityName,
    } = this.state;
    if (
      sessionStorage.getItem("jwtMeegoTeamworkUserRole") !== "Admin" ||
      currDropdownIndex !== 0
    )
      return;
    const data = {
      userId: newSelected.selectedUserIds,
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      workItemEntityName,
    };
    const res = await postAdminQueryEntityStat(data);
    if (res?.result) {
      this.setState({
        queryEntityStat: res.data,
        queryEntityStatTableData: res.data.table_rowData,
      });
    }
  };

  /** 获取部门统计-成员登记工时 */
  fetchQueryStaffStatData = async () => {
    const {
      newSelected,
      beginTime,
      endTime,
      currRangeType,
      currDropdownIndex,
    } = this.state;
    if (
      sessionStorage.getItem("jwtMeegoTeamworkUserRole") !== "Admin" ||
      currDropdownIndex !== 0
    )
      return;
    const data = {
      userId: newSelected.selectedUserIds,
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
    };
    const res = await postAdminQueryStaffStat(data);
    if (res?.result) {
      for (const item of res.data.table_columnName) {
        item.width = 90;
      }
      this.setState({ queryStaffStat: res.data });
    }
  };

  /** 获取个人统计-实际工时统计 */
  fetchQuerySelfStatData = async () => {
    const {
      beginTime,
      endTime,
      currRangeType,
      currDropdownIndex,
      workItemEntityName,
    } = this.state;
    if (currDropdownIndex !== 1) return;
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      workItemEntityName,
    };
    const res = await postWorkHourQuerySelfStat(data);
    if (res?.result) {
      for (const item of res.data.table_columnName) {
        item.width = 90;
      }
      this.setState({
        querySelfStat: res.data,
        querySelfStatTableData: res.data.table_rowData,
      });
    }
  };

  /** 时间改变 */
  onTimeVisibleOpen = () => {
    const { beginTime, endTime } = this.state;
    this.setState({
      startDate: beginTime,
      endDate: endTime,
      calendarPickerVisible: true,
    });
  };
  onTimeChange = (date) => {
    this.setState({
      startDate: dayjs(date[0]).format("YYYY-MM-DD"),
      endDate: dayjs(date[1]).format("YYYY-MM-DD"),
    });
  };
  onTimeConfirm = () => {
    const { startDate, endDate } = this.state;
    this.setState(
      {
        beginTime: startDate,
        endTime: endDate,
        calendarPickerVisible: false,
      },
      () => {
        this.fetchQueryEntityStatData();
        this.fetchQueryStaffStatData();
        this.fetchQuerySelfStatData();
      }
    );
  };

  /** 统计纬度切换 */
  onDropdownChange = (e) => {
    this.setState(
      { currDropdownIndex: e.target.value, workItemEntityName: "" },
      () => {
        this.fetchQueryEntityStatData();
        this.fetchQueryStaffStatData();
        this.fetchQuerySelfStatData();
      }
    );
  };

  /** 时间维度切换  */
  handleRangeTypeChange = (value) => {
    this.setState({ currRangeType: value }, () => {
      this.fetchQueryStaffStatData();
      this.fetchQuerySelfStatData();
    });
  };

  /** 打开人员选择器 */
  onSelectedUserOpen = () => {
    this.setState({
      isSelectedUserOpen: true,
    });
  };

  handleSelectedUserCancel = () => {
    const { newSelected } = this.state;
    this.setState({ isSelectedUserOpen: false, selected: newSelected });
  };

  handleSelectedUserOk = () => {
    const { selected } = this.state;
    if (!selected.selectedUserIds.length) {
      message.warning("团队成员不能为空");
      return;
    }
    this.setState({ isSelectedUserOpen: false, newSelected: selected }, () => {
      this.fetchQueryEntityStatData();
      this.fetchQueryStaffStatData();
    });
  };

  getSelectedUser = (e) => {
    this.setState({ selected: e });
  };

  /** 部门统计-工作项登记工时模糊搜索 */
  onQueryEntityStatSearch = (e) => {
    const { queryEntityStat } = this.state;
    const value = e.target.value.replace(/\s+/g, "");
    this.setState({ workItemEntityName: value }, () =>
      this.fetchQueryEntityStatData()
    );
  };

  /** 个人统计-工作项登记工时模糊搜索 */
  onQuerySelfStatSearch = (e) => {
    const { querySelfStat } = this.state;
    const value = e.target.value.replace(/\s+/g, "");
    this.setState({ workItemEntityName: value }, () =>
      this.fetchQuerySelfStatData()
    );
  };

  /** 导出-部门统计-工作项登记工时 */
  onQueryEntityStatExport = async () => {
    const { newSelected, beginTime, endTime, workItemEntityName } = this.state;
    const data = {
      userId: newSelected.selectedUserIds,
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      workItemEntityName,
    };
    const res = await postAdminExportEntityStat(data);
    if (res?.result) {
      urlDownload(res.data.url);
    }
  };

  /** 导出-部门统计-成员登记工时 */
  onQueryStaffStatExport = async () => {
    const { newSelected, beginTime, endTime, currRangeType } = this.state;
    const data = {
      userId: newSelected.selectedUserIds,
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
    };
    const res = await postAdminExportStaffStat(data);
    if (res?.result) {
      urlDownload(res.data.url);
    }
  };

  /** 导出-个人统计-实际工时统计 */
  onQuerySelfStatExport = async () => {
    const { beginTime, endTime, currRangeType, workItemEntityName } =
      this.state;
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      workItemEntityName,
    };
    const res = await postWorkHourExportSelfStat(data);
    if (res?.result) {
      urlDownload(res.data.url);
    }
  };

  /** 提交实际工时 */
  onRegistrationOk = async (result) => {
    if (result) {
      this.fetchQuerySelfStatData();
    }
    this.setState({ isRegistrationOpen: false });
  };

  render() {
    return (
      <div className="management-warp">
        <div className="management-top">
          <div className="top-item">
            <span className="top-item-txt">时间范围</span>
            <span
              className="top-item-btn"
              style={{ paddingRight: 35 }}
              onClick={this.onTimeVisibleOpen}
            >
              {this.state.beginTime}
              <SwapRightOutlined
                style={{ margin: "0 10px", color: "#BBBBBB" }}
              />
              {this.state.endTime}
              <CalendarOutlined
                style={{
                  marginLeft: "10px",
                  color: "#BBBBBB",
                  position: "absolute",
                  right: 11,
                }}
              />
            </span>
            <Popup
              destroyOnClose
              showCloseButton
              visible={this.state.calendarPickerVisible}
              onMaskClick={() =>
                this.setState({ calendarPickerVisible: false })
              }
              onClose={() => this.setState({ calendarPickerVisible: false })}
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
                  value={[
                    new Date(this.state.startDate),
                    new Date(this.state.endDate),
                  ]}
                  selectionMode="range"
                  onChange={this.onTimeChange}
                />
              </div>
              <div className="popup-footer">
                <Button
                  className="confirm-btn"
                  onClick={() =>
                    this.setState({ calendarPickerVisible: false })
                  }
                >
                  取消
                </Button>
                <Button
                  className="confirm-btn"
                  type="primary"
                  onClick={this.onTimeConfirm}
                >
                  确认
                </Button>
              </div>
            </Popup>
          </div>
          <div className="top-item flex">
            <div>
              {/* <span className="top-item-txt">统计维度</span> */}
              {sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" ? (
                <Radio.Group
                  size="small"
                  options={this.state.dropdownItems}
                  onChange={this.onDropdownChange}
                  value={this.state.currDropdownIndex}
                  optionType="button"
                  buttonStyle="solid"
                />
              ) : (
                <span>个人统计</span>
              )}
            </div>
            <div className="top-left">
              {this.state.currDropdownIndex === 0 ? (
                <Button
                  icon={<RightCircleOutlined />}
                  iconPosition="end"
                  type="link"
                  onClick={this.onSelectedUserOpen}
                >
                  团队设置弹窗
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {this.state.currDropdownIndex === 0 ? (
          <div className="management-content">
            <div className="content-top">
              <div className="content-top-box">
                <div className="box-left">
                  <FileTextOutlined className="icon" />
                  <span>工作项</span>
                </div>
                <div className="box-right">
                  {this.state.queryEntityStat.workItemSum}
                </div>
              </div>
              <div className="flex-box"></div>
              <div className="content-top-box">
                <div className="box-left">
                  <TeamOutlined className="icon" />
                  <span>团队成员</span>
                </div>
                <div className="box-right">
                  {this.state.queryEntityStat.staffSum}
                </div>
              </div>
            </div>
            <div className="content-top">
              <div className="content-top-box">
                <div className="box-left">
                  <BarChartOutlined className="icon" />
                  <span>总计登记工时</span>
                </div>
                <div className="box-right">
                  {this.state.queryEntityStat.workHourSum}
                </div>
              </div>
              <div className="flex-box"></div>
              <div className="content-top-box">
                <div className="box-left">
                  <UserOutlined className="icon" />
                  <span>人均登记工时</span>
                </div>
                <div className="box-right">
                  {isNumber(this.state.queryEntityStat.workHourPerStaff)
                    ? this.state.queryEntityStat.workHourPerStaff.toFixed(2)
                    : this.state.queryEntityStat.workHourPerStaff}
                </div>
              </div>
            </div>
            <div className="content-body">
              <div className="content-table">
                <div className="content-table-header">
                  <div className="header-title">工作项登记工时</div>
                  <Space className="header-box">
                    <Input
                      size="small"
                      placeholder="输入工作项名称"
                      onChange={this.onQueryEntityStatSearch}
                      style={{
                        width: 150,
                      }}
                      suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
                    />
                    {/* <Button
                      size="small"
                      type="primary"
                      onClick={this.onQueryEntityStatExport}
                    >
                      导出
                    </Button> */}
                  </Space>
                </div>
                <div className="content-table-body">
                  <Table
                    size="small"
                    pagination={false}
                    columns={this.state.queryEntityStat.table_columnName.map(col => ({
                      ...col,
                      align: col.dataIndex === 'actWorkHour' ? 'right' : 'left',
                    }))}
                    dataSource={this.state.queryEntityStatTableData}
                    scroll={{
                      y: 'calc(100vh - 350px)',
                      x: 'max-content',
                    }}
                    rowClassName={(record, index) => {
                      return index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
                    }}
                  />
                </div>
              </div>
              <div className="content-table">
                <div className="content-table-header">
                  <div className="header-title">成员登记工时</div>
                  <Space className="header-box">
                    <Select
                      size="small"
                      defaultValue={this.state.currRangeType}
                      style={{
                        width: 80,
                      }}
                      onChange={this.handleRangeTypeChange}
                      options={rangeTypeOptions}
                    />
                    {/* <Button
                      type="primary"
                      size="small"
                      onClick={this.onQueryStaffStatExport}
                    >
                      导出
                    </Button> */}
                  </Space>
                </div>
                <div className="content-table-body">
                  <Table
                    size="small"
                    pagination={false}
                    columns={this.state.queryStaffStat.table_columnName.map(col => ({
                      ...col,
                      align: col.dataIndex === 'actWorkHour' || col.dataIndex === 'total' ? 'right' : 'left',
                    }))}
                    dataSource={this.state.queryStaffStat.table_rowData}
                    scroll={{
                      y: 'calc(100vh - 350px)',
                      x: 'max-content',
                    }}
                    rowClassName={(record, index) => {
                      return index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="management-content">
            <div className="content-top">
              <div className="content-top-box">
                <div className="box-left">
                  <FileTextOutlined className="icon" />
                  <span>工作项</span>
                </div>
                <div className="box-right">
                  {this.state.querySelfStat.workItemSum}
                </div>
              </div>
              <div className="flex-box"></div>
              <div className="content-top-box">
                <div className="box-left">
                  <BarChartOutlined className="icon" />
                  <span>总计登记工时</span>
                </div>
                <div className="box-right">
                  {this.state.querySelfStat.workHourSum}
                </div>
              </div>
            </div>
            <div className="content-body">
              <div className="content-table">
                <div className="content-table-header">
                  <div className="header-title">工作项登记工时</div>
                  <Space className="header-box">
                    {/* <Button size="small" onClick={this.onQuerySelfStatExport}>
                      导出
                    </Button> */}
                    <Button
                      size="small"
                      type="primary"
                      onClick={() =>
                        this.setState({ isRegistrationOpen: true })
                      }
                    >
                      工时登记
                    </Button>
                  </Space>
                </div>
                <div
                  className="content-table-header"
                  style={{ marginTop: 10, justifyContent: "flex-end" }}
                >
                  <Space className="header-box">
                    <Input
                      size="small"
                      placeholder="输入工作项名称"
                      onChange={this.onQuerySelfStatSearch}
                      style={{
                        width: 150,
                      }}
                      suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
                    />
                    <Select
                      size="small"
                      defaultValue={this.state.currRangeType}
                      style={{
                        width: 80,
                      }}
                      onChange={this.handleRangeTypeChange}
                      options={rangeTypeOptions}
                    />
                  </Space>
                </div>
                <div className="content-table-body">
                  <Table
                    size="small"
                    pagination={false}
                    columns={this.state.querySelfStat.table_columnName.map(col => ({
                      ...col,
                      align: col.dataIndex === 'actWorkHour' || col.dataIndex === 'total' ? 'right' : 'left',
                    }))}
                    dataSource={this.state.querySelfStatTableData}
                    scroll={{
                      y: 'calc(100vh - 350px)',
                      x: 'max-content',
                    }}
                    rowClassName={(record, index) => {
                      return index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <Popup
          destroyOnClose
          showCloseButton
          visible={this.state.isSelectedUserOpen}
          onMaskClick={this.handleSelectedUserCancel}
          onClose={this.handleSelectedUserCancel}
          bodyStyle={{
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            minHeight: "60vh",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div className="popup-header">
            <span className="popup-title">选择成员</span>
          </div>
          <div className="popup-content">
            <MbSelectedUser
              type="all"
              getSelectedUser={this.getSelectedUser}
              selectedUser={this.state.selected}
            />
          </div>
          <div className="popup-footer">
            <Button
              className="cancel-btn"
              onClick={this.handleSelectedUserCancel}
            >
              取消
            </Button>
            <Button
              className="confirm-btn"
              disabled={!this.state.selected.selectedUserIds.length}
              type="primary"
              onClick={this.handleSelectedUserOk}
            >
              确定
            </Button>
          </div>
        </Popup>
        <Popup
          destroyOnClose
          showCloseButton
          visible={this.state.isRegistrationOpen}
          onMaskClick={() => this.setState({ isRegistrationOpen: false })}
          onClose={() => this.setState({ isRegistrationOpen: false })}
          bodyStyle={{
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            minHeight: "60vh",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div className="popup-header">
            <span className="popup-title">实际工时登记</span>
          </div>
          <div className="popup-content">
            <RegWorkHour
              type="mob"
              getRegistrationValue={this.onRegistrationOk}
              setRegistrationValue={false}
            />
          </div>
          <div className="popup-footer"></div>
        </Popup>
      </div>
    );
  }
}

export default MbManagement;

import React, { Component } from "react";
import {
  DatePicker,
  Table,
  Button,
  Dropdown,
  Modal,
  Input,
  Space,
  Divider,
  Select,
  message,
  Checkbox,
  Spin,
  Tooltip,
} from "antd";
import {
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
  isNumber,
  canShowTenantAdminFeature
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
  querySeatUserPermission,
  queryNeedShowTeamConfig
} from "../../../../api/api";
import "./index.less";
import dayjs from "dayjs";
import RegBtn from "../../components/reg-btn/RegBtn";
import SelectedUser from "../../components/team-settings/TeamSettings";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import SpaceCascader from "../../components/space-cascader/SpaceCascader";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { SeatPermissionsModal } from '../../components/seat-permissions-modal/SeatPermissionsModal';
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;

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

const OverflowTooltipText = ({ value, className }) => {
  const valueRef = React.useRef(null);
  const [isOverflowed, setIsOverflowed] = React.useState(false);

  const updateOverflow = () => {
    const element = valueRef.current;
    setIsOverflowed(Boolean(element && element.scrollWidth > element.clientWidth));
  };

  React.useLayoutEffect(() => {
    updateOverflow();
    const element = valueRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return (
    <Tooltip title={isOverflowed ? value : null}>
      <span
        ref={valueRef}
        className={className}
        onMouseEnter={updateOverflow}
      >
        {value}
      </span>
    </Tooltip>
  );
};

const CustomFieldColumnTitle = ({ title }) => (
  <OverflowTooltipText
    value={title}
    className="management-custom-field-column-title"
  />
);

const CustomFieldValueCell = ({ value }) => (
  <OverflowTooltipText
    value={value}
    className="management-custom-field-column-value"
  />
);

const getColumnIdentifiers = (column) =>
  [column?.dataIndex, column?.key]
    .filter((item) => typeof item === "string")
    .map((item) => item.toLowerCase());

const isCustomFieldColumn = (columns, index) => {
  const column = columns?.[index];
  const columnIdentifiers = getColumnIdentifiers(column);

  if (columnIdentifiers.some((item) => item.includes("customfield"))) {
    return true;
  }

  const nextColumn = columns?.[index + 1];
  const nextColumnIdentifiers = getColumnIdentifiers(nextColumn);
  const isFollowedByWorkHourColumn =
    nextColumnIdentifiers.includes("workhoursum") ||
    nextColumn?.title === "工作项实例工时";

  return index === 2 && isFollowedByWorkHourColumn;
};

const isWorkItemEntityColumn = (columns, index) => {
  const column = columns?.[index];
  const columnIdentifiers = getColumnIdentifiers(column);

  return (
    columnIdentifiers.includes("workitementityname") ||
    column?.title === "工作项实例"
  );
};

const optimizeCustomFieldColumnTitle = (columns, index) => {
  if (!isCustomFieldColumn(columns, index)) return;

  const column = columns[index];
  const originalOnHeaderCell = column.onHeaderCell;

  column.title = <CustomFieldColumnTitle title={column.title} />;
  column.onHeaderCell = (...args) => {
    const headerCellProps = originalOnHeaderCell?.(...args) || {};
    return {
      ...headerCellProps,
      className: [
        headerCellProps.className,
        "management-custom-field-column",
      ].filter(Boolean).join(" "),
    };
  };
};

const optimizeCustomFieldColumnValue = (columns, index) => {
  if (!isCustomFieldColumn(columns, index)) return;

  columns[index].render = (value) => <CustomFieldValueCell value={value} />;
};

const optimizeWorkItemEntityColumnValue = (columns, index) => {
  if (!isWorkItemEntityColumn(columns, index)) return;

  columns[index].render = (value) => <CustomFieldValueCell value={value} />;
};

class Management extends Component {
  constructor(props) {
    super(props);
    // 初始化防抖相关变量
    this.debounceTimer = null;
    this.lastRequestVersion = 0;

    this.state = {
      chatUrl: "",
      modalOpen: false,
      modalCode: undefined,
      modalResponseData: undefined,
      showSeatModal: false,
      beginTime:
        localStorage.getItem("managementBeginTime") ||
        getFirstDayOfNaturalMonth(),
      endTime:
        localStorage.getItem("managementEndTime") || getLastDayOfNaturalMonth(),
      currDropdownIndex: 0,
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
      queryEntityStatTableData: [],
      querySelfStatTableData: [],
      workItemEntityName: "",
      cascaderValue: [],
      cascaderIds: [],
      cascaderNames: {},
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
      isSynchronous: Boolean,
      isSelectedTeamAdmin: false,
      showTeamConfig: false,
      removeTeamIds: [],
      removeUserIds: [],
      removeDepartmentIds: [],
      isAllUser: false,
      isAllTeam: false,
      loading: false,
    };
  }
  componentDidMount() {
    this.fetchQueryEntityStatData();
    this.fetchQueryStaffStatData();
    this.checkedUserRole();
    this.queryNeedShowTeamConfigData();
    if (canShowTenantAdminFeature()==false) {
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
      this.setState(
        {
          selected,
          newSelected: selected,
          isSynchronous: res.data.isSynchronous,
          removeTeamIds: res.data.removeTeamIds,
          removeUserIds: res.data.removeUserKeys || [],
          removeDepartmentIds: res.data.removeDepartmentIds || [],
          isAllUser: res.data?.isAllUser ? true : false,
          isAllTeam: res.data?.isAllTeam ? true : false,
          isSelectedTeamAdmin: res.data?.isSelectedTeamAdmin === undefined ? true : res.data?.isSelectedTeamAdmin === 1 ? true : false
        },
        () => {
          this.fetchQuerySelfStatData();
        }
      );
    }
  };

  /** 获取团队统计-工作项登记工时 */
  fetchQueryEntityStatData = async (n) => {
    this.setState({ loading: true })
    const {
      newSelected,
      beginTime,
      endTime,
      currDropdownIndex,
      workItemEntityName,
      isSynchronous,
      cascaderIds,
    } = this.state;
    //console.log('newSelected666666',currDropdownIndex);
    // if (
    //   currDropdownIndex !== 0
    // ) {
    //   this.setState({ loading: false })
    //   return;
    // }

    // 生成新的请求版本号
    const currentRequestVersion = ++this.lastRequestVersion;

    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      workItemEntityName,
      workItemId: cascaderIds?.[0] || '',
      workItemEntityId: cascaderIds?.[1] || '',
    };
    if (n) {
      let userIdList=[]
      if(Array.isArray(newSelected?.allUserList) && newSelected.allUserList.length > 0 && Array.isArray(newSelected?.selectedUserIds) && newSelected.selectedUserIds.length > 0){
        newSelected.allUserList.forEach(i=>{
          if(newSelected.selectedUserIds.includes(i.staffUserKey))
            userIdList.push(i.staffId)
        })
      }
      data.userKeyList = newSelected.selectedUserIds || []
      data.selectDepartmentIds = newSelected.selectedDeptIds || [];
      data.isAllDepartment = newSelected.isAllDepartment || false;
      data.isSynchronous = isSynchronous || false
      data.isAllUser = newSelected.isAllUser || false
      data.isAllTeam = newSelected.isAllTeam || false
      data.userId = userIdList
      data.teamIds = newSelected.selectedDepartIds
      data.isSelectedTeamAdmin = this.state.isSelectedTeamAdmin
    }
    const res = await postAdminQueryEntityStat(data);

    // 检查是否是最后一次请求，如果不是则忽略结果
    if (currentRequestVersion !== this.lastRequestVersion) {
      this.setState({ loading: false })
      return;
    }
    if (res?.result) {
      res.data.table_columnName.forEach((item, index) => {
        if (index === 0) item.fixed = "left";
        item.minWidth = 120;
        optimizeCustomFieldColumnTitle(res.data.table_columnName, index);
        optimizeCustomFieldColumnValue(res.data.table_columnName, index);
        optimizeWorkItemEntityColumnValue(res.data.table_columnName, index);
      });
      // 当表格数据只有一行且该行 firstColum 为"总工时"时，视为无明细数据，置为空数组
      let tableRowData = res.data.table_rowData;
      if (Array.isArray(tableRowData) && tableRowData.length === 1 && tableRowData[0]?.workItemName === '总工时') {
        tableRowData = [];
      }
      this.setState({
        queryEntityStat: res.data,
        queryEntityStatTableData:tableRowData,
      });
    }
    this.setState({ loading: false })
  };

  /** 获取团队统计-成员登记工时 */
  fetchQueryStaffStatData = async (n) => {
    this.setState({ loading: true })
    const {
      newSelected,
      beginTime,
      endTime,
      currRangeType,
      currDropdownIndex,
      isSynchronous,
    } = this.state;
    // if (currDropdownIndex !== 0){
    //   this.setState({ loading: false })
    //   return;
    // }
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType
    };

    if (n) {
      let userIdList=[]
      if(Array.isArray(newSelected?.allUserList) && newSelected.allUserList.length > 0 && Array.isArray(newSelected?.selectedUserIds) && newSelected.selectedUserIds.length > 0){
        newSelected.allUserList.forEach(i=>{
          if(newSelected.selectedUserIds.includes(i.staffUserKey))
            userIdList.push(i.staffId)
        })
      }
      data.userKeyList = newSelected.selectedUserIds || []
      data.selectDepartmentIds = newSelected.selectedDeptIds || []
      data.isAllDepartment = newSelected.isAllDepartment || false
      data.isSynchronous = isSynchronous || false
      data.isAllUser = newSelected.isAllUser || false
      data.isAllTeam = newSelected.isAllTeam || false
      data.userId = userIdList
      data.teamIds = newSelected.selectedDepartIds
      data.isSelectedTeamAdmin = this.state.isSelectedTeamAdmin
    }
    const res = await postAdminQueryStaffStat(data);
    if (res?.result) {
      res.data.table_columnName.forEach((item, index) => {
        if (index === 0) item.fixed = "left";
        item.minWidth = 120;
        optimizeCustomFieldColumnTitle(res.data.table_columnName, index);
      });
      this.setState({ queryStaffStat: res.data });
    }
    this.setState({ loading: false })
  };

  /** 获取个人统计-实际工时统计 */
  fetchQuerySelfStatData = async () => {
    this.setState({ loading: true })
    const {
      beginTime,
      endTime,
      currRangeType,
      currDropdownIndex,
      workItemEntityName,
      cascaderIds,
    } = this.state;
    // if (currDropdownIndex !== 1) {
    //   this.setState({ loading: false })
    //   return;
    // }
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      workItemEntityName,
      workItemId: cascaderIds?.[0] || '',
      workItemEntityId: cascaderIds?.[1] || '',
    };
    const res = await postWorkHourQuerySelfStat(data);
    if (res?.result) {
      res.data.table_columnName.forEach((item, index) => {
        item.minWidth = 120;
        optimizeCustomFieldColumnTitle(res.data.table_columnName, index);
        optimizeCustomFieldColumnValue(res.data.table_columnName, index);
        optimizeWorkItemEntityColumnValue(res.data.table_columnName, index);
      });
      let tableRowData = res.data.table_rowData;
      if (Array.isArray(tableRowData) && tableRowData.length === 1 && tableRowData[0]?.workItemName === '总工时') {
        tableRowData = [];
      }
      this.setState({
        querySelfStat: res.data,
        querySelfStatTableData: tableRowData,
      });
    }
    this.setState({ loading: false })
  };

  /** 时间改变 */
  onTimeChange = (date, dateString) => {
    localStorage.setItem("managementBeginTime", dateString[0]);
    localStorage.setItem("managementEndTime", dateString[1]);
    this.setState(
      {
        beginTime: dateString[0],
        endTime: dateString[1],
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
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.setState({
      currDropdownIndex: e,
      workItemEntityName: "",
      cascaderValue: [],
      cascaderIds: [],
      cascaderNames: {},
    }, () => {
      this.fetchQueryEntityStatData();
      this.fetchQueryStaffStatData();
      this.fetchQuerySelfStatData();
    });
  };

  /** 工作项 / 工作项实例级联筛选 */
  onCascaderChange = (ids, names, selectedOptions) => {
    this.setState(
      {
        cascaderValue: selectedOptions ? selectedOptions.map((item) => item.value) : [],
        cascaderIds: ids || [],
        cascaderNames: names || {},
      },
      () => {
        if (this.state.currDropdownIndex === 0) {
          this.fetchQueryEntityStatData();
        } else {
          this.fetchQuerySelfStatData();
        }
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
  /** 是否显示团队设置 */
  queryNeedShowTeamConfigData = async () => {
    const res = await queryNeedShowTeamConfig();
    if (res?.result) {
      this.setState({
        showTeamConfig: res.data || false,
      });
    }
  };
  /** 打开人员选择器 */
  onSelectedUserOpen = async () => {
    const { selected } = this.state;
    const data = {
      flag: 1,
    };
    const res = await getLastStatCondition(data);
    if (res?.result) {
      selected.selectedUserIds = res.data.userId;
      //console.log(res.data);
      this.setState({
        selected,
        newSelected: selected,
        isSynchronous: res.data.isSynchronous,
        isSelectedUserOpen: true,
        removeTeamIds: res.data.removeTeamIds,
        removeUserIds: res.data.removeUserIds,
        removeDepartmentIds: res.data.removeDepartmentIds || [],
        isSelectedTeamAdmin: res.data?.isSelectedTeamAdmin === undefined ? true : res.data?.isSelectedTeamAdmin === 1 ? true : false
      });
    }
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
      this.fetchQueryEntityStatData(1);
      this.fetchQueryStaffStatData(1);
    });
  };

  getSelectedUser = (e) => {
    this.setState({ selected: e });
  };

  /** 团队统计-工作项实际工时模糊搜索 */
  onQueryEntityStatSearch = (e) => {
    const value = e.target.value.replace(/\s+/g, "");
    this.setState({ workItemEntityName: value });

    // 清除之前的定时器，实现防抖
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的定时器，延迟300ms执行搜索
    this.debounceTimer = setTimeout(() => {
      this.fetchQueryEntityStatData();
    }, 300);
  };

  /** 个人统计-工作项实际工时模糊搜索 */
  onQuerySelfStatSearch = (e) => {
    const value = e.target.value.replace(/\s+/g, "");
    this.setState({ workItemEntityName: value }, () =>
      this.fetchQuerySelfStatData()
    );
  };

  /** 导出-团队统计-工作项登记工时 */
  onQueryEntityStatExport = async () => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      this.setState({
        modalOpen: true,
        modalCode: res2?.data?.msgCode,
        modalResponseData: res2?.data,
        chatUrl: res2?.data?.chatUrl
      });
      return;
    }
    const { newSelected, beginTime, endTime, workItemEntityName, cascaderIds } = this.state;
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      workItemEntityName,
      workItemId: cascaderIds?.[0] || '',
      workItemEntityId: cascaderIds?.[1] || '',
    };
    const res = await postAdminExportEntityStat(data);
    if (res?.result) {
      urlDownload(res.data.url);
    }
  };

  /** 导出-团队统计-成员登记工时 */
  onQueryStaffStatExport = async () => {
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      this.setState({
        modalOpen: true,
        modalCode: res2?.data?.msgCode,
        modalResponseData: res2?.data,
        chatUrl: res2?.data?.chatUrl
      });
      return;
    }
    const { newSelected, beginTime, endTime, currRangeType } = this.state;
    const data = {
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
    const { beginTime, endTime, currRangeType, workItemEntityName, cascaderIds } =
      this.state;
    const data = {
      startDate: beginTime + " 00:00:00",
      endDate: endTime + " 23:59:59",
      rangeType: currRangeType,
      workItemEntityName,
      workItemId: cascaderIds?.[0] || '',
      workItemEntityId: cascaderIds?.[1] || '',
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
          <div className="top-left">
            {this.state.showTeamConfig && this.state.currDropdownIndex === 0 ? (
              <Button
                icon={<RightCircleOutlined />}
                iconPosition="end"
                type="link"
                onClick={this.onSelectedUserOpen}
              >
                团队设置
              </Button>
            ) : null}
          </div>
          <div className="top-right">
            <RangePicker
              size="small"
              allowClear={false}
              presets={rangePresets}
              className="top-item time-picker"
              value={[dayjs(this.state.beginTime), dayjs(this.state.endTime)]}
              onChange={this.onTimeChange}
            />
            <Divider type="vertical" />
            {this.state.showTeamConfig ? (
              <Dropdown
                className="top-item"
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
          </div>
        </div>
        {this.state.currDropdownIndex === 0 ? (
          <Spin spinning={this.state.loading}>
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
                <div className="flex-box"></div>
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
                      {/* 级联选择器：工作项 / 工作项实例（2级，隐藏空间层） */}
                      <SpaceCascader
                        size="small"
                        style={{ width: 360 }}
                        hideSpace
                        maxLevel={2}
                        value={this.state.cascaderValue}
                        placeholder="工作项 / 工作项实例"
                        onChange={this.onCascaderChange}
                      />
                      <Input
                        size="small"
                        placeholder="输入工作项实例名称"
                        value={this.state.workItemEntityName}
                        onChange={this.onQueryEntityStatSearch}
                        style={{
                          width: 180,
                        }}
                        suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
                      />
                      <Button
                        size="small"
                        type="primary"
                        onClick={this.onQueryEntityStatExport}
                      >
                        导出
                      </Button>
                    </Space>
                  </div>
                  <div className="content-table-body">
                    <Table
                      size="small"
                      pagination={false}
                      tableLayout="auto"
                      columns={this.state.queryEntityStat.table_columnName}
                      dataSource={this.state.queryEntityStatTableData}
                      scroll={{
                        y: 500,
                        x: "auto",
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
                      <Button
                        type="primary"
                        size="small"
                        onClick={this.onQueryStaffStatExport}
                      >
                        导出
                      </Button>
                    </Space>
                  </div>
                  <div className="content-table-body">
                    <Table
                      size="small"
                      pagination={false}
                      tableLayout="auto"
                      columns={this.state.queryStaffStat.table_columnName}
                      dataSource={this.state.queryStaffStat.table_rowData}
                      scroll={{
                        y: 500,
                        x: "auto",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Spin>
        ) : (
          <Spin spinning={this.state.loading}>
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
                      <SpaceCascader
                        size="small"
                        style={{ width: 360 }}
                        hideSpace
                        maxLevel={2}
                        value={this.state.cascaderValue}
                        placeholder="工作项 / 工作项实例"
                        onChange={this.onCascaderChange}
                      />
                      <Input
                        size="small"
                        placeholder="输入工作项实例名称"
                        value={this.state.workItemEntityName}
                        onChange={this.onQuerySelfStatSearch}
                        style={{
                          width: 180,
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
                      <Button size="small" onClick={this.onQuerySelfStatExport}>
                        导出
                      </Button>
                      <RegBtn
                        loginUser={this.props?.loginUser}
                        type="web"
                        getRegStatus={this.onRegistrationOk}
                        getRegistrationValue={this.onRegistrationOk}
                        setRegistrationValue={false}
                      />
                    </Space>
                  </div>
                  <div className="content-table-body">
                    <Table
                      size="small"
                      pagination={false}
                      tableLayout="auto"
                      columns={this.state.querySelfStat.table_columnName}
                      dataSource={this.state.querySelfStatTableData}
                      scroll={{
                        y: "100%",
                        x: "auto",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Spin>
        )}
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
              // disabled={!this.state.selected.selectedUserIds.length}
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
            projectId={1}
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
            设置完成后，将配置同步到【资源管理】、【工时日志】模块
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
          title="登记工时"
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
        <SeatPermissionsModal
          open={this.state.modalOpen}
          code={this.state.modalCode}
          responseData={this.state.modalResponseData}
          chatUrl={this.state.chatUrl} // 可以从父组件传递，也可以在子组件固定
          onClose={() => {
            this.setState({
              modalOpen: false,
              modalCode: undefined,
              modalResponseData: undefined,
            });
          }}
        />
      </div>
    );
  }
}

export default Management;

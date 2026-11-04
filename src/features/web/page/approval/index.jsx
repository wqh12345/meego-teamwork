import React, { useState, useEffect } from "react";
import {
  DatePicker,
  Table,
  Button,
  Cascader,
  Modal,
  Space,
  message,
  Avatar,
  Dropdown,
  Checkbox,
  Menu,
  Badge,
  Input,
  Select,
  Form,
  Tooltip,
  Tabs,
  Radio,
} from "antd";
import {
  AppstoreOutlined,
  UserOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
  DownOutlined,
  RightCircleOutlined,
  SolutionOutlined,
  HistoryOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getQuarterStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  urlDownload,
  isNumber,
  canShowTenantAdminFeature
} from "../../../../util/util";
import {
  getHasApprove,
  getApproveCount,
  getUserRole,
  postSinglePageCount,
  postBatchPageCount,
} from "../../../../api/api";
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import SelectedUser from "../../components/selected-user/SelectedUser";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import WorkNodeCascader from "../../components/workNode-cascader/WorkNodeSelect";
import SingleApproval from "./components/single-approval/SingleApproval";
import AllApproval from "./components/all-approval/AllApproval";
import { MENU_KEY, TAB_TYPE_MAP } from "./approvalMenuConfig";
import axios from "axios";
import UserPicker from "../../components/user-picker/UserPicker";
dayjs.extend(customParseFormat);
const { RangePicker } = DatePicker;
const dateFormat = "YYYY-MM-DD";
const { TextArea } = Input;

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

const Approval = (props) => {
  const [curMenu, setCurMenu] = useState("");
  const [curApprovalType, setCurApprovalType] = useState("all");
  const [curApprovalStatus, setCurApprovalStatus] = useState(null);
  const [isDataSourceLoading, setIsDataSourceLoading] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [approvalCount, setApprovalCount] = useState({
    allApprovalCount: 0,
    myWorkHoursCount: 0,
    myApprovalCount: 0,
    waitApproveCount: 0,
    doneApproveCount: 0,
  });
  const dropdownItems = [
    {
      key: 0,
      onClick: () => onDropdownChange(0),
      label: "团队统计",
    },
    {
      key: 1,
      onClick: () => onDropdownChange(1),
      label: "个人统计",
    },
  ];
  const [currItem, setCurrItem] = useState({});
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedRowKeysCount, setSelectedRowKeysCount] = useState(0);
  const [batchNum, setBatchNum] = useState({});
  const [singleNum, setSingleNum] = useState({});
  const [hasApprove, setHasApprove] = useState(false);
  const menuItems = [
    canShowTenantAdminFeature()
      ? {
          key: MENU_KEY.ALL,
          label: (
            <div className="menu-item">
              全部审批 · {approvalCount?.allApprovalCount}
            </div>
          ),
          icon: <AppstoreOutlined />,
        }
      : null,
    {
      key: MENU_KEY.SELF_INITIATED,
      label: (
        <div className="menu-item">
          我发起的 · {approvalCount?.myWorkHoursCount}
        </div>
      ),
      icon: <UserOutlined />,
    },
    {
      key: MENU_KEY.SELF_APPROVE_TODO,
      label: (
        <Badge dot={hasApprove} offset={[5, 0]}>
          <div className="menu-item">
            待办 · {approvalCount?.waitApproveCount}
          </div>
        </Badge>
      ),
      icon: <SolutionOutlined />,
    },
    {
      key: MENU_KEY.SELF_APPROVE_DONE,
      label: (
        <div className="menu-item">
          已办 · {approvalCount?.doneApproveCount}
        </div>
      ),
      icon: <HistoryOutlined />,
    },
  ];

  /** Menu点击 */
  const onMenuClick = (e) => {
    if (curMenu === e.key) return;
    setCurMenu(e.key);
  };

  /** 获取是否存在“待审批”提示 */
  const getHasApproveShow = async () => {
    const res = await getHasApprove();
    if (res?.result) {
      setHasApprove(res?.data);
    }
  };

  /** 获取单项审批-页面数量 */
  const getApprovePageCount = async () => {
    const data = {};
    if (TAB_TYPE_MAP[curMenu]) data.tabType = TAB_TYPE_MAP[curMenu];

    const res = await postSinglePageCount(data);
    if (res?.result) {
      setSingleNum(res?.data);
    }
  };

  /** 汇总审批-页面数量 */

  const getBatchApprovePageCount = async () => {
    const data = {};
    if (TAB_TYPE_MAP[curMenu]) data.tabType = TAB_TYPE_MAP[curMenu];
    const res = await postBatchPageCount(data);
    if (res?.result) {
      setBatchNum(res?.data);
    }
  };

  useEffect(() => {
    if (!curMenu) return;
    getApprovePageCount();
    getBatchApprovePageCount();
  }, [curMenu, curApprovalType]);

  /** 校验管理员权限 */
  const checkedUserRole = async () => {
    const res = await getUserRole();
    if (res && res.data) {
      sessionStorage.setItem("jwtMeegoTeamworkUserRole", res.data);
      if (props?.isFromHref) return;
      canShowTenantAdminFeature()
        ? setCurMenu(MENU_KEY.ALL)
        : setCurMenu(MENU_KEY.SELF_INITIATED);
    }
     const approvalInfo = JSON.parse(sessionStorage.getItem("approvalInfo"));
    if (approvalInfo) {
      setCurMenu(MENU_KEY.SELF_APPROVE_TODO);
      setCurApprovalType(approvalInfo.curApprovalType);
    }
  };

  useEffect(() => {

    if (props?.isFromHref) {
      setCurMenu(MENU_KEY.SELF_APPROVE_TODO);
    } else {
      getHasApproveShow();
    }
    getApprovalCount();
    checkedUserRole();
  }, []);

  /** 获取全部审批、我的工时、我审批的的数据值 */
  const getApprovalCount = async () => {
    const res = await getApproveCount();
    if (res?.result) {
      setApprovalCount(res?.data);
    }
  };

  /** 变更数据（提交+修改） */
  const onRegistrationOk = async (result) => {
    if (result) {
      fetchData();
    }
    setIsRegistrationOpen(false);
  };

  /** 刷新数据及讨人嫌的小红点是否展示 */
  const getOperate = (operate) => {
    if (operate === "batchPassErr" || operate === "batchRefuseErr") return;
    getHasApproveShow();
    getApprovalCount();
    getApprovePageCount();
    getBatchApprovePageCount();
  };

  return (
    <div className="approval-warp">
      <div className="approval-sider">
        <Menu
          onClick={onMenuClick}
          className="sider-menu"
          selectedKeys={[curMenu]}
          defaultSelectedKeys={["all"]}
          mode="inline"
          items={menuItems}
        />
      </div>
      <div className="approval-content">
        <Radio.Group
          size="small"
          className="content-top"
          onChange={(val) => setCurApprovalType(val.target.value)}
          value={curApprovalType}
        >
          <Radio.Button value="all">
            汇总审批{batchNum?.totalNum ? `（${batchNum?.approvalCollectNum}）` : `（0）`}
          </Radio.Button>
          <Radio.Button value="single">
            单项审批
            {singleNum?.totalNum ? `（${singleNum?.approvalSignalNum}）` : `（0）`}
          </Radio.Button>
        </Radio.Group>
        <div className="content-bottom">
          {curApprovalType === "all" ? (
            <AllApproval
              loginUser={props?.loginUser}
              curMenu={curMenu}
              getOperate={getOperate}
              batchNum={batchNum}
            />
          ) : null}
          {curApprovalType === "single" ? (
            <SingleApproval
              loginUser={props?.loginUser}
              curMenu={curMenu}
              hasApprove={hasApprove}
              getOperate={getOperate}
              singleNum={singleNum}
            />
          ) : null}
        </div>
      </div>
      <Modal
        destroyOnClose
        title={currItem.id ? "编辑工时日志" : "登记工时"}
        open={isRegistrationOpen}
        onCancel={() => setIsRegistrationOpen(false)}
        width={"745px"}
        footer={null}
      >
        <RegWorkHour
          loginUser={props?.loginUser}
          type="web"
          getRegistrationValue={onRegistrationOk}
          setRegistrationValue={currItem}
        />
      </Modal>
    </div>
  );
};

export default Approval;

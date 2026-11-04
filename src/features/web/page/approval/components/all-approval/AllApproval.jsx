import React, { useState, useEffect,useRef } from "react";
import {
  Table,
  Button,
  Modal,
  Space,
  message,
  Avatar,
  Tooltip,
  Drawer,
  Input,
  Form,
  Tabs,
  DatePicker,
  Select,
  Menu,
  Checkbox,
  Spin,
} from "antd";
import {
  UserOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  SearchOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import {
  postBatchApproveAllList,
  postBatchApproveSelfInitiatedList,
  postBatchApproveSelfTodoList,
  postBatchApproveSelfDoneList,
  getApprovalLog,
  postBatchApproveHandle,
  getApproveInfo,
  postBatchApproveSelectData,
  postBatchApprove,
  getCollectApproveDetailList,
  querySeatUserPermission,
  getRegisterableLevelMap
} from "../../../../../../api/api";
import {
  getUrlState,
  handleModifyType,
  getApproveStatusTag,
  goWorkItemHref,
  openLinkInHost,
} from "../../../../../../util/util";
import "./AllApproval.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegWorkHour from "../../../../components/reg-workHour/RegWorkHour";
import UserPicker from "../../../../components/approval-user-picker/UserPicker";
import WorkNodeCascader from "../../../../components/workNode-cascader/WorkNodeSelect";
import { SeatPermissionsModal } from '../../../../components/seat-permissions-modal/SeatPermissionsModal';
import {
  MENU_KEY,
  TODO_STATUS,
  isSelfApproveTodo,
  isSelfApproveDone,
  APPROVAL_TYPE_FEISHU,
  buildStatusMenuItems,
} from "../../approvalMenuConfig";
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from '../../../../hooks/useTenantCustomFieldConfig';
import { UserTag } from '@lark-project/ui-kit-plugin';
dayjs.extend(customParseFormat);
const { TextArea } = Input;
const { RangePicker } = DatePicker;
const dateFormat = "YYYY-MM-DD";

const renderTableUserInfo = (avatarUrl, name) => (
  <div className="table-columns-item">
    <Avatar src={avatarUrl} size={18} icon={<UserOutlined />} />
    <div className="table-columns-item-right">
      <div className="right-name">{name ? name : "--"}</div>
    </div>
  </div>
);

const AllApproval = (props) => {
  const {
    fieldName: customFieldName,
    showCustomField,
  } = useTenantCustomFieldConfig();
  const [loading, setLoading] = useState(false);
  const [childLoading, setChildLoading] = useState(false);
  const [searchForm] = Form.useForm();
  const [curApprovalState, setCurApprovalState] = useState("0");
  const [searchCondition, setSearchCondition] = useState({});
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [curItem, setCurItem] = useState({});
  const [dataSource, setDataSource] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 抽屉对应的列表行：跳转与审批明细显隐均以该列表行字段为准
  const [curListRecord, setCurListRecord] = useState(null);
  const drawerListRecord =
    curListRecord ?? dataSource?.data?.find((r) => r.id === curItem?.id);
  // 飞书审批才展示跳转；汇总详情 approvalType 为 null 回退列表行；
  // instanceCode 只取列表行值（详情接口的值不参与），前端拼 applink
  const approvalJumpCode =
    Number(curItem?.approvalType ?? drawerListRecord?.approvalType) ===
    APPROVAL_TYPE_FEISHU
      ? drawerListRecord?.instanceCode || ""
      : "";
  // 「全部审批」「已办」两 tab 整列不渲染操作列
  const hideOperateColumn =
    props?.curMenu === MENU_KEY.ALL || isSelfApproveDone(props?.curMenu);
  const [tablePagination, setTablePagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [batchPassBtnDisabled, setBatchPassBtnDisabled] = useState(true);
  const [batchPassBtnToolShow, setBatchPassBtnToolShow] = useState(false);
  const [batchRefuseBtnDisabled, setBatchRefuseBtnDisabled] = useState(true);
  const [batchRefuseBtnToolShow, setBatchRefuseBtnToolShow] = useState(false);
  const [batchCancelBtnDisabled, setBatchCancelBtnDisabled] = useState(true);
  const [batchCancelBtnToolShow, setBatchCancelBtnToolShow] = useState(false);
  const [batchAgainBtnDisabled, setBatchAgainBtnDisabled] = useState(true);
  const [batchAgainBtnToolShow, setBatchAgainBtnToolShow] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  // 审批通过存在失败子明细时自动展开对应汇总行（仅待办菜单生效）
  const [globalLoading, setGlobalLoading] = useState(false);
  const [pendingExpandKeys, setPendingExpandKeys] = useState([]);
  const [singlePassExpandKey, setSinglePassExpandKey] = useState(null);
  const [autoExpandedKeys, setAutoExpandedKeys] = useState([]);
  const [curOperateBtn, setCurOperateBtn] = useState("");
  const [selectNum, setSelectNum] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState();
  const [modalResponseData, setModalResponseData] = useState(undefined);
  const columns = [
    {
      title: "汇总审批单号",
      dataIndex: "bpApprovalNo",
      key: "bpApprovalNo",
      width: 160,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "成员",
      dataIndex: "staffName",
      key: "staffName",
      width: 120,
      ellipsis: true,
      render: (_, record) => (
        <div className="table-columns-item">
          {record.staffUserKey?<UserTag userId={record.staffUserKey} name={record.staffName} avatar={record.staffAvatarUrl}/>:null}
        </div>
      ),
    },
    {
      title: "变更类型",
      dataIndex: "modifyType",
      key: "modifyType",
      width: 75,
      ellipsis: true,
      render: (_) => handleModifyType(_),
    },
    {
      title: "汇总工时",
      dataIndex: "totalWorkHour",
      key: "totalWorkHour",
      width: 90,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 220,
      ellipsis: true,
      render: (_, record) => {
        if (!record?.registrationStartDate && !record?.registrationEndDate) {
          return "--";
        } else if (
          record?.registrationStartDate === record?.registrationEndDate
        ) {
          return record?.registrationStartDate;
        } else {
          return `${record?.registrationStartDate}至${record?.registrationEndDate}`;
        }
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      ellipsis: true,
      width: 80,
      render: (_) => {
        if (getApproveStatusTag(_)) return getApproveStatusTag(_);
        return "--";
      },
    },
    {
      title: "提交审批时间",
      dataIndex: "createTime",
      key: "createTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    {
      title: "更新人",
      dataIndex: "updateStaffName",
      key: "updateStaffName",
      width: 120,
      ellipsis: true,
      render: (_, record) =>
        record.updateStaffUserKey && record.updateStaffUserKey!='0'? (
          <div className="table-columns-item">
            <UserTag key={`update-${record.updateStaffUserKey}-${record.updateTime}`} userId={record.updateStaffUserKey} name={record.updateStaffName} avatar={record.updateStaffAvatarUrl}/>
          </div>
        ) : record.updateStaffUserKey=='0'?renderTableUserInfo(record.updateStaffAvatarUrl, record.updateStaffName):'--',
    },
    {
      title: "更新时间",
      dataIndex: "updateTime",
      key: "updateTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    {
      title: "审批人",
      dataIndex: "lastApprovalStaffName",
      key: "lastApprovalStaffName",
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        return record.status === 1 && record.waitApprovalList && record.waitApprovalList.length > 0 ? (
          <div className="table-columns-item">
            {record.waitApprovalList[0].userKey ? (
              <UserTag 
                key={`waitApproval-${record.waitApprovalList[0].userKey}`}
                userId={record.waitApprovalList[0].userKey} 
                name={record.waitApprovalList[0].nameCn} 
                avatar={record.waitApprovalList[0].avatarUrl}
              />
            ) : (
              record.waitApprovalList[0].nameCn || "--"
            )}
            {record.waitApprovalList.length > 1 && (
              <Tooltip 
                className="custom-tooltip"
                placement="top" 
                title={
                  <div>
                    {record.waitApprovalList.slice(1).map((item, index) => (
                      <div key={item.userKey || index} style={{ marginBottom: 4 }}>
                        {item.userKey ? (
                          <UserTag 
                            key={`waitApproval-${item.userKey}`}
                            userId={item.userKey} 
                            name={item.nameCn} 
                            avatar={item.avatarUrl}
                          />
                        ) : (
                          item.nameCn
                        )}
                      </div>
                    ))}
                  </div>
                }
              >
                <span className="wait-approval-count">+{record.waitApprovalList.length - 1}</span>
              </Tooltip>
            )}
          </div>
        ) : record.lastApprovalStaffAvatarUrl || record.lastApprovalStaffName ? (
          record.lastApprovalStaffUserKey && record.lastApprovalStaffUserKey!='0'? (
            <div className="table-columns-item">
              <UserTag key={`lastApproval-${record.lastApprovalStaffUserKey}-${record.updateTime}`} userId={record.lastApprovalStaffUserKey} name={record.lastApprovalStaffName} avatar={record.lastApprovalStaffAvatarUrl}/>
            </div>
          ) : record.lastApprovalStaffUserKey=='0'?renderTableUserInfo(record.lastApprovalStaffAvatarUrl, record.lastApprovalStaffName):'--'
        ) : (
          "--"
        );
      },
    },
    {
      title: "审批时间",
      dataIndex: "lastApprovalTime",
      key: "lastApprovalTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
    // 「全部审批」「已办」隐藏整个操作列
    ...(hideOperateColumn ? [] : [{
      title: "操作",
      key: "operate",
      dataIndex: "operate",
      fixed: "right",
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {/* 「我发起的」tab 操作列不显示审批按钮 */}
          {props?.curMenu !== MENU_KEY.SELF_INITIATED &&
          record?.operationList?.includes("audit") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "audit")}
            >
              审批
            </Button>
          ) : null}
          {/* 「待办」tab 操作列不显示撤回按钮 */}
          {props?.curMenu !== MENU_KEY.SELF_APPROVE_TODO &&
          record?.operationList?.includes("cancel") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "cancel")}
            >
              撤回
            </Button>
          ) : null}
          {record?.operationList?.includes("again_launch") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "again_launch")}
            >
              再次发起
            </Button>
          ) : null}
          {record?.operationList?.includes("delete") ? (
            <Button
              className="opt-btn"
              type="link"
              onClick={(e) => onOperateClick(e, record, "delete")}
            >
              撤销
            </Button>
          ) : null}
          <div style={{ width: "1px", height: "36px" }}></div>
        </Space>
      ),
    }]),
  ];
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [chatUrl, setChatUrl] = useState("");
 const approvalIdsArray = useRef(new Map());
  const loadingRef = useRef(false);
  // 自动展开子明细的两条链路各自的并发守卫（批量 / 单个通过）
  const isExpandLoadingRef = useRef(false);
  const isSinglePassExpandLoadingRef = useRef(false);
  // 在途请求期间被守卫吞掉的刷新请求：请求完成后用最新表单值补发一次，避免搜索最终态丢失
  const pendingRefreshRef = useRef(false);
  /** 获取表格数据 */
  const getTableDataSource = async () => {
    // 防止并发请求：在途期间不重复发请求，标记 pending 由 finally 补发
    if (loadingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setSelectedRowKeys([]);
    try {
      const searchData = searchForm.getFieldsValue();
      if (searchData?.submitTimeDays) {
        searchData.startTime = searchData.submitTimeDays[0].format("YYYY-MM-DD");
        searchData.endTime = searchData.submitTimeDays[1].format("YYYY-MM-DD");
        delete searchData.submitTimeDays;
      }
      if (searchData?.workItem) {
        searchData.workItemId = searchData?.workItem[0];
        searchData.workItemEntityId = searchData?.workItem[1];
        searchData.nodeId = searchData?.workItem[2];
        searchData.taskId = searchData?.workItem[3];
        delete searchData.workItem;
      }
      const data = {
        ...searchData,
        ...tablePagination,
      };
      // 待办：固定查询「待审批」；已办-全部：不传状态，由接口名区分
      const effectiveStatus = isSelfApproveTodo(props?.curMenu)
        ? TODO_STATUS
        : curApprovalState;
      if (Number(effectiveStatus)) data.status = Number(effectiveStatus);
      let res = {};
      switch (props?.curMenu) {
        case MENU_KEY.ALL:
          res = await postBatchApproveAllList(data);
          break;
        case MENU_KEY.SELF_INITIATED:
          res = await postBatchApproveSelfInitiatedList(data);
          break;
        case MENU_KEY.SELF_APPROVE_TODO:
          res = await postBatchApproveSelfTodoList(data);
          break;
        case MENU_KEY.SELF_APPROVE_DONE:
          res = await postBatchApproveSelfDoneList(data);
          break;
        default:
          break;
      }
      if (res?.result) {
        res?.data?.data?.forEach((item) => {
          // 可操作数据ID列表
          let singleIds = [];
          // 可操作数据列表
          let operaItems = [];
          item?.approvalRecordInfoVoList?.forEach((opera) => {
            if (opera?.operationList?.length && opera?.approvalStatus === 1) {
              singleIds.push(opera.id);
              operaItems.push(opera);
            }
          });
          item.singleIds = singleIds;
          item.operaItems = operaItems;
        });
        let sortedData=[]
        res?.data?.data.forEach((item) => {
          if(approvalIdsArray.current.has(item.id)){
            sortedData.push(item)
          }
        });
        res?.data?.data.forEach((item) => {
          if(!approvalIdsArray.current.has(item.id)){
            sortedData.push(item)
          }
        });
        res.data.data=sortedData
        setDataSource(res.data);
      }
    } catch (error) {
      console.error('获取审批列表数据失败:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      // 有被吞掉的刷新：用最新表单值/分页补发一次（多次变更合并为一次），删空搜索框等最终态必达
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        getTableDataSource();
      }
    }
  };

  /** 获取汇总审批下的单项审批 */
  const getSingleApprovalTable = async (record) => {
    if (!record?.id) return;
    const data = {
      id: record?.id,
    };
    setChildLoading(true);
    const res = await postBatchApproveSelectData(data);
    if (res?.result) {
      const singleIds = [];
      const operaItems = [];
      const checkedChild = [];
      res?.data?.forEach((item) => {
        item.parentId = record?.id;
        if (item?.operationList?.length && item?.approvalStatus === 1) {
          singleIds.push(item.id);
          operaItems.push(item);
          if (selectedRowKeys.includes(record?.id)) checkedChild.push(item.id);
        }
      });
      dataSource?.data?.forEach((item) => {
        if (!"checkedChild" in item) item.checkedChild = [];
        if (!"operaItems" in item) item.operaItems = [];
        if (item.id === record?.id) {
          item.single = res.data;
          item.singleIds = singleIds;
          item.checkedChild = checkedChild;
          item.operaItems = operaItems;
        }
      });
      setDataSource({ ...dataSource });
    }
    setChildLoading(false);
  };

  /** 加载单条汇总审批下的子审批数据（仅返回数据，不触发 setDataSource，供批量并行加载使用） */
  const loadSingleApprovalData = async (record) => {
    if (!record?.id) return null;
    const data = { id: record?.id };
    const res = await postBatchApproveSelectData(data);
    if (res?.result) {
      const singleIds = [];
      const operaItems = [];
      const checkedChild = [];
      res?.data?.forEach((item) => {
        item.parentId = record?.id;
        if (item?.operationList?.length && item?.approvalStatus === 1) {
          singleIds.push(item.id);
          operaItems.push(item);
          if (selectedRowKeys.includes(record?.id)) checkedChild.push(item.id);
        }
      });
      return {
        id: record.id,
        single: res.data,
        singleIds,
        operaItems,
        checkedChild,
      };
    }
    return null;
  };

  /** 获取汇总审批详情信息 */
  const getApprovalInfo = async (record) => {
    const data = {
      id: record?.id,
    };
    const res = await getCollectApproveDetailList(data);
    setCurItem(res?.data);
  };
  // const postPage=async (record)=>{
  //   const parentHref = await window.JSSDK.navigation.getHref();
  //   const state = getUrlState(parentHref);
  //   if(state.rowid){
  //     const data={
  //       id:state.rowid
  //     }
  //     getApprovalInfo(data);
  //     setDrawerOpen(true);
  //   }
  // }
  useEffect(() => {
    if (refreshKey > 0) getTableDataSource();
  }, [refreshKey]);

  /**
   * 切换左侧菜单时，顶部状态页签重置为「全部」
   * 注意：该 effect 必须声明在下方「菜单 / 状态变化」的 effect 之前，
   * 让状态先被重置，后续 effect 才会用正确状态发起请求，避免多余的脏请求。
   */
  useEffect(() => {
    setCurApprovalState("0");
  }, [props?.curMenu]);

  useEffect(() => {
    setCurItem({});
    approvalIdsArray.current.clear();
    if (!props?.curMenu || !curApprovalState?.length) return;
    setExpandedRowKeys([]);
    setAutoExpandedKeys([]);
    setSelectedRowKeys([]);
    setDataSource({});
    if (tablePagination.pageNum !== 1) {
      setTablePagination({
        ...tablePagination,
        pageNum: 1,
      });
    } else {
      setRefreshKey(k => k + 1);
    }
  }, [props?.curMenu, curApprovalState, searchCondition]);

  useEffect(() => {
    getTableDataSource();
  }, [tablePagination]);


const filterApprovalRecords = (levelMapData, originalRecords) => {
  // 参数验证
  if (!Array.isArray(originalRecords) || originalRecords.length === 0) {
    return {
      approvalRecordInfoVoList: [],
      showClearleLevel: false
    };
  }
  
  if (!levelMapData || typeof levelMapData !== 'object') {
    return {
      approvalRecordInfoVoList: originalRecords,
      showClearleLevel: false
    };
  }
  
  // 彻底深拷贝，包括嵌套对象
  const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    
    const cloned = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  };
  
  const filteredRecords = deepClone(originalRecords);
  const levelMapKeys = Object.keys(levelMapData);
  const defaultLevelValues = levelMapKeys.length > 0 ? levelMapData[levelMapKeys[0]] : [];
  let hasFilteredRecords = false;
  
  filteredRecords.forEach((record, index) => {
    // 跳过无效记录
    if (!record || typeof record !== 'object') return;
    
    const { type, workItemId } = record;
    
    // 检查必需字段
    if (type === undefined || workItemId === undefined) {
      // 不修改actWorkHour，直接跳过
      return;
    }
    
    let isValidRecord = true;
    
    // 情况1：workItemId存在于levelMap的key中
    if (levelMapKeys.includes(workItemId)) {
      isValidRecord = Array.isArray(levelMapData[workItemId]) && 
                     levelMapData[workItemId].includes(type);
    } else {
      // 情况2：使用默认级别值
      isValidRecord = Array.isArray(defaultLevelValues) && 
                     defaultLevelValues.includes(type);
    }
    
    // 只有不满足条件时才设置actWorkHour为0
    if (!isValidRecord) {
      record.actWorkHour = 0;
      hasFilteredRecords = true;
    } else {
      // 确保满足条件的记录actWorkHour不被修改
      if (record.actWorkHour === 0) {
        delete record.actWorkHour; // 或者设置为原始值
      }
    }
  });
  //console.log('过滤后的审批记录:', filteredRecords);
  return {
    approvalRecordInfoVoList: filteredRecords,
    showClearleLevel: hasFilteredRecords
  };
};
  /** 点击操作按钮 */
  const onOperateClick = async (e, record, operate) => {
    setCurOperateBtn("");
    e && e.stopPropagation();
    const res2 = await querySeatUserPermission();
    // 如果接口返回true，显示SeatPermissionsModal
    if (res2?.result && res2?.data?.msgCode) {
      setModalCode(res2?.data?.msgCode);
      setModalResponseData(res2?.data);
      setModalOpen(true); // 显示模态框
      setChatUrl(res2?.data?.chatUrl);
      return;
    }
    switch (operate) {
      // 审批
      case "audit":
        onDrawerOpen(record);
        break;
      // 撤回
      case "cancel":
        let reason = "";
        Modal.confirm({
          title: "确认撤回工时审批？",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#faad14" }}> 撤回 </span>
                当前成员登记的工时？撤回后当前审批人将无法继续审批。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入撤回原因（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              approvalCollects: [
                {
                  collectId: record.id,
                  approvalIds: [],
                },
              ],
              type: "cancel",
              reason,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              approvalIdsArray.current.delete(record.id)
              window.JSSDK.toast.success("撤回成功");
              getTableDataSource();
              setExpandedRowKeys([]);
              setSelectedRowKeys([]);
              props?.getOperate();
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 再次发起
      case "again_launch":
       if (record.modifyType === "create" || record.modifyType === "edit") {
      // 创建新的record对象，避免修改原始数据
        const newRecord = {
          ...record,
          registrantUserKey: record.staffUserKey,
          avatarUrl: record.staffAvatarUrl,
          userName: record.staffName,
        };
        
        const res = await getRegisterableLevelMap();
        if(res?.result && res?.data){
          // 使用新的record对象
          let approvalRecordInfoVoList = JSON.parse(JSON.stringify(newRecord.approvalRecordInfoVoList));
          const result = filterApprovalRecords(res?.data, approvalRecordInfoVoList);
          // 更新新的record对象，而不是原始record
          newRecord.approvalRecordInfoVoList = result.approvalRecordInfoVoList;
          newRecord.showClearleLevel = result.showClearleLevel;
        }
        
        setCurItem(newRecord); // 使用新的record对象
        const modal = await window.JSSDK.modal.open({
          entry: "RegModal",
          width: 1070,
          height: 750,
          maskClosable: false,
          context: {
            title: "编辑审批工时",
            loginUser: {
              avatar: newRecord.staffAvatarUrl,
              id: newRecord.staffUserKey,
              name: newRecord.staffName,
            },
            registrationType: "batch",
            openType: "again_launch",
            batchRegVal: newRecord, // 使用新的record对象
          },
          onSubmit: (confirm) => {
            modal.close();
            if (confirm.confirm) {
              window.JSSDK.toast.success("再次发起审批成功");
              getTableDataSource();
              setExpandedRowKeys([]);
              setSelectedRowKeys([]);
              props?.getOperate();
            }
          },
        });
        return;
      }
        if (record.modifyType === "delete") {
          Modal.confirm({
            title: "确认再次发起审批？",
            icon: <ExclamationCircleFilled />,
            content:
              "当前工时审批变更类型为 [ 删除 ] ，审批通过后对应的工时日志将成功删除，不可恢复。",
            closeIcon: <CloseOutlined />,
            okText: "确定",
            cancelText: "取消",
            async onOk() {
              const data = {
                approvalCollects: [
                  {
                    collectId: record.id,
                    approvalIds: [],
                  },
                ],
                type: "again_launch",
                reason,
                actWorkHour: record?.actWorkHour,
                workDesc: record?.workDesc,
                workDate: record?.workDate,
                modifyType: record?.modifyType,
              };
              const res = await postBatchApprove(data);
              if (res?.result) {
                window.JSSDK.toast.success("再次发起审批成功");
                getTableDataSource();
                setExpandedRowKeys([]);
                setSelectedRowKeys([]);
                props?.getOperate();
              }
            },
            onCancel() {
              // window.JSSDK.toast.success('操作成功');
            },
          });
          return;
        }
        break;
      // 撤销
      case "delete":
        Modal.confirm({
          title: "确认撤销工时审批？",
          icon: <ExclamationCircleFilled />,
          content: "您即将撤销该条工时审批记录，撤销后审批单关闭不可操作。",
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              approvalCollects: [
                {
                  collectId: record.id,
                  approvalIds: [],
                },
              ],
              type: "delete",
              reason,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              approvalIdsArray.current.delete(record.id)
              window.JSSDK.toast.success("撤销成功");
              getTableDataSource();
              setExpandedRowKeys([]);
              setSelectedRowKeys([]);
              props?.getOperate();
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 删除 (删除变撤销了)
      // case "delete":
      //   Modal.confirm({
      //     title: "确认删除工时审批？",
      //     icon: <ExclamationCircleFilled />,
      //     content: "您即将删除该条工时审批记录，删除后不可恢复。",
      //     closeIcon: <CloseOutlined />,
      //     okText: "确定",
      //     cancelText: "取消",
      //     async onOk() {
      //       const data = {
      //         id: record.id,
      //         type: "delete",
      //         reason,
      //       };
      //       const res = await postBatchApprove(data);
      //       if (res?.result) {
      //         window.JSSDK.toast.success("删除成功");
      //         getTableDataSource();
      //         setExpandedRowKeys([]);
      //         setSelectedRowKeys([]);
      //       }
      //     },
      //     onCancel() {
      //       // window.JSSDK.toast.success('操作成功');
      //     },
      //   });
      //   break;
      // 单个通过
      case "pass":
        reason = "";
        Modal.confirm({
          title: "工时审批通过确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#4247f6" }}> 通过 </span>
                工时审批？确认后当前工时变更立即生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              approvalCollects: [
                {
                  collectId: record.id,
                  approvalIds: [],
                },
              ],
              type: "pass",
              reason,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              let approvalTipText='操作成功'
              if(res?.data){
              let approvalIdsArrayData=new Map(approvalIdsArray.current)
              res?.data?.results?.forEach(item=>{
                if(approvalIdsArrayData.has(item.collectId)){
                  let errMsgArr=approvalIdsArrayData.get(item.collectId)
                  if(errMsgArr.subApprovalList.has(item.id)){
                    let errMsgArrSub=errMsgArr.subApprovalList.get(item.id) 
                    if(!errMsgArrSub.includes(item.result)){
                      errMsgArrSub.push(item.result)
                      errMsgArr.subApprovalList.set(item.id,errMsgArrSub)
                    }
                    approvalIdsArrayData.set(item.collectId,errMsgArr)
                  }else{
                    errMsgArr.subApprovalList.set(item.id,[item.result])
                    approvalIdsArrayData.set(item.collectId, errMsgArr)
                  }
                }else{
                  let subApproval=new Map()
                  subApproval.set(item.id,[item.result])
                  approvalIdsArrayData.set(item.collectId, {subApprovalList:subApproval})
                }
              })
              approvalIdsArray.current=approvalIdsArrayData
              //approvalTipText=`批量审批完成，成功通过：${res?.data?.passCount}条，审批失败：${res?.data?.errorCount}条`
              if(res?.data?.hasApprovalCount && res?.data?.hasApprovalCount !=0){
                approvalTipText=`因审批单状态已变更，无法进行审批`
              }else{
                if(res?.data?.errorCount){
                  approvalTipText='操作失败'
                }else{
                  approvalTipText='操作成功'
                }
              }
            }
             if(res?.data?.errorCount || res?.data?.hasApprovalCount>0){
              window.JSSDK.toast.warning(approvalTipText);
             }else{
              window.JSSDK.toast.success(approvalTipText);
              }
              setDrawerOpen(false);
              if (isSelfApproveTodo(props?.curMenu)) {
                // 待办：单个通过存在失败子审批则追加到自动展开列表，全部成功则清空
                await getTableDataSource();
                setSelectedRowKeys([]);
                setCurItem({});
                const hasSinglePassFailure =
                  res?.data?.errorCount > 0 || res?.data?.hasApprovalCount > 0;
                if (hasSinglePassFailure) {
                  setGlobalLoading(true);
                  setAutoExpandedKeys((prev) => [...new Set([...prev, record.id])]);
                  setSinglePassExpandKey(record.id);
                } else {
                  setAutoExpandedKeys([]);
                  setExpandedRowKeys([]);
                }
              } else {
                getTableDataSource();
                setExpandedRowKeys([]);
                setSelectedRowKeys([]);
                setCurItem({});
              }
              props?.getOperate();
            } else {
              getApprovalInfo(curItem);
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 单个拒绝
      case "refuse":
        reason = "";
        Modal.confirm({
          title: "工时审批拒绝确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#df000e" }}> 拒绝 </span>
                工时审批？确认后当前工时变更不生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const data = {
              approvalCollects: [
                {
                  collectId: record.id,
                  approvalIds: [],
                },
              ],
              type: "refuse",
              reason,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              window.JSSDK.toast.success("操作成功");
              setDrawerOpen(false);
              getTableDataSource();
              setExpandedRowKeys([]);
              setSelectedRowKeys([]);
              props?.getOperate();
              setCurItem({});
            } else {
              getApprovalInfo(curItem);
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 批量通过
      case "batchPass":
        Modal.confirm({
          title: "工时审批通过确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#4247f6" }}> 批量通过 </span>
                工时审批？确认后当前工时变更立即生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const approvalCollects = [];
            dataSource?.data?.forEach((item) => {
              if (item?.checkedChild?.length) {
                approvalCollects.push({
                  collectId: item.id,
                  approvalIds: item?.checkedChild,
                });
              }
            });
            const data = {
              approvalCollects,
              type: "pass",
              reason,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              let approvalTipText='操作成功'
              if(res?.data){
              let approvalIdsArrayData=new Map(approvalIdsArray.current)
              res?.data?.results?.forEach(item=>{
                if(approvalIdsArrayData.has(item.collectId)){
                  let errMsgArr=approvalIdsArrayData.get(item.collectId)
                  if(errMsgArr.subApprovalList.has(item.id)){
                    let errMsgArrSub=errMsgArr.subApprovalList.get(item.id) 
                    if(!errMsgArrSub.includes(item.result)){
                      errMsgArrSub.push(item.result)
                      errMsgArr.subApprovalList.set(item.id,errMsgArrSub)
                    }
                    approvalIdsArrayData.set(item.collectId,errMsgArr)
                  }else{
                    errMsgArr.subApprovalList.set(item.id,[item.result])
                    approvalIdsArrayData.set(item.collectId, errMsgArr)
                  }
                }else{
                  let subApproval=new Map()
                  subApproval.set(item.id,[item.result])
                  approvalIdsArrayData.set(item.collectId, {subApprovalList:subApproval})
                }
              })
              approvalIdsArray.current=approvalIdsArrayData
              approvalTipText=`批量通过：批量操作完成。成功通过：${res?.data?.passCount}条，操作失败：${res?.data?.errorCount}条。`
               if(res?.data?.hasApprovalCount && res?.data?.hasApprovalCount !=0){
                approvalTipText+=`其中${res?.data?.hasApprovalCount}条因审批单状态已变更，无法进行审批操作`
              }
              }
              if (res?.data?.errorCount > 0 || res?.data?.hasApprovalCount > 0) {
                window.JSSDK.toast.warning(approvalTipText);
              }else{
                window.JSSDK.toast.success(approvalTipText);
              }
              if (isSelfApproveTodo(props?.curMenu)) {
                // 待办：收集操作未成功（返回结果消息非空）的汇总审批id，自动展开行展示失败详情
                const failedCollectIds = [];
                res?.data?.results?.forEach((item) => {
                  if (item.result && !failedCollectIds.includes(item.collectId)) {
                    failedCollectIds.push(item.collectId);
                  }
                });
                await getTableDataSource();
                setSelectedRowKeys([]);
                if (failedCollectIds.length > 0) {
                  setGlobalLoading(true);
                  setAutoExpandedKeys((prev) => [...new Set([...prev, ...failedCollectIds])]);
                  setPendingExpandKeys(failedCollectIds);
                } else {
                  setAutoExpandedKeys([]);
                  setExpandedRowKeys([]);
                }
              } else {
                getTableDataSource();
                setExpandedRowKeys([]);
                setSelectedRowKeys([]);
              }
              props?.getOperate();
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        props?.getOperate("batchPassErr");
        break;
      // 批量拒绝
      case "batchRefuse":
        Modal.confirm({
          title: "工时审批拒绝确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#df000e" }}> 批量拒绝 </span>
                工时审批？确认后当前工时变更不生效。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入审批意见（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const approvalCollects = [];
            dataSource?.data?.forEach((item) => {
              if (item?.checkedChild?.length) {
                approvalCollects.push({
                  collectId: item.id,
                  approvalIds: item?.checkedChild,
                });
              }
            });
            const data = {
              approvalCollects,
              type: "refuse",
              reason,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              let approvalTipText='操作成功'
              if(res?.data){
                approvalTipText=`批量拒绝：批量操作完成。成功拒绝：${res?.data?.passCount}条，操作失败：${res?.data?.errorCount}条。`
                if(res?.data?.hasApprovalCount && res?.data?.hasApprovalCount !=0){
                  approvalTipText+=`其中${res?.data?.hasApprovalCount}条因审批单状态已变更，无法进行审批操作`
                }
              }
               if (res?.data?.errorCount > 0 || res?.data?.hasApprovalCount > 0) {
                window.JSSDK.toast.warning(approvalTipText);
              }else{
                window.JSSDK.toast.success(approvalTipText);
              }
              getTableDataSource();
              setExpandedRowKeys([]);
              setSelectedRowKeys([]);
              props?.getOperate();
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 批量撤回
      case "batchCancel":
        Modal.confirm({
          title: "工时审批撤回确认",
          content: (
            <>
              <div>
                确认
                <span style={{ color: "#faad14" }}> 批量撤回 </span>
                当前成员登记的工时？撤回后当前审批人将无法继续审批。
              </div>
              <TextArea
                showCount
                maxLength={200}
                style={{ width: "100%", marginTop: "10px" }}
                onChange={(e) => {
                  reason = e.target.value;
                }}
                placeholder="请输入撤回原因（非必填）"
                autoSize={{ minRows: 3, maxRows: 5 }}
              />
            </>
          ),
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const approvalCollects = [];
            dataSource?.data?.forEach((item) => {
              if (item?.checkedChild?.length) {
                approvalCollects.push({
                  collectId: item.id,
                  approvalIds: item?.checkedChild,
                });
              }
            });
            const data = {
              approvalCollects,
              type: "cancel",
              reason,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              let approvalTipText='操作成功'
              if(res?.data){
                approvalTipText=`批量撤回：批量操作完成。成功撤回：${res?.data?.passCount}条，操作失败：${res?.data?.errorCount}条。`
                if(res?.data?.hasApprovalCount && res?.data?.hasApprovalCount !=0){
                  approvalTipText+=`其中${res?.data?.hasApprovalCount}条因审批单状态已变更，无法进行撤回操作`
                }
              }
              if (res?.data?.errorCount > 0 || res?.data?.hasApprovalCount > 0) {
                window.JSSDK.toast.warning(approvalTipText);
              }else{
                window.JSSDK.toast.success(approvalTipText);
              }
              getTableDataSource();
              setExpandedRowKeys([]);
              setSelectedRowKeys([]);
              props?.getOperate();
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        break;
      // 批量再次发起
      case "batchAgain":
        // if (record.modifyType === "delete") {
        Modal.confirm({
          title: "确认再次发起审批？",
          icon: <ExclamationCircleFilled />,
          content:
            "当前工时审批变更类型为 [ 删除 ] ，审批通过后对应的工时日志将成功删除，不可恢复。",
          closeIcon: <CloseOutlined />,
          okText: "确定",
          cancelText: "取消",
          async onOk() {
            const approvalCollects = [];
            dataSource?.data?.forEach((item) => {
              if (item?.checkedChild?.length) {
                approvalCollects.push({
                  collectId: item.id,
                  approvalIds: item?.checkedChild,
                });
              }
            });
            const data = {
              approvalCollects,
              type: "again_launch",
              reason,
              actWorkHour: record?.actWorkHour,
              workDesc: record?.workDesc,
              workDate: record?.workDate,
              modifyType: record?.modifyType,
            };
            const res = await postBatchApprove(data);
            if (res?.result) {
              window.JSSDK.toast.success("再次发起审批成功");
              getTableDataSource();
              setExpandedRowKeys([]);
              setSelectedRowKeys([]);
              props?.getOperate();
            }
          },
          onCancel() {
            // window.JSSDK.toast.success('操作成功');
          },
        });
        return;
        // }
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (curOperateBtn) onOperateClick("", selectedRowKeys, curOperateBtn);
  }, [curOperateBtn]);
  const checkApprovalInfo = async () => {
    if(sessionStorage.getItem("approvalInfo")){
      const approvalInfo = JSON.parse(sessionStorage.getItem("approvalInfo"));
      if(approvalInfo?.curApprovalType==="all"){
        const data = {
          id: approvalInfo?.id,
        };
        const res = await getCollectApproveDetailList(data);
        setCurItem(res?.data);
        setDrawerOpen(true);
      }
    }
  };
  useEffect(() => {
    checkApprovalInfo()
  }, []);
  /** 控制批量按钮显示规则 */
  const handleSelectedRows = () => {
    let isCheckedChild = false;
    let isPass = false;
    let isRefuse = false;
    let isCancel = false;
    let isAgain = false;
    let checkedChildNum = 0;
    dataSource?.data?.forEach((batch) => {
      if (batch?.checkedChild?.length) isCheckedChild = true;
      checkedChildNum += batch?.checkedChild?.length
        ? batch?.checkedChild?.length
        : 0;
      if (selectedRowKeys.includes(batch?.id) && batch?.status === 2) {
        isPass = true;
        isRefuse = true;
        isCancel = true;
        isAgain = true;
      }
      if (selectedRowKeys.includes(batch?.id)) {
        if (!batch?.operationList?.includes("audit")) {
          isPass = true;
          isRefuse = true;
        }
        if (!batch?.operationList?.includes("again_launch")) {
          isAgain = true;
        }
        if (!batch?.operationList?.includes("cancel")) {
          isCancel = true;
        }
      }
      // batch?.approvalRecordInfoVoList?.forEach((single) => {
      //   if (batch?.checkedChild?.includes(single?.id)) {
      //     if (!single?.operationList?.includes("audit")) {
      //       isPass = true;
      //       isRefuse = true;
      //     }
      //     if (!single?.operationList?.includes("again_launch")) {
      //       isAgain = true;
      //     }
      //     if (!single?.operationList?.includes("cancel")) {
      //       isCancel = true;
      //     }
      //   }
      // });
    });
    if (!isCheckedChild && !selectedRowKeys.length) {
      setSelectNum(0);
      setBatchPassBtnDisabled(true);
      setBatchPassBtnToolShow(false);
      setBatchRefuseBtnDisabled(true);
      setBatchRefuseBtnToolShow(false);
      setBatchCancelBtnDisabled(true);
      setBatchCancelBtnToolShow(false);
      setBatchAgainBtnDisabled(true);
      setBatchAgainBtnToolShow(false);
      return;
    }
    setSelectNum(checkedChildNum);
    setBatchAgainBtnDisabled(!isAgain);
    setBatchAgainBtnToolShow(isAgain);
    setBatchPassBtnDisabled(!isPass);
    setBatchPassBtnToolShow(isPass);
    setBatchRefuseBtnDisabled(!isRefuse);
    setBatchRefuseBtnToolShow(isRefuse);
    setBatchCancelBtnDisabled(!isCancel);
    setBatchCancelBtnToolShow(isCancel);
  };

  /** 选择数据变动 */
  useEffect(() => {
    handleSelectedRows();
  }, [selectedRowKeys, dataSource]);

  /** 批量审批后自动展开有失败/异常的汇总审批行（仅待办：pendingExpandKeys 只在待办分支被置位） */
  useEffect(() => {
    if (pendingExpandKeys.length === 0 || !dataSource?.data?.length) return;
    if (isExpandLoadingRef.current) return;
    isExpandLoadingRef.current = true;
    const loadAndExpand = async () => {
      try {
        // 筛选 autoExpandedKeys 中尚未加载子数据的行
        const recordsToLoad = autoExpandedKeys
          .map((id) => dataSource.data.find((item) => item.id === id))
          .filter((record) => record && !record?.single?.length);
        // 并行加载所有行的子数据
        const results = await Promise.all(
          recordsToLoad.map((record) => loadSingleApprovalData(record))
        );
        // 一次性更新 dataSource，避免逐行渲染闪动
        const loadedMap = new Map();
        results.forEach((r) => { if (r) loadedMap.set(r.id, r); });
        const newData = dataSource.data.map((item) => {
          const loaded = loadedMap.get(item.id);
          if (loaded) {
            return {
              ...item,
              single: loaded.single,
              singleIds: loaded.singleIds,
              operaItems: loaded.operaItems,
              checkedChild: loaded.checkedChild,
            };
          }
          return item;
        });
        setDataSource({ ...dataSource, data: newData });
        setExpandedRowKeys([...autoExpandedKeys]);
        setPendingExpandKeys([]);
        // 等待一帧渲染完成后隐藏全局 loading
        requestAnimationFrame(() => {
          setGlobalLoading(false);
        });
      } catch (error) {
        console.error('批量加载子审批数据失败:', error);
        setGlobalLoading(false);
      } finally {
        isExpandLoadingRef.current = false;
      }
    };
    loadAndExpand();
  }, [dataSource, pendingExpandKeys]);

  /** 单个通过审批后自动展开有失败/异常的汇总审批行（独立于批量通过逻辑，仅待办生效） */
  useEffect(() => {
    if (!singlePassExpandKey || !dataSource?.data?.length) return;
    if (isSinglePassExpandLoadingRef.current) return;
    isSinglePassExpandLoadingRef.current = true;
    const loadAndExpand = async () => {
      try {
        // 筛选 autoExpandedKeys 中尚未加载子数据的行
        const recordsToLoad = autoExpandedKeys
          .map((id) => dataSource.data.find((item) => item.id === id))
          .filter((record) => record && !record?.single?.length);
        // 并行加载所有行的子数据
        const results = await Promise.all(
          recordsToLoad.map((record) => loadSingleApprovalData(record))
        );
        // 一次性更新 dataSource，避免逐行渲染闪动
        const loadedMap = new Map();
        results.forEach((r) => { if (r) loadedMap.set(r.id, r); });
        const newData = dataSource.data.map((item) => {
          const loaded = loadedMap.get(item.id);
          if (loaded) {
            return {
              ...item,
              single: loaded.single,
              singleIds: loaded.singleIds,
              operaItems: loaded.operaItems,
              checkedChild: loaded.checkedChild,
            };
          }
          return item;
        });
        setDataSource({ ...dataSource, data: newData });
        setExpandedRowKeys([...autoExpandedKeys]);
        setSinglePassExpandKey(null);
        // 等待一帧渲染完成后隐藏全局 loading
        requestAnimationFrame(() => {
          setGlobalLoading(false);
        });
      } catch (error) {
        console.error('加载子审批数据失败:', error);
        setGlobalLoading(false);
      } finally {
        isSinglePassExpandLoadingRef.current = false;
      }
    };
    loadAndExpand();
  }, [dataSource, singlePassExpandKey]);

  /** 打开侧拉弹窗 */
  const onDrawerOpen = (item) => {
    // setCurItem(item);
    setCurListRecord(item);
    getApprovalInfo(item);
    setDrawerOpen(true);
  };

  /** 跳转到飞书审批页：instanceCode 只取列表行，前端拼飞书 applink */
  const onJumpToApproval = () => {
    if (!approvalJumpCode) return;
    openLinkInHost(
      `https://applink.feishu.cn/client/mini_program/open?mode=appCenter&appId=cli_9cb844403dbb9108&path=pc%2Fpages%2Fin-process%2Findex%3FinstanceId%3D${approvalJumpCode}`,
    );
  };

  /** 关闭侧拉弹窗 */
  const onDrawerClose = () => {
    if(sessionStorage.getItem("approvalInfo")){
      sessionStorage.removeItem("approvalInfo");
    }
    setDrawerOpen(false);
    setCurItem({});
    setCurListRecord(null);
  };

  /** 分页 */
  const onPageChange = (page, e) => {
   setExpandedRowKeys([]);
   setAutoExpandedKeys([]);
    tablePagination.pageNum = page;
    setTablePagination(tablePagination);
  };

  /** 切换数据量 */
  const onSizeChange = (pagination) => {
    approvalIdsArray.current=new Map();
    if (pagination.pageSize !== tablePagination.pageSize) {
      if (pagination.current !== 1) pagination.current = 1;
      dataSource.data = [];
      setDataSource(dataSource);
    }
    pagination.pageNum = pagination.current;
    setTablePagination(pagination);
  };

  /** 变更工时审批 */
  const onRegistrationOk = async (result) => {
    if (result) {
      getTableDataSource();
      setExpandedRowKeys([]);
      setSelectedRowKeys([]);
      props?.getOperate();
    }
    setIsRegistrationOpen(false);
  };

  /** 筛选改变 */
  const onSearchValuesChange = (changedValues, allValues) => {
    setSearchCondition(allValues);
  };

  /** 筛选成员 */
  const onSearchPersonChange = (value) => {
    approvalIdsArray.current=new Map()
    searchForm.setFieldValue("staffUserKeys", value);
    setSearchCondition({ ...searchCondition, staffUserKeys: value });
  };

  /** 筛选登记对象 */
  const getWorkItem = (workItem) => {
    if (!workItem) {
      setSearchCondition({ ...searchCondition, workItem: [] });
    }
    if (workItem?.length > 2) {
      setSearchCondition({ ...searchCondition, workItem });
    }
  };

  /** 展开汇总审批 */
  const expandedRowRender = (recordParent) => {
    const columns = [
      // {
      //   title: "",
      //   dataIndex: "id",
      //   key: "id",
      //   ellipsis: true,
      //   width: 45,
      //   align: "center",
      //   render: (_, record) => {
      //     switch (props?.curMenu) {
      //       case "all":
      //         return (
      //           <Checkbox
      //             disabled={record?.approvalStatus !== 1}
      //             checked={recordParent?.checkedChild?.includes(record.id)}
      //             onChange={(e) =>
      //               onSingleCheckboxChange(e, record, indexParent)
      //             }
      //             onClick={(e) => e.stopPropagation()}
      //           />
      //         );
      //         break;
      //       case "self-initiated":
      //         // if (record?.approvalStatus === 1 || record?.approvalStatus === 4)
      //         return (
      //           <Checkbox
      //             disabled={record?.approvalStatus !== 1}
      //             checked={recordParent?.checkedChild?.includes(record.id)}
      //             onChange={(e) =>
      //               onSingleCheckboxChange(e, record, indexParent)
      //             }
      //             onClick={(e) => e.stopPropagation()}
      //           />
      //         );
      //         break;
      //       case "self-approve":
      //         // if (record?.approvalStatus !== 4 && record?.approvalStatus !== 5)
      //         return (
      //           <Checkbox
      //             disabled={record?.approvalStatus !== 1}
      //             checked={recordParent?.checkedChild?.includes(record.id)}
      //             onChange={(e) =>
      //               onSingleCheckboxChange(e, record, indexParent)
      //             }
      //             onClick={(e) => e.stopPropagation()}
      //           />
      //         );
      //         break;
      //     }
      //   },
      // },
      {
        title: "所属工作项",
        dataIndex: "workItemId",
        key: "workItemId",
        ellipsis: true,
        width: 100,
        render: (_, record) =>
          record.workItemName ? record.workItemName : "--",
      },
      {
        title: "登记对象",
        dataIndex: "workItemEntityId",
        key: "workItemEntityId",
        width: 200,
        ellipsis: true,
        render: (_, record) =>
          record.workItemEntityName ? (
            <Tooltip
              title={`${record.workItemEntityName}
              ${record.nodeName ? `/${record.nodeName}` : ""}
              ${record.taskName ? `/${record.taskName}` : ""}`}
            >
              <div
                className="link"
                style={{
                  width: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  wordBreak: "break-all",
                  verticalAlign: "middle",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  goWorkItemHref(record);
                }}
              >
                {record.workItemEntityName}
                {record.nodeName ? `/${record.nodeName}` : ""}
                {record.taskName ? `/${record.taskName}` : ""}
              </div>
            </Tooltip>
          ) : (
            "--"
          ),
      },
      {
        title: "登记工时",
        dataIndex: "actWorkHour",
        key: "actWorkHour",
        width: 100,
        align: "center",
        ellipsis: true,
        render: (_) => (_ ? _ : "--"),
      },
      {
        title: "工作日期",
        dataIndex: "workDate",
        key: "workDate",
        width: 120,
        ellipsis: true,
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
        title: "状态",
        dataIndex: "approvalStatus",
        key: "approvalStatus",
        ellipsis: true,
        width: 80,
        render: (_) => {
          if (getApproveStatusTag(_)) return getApproveStatusTag(_);
          return "--";
        },
      },
      {
        title: "审批单",
        dataIndex: "approvalNo",
        key: "approvalNo",
        width: 130,
        ellipsis: true,
        render: (_) =>
          _ ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {_}
            </div>
          ) : (
            "--"
          ),
      },
      {
        title: "成员",
        dataIndex: "userName",
        key: "userName",
        width: 120,
        ellipsis: true,
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
                {/* {record?.status === "resigned" ? "(已离职)" : ""} */}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "变更类型",
        dataIndex: "modifyType",
        key: "modifyType",
        width: 75,
        ellipsis: true,
        render: (_) => handleModifyType(_),
      },
      {
        title: (
          <div className="table-columns-item-title">
            <span>已登记工时</span>
            <Tooltip
              title={
                <>
                  <div>
                    前者：指个人已登记的总实际工时，即当前「成员」在当前「登记对象」已登记的总「实际工时」
                  </div>
                  <div>
                    后者：指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」
                  </div>
                </>
              }
            >
              <InfoCircleFilled />
            </Tooltip>
          </div>
        ),
        dataIndex: "registeredWorkTime",
        key: "registeredWorkTime",
        ellipsis: true,
        width: 200,
        render: (_) => (_ ? _ : "--/--"),
      },
      {
        title: "更新人",
        dataIndex: "updateName",
        key: "updateName",
        width: 120,
        ellipsis: true,
        render: (_, record) => (
          <div className="table-columns-item">
            <Avatar
              src={record.updateAvatarUrl}
              size={18}
              icon={<UserOutlined />}
            />
            <div className="table-columns-item-right">
              <div className="right-name">
                {record.updateName ? record.updateName : "--"}
                {/* {record?.registrantStaffStatus === "resigned" ? "(已离职)" : ""} */}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "更新时间",
        dataIndex: "updateTime",
        key: "updateTime",
        width: 180,
        ellipsis: true,
        render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
      },
      {
        title: "审批人",
        dataIndex: "approvalName",
        key: "approvalName",
        width: 120,
        ellipsis: true,
        render: (_, record) =>
          record.approvalAvatarUrl || record.approvalName ? (
            <div className="table-columns-item">
              <Avatar
                src={record.approvalAvatarUrl}
                size={18}
                icon={<UserOutlined />}
              />
              <div className="table-columns-item-right">
                <div className="right-name">
                  {record.approvalName ? record.approvalName : "--"}
                  {/* {record?.registrantStaffStatus === "resigned" ? "(已离职)" : ""} */}
                </div>
              </div>
            </div>
          ) : (
            "--"
          ),
      },
      {
        title: "审批时间",
        dataIndex: "approvalTime",
        key: "approvalTime",
        width: 180,
        ellipsis: true,
        render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
      },
      // {
      //   title: "操作",
      //   key: "operate",
      //   dataIndex: "operate",
      //   fixed: "right",
      //   width: 120,
      //   render: (_, record) => (
      //     <Space size="small">
      //       {record?.operationList?.includes("audit") ? (
      //         <Button
      //           className="opt-btn"
      //           type="link"
      //           onClick={(e) => onOperateClick(e, record, "audit")}
      //         >
      //           审批
      //         </Button>
      //       ) : null}
      //       {record?.operationList?.includes("cancel") ? (
      //         <Button
      //           className="opt-btn"
      //           type="link"
      //           onClick={(e) => onOperateClick(e, record, "cancel")}
      //         >
      //           撤回
      //         </Button>
      //       ) : null}
      //       {record?.operationList?.includes("again_launch") ? (
      //         <Button
      //           className="opt-btn"
      //           type="link"
      //           onClick={(e) => onOperateClick(e, record, "again_launch")}
      //         >
      //           再次发起
      //         </Button>
      //       ) : null}
      //       {record?.operationList?.includes("delete") ? (
      //         <Button
      //           className="opt-btn"
      //           type="link"
      //           onClick={(e) => onOperateClick(e, record, "delete")}
      //         >
      //           撤销
      //         </Button>
      //       ) : null}
      //       <div style={{ width: "1px", height: "36px" }}></div>
      //     </Space>
      //   ),
      // },
    ];

    if (recordParent?.single?.length > 0) {
      return (
        <SingleTable
          dataSource={recordParent.single}
          approvalIdsArray={approvalIdsArray.current}
          showCustomField={showCustomField}
          customFieldName={customFieldName}
        />
      );
    }
  };

  /** 选中单项审批 */
  const onSingleCheckboxChange = (e, record, indexParent) => {
    e.stopPropagation();
    if (e.target.checked) {
      dataSource.data[indexParent].checkedChild = [
        ...new Set([...dataSource?.data[indexParent]?.checkedChild, record.id]),
      ];
      if (
        dataSource.data[indexParent].checkedChild?.length ===
        dataSource.data[indexParent].singleIds?.length
      )
        setSelectedRowKeys([
          ...new Set([...selectedRowKeys, dataSource.data[indexParent].id]),
        ]);
      setDataSource({ ...dataSource });
    } else {
      dataSource.data[indexParent].checkedChild = dataSource.data[
        indexParent
      ].checkedChild.filter((item) => item !== record.id);
      if (
        !dataSource?.data[indexParent]?.checkedChild?.length ||
        dataSource.data[indexParent]?.checkedChild?.length !==
          dataSource.data[indexParent]?.singleIds?.length
      )
        setSelectedRowKeys(
          selectedRowKeys.filter(
            (item) => item !== dataSource.data[indexParent].id
          )
        );
      setDataSource({ ...dataSource });
    }
  };

  /** 汇总审批的展开与折叠 */
  const onExpand = (expanded, record) => {
    if (expanded) {
      if (!record?.single?.length) getSingleApprovalTable(record);
      if (!expandedRowKeys.includes(record.id)) expandedRowKeys.push(record.id);
    } else {
      expandedRowKeys.splice(expandedRowKeys.indexOf(record.id), 1);
    }
    setExpandedRowKeys([...expandedRowKeys]);
  };

  /** 表格多选配置：已办 tab 无可操作项，不展示行多选 */
  const rowSelectionConfig = {
    renderCell: (checked, record) => (
      <Checkbox
        // disabled={record.status === 2}
        checked={checked}
        // indeterminate={checked && record.status === 1}
        onClick={(e) => {
          e && e.stopPropagation();
        }}
        onChange={(e) => {
          const selected = e.target.checked;
          if (selected) {
            if (!selectedRowKeys.includes(record.id))
              selectedRowKeys.push(record.id);
            if (record?.operaItems?.length) {
              const checkedChild = [];
              record?.operaItems?.forEach((item) => {
                if (item?.approvalStatus === 1) checkedChild.push(item.id);
              });
              dataSource?.data?.forEach((item) => {
                if (item.id === record.id) item.checkedChild = checkedChild;
              });
            }
          } else {
            selectedRowKeys.splice(selectedRowKeys.indexOf(record.id), 1);
            dataSource?.data?.forEach((item) => {
              if (item.id === record.id) item.checkedChild = [];
            });
          }
          setSelectedRowKeys([...selectedRowKeys]);
          setDataSource({ ...dataSource });
        }}
      />
    ),
    selectedRowKeys: selectedRowKeys,
    onSelectAll: (selected) => {
      if (selected) {
        const newSelectedRowKeys = [];
        dataSource?.data?.forEach((item) => {
          // if (item.status !== 2)
          newSelectedRowKeys.push(item.id);
        });
        if (newSelectedRowKeys.length === selectedRowKeys.length) {
          setSelectedRowKeys([]);
          dataSource?.data?.forEach((item) => {
            item.checkedChild = [];
          });
        } else {
          dataSource?.data?.forEach((item) => {
            // if (!selectedRowKeys.includes(item.id) && item.status !== 2)
            selectedRowKeys.push(item.id);
            const checkedChild = [];
            item?.operaItems?.forEach((item) => {
              // if (item?.approvalStatus === 1)
              checkedChild.push(item.id);
            });
            item.checkedChild = checkedChild;
          });
          setSelectedRowKeys([...selectedRowKeys]);
        }
      } else {
        setSelectedRowKeys([]);
        dataSource?.data?.forEach((item) => {
          item.checkedChild = [];
        });
      }
      setDataSource({ ...dataSource });
    },
  };

  return (
    <>
      {globalLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: "rgba(255, 255, 255, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Spin size="large" tip="加载中..." />
        </div>
      )}
      {(() => {
        const items = buildStatusMenuItems({
          curMenu: props?.curMenu,
          counts: {
            all: props?.batchNum?.approvalCollectNum,
            wait: props?.batchNum?.waitApproveNum,
            pass: props?.batchNum?.passApproveNum,
            refuse: props?.batchNum?.refuseApproveNum,
            cancel: props?.batchNum?.cancelApproveNum,
            revoke: props?.batchNum?.revokeApproveNum,
            done: props?.batchNum?.doneApproveNum,
          },
        });
        return items ? (
          <Menu
            className="approval-content-menu"
            size="small"
            onClick={(e) => {
              setCurApprovalState(e.key);
              approvalIdsArray.current = new Map();
            }}
            selectedKeys={[curApprovalState]}
            mode="horizontal"
            items={items}
          />
        ) : null;
      })()}
      <Form
        layout="inline"
        style={{ marginBottom: 5 }}
        form={searchForm}
        autoComplete="off"
        onValuesChange={onSearchValuesChange}
      >
        <Form.Item name="bpApprovalNo">
          <Input
            size="small"
            placeholder="搜索审批单"
            id={`bpApprovalNo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}
            autoComplete="off"
            onChange={() => {
              approvalIdsArray.current=new Map()
            }}
            suffix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
          />
        </Form.Item>
        {props?.curMenu === "self-initiated" ? null : (
          <Form.Item name="staffUserKeys">
            <UserPicker
              type="approval"
              size="small"
              mode="multiple"
              placeholder="成员"
              getUserIds={onSearchPersonChange}
               
            />
          </Form.Item>
        )}
        <Form.Item name="submitTimeDays">
          <RangePicker
            className="time-picker"
            style={{ alignItems: "center" }}
            size="small"
            format={dateFormat}
            placeholder={["提交日期", "提交日期"]}
            onChange={() => {
              approvalIdsArray.current=new Map()
            }}
          />
        </Form.Item>
        <Form.Item>
          <Button
            size="small"
            onClick={() => {
              searchForm.resetFields();
              setSearchCondition({});
              approvalIdsArray.current=new Map()
            }}
          >
            重置
          </Button>
        </Form.Item>
      </Form>
      {/* 「全部审批」「已办」tab 不提供批量操作入口 */}
      {isSelfApproveDone(props?.curMenu) || props?.curMenu === MENU_KEY.ALL ? null : (
      <div className="approval-content-btns">
        <Space>
          <div className="des">已选中{selectNum}条数据</div>
          {props?.curMenu === MENU_KEY.ALL ||
          isSelfApproveTodo(props?.curMenu) ? (
            batchPassBtnToolShow ? (
              <Tooltip title="当前选中数据中存在无法审批的数据">
                <Button size="small" type="primary" disabled={true}>
                  批量通过
                </Button>
              </Tooltip>
            ) : (
              <Button
                size="small"
                type="primary"
                disabled={batchPassBtnDisabled && !selectNum}
                onClick={() => setCurOperateBtn("batchPass")}
              >
                批量通过
              </Button>
            )
          ) : null}
          {props?.curMenu === "all" || props?.curMenu === "self-initiated" ? (
            batchCancelBtnToolShow ? (
              <Tooltip title="当前选中数据中存在无法撤回的数据">
                <Button size="small" type="primary" disabled={true}>
                  批量撤回
                </Button>
              </Tooltip>
            ) : (
              <Button
                size="small"
                type="primary"
                disabled={batchCancelBtnDisabled && !selectNum}
                onClick={() => setCurOperateBtn("batchCancel")}
              >
                批量撤回
              </Button>
            )
          ) : null}
          {props?.curMenu === MENU_KEY.ALL ||
          isSelfApproveTodo(props?.curMenu) ? (
            batchRefuseBtnToolShow ? (
              <Tooltip title="当前选中数据中存在无法审批的数据">
                <Button size="small" type="primary" danger disabled={true}>
                  批量拒绝
                </Button>
              </Tooltip>
            ) : (
              <Button
                size="small"
                type="primary"
                danger
                disabled={batchRefuseBtnDisabled && !selectNum}
                onClick={() => setCurOperateBtn("batchRefuse")}
              >
                批量拒绝
              </Button>
            )
          ) : null}
        </Space>
      </div>
      )}
      <Table
        className="approval-content-table"
        size="small"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={dataSource?.data}
        onRow={(record) => ({
          onClick: () => {
            onDrawerOpen(record);
          },
        })}
        rowSelection={
          isSelfApproveDone(props?.curMenu) || props?.curMenu === MENU_KEY.ALL
            ? null
            : rowSelectionConfig
        }
        rowClassName={(record) => {
          // 检查记录是否有 id 字段
          if (record && record.id !== undefined) {
            if (approvalIdsArray.current.has(record.id) && record?.status === 1) {
              return 'red-row';
            }
          } else {
            console.log('记录没有 id 字段或记录为空');
          }
          
          return '';
        }}
        expandable={{
          showExpandColumn: true,
          expandedRowKeys: expandedRowKeys,
          rowExpandable: () => true,
          expandedRowRender: expandedRowRender,
          onExpand: onExpand,
        }}
        pagination={{
          current: tablePagination.pageNum, //当前页码
          pageSize: tablePagination.pageSize, // 每页数据条数
          total: dataSource.total, // 总条数
          onChange: (page) => onPageChange(page), //改变页码的函数
          showSizeChanger: dataSource.total > 10,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          // hideOnSinglePage:
          //   dataSource.total > 10 && dataSource.total < 20 ? false : true,
        }}
        onChange={onSizeChange}
        scroll={{
          x: "100%",
          y: "calc(100vh - 320px)",
        }}
      />
      <Drawer
        destroyOnHidden
        title={
          <>
            <div className="drawer-approval-header">
              <div className="approval-title">
                {curItem?.bpApprovalNo}
                {getApproveStatusTag(curItem?.status, "batch")}
              </div>
              <div className="approval-title-des">
                {curItem?.staffName}&nbsp;&nbsp;于&nbsp;&nbsp;
                {dayjs(curItem?.createTime).format("YYYY-MM-DD HH:mm:ss")}
                &nbsp;&nbsp;创建
              </div>
            </div>
          </>
        }
        placement="right"
        width={750}
        className="drawer-approval"
        closeIcon={null}
        onClose={onDrawerClose}
        open={drawerOpen}
        extra={
          <Space>
            {/* 通过/拒绝仅「待办」tab 展示（其他 tab 不提供抽屉内审批入口） */}
            {props?.curMenu === MENU_KEY.SELF_APPROVE_TODO &&
            curItem?.operationList?.includes("audit") ? (
              <Button
                size="small"
                type="primary"
                onClick={(e) => onOperateClick(e, curItem, "pass")}
              >
                通过
              </Button>
            ) : null}
            {props?.curMenu === MENU_KEY.SELF_APPROVE_TODO &&
            curItem?.operationList?.includes("audit") ? (
              <Button
                size="small"
                danger
                type="primary"
                onClick={(e) => onOperateClick(e, curItem, "refuse")}
              >
                拒绝
              </Button>
            ) : null}
            {approvalJumpCode ? (
              <Button
                size="small"
                icon={<ExportOutlined />}
                onClick={onJumpToApproval}
              >
                跳转
              </Button>
            ) : null}
          </Space>
        }
      >
        <div className="drawer-approval-content">
          <div className="approval-content-box">
            <div className="box-title">登记工时</div>
            <div
              className="box-content"
              style={{
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <div className="box-content-item" style={{ width: "18%" }}>
                <div className="item-title">成员</div>
                <div className="item-content">
                  {curItem?.staffUserKey ? <UserTag userId={curItem?.staffUserKey} name={curItem?.staffName} avatar={curItem?.staffAvatarUrl}/> : ""}
                  {/* <Avatar
                    className="item-content-avatar"
                    src={curItem?.staffAvatarUrl}
                    size={20}
                    icon={<UserOutlined />}
                  />
                  <div className="item-content-txt">
                    {curItem?.staffName ? curItem?.staffName : "--"}
                  </div> */}
                </div>
              </div>
              <div className="box-content-item" style={{ width: "15%" }}>
                <div className="item-title">变更类型</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {handleModifyType(curItem?.modifyType)
                      ? handleModifyType(curItem?.modifyType)
                      : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item" style={{ width: "15%" }}>
                <div className="item-title">汇总工时</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {typeof curItem?.totalWorkHour === "number"
                      ? `${curItem?.totalWorkHour} 小时`
                      : "--"}
                  </div>
                </div>
              </div>
              <div className="box-content-item" style={{ width: "18%" }}>
                <div className="item-title">更新人</div>
                <div className="item-content">
                  {curItem?.updateStaffName === "自动通过"
                    ? renderTableUserInfo(curItem?.updateStaffAvatarUrl, curItem?.updateStaffName)
                    : curItem?.updateStaffUserKey
                      ? <UserTag key={curItem.updateStaffUserKey} userId={curItem.updateStaffUserKey} name={curItem.updateStaffName} avatar={curItem.updateStaffAvatarUrl}/>
                      : null}
                </div>
              </div>
              <div className="box-content-item" style={{ width: "25%" }}>
                <div className="item-title">更新时间</div>
                <div className="item-content">
                  <div className="item-content-txt">
                    {curItem?.updateTime
                      ? dayjs(curItem?.updateTime).format("YYYY-MM-DD HH:mm:ss")
                      : "--"}
                  </div>
                </div>
              </div>
            </div>
            <div
              className="box-content"
              style={{ paddingTop: 0, paddingBottom: "40px" }}
            >
              <SingleTable
                id={curItem?.id}
                dataSource={curItem?.approvalRecordInfoVoList}
                showCustomField={showCustomField}
                customFieldName={customFieldName}
              />
            </div>
          </div>
          {/* 飞书审批（列表行 approvalType=2）：审批明细整块隐藏；1 或 null 正常显示 */}
          {Number(drawerListRecord?.approvalType) === APPROVAL_TYPE_FEISHU ? null : (
          <div className="approval-content-box">
            <div className="box-title">审批明细</div>
            <div className="box-content">
              <ApprovalDetailsTable
                status={curItem?.status}
                id={curItem?.id}
                dataSource={curItem?.approvalCollectLogVoList}
              />
            </div>
          </div>
          )}
        </div>
      </Drawer>
      <Modal
        destroyOnClose
        title={curItem?.id ? "编辑审批工时" : "登记工时"}
        open={isRegistrationOpen}
        onCancel={() => setIsRegistrationOpen(false)}
        width={"745px"}
        footer={null}
      >
        <RegWorkHour
          loginUser={props?.loginUser}
          type="approval"
          getRegistrationValue={onRegistrationOk}
          setRegistrationValue={curItem}
        />
      </Modal>
       <SeatPermissionsModal
        open={modalOpen}
        code={modalCode}
        responseData={modalResponseData}
        chatUrl={chatUrl} // 可以从父组件传递，也可以在子组件固定
        onClose={() => {
          setModalOpen(false);
          // 重置状态，避免下次打开时显示旧内容
          setModalCode(undefined);
          setModalResponseData(undefined);
        }}
      />
    </>
  );
};
export default AllApproval;

const SingleTable = (props) => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const approvalIdsArray = useRef(props?.approvalIdsArray || new Map());
  const columns = [
    {
      title: "所属工作项",
      dataIndex: "workItemName",
      key: "workItemName",
      ellipsis: true,
      width: 100,
      //render: (_, record) => (record.workItemName ? record.workItemName : "--"),
      render: (_, record) => {
        // 检查当前记录的审批ID是否存在于指定数组中
        const parentShowTooltip = approvalIdsArray.current.has(record.parentId);
        let shouldShowTooltip=false
        let shouldShowTooltipText=false
        if(parentShowTooltip){
         let sparentShowTooltipVal = approvalIdsArray.current.get(record.parentId);
         shouldShowTooltip = sparentShowTooltipVal.subApprovalList.has(record.id);
         if(shouldShowTooltip){
          shouldShowTooltipText = sparentShowTooltipVal.subApprovalList.get(record.id);
          shouldShowTooltipText = shouldShowTooltipText ? shouldShowTooltipText.join('；'): ''
         }
        }
        return record.workItemName ? (
          <div
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              maxWidth: '100%'
            }}
          >
            <span 
              title={record.workItemName}
              style={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                maxWidth: '70px'
              }}
            >
              {record.workItemName}
            </span>
            {parentShowTooltip && shouldShowTooltip && (
              <Tooltip title={shouldShowTooltipText}>
                <InfoCircleFilled style={{ color: 'red', fontSize: '12px'}} />
              </Tooltip>
            )}
          </div>
        ) : (
          "--"
        );
  },
      // render: (_, record) => {
      //         // 检查当前记录的审批ID是否存在于指定数组中
      //         const shouldShowTooltip = approvalIdsArray.has(record.id);
      //         const shouldShowTooltipText = approvalIdsArray.get(record.id);
      //         return record.workItemName ? (
      //           <div
      //           >
      //             <span title={record.workItemName}>{record.workItemName}</span>
      //             {shouldShowTooltip && (
      //               <Tooltip title={shouldShowTooltipText}>
      //                 <InfoCircleFilled style={{ color: 'red', fontSize: '12px' }} />
      //               </Tooltip>
      //             )}
      //           </div>
      //         ) : (
      //           "--"
      //         );
      //   }
    },
    ...(props.showCustomField ? [{
      title: props.customFieldName,
      dataIndex: "customFieldValue",
      key: "customFieldValue",
      width: 140,
      ellipsis: true,
      render: (value) => {
        const displayValue = formatCustomFieldValue(value);
        return <span title={String(displayValue)}>{displayValue}</span>;
      },
    }] : []),
    {
      title: "登记对象",
      dataIndex: "workItemEntityId",
      key: "workItemEntityId",
      width: 200,
      ellipsis: true,
      render: (_, record) =>
        record.workItemEntityName ? (
          <Tooltip
            title={`${record.workItemEntityName}
              ${record.nodeName ? `/${record.nodeName}` : ""}
              ${record.taskName ? `/${record.taskName}` : ""}`}
          >
            <div
              className="link"
              style={{
                width: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                wordBreak: "break-all",
                verticalAlign: "middle",
              }}
              onClick={(e) => {
                e.stopPropagation();
                goWorkItemHref(record);
              }}
            >
              {record.workItemEntityName}
              {record.nodeName ? `/${record.nodeName}` : ""}
              {record.taskName ? `/${record.taskName}` : ""}
            </div>
          </Tooltip>
        ) : (
          "--"
        ),
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD") : "--"),
    },
    {
      title: "登记工时",
      dataIndex: "actWorkHour",
      key: "actWorkHour",
      width: 100,
      align: "center",
      ellipsis: true,
      render: (_) => (_ ? _ + " 小时" : "--"),
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
      title: "已登记工时",
      dataIndex: "registeredWorkTime",
      key: "registeredWorkTime",
      ellipsis: true,
      width: 200,
      render: (_) => (_ ? _ : "--/--"),
    },
  ];

  useEffect(() => {
    if (props?.dataSource) {
      setDataSource(props?.dataSource);
    }
  }, [props?.dataSource]);

  return (
    <Table
      size="small"
      loading={loading}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{
        y: "calc((100vh - 400px)/2 - 20px)",
      }}
    />
  );
};

const ApprovalDetailsTable = (props) => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const columns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 80,
      ellipsis: true,
      render: (_, record, index) => index + 1,
    },
    {
      title: "审批阶段",
      dataIndex: "approvalStageName",
      key: "approvalStageName",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "处理人",
      dataIndex: "approvalName",
      key: "approvalName",
      width: 120,
      ellipsis: true,
      render: (_, record) => {
         if (record?.processingUserName === "自动通过") {
          return renderTableUserInfo(record.processingUserAvatarUrl, record.processingUserName);
        }
        return props.status === 1 && record.waitApprovalList && record.waitApprovalList.length > 0 ? (
          <div className="table-columns-item">
            {record.waitApprovalList[0].userKey ? (
              <UserTag 
                userId={record.waitApprovalList[0].userKey} 
                name={record.waitApprovalList[0].nameCn} 
                avatar={record.waitApprovalList[0].avatarUrl}
              />
            ) : (
              record.waitApprovalList[0].nameCn || "--"
            )}
            {record.waitApprovalList.length > 1 && (
              <Tooltip 
                className="custom-tooltip"
                placement="top" 
                title={
                  <div>
                    {record.waitApprovalList.slice(1).map((item, index) => (
                      <div key={item.userKey || index} style={{ marginBottom: 4 }}>
                        {item.userKey ? (
                          <UserTag 
                            userId={item.userKey} 
                            name={item.nameCn} 
                            avatar={item.avatarUrl}
                          />
                        ) : (
                          item.nameCn
                        )}
                      </div>
                    ))}
                  </div>
                }
              >
                <span className="wait-approval-count">+{record.waitApprovalList.length - 1}</span>
              </Tooltip>
            )}
          </div>
        ):
        (<div className="table-columns-item">
          {record.processingUserKey ? <UserTag userId={record.processingUserKey} name={record.processingUserName} avatar={record.processingUserAvatarUrl}/> : ""}
        </div>)
        }
    },
    {
      title: "审批结果",
      dataIndex: "approvalResult",
      key: "approvalResult",
      width: 120,
      ellipsis: true,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "审批意见",
      dataIndex: "approvalOpinion",
      key: "approvalOpinion",
      width: 180,
      ellipsis: true,
      render: (_) =>
        _ ? (
          <Tooltip placement="top" title={_}>
            {_}
          </Tooltip>
        ) : (
          "--"
        ),
    },
    {
      title: "审批时间",
      dataIndex: "approvalTime",
      key: "approvalTime",
      width: 180,
      ellipsis: true,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
  ];

  useEffect(() => {
    setDataSource(props?.dataSource);
  }, [props?.dataSource]);

  return (
    <Table
      size="small"
      loading={loading}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{
        y: "calc((100vh - 400px)/2 - 20px)",
      }}
    />
    
  );
};

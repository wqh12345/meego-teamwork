import React, { useState, useEffect, useRef } from "react";
import { Calendar, Cascader, Modal, Popup } from "antd-mobile";
import { Table, Button, Space, message, Avatar } from "antd";
import {
  CalendarOutlined,
  SwapRightOutlined,
  UserOutlined,
  CloseOutlined,
  InfoCircleFilled,
} from "@ant-design/icons";
import {
  isHasMore,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  isNumber
} from "../../../../util/util";
import {
  getWorkItemOption,
  getItemEntityOption,
  getEntityNodeOption,
  postQueryNodeWorkHour,
  postDeleteNodeWorkHour,
} from "../../../../api/api";
import "./index.less";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
import { calc } from "antd/es/theme/internal";
import noDataTab from "../../../../image/no-data-table.png";
dayjs.extend(customParseFormat);

const MbLog = () => {
  const scrollableRef = useRef(null);
  const windowRef = useRef(null);
  const [lastScrollTop, setLastScrollTop] = useState(0);
  const [beginTime, setBeginTime] = useState(getFirstDayOfNaturalMonth);
  const [endTime, setEndTime] = useState(getLastDayOfNaturalMonth);
  const [startDate, setStartDate] = useState(getFirstDayOfNaturalMonth);
  const [endDate, setEndDate] = useState(getLastDayOfNaturalMonth);
  const [workItemOption, setWorkItemOption] = useState([]);
  const [workItem, setWorkItem] = useState([]);
  const [workItemName, setWorkItemName] = useState("");
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [workItemCascaderVisible, setWorkItemCascaderVisible] = useState(false);
  const [workItemLoading, setWorkItemLoading] = useState(false);
  const [isProductListMore, setIsProductListMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [logList, setLogList] = useState({
    nodeWorkHours: [],
    total: 0,
    pageNo: 1,
    pageSize: 10,
  });
  const [logPagination, setLogPagination] = useState({
    current: 1,
    pageSize: 10,
  });
  const [currItem, setCurrItem] = useState({});
  const onDelLogClick = async (item) => {
    const result = await Modal.confirm({
      content: "您即将删除该条记录，此操作不可撤销。",
    });
    if (result) {
      const data = {
        id: item.id,
        taskHourId: item.taskHourId
      };
      const res = await postDeleteNodeWorkHour(data);
      if (res?.result) {
        fetchData();
        message.success("删除成功");
      }
    }
  };
  const onEditLogClick = (item) => {
    setCurrItem(item);
    setIsRegistrationOpen(true);
  };

  /** 获取工时日志列表 */
  const fetchData = async () => {
    if (isProductListMore) {
      const data = {
        workItemId,
        workItemEntityId,
        nodeId,
        startDate: beginTime + " 00:00:00",
        endDate: endTime + " 23:59:59",
        pageNo: logPagination.current,
        pageSize: logPagination.pageSize,
      };
      const res = await postQueryNodeWorkHour(data);
      if (res?.result) {
        if (logPagination.current === 1) {
          setLogList(res.data);
        } else {
          const nodeWorkHours = logList.nodeWorkHours.concat(
            res.data.nodeWorkHours
          );
          res.data.nodeWorkHours = nodeWorkHours;
          setLogList(res.data);
        }
        setLogPagination({
          current: res.data.pageNo,
          pageSize: res.data.pageSize,
        });
        if (!res.data.total) {
          setIsProductListMore(false);
        }
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify([beginTime, endTime]), workItem]);

  useEffect(() => {
    fetchWorkItemOptionData();
  }, []);

  /** 获取工作项 */
  const fetchWorkItemOptionData = async () => {
    const res = await getWorkItemOption();
    if (res?.result) {
      setWorkItemOption(res.data);
    }
  };

  /** 获取工作项实例 */
  const fetchItemEntityOptionData = async (workItemKey) => {
    const data = {
      workItemKey,
    };
    const res = await getItemEntityOption(data);
    if (res?.result && res.data?.length) {
      for (const item of res.data) {
        item.isLeaf = false;
      }
      return res.data;
    }
  };

  /** 获取工作项实例节点 */
  const fetchEntityNodeOptionData = async (workItemKey, entityId) => {
    const data = {
      workItemKey,
      entityId,
    };
    const res = await getEntityNodeOption(data);
    if (res?.result && res.data?.length) {
      return res.data;
    }
  };

  /** 工作项改变 */
  const onWorkItemSelect = (val, extend) => {
    loadData(extend.items);
  };
  const onWorkItemConfirm = (val, extend) => {
    if (val.length === 3) {
      setLogPagination({
        current: 1,
        pageSize: 10,
      });
      setWorkItem(val);
      setWorkItemId(val[0]);
      setWorkItemEntityId(val[1]);
      setNodeId(val[2]);
      setWorkItemCascaderVisible(false);
      let name = "";
      workItemOption.filter((item) => {
        if (item.value === val[0]) {
          name = item.label;
          item.children.filter((entity) => {
            if (entity.value === val[1]) {
              name += `/${entity.label}`;
              entity.children.filter((node) => {
                if (node.value === val[2]) {
                  name += `/${node.label}`;
                  setWorkItemName(name);
                }
              });
            }
          });
        }
      });
      for (const item of workItemOption) {
        if (item.value === val[0]) {
          name = item.label;
        }
      }
      return;
    }
    setWorkItemCascaderVisible(false);
  };

  /** 时间改变 */
  const onTimeVisibleOpen = () => {
    setStartDate(beginTime);
    setEndDate(endTime);
    setCalendarPickerVisible(true);
  };
  const onTimeChange = (date) => {
    setStartDate(dayjs(date[0]).format("YYYY-MM-DD"));
    setEndDate(dayjs(date[1]).format("YYYY-MM-DD"));
  };
  const onTimeConfirm = () => {
    setLogPagination({
      current: 1,
      pageSize: 10,
    });
    setBeginTime(startDate);
    setEndTime(endDate);
    setCalendarPickerVisible(false);
  };

  /** 动态加载工作项 */
  const loadData = (selectedOptions) => {
    switch (selectedOptions.length) {
      case 1:
        setWorkItemLoading(true);
        fetchItemEntityOptionData(
          selectedOptions[selectedOptions.length - 1].value
        )
          .then((res) => {
            if (res?.result) {
              selectedOptions[selectedOptions.length - 1].children = res;
              setWorkItemId(selectedOptions[selectedOptions.length - 1].value);
            } else {
              selectedOptions[selectedOptions.length - 1].isLeaf = true;
              setWorkItemId(selectedOptions[selectedOptions.length - 1].value);
              setWorkItem([selectedOptions[selectedOptions.length - 1].value]);
            }
            setWorkItemOption([...workItemOption]);
            setWorkItemLoading(false);
          })
          .catch(() => {
            setWorkItemLoading(false);
          });
        break;
      case 2:
        setWorkItemLoading(true);
        fetchEntityNodeOptionData(
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value
        )
          .then((res) => {
            if (res?.result) {
              selectedOptions[selectedOptions.length - 1].children = res;
            } else {
              selectedOptions[selectedOptions.length - 1].isLeaf = true;
              setWorkItemEntityId(
                selectedOptions[selectedOptions.length - 1].value
              );
              setWorkItem([
                workItemId,
                selectedOptions[selectedOptions.length - 1].value,
              ]);
            }
            setWorkItemOption([...workItemOption]);
            setWorkItemLoading(false);
          })
          .catch(() => {
            setWorkItemLoading(false);
          });
        break;
      default:
        break;
    }
  };

  /** 变更数据（提交+修改） */
  const onRegistrationOk = async (result) => {
    if (result) {
      fetchData();
    }
    setIsRegistrationOpen(false);
  };

  /** 网页滚动条纵坐标的位置 */
  const getScrollTop = () => {
    let scrollTop = 0,
      bodyScrollTop = 0,
      documentScrollTop = 0;
    const logContent = document.getElementById("logContent");
    if (logContent) {
      bodyScrollTop = logContent.scrollTop;
    }
    if (document.documentElement) {
      documentScrollTop = document.documentElement.scrollTop;
    }
    scrollTop =
      bodyScrollTop - documentScrollTop > 0 ? bodyScrollTop : documentScrollTop;
    return scrollTop;
  };

  /** 网页的总高度 */
  const getScrollHeight1 = () => {
    let scrollHeight = 0,
      bodyScrollHeight = 0,
      documentScrollHeight = 0;
    const logContent = document.getElementById("logContent");
    if (logContent) {
      bodyScrollHeight = logContent.scrollHeight;
    }
    if (windowRef) {
      documentScrollHeight = windowRef.current?.scrollHeight;
    }
    scrollHeight =
      bodyScrollHeight - documentScrollHeight > 0
        ? bodyScrollHeight
        : documentScrollHeight;
    return scrollHeight;
  };

  /** 网页可见区域高 */
  const getWindowHeight1 = () => {
    const logContent = document.getElementById("logContent");
    let windowHeight = 0;
    if (windowRef) {
      windowHeight = windowRef.current?.clientHeight;
    } else {
      windowHeight = logContent.clientHeight;
    }
    return windowHeight;
  };

  const handleScroll = () => {
    if (scrollableRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollableRef.current;
      // 检查是否已经滚动到底部
      if (scrollTop + clientHeight >= scrollHeight - 5 && isProductListMore) {
        // 减5是为了避免精确计算的误差
        // 加载更多数据的逻辑
        logPagination.current++;
        setLogPagination(logPagination);
      }
    }
  };

  useEffect(() => {
    if (
      logPagination.current > 1 &&
      logPagination.current <= Math.ceil(logList.total / logList.pageSize)
    ) {
      fetchData();
    }
  }, [JSON.stringify(logPagination)]);

  useEffect(() => {
    const element = scrollableRef.current;
    element.addEventListener("scroll", handleScroll);
    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, []); // 空数组意味着仅在组件挂载时添加一次监听器

  return (
    <div className="mb-log-warp" ref={windowRef}>
      <div className="log-top">
        <div className="top-item">
          <span className="top-item-txt">时间范围</span>
          <span
            className="top-item-btn"
            style={{ paddingRight: 35 }}
            onClick={onTimeVisibleOpen}
          >
            {beginTime}
            <SwapRightOutlined style={{ margin: "0 10px", color: "#BBBBBB" }} />
            {endTime}
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
            visible={calendarPickerVisible}
            onMaskClick={() => setCalendarPickerVisible(false)}
            onClose={() => setCalendarPickerVisible(false)}
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
                value={[new Date(startDate), new Date(endDate)]}
                selectionMode="range"
                onChange={onTimeChange}
              />
            </div>
            <div className="popup-footer">
              <Button
                className="confirm-btn"
                onClick={() => setCalendarPickerVisible(false)}
              >
                取消
              </Button>
              <Button
                className="confirm-btn"
                type="primary"
                onClick={onTimeConfirm}
              >
                确认
              </Button>
            </div>
          </Popup>
        </div>
        <div className="top-item">
          <span className="top-item-txt">登记对象</span>
          <span
            className="top-item-btn"
            onClick={() => {
              setWorkItemCascaderVisible(true);
            }}
          >
            {workItem.length ? (
              workItemName
            ) : (
              <span style={{ color: "#BBBBBB" }}>请选择</span>
            )}
          </span>
          <Cascader
            size="small"
            loading={workItemLoading}
            visible={workItemCascaderVisible}
            options={workItemOption}
            value={workItem}
            onSelect={onWorkItemSelect}
            onConfirm={onWorkItemConfirm}
            onCancel={() => {
              setWorkItem([]);
              setWorkItemId("");
              setWorkItemEntityId("");
              setNodeId("");
              setWorkItemCascaderVisible(false);
            }}
            onClose={() => {
              setWorkItemCascaderVisible(false);
            }}
          />
          <Button
            size="small"
            type="primary"
            onClick={() => {
              setCurrItem(false);
              setIsRegistrationOpen(true);
            }}
          >
            工时登记
          </Button>
        </div>
      </div>
      <div className="log-content" ref={scrollableRef}>
        {logList.nodeWorkHours.length ? (
          logList.nodeWorkHours.map((item, index) => {
            return (
              <div key={index} className="record-item-box">
                <div className="item-label">
                  <div>工作项</div>
                  <div className="item-value">{item.workItemName}</div>
                </div>
                <div className="item-label">
                  <div>工作项实例</div>
                  <div className="item-value">{item.workItemEntityName}</div>
                </div>
                <div className="item-label">
                  <div>登记对象</div>
                  <div className="item-value">{item.nodeName}</div>
                </div>
                <div className="item-label">
                  <div>排期</div>
                  <div className="item-value">
                    {item.scheduleDate_start && item.scheduleDate_end
                      ? `${dayjs(item.scheduleDate_start).format("YYYY-MM-DD")}~
              ${dayjs(item.scheduleDate_end).format("YYYY-MM-DD")}`
                      : "--"}
                  </div>
                </div>
                <div className="item-label">
                  <div>预估工时</div>
                  <div className="item-value">
                    {item.eval_day !== null && item.eval_hour !== null
                      ? `${item.eval_hour}小时（${
                          isNumber(item.eval_day)
                            ? item.eval_day.toFixed(2)
                            : item.eval_day
                        }人天）`
                      : "--"}
                  </div>
                </div>
                <div className="item-label">
                  <div>实际工时</div>
                  <div className="item-value">
                    {item.act_hour !== null && item.act_day !== null
                      ? `${item.act_hour}小时（${
                          isNumber(item.act_day)
                            ? item.act_day.toFixed(2)
                            : item.act_day
                        }人天）`
                      : "--"}
                  </div>
                </div>
                <div className="item-label">
                  <div>登记对象</div>
                  <div className="item-value">
                    {dayjs(item.workDate).format("YYYY-MM-DD")}
                  </div>
                </div>
                <div className="opt-box">
                  <div
                    className="del-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      onDelLogClick(item);
                    }}
                  >
                    删除
                  </div>
                  <div
                    className="edit-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      onEditLogClick(item);
                    }}
                  >
                    编辑
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-data">
            <img className="no-data-img" src={noDataTab} alt="" />
            <div className="no-data-txt">暂无数据</div>
          </div>
        )}
      </div>
      <Popup
        destroyOnClose
        showCloseButton
        visible={isRegistrationOpen}
        onMaskClick={() => setIsRegistrationOpen(false)}
        onClose={() => setIsRegistrationOpen(false)}
        bodyStyle={{
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          minHeight: "60vh",
          padding: "20px",
          boxSizing: "border-box",
        }}
      >
        <div className="popup-header">
          <span className="popup-title">
            {currItem.id ? "编辑工时日志" : "实际工时登记"}
          </span>
        </div>
        <div className="popup-content">
          <RegWorkHour
            type="mob"
            getRegistrationValue={onRegistrationOk}
            setRegistrationValue={currItem}
          />
        </div>
        <div className="popup-footer"></div>
      </Popup>
    </div>
  );
};

export default MbLog;

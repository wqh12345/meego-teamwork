import "./Gantt.less";
import "dhtmlx-gantt/codebase/skins/dhtmlxgantt_material.css";
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import dayjs from "dayjs";
import { gantt } from "dhtmlx-gantt";
import { UserTag } from '@lark-project/ui-kit-plugin';
import {
  Avatar,
  Button,
  Modal,
  Form,
  Input,
  message,
  Menu,
  Dropdown,
  Divider,
  Table,
  Space,
  Spin,
  Tooltip,
} from "antd";
import {
  UserOutlined,
  ExclamationCircleFilled,
  CloseOutlined,
  InfoCircleFilled,
} from "@ant-design/icons";
import { getOriginColumns, originColumns, zoomLevels, zoomMap, operationMenu } from "./config";
import {
  queryWorkItemAndWorkItemEntityV2,
  postWorkingHoursDetails,
  getStandWorkHour,
  postDeleteNodeWorkHour,
  getUserNumeralConfig,
  queryWorkItemEntityNodeAndTaskV2,
  postWorkHoursTotalDetail
} from "../../../../api/api";
import RegWorkHour from "../reg-workHour/RegWorkHour";
import {
  formatDateTime,
  timeStamp2Text,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  isNumber,
  goWorkItemHref,
} from "../../../../util/util";
import {
  formatCustomFieldValue,
  useTenantCustomFieldConfig,
} from '../../hooks/useTenantCustomFieldConfig';
import "./Gantt.less";
const formItemLayout = {
  labelCol: {
    span: 4,
  },
  wrapperCol: {
    span: 20,
  },
};

export default function Gantt(props) {
  // 使用 ref 保持对最新 props 的引用，避免 gantt 事件回调闭包捕获旧 props 导致 spaceIds 等 props 值失效
  const latestPropsRef = useRef(props);
  const [loading, setLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [curTask, setCurTask] = useState({});
  const ganttContainer = useRef();
  const [standWorkHour, setStandWorkHour] = useState(false);
  const [currItem, setCurrItem] = useState({});
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [config, setConfig] = useState({});
   // 「登记工时」列头图标需随升/降序切换，列数组按排序方向重建
  const [headerColumns, setHeaderColumns] = useState(() =>
    getOriginColumns(props.registerWorkingHoursSort),
  );
  const [taskDetail, setTaskDetail] = useState({
    workNodeName: "",
    scheduleDate: "",
    estimatedScore: "",
    registeredWorkTime: "",
    userName: "",
    avatarUrl: "",
    nodeWorkHours: [],
  });
  const {
    fieldName: customFieldName,
    showCustomField,
  } = useTenantCustomFieldConfig();
  const [detailList, setDetailList] = useState([]);
  const eventHandlers = useRef({
    onTaskOpened: null,
    onTaskClosed: null,
    onTaskDblClick: null,
    onTaskClick: null,
    onGanttRender: null,
  });
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const clickState = useRef({
    lastClickId: null,
    lastClickTime: 0,
    timer: null,
  });
  const [someCondition, setSomeCondition] = useState(true);
  const [isWorkHoursTotalOpen, setIsWorkHoursTotalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [workHoursTotalDetail, setWorkHoursTotalDetail] = useState({
    userKey: "",
    estimatedWorkingHours: "",
    registeredWorkingHours: "",
    workHoursData: []
  });
  useEffect(() => {
    registerLightBox();
    setGanttConfig();
    setDateMarker();
    setZooms();
    gantt.init(ganttContainer.current);
    getWorkHour();
    if (eventHandlers.current.onTaskClick) {
      gantt.detachEvent(eventHandlers.current.onTaskClick);
    }
    if (eventHandlers.current.onGanttRender) {
      gantt.detachEvent(eventHandlers.current.onGanttRender);
    }
    return () => {
      if (eventHandlers.current.onTaskClick) {
        gantt.detachEvent(eventHandlers.current.onTaskClick);
        eventHandlers.current.onTaskClick = null;
      }
      if (eventHandlers.current.onGanttRender) {
        gantt.detachEvent(eventHandlers.current.onGanttRender);
        eventHandlers.current.onGanttRender = null;
      }

      // 移除DOM事件监听器
      const dataArea = document.querySelector(".gantt_data_area");
      if (dataArea) {
        dataArea.removeEventListener("dblclick", handleDblClick);
      }
    };
  }, []);

  /** 查询组织标准工时 */
  async function getWorkHour() {
    const res = await getStandWorkHour();
    if (res?.result) {
      setStandWorkHour(res?.data?.standWorkHour);
    }
  }

  /** 查询设置 */
  const getConfig = async () => {
    const data = {
      type: "ONLY_CALCULATE_WORKING_DAYS",
    };
    const res = await getUserNumeralConfig(data);
    if (res?.result) {
      setConfig(res.data);
    }
  };

  // 自定义函数获取任务层级
  function getTaskLevel(taskId) {
    let level = 0;
    let task = gantt.getTask(taskId);
    while (task && task.parent) {
      level++;
      task = gantt.getTask(task.parent);
    }

    return level;
  }

  // 查看展开树的层级
  function expandToLevel(targetLevel, parentId = null) {
    gantt.eachTask(function (task) {
      if (parentId === null || task.parent === parentId) {
        const level = getTaskLevel(task.id);
        if (level < targetLevel) {
          gantt.open(task.id);
          // 递归展开子节点
          expandToLevel(targetLevel, task.id);
        } else {
          gantt.close(task.id);
        }
      }
    });
  }

  useEffect(() => {
    if (typeof standWorkHour === "boolean") return;
    registerLightBox();
    setGanttConfig();
    setDateMarker();
    setZooms();
    gantt.init(ganttContainer.current);
    if (props.tasks.data.length) {
      setDateMarker();
      const formatData = formatTask();
      gantt.clearAll();
      gantt.parse(formatData);
    }
  }, [standWorkHour]);

  useEffect(() => {
    setSomeCondition(true);
  }, [JSON.stringify(props.ganttUser.data)]);

  useEffect(() => {
    if (typeof standWorkHour === "boolean") return;
    if (props.tasks.data.length) {
      if (someCondition) {
        //
        setDateMarker();
        const formatData = formatTask();
        gantt.clearAll();
        gantt.parse(formatData);
      }
    }
  }, [
    JSON.stringify(props.tasks.data),
    JSON.stringify(props.leaveFlagByUserAndDate),
    someCondition,
  ]);

  useEffect(() => {
    setGanttConfig();
  }, [JSON.stringify(props.time)]);
  /**
   * 「登记工时」排序方向变化：重建列头（刷新图标状态）并重新解析已排序的数据后重绘。
   * 这里直接 parse 当前已排序的 props.tasks，绕过数据 effect 中的 someCondition 守卫，
   * 确保打开过工时详情弹窗后点击排序，成员行顺序依然会刷新；同时不触发任何接口请求。
   */
  useEffect(() => {
    if (typeof standWorkHour === "boolean") return;
    const nextColumns = getOriginColumns(props.registerWorkingHoursSort);
    setHeaderColumns(nextColumns);
    // gantt 尚未初始化完成时跳过，避免在实例就绪前调用渲染方法
    if (!ganttContainer.current || !gantt.$container) return;
    gantt.config.columns = nextColumns;
    if (props.tasks.data.length) {
      setDateMarker();
      const formatData = formatTask();
      gantt.clearAll();
      if (formatData && Array.isArray(formatData.data)) {
        gantt.parse(formatData);
      }
    }
    gantt.resetLayout();
    gantt.render();
  }, [props.registerWorkingHoursSort]);
  /** 获取任务详情 */
  const getTaskDetail = async (
    task,
    start_date,
    end_date,
    type = null,
    x,
    y
  ) => {
    setModalLoading(true)
    const workStartDate = new Date(start_date);
    const workEndDate = new Date(end_date);
    const data = {
      workItemId: task?.workItemId,
      workItemEntityId: task?.workItemEntityId,
      nodeId: task?.nodeId,
      startDate: workStartDate,
      endDate: workEndDate,
      userKey: task?.userKey,
      nodeDbId: task?.nodeDbId,
      taskId: task?.taskId,
      taskDbId: task?.taskDbId,
      type: type,
      tag: task?.tag,
    };
    const res = await postWorkingHoursDetails(data);
    if (res?.result) {
      setSomeCondition(false);
      res.data.workName = getObjectName(task);
      res.data = {
        ...res.data,
        ...data,
      };

      setTaskDetail(res.data);
      //  let timer = setTimeout(() => {
      //   clearTimeout(timer);
      //   gantt.scrollTo(x,y)
      // }, 50);
    }
    setModalLoading(false)
  };

  /** 拼接登记对象名称 */
  const getObjectName = (task) => {
    // console.log(props?.tasks?.data);
    // const tempData = props?.tasks?.data;
    const result = [];
    result.unshift(task?.projectName);
    const findObjectName = (parent) => {
      const item = gantt.getTask(parent);
      if (item) {
        if (!item?.isUser) result.unshift(item.projectName);
        if (item?.parent) findObjectName(item.parent);
      }
    };
    if (task?.parent) findObjectName(task?.parent);
    const objectName = result.join("/");
    return objectName;
  };
/**
   * 「登记工时」列头排序图标点击（由 config.js 中 label 的 onclick 调用）。
   * 通过 latestPropsRef 取最新回调，避免闭包捕获过期 props。
   */
  window.customToggleRegisterHoursSort = function () {
    const curProps = latestPropsRef.current;
    if (curProps?.onRegisterWorkingHoursSortChange) {
      curProps.onRegisterWorkingHoursSortChange();
    }
  };
  /** 甘特图左边-展开折叠事件 */
  window.customToggleTask = async function (id) {
    const task = gantt.getTask(id);
    if (task.open) {
      const children = gantt.getChildren(id);
      gantt.batchUpdate(() => {
        gantt.getTask(id).open = false;
        gantt.close(id);
        if (task.isUser && children) {
          children.forEach((childId) => {
            gantt.deleteTask(childId);
          });
        }
      });
    } else {
      gantt.open(id);
      gantt.getTask(id).open = true;
      let level = 0;
      let currentTask = gantt.getTask(id);
      while (currentTask.parent) {
        level++;
        currentTask = gantt.getTask(currentTask.parent);
      }
      if (level === 0) {
        try {
          const sPos = gantt.getScrollState();
          const posX = sPos.x;
          const posY = sPos.y;
          const workStartDate = new Date(props.time[0]);
          const workEndDate = new Date(props.time[1]);
          const data = {
            startDate: workStartDate,
            endDate: workEndDate,
            userKey: task?.userKey,
            staffId: task?.staffId,
          };
          const res = await queryWorkItemAndWorkItemEntityV2(data);
          if (res && res.data && res.data.length > 0) {
            res.data.forEach((i) => {
              i.projectNo = i.id;
              if (!i.type) {
                i.open = true;
              } else {
                i.open = false;
              }
            });
            gantt.batchUpdate(() => {
              res.data.forEach((child) => {
                gantt.addTask(child);
                const exists = props.tasks.data.some(
                  (item) => item.projectNo === child.projectNo
                );
                if (!exists) {
                  props.tasks.data.push(child);
                }
              });
              gantt.render();
              expandToLevel(2, id);
              gantt.open(id);
              gantt.scrollTo(posX, null);
            });
          } else {
            //message.error("获取节点数据时出错")
          }
        } catch (error) {
          console.error("获取数据时出错:", error);
        }
      } else if (level === 2) {
        try {
          const sPos = gantt.getScrollState();
          const posX = sPos.x;
          const posY = sPos.y;
          const workStartDate = new Date(props.time[0]);
          const workEndDate = new Date(props.time[1]);
          const data = {
            startDate: workStartDate,
            endDate: workEndDate,
            userKey: task?.userKey,
            staffId: task?.staffId,
            workItemEntityId: task?.workItemEntityId,
            workItemId: task?.workItemId,
          };
          const res = await queryWorkItemEntityNodeAndTaskV2(data);
          if (res && res.data && res.data.length > 0) {
            res.data.forEach((i) => {
              i.projectNo = i.id;
              if (!i.type) {
                i.open = true;
              } else {
                i.open = false;
              }
            });
            gantt.batchUpdate(() => {
              res.data.forEach((child) => {
                gantt.addTask(child);
                const exists = props.tasks.data.some(
                  (item) => item.projectNo === child.projectNo
                );
                if (!exists) {
                  props.tasks.data.push(child);
                }
              });
              gantt.render();
              expandToLevel(2, id);
              gantt.open(id);
              gantt.scrollTo(posX, null);
            });
          } else {
            //message.error("获取节点数据时出错")
          }
        } catch (error) {
          console.error("获取数据时出错:", error);
        }
      } else {
        gantt.open(id);
      }
    }
  };
  // 将数据处理成我们需要的集合
  const formatTask = () => {
    gantt.resetLayout();
    const tempData = props.tasks;
    const taskTree = {};
    if (!tempData.data.length) return;
    tempData.data.forEach((item) => {
      //item.id = `${item.projectNo}`;
      // if (item.nodeId && item.workItemId && item.workItemEntityId) {
      //   item.id = `${item.projectNo}-${item.workItemEntityId}-${item.workItemId}`;
      // }
      if (!item.workStartDate && !item.workEndDate) {
        item.unscheduled = true;
      } else {
        item.start_date = new Date(
          `${dayjs(item.workStartDate).format("YYYY-MM-DD")} 00:00:00`
        );
        item.end_date = new Date(
          `${dayjs(item.workEndDate).format("YYYY-MM-DD")} 24:00:00`
        );
      }

      // 自定义内容进度上的文本
      gantt.templates.task_text = function (start, end, task) {
        return "";
        //return task.projectName;
      };

      gantt.templates.timeline_cell_content = function (task, date) {
        if (task.isUser) {
          let text = 1;
          let isWorkDay = false;
          let userWorkNumEveryDay = '';
          const currentDate = timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd");
          const hasLeave = props.leaveFlagByUserAndDate?.[task.userKey]?.[currentDate] === true;
          (task.userEnterWorkTime || []).forEach((item1) => {
            if (
              item1.everyDate ===
              currentDate
            ) {
              text = item1.saturability;
              isWorkDay=item1.isHoliday
              userWorkNumEveryDay=item1.userWorkNumEveryDay
            }
          });
          const hasWorkHours = userWorkNumEveryDay && userWorkNumEveryDay>0;
          const workHoursHtml = hasWorkHours
            ? `<span class="gantt-cell-work-hours">${userWorkNumEveryDay}</span>`
            : '';
          const leaveHtml = hasLeave
            ? '<span class="gantt-cell-leave-flag">请假</span>'
            : '';
          //date.getDay() === 6 || date.getDay() === 0
          if (isWorkDay) {
            let dayOffStatusHtml ='';
             dayOffStatusHtml = `<div class="gantt-chat-cell-date gantt-day-off">${workHoursHtml}${leaveHtml}`;
             if (text === 0) {
                dayOffStatusHtml=dayOffStatusHtml+`<span class="work-item-saturation"></span></div>`;
                return dayOffStatusHtml
             } else if (text > 0 && text <= 50) {
               dayOffStatusHtml=dayOffStatusHtml+`<span class="work-item-saturation work-low-saturation"></span></div>`;
               return dayOffStatusHtml
             } else if (text > 50 && text <= 100) {
               dayOffStatusHtml=dayOffStatusHtml+`<span class="work-item-saturation work-saturation"></span></div>`;
               return dayOffStatusHtml
             } else{
                dayOffStatusHtml=dayOffStatusHtml+`<span class="work-item-saturation work-supersaturation"></span></div>`;
                return dayOffStatusHtml
             } 
          }
          if (text || hasLeave) {
            if (text === 0 || !text) {
              return `<div class="gantt-chat-cell-date work-feel-status">${workHoursHtml}${leaveHtml}</div>`;
            } else if (text > 0 && text <= 50) {
              return `<div class="gantt-chat-cell-date work-low-saturation">${workHoursHtml}${leaveHtml}</div>`;
            } else if (text > 50 && text <= 100) {
              return `<div class="gantt-chat-cell-date work-saturation">${workHoursHtml}${leaveHtml}</div>`;
            } else {
              return `<div class="gantt-chat-cell-date work-supersaturation">${workHoursHtml}${leaveHtml}</div>`;
            }
          }
        } else {
          if (task.open) {
            if (
              task.expandRegistrationDateArr &&
              task.expandRegistrationDateArr.length > 0
            ) {
              let obj2025 = task.expandRegistrationDateArr.find((i) => {
                return (
                  timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd") ==
                  i.registrationDate
                );
              });
              if (obj2025) {
                return `<div class="gantt_task_pr"  data-date="${obj2025.registrationDate}"><div style="display: flex;justify-content: center;align-items: center;background:#0047FF;color:#ffffff;border-radius:16px;height:30px;width: 90%;">${obj2025.serWorkNumEveryDay}</div></div>`;
              }
            }
          } else {
            if (
              task.foldRegistrationDateArr &&
              task.foldRegistrationDateArr.length > 0
            ) {
              let obj2026 = task.foldRegistrationDateArr.find((i) => {
                return (
                  timeStamp2Text(new Date(date).getTime(), "yyyy-MM-dd") ==
                  i.registrationDate
                );
              });
              if (obj2026) {
                return `<div class="gantt_task_pr" data-date="${obj2026.registrationDate}"><div style="display: flex;justify-content: center;align-items: center;background:#0047FF;color:#ffffff;border-radius:16px;height:30px;width: 90%;">${obj2026.serWorkNumEveryDay}</div></div>`;
              }
            }
          }
          // if (date.getDay() === 6 || date.getDay() === 0) {
          //   return `<div style="background:#eee;height: 100%;display: flex;justify-content: center;align-items: center;"></div>`;
          // }
        }
      };
    });
    return tempData;
  };

  // 注册自定义 任务弹出框
  const registerLightBox = () => {
    // 打开 弹出框事件

    gantt.showLightbox = (id) => {
      const task = gantt.getTask(id);
      return;
      // if ("workItemId" in task && "workItemEntityId" in task) {
      //   const task = gantt.getTask(id);
      //   setCurTask(task);
      //   let timer = setTimeout(() => {
      //     clearTimeout(timer);
      //     getTaskDetail(task);
      //   }, 50);

      //   // 设置默认值
      //   setIsDetailOpen(true);
      //   gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
      // } else {
      //   return;
      // }
    };

    // 关闭 弹出框事件
    // gantt.hideLightbox = () => {
    //   setIsDetailOpen(false);
    // };
  };

  const handleDblClick = (e) => {
    // 检查是否点击在任务单元格上
    const cell = e.target.closest(".gantt_task_cell");
    if (!cell) return;
    // 判断单元格是否存在子元素
    if (cell.children.length === 0) return;
    // 获取对应的任务行
    const row = cell.closest(".gantt_task_row");
    if (!row) return;
    // 获取任务ID
    const taskId = row.getAttribute("task_id");
    if (!taskId) return;
    // 获取任务数据
    const task = gantt.getTask(taskId);
    if (task.isUser) return;
    // 检查是否存在 class 名为 gantt_task_pr 的子元素
    const ganttTaskPr = cell.querySelector(".gantt_task_pr");
    if (!ganttTaskPr) return;

    // 获取 data-date 属性的值
    const dateValue = ganttTaskPr.getAttribute("data-date");
    if (!dateValue) return;
    let queryType = task.type;
    if (queryType) {
      queryType = task?.open ? task.type : null;
      const formattedDate = dayjs(dateValue).format("YYYY-MM-DD");
      setSomeCondition(false);
      setCurTask(task);
      getTaskDetail(task, formattedDate, formattedDate, queryType);
      setIsDetailOpen(true);
      // 使用batchUpdate保持操作原子性
      // gantt.batchUpdate(() => {
      //   setSomeCondition(false)
      //   setCurTask(task);
      //   getTaskDetail(task, formattedDate, formattedDate, queryType);
      //   setIsDetailOpen(true);
      // });
      // setCurTask(task);
      // let timer = setTimeout(() => {
      //   clearTimeout(timer);
      //   getTaskDetail(task,formattedDate,formattedDate,queryType);
      // }, 50);
      // // 设置默认值
      // setIsDetailOpen(true);
      //gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
    } else {
      const textConfig = {
        title: "提示信息",
        content: "工作项不支持查看工时详情",
        centered: true, // 使模态框水平垂直居中
        okText: "确认",
        onOk: () => {
          setIsModalVisible(false);
        },
      };
      if (!isModalVisible) {
        Modal.info(textConfig);
        setIsModalVisible(true);
      }
    }
  };

  // 设置甘特图的 基础配置
  const setGanttConfig = () => {
    if (eventHandlers.current.onTaskClick) {
      gantt.detachEvent(eventHandlers.current.onTaskClick);
    }
    if (eventHandlers.current.onGanttRender) {
      gantt.detachEvent(eventHandlers.current.onGanttRender);
    }
    // 设置甘特图开始时间
    gantt.config.start_date = new Date(`${props.time[0]} 0:0:0`);

    // 设置甘特图结束时间
    gantt.config.end_date = new Date(`${props.time[1]} 23:59:59`);

    // 允许显示超过时间刻度任务
    gantt.config.show_tasks_outside_timescale = true;

    // const dayFormat = function (date) {
    //   const weeks = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    //   if (date.getDay() === 6 || date.getDay() === 0) {
    //     return `<div style="background: #eee;">${
    //       weeks[dayjs(date).day()]
    //     }</div>`;
    //   }
    //   return `<div>${weeks[dayjs(date).day()]}</div>`;
    // };
    // gantt.config.subscales = [
    //   {
    //     unit: "year",
    //     step: 1,
    //     date: "%Y",
    //   },
    //   {
    //     unit: "day",
    //     step: 1,
    //     template: dayFormat,
    //   },
    // ];

    // 设置甘特图行高
    gantt.config.row_height = 40;

    // 设置甘特图语言
    gantt.i18n.setLocale("cn");

    // 设置甘特图适应高
    gantt.config.autosize = "y";

    // 在同一树级别内垂直重新排序任务
    gantt.config.order_branch = false;
    // 允许对整个甘特图内的任务进行重新排序
    gantt.config.order_branch_free = false;

    // 是否显示依赖连线
    gantt.config.show_links = false;

    // 点击表头可排序
    gantt.config.sort = false;

    // 左侧项目拖拽
    gantt.config.drag_project = false;

    // 项目进度推拽
    gantt.config.drag_progress = false;

    // 界面初始化时展开图表树形结构
    gantt.config.open_tree_initially = true;

    // 设置进度条高度
    gantt.config.bar_height = 20;

    gantt.config.columns = headerColumns;

    // 禁止右侧时间工期 左右拖动
    gantt.config.drag_resize = false;

    // 配置不允许拖动列头
    gantt.config.drag_column_headers = false;
    gantt.plugins({
      marker: true,
    });
    // gantt.attachEvent("onGanttScroll", function (left, top){
    //   setScrollPosition(left)
    // });
    // gantt.attachEvent("onAfterTaskAdd", function(id, item) {
    //   gantt.scrollTo(scrollPosition, null);
    //   return true;
    // });
    // 初始化甘特图后添加双击事件监听
    const handleGanttRender = () => {
      const dataArea = document.querySelector(".gantt_data_area");
      // 先移除可能存在的旧监听器
      if (dataArea) {
        dataArea.removeEventListener("dblclick", handleDblClick);
        // 添加新监听器
        dataArea.addEventListener("dblclick", handleDblClick);
      }
    };
    gantt.attachEvent("onTaskRender", function (task, taskElement) {
      // 检查任务的开始时间和结束时间
      if (!task.start_date || !task.end_date) {
        // 如果任务没有设置开始或结束时间，不渲染任务轴
        taskElement.style.display = "none";
      }
    });

    // gantt.attachEvent("onBeforeTaskDrag", function (id, mode, e) {
    //   // 如果返回 false，则拖拽将被阻止
    //   return false; // 确保返回 true 以允许拖拽
    // });
    // 监听单击事件
    // const handleTaskClick = async (id, e) => {
    //   e.stopPropagation();
    //   const target = e.target;
    //   const task = gantt.getTask(id);
    //   if (task.isUser) {
    //     const now = Date.now();
    //     const state = clickState.current;

    //     // 双击检测（300ms内点击相同任务）
    //     if (
    //       state.lastClickId === task.id &&
    //       now - state.lastClickTime < 300
    //     ) {
    //       clearTimeout(state.timer);
    //       state.timer = null;
    //       setCurTask(task);
    //       let timer = setTimeout(() => {
    //         setSomeCondition(false);
    //         clearTimeout(timer);
    //         getWorkHoursTotalDetail(task, props.time[0], props.time[1]);
    //       }, 50);
    //       // 设置默认值
    //       setIsWorkHoursTotalOpen(true);
    //       return;
    //     }
    //     // 记录点击状态
    //     state.lastClickId = task.id;
    //     state.lastClickTime = now;
    //   } else {
    //     if (!target.classList.contains("gantt_tree_icon")) {
    //       //const taskId = gantt.getTask(id);
    //       const now = Date.now();
    //       const state = clickState.current;

    //       // 双击检测（300ms内点击相同任务）
    //       if (
    //         state.lastClickId === task.id &&
    //         now - state.lastClickTime < 300
    //       ) {
    //         if (task.isUser || !task.type) return;
    //         clearTimeout(state.timer);
    //         state.timer = null;
    //         setCurTask(task);
    //         let timer = setTimeout(() => {
    //           setSomeCondition(false);
    //           clearTimeout(timer);
    //           getTaskDetail(task, props.time[0], props.time[1]);
    //         }, 50);
    //         // 设置默认值
    //         setIsDetailOpen(true);
    //         //gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
    //         return;
    //       }
    //       // 记录点击状态
    //       state.lastClickId = task.id;
    //       state.lastClickTime = now;
    //     } else {
    //       return;
    //     }
    //   }
    // };
    // 监听单击事件
    const handleTaskClick = async (id, e) => {
      e.stopPropagation();
      const target = e.target;
      const task = gantt.getTask(id);
      
      // 如果点击的是树图标，直接返回
      if (target.classList.contains("gantt_tree_icon")) return;

      const now = Date.now();
      const state = clickState.current;

      // 双击检测（300ms内点击相同任务）
      if (state.lastClickId === task.id && now - state.lastClickTime < 300) {
        clearTimeout(state.timer);
        state.timer = null;
        setCurTask(task);
        
        // 使用立即执行函数处理延迟逻辑
        (() => {
          const timer = setTimeout(() => {
            setSomeCondition(false);
            clearTimeout(timer);
            
            if (task.isUser) {
              getWorkHoursTotalDetail(task, props.time[0], props.time[1]);
              setIsWorkHoursTotalOpen(true);
            } else if (task.type) {
              getTaskDetail(task, props.time[0], props.time[1]);
              setIsDetailOpen(true);
            }
          }, 50);
        })();
        
        return;
      }

      // 记录点击状态
      state.lastClickId = task.id;
      state.lastClickTime = now;
    };
    /** 获取任务详情 */
    const getWorkHoursTotalDetail = async (
      task,
      start_date,
      end_date,
    ) => {
      try {
        setModalLoading(true)
  
        const data = {
          startDate: start_date,
          endDate:  end_date,
          userKey: task?.userKey
        };
        const res = await postWorkHoursTotalDetail(data);
      //   const res={
      //     "msg": "success",
      //     "code": 200,
      //     "data": {
      //         "workHoursData": [
      //             {
      
      //                 "estimatedWorkingHoursAll":null,
      //                 "estimatedWorkingHoursSelf":null,
      //                 "registeredWorkingHoursAll": "1.00小时(0.13人天)",
      //                 "registeredWorkingHoursSelf": null,
      //                 "scheduleEnd": null,
      //                 "scheduleStart": null,
      //                 "workItemEntityId": 5248365561,
      //                 "workItemEntityName": "点击查看详情",
      //                 "workItemId": "63f81c083ed7ed0aba39dce0",
      //                 "workItemName": "拍摄日报"
      //             }
      //         ],
      //         "estimatedWorkingHours": "--/32.00小时(4.00人天)",
      //         "registeredWorkingHours": "1.00小时(0.13人天)/1.00小时(0.13人天)"
      //     }
      // }
  
        if (res?.result) {
          setSomeCondition(false);
          // res.data.workName = getObjectName(task);
          res.data = {
            ...res.data,
            userKey:data.userKey
          };
          setWorkHoursTotalDetail(res.data);
        }
        setModalLoading(false)
      } catch (error) {
        setModalLoading(false)
        console.error("获取数据时出错:", error);
      }
      
    };
    eventHandlers.current.onTaskClick = gantt.attachEvent(
      "onTaskClick",
      handleTaskClick
    );
    eventHandlers.current.onGanttRender = gantt.attachEvent(
      "onGanttRender",
      handleGanttRender
    );
  };

  // 设置 时间标识线
  const setDateMarker = () => {
    const dateToStr = gantt.date.date_to_str(gantt.config.task_date);
    const today = new Date(new Date().setHours(0, 0, 0, 0)); // 获取当天零点的时间
    gantt.addMarker({
      start_date: today,
      css: "today",
      text: "今日",
      title: `Today: ${dateToStr(today)}`,
    });
  };

  // 设置 时间刻度范围 以及 时间刻度具体数值 以及 初始时间刻度
  const setZooms = () => {
    const zoomConfig = {
      levels: zoomLevels,
      // useKey: "ctrlKey",
      // trigger: "wheel",
      element: () => {
        return gantt.$root.querySelector(".gantt_task");
      },
    };

    gantt.ext.zoom.init(zoomConfig);
    gantt.ext.zoom.setLevel("day");
  };

  /** 删除任务详情 */
  const onDelDetailClick = (item) => {
    Modal.confirm({
      title: "确定删除？",
      icon: <ExclamationCircleFilled />,
      content: "您即将删除该条记录，此操作不可撤销。",
      closeIcon: <CloseOutlined />,
      okText: "确定",
      cancelText: "取消",
      async onOk() {
        const data = {
          id: item.id,
          taskHourId: item.taskHourId,
        };
        const res = await postDeleteNodeWorkHour(data);
        if (res?.result) {
          item.userKey = curTask.userKey;
          getTaskDetail(item);
          props.getDataChange(true);
          window.JSSDK.toast.success("删除成功");
        }
      },
      onCancel() {
        // window.JSSDK.toast.success('操作成功');
      },
    });
  };

  /** 编辑任务详情 */
  const onEditDetailClick = (item) => {
    item.userKey = curTask.userKey;
    setCurrItem(item);
    setIsRegistrationOpen(true);
  };
  const workHoursTotalDetailColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 50,
      render: (_, record, index) => index + 1,
    },
    {
      title: "工作项实例",
      dataIndex: "workItemName",
      key: "workItemName",
      width: 250,
      render: (_, record) => (
        <span className="user-total-workItem" title={`${record.workItemName || '--'}/${record.workItemEntityName || '--'}`}>
                {`${record.workItemName}/${record.workItemEntityName}`}
        </span>
      ),
    },
    ...(showCustomField ? [{
      title: (
        <span className="user-total-custom-field-title" title={customFieldName}>
          {customFieldName}
        </span>
      ),
      dataIndex: "customFieldValue",
      key: "customFieldValue",
      width: 180,
      ellipsis: true,
      render: (value) => {
        const displayValue = formatCustomFieldValue(value);
        return (
          <span className="user-total-custom-field-value" title={String(displayValue)}>
            {displayValue}
          </span>
        );
      },
    }] : []),
    {
      title: "排期",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 190,
      render: (_, record) => (
        <span style={{whiteSpace: 'nowrap'}}>
          {record.scheduleStart !== null && record.scheduleEnd !== null 
            ? `${record.scheduleStart}~${record.scheduleEnd}`
            : "--"}
        </span>
      ),  
    },
    {
      title: (
        <span>
          预估工时
          <Tooltip
            title={[
              "前者：指个人的预估工时，即当前「成员」在当前「登记对象」的「估分」",
              <br key="br1" />,
              "后者：指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」"
            ]}
          >
            <InfoCircleFilled style={{ marginLeft: 4, color: '#bbbbbb' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: "estimatedWorkingHours",
      key: "estimatedWorkingHours",
      width: 300,
      ellipsis:true,
      render: (_, record) => {
        if (record?.estimatedWorkingHoursSelfHour == null && record?.estimatedWorkingHoursAllHour == null) {
            return "--";
        } else {
            const estimatedWorkingHoursSelfHour= record?.estimatedWorkingHoursSelfHour?`${record.estimatedWorkingHoursSelfHour.toFixed(2)}小时`:"-"
            const estimatedWorkingHoursSelfDay= record?.estimatedWorkingHoursSelfDay?`(${record.estimatedWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
            const estimatedWorkingHoursAllHour= record?.estimatedWorkingHoursAllHour?`${record.estimatedWorkingHoursAllHour.toFixed(2)}小时`:"-"
            const estimatedWorkingHoursAllDay= record?.estimatedWorkingHoursAllDay?`(${record.estimatedWorkingHoursAllDay.toFixed(2)}人天)`:"-"
            return `${estimatedWorkingHoursSelfHour}${estimatedWorkingHoursSelfDay}/${estimatedWorkingHoursAllHour}${estimatedWorkingHoursAllDay}`
        }
      },  
    },
    {
      title: (
        <span>
          已登记工时
          <Tooltip
            title={[
              "前者：指个人已登记的总实际工时，即当前「成员」在当前「登记对象」已登记的总「实际工时」",
              <br key="br1" />,
              "后者：指当前工作项/节点/任务已登记的总实际工时，即当前「登记对象」已登记的总「实际工时」"
            ]}
          >
            <InfoCircleFilled style={{ marginLeft: 4, color: '#bbbbbb' }} />
          </Tooltip>
        </span>
      ),
      dataIndex: "registeredWorkingHours",
      key: "registeredWorkingHours",
      width: 300,
      ellipsis:true,
      render: (_, record) => {
        const registeredWorkingHoursSelf= record?.registeredWorkingHoursSelf || "--"
        const registeredWorkingHoursAll= record?.registeredWorkingHoursAll || "--"
        if (record?.registeredWorkingHoursSelfHour == null && record?.registeredWorkingHoursAllHour == null) {
          return "--";
        } else {
          const registeredWorkingHoursSelfHour= record?.registeredWorkingHoursSelfHour?`${record.registeredWorkingHoursSelfHour.toFixed(2)}小时`:"-"
          const registeredWorkingHoursSelfDay= record?.registeredWorkingHoursSelfDay?`(${record.registeredWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
          const registeredWorkingHoursAllHour= record?.registeredWorkingHoursAllHour?`${record.registeredWorkingHoursAllHour.toFixed(2)}小时`:"-"
          const registeredWorkingHoursAllDay= record?.registeredWorkingHoursAllDay?`(${record.registeredWorkingHoursAllDay.toFixed(2)}人天)`:"-"
          return `${registeredWorkingHoursSelfHour}${registeredWorkingHoursSelfDay}/${registeredWorkingHoursAllHour}${registeredWorkingHoursAllDay}`
        }
      },  
    }
  ];
  const detailColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 60,
      render: (_, record, index) => index + 1,
    },
    {
      title: "实际工时",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 120,
      render: (_, record) => {
        if (record.act_hour !== null && record.act_day !== null) {
          return `${record.act_hour}小时（${isNumber(record.act_day)
              ? record.act_day.toFixed(2)
              : record.act_day
            }人天）`;
        } else {
          return "--";
        }
      },
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 100,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      ellipsis: true,
      width: 150,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 170,
      render: (_) =>
        _ ? new Date(_).toLocaleString().replace(/\//g, "-") : "--",
    },
  ];

  const detailOwnerColumns = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 50,
      render: (_, record, index) => index + 1,
    },
    {
      title: "实际工时",
      dataIndex: "scheduleDate",
      key: "scheduleDate",
      width: 120,
      render: (_, record) => {
        if (record.act_hour !== null && record.act_day !== null) {
          return `${record.act_hour}小时（${isNumber(record.act_day)
              ? record.act_day.toFixed(2)
              : record.act_day
            }人天）`;
        } else {
          return "--";
        }
      },
    },
    {
      title: "工作日期",
      dataIndex: "workDate",
      key: "workDate",
      width: 100,
      render: (_) =>
        _ ? new Date(_).toLocaleDateString().replace(/\//g, "-") : "--",
    },
    {
      title: "工作描述",
      dataIndex: "workDesc",
      key: "workDesc",
      ellipsis: true,
      width: 150,
      render: (_) => (_ ? _ : "--"),
    },
    {
      title: "更新时间",
      dataIndex: "updateDate",
      key: "updateDate",
      width: 170,
      render: (_) => (_ ? dayjs(_).format("YYYY-MM-DD HH:mm:ss") : "--"),
    },
  ];

  /** 变更数据（提交+修改） */
  const onRegistrationOk = async (result) => {
    if (result) {
      getTaskDetail(currItem);
      props.getDataChange(true);
    }
    setIsRegistrationOpen(false);
  };

  const closeDetailModal = () => {
    setIsDetailOpen(false);
  };
  const closeWorkHoursTotalModal = () => {
    setIsWorkHoursTotalOpen(false)
    setWorkHoursTotalDetail({
      userKey: "",
      estimatedWorkingHours: "",
      registeredWorkingHours: "",
      workHoursData: []
    })
  }
  // 渲染成员工时汇总预估工时的方法
  const rendeEstimatedWorkingHours = () => {
    const { estimatedWorkingHoursAllHour,estimatedWorkingHoursAllDay,estimatedWorkingHoursSelfHour,estimatedWorkingHoursSelfDay} = workHoursTotalDetail
    const estimatedWorkingHoursSelfHourRe= estimatedWorkingHoursSelfHour?`${estimatedWorkingHoursSelfHour.toFixed(2)}小时`:"-"
    const estimatedWorkingHoursSelfDayRe= estimatedWorkingHoursSelfDay?`(${estimatedWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
    const estimatedWorkingHoursAllHourRe= estimatedWorkingHoursAllHour?`${estimatedWorkingHoursAllHour.toFixed(2)}小时`:"-"
    const estimatedWorkingHoursAllDayRe= estimatedWorkingHoursAllDay?`(${estimatedWorkingHoursAllDay.toFixed(2)}人天)`:"-"
    return `${estimatedWorkingHoursSelfHourRe}${estimatedWorkingHoursSelfDayRe}/${estimatedWorkingHoursAllHourRe}${estimatedWorkingHoursAllDayRe}`
  };
  // 渲染成员工时汇总已登记工时的方法
   const renderRegisteredWorkingHours = () => {
    const { registeredWorkingHoursAllHour,registeredWorkingHoursAllDay,registeredWorkingHoursSelfHour,registeredWorkingHoursSelfDay} = workHoursTotalDetail
    const registeredWorkingHoursSelfHourRe= registeredWorkingHoursSelfHour?`${registeredWorkingHoursSelfHour.toFixed(2)}小时`:"-"
    const registeredWorkingHoursSelfDayRe= registeredWorkingHoursSelfDay?`(${registeredWorkingHoursSelfDay.toFixed(2)}人天)`:"-"
    const registeredWorkingHoursAllHourRe= registeredWorkingHoursAllHour?`${registeredWorkingHoursAllHour.toFixed(2)}小时`:"-"
    const registeredWorkingHoursAllDayRe= registeredWorkingHoursAllDay?`(${registeredWorkingHoursAllDay.toFixed(2)}人天)`:"-"
    return `${registeredWorkingHoursSelfHourRe}${registeredWorkingHoursSelfDayRe}/${registeredWorkingHoursAllHourRe}${registeredWorkingHoursAllDayRe}`
  };
  return (
    <Spin spinning={loading}>
      <div className="gantt-warp">
        <div
          ref={(ref) => {
            ganttContainer.current = ref;
          }}
          style={{ width: "100%", height: "100%" }}
        />
        <div className="gantt-footer">
          <div className="footer-left">
            <div className="left-item" style={{ width: 240 }}>
              <span style={{ marginLeft: "25px" }}>合计（小时）：</span>
            </div>
            {headerColumns.map((item) => {
              if (item.originField === "registerWorkingHours")
                return (
                  <div
                    key={item.originField}
                    className="left-item foot-tj-num"
                    style={{ width: 90, textAlign: "center" }}
                  >
                    {props.tasks?.registerWorkingHoursTotal}
                  </div>
                );
              if (item.originField === "standardHumanDays")
                return (
                  <div
                    key={item.originField}
                    className="left-item foot-tj-num"
                    style={{ width: 80, textAlign: "center" }}
                  >
                    {props.tasks?.standardHumanDaysTotal}
                  </div>
                );
            })}
            <div className="left-item" style={{ width: 10 }}></div>
          </div>
          <div className="show-legend">
            <Space className="top-left">
              <span>
                工作饱和度
                <Tooltip
                  className="user-tooltip"
                  placement="bottom"
                  title={
                    <React.Fragment>
                      <div>饱和度说明： 饱和度（P） = 实际工时 / 个人标准工时</div>
                      <div>未填写： 未登记工时</div>
                      <div>低饱和： 0 &lt; P ≤ 50% </div>
                      <div>饱和： 50% &lt; P ≤ 100%</div>
                      <div>超饱和： P &gt; 100%</div>
                    </React.Fragment>
                  }
                >
                  <InfoCircleFilled className="saturation-tootip" />
                </Tooltip>
                ：
                </span>
                 <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#ffffff" }}
                ></span>
                <span className="ml-fu-3">未填写</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#FFD2DC" }}
                ></span>
                <span className="ml-fu-3">低饱和</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#FF83A2" }}
                ></span>
                <span className="ml-fu-3">饱和</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#F0144A" }}
                ></span>
                <span className="ml-fu-3">超饱和</span>
              </Space>
              <Space className="top-left-item">
                <span
                  className="color-icon"
                  style={{ background: "#eee" }}
                ></span>
                <span className="ml-fu-3">休息日</span>
              </Space>
            </Space>
          </div>
        </div>

        <Modal
          title="工时详情"
          open={isDetailOpen}
          onCancel={closeDetailModal}
          width={"745px"}
          footer={null}
          style={{ top: 200 }}
        >
          <Spin spinning={modalLoading}>
            <Form className="gantt-detail-form">
              <Form.Item style={{ marginBottom: 0 }} label="登记对象：">
                {taskDetail?.workName ? (
                  <span
                    onClick={() => goWorkItemHref(taskDetail)}
                    style={{ cursor: "pointer", color: "#4247f6" }}
                  >
                    {taskDetail.workName}
                  </span>
                ) : (
                  "--"
                )}
              </Form.Item>
              {showCustomField && (
                <Form.Item
                  style={{ marginBottom: 0 }}
                  label={`${customFieldName}：`}
                >
                  {formatCustomFieldValue(taskDetail?.customFieldValue)}
                </Form.Item>
              )}
              <Form.Item style={{ marginBottom: 0 }} label="排期：">
                <Input
                  value={taskDetail.scheduleDate ? taskDetail.scheduleDate : "--"}
                  className="rel-input"
                  disabled
                />
              </Form.Item>
              <Form.Item
                style={{ marginBottom: 0 }}
                label={
                  <div className="form-item-label">
                    <span className="label-txt">预估工时</span>
                    <Tooltip
                      title={
                        <>
                          <div>
                            前者：指个人的预估工时，即当前「成员」在当前「登记对象」的「估分」
                          </div>
                          <div>
                            后者：指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」
                          </div>
                        </>
                      }
                    >
                      <InfoCircleFilled className="label-icon" />
                    </Tooltip>
                  </div>
                }
              >
                <Input
                  value={
                    taskDetail.estimatedWorkingHours
                      ? taskDetail.estimatedWorkingHours
                      : "--/--"
                  }
                  className="rel-input"
                  disabled
                />
              </Form.Item>
              <Form.Item
                style={{ marginBottom: 0 }}
                label={
                  <div className="form-item-label">
                    <span className="label-txt">已登记工时</span>
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
                      <InfoCircleFilled className="label-icon" />
                    </Tooltip>
                  </div>
                }
              >
                <Input
                  value={
                    taskDetail.registeredWorkingHours
                      ? taskDetail.registeredWorkingHours
                      : "--/--"
                  }
                  className="rel-input"
                  disabled
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 10 }} label="成员" name="act">
                <div className="table-columns-item">
                  {/* <Avatar
                    src={taskDetail.avatarUrl}
                    size={20}
                    icon={<UserOutlined />}
                  />
                  <div className="table-columns-item-right">
                    <div className="right-name">
                      {taskDetail.userName ? taskDetail.userName : "--"}
                    </div>
                  </div> */}
                  {taskDetail.userKey && taskDetail.userKey!='0'? <UserTag userId={taskDetail.userKey} /> : taskDetail.userKey=='0'?taskDetail.userName:'--'}
                </div>
              </Form.Item>
            </Form>
            <Table
              size="small"
              scroll={{
                x: 650,
                y: 300,
              }}
              pagination={false}
              columns={props.type === 0 ? detailColumns : detailOwnerColumns}
              dataSource={taskDetail.nodeWorkHours}
            />
          </Spin>
        </Modal>
        <Modal
          title="成员工时汇总"
          open={isWorkHoursTotalOpen}
          onCancel={closeWorkHoursTotalModal}
          width={"900px"}
          footer={null}
          style={{ top: 200 }}
        >
          <Spin spinning={modalLoading}>
          <Form className="gantt-detail-form">
            <Form.Item style={{ marginBottom: 10 }} label="成员" name="act">
              <div className="table-columns-item">
                {workHoursTotalDetail.userKey?<UserTag userId={workHoursTotalDetail.userKey}/>:null}
              </div>
            </Form.Item>
            <Form.Item
              style={{ marginBottom: 0 }}
              label={
                <div className="form-item-label">
                  <span className="label-txt">预估工时</span>
                  <Tooltip
                    title={
                      <>
                        <div>
                          前者：指个人的预估工时，即当前「成员」在当前「登记对象」的「估分」
                        </div>
                        <div>
                          后者：指当前工作项/节点/任务的总预估工时，即当前的「登记对象」的总「估分」
                        </div>
                      </>
                    }
                  >
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              <Input
                value={
                  rendeEstimatedWorkingHours()
                }
                className="rel-input"
                disabled
              />
            </Form.Item>
            <Form.Item
              style={{ marginBottom: 10 }}
              label={
                <div className="form-item-label">
                  <span className="label-txt">已登记工时</span>
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
                    <InfoCircleFilled className="label-icon" />
                  </Tooltip>
                </div>
              }
            >
              <Input
                value={
                  renderRegisteredWorkingHours()
                }
                className="rel-input"
                disabled
              />
            </Form.Item>

          </Form>
          <Table
            size="small"
            scroll={{
              x: 'max-content',
              y: 300,
            }}
            pagination={false}
            columns={workHoursTotalDetailColumns}
            dataSource={workHoursTotalDetail.workHoursData}
          />
          </Spin>
        </Modal>
        <Modal
          destroyOnClose
          title={currItem.id ? "编辑工时日志" : "实际工时登记"}
          open={isRegistrationOpen}
          onCancel={() => setIsRegistrationOpen(false)}
          width={"745px"}
          footer={null}
        >
          <RegWorkHour
            type="web"
            getRegistrationValue={onRegistrationOk}
            setRegistrationValue={currItem}
          />
        </Modal>
      </div>
    </Spin>
  );
}

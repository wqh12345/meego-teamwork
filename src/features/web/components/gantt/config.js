import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";
import listIcon from "../../../../image/list-icon.png";
import taskIcon from "../../../../image/cj.png";
import upIcon from "../../../../image/up.png";
import downIcon from "../../../../image/down.png";
import taskIcon2 from "../../../../image/task.png";
import nodeIcon from "../../../../image/node.png";
import workItemEntityIcon from "../../../../image/workItemEntity.png";
import workItemIcon from "../../../../image/workItem.png";
// 「登记工时」列头排序图标路径：上三角（升序）/ 下三角（降序）
const SORT_ARROW_PATH = {
  up: 'M512 96 292 416h440L512 96z',
  down: 'M512 928 732 608H292l220 320z'
};

/**
 * 生成「登记工时」列头：文字 + 升降序切换图标（点击调用 window.customToggleRegisterHoursSort）。
 * 上下两条箭头常驻显示，不隐藏：默认两条灰色；升序时上箭头蓝色、下箭头灰色；降序时下箭头蓝色、上箭头灰色。
 */
const generateRegisterHoursLabel = (sortDirection) => {
  const direction = sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : '';
  const upActive = direction === 'asc' ? ' is-active' : '';
  const downActive = direction === 'desc' ? ' is-active' : '';
  const iconSvg = `<svg class="register-hours-sort-svg" viewBox="0 0 1024 1024" width="16" height="16" aria-hidden="true"><path class="register-hours-sort-arrow${upActive}" d="${SORT_ARROW_PATH.up}"/><path class="register-hours-sort-arrow${downActive}" d="${SORT_ARROW_PATH.down}"/></svg>`;
  const tip = direction === 'asc' ? '当前升序，点击切换为降序' : direction === 'desc' ? '当前降序，点击切换为升序' : '';
  return `<span class="register-hours-sort-label" title="${tip}" onclick="event.stopPropagation(); window.customToggleRegisterHoursSort && window.customToggleRegisterHoursSort()">登记工时<span class="register-hours-sort-icon">${iconSvg}</span></span>`;
};
// 提取生成操作图标的函数
const generateOperationIcon = (task) => {
  if (task.haveIcon) {
      // 由于这是在HTML字符串中，我们需要使用图标对应的SVG内容
      const iconSvg = task.open ? 
        `<svg width="14" height="14" viewBox="0 0 1024 1024" fill="#666666"><path d="M840.4 300H183.6c-19.7 0-30.7 20.8-18.5 35l328.4 380.8c9.4 10.9 27.5 10.9 37 0L858.9 335c12.2-14.2 1.2-35-18.5-35z" /></svg>` :
        `<svg width="14" height="14" viewBox="0 0 1024 1024" fill="#666666"><path d="M765.7 486.8L314.9 134.7c-5.3-4.6-12.9-0.5-12.9 6.1v771.6c0 6.6 7.7 10.7 12.9 6.1l450.8-352.1c6-4.7 6-14.8 0-19.5z" /></svg>`;
      return `<span class="operate-icon" onclick="event.stopPropagation(); window.customToggleTask('${task.id}')">${iconSvg}</span>`;
  }
  return '';
};


// 提取生成通用 HTML 结构的函数
const generateCommonHtml = (task, hasIcon) => {
  const className = hasIcon ? 'select-item jd-workItem' : 'select-item jd-workItem jd-ml18';
  return `<div class="${className}"><span class="select-item-txt itme-flex-center" title="${task.projectName}">`;
};

// 提取生成用户任务 HTML 的函数
const generateUserTaskHtml = (task) => {
  const caozuoHtml = generateOperationIcon(task);
  const className = task.haveIcon ? 'select-item jd-workItem' : 'select-item jd-workItem jd-ml18';
  return `<div class="${className}">
            <span class="select-item-txt itme-flex-center">
            ${caozuoHtml}
            <img class="user-head" src='${task.avatarUrl}'>${task.projectName}</span>
          </div>`;
};

// 提取生成非用户任务 HTML 的函数
const generateNonUserTaskHtml = (task) => {
  const caozuoHtml = generateOperationIcon(task);
  const hasIcon = task.haveIcon;
  const commonHtml = generateCommonHtml(task, hasIcon);

  if (task.$level === 2 || task.$level === 3) {
     let iconSrc = workItemEntityIcon;
      if (task.$level === 3) {
          iconSrc = nodeIcon;
      }
      return `${commonHtml}${caozuoHtml}<img class="jd-list-icon" src='${iconSrc}'  onclick="event.stopPropagation(); window.customToggleTask('${task.id}')">${task.projectName}</span></div>`;
  } else if (task.$level === 1) {
      return `${commonHtml}${caozuoHtml}<img class="jd-task-icon" src='${workItemIcon}'>${task.projectName}</span></div>`;
  } else {
      return `${commonHtml}<img class="jd-task-icon" src='${taskIcon2}'>${task.projectName}</span></div>`;
  }
};
export const originColumns = [
  // {
  //   name: "add",
  //   width: 44,
  //   align: "center"
  // },
  // {
  //   type: null,
  //   name: "projectNo",
  //   originField: "projectNo",
  //   label: "任务序号",
  //   hide: true
  // },
  {
    type: "input",
    name: "projectName",
    originField: "projectName",
    tree: true,
    width: 240,
    min_width: 240,
    template(task) {
       return task.isUser ? generateUserTaskHtml(task) : generateNonUserTaskHtml(task);
    }
  },
  {
    "type": "input",
    "name": "registerWorkingHours",
    "originField": "registerWorkingHours",
    "label": generateRegisterHoursLabel(),
    "align": "center",
    "width": 80,
    "min_width": 80
  },
  {
    "type": "input",
    "name": "standardHumanDays",
    "originField": "standardHumanDays",
    "label": "标准人天",
    "align": "center",
    "width": 80,
    "min_width": 80
  },
  {
    "type": "input",
    "name": "1743069363240",
    "originField": "",
    "label": "",
    "align": "center",
    "width": 20,
    "min_width": 20
  }
];
/**
 * 按当前排序方向生成列头配置。
 * 「登记工时」列的 label 需要随升/降序切换图标状态，因此每次方向变化都要重建列数组。
 * @param {''|'asc'|'desc'} sortDirection 当前排序方向
 */
export const getOriginColumns = (sortDirection) => {
  const direction = sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : '';
  return originColumns.map((column) =>
    column.name === 'registerWorkingHours'
      ? { ...column, label: generateRegisterHoursLabel(direction) }
      : column
  );
};
export const zoomLevels = [
  {
    name: "hour",
    label: '小时',
    scale_height: 64,
    min_column_width: 30,
    scales: [
      { unit: "day", format: "%Y-%m-%d" },
      { unit: "hour", format: "%H" },
    ],
  },
  {
    name: "day",
    label: "日",
    scale_height: 70,
    min_column_width: 64,
    scales: [
      { unit: "month", format: "%Y年 %F" },
      {
        unit: "day",
        step: 1,
        format: (date) => {
          const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
          const day = new Date(date).getDate();
          const month = new Date(date).getMonth() + 1
          const weekDay = new Date(date).getDay();
          return `<div class='scale-formate-date'>
            <span class='formate-weekDay'>${weekDays[weekDay]}</span>
            <span class='formate-date'>${month}/${day}</span>
            </div>`;
        }
      }
    ]
  },
  {
    name: "week",
    label: "周",
    scale_height: 64,
    min_column_width: 64,
    scales: [
      { unit: "month", format: "%Y年 %F" },
      { unit: "week", step: 1, date: "%W周" }
    ]
  },
  {
    name: "month",
    label: "月",
    scale_height: 64,
    min_column_width: 64,
    scales: [
      // { unit: "year", step: 1, format: "%Y年" },
      {
        unit: "quarter",
        step: 1,
        format: (date) => {
          const year = new Date(date).getFullYear();
          const month = new Date(date).getMonth();
          const quarter = Math.floor(month / 3 + 1);
          return `${year}年-Q${quarter}`;
          // return `Q${quarter}`;
        }
      },
      { unit: "month", step: 1, format: "%F" }
    ]
  },
  {
    name: "quarter",
    label: "季",
    scale_height: 64,
    min_column_width: 64,
    scales: [
      { unit: "year", step: 1, format: "%Y年" },
      {
        unit: "quarter",
        step: 1,
        format: (date) => {
          // const year = new Date(date).getFullYear();
          const month = new Date(date).getMonth();
          const quarter = Math.floor(month / 3 + 1);
          // return `${year}年-Q${quarter}`;
          return `Q${quarter}`;
        }
      }
    ]
  },
  {
    name: "year",
    label: "年",
    scale_height: 64,
    min_column_width: 64,
    scales: [{ unit: "year", step: 1, format: "%Y年" }]
  }
];

export const zoomMap = {
  day: "日",
  week: "周",
  month: "月",
  quarter: "季",
  year: "年"
};

export const operationMenu = [
  {
    key: "add-bro",
    label: "新增本级"
  },
  {
    key: "add-child",
    label: "新增子级"
  },
  {
    key: "delete",
    label: "删除"
  }
];

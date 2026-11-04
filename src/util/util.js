import { getWorkItemUrl } from "../api/api";
import { Tag } from 'antd';
import dayjs from "dayjs";

/**
 * 获取当天的上一周
*/

/**
 * 判断当前用户是否有权限显示租户管理功能（配置席位、系统设置、ISV管理后台等）
 *
 * 权限规则：
 * - isInstalled=false 时：仅 Admin 可见
 * - isInstalled=true 时：app_admin / space_admin 可见
 * - space_admin 但非 Admin 时：不显示
 *
 * @param {string} userRole - 用户角色（从 tenantModeInfo.userRole 获取）
 * @returns {boolean} 是否有权限显示
 */
export function canShowTenantAdminFeature(showIsvJump) {
  let isInstalled = false;
  let userRole = 'member';
  try {
    const raw = sessionStorage.getItem("tenantModeInfo");
    if (raw) {
      const tenantModeInfo = JSON.parse(raw);
      isInstalled = tenantModeInfo?.install;
      userRole = tenantModeInfo?.userRole || 'member';
    };
  } catch (_) {}

  const isAdmin = sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin";
 if (showIsvJump) {
    if (!isInstalled) {
      return false;
    }
 }
 // 未安装：仅插件管理员（Admin）可见
 if (!isInstalled) {
    return isAdmin;
 }
 // 已安装：app_admin 直接放行；space_admin 需同时是插件管理员
 if (isInstalled && userRole === 'app_admin') return true;
 if (isInstalled && userRole === 'space_admin' && isAdmin) return true;
 return false;
}
export function  getIsInstalledInfo(){
    let isInstalled = false;
    try {
    const raw = sessionStorage.getItem("tenantModeInfo");
      if (raw) {
        const tenantModeInfo = JSON.parse(raw);
        isInstalled = tenantModeInfo.install;
      }
    } catch (_) {}
    return isInstalled;
  }
  export function getAppModeInfo(){
    let appMode = "space";
    try {
    const raw = sessionStorage.getItem("tenantModeInfo");
      if (raw) {
        const tenantModeInfo = JSON.parse(raw);
        appMode = tenantModeInfo.mode || "space";
      }
    } catch (_) {}
    return appMode;
  }
/**
 * 打开外部链接
 * - 优先使用飞书 JSSDK 的 navigation.open（宿主环境内跳转）
 * - 回退到 window.open 新开标签页
 * @param {string} url 目标链接
 * @param {string} [target='_blank'] window.open 兜底的 target
 */
export function openExternalUrl() {
  let url='https://app.feishu.cn/app/cli_aa924ccc3bb81bc4?from=share&visit_from=search'
  if (!url) return;
  if (window.JSSDK?.navigation?.open) {
    window.JSSDK.navigation.open(url);
  } else {
    window.open(url, '_blank');
  }
}

/**
 * 打开指定链接
 * - 优先使用飞书 JSSDK 的 navigation.open（宿主环境内跳转）
 * - 回退到 window.open 新开标签页
 * @param {string} url 目标链接
 */
export function openLinkInHost(url) {
  if (!url) return;
  if (window.JSSDK?.navigation?.open) {
    window.JSSDK.navigation.open(url);
  } else {
    window.open(url, '_blank');
  }
}

/**
 * 是否可展示审批详情里的「跳转」按钮
 * 条件：飞书审批（approvalType === 2）且能拿到跳转地址（instanceCode 非空）
 * 与是否有审批权限（operationList 是否含 audit）无关
 * @param {object} record 审批详情数据
 * @returns {boolean}
 */
export function canJumpToApproval(record) {
  return Number(record?.approvalType) === 2 && !!record?.instanceCode;
}

export function getLastWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=周日,1=周一...6=周六
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - (dayOfWeek + 6));
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  return { Monday: dayjs(lastMonday).format("YYYY-MM-DD"), Sunday: dayjs(lastSunday).format("YYYY-MM-DD") };
}

/**
获取当周周一和周天
*/
export function getWeekStartAndEnd() {
  const today = new Date();
  const firstDay = new Date(today);
  const lastDay = new Date(today);

  const diff = 1 - today.getDay();
  firstDay.setDate(today.getDate() + diff); // 获取本周第一天的日期
  lastDay.setDate(today.getDate() + (6 - today.getDay() + 1)); // 获取本周最后一天的日期

  const formattedFirstDay = `${firstDay.getFullYear()}-${(firstDay.getMonth() + 1).toString().padStart(2, '0')}-${firstDay.getDate().toString().padStart(2, '0')}`;
  const formattedLastDay = `${lastDay.getFullYear()}-${(lastDay.getMonth() + 1).toString().padStart(2, '0')}-${lastDay.getDate().toString().padStart(2, '0')}`;
  return { Monday: formattedFirstDay, Sunday: formattedLastDay };
}

/**
 * 获取上个月的第一天和最后一天
 */
export function getLastMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start: dayjs(firstDay).format("YYYY-MM-DD"),
    end: dayjs(lastDay).format("YYYY-MM-DD"),
  };
}

/**
获取当月第一天
*/
export function getFirstDayOfNaturalMonth() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();//获取当前年
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");//获取当前月
  const firstDay = "01";//日
  return `${year}-${month}-${firstDay}`;
}

/**
获取当月最后一天
*/
export function getLastDayOfNaturalMonth() {
  // 获取当前日期
  const currentDate = new Date();

  // 获取当前年份
  let year = currentDate.getFullYear();

  // 获取下个月的月份，使用 padStart 在月份小于 10 时在前面补零
  let month = String(currentDate.getMonth() + 2).padStart(2, "0");

  // 如果月份为 '13'，说明当前是12月，需要更新年份并将月份设置为 '01'
  if (month === '13') {
    year = year + 1;
    month = '01';
  }

  // 设置每个月的第一天为 '01'
  let firstDay = "01";

  // 构建下个月的第一天的日期字符串，格式为 'YYYY-MM-DD'
  const firstDayOfNextMonth = `${year}-${month}-${firstDay}`;

  // 计算当前月的最后一天，通过减去一天的毫秒数来得到
  const lastDayOfMonth = new Date(new Date(firstDayOfNextMonth).getTime() - 86400000);

  // 将最后一天的日期转换为 ISO 格式，并提取日期部分
  return lastDayOfMonth.toISOString().split("T")[0];
}

/**
获取当季度第一天和最后一天
*/
export function getQuarterStartAndEnd() {
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter =
    currentMonth <= 3 ? 1 : currentMonth <= 6 ? 2 : currentMonth <= 9 ? 3 : 4;
  const startMonth = (currentQuarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const startDate = new Date(new Date().getFullYear(), startMonth - 1, 1);
  const endDate = new Date(new Date().getFullYear(), endMonth, 0);

  return {
    start: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`,
    end: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${endDate.getDate()}`,
  };
}

/** 
 * 获取指定日期范围内的所有日期及其对应的星期
 */
export function getDatesInRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  startDate === endDate ? end.setDate(end.getDate() + 8) : end.setDate(end.getDate() + 1)
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // 计算天数差异

  return Array.from({ length: diffDays }, (_, index) => {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + index); // 设置当前日期为起始日期的index天后
    const dayOfWeek = currentDate.getDay(); // 获取星期几，0是周日，1是周一，...，6是周六
    const dayOfWeekName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayOfWeek]; // 转换为中文星期名
    return {
      date: currentDate.toISOString().split('T')[0], // 获取日期字符串，格式为YYYY-MM-DD
      dayOfWeek: dayOfWeekName
    };
  });
}

/**
获取url的参数
*/
export function getUrlState(href) {
  if (href.indexOf('?') === -1) return
  let url = href.split('?')
  let urlInfo = url[1]

  const infoArr = urlInfo.split('&')
  const store = {}
  for (let item of infoArr) {
    const i = item.split('=')
    store[i[0]] = i[1]
  }
  return store
}

/** 获取当前浏览器UA信息 */
function _getUA() {
  return (
    typeof navigator !== 'undefined' &&
    ((navigator && (navigator.userAgent || navigator.swuserAgent)) || '')
  )
}

/** 判断当前是否移动端 */
export function isMb() {
  return /Android|webOS|iPhone|iPod|BlackBerry/i.test(_getUA())
}

/** 获取当前是否钉钉H5环境 */
export function isDD() {
  return /DingTalk/i.test(_getUA())
}

/** 通过 名字 + 下标 + 随机串生成的key，用于v-for */
export function generateKey(name = '', index = '') {
  return `key-${name}-${index}-${new Date().getTime().toString(36)}`
}

/**
 * 生成 UUID
 * @param {Number} len 指定长度
 * @param {Number} radix 指定基数
 */
export function generateUuid(len, radix) {
  var chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')

  var uuid = []
  var i = null

  radix = radix || chars.length

  if (len) {
    // Compact form
    for (i = 0; i < len; i++) {
      uuid[i] = chars[0 | (Math.random() * radix)]
    }
  } else {
    // rfc4122, version 4 form

    var r // rfc4122 requires these characters

    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-'

    uuid[14] = '4' // Fill in random data.  At i==19 set the high bits of clock sequence as // per rfc4122, sec. 4.1.5

    for (i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | (Math.random() * 16)
        uuid[i] = chars[i === 19 ? (r & 0x3) | 0x8 : r]
      }
    }
  }

  return uuid.join('')
}

/** 格式化日期 */
export function formatDateTime(timeObj, fmt) {
  if (!timeObj) return ''
  var o = {
    'M+': timeObj.getMonth() + 1, //月份
    'd+': timeObj.getDate(), //日
    'h+': timeObj.getHours(), //小时
    'm+': timeObj.getMinutes(), //分
    's+': timeObj.getSeconds(), //秒
    'q+': Math.floor((timeObj.getMonth() + 3) / 3), //季度
    S: timeObj.getMilliseconds(), //毫秒
  }

  if (/(y+)/.test(fmt))
    fmt = fmt.replace(
      RegExp.$1,
      (timeObj.getFullYear() + '').substr(4 - RegExp.$1.length)
    )
  for (var k in o)
    if (new RegExp('(' + k + ')').test(fmt))
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length === 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length)
      )
  return fmt
}

/** 时间戳转日期 */
export function timeStamp2Text(timeStamp, format = 'yyyy-MM-dd hh:mm') {
  if (!timeStamp || typeof timeStamp !== 'number') return ''
  return formatDateTime(new Date(timeStamp), format)
}

/**
 * 轮询程序
 * 当条件成立，才执行回调
 * 失败 N 次后，执行失败回调
 *
 * @param {String} conditions 成立条件表达式
 * @param {Number} interval 间隔多少毫秒, 默认200
 * @param {Number} timeout (运行)超时次数, 默认50
 *
 */
export function pollFunction(conditions, interval = 200, timeout = 50) {
  return new Promise((resolve, reject) => {
    let num = 0
    let t = setInterval(() => {
      num = num + 1
      if (num >= timeout) {
        reject(`超时,表达式不成立: ${conditions}`)
        return
      }

      if (!conditions) return
      clearInterval(t)
      resolve(`表达式成立: ${conditions}`)
    }, interval)
  })
}

/** 获取当前经纬度 */
export function getLocation(cb, http) {
  // async
  navigator.geolocation.getCurrentPosition((res) => {
    // console.log('res', res)
    const { coords } = res
    if (typeof cb === 'function') cb(coords)
  })
}

/**
 * 根据两点间经纬度坐标，计算两点间距离，单位为米
 *
 * @param lng1 起始点经度
 * @param lat1 起始点纬度
 * @param lng2 终点经度
 * @param lat2 终点纬度
 * @return  直线距离，以米为单位
 */
export function calcLinearDistance(lng1, lat1, lng2, lat2) {
  const EARTH_RADIUS = 6378137

  const rad = (d) => {
    return (d * Math.PI) / 180.0
  }

  const radLat1 = rad(lat1)
  const radLat2 = rad(lat2)
  const a = radLat1 - radLat2
  const b = rad(lng1) - rad(lng2)
  let s =
    2 *
    Math.asin(
      Math.sqrt(
        Math.pow(Math.sin(a / 2), 2) +
        Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
      )
    )
  s = s * EARTH_RADIUS
  s = Math.round(s * 10000) / 10000
  return s
}

/** 节流 */
export function throttle(method, delay = 2000, time = 1000) {
  var timeout,
    startTime = +new Date()
  return function () {
    var context = this,
      args = arguments,
      curTime = +new Date()
    clearTimeout(timeout)
    // 如果达到了规定的触发时间间隔，触发 handler
    if (curTime - startTime >= time) {
      method.apply(context, args)
      startTime = curTime
    } else {
      // 没达到触发间隔，重新设定定时器
      timeout = setTimeout(method, delay)
    }
  }
}

/** 强复制 */
export function superCopy(obj) {
  return JSON.parse(JSON.stringify(obj))
}

/** 提取汉字 */
export function getChinese(strValue) {
  if (strValue !== null && strValue !== '') {
    const reg = /[\u4e00-\u9fa5]/g
    return strValue.match(reg).join('')
  } else {
    return ''
  }
}

/**
 * 按字节计算字符串长度
 * @param bytes 字节数
 * @returns
 */
export function byteLength(str) {
  let len = 0
  for (let i = 0; i < str.length; i++) {
    // UTF8编码一个中文按3个字节算（GBK编码一个中文按2个字节）
    len += str.charCodeAt(i) > 255 ? 3 : 1
    // len += str.replace(/[^\x00-\xff]/g, 'xxx').length
  }
  return len
}

/**
 * 按字节截取字符串
 * @param bytes 字节数
 * @return s
 */
export function subStringByBytes(str, bytes) {
  let len = 0
  for (let i = 0; i < str.length; i++) {
    // UTF8编码一个中文按3个字节算（GBK编码一个中文按2个字节
    len += str.charCodeAt(i) > 255 ? 3 : 1
    if (len > bytes) {
      return str.substring(0, i) + '...'
    }
  }
  return str
}

/**
 * 指定数组对象排序的比较函数
 * @param {Object} property 传入对象属性
 * 示例: arr = arr.sort(Util.compare('count'))
 */
export function compare(property) {
  return function (obj1, obj2) {
    const value1 = obj1[property]
    const value2 = obj2[property]
    // return value1 - value2 // 升序
    return value2 - value1 // 降序
  }
}

/**
 * 金额处理
 * 第一位value是必传的
 * 第二位num是保留小数位，默认保留两位小数
 */
export function formatMoney(value, num) {
  num = num > 0 && num <= 20 ? num : 2
  value = parseFloat((value + '').replace(/[^\d\\.-]/g, '')).toFixed(num) + '' // 将金额转成比如 123.45的字符串
  var valueArr = value.split('.')[0].split('').reverse() // 将字符串的数变成数组
  const valueFloat = value.split('.')[1] // 取到 小数点后的值
  let valueString = ''
  for (let i = 0; i < valueArr.length; i++) {
    // 循环 取数值并在每三位加个','
    valueString +=
      valueArr[i] + ((i + 1) % 3 === 0 && i + 1 !== valueArr.length ? ',' : '')
  }
  const money = valueString.split('').reverse().join('') + '.' + valueFloat // 拼接上小数位
  return money
}

export function copyToClipboard(text) {
  var tempInput = document.createElement('input')
  tempInput.style = 'position: absolute; left: -1000px; top: -1000px'
  tempInput.value = text
  document.body.appendChild(tempInput)
  tempInput.select()
  document.execCommand('copy')
  document.body.removeChild(tempInput)
}

/** 判断是否还有下一页 */
export function isHasMore(current, pages) {
  if (!pages) return true
  let isHasMore = true
  if (current < pages) {
    isHasMore = true
  } else {
    isHasMore = false
  }
  return isHasMore
}

/** 过滤掉对象数组中的重复对象 */
export function filterDuplicates(arr) {
  const uniqueObjects = [];
  const seen = new Set();

  arr.forEach((item) => {
    const objectAsString = JSON.stringify(item);
    if (!seen.has(objectAsString)) {
      uniqueObjects.push(item);
      seen.add(objectAsString);
    }
  });

  return uniqueObjects;
}

/** 下载文件 */
export function urlDownload(url, fileName = '下载文件') {
  let eleLink = document.createElement('a')
  eleLink.style.display = 'none'
  eleLink.href = url
  eleLink.download = fileName
  // 触发点击
  document.body.appendChild(eleLink)
  eleLink.click()
  // 然后移除
  document.body.removeChild(eleLink)
}

/** 判断这个值是否为数字 */
export function isNumber(value) {
  return typeof value === 'number';
}

export function validateNumber(dayUp,min, max, msgBefore, msgAfter,workDate) {
  return (_, value) => {
    if (value || value === 0) {
      const actualMin = min || 0;
      const actualMax = max ?? 24; // 使用空值合并运算符，如果max为undefined，使用24作为默认值
      
      if (value < actualMin) {
        return Promise.reject(new Error(`低于单次填报工时下限${actualMin}小时`));
      }
      if (actualMax<0 && workDate) {
        return Promise.reject(new Error(`当天填报工时超过上限${msgBefore} ${dayUp} ${msgAfter}`));
      }
    }
    return Promise.resolve();
  };
};

export function validateDecimalPlaces(val, max) {
  if (val) {
    const reg = /^\d+(\.\d{1,2})?$/;
    return !reg.test(val)
  }
}

/** 输入防抖 */
export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/** 点击跳转到工作项新页面 */
export async function goWorkItemHref(record) {
  const { workItemId, workItemEntityId, nodeId } = record;
  const data = {
    workItemId,
    workItemEntityId,
    nodeId,
  };
  const res = await getWorkItemUrl(data);
  if (res?.result) {
    window.JSSDK.navigation.open(res?.data);
  }
};



/** 处理变更类型返回 */
export function handleModifyType(type) {
  switch (type) {
    case "create":
      return "新增";
    case "edit":
      return "修改";
    case "delete":
      return "删除";
    default:
      return "--";
  }
};

/** 审批状态标签展示 */
export function getApproveStatusTag(status) {
  let approvalStatus = "";
  switch (status) {
    case 1:
      approvalStatus = "待审批";
      return <Tag color="processing">{approvalStatus}</Tag>;
    case 2:
      approvalStatus = "已通过";
      return <Tag color="success">{approvalStatus}</Tag>;
    case 3:
      approvalStatus = "已拒绝";
      return <Tag color="error">{approvalStatus}</Tag>;
    case 4:
      approvalStatus = "已撤回";
      return <Tag color="warning">{approvalStatus}</Tag>;
    case 5:
      approvalStatus = "已撤销";
      return <Tag color="default">{approvalStatus}</Tag>;
    default:
      return null;
  }
};
export const formatCustomFieldValue = (value) => {
  if (value === null || value === undefined) return "--";
  if (typeof value === "string" && value.trim() === "") return "--";
  return value;
};

/**
 * 构建考勤数据索引（O(1) 查询）
 * key: projectKey|userKey|date
 * configMap: key: projectKey, value: 项目公共配置
 */
export function buildAttendanceIndex(list) {
  var dataMap = new Map();   // key: projectKey|userKey|date
  var configMap = new Map(); // key: projectKey, value: 项目公共配置

  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    var pk = item.projectKey;

    // 公共字段只存一份
    if (!configMap.has(pk)) {
      configMap.set(pk, {
        projectKey: pk,
        isEnable: item.isEnable,
        upperLimitSource: item.upperLimitSource,
        missPunchPolicy: item.missPunchPolicy,
        missPunchCustomLimit: item.missPunchCustomLimit
      });
    }

    var userKeys = item.userKeys || {};
    var userKeyArr = Object.keys(userKeys);
    for (var j = 0; j < userKeyArr.length; j++) {
      var uk = userKeyArr[j];
      var dates = userKeys[uk] || {};
      var dateArr = Object.keys(dates);
      for (var k = 0; k < dateArr.length; k++) {
        var date = dateArr[k];
        dataMap.set(pk + '|' + uk + '|' + date, dates[date]);
      }
    }
  }
  return { dataMap: dataMap, configMap: configMap };
}

// 查询：O(1)，一次 get
export function getAttendance(index, projectKey, userKey, date) {
  var key = projectKey + '|' + userKey + '|' + date;
  var data = index.dataMap.get(key);
  if (!data) return null;
  // 需要公共字段时再合并，不需要则直接返回 data
  return Object.assign({}, index.configMap.get(projectKey) || {}, data);
}

// 为了让 import { xxx } from 'util' 生效
export default {
  getWeekStartAndEnd,
  getLastWeekRange,
  getLastMonthRange,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  getQuarterStartAndEnd,
  getDatesInRange,
  getUrlState,
  isDD,
  formatDateTime,
  timeStamp2Text,
  pollFunction,
  getLocation,
  calcLinearDistance,
  throttle,
  superCopy,
  generateKey,
  getChinese,
  byteLength,
  subStringByBytes,
  compare,
  isMb,
  generateUuid,
  formatMoney,
  copyToClipboard,
  isHasMore,
  filterDuplicates,
  urlDownload,
  isNumber,
  validateDecimalPlaces,
  debounce,
  handleModifyType,
  goWorkItemHref,
  getApproveStatusTag,
  buildAttendanceIndex,
  getAttendance
}
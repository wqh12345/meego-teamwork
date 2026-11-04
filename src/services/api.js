import axios from 'axios';

// 创建 axios 实例
const request = axios.create({
  baseURL: 'https://workhour.lundong.com.cn', // 替换为您的API地址
  timeout: 10000,
});

// 全局 token 存储
let globalToken = null;

// 项目配置
const PROJECT_KEY = '6886eb366e2da312cbe71d7f'; // 从 token 中解析出的 project_key
const PLUGIN_VERSION = '2.8.0';

/**
 * 设置全局 token
 */
export function setGlobalToken(token) {
  globalToken = token;
  // 同时存储到 localStorage 持久化
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

/**
 * 获取全局 token
 */
export function getGlobalToken() {
  if (!globalToken) {
    globalToken = localStorage.getItem('auth_token');
  }
  return globalToken;
}

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 添加全局 token
    const token = getGlobalToken();
    if (token) {
      // 直接设置 token，不加 Bearer 前缀
      config.headers.Authorization = token;
    }
    // 添加项目标识和插件版本
    config.headers['Project-Key'] = PROJECT_KEY;
    config.headers['Plugin-Version'] = PLUGIN_VERSION;
    
    console.log('[Request]', config.url, 'Authorization:', token ? '已设置' : '未设置');
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 获取授权 token
 * @param {object} data - 包含 authorizationCode 的对象
 */
export function getAuthToken(data) {
  return request.get('/noAuth/getAuthToken', { params: data });
}

/**
 * 初始化 token（使用授权码获取并设置全局 token）
 * @param {string} authorizationCode - 授权码
 */
export async function initAuthToken(authorizationCode) {
  try {
    // 接口需要 flag: 'new' 参数
    const res = await getAuthToken({ authorizationCode, flag: 'new' });
    // 接口返回的是 authToken 字段
    if (res?.result && res?.data?.authToken) {
      setGlobalToken(res.data.authToken);
      console.log('[Auth] Token 初始化成功');
      return true;
    }
    console.warn('[Auth] Token 获取失败:', res);
    return false;
  } catch (error) {
    console.error('[Auth] Token 初始化错误:', error);
    return false;
  }
}
// 响应拦截器
request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

/**
 * 查询工时日志列表
 */
export function postQueryNodeWorkHour(data) {
  return request.post('/workHour/queryNodeWorkHour', data);
}

/**
 * 删除工时日志
 */
export function postDeleteNodeWorkHour(data) {
  return request.post('/workHour/deleteNodeWorkHour', data);
}

/**
 * 新增工时登记
 */
export function postInsertNodeWorkHour(data) {
  return request.post('/workHour/insertNodeWorkHour', data);
}

/**
 * 更新工时登记
 */
export function postUpdateNodeWorkHour(data) {
  return request.post('/workHour/updateNodeWorkHour', data);
}




export function getWorkItemOptionForRegister(params){
   return request.get('entityInstance/new/getWorkItemOptionForRegister', params)  
}
/**
 * 获取工作项选项
 */
export function getWorkItemOptionNew() {
  return request.get('/entityInstance/new/getWorkItemOptionForRegister');
}

/**
 * 获取工作项实例选项（分页）
 */
export function getItemEntityOptionNew(params) {
  return request.get('/entityInstance/new/getItemEntityOption', { params });
}

/**
 * 获取工作项实例节点选项
 */
export function getEntityNodeOptionNew(params) {
  return request.get('/entityInstance/new/getEntityNodeOption', { params });
}

/**
 * 获取节点人员统计信息
 */
export function getNodePersonStatistics(params) {
  return request.get('/hour/statistics/node/person', { params });
}

/**
 * 获取个人工作饱和度提示
 * @param {object} params - { workDate, registrantUseKey }
 */
export function getWorkSaturationTips(params) {
  return request.get('/hour/statistics/saturation/person', { params });
}

/**
 * 查询工时登记节点总和
 * @param {object} data - { workItemId, workItemEntityId, nodeId, taskId, registrantUseKey, flowType }
 */
export function postQueryNodeWorkHourSumByUser(data) {
  return request.post('/workHour/queryNodeWorkHourSumByUser', data);
}

/**
 * 获取标准工时配置
 * 返回：{ standWorkHour, dayUp, onceDown }
 */
export function getStandWorkHour() {
  return request.get('/workHour/getStandWorkHour');
}

/**
 * 获取工时审批列表-汇总审批
 * @param {object} data - { staffIds, approvalNo, startTime, endTime, approvalStatus, workItemId, workItemEntityId, nodeId, taskId, pageSize, pageNum }
 */
export function postBatchApproveAllList(data) {
  return request.post('/collect/approval/list/all', data);
}

/**
 * 获取工时审批列表-单项审批
 * @param {object} data - { staffIds, approvalNo, startTime, endTime, approvalStatus, workItemId, workItemEntityId, nodeId, taskId, pageSize, pageNum }
 */
export function postApproveAllList(data) {
  return request.post('/approve/list/all', data);
}

/**
 * 获取审批数量（主菜单数量）
 * 返回：{ allApprovalCount, myWorkHoursCount, myApprovalCount }
 */
export function getApproveCount() {
  return request.get('/approve/getApproveCount');
}

/**
 * 单项审批-页面数量
 * @param {object} data - { tabType: 1|全部审批, 2|我发起的, 3|我审批的 }
 * 返回：{ approvalSignalNum, totalNum }
 */
export function postSinglePageCount(data) {
  return request.post('/approve/total/num', data);
}

/**
 * 汇总审批-页面数量
 * @param {object} data - { tabType: 1|全部审批, 2|我发起的, 3|我审批的 }
 * 返回：{ approvalCollectNum, totalNum }
 */
export function postBatchPageCount(data) {
  return request.post('/collect/approval/total/num', data);
}

// 获取汇总审批详情
export function getCollectApproveDetailList(data) {
  // id
  return request.get(`collect/approval/detail/${data.id}`)
}

/**
 * 获取单项审批明细（审批日志）
 * @param {object} data - { id }
 */
export function getApproveLog(data) {
  return request.get(`/approve/log/${data.id}`);
}

/**
 * 处理审批/拒绝/撤回/撤销的接口（单项审批）
 * @param {object} data - { id, reason, type }
 * type: pass-通过, refuse-拒绝, cancel-撤回, revoke-撤销, delete-删除, again_launch-再次发起
 */
export function postApproveHandle(data) {
  return request.post('/approve/handle', data);
}

/**
 * 汇总审批-批量操作（撤回/撤销等）
 * @param {object} data - { approvalCollects: [{collectId, approvalIds}], type, reason }
 * type: pass-通过, refuse-拒绝, cancel-撤回, delete-撤销, again_launch-再次发起
 */
export function postCollectApprovalHandle(data) {
  return request.post('/collect/approval/handle/batch', data);
}

export default request;

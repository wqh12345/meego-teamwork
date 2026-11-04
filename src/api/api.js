import { get, post, del } from "../config"
import pluginConfig from "../../plugin.config.json"

// 获取token
export function getAuthToken(data) {
  // authorizationCode
  return get('noAuth/getAuthToken', data)
}

// 用户活跃（埋点接口）
export function postUserActive(data) {
  // activeType (ConfigurationPage: 配置页, TablePage: table页, PluginInternal: 插件内, RegistrationWorkingHours: 登记工时)
  return post('operation/management/user/active', data)
}

// 模糊搜索人员
export function postSearchMember(data) {
  // query
  return post('noAuth/queryUserList', data)
}

// 查询空间所有成员（普通成员权限）
export function getProjectAllStaffUser() {
  return get('admin/new/getProjectAllStaff')
}


// 查询当前空间角色
export function getUserRole() {
  return get('user/getUserRole')
}

// 获取选项：工作项
export function getWorkItemOption() {
  return get('workHour/getWorkItemOption')
}

// 获取选项：工作项实例
export function getItemEntityOption(data) {
  // workItemKey
  return get('workHour/getItemEntityOption', data)
}

// 获取选项：工作项实例节点
export function getEntityNodeOption(data) {
  // workItemKey
  // entityId
  return get('workHour/getEntityNodeOption', data)
}

// 获取套餐到期消息
export function getPlanMessage() {
  return get('plan/tenant/message')
}

// 弹窗登记展示逻辑及判断是不是标品（海外日本版专有）
export function getDisplayLogic() {
  return get('config/registration')
}

// 同步飞书项目信息(节点模式)
export function getSyncMeego() {
  return get('entityInstance/synWorkInstance')
}

// 同步飞书项目信息(状态模式)
export function getSyncStateMeego() {
  return get('entityInstance/synStateFlowInstance')
}

// 判断是否有插件管理员
export function getJudgeProjectHasAdmin() {
  return get('entityInstance/judgeProjectHasAdmin')
}

// 获取管理员级别配置
export function getProjectConfig(data) {
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS - 允许管理员登记他人工时(0 - 不允许, 1 - 允许)
   * 
   */
  return get('config/getProjectConfig', data)
}
// 获取项目用户团队所有信息
export function getProjectUserTeamAll(flag) {
  // flag
  return get(`admin/projectUserTeamAll/${flag}`)
}


export function getreTeam() {

   
  return get('/team/reTeam')
}
// 变更管理员级别配置
export function postProjectConfig(data) {
  // value
  // id
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS - 允许管理员登记他人工时(0 - 不允许, 1 - 允许)
   * 
   */
  return post('config/updateProjectNumeralConfig', data)
}


// 获取用户级别配置
export function getUserNumeralConfig(data) {
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ONLY_CALCULATE_WORKING_DAYS - 仅计算工作日(0 - 不允许, 1 - 允许)
   * 
   */
  return get('config/getUserConfig', data)
}

// 变更用户级别配置
export function postUserNumeralConfig(data) {
  // value
  // id
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ONLY_CALCULATE_WORKING_DAYS - 仅计算工作日(0 - 不允许, 1 - 允许)
   * 
   */
  return post('config/updateUserNumeralConfig', data)
}

// 根据type获取度量开启信息以及度量项目名称信息
export function getMeasureProjectConfig(data) {
  // type type类型说明, 后面为类型说明于类型值说明
  /**
   * ALLOW_MEASUREMENT
   * 
   */
  return get('measurement/getMeasureProjectConfig', data)
}

// 获取绑定项目和度量项目下拉列表
export function getUnlockedWorkItemInfo(data) {
  return get('measurement/getUnlockedWorkItemInfo', data)
}

// 判断承载度量的工时统计工作项是不是为空
export function getCheckIsEmptyWorkItem(data) {
  // measureWorkItemId
  return get('measurement/checkIsEmptyWorkItem', data)
}

// 绑定项目和度量项目
export function postBindMeasurementProject(data) {
  // workItemId
  // measureWorkItemId
  // measureWorkItemName
  // confirmUpdate
  return post('measurement/bindMeasurementProject', data)
}

// 获取已绑定的项目和度量项目
export function getMeasureEditParam(data) {
  // type "ALLOW_MEASUREMENT"
  return get('measurement/getMeasureEditParam', data)
}

// 获取【插件设置】工时审批文案信息
export function getApproveConfig() {
  return get('approve/getApproveConfig')
}

// 获取已设置的工时审批
export function getApproveEditParam() {
  return get('approve/getApproveEditParam')
}

// 设置的工时审批
export function postApproveEdit(data) {
  // id
  // type（ALLOW_APPROVE:开启审批）
  // value（1：开启；0：关闭）
  // approvalList: [
  //   {
  //     id,
  //     approvalStageName,
  //     processingUserIds,
  //     approvalRule,
  //     teamIds
  //   }
  // ]
  return post('approve/approveEdit', data)
}

// 查询团队列表
export function getTeam(data) {
  // teamName
  return get('team/list', data)
}

// 刷新团队成员
export function getRefreshTeam() {
  return get('team/refresh')
}

// 分页查询空间成员接口
export function getSelectProjectUserList(data) {
  // pageNum
  // pageSize
  // userName
  return get('projectUser/selectProjectUserList', data)
}

// 同步空间成员(已废弃)
export function postSysProjectUser(data) {
  // userKey
  return post('projectUser/sysProjectUser', data)
}

// 实例下所有人工时统计
export function getWorkHourStatistics(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // flowType
  return get('hour/statistics/node/all/user', data)
}

/** 公告管理 */

// 获取滚动公告
export function getRollingAnnouncement() {
  return get('announcement/getRollingAnnouncement')
}

// 关闭滚动公告
export function getCloseRollingAnnouncement(id) {
  return get(`announcement/confirmRollingAnnouncement/${id}`)
}

// 获取全屏弹框公告
export function getFullScreenAnnouncement() {
  return get('announcement/getFullScreenAnnouncement')
}

// 确认全屏弹框公告
export function getConfirmFullScreenAnnouncement(id) {
  return get(`announcement/confirmFullScreenAnnouncement/${id}`)
}

/** 客户留资 */

// 校验用户是否已经登记留资信息
export function getJudgeHasRecord() {
  return get('retain/judgeHasRecord')
}

// 新增留资客户信息
export function postAddRetainPropertyInfo(data) {
  // linkman
  // linkmanPhone
  // companyName
  // position
  // code
  return post('retain/addRetainPropertyInfo', data)
}

// 发送验证码短信
export function getSendSms(data) {
  return get('sms/sendSms', data)
}

// 验证验证码是否正确
export function getVerifySms(data) {
  return get('sms/checkCode', data)
}

/** 资源管理 */

// 获取用户自定义展示字段
export function getUserCustomField(data) {
  // type
  /** 
   * WORKING_HOURS_RESOURCES_GANTT_CHART - 工时资源甘特图自定义字段配置
   */
  return get('config/getUserCustomField', data)
}

// 编辑用户自定义展示字段
export function postUserCustomField(data) {
  // [{
  //   id,
  //   configType,
  //   configKey,
  //   sort,
  //   checked,
  // }]
  return post('config/updateUserCustomField', data)
}

// 获取自定义字段状态
export function getFieldStatus(data) {
  return get('api/customField/getFieldStatus', data)
}

// 查询工作甘特图
export function postWorkGanttChart(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagement/queryWorkGanttChart', data)
}

// 查询工作甘特图_V2.3版本以后使用
export function postWorkGanttChartNew(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagement/queryWorkGanttChartNew', data)
}

// 查询当前用户代填的用户信息
export function getRegistrantUser(data) {
  // startDate
  // endDate
  return post('workHour/getRegistrantUserNew', data)
}

// 查询当前空间当前用户资源管理选择的条件
export function getResourceCondition() {
  return get('resourceManagement/queryResourceCondition')
}

// 查询工时详情
export function postWorkingHoursDetails(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // startDate
  // endDate
  // userKey
  // tag
  return post('resourceManagement/queryWorkingHoursDetails', data)
}

/** 工时日志 */

// 获取导出工时日志的uuid
export function postExportNodeWorkHour(data) {
  /// workItemId
  // workItemEntityId
  // nodeId
  // startDate
  // endDate
  // isSynchronous
  // statisticType
  // userIdList
  return post('workHour/exportNodeWorkHour', data)
}

// 轮询获取导出工时日志url
export function getExportNodeWorkHourResult(data) {
  /// uuid
  return get('workHour/exportNodeWorkHourResult', data)
}

// 查询工时登记
export function postQueryNodeWorkHour(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // startDate
  // endDate
  // pageNo
  // pageSize
  // isSynchronous
  // statisticType
  // userIdList
  return post('workHour/queryNodeWorkHour', data)
}

// 查询工时登记 节点总和
export function postQueryNodeWorkHourSum(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // id
  // taskHourId
  // userKey
  return post('workHour/queryNodeWorkHourSum', data)
}

// 查询工时登记 节点下个人工时统计
export function postQueryNodeWorkHourSumByUser(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // registrantUseKey
  // flowType
  return get('hour/statistics/node/person', data)
}

// 个人工作饱和度提示框
export function getWorkSaturationTips(data) {
  // workDate
  // registrantUseKey
  return get('hour/statistics/saturation/person', data)
}

// 查询工时登记 查看明细
export function postQueryNodeWorkHourDetail(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // userKey
  return post('workHour/queryNodeWorkHourDetail', data)
}

// 新增工时登记
export function postInsertNodeWorkHour(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // actWorkHour
  // workDesc
  // workDate
  return post('workHour/insertNodeWorkHour', data)
}

// 更新工时登记
export function postUpdateNodeWorkHour(data) {
  // id
  // workItemId
  // workItemEntityId
  // nodeId
  // actWorkHour
  // workDesc
  // workDate
  return post('workHour/updateNodeWorkHour', data)
}

// 删除工时登记
export function postDeleteNodeWorkHour(data) {
  // id
  return post('workHour/deleteNodeWorkHour', data)
}

// 批量删除工时登记 POST workHour/deleteNodeWorkHourBatch
// 入参：{ items: [ { projectKey, ids: [id...] }, ... ] }（按 projectKey 分组，支持多空间/多对象）
export function postDeleteNodeWorkHourBatch(data) {
  return post('workHour/deleteNodeWorkHourBatch', data)
}

// 批量新增工时登记
export function postBatchInsertNodeWorkHour(data) {
  return post('work/hour/v2/registration/batch', data)
}

// 批量新增工时登记(新版)
export function postBatchInsertNodeWorkHourNew(data) {
  return post('work/hour/v2/registration/batch/date', data)
}

// 再次发起汇总审批(新版) 
export function postBatchApprovalAgain(data) {
  return post('collect/approval/handle/batch/again', data)
}

// 批量登记-配置表格展示排序获取
export function getBatchRegTableSortConfig() {
  return get('user/config/registration/head')
}

// 批量登记-配置表格展示排序配置
export function postBatchRegTableSortConfig(data) {
  return post('user/config/registration/head', data)
}

// 分页查询工作实例
export function getWorkInstance(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workTime
  return get('entityInstance/selectWorkInstanceAndNodeAndTaskByProjectKey', data)
}

// 根据工作项和工作实例id获取节点和任务信息
export function getWorkInstanceDetail(data) {
  // workItemKey
  // entityId
  return get('entityInstance/getEntityNodeOptionAndNodeSchedule', data)
}

// 分页查询工作节点以及节点下的任务
export function getNodeInstanceAndTask(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workTime
  // workItemId
  // workItemEntityId
  return get('entityInstance/selectNodeInstanceAndTask', data)
}

// 查询工作节点登记工时明细
export function getNodeUserList(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workItemId
  // workItemEntityId
  // nodeId
  // userId
  return get('entityInstance/selectNodeUserList', data)
}

// 获取审批详情
export function getApproveDetailList(data) {
  // id
  return get(`work/hour/v2/approve/info/${data.id}`)
}

// 获取汇总审批详情
export function getCollectApproveDetailList(data) {
  // id
  return get(`collect/approval/detail/${data.id}`)
}

/** 工时管理 */

// 查询空间所有成员（管理员权限）
export function getProjectAllStaff() {
  return get('admin/getProjectAllStaff')
}

// 部门统计-获取以往查询条件
export function getLastStatCondition(data) {
  // flag
  return get('admin/getLastStatCondition', data)
}

// 部门统计-工作项登记工时
export function postAdminQueryEntityStat(data) {
  // userId
  // startDate
  // endDate
  return post('admin/queryEntityStat', data)
}

// 导出-部门统计-工作项登记工时
export function postAdminExportEntityStat(data) {
  // userId
  // startDate
  // endDate
  return post('admin/exportEntityStat', data)
}

// 部门统计-成员登记工时
export function postAdminQueryStaffStat(data) {
  // userId
  // startDate
  // endDate
  // rangeType
  return post('admin/queryStaffStat', data)
}

// 导出-部门统计-成员登记工时
export function postAdminExportStaffStat(data) {
  // userId
  // startDate
  // endDate
  // rangeType
  return post('admin/exportStaffStat', data)
}

// 个人统计-实际工时统计
export function postWorkHourQuerySelfStat(data) {
  // startDate
  // endDate
  // rangeType
  return post('workHour/querySelfStat', data)
}

// 导出-个人统计-实际工时统计
export function postWorkHourExportSelfStat(data) {
  // startDate
  // endDate
  // rangeType
  return post('workHour/exportSelfStat', data)
}

/** 插件设置 */

// 查询组织标准工时
export function getStandWorkHour() {
  return get('workHour/getStandWorkHour')
}

// 更新组织标准工时
export function postUpdateStandWorkHour(data) {
  // standWorkHour
  // dayUp
  // onceDown
  return post('workHour/updateStandWorkHour', data)
}

// 查询当前空间管理员
export function getProjectAdminList() {
  return get('admin/getProjectAdmin')
}

// 查询当前空间普通成员
export function getProjectMemberList() {
  return get('user/getProjectSimpleStaff')
}

// 设置空间管理员
export function postSetProjectAdmin(data) {
  // userId[]
  return post('admin/setProjectAdmin', data)
}

// 设置当前空间普通成员
export function postSetProjectMember(data) {
  // userId[]
  return post('admin/setProjectSimpleStaff', data)
}

/** 批量填报Table接口汇总 */

// 批量登记-查询登记对象
export function postQueryBatch(data) {
  // workItemId
  // workItemEntityId
  // scheduleStartDate
  // scheduleEndDate
  // personInCharge
  // pageSize
  // pageNum
  return post('work/hour/v2/query/batch', data)
}

// 分页查询工作实例
export function getSelectWorkInstance(data) {
  // pageNum
  // pageSize
  // startTime
  // endTime
  // workItemEntityId
  // workItemId
  // registrantUseKey
  return get('entityInstance/new/selectWorkInstance', data)
}

// 查询工作实例实例下的节点
export function getEntityNode(data) {
  // workItemEntityId
  // workItemId
  // workTime
  // startTime
  // endTime
  return get('entityInstance/new/getEntityNode', data)
}

// 查询工作实例实例下的节点的任务
export function getEntityNodeSchedule(data) {
  // workItemEntityId
  // workItemId
  // nodeId
  // workTime
  // startTime
  // endTime
  return get('entityInstance/new/getEntityNodeSchedule', data)
}

// 获取工指定实例下的节点和任务
export function postEntityNodeTask(data) {
  // workItemEntityId
  // workItemId
  // registerUserKey
  // personInCharge
  // scheduleStart
  // scheduleEnd
  return post('work/hour/v2/query/node', data)
}

// 查询指定实例下节点的任务
export function postEntityNodeTaskSchedule(data) {
  // workItemEntityId
  // workItemId
  // nodeId
  return post('work/hour/v2/query/task', data)
}

/** 工作节点Cascader接口汇总 */

// 获取选项：工作项
export function getWorkItemOptionNew(params) {
  return get('entityInstance/new/getWorkItemOption', params)
}

// 获取选项：工作项实例(备注分页)
export function getItemEntityOptionNew(data) {
  // workItemId
  // pageNum
  // pageSize
  // workItemEntityName
  return get('entityInstance/new/getItemEntityOption', data)
}

export function postItemEntityOptionNew(data) {
  // workItemIds
  // pageNum
  // pageSize
  // workItemEntityName
  return post('entityInstance/new/getItemEntityOption', data)
}

// 获取选项：工作项实例节点
export function getEntityNodeOptionNew(data) {
  // workItemId
  // workItemEntityId
  return get('entityInstance/new/getEntityNodeOption', data)
}

// 获取节点人员统计信息
export function getNodePersonStatistics(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  // registrantUseKey
  return get('hour/statistics/node/person', data)
}

// 获取选项：工作项实例节点下的任务
export function getEntityTaskOptionNew(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  return get('entityInstance/new/getEntityTaskOption', data)
}

/**  
 * 工时审批
 */

// 获取是否存在“待审批”提示
export function getHasApprove() {
  return get('approve/hasApprove')
}

// 获取全部审批、我的工时、我审批的的数据值
export function getApproveCount() {
  // 返回：allApprovalCount(全部审批) myWorkHoursCount(我发起的)
  //       waitApproveCount(待办) doneApproveCount(已办) myApprovalCount(兼容旧字段)
  return get('approve/getApproveCount')
}

// 获取工时审批表单数据-全部审批(单项)
export function postApproveAllList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/all', data)
}

// 获取工时审批表单数据-我发起的(单项)
export function postApproveSelfInitiatedList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/self/initiated', data)
}

// 获取工时审批表单数据-我审批的(单项)
// 历史接口，页面已拆分为下面的 待办 / 已办 两个接口，保留兼容
export function postApproveSelfApproveList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/self/approve', data)
}

// 获取工时审批表单数据-我的待办(单项)
export function postApproveSelfTodoList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus (固定传 1)
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/self/todo', data)
}

// 获取工时审批表单数据-我的已办(单项)
export function postApproveSelfDoneList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus (全部不传；已通过/已拒绝传 2/3)
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('approve/list/self/done', data)
}

// 获取工时审批表单数据-全部审批(批量)
export function postBatchApproveAllList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/all', data)
}

// 获取工时审批表单数据-我发起的(批量)
export function postBatchApproveSelfInitiatedList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/self/initiated', data)
}

// 获取工时审批表单数据-我审批的(批量)
// 历史接口，页面已拆分为下面的 待办 / 已办 两个接口，保留兼容
export function postBatchApproveSelfApproveList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/self/approve', data)
}

// 获取工时审批表单数据-我的待办(批量)
export function postBatchApproveSelfTodoList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus (固定传 1)
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/self/todo', data)
}

// 获取工时审批表单数据-我的已办(批量)
export function postBatchApproveSelfDoneList(data) {
  // staffIds
  // approvalNo
  // startTime
  // endTime
  // approvalStatus (全部不传；已通过/已拒绝传 2/3)
  // workItemId
  // workItemEntityId
  // nodeId
  // taskId
  // pageSize
  // pageNum
  return post('collect/approval/list/self/done', data)
}

// 获取批量审批的下拉数据
export function postBatchApproveSelectData(data) {
  return get(`collect/approval/getDetail/${data.id}`)
}

// 汇总审批-批量操作
export function postBatchApprove(data) {
  // approvalCollects:{
  //   collectId 汇总审批的id
  //   approvalIds 单项审批id
  // }
  // reason
  // type (pass:通过  refuse:拒绝 cancel:撤回    again_launch:再次发起)
  return post('collect/approval/handle/batch', data)
}

// 单项审批-页面数量
export function postSinglePageCount(data) {
  // tabType (1=全部审批 2=我发起的 3=我审批的 4=待办 5=已办)
  // tabType=5 时额外返回 doneApproveNum(已办总数)，passApproveNum/refuseApproveNum 复用为已办-已通过/已拒绝
  return post(`approve/total/num`, data)
}

// 汇总审批-页面数量
export function postBatchPageCount(data) {
  // tabType (1=全部审批 2=我发起的 3=我审批的 4=待办 5=已办)
  // tabType=5 时额外返回 doneApproveNum(已办总数)，passApproveNum/refuseApproveNum 复用为已办-已通过/已拒绝
  return post(`collect/approval/total/num`, data)
}

// 获取跳转工作项实例及节点的链接
export function getWorkItemUrl(data) {
  // workItemId
  // workItemEntityId
  // nodeId
  return get('work/hour/v2/work/url', data)
}

// 批量审批/批量拒绝
export function postBatchApproveHandle(data) {
  // ids
  // reason
  // type (pass:通过  refuse:拒绝)
  return post('approve/batchHandle', data)
}

// 处理审批/拒绝/撤回/删除的接口
export function postApproveHandle(data) {
  // id
  // reason
  // type (pass:通过  refuse:拒绝 cancel：撤销 delete：删除 again_launch:再次发起)
  // actWorkHour
  // workDate
  // workDesc
  return post('approve/handle', data)
}

// 获取审批详情
export function getApproveInfo(data) {
  // id
  return get(`approve/info/${data?.id}`)
}

// 获取审批明细
export function getApprovalLog(data) {
  // id
  return get(`approve/log/${data?.id}`)
}

//查询甘特图_V2.4版本的数据
export function postWorkGanttChartNewV2(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagementV2/queryWorkGanttChartV2', data)
}

//查询V2.4版本甘特图左边树结构点击工作项实例节点获取下级全部节点的数据
export function queryWorkItemAndWorkItemEntityV2(data) {
  return post('resourceManagementV2/queryWorkItemAndWorkItemEntityV2', data)
}

// //查询V2.4版本甘特图左边树结构点击工作项实例节点获取下级全部节点的数据
export function queryWorkItemEntityNodeAndTaskV2(data) {
  return post('resourceManagementV2/queryWorkItemEntityNodeAndTaskV2', data)
}
//查询V2.7.0版本资源管理-成员工时汇总
export function postWorkHoursTotalDetail(data) {
  return post('resourceManagementV2/user/workHours/total', data)
}

/** 方案中心 */

// 是否显示【领取 7 天免费权益】按钮
export function getHasFree() {
  return get(`plan/tenant/has/free`)
}

// 领取 7 天免费权益
export function getReceiveSevenDaysFree() {
  return get(`plan/tenant/receive/seven/days/free`)
}

// 获取当前租户启用的套餐
export function getTenantPlan() {
  return get(`plan/tenant/plan`)
}

// 获取购买记录
export function getPurchaseRecord() {
  return get(`plan/order/list/self`)
}

// 获取套餐权益列表
export function getPlanBenefitList() {
  return get(`plan/list`)
}
// 获取联系客服url
export function getFsChatUrl(){
  return get(`plan/tenant/chat/url`)
}
// 获取套餐立即缴费设置uuid
export function setJumpPayUuid(data){
  return post('config/in/the/plan',data)
}
export function getPayJumpInfo(data){
  return get(`config/in/the/plan/${data?.uuid}`)
}
//获取审批设置
export function getApprovalSettings(data){
  return get(`approval/config/info`)
}
//获取审批设置
export function getWorkitemRole(data){
  return get(`approval/config/workitem/roles?workItemId=${data?.workItemId}&roleName=${data?.roleName}`)
}
// 保存审批设置
export function postApprovalConfigInfo(data){
  return post('approval/config/info',data)
}
// 获取飞书审批规则列表
export function getFeishuApprovalRuleList(data){
  return get('approval/feishu/rule/list', data)
}
// 获取飞书审批规则详情（编辑弹窗回显）
export function getFeishuApprovalRuleDetail(id){
  return get(`approval/feishu/rule/${id}`)
}
// 飞书审批规则保存前 / 打开弹窗前校验（替代旧 approval/feishu/template/check）
// 非 200 返回 {code, msg} 由全局请求层弹提示；全部通过返回 200、data=null
export function postFeishuCheckTemplate(data){
  return post('approval/feishu/checkTemplate', data)
}
// 拉取飞书审批模板控件列表
export function getFeishuTemplateFields(data){
  return get('approval/feishu/template/fields', data)
}
// 飞书审批字段映射来源选项
export function getFeishuMappingSources(data){
  return get('approval/feishu/mapping/sources', data)
}
// 飞书审批规则-工作项类型列表（含是否已被规则占用 → 置灰）
export function getFeishuWorkItemTypes(data){
  return get('approval/config/getWorkItemTypes', data)
}
// 保存审批配置（飞书审批）
export function postApprovalConfigSave(data){
  return post('approval/config/save', data)
}
// 保存登记设置
export function saveRegistrationSettings(data){
  return post('config/saveRegistrationSettings',data)
}
// 获取登记设置
export function getRegistrationSettings(data){
  return get('config/getRegistrationSettings')
}
//登记查询登记工作项类型
export function getWorkItemOptionForRegister(params){
   return get('entityInstance/new/getWorkItemOptionForRegister', params)  
}

// 查询团队下的用户列表
export function queryTeamUserList(data){
  return get('team/queryTeamList',data)
}
//获取登记缓存
export function getRegisterCache(data){
   return get(`work/hour/v2/register/cache?point=${data?.type}`)  
}
//获取上次登记的筛选条件
export function getRegisterMemory(data){
   return get('work/hour/v2/register/memory', data)
}
//保存缓存
export function saveRegisterCache(data){
   return post(`work/hour/v2/register/cache`,data)  
}
//缓存
export function clearRegisterCache(data){
   return post(`work/hour/v2/clear/register/cache?point=${data?.point}`)  
}

// 批量登记-获取筛选记忆设置
export function getBatchMemorySetting(data){
   return getUserNumeralConfig(data)
}

// 批量登记-保存筛选记忆设置
export function postBatchMemorySetting(data){
   return postUserNumeralConfig(data)
}

// 查询登记工作项实例类型
export function getItemEntityOptions(params){
   return get('entityInstance/new/getItemEntityOption', params)  
}
//批量登记对象查询节点
export function queryExpandLevelNode(data){
   return post('/work/hour/v2/query/node/batch',data)  
}
//查询甘特图_V3.4版本的数据
export function postWorkGanttChartNewV3(data) {
  // userIdList
  // statisticType
  // startDate
  // endDate
  // isSynchronous
  // queryUserId
  return post('resourceManagementV3/queryWorkGanttChartV3', data)
}
//甘特图查询层级
export function queryGanttLevel(data){
   return get('level/query',data)  
}
//甘特图保存查询层级
export function saveGanttLevel(data){
   return post('level/save',data)  
}
//配置席位获取人员
export function querySeatAllUser(data){
  let url='seat/getSeat'
  if(data?.teamName)
  {url+=`?teamName=${data.teamName}`}
  return get(url)  
}
//配置席位获取团队/人员
export function querySeatAllTeam(data){
   return get('seat/team/all',data)  
}
//获取租户的席位数
export function saveSeat(data){
   return post('seat/save',data)  
}
//当前用户是否有使用权限
export function querySeatUserPermission(){
   return get('seat/check/self')  
}
//查询区间日期的登记工时情况
export function queryWorkHoursTotalDetail(data) {
  return post('hour/statistics/saturation/person/batch', data)
}
//是否需要展示团队配置
export function queryNeedShowTeamConfig(){
   return get('data/auth/show/team/configuration')  
}
//获取数据权限配置
export function getDataAuthConfig(){
   return get('data/auth/getConfig')  
}
//权限设置-搜索用户可查询的用户
export function searchAuthUser(data){
   return post('user/queryUserList',data)  
}
//保存数据权限配置
export function saveDataAuthConfig(data){
   return post('data/auth/saveConfig',data)  
}
//查询配置数量
export function queryDataAuthConfigCount(){
   return get('data/auth/getCount')  
}
//权限设置-查询全部人员
export function queryAuthAllUser(){
   return get('data/auth/getAllUser')  
}
//权限设置-查询团队
export function queryAuthTeamList(data){
   return get('data/auth/getTeamList',data)  
}
//获取可登记的层级映射
export function getRegisterableLevelMap(){
   return get('register/level/query')  
}
//获取工时提醒配置
export function getWorkHourReminderConfig(data){
   return get('config/getWorkHourRemind', data) 
}
//设置工时提醒配置
export function setWorkHourReminderConfig(data){
   return post('config/setWorkHourRemind', data) 
}
//记录规范-获取外部配置
export function getStandardsConfig(){
   return get('standards/getConfig/out') 
}
//记录规范-获取内部配置
export function getStandardsConfigDetail(data){
   return get('standards/getConfig/inner',data) 
}
//记录规范-保存记录配置
export function saveStandardsConfig(data){
   return post('standards/saveConfig',data) 
}
//记录规范-获取节假日配置
export function getStandardsConfigHoliday(data){
   return get('standards/getConfig/holiday', data) 
}
//记录规范-查询国家的节假日
export function queryCountryHoliday(data){
   return get('standards/getHolidayByCountryCode',data) 
}
//记录规范-重置国家节假日
export function resetStandardsConfigHoliday(data){
   return get('standards/reset',data) 
}
//记录规范-同步未来日历
export function syncFutureCalendar(data){
   return get('standards/syncFutureCalendar',data) 
}
//记录规范-删除记录规范
export function deleteStandardsConfig(data){
   return del(`standards/deletedById/${data.id}`) 
}
//记录规范-成员标准工时
export function getUserStandWorkHour(data){
   return get(`workHour/standWorkHour/user`,data) 
}
//记录规范-操作日期
export function operationTimeSave(data){
   return post(`standards/uuid/save`,data) 
}
//记录规范
export function standardsClearByUuid(data){
   return post(`standards/clearByUuid`,data) 
}
// 获取部门树根节点
export function getDeptTreeData(data) {
  // 返回根部门列表，每个节点含: deptId, deptName, parentPath, hasChildren
  return get('org/tree', data)
  //return get('http://172.16.2.138:9091/org/tree', data)
}
// 获取部门树根节点
export function getDeptTreeRoots(data) {
  // 返回根部门列表，每个节点含: deptId, deptName, parentPath, hasChildren
  return get('admin/getDeptTreeRoots', data)
}

// 获取部门子节点（子部门 + 成员）
export function getDeptTreeChildren(data) {
  // data: { deptId }
  // 返回: { childDepts: [...], members: [...] }
  return get('admin/getDeptTreeChildren', data)
}

// 搜索部门
export function searchDeptTree(data) {
  // data: { keyword }
  // 返回匹配的部门列表，含完整路径
  return get('admin/searchDeptTree', data)
}
// 获取租户模式信息
export function getTenantModeInfo() {
  return get('api/tenant/mode/info')
}
// 保存引导页展示状态
export function saveGuideDisplayed() {
  return post('api/tenant/mode/user/guide/displayed')
}
// 保存黄条提示展示状态
export function saveBannerDisplayed(bannerType) {
  return post('api/tenant/mode/user/banner/displayed')
}
// 切换租户模式
export function changeTenantMode(data) {
  return post('api/tenant/mode/change', data)
}
// 获取已安装工时插件的空间列表
export function getInstalledProjects() {
  return get('api/tenant/mode/installed-projects')
}
//飞书项目-登记设置-删除特殊节点流配置
export function deleteSpecialNodeFlowConfig(data) {
  return del(`config/deletedById/${data.id}`)
}
//飞书项目-权限设置-删除数据权限
export function deleteDataAuthConfig(data) {
  return del(`/data/auth/deleteById/${data.id}`)
}
/** ===================== 飞书考勤 ===================== */
//查询考勤配置状态
export function getAttendanceConfig(data) {
  return post('work/hour/v2/attendance/config/status', data)
}
//查询成员考勤数据
export function getUserAttendanceConfig(data) {
  return post('work/hour/v2/attendance/data/query', data)
}
//手动同步考勤数据
export function syncAttendanceConfig(data) {
  return post('work/hour/v2/attendance/data/sync', data)
}
//资源管理-查询成员考勤数据
export function getResourceUserAttendanceConfig(data) {
  return post('work/hour/v2/attendance/data/query/parallel', data)
}

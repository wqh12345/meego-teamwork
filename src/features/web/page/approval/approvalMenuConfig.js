/**
 * 工时审批 - 左侧菜单与顶部状态页签配置
 *
 * 左侧菜单：全部审批 | 我发起的 | 待办 | 已办
 * - 待办：固定查询待审批（status / approvalStatus = 1），不渲染状态页签
 *   接口：POST /approve/list/self/todo、POST /collect/approval/list/self/todo
 * - 已办：全部 / 待审批 / 已通过 / 已拒绝 状态页签，无批量操作
 *   接口：POST /approve/list/self/done、POST /collect/approval/list/self/done
 *   「全部」不传 approvalStatus，「待审批 / 已通过 / 已拒绝」传 1 / 2 / 3
 */

/** 左侧菜单 key */
export const MENU_KEY = {
  ALL: "all",
  SELF_INITIATED: "self-initiated",
  SELF_APPROVE_TODO: "self-approve-todo",
  SELF_APPROVE_DONE: "self-approve-done",
};

/**
 * 左侧菜单 key -> 后端 tabType
 * 枚举：1=全部审批 2=我发起的 3=我审批的 4=待办 5=已办
 * 注意：待办 / 已办 在 2026-09-23 由 3 / 4 调整为 4 / 5，3 留给「我审批的」。
 */
export const TAB_TYPE_MAP = {
  [MENU_KEY.ALL]: 1,
  [MENU_KEY.SELF_INITIATED]: 2,
  [MENU_KEY.SELF_APPROVE_TODO]: 4,
  [MENU_KEY.SELF_APPROVE_DONE]: 5,
};

/** 待办：固定查询“待审批” */
export const TODO_STATUS = "1";

/** 审批方式：1 自研审批，2 飞书审批 */
export const APPROVAL_TYPE_FEISHU = 2;

/** 是否为我审批的-待办 */
export const isSelfApproveTodo = (menu) => menu === MENU_KEY.SELF_APPROVE_TODO;

/** 是否为我审批的-已办 */
export const isSelfApproveDone = (menu) => menu === MENU_KEY.SELF_APPROVE_DONE;

/** 是否为我审批的（待办 + 已办） */
export const isSelfApprove = (menu) =>
  isSelfApproveTodo(menu) || isSelfApproveDone(menu);

/** 拼接带数量的页签文案 */
const withCount = (text, count) => `${text}（${count || 0}）`;

/**
 * 构建顶部状态页签
 * @param {object} params
 * @param {string} params.curMenu 当前左侧菜单 key
 * @param {object} params.counts 数量集合：all / wait / pass / refuse / cancel / revoke / done
 * @returns {Array|null} 返回 null 表示当前 tab 不渲染状态页签（待办）
 */
export function buildStatusMenuItems({ curMenu, counts = {} }) {
  if (isSelfApproveTodo(curMenu)) return null;

  if (isSelfApproveDone(curMenu)) {
    return [
      // 「全部」计数取列表接口同名字段：单条 approvalSignalNum / 汇总 approvalCollectNum（即 counts.all）
      { key: "0", label: withCount("全部", counts.all) },
      // 待审批：传参链与其他 tab 同一套（Number(key) -> status/approvalStatus = 1），计数用现有 waitApproveNum
      { key: "1", label: withCount("待审批", counts.wait) },
      { key: "2", label: withCount("已通过", counts.pass) },
      { key: "3", label: withCount("已拒绝", counts.refuse) },
    ];
  }

  return [
    { key: "0", label: withCount("全部", counts.all) },
    { key: "1", label: withCount("待审批", counts.wait) },
    { key: "2", label: withCount("已通过", counts.pass) },
    { key: "3", label: withCount("已拒绝", counts.refuse) },
    { key: "4", label: withCount("已撤回", counts.cancel) },
    { key: "5", label: withCount("已撤销", counts.revoke) },
  ];
}

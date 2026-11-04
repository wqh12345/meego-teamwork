import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { LeftOutline } from "antd-mobile-icons";
import { Toast, Dialog, TextArea, Popup } from "antd-mobile";
import { Typography } from "antd";
import { DownOutlined, CaretDownOutlined, CaretUpOutlined, ExportOutlined } from "@ant-design/icons";
import {
  getCollectApproveDetailList,
  getApprovalLog,
  getApproveInfo,
  postApproveHandle,
  postBatchApprove
} from "../../../../api/api";
import { openLinkInHost } from "../../../../util/util";
import "./index.less";

// 导入状态图片
import statusPendingImg from "../../../../image/status-pending.png";
import statusApprovedImg from "../../../../image/status-approved.png";
import statusRejectedImg from "../../../../image/status-rejected.png";
import statusWithdrawnImg from "../../../../image/status-withdrawn.png";
import statusCancelledImg from "../../../../image/status-cancelled.png";

import chexiao from "../../../../image/assets/chexiao.png";
import chehui from "../../../../image/assets/chehui.png";
import jujue from "../../../../image/assets/jujue.png";
import tongguo from "../../../../image/assets/tongguo.png";
import dengji from "../../../../image/assets/completed@2x.png";
// 导入其他图片
import noDataImage from "../../../../image/no-data-table.png";

/** 审批方式：1 自研审批，2 飞书审批 */
const APPROVAL_TYPE_FEISHU = 2;

// 审批状态配置
const statusConfig = {
  1: { label: '待审批', image: statusPendingImg, color: '#4247f6' },
  2: { label: '已通过', image: statusApprovedImg, color: '#52c41a' },
  3: { label: '已拒绝', image: statusRejectedImg, color: '#ff4d4f' },
  4: { label: '已撤回', image: statusWithdrawnImg, color: '#8c8c8c' },
  5: { label: '已撤销', image: statusCancelledImg, color: '#8c8c8c' },
};

const defaultStatusConfig = { label: '未知', image: statusPendingImg, color: '#8c8c8c' };
const getStatusConfig = (status) => statusConfig[status] || defaultStatusConfig;

// 审批结果配置
const approvalResultConfig = {
  2: { label: '通过', color: '#52c41a', bgColor: 'rgba(82, 196, 26, 0.1)' },
  3: { label: '拒绝', color: '#ff4d4f', bgColor: 'rgba(255, 77, 79, 0.1)' },
  4: { label: '撤回', color: '#8c8c8c', bgColor: 'rgba(140, 140, 140, 0.1)' },
  5: { label: '已撤销', color: '#8c8c8c', bgColor: 'rgba(140, 140, 140, 0.1)' },
  1: { label: '待审批', color: '#4247f6', bgColor: 'rgba(66, 71, 246, 0.1)' },
};
const defaultResultConfig = { label: '未知', color: '#8c8c8c', bgColor: 'rgba(140, 140, 140, 0.1)' };
const getResultConfig = (result) => approvalResultConfig[result] || defaultResultConfig;

// 获取变更类型文字
const getModifyTypeText = (type) => {
  const map = {
    'create': '新增',
    'edit': '修改',
    'delete': '删除',
  };
  return map[type] || type || '--';
};

// 获取日期范围显示
const getDateRange = (item) => {
  if (!item) return '--';
  const startDate = item.registrationStartDate || item.startDate || item.workDateStart;
  const endDate = item.registrationEndDate || item.endDate || item.workDateEnd;
  if (startDate && endDate) {
    if (startDate === endDate) return startDate;
    return `${startDate}至${endDate}`;
  }
  if (item.workDate) {
    return dayjs(item.workDate).format('YYYY/MM/DD');
  }
  return '--';
};

const ApprovalDetail = () => {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [approvalLogList, setApprovalLogList] = useState([]);
  const [workDescPopupVisible, setWorkDescPopupVisible] = useState(false);
  const [currentWorkDesc, setCurrentWorkDesc] = useState('');
  // 审批方式 / 跳转地址（列表数据不含这两个字段，需补取）
  const [instanceInfo, setInstanceInfo] = useState(null);
  
  // 从 location state 获取初始数据（如果有）
  const initialData = location.state?.item;
  // 列表行数据（列表跳转时带过来的整行）：跳转只取其 instanceCode，审批明细显隐只看其 approvalType
  const listRecord = initialData || null;
  // 飞书审批才展示跳转；approvalType 取详情/补取值，为空回退列表行；
  // instanceCode 只取列表行值（详情接口的值不参与），前端拼 applink
  const approvalJumpCode =
    Number(
      detail?.approvalType ??
        instanceInfo?.approvalType ??
        listRecord?.approvalType,
    ) === APPROVAL_TYPE_FEISHU
      ? listRecord?.instanceCode || ""
      : "";
  
  // 返回上一页
  const handleBack = () => {
    navigate(-1);
  };
  
  // 获取详情数据
  const fetchDetail = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      if (type === 'single') {
        // 单项审批：调用接口获取审批明细
        const res = await getApprovalLog({ id });
        console.log('[ApprovalDetail] 单项审批详情:', res);
        if ((res?.result || res?.code === 200) && res.data) {
          // 如果有列表传来的数据，优先使用列表数据作为 detail，否则用接口返回的
          if (!initialData) {
            setDetail(res.data);
          }
          // 接口返回的数据用于审批明细卡片
          setApprovalLogList(Array.isArray(res.data) ? res.data : res.data.logs || []);
        }
      } else {
        // 汇总审批详情
        const res = await getCollectApproveDetailList({ id });
        console.log('[ApprovalDetail] 汇总审批详情:', res);
        if ((res?.result || res?.code === 200) && res.data) {
          setDetail(res.data);
          setInstanceInfo({
            approvalType: res.data.approvalType,
            instanceCode: res.data.instanceCode,
          });
        }
      }
    } catch (error) {
      console.error('获取审批详情失败:', error);
      Toast.show({ content: '获取详情失败', position: 'center' });
    } finally {
      setLoading(false);
    }
  };

  // 补取「审批方式 / 跳转地址」
  // 单项审批的基本信息来自列表接口，不含这两个字段；汇总审批详情接口会返回，无需补取
  const fetchInstanceInfo = async () => {
    if (!id) return;
    try {
      const res = await getApproveInfo({ id });
      if (res?.data) {
        setInstanceInfo({
          approvalType: res.data.approvalType,
          instanceCode: res.data.instanceCode,
        });
      }
    } catch (error) {
      // 补取失败不影响详情主体，仅不展示「跳转」按钮
      console.warn('[ApprovalDetail] 获取跳转信息失败:', error);
    }
  };

  // 跳转到飞书审批页：instanceCode 只取列表行，前端拼飞书 applink
  const handleJump = () => {
    if (!approvalJumpCode) return;
    openLinkInHost(
      `https://applink.feishu.cn/client/mini_program/open?appId=cli_9cb844403dbb9108&path=pages%2Fdetail%2Findex%3FinstanceId%3D${approvalJumpCode}`,
    );
  };
  
  useEffect(() => {
    // 单项审批：如果有列表数据，立即设置 detail 渲染基本信息
    if (type === 'single' && initialData) {
      setDetail(initialData);
    }
    // 调用接口获取审批明细数据
    fetchDetail();
    // 单项审批：基本信息来自列表接口，不含「审批方式 / 跳转地址」，需补取；
    // 汇总审批详情接口已直接返回这两个字段，无需补取
    if (type === 'single') {
      fetchInstanceInfo();
    }
  }, [id, type]);

  // 撤回操作
  const handleWithdraw = () => {
    if (!detail) return;
    
    let reason = '';
 const dialogHandler = Dialog.show({
      title: '确认撤回？',
      content: '您确认撤回该条记录吗',
      className: 'delete-dialog',
      actions: [
        {
          key: 'confirm',
          text: '确定撤回',
          style: {
            backgroundColor: '#4247f6',
            color: '#ffffff',
            borderRadius: '8px',
            height: '48px',
            fontSize: '16px',
            marginBottom: '8px',
          },
          onClick: async () => {
            try {
              let res;
              if (type === 'summary') {
                const data = {
                  approvalCollects: [{ collectId: detail.id, approvalIds: [] }],
                  type: 'cancel',
                  reason,
                };
                res = await postBatchApprove(data);
              } else {
                const data = { id: detail.id, type: 'cancel', reason };
                res = await postApproveHandle(data);
              }
              
              if (res?.result || res?.code === 200) {
                Toast.show({ content: '撤回成功', position: 'center' });
                handleBack();
                dialogHandler.close();
              } else {
                Toast.show({ content: res?.message || '撤回失败', position: 'center' });
              }
            } catch (error) {
              Toast.show({ content: '撤回失败', position: 'center' });
            }
          },
        },
        {
          key: 'cancel',
          text: '取消',
          style: {
            color: '#8c8c8c',
            fontSize: '16px',
            height: '48px',
            backgroundColor: 'transparent',
            border: 'none',
          },
          onClick: () => {
            // 关闭弹窗
            dialogHandler.close();
          },
        },
      ],
    });
  };

  // 撤销操作
  const handleRevoke = () => {
    if (!detail) return;
    
    let revokeType = 'revoke';
    if (detail.operationList?.includes('revoke')) {
      revokeType = 'revoke';
    } else if (detail.operationList?.includes('delete')) {
      revokeType = 'delete';
    }
    
    const contentText = revokeType === 'delete' 
      ? '您即将撤销该条工时审批记录，撤销后审批单关闭不可操作。'
      : '您即将撤销该条工时审批记录，撤销后不可恢复。';
    
    const dialogHandler = Dialog.show({
      title: '确认撤销？',
      content: '您确认撤销该条记录吗',
      className: 'delete-dialog',
      actions: [
        {
          key: 'confirm',
          text: '确定撤销',
          style: {
            backgroundColor: '#4247f6',
            color: '#ffffff',
            borderRadius: '8px',
            height: '48px',
            fontSize: '16px',
            marginBottom: '8px',
          },
          onClick: async () => {
            try {
              let res;
              if (type === 'summary') {
                const data = {
                  approvalCollects: [{ collectId: detail.id, approvalIds: [] }],
                  type: 'delete',
                  reason: '',
                };
                res = await postBatchApprove(data);
              } else {
                const data = { id: detail.id, type: revokeType, reason: '' };
                res = await postApproveHandle(data);
              }
              
              if (res?.result || res?.code === 200) {
                Toast.show({ content: '撤销成功', position: 'center' });
                handleBack();
                dialogHandler.close();
              } else {
                Toast.show({ content: res?.message || '撤销失败', position: 'center' });
              }
            } catch (error) {
              Toast.show({ content: '撤销失败', position: 'center' });
            }
          },
        },
        {
          key: 'cancel',
          text: '取消',
          style: {
            color: '#8c8c8c',
            fontSize: '16px',
            height: '48px',
            backgroundColor: 'transparent',
            border: 'none',
          },
          onClick: () => {
            // 关闭弹窗
            dialogHandler.close();
          },
        },
      ],
    });
  };

  // 再次发起
  const handleAgainLaunch = () => {
    if (!detail) return;
    
    if (detail.tag === 0) {
      Toast.show({ content: '此登记对象已删除，无法进行编辑', position: 'center' });
      return;
    }
    
    if (detail.modifyType === 'delete') {
      Dialog.confirm({
        title: '确认再次发起审批？',
        content: '当前工时审批变更类型为 [删除]，审批通过后对应的工时日志将成功删除，不可恢复。',
        confirmText: '确定',
        cancelText: '取消',
        onConfirm: async () => {
          try {
            const data = {
              id: detail.id,
              type: 'again_launch',
              reason: '',
              actWorkHour: detail.actWorkHour,
              workDesc: detail.workDesc,
              workDate: detail.workDate,
              modifyType: detail.modifyType,
            };
            const res = await postApproveHandle(data);
            if (res?.result || res?.code === 200) {
              Toast.show({ content: '再次发起审批成功', position: 'center' });
              handleBack();
            } else {
              Toast.show({ content: res?.message || '再次发起失败', position: 'center' });
            }
          } catch (error) {
            Toast.show({ content: '再次发起失败', position: 'center' });
          }
        },
      });
    } else {
      Toast.show({ content: '请在 PC 端进行编辑操作', position: 'center' });
    }
  };

  if (loading && !detail) {
    return (
      <div className="detail-container">
        <div className="detail-header">
          <div className="header-left" onClick={handleBack}>
            <LeftOutline fontSize={20} />
          </div>
          <div className="header-title">详情</div>
          <div className="header-right"></div>
        </div>
        <div style={{ padding: '100px 20px', textAlign: 'center' }}>加载中...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="detail-container">
        <div className="detail-header">
          <div className="header-left" onClick={handleBack}>
            <LeftOutline fontSize={20} />
          </div>
          <div className="header-title">详情</div>
          <div className="header-right"></div>
        </div>
        <div style={{ padding: '100px 20px', textAlign: 'center' }}>暂无数据</div>
      </div>
    );
  }

  // 单项审批详情
  if (type === 'single') {
    return (
      <div className="detail-container">
        {/* 顶部导航 */}
        <div className="detail-header">
          <div className="header-left" onClick={handleBack}>
            <LeftOutline fontSize={20} />
          </div>
          <div className="header-title">详情</div>
          {approvalJumpCode ? (
            <div className="header-right">
              <span className="header-jump" onClick={handleJump}>
                <ExportOutlined />
                <span>跳转</span>
              </span>
            </div>
          ) : null}
        </div>

        {/* 内容区域 */}
        <div className="detail-content">
          {/* 基本信息卡片 */}
          <div className="detail-card basic-info">
            <div className="basic-header">
              <span className="date-range">{getDateRange(detail)}</span>
              <img
                className="detail-status-img"
                src={getStatusConfig(detail.approvalStatus).image}
                alt={getStatusConfig(detail.approvalStatus).label}
              />
            </div>
            <div className="basic-meta">
              <p>{detail.staffName || '--'}于 {detail.createTime ? dayjs(detail.createTime).format("YYYY-MM-DD HH:mm:ss") : '--'} 创建</p>
              <p>{detail.updateName || '--'}于 {detail.updateTime ? dayjs(detail.updateTime).format("YYYY-MM-DD HH:mm:ss") : '--'} 更新</p>
            </div>
            <div className="approval-no">
              审批单：{detail.approvalNo || '--'}
            </div>
          </div>

          {/* 登记工时卡片 */}
          <div className="detail-card work-hour-card">
            <div className="card-title">登记工时</div>
            <div className="summary-row">
              <div className="summary-item">
                <span className="label">变更类型</span>
                <span className="value">{getModifyTypeText(detail.modifyType)}</span>
              </div>
              <div className="summary-item">
                <span className="label">登记工时</span>
                <span className="value">{detail.actWorkHour ? `${detail.actWorkHour}h` : '--'}</span>
              </div>
              <div className="summary-item">
                <span className="label">成员</span>
                <div className="member-info">
                  {detail.staffAvatarUrl ? (
                    <img src={detail.staffAvatarUrl} alt={detail.staffName || '成员头像'} className="member-avatar" />
                  ) : (
                    <div className="member-avatar">{detail.staffName?.slice(0, 1) || '?'}</div>
                  )}
                  <span className="member-name">{detail.staffName || '--'}</span>
                </div>
              </div>
            </div>

          
              <div className="work-desc-section">
                <div className="work-desc-header">
                  <span className="work-desc-label">工作描述</span>
                </div>
                {detail.workDesc ? (
                  <Typography.Paragraph
                    ellipsis={{
                      rows: 2,
                      expandable: 'collapsible',
                      symbol: (expanded) => expanded
                        ? <span style={{ color: '#4247f6' }}>收起 <CaretUpOutlined style={{ fontSize: '10px' }} /></span>
                        : <span style={{ color: '#4247f6' }}>展开 <CaretDownOutlined style={{ fontSize: '10px' }} /></span>,
                    }}
                    style={{ margin: 0, fontSize: '14px', color: '#262626', lineHeight: '1.6' }}
                  >
                    {detail.workDesc}
                  </Typography.Paragraph>
                ) : (
                  <div className="work-desc-content">--</div>
                )}
              </div>
          

            <div className="work-item-detail">
              <div className="work-row">
                <span className="work-label">所属工作项</span>
                <span className="work-value">{detail.workItemName || '--'}</span>
              </div>
              <div className="work-row">
                <span className="work-label">工作项实例</span>
                <span className="work-value">{detail.workItemEntityName || '--'}</span>
              </div>
              <div className="work-row">
                <span className="work-label">节点</span>
                <span className="work-value">{detail.nodeName || '--'}</span>
              </div>
              <div className="work-row">
                <span className="work-label">任务</span>
                <span className="work-value">{detail.taskName || '--'}</span>
              </div>
              <div className="work-row">
                <span className="work-label">已登记工时</span>
                <span className="work-value">
                  {detail.registeredWorkTime ? `${detail.registeredWorkTime}` : '--'}
                  
                </span>
              </div>
            </div>
          </div>

          {/* 飞书审批（列表行 approvalType=2）：审批明细整块隐藏；1 或 null 正常显示；只在有数据时显示 */}
          {Number(listRecord?.approvalType) !== APPROVAL_TYPE_FEISHU &&
            approvalLogList && approvalLogList.length > 0 && (
            <div className="detail-card approval-records-card">
              <div className="card-title">审批明细</div>
              {approvalLogList.filter(record => record !== null && record !== undefined).map((record, index) => (
                <div key={record.id || index} className="approval-record">
                  {/* 待审批/审批中状态特殊展示 */}
                  {(record.approvalResult === '待审批' || record.approvalResult === '审批中' || (!record.approvalResult && !record.approvalTime)) ? (
                    <div className="pending-approval-section">
                      <div className="pending-header">
                        <div className="pending-avatar-container">
                          <div className="pending-main-avatar">
                            {/* 蓝底白色用户图标 */}
                            <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                            <span className="pending-clock-badge">
                              <img src={dengji} alt="待审批" style={{ width: '14px', height: '14px' }} />
                            </span>
                          </div>
                        </div>
                        <div className="pending-info">
                          <div className="pending-title"> 待审批</div>
                          <div className="pending-condition">{record.approvalCondition || '1人通过即可'}</div>
                          {/* 待审批人员列表 - 放在标题信息下方 */}
                          {record.waitApprovalList && record.waitApprovalList.length > 0 && (
                            <div className="pending-users-inline">
                              {record.waitApprovalList.map((user, userIndex) => (
                                <div key={user.userKey || userIndex} className="pending-user-item">
                                  <div className="pending-user-avatar">
                                    {user.avatarUrl ? (
                                      <img src={user.avatarUrl} alt={user.nameCn || '审批人'} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                    ) : (
                                      <span>{user.nameCn?.slice(0, 2) || '?'}</span>
                                    )}
                                    <span className="pending-clock-icon">
                                      <img src={dengji} alt="待审批" style={{ width: '12px', height: '12px' }} />
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 已处理状态展示（原有逻辑） */
                    <>
                      <div className="record-header">
                        <div className="approver-info">
                          <div className="avatar-container">
                            <div className="approver-avatar">
                              {record.processorAvatarUrl ? (
                                <img src={record.processorAvatarUrl} alt={record.processingUserName || '审批人头像'} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                              ) : (
                                record.processingUserName?.slice(0, 1) || '?'
                              )}
                              <span
                                className="result-icon"
                                style={{  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
                              >
                                {record.approvalResult === '通过' ? (
                                  <img src={tongguo} alt="通过" style={{ width: '12px', height: '12px' }} />
                                ) : record.approvalResult === '拒绝' ? (
                                  <img src={jujue} alt="拒绝" style={{ width: '12px', height: '12px' }} />
                                ) : record.approvalResult === '撤回' ? (
                                  <img src={chehui} alt="撤回" style={{ width: '12px', height: '12px' }} />
                                ) : record.approvalResult === '已撤销' ? (
                                  <img src={chexiao} alt="已撤销" style={{ width: '12px', height: '12px' }} />
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#ffffff' }}>●</span>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="approver-detail">
                            <div className="stage-name">{record.approvalStageName || '审批阶段名称'}</div>
                            <div className="approver-meta">
                              <span className="name">{record.processorName || '--'}</span>
                              <span className="time">{record.approvalTime ? dayjs(record.approvalTime).format('YYYY.MM.DD HH:mm:ss') : '--'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="record-content">
                        <div
                          className="result-tag"
                          style={{
                            // color: getResultConfig(record.approvalResult).color,
                            // background: getResultConfig(record.approvalResult).bgColor
                          }}
                        >
                          {record.approvalResult }
                        </div>
                        {record.approvalOpinion && (
                          <div className="comment">审批意见：{record.approvalOpinion}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        {(detail.operationList?.includes('cancel') || detail.operationList?.includes('revoke') || detail.operationList?.includes('delete') || detail.operationList?.includes('again_launch')) && (
          <div className="detail-footer">
            {detail.operationList?.includes('cancel') && (
              <button className="withdraw-btn" onClick={handleWithdraw}>撤回</button>
            )}
            {/* {detail.operationList?.includes('again_launch') && (
              <button className="again-launch-btn" onClick={handleAgainLaunch}>再次发起</button>
            )} */}
            {(detail.operationList?.includes('revoke') || detail.operationList?.includes('delete')) && (
              <button className="revoke-btn" onClick={handleRevoke}>撤销</button>
            )}
          </div>
        )}
      </div>
    );
  }

  // 汇总审批详情
  return (
    <div className="detail-container">
      {/* 顶部导航 */}
      <div className="detail-header">
        <div className="header-left" onClick={handleBack}>
          <LeftOutline fontSize={20} />
        </div>
        <div className="header-title">详情</div>
        {approvalJumpCode ? (
          <div className="header-right">
            <span className="header-jump" onClick={handleJump}>
              <ExportOutlined />
              <span>跳转</span>
            </span>
          </div>
        ) : null}
      </div>

      {/* 内容区域 */}
      <div className="detail-content">
        {/* 基本信息卡片 */}
        <div className="detail-card basic-info">
          <div className="basic-header">
            <span className="date-range">{getDateRange(detail)}</span>
            <img
              className="detail-status-img"
              src={getStatusConfig(detail.status).image}
              alt={getStatusConfig(detail.status).label}
            />
          </div>
          <div className="basic-meta">
            <p>{detail.staffName || '--'}于 {detail.createTime ? dayjs(detail.createTime).format("YYYY-MM-DD HH:mm:ss") : '--'} 创建</p>
            <p>{detail.staffName || '--'}于 {detail.updateTime ? dayjs(detail.updateTime).format("YYYY-MM-DD HH:mm:ss") : '--'} 更新</p>
          </div>
          <div className="approval-no">
            审批单：{detail.bpApprovalNo || '--'}
          </div>
        </div>

        {/* 登记工时卡片 */}
        <div className="detail-card work-hour-card">
          <div className="card-title">登记工时</div>
          <div className="summary-row">
            <div className="summary-item">
              <span className="label">变更类型</span>
              <span className="value">{getModifyTypeText(detail.modifyType)}</span>
            </div>
            <div className="summary-item">
              <span className="label">汇总工时</span>
              <span className="value">{detail.totalWorkHour ? `${detail.totalWorkHour}小时` : '--'}</span>
            </div>
            <div className="summary-item">
              <span className="label">成员</span>
              <div className="member-info">
                {detail.staffAvatarUrl ? (
                  <img src={detail.staffAvatarUrl} alt={detail.staffName || '成员头像'} className="member-avatar" />
                ) : (
                  <div className="member-avatar">{detail.staffName?.slice(0, 1) || '?'}</div>
                )}
                <span className="member-name">{detail.staffName || '--'}</span>
              </div>
            </div>
          </div>

          {/* 工时明细列表 */}
          {detail.approvalRecordInfoVoList?.map((item, index) => (
            <div key={item.id || index} className="work-item">
              <div className="work-row">
                <span className="work-label">所属工作项</span>
                <span className="work-value">{item.workItemName || '--'}</span>
              </div>
              <div className="work-row">
                <span className="work-label">登记对象</span>
                <span className="work-value">
                  {item.workItemEntityName || '--'}
                  {item.nodeName ? `/${item.nodeName}` : ''}
                  {item.taskName ? `/${item.taskName}` : ''}
                </span>
              </div>
              <div className="work-row">
                <span className="work-label">工作日期</span>
                <span className="work-value">{item.workDate ? dayjs(item.workDate).format("YYYY-MM-DD") : '--'}</span>
              </div>
              <div className="work-row">
                <span className="work-label">登记工时</span>
                <span className="work-value">{item.actWorkHour ? `${item.actWorkHour}小时` : '--'}</span>
              </div>
              <div className="work-row">
                <span className="work-label">工作描述</span>
                {item.workDesc ? (
                  <span 
                    className="work-value link" 
                    onClick={() => {
                      setCurrentWorkDesc(item.workDesc);
                      setWorkDescPopupVisible(true);
                    }}
                  >
                    查看描述
                  </span>
                ) : (
                  <span className="work-value">--</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 飞书审批（列表行 approvalType=2）：审批明细整块隐藏；1 或 null 正常显示；只在有数据时显示 */}
        {Number(listRecord?.approvalType) !== APPROVAL_TYPE_FEISHU &&
          detail.approvalCollectLogVoList && detail.approvalCollectLogVoList.length > 0 && (
          <div className="detail-card approval-records-card">
            <div className="card-title">审批明细</div>
            {detail.approvalCollectLogVoList.filter(record => record !== null && record !== undefined).map((record, index) => (
              <div key={record.id || index} className="approval-record">
                {/* 待审批/审批中状态特殊展示 */}
                {(record.approvalResult === '待审批' || record.approvalResult === '审批中' || (!record.approvalResult && !record.approvalTime)) ? (
                  <div className="pending-approval-section">
                    <div className="pending-header">
                      <div className="pending-avatar-container">
                        <div className="pending-main-avatar">
                          {/* 蓝底白色用户图标 */}
                          <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                          <span className="pending-clock-badge">
                            <img src={dengji} alt="待审批" style={{ width: '14px', height: '14px' }} />
                          </span>
                        </div>
                      </div>
                      <div className="pending-info">
                        <div className="pending-title"> 待审批</div>
                        <div className="pending-condition">{record.approvalCondition || '1人通过即可'}</div>
                        {/* 待审批人员列表 - 放在标题信息下方 */}
                        {record.waitApprovalList && record.waitApprovalList.length > 0 && (
                          <div className="pending-users-inline">
                            {record.waitApprovalList.map((user, userIndex) => (
                              <div key={user.userKey || userIndex} className="pending-user-item">
                                <div className="pending-user-avatar">
                                  {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt={user.nameCn || '审批人'} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                  ) : (
                                    <span>{user.nameCn?.slice(0, 2) || '?'}</span>
                                  )}
                                  <span className="pending-clock-icon">
                                    <img src={dengji} alt="待审批" style={{ width: '12px', height: '12px' }} />
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 已处理状态展示（原有逻辑） */
                  <>
                    <div className="record-header">
                      <div className="approver-info">
                        <div className="avatar-container">
                            <div className="approver-avatar">
                              {record.processingUserAvatarUrl ? (
                                <img src={record.processingUserAvatarUrl} alt={record.processingUserName || '审批人头像'} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                              ) : (
                                record.processingUserName?.slice(0, 1) || '?'
                              )}
                              <span
                                className="result-icon"
                                style={{  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
                              >
                                {record.approvalResult === '通过' ? (
                                  <img src={tongguo} alt="通过" style={{ width: '12px', height: '12px' }} />
                                ) : record.approvalResult === '拒绝' ? (
                                  <img src={jujue} alt="拒绝" style={{ width: '12px', height: '12px' }} />
                                ) : record.approvalResult === '撤回' ? (
                                  <img src={chehui} alt="撤回" style={{ width: '12px', height: '12px' }} />
                                ) : record.approvalResult === '已撤销' ? (
                                  <img src={chexiao} alt="已撤销" style={{ width: '12px', height: '12px' }} />
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#ffffff' }}>●</span>
                                )}
                              </span>
                            </div>
                          </div>
                        <div className="approver-detail">
                          <div className="stage-name">{record.approvalStageName || '--'}</div>
                          <div className="approver-meta">
                            <span className="name">{record.processingUserName || '--'}</span>
                            <span className="time">{ record.approvalTime ? dayjs(record.approvalTime).format('YYYY.MM.DD HH:mm:ss') : '--'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="record-content">
                      <div
                        className="result-tag"
                        style={{
                          // color: getResultConfig(record.status).color,
                          // background: getResultConfig(record.status).bgColor
                          textAlign:'left'
                        }}
                      >
                        {record.approvalResult }
                      </div>
                      {/* <div className="comment">审批意见：{record.approvalOpinion || '--'}</div> */}
                      {record.approvalOpinion && (
                        <div className="comment">审批意见：{record.approvalOpinion || '--'}</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部操作按钮 */}
      {(detail.operationList?.includes('cancel') || detail.operationList?.includes('revoke') || detail.operationList?.includes('delete') || detail.operationList?.includes('again_launch')) && (
        <div className="detail-footer">
          {detail.operationList?.includes('cancel') && (
            <button className="withdraw-btn" onClick={handleWithdraw}>撤回</button>
          )}
          {/* {detail.operationList?.includes('again_launch') && (
            <button className="again-launch-btn" onClick={handleAgainLaunch}>再次发起</button>
          )} */}
          {(detail.operationList?.includes('revoke') || detail.operationList?.includes('delete')) && (
            <button className="revoke-btn" onClick={handleRevoke}>撤销</button>
          )}
        </div>
      )}

      {/* 工作描述弹窗 */}
      <Popup
        visible={workDescPopupVisible}
        onMaskClick={() => setWorkDescPopupVisible(false)}
        bodyStyle={{
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          minHeight: '40vh',
          maxHeight: '70vh',
          padding: '0',
        }}
      >
        <div className="work-desc-popup">
          <div className="popup-header">
            <span className="popup-title">工作描述</span>
            <span className="popup-close" onClick={() => setWorkDescPopupVisible(false)}>取消</span>
          </div>
          <div className="popup-content">
            {currentWorkDesc || '--'}
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default ApprovalDetail;

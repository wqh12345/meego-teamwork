import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { LeftOutline, MoreOutline, CloseOutline } from "antd-mobile-icons";
import { Toast, PullToRefresh, InfiniteScroll, Dialog, TextArea } from "antd-mobile";
import PCOperationPrompt from "../../components/PCOperationPrompt";
import {
  getApproveCount,
  postSinglePageCount,
  postBatchPageCount,
  postBatchApproveSelfInitiatedList,
  postBatchApproveAllList,
  postApproveAllList,
  postApproveSelfInitiatedList,
  postApproveHandle,
  postBatchApprove
} from "../../../../api/api";
import "./index.less";

// 导入状态图片
import statusPendingImg from "../../../../image/status-pending.png";
import statusApprovedImg from "../../../../image/status-approved.png";
import statusRejectedImg from "../../../../image/status-rejected.png";
import statusWithdrawnImg from "../../../../image/status-withdrawn.png";
import statusCancelledImg from "../../../../image/status-cancelled.png";

// 导入其他图片
import noDataImage from "../../../../image/no-data-table.png";

// 分页配置
const PAGE_SIZE = 10;

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

const MbApproval = ({ loginUser }) => {
  const navigate = useNavigate();
  const filterTagsRef = useRef(null);
  const scrollContainerRef = useRef(null); // 滚动容器ref
  const [mainTab, setMainTab] = useState(() => {
    const saved = sessionStorage.getItem('mbApproval_mainTab');
    return saved || '2';
  });
  const [subTab, setSubTab] = useState(() => {
    const saved = sessionStorage.getItem('mbApproval_subTab');
    return saved || 'summary';
  });
  const [filterStatus, setFilterStatus] = useState(() => {
    const saved = sessionStorage.getItem('mbApproval_filterStatus');
    return saved || 'all';
  });

  // 列表数据状态
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多状态
  const [pageNum, setPageNum] = useState(() => {
    const saved = sessionStorage.getItem('mbApproval_pageNum');
    return parseInt(saved) || 1;
  });
  const [hasMore, setHasMore] = useState(true);
  const [subTabTotals, setSubTabTotals] = useState({ summary: 0, single: 0 });

  // 筛选状态数量
  const [batchNum, setBatchNum] = useState({});
  const [singleNum, setSingleNum] = useState({});

  // Tab计数
  const [tabCounts, setTabCounts] = useState({
    allApprovalCount: 0,
    myApprovalCount: 0,
    myWorkHoursCount: 0,
  });

  // 保存状态到sessionStorage
  const saveState = () => {
    sessionStorage.setItem('mbApproval_mainTab', mainTab);
    sessionStorage.setItem('mbApproval_subTab', subTab);
    sessionStorage.setItem('mbApproval_filterStatus', filterStatus);
    sessionStorage.setItem('mbApproval_pageNum', pageNum.toString());
    // 保存滚动位置
    if (scrollContainerRef.current) {
      sessionStorage.setItem('mbApproval_scrollTop', scrollContainerRef.current.scrollTop.toString());
    }
  };

  // 恢复滚动位置
  const restoreScrollPosition = () => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const savedScrollTop = sessionStorage.getItem('mbApproval_scrollTop');
        if (savedScrollTop) {
          scrollContainerRef.current.scrollTop = parseInt(savedScrollTop);
        }
      }
    }, 100);
  };

  const mainTabs = [
    { key: '1', label: '全部审批', count: tabCounts.allApprovalCount },
    { key: '2', label: '我发起的', count: tabCounts.myWorkHoursCount },
    { key: '3', label: '我审批的', count: tabCounts.myApprovalCount },
  ];

  const subTabs = [
    { key: 'summary', label: '汇总审批', count: subTabTotals.summary },
    { key: 'single', label: '单项审批', count: subTabTotals.single },
  ];

  const getFilterCount = (key) => {
    const numData = subTab === 'summary' ? batchNum : singleNum;
    let count = 0;
    switch (key) {
      case 'all':
        count = subTab === 'summary' ? numData.approvalCollectNum : numData.approvalSignalNum;
        break;
      case 'pending': count = numData.waitApproveNum; break;
      case 'approved': count = numData.passApproveNum; break;
      case 'rejected': count = numData.refuseApproveNum; break;
      case 'withdrawn': count = numData.cancelApproveNum; break;
      case 'cancelled': count = numData.revokeApproveNum; break;
      default: count = 0;
    }
    return count || 0;
  };

  const filterTags = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待审批' },
    { key: 'approved', label: '已通过' },
    { key: 'rejected', label: '已拒绝' },
    { key: 'withdrawn', label: '已撤回' },
    { key: 'cancelled', label: '已撤销' },
  ];

  const buildRequestParams = (page = 1) => {
    const params = { pageNum: page, pageSize: 10 };
    const statusMap = { 'pending': 1, 'approved': 2, 'rejected': 3, 'withdrawn': 4, 'cancelled': 5 };
    if (filterStatus !== 'all') {
      // 汇总审批时参数名为status，单项审批时为approvalStatus
      const paramName = subTab === 'summary' ? 'status' : 'approvalStatus';
      params[paramName] = statusMap[filterStatus];
      console.log('buildRequestParams params:', params);
    }
  
    return params;
  };

  // 获取审批数量
  const fetchApproveCounts = async () => {
    try {
      const res = await getApproveCount();
      if (res?.result || res?.data) {
        const data = res.data || {};
        setTabCounts(prev => ({
          ...prev,
          allApprovalCount: data.allApprovalCount || 0,
          myApprovalCount: data.myApprovalCount || 0,
          myWorkHoursCount: data.myWorkHoursCount || 0
        }));
      }
    } catch (error) {
      console.error('获取审批数量失败:', error);
    }
  };

  // 获取子Tab数量
  const fetchSubTabCounts = async (tabType) => {
    try {
      const data = { tabType: Number(tabType) };
      const [batchRes, singleRes] = await Promise.all([
        postBatchPageCount(data),
        postSinglePageCount(data)
      ]);

      if (batchRes?.result || batchRes?.data) {
        const batchData = batchRes.data || {};
        setBatchNum(batchData);
        setSubTabTotals(prev => ({ ...prev, summary: batchData.approvalCollectNum || 0 }));
      }

      if (singleRes?.result || singleRes?.data) {
        const singleData = singleRes.data || {};
        setSingleNum(singleData);
        setSubTabTotals(prev => ({ ...prev, single: singleData.approvalSignalNum || 0 }));
      }
    } catch (error) {
      console.error('获取子Tab数量失败:', error);
    }
  };

  // 获取列表数据
  const fetchList = async (page = 1, isRefresh = false) => {
    // 防止重复加载
    if (isRefresh) {
      if (loading) return;
      setLoading(true);
    } else {
      if (loadingMore) return;
      setLoadingMore(true);
    }

    try {
      console.log('fetchList params:', buildRequestParams(page));
      const params = { ...buildRequestParams(page),  pageSize: PAGE_SIZE };
      const apiCall = subTab === 'summary' ? postBatchApproveSelfInitiatedList : postApproveSelfInitiatedList;
      const res = await apiCall(params);

      if (res?.code === 200 || res?.result) {
        const responseData = res.data?.data || res.data;
        console.log('responseData:', responseData);
        let rawList = [];
        if (Array.isArray(responseData)) {
          rawList = responseData;
        } else if (responseData?.list) {
          rawList = responseData.list;
        } else if (responseData?.records) {
          rawList = responseData.records;
        }
        const newList = Array.isArray(rawList) ? rawList : [];

        if (isRefresh || page === 1) {
          setList(newList);
        } else {
          setList(prev => [...(Array.isArray(prev) ? prev : []), ...newList]);
        }

        setPageNum(page);
        // 判断是否还有更多数据
        console.log('newList.length:', newList.length, 'PAGE_SIZE:', PAGE_SIZE);
        setHasMore(newList.length >= PAGE_SIZE);
        
        // 数据加载完成后恢复滚动位置（如果是刷新或第一页加载）
        if (isRefresh || page === 1) {
          setTimeout(() => {
            restoreScrollPosition();
            // 数据加载完成后滚动激活的筛选标签到可视区域
            scrollActiveFilterTagIntoView();
          }, 100);
        }
      } else {
        if (isRefresh || page === 1) setList([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('获取列表数据失败:', error);
      if (isRefresh || page === 1) setList([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchApproveCounts();
    fetchSubTabCounts(mainTab);
    // 组件挂载时恢复滚动位置
    restoreScrollPosition();
    // 组件挂载时滚动激活的筛选标签到可视区域
    scrollActiveFilterTagIntoView();
    
    // 飞书嵌入式环境：阻止非滚动区域的触摸滚动
    const preventTouchMove = (e) => {
      let target = e.target;
      // 可滚动区域的类名白名单
      const scrollableClasses = [
        'approval-list-wrapper',
        'adm-pull-to-refresh',
        'adm-pull-to-refresh-content',
        'adm-popup-body',
        'filter-tags',
        'approval-list-content'
      ];
      
      while (target && target !== document.body) {
        // 检查是否在白名单中
        for (const className of scrollableClasses) {
          if (target.classList && target.classList.contains(className)) {
            return; // 允许滚动
          }
        }
        // 检查元素是否有 overflow: auto/scroll 样式
        const style = window.getComputedStyle(target);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;
        if ((overflowY === 'auto' || overflowY === 'scroll') && target.scrollHeight > target.clientHeight) {
          return; // 允许垂直滚动
        }
        if ((overflowX === 'auto' || overflowX === 'scroll') && target.scrollWidth > target.clientWidth) {
          return; // 允许横向滚动
        }
        target = target.parentElement;
      }
      // 非滚动区域，阻止默认行为
      e.preventDefault();
    };
    
    document.addEventListener('touchmove', preventTouchMove, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, []);

  // 滚动激活的筛选标签到可视区域
  const scrollActiveFilterTagIntoView = () => {
    setTimeout(() => {
      const tagElement = document.querySelector(`.filter-tag.active`);
      if (tagElement) {
        const containerElement = tagElement.parentElement;
        const containerRect = containerElement.getBoundingClientRect();
        const tagRect = tagElement.getBoundingClientRect();

        // 计算滚动位置，将标签滚动到容器中央
        const scrollLeft = containerElement.scrollLeft + tagRect.left - containerRect.left - containerRect.width / 2 + tagRect.width / 2;

        // 平滑滚动
        containerElement.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  useEffect(() => {
    fetchSubTabCounts(mainTab);
    // 主Tab变化时保存状态
    saveState();
  }, [mainTab]);

  useEffect(() => {
    if (mainTab !== '1') {
      setList([]);
      setPageNum(1);
      setHasMore(true);
      const timer = setTimeout(() => fetchList(1, true), 0);
      return () => clearTimeout(timer);
    }
  }, [mainTab, subTab, filterStatus]);

  // 状态变化时保存状态
  useEffect(() => {
    saveState();
  }, [subTab, filterStatus, pageNum]);

  const handleMainTabClick = (tabKey) => {
    setMainTab(tabKey);
    setSubTab('summary');
    setFilterStatus('all');
    setList([]);
    setPageNum(1);
    setHasMore(true);
    // 保存状态
    saveState();
  };

  // 点击卡片查看详情 - 使用路由跳转
  const handleCardClick = (item) => {
    // 保存当前状态，包括滚动位置
    saveState();
    const type = subTab === 'summary' ? 'summary' : 'single';
    navigate(`/mb/approval/detail/${type}/${item.id}`, { state: { item } });
  };

  // 撤回操作
  const handleWithdraw = (item) => {
    if (!item) return;
    let reason = '';
     const dialogHandler =  Dialog.show({
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
              if (subTab === 'summary') {
                res = await postBatchApprove({ approvalCollects: [{ collectId: item.id, approvalIds: [] }], type: 'cancel', reason });
              } else {
                res = await postApproveHandle({ id: item.id, type: 'cancel', reason });
              }
              if (res?.result || res?.code === 200) {
                Toast.show({ content: '撤回成功', position: 'center' });
                fetchList(1, true);
                fetchApproveCounts();
                fetchSubTabCounts(mainTab);
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
            width:'100px'
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
  const handleRevoke = (item) => {
    if (!item) return;
    let type = item.operationList?.includes('revoke') ? 'revoke' : 'delete';
    const contentText = type === 'delete' ? '撤销后审批单关闭不可操作。' : '撤销后不可恢复。';
   const dialogHandler = Dialog.show({
      title: '确认撤销？',
      content: contentText,
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
              if (subTab === 'summary') {
                res = await postBatchApprove({ approvalCollects: [{ collectId: item.id, approvalIds: [] }], type: 'delete', reason: '' });
              } else {
                res = await postApproveHandle({ id: item.id, type: type, reason: '' });
              }
              if (res?.result || res?.code === 200) {
                Toast.show({ content: '撤销成功', position: 'center' });
                fetchList(1, true);
                fetchApproveCounts();
                fetchSubTabCounts(mainTab);
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
  const handleAgainLaunch = (item) => {
    if (!item) return;
    if (item.tag === 0) {
      Toast.show({ content: '此登记对象已删除，无法进行编辑', position: 'center' });
      return;
    }
    if (item.modifyType === 'delete') {
      Dialog.confirm({
        title: '确认再次发起审批？',
        content: '审批通过后对应的工时日志将成功删除，不可恢复。',
        confirmText: '确定',
        cancelText: '取消',
        onConfirm: async () => {
          try {
            const res = await postApproveHandle({
              id: item.id, type: 'again_launch', reason: '',
              actWorkHour: item.actWorkHour, workDesc: item.workDesc, workDate: item.workDate, modifyType: item.modifyType,
            });
            if (res?.result || res?.code === 200) {
              Toast.show({ content: '再次发起成功', position: 'center' });
              fetchList(1, true);
              fetchApproveCounts();
              fetchSubTabCounts(mainTab);
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

  const getModifyTypeText = (type) => {
    const map = { 'create': '新增', 'edit': '编辑', 'delete': '删除' };
    return map[type] || type || '--';
  };

  return (
    <div className="approval-container" onTouchMove={(e) => {
            // 检查是否在可滚动区域内
            let target = e.target;
            const scrollableClasses = ['approval-list-wrapper', 'adm-pull-to-refresh', 'adm-pull-to-refresh-content', 'adm-popup-body', 'filter-tags', 'approval-list-content'];
            while (target && target !== e.currentTarget) {
              for (const className of scrollableClasses) {
                if (target.classList && target.classList.contains(className)) return;
              }
              const style = window.getComputedStyle(target);
              if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && target.scrollHeight > target.clientHeight) return;
              if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && target.scrollWidth > target.clientWidth) return;
              target = target.parentElement;
            }
            e.preventDefault();
          }}>
      {/* 主Tab栏 */}
      <div className="main-tabs">
        {mainTabs.map((tab) => (
          <div
            key={tab.key}
            className={`main-tab-item ${mainTab === tab.key ? 'active' : ''}`}
            onClick={() => handleMainTabClick(tab.key)}
          >
            <div className="tab-count">{tab.count}</div>
            <div className="tab-label">{tab.label}</div>
          </div>
        ))}
      </div>

      {/* 当不是全部审批时，显示子Tab栏和筛选标签 */}
      {mainTab !== '1' && mainTab !== '3' && (
        <div className="sub-tabs-wrapper">
          {/* 子Tab栏 */}
          <div className="sub-tabs">
            {subTabs.map((tab) => (
              <div
                key={tab.key}
                className={`sub-tab-item ${subTab === tab.key ? 'active' : ''}`}
                onClick={() => {
                  setSubTab(tab.key);
                  // 切换子Tab时重置筛选状态为全部
                  setFilterStatus('all');
                  // 保存状态
                  saveState();
                }}
              >
                {tab.label}（{tab.count}）
              </div>
            ))}
          </div>

          {/* 筛选标签 */}
          <div className="filter-tags">
            {filterTags.map((tag) => (
              <div
                key={tag.key}
                className={`filter-tag ${filterStatus === tag.key ? 'active' : ''}`}
                onClick={() => {
                  setFilterStatus(tag.key);
                  setPageNum(1);
                  // 实现标签滚动到可视区域
                  setTimeout(() => {
                    const tagElement = document.querySelector(`.filter-tag.active`);
                    if (tagElement) {
                      const containerElement = tagElement.parentElement;
                      const containerRect = containerElement.getBoundingClientRect();
                      const tagRect = tagElement.getBoundingClientRect();

                      // 计算滚动位置，将标签滚动到容器中央
                      const scrollLeft = containerElement.scrollLeft + tagRect.left - containerRect.left - containerRect.width / 2 + tagRect.width / 2;

                      // 平滑滚动
                      containerElement.scrollTo({
                        left: scrollLeft,
                        behavior: 'smooth'
                      });
                    }
                  }, 0);
                  // 保存状态
                  saveState();
                }}
              >
                {tag.label}（{getFilterCount(tag.key)}）
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 审批列表 - 主要修改部分 */}
      <div className="approval-list-wrapper" ref={scrollContainerRef}>
        {/* 全部审批页面显示PC操作提示 */}
        {mainTab !== '2' ? (
          <PCOperationPrompt />
        ) : (
          <PullToRefresh
            onRefresh={async () => {
              // 下拉刷新时同步刷新所有数据
              await Promise.all([
                fetchList(1, true),           // 刷新列表数据
                fetchApproveCounts(),         // 刷新Tab栏统计
                fetchSubTabCounts(mainTab)    // 刷新筛选标签数量
              ]);
            }}
          >
            {/* 使用一个容器包裹所有内容 */}
            <div className="approval-list-content">
              <div className="approval-list">
                {list.length > 0 ? (
                  <>
                    {list.map((item) => (
                      <div key={item.id} className="approval-card" onClick={() => handleCardClick(item)}>
                        <div className="card-header">
                          <span className="card-date">
                            {subTab === 'summary' 
                              ? (item.registrationStartDate === item.registrationEndDate
                                  ? item.registrationStartDate || '--'
                                  : `${item.registrationStartDate || '--'}至${item.registrationEndDate || '--'}`)
                              : (item.workDate ? dayjs(item.workDate).format('YYYY-MM-DD') : '--')}
                          </span>
                          <img
                            className="card-status-img"
                            src={getStatusConfig( subTab === 'summary' ? item.status : item.approvalStatus ).image}
                            alt={getStatusConfig( subTab === 'summary' ? item.status : item.approvalStatus ).label}
                          />
                        </div>
                        <div className="card-body">
                          <div className="info-row">
                            <span className="info-label">变更类型：</span>
                            <span className="info-value">
                              {item.modifyType === 'create' ? '新增' :
                                item.modifyType === 'edit' ? '修改' :
                                  item.modifyType === 'delete' ? '删除' : item.modifyType || '--'}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">{subTab === 'summary' ? '汇总工时：' : '登记工时：'}</span>
                            <span className="info-value">
                              {subTab === 'summary'
                                ? (item.totalWorkHour ? `${item.totalWorkHour}小时` : '--')
                                : (item.actWorkHour ? `${item.actWorkHour}小时` : '--')}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">成员：</span>
                            <div className="member-info">
                              {item.staffAvatarUrl ? (
                                <img src={item.staffAvatarUrl} alt={item.staffName || '成员头像'} className="member-avatar" />
                              ) : (
                                <div className="member-avatar">{item.staffName?.slice(0, 1) || '?'}</div>
                              )}
                              <span className="member-name">{item.staffName || '--'}</span>
                            </div>
                          </div>
                        </div>
                        {/* 卡片操作按钮 */}
                        {(item.operationList?.includes('cancel') || item.operationList?.includes('revoke') || item.operationList?.includes('delete') || item.operationList?.includes('again_launch')) && (
                          <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                            {item.operationList?.includes('cancel') && (
                              <div className="card-action-btn withdraw" onClick={() => handleWithdraw(item)}>
                                撤回
                              </div>
                            )}
                            {(item.operationList?.includes('revoke') || item.operationList?.includes('delete')) && (
                              <div className="card-action-btn revoke" onClick={() => handleRevoke(item)}>
                                撤销
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : (
                  !loading && (
                    <div className="empty-container">
                      <img src={noDataImage} alt="无数据" className="empty-image" />
                      <div className="empty-text">暂无数据</div>
                    </div>
                  )
                )}
              </div>
              
              {/* 加载更多和无更多提示区域 - 移出 approval-list */}
              {list.length > 0 && (
                <div className="list-footer">
                  <InfiniteScroll
                    loadMore={async () => {
                      console.log('加载更多触发，hasMore:', hasMore, 'loadingMore:', loadingMore);
                      if (!loadingMore && hasMore) {
                        console.log('开始加载更多数据，pageNum:', pageNum);
                        await fetchList(pageNum + 1, false);
                      }
                    }}
                    hasMore={hasMore}
                    threshold={50}
                  >
                    {loadingMore && (
                      <div className="loading-more">
                        <div className="loading-spinner"></div>
                        <span>加载中...</span>
                      </div>
                    )}
                  </InfiniteScroll>
                  
                  {!hasMore && list.length > 0 && (
                    <div className="no-more">
                      <div className="no-more-line"></div>
                      <span>已经到底了</span>
                      <div className="no-more-line"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </PullToRefresh>
        )}
      </div>
    </div>
  );
};

export default MbApproval;
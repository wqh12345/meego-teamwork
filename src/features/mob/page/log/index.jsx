import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Modal, Popup, Toast, Dialog, PullToRefresh, InfiniteScroll } from "antd-mobile";
import {
  CalendarOutlined,
  DownOutlined,
  CloseCircleFilled,
} from "@ant-design/icons";
import {
  getWeekStartAndEnd,
  getFirstDayOfNaturalMonth,
  getLastDayOfNaturalMonth,
  isNumber,
} from "../../../../util/date";
import {
  postQueryNodeWorkHour,
  postDeleteNodeWorkHour,
} from "../../../../api/api";
import "./index.less"; 
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import noDataImage from "../../../../image/no-data-table.png";
import UserCascader from "../../components/UserCascader";
import WorkItemCascader from "../../components/WorkItemCascader";
import LogList from "../../../../image/assets/dengji.png";

dayjs.extend(customParseFormat);

const LogPage = (props) => {
  const { loginUser } = props;
  const navigate = useNavigate();
  
  // ==================== Refs ====================
  const scrollableRef = useRef(null);
  const isMounted = useRef(false);
  
  // 加载状态 refs
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const currentPageRef = useRef(1);
  const pageSizeRef = useRef(10);
  
  // ==================== States ====================
  // 日期状态
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const formattedFirstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0);
  const formattedLastDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  
  // 获取缓存时间
  const getCachedTime = () => {
    try {
      const cachedBeginTime = localStorage.getItem('log_page_begin_time');
      const cachedEndTime = localStorage.getItem('log_page_end_time');
      if (cachedBeginTime && cachedEndTime) {
        return {
          beginTime: cachedBeginTime,
          endTime: cachedEndTime
        };
      }
    } catch (error) {
      console.error('获取缓存时间失败:', error);
    }
    return null;
  };
  
  const cachedTime = getCachedTime();
  
  const [beginTime, setBeginTime] = useState(cachedTime?.beginTime || formattedFirstDay);
  const [endTime, setEndTime] = useState(cachedTime?.endTime || formattedLastDay);
  const [startDate, setStartDate] = useState(cachedTime?.beginTime || formattedFirstDay);
  const [endDate, setEndDate] = useState(cachedTime?.endTime || formattedLastDay);
  
  // 筛选状态
  const [selectedUser, setSelectedUser] = useState({ id: '', name: '八九' });
  const [selectedWorkItem, setSelectedWorkItem] = useState({ 
    id: '', 
    name: '', 
    workItemId: '', 
    workItemEntityId: '',
    pathValues: [] // 存储选择路径
  });
  
  // 弹窗状态
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false);
  const [userPickerVisible, setUserPickerVisible] = useState(false);
  const [workItemPickerVisible, setWorkItemPickerVisible] = useState(false);
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多状态
  const [hasMore, setHasMore] = useState(true);
  
  // 数据状态
  const [logList, setLogList] = useState({
    nodeWorkHours: [],
    total: 0,
    pageNo: 1,
    pageSize: 10,
  });

  // ==================== 缓存函数 ====================
  const cacheTime = (begin, end) => {
    try {
      localStorage.setItem('log_page_begin_time', begin);
      localStorage.setItem('log_page_end_time', end);
    } catch (error) {
      console.error('缓存时间失败:', error);
    }
  };

  // ==================== 数据获取函数 ====================
  /** 获取工时日志列表 */
  const fetchData = useCallback(async (pageNum = 1, isRefresh = false, workItemInfo = null, customTimeRange = null) => {
    console.log('[fetchData] 开始执行:', { 
      pageNum, 
      isRefresh, 
      currentPage: currentPageRef.current,
      hasMore: hasMoreRef.current,
      isLoading: isLoadingRef.current,
      customTimeRange
    });
    
    // 检查是否正在加载
    if (isLoadingRef.current) {
      console.log('[fetchData] 正在加载中，跳过');
      return;
    }
    
    // 对于非刷新操作，检查是否还有更多数据
    if (!isRefresh && !hasMoreRef.current && pageNum > 1) {
      console.log('[fetchData] 没有更多数据，跳过加载');
      return;
    }
    
    // 设置加载状态
    isLoadingRef.current = true;
    setIsLoading(true);
    
    // 使用自定义时间范围或默认的状态值
    const actualBeginTime = customTimeRange?.beginTime || beginTime;
    const actualEndTime = customTimeRange?.endTime || endTime;
    
    console.log('[fetchData] 使用的时间参数:', { actualBeginTime, actualEndTime });
    
    try {
      const data = {
        startDate: actualBeginTime + " 00:00:00",
        endDate: actualEndTime + " 23:59:59",
        pageNo: pageNum,
        pageSize: pageSizeRef.current,
        statisticType: 1,
        userIdList: selectedUser.id ? [selectedUser.id] : [],
        // 如果传入了 workItemInfo，使用其值（包括空字符串），否则使用 selectedWorkItem
        workItemId: workItemInfo !== null ? (workItemInfo.workItemId || undefined) : (selectedWorkItem.workItemId || undefined),
        workItemEntityId: workItemInfo !== null ? (workItemInfo.workItemEntityId || undefined) : (selectedWorkItem.workItemEntityId || undefined),
      };
      
      console.log('[fetchData] 请求参数:', data);
      const res = await postQueryNodeWorkHour(data);
      console.log('[fetchData] API返回:', { 
        code: res?.code, 
        count: res.data?.nodeWorkHours?.length,
        total: res.data?.total,
        pageNo: res.data?.pageNo,
        pageSize: res.data?.pageSize
      });
      
      if (res?.code === 200) {
        const dataList = res.data?.nodeWorkHours || [];
        const total = res.data?.total || 0;
        const currentPageSize = res.data?.pageSize || pageSizeRef.current;
        
        // 更新当前页
        currentPageRef.current = pageNum;
        
        // 计算是否还有更多数据
        const hasMoreData = pageNum * currentPageSize < total;
        hasMoreRef.current = hasMoreData;
        setHasMore(hasMoreData);
        
        console.log('[fetchData] 分页计算:', {
          当前页: pageNum,
          每页条数: currentPageSize,
          总条数: total,
          已加载条数: pageNum * currentPageSize,
          还有更多数据: hasMoreData
        });
        
        // 更新数据
        if (pageNum === 1 || isRefresh) {
          // 第一页或刷新，直接替换
          setLogList({
            nodeWorkHours: dataList,
            total: total,
            pageNo: pageNum,
            pageSize: currentPageSize
          });
          console.log('[fetchData] 刷新/第一页，设置新数据:', dataList.length);
        } else {
          // 加载更多，合并数据
          setLogList(prev => {
            const mergedList = [...prev.nodeWorkHours, ...dataList];
            console.log('[fetchData] 加载更多，合并数据:', {
              原数据量: prev.nodeWorkHours.length,
              新数据量: dataList.length,
              合并后: mergedList.length
            });
            return {
              nodeWorkHours: mergedList,
              total: total,
              pageNo: pageNum,
              pageSize: currentPageSize
            };
          });
        }
      } else {
        console.error('[fetchData] API错误:', res?.message);
        if (pageNum === 1) {
          setLogList({ nodeWorkHours: [], total: 0, pageNo: 1, pageSize: pageSizeRef.current });
        }
        hasMoreRef.current = false;
        setHasMore(false);
      }
    } catch (error) {
      console.error('[fetchData] 请求失败:', error);
      if (pageNum === 1) {
        setLogList({ nodeWorkHours: [], total: 0, pageNo: 1, pageSize: pageSizeRef.current });
      }
      hasMoreRef.current = false;
      setHasMore(false);
    } finally {
      // 重置加载状态
      isLoadingRef.current = false;
      setIsLoading(false);
      console.log('[fetchData] 执行完成，加载状态已重置');
    }
  }, [beginTime, endTime, selectedUser.id, selectedWorkItem.workItemId, selectedWorkItem.workItemEntityId]);
  
  // ==================== 事件处理函数 ====================
  /** 删除日志 */
  const onDelLogClick = async (item) => {
    const dialogHandler = Dialog.show({
      title: '确认删除？',
      content: "您即将删除该条记录，此操作不可撤销",
      className: 'delete-dialog',
      actions: [
        {
          key: 'confirm',
          text: '确定删除',
          style: {
            backgroundColor: '#ff4d4f',
            color: '#ffffff',
            fontSize: '16px',
            borderRadius: '8px',
          },
          onClick: async () => {
            try {
              const data = { id: item.id, taskHourId: item.taskHourId };
              const res = await postDeleteNodeWorkHour(data);
              if (res?.code === 200 || res?.result) {
                Toast.show({ content: '删除成功', position: 'top' });
                fetchData(1, true); // 刷新第一页
                dialogHandler.close()
              } else {
                Toast.show({ content: res?.msg || '删除失败', position: 'top' });
              }
            } catch (error) {
              console.error('删除失败:', error);
              Toast.show({ content: '删除失败，请重试', position: 'top' });
            }
          },
        },
        {
          key: 'cancel',
          text: '取消',
          style: {
            color: '#8c8c8c',
            fontSize: '16px',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            border: 'none',
          },
          onClick: () => dialogHandler.close(),
        },
      ],
    });
  };

  /** 编辑日志 */
  const onEditLogClick = (item) => {
    navigate(`/mb/log/registration/${item.id}`, { 
      state: { editData: item, loginUser } 
    });
  };

  /** 时间选择确认 */
  const onTimeConfirm = () => {
    console.log('[onTimeConfirm] 时间选择确认:', { startDate, endDate });
    
    // 1️⃣ 立即关闭弹窗
    setCalendarPickerVisible(false);
    
    // 2️⃣ 立即更新显示状态
    setBeginTime(startDate);
    setEndTime(endDate);
    cacheTime(startDate, endDate);
    
    // 3️⃣ 延迟加载数据，让 UI 先更新
    requestAnimationFrame(() => {
      currentPageRef.current = 1;
      hasMoreRef.current = true;
      setHasMore(true);
      fetchData(1, true, null, { beginTime: startDate, endTime: endDate });
    });
  };

  /** 下拉刷新处理 */
  const handleRefresh = async () => {
    currentPageRef.current = 1;
    hasMoreRef.current = true;
    setHasMore(true);
    await fetchData(1, true);
  };

  /** 上拉加载更多 */
  const handleLoadMore = async () => {
    if (loadingMore || !hasMoreRef.current) return;
    console.log('[handleLoadMore] 加载下一页:', currentPageRef.current + 1);
    setLoadingMore(true);
    try {
      await fetchData(currentPageRef.current + 1);
    } finally {
      setLoadingMore(false);
    }
  };

  /** 工作项选择确认 */
  const handleWorkItemConfirm = (workItemInfo) => {
    if (workItemInfo && workItemInfo.targetId) {
      // 构建路径数组，包含所有层级的值
      const pathValues = [];
      if (workItemInfo.workItemId) pathValues.push(workItemInfo.workItemId);
      if (workItemInfo.workItemEntityId) pathValues.push(workItemInfo.workItemEntityId);
      if (workItemInfo.nodeId) pathValues.push(workItemInfo.nodeId);
      if (workItemInfo.subNodeId && workItemInfo.subNodeId !== workItemInfo.nodeId) pathValues.push(workItemInfo.subNodeId);
      
      // 1️⃣ 立即关闭弹窗，让用户感觉响应快
      setWorkItemPickerVisible(false);
      
      // 2️⃣ 立即更新显示状态
      setSelectedWorkItem({
        id: workItemInfo.targetId,
        name: workItemInfo.targetName,
        workItemId: workItemInfo.workItemId || '',
        workItemEntityId: workItemInfo.workItemEntityId || '',
        pathValues: pathValues
      });
      
      // 3️⃣ 延迟加载数据，让 UI 先更新
      requestAnimationFrame(() => {
        currentPageRef.current = 1;
        hasMoreRef.current = true;
        setHasMore(true);
        fetchData(1, true, workItemInfo);
      });
    }
  };
  
  /** 清空登记对象选择 */
  const handleClearWorkItem = () => {
    // 1️⃣ 立即更新显示状态
    setSelectedWorkItem({
      id: '', 
      name: '', 
      workItemId: '', 
      workItemEntityId: '',
      pathValues: []
    });
    
    // 2️⃣ 延迟加载数据，传递空的 workItemInfo 覆盖旧值
    requestAnimationFrame(() => {
      currentPageRef.current = 1;
      hasMoreRef.current = true;
      setHasMore(true);
      // 传递明确的空值，确保不使用旧的 selectedWorkItem
      fetchData(1, true, { workItemId: '', workItemEntityId: '' });
    });
  };
  
  /** 清空时间范围选择 - 恢复为当月 */
  const handleClearTimeRange = () => {
    // 1️⃣ 立即更新显示状态
    setBeginTime(formattedFirstDay);
    setEndTime(formattedLastDay);
    setStartDate(formattedFirstDay);
    setEndDate(formattedLastDay);
    // 清除缓存
    localStorage.removeItem('log_page_begin_time');
    localStorage.removeItem('log_page_end_time');
    
    // 2️⃣ 延迟加载数据，让 UI 先更新
    requestAnimationFrame(() => {
      currentPageRef.current = 1;
      hasMoreRef.current = true;
      setHasMore(true);
      fetchData(1, true, null, { beginTime: formattedFirstDay, endTime: formattedLastDay });
    });
  };
  
  /** 检查时间范围是否为默认值（当月） */
  const isDefaultTimeRange = beginTime === formattedFirstDay && endTime === formattedLastDay;
  
  // ==================== 生命周期 ====================
  useEffect(() => {
    isMounted.current = true;
    
    // 初始加载数据
    fetchData(1, false);
    
    // 飞书嵌入式环境：阻止非滚动区域的触摸滚动
    const preventTouchMove = (e) => {
      let target = e.target;
      // 可滚动区域的类名白名单
      const scrollableClasses = [
        'log-content',
        'log-scroll',
        'adm-pull-to-refresh',
        'adm-pull-to-refresh-content',
        'adm-popup-body',
        'cascader-list'
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
      isMounted.current = false;
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, []);
  
  // 依赖变化时重置并重新加载
  useEffect(() => {
    if (!isMounted.current) return;
    
    // 重置状态
    currentPageRef.current = 1;
    hasMoreRef.current = true;
    setHasMore(true);
    
    // 重新加载数据
    fetchData(1, true);
  }, [beginTime, endTime, selectedUser.id]);
  
  // ==================== 渲染函数 ====================
  return (
    <div className="log-container" onTouchMove={(e) => {
        // 检查是否在可滚动区域内
        let target = e.target;
        const scrollableClasses = ['log-content', 'log-scroll', 'adm-pull-to-refresh', 'adm-pull-to-refresh-content', 'adm-popup-body', 'cascader-list'];
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
      {/* 筛选区域 */}
      <div className="log-filter">
        <div className="filter-row">
          <span className="filter-label">时间范围</span>
          <div className="filter-input" onClick={() => setCalendarPickerVisible(true)}>
            <span className="filter-input-text">
              {dayjs(beginTime).format("YYYY-MM-DD")} ~ {dayjs(endTime).format("YYYY-MM-DD")}
            </span>
            <div className="filter-input-icons">
              {!isDefaultTimeRange && (
                <CloseCircleFilled 
                  className="filter-clear-icon" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearTimeRange();
                  }}
                />
              )}
              <CalendarOutlined className="filter-input-icon" />
            </div>
          </div>
        </div>
        
        <div className="filter-row">
          <span className="filter-label">登记对象</span>
          <div className="filter-input" onClick={() => setWorkItemPickerVisible(true)}>
            <span className={`filter-input-text ${!selectedWorkItem.name ? 'placeholder' : ''}`}>
              {selectedWorkItem.name || '请选择'}
            </span>
            <div className="filter-input-icons">
              {selectedWorkItem.name && (
                <CloseCircleFilled 
                  className="filter-clear-icon" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearWorkItem();
                  }}
                />
              )}
              <DownOutlined className="filter-input-icon" />
            </div>
          </div>
        </div>
      </div>
      
      {/* 提示横幅 */}
      <div className="log-banner">
        <div className="banner-content">
          <img src={LogList} alt="登记" className="banner-icon" />
          <span className="banner-text">快来登记工时信息吧~</span>
        </div>
        <button
          className="banner-btn"
          onClick={() => navigate('/mb/log/registration', { state: { loginUser } })}
        >
          去登记
        </button>
      </div>
      
      {/* 内容区域 */}
      <div className="log-content">
        <PullToRefresh onRefresh={handleRefresh}>
          {/* 滚动区域 */}
          <div 
            className="log-scroll" 
            ref={scrollableRef}
          >
            {/* 工时卡片列表 */}
          {logList.nodeWorkHours.length > 0 ? (
            <>
              {logList.nodeWorkHours.map((item, index) => (
                <div 
                  key={`${item.id}-${index}`} 
                  className="log-card"
                  onClick={() => navigate(`/mb/log/registration/${item.id}`, { 
                    state: { editData: item, loginUser, viewMode: true } 
                  })}
                >
                  <div className="card-title">
                    {item.workItemName || ''}
                    {item.workItemName && item.workItemEntityName ? '/' : ''}
                    {item.workItemEntityName || ''}
                    {item.workItemEntityName && item.nodeName ? '/' : ''}
                    {item.nodeName || ''}
                    {item.nodeName && item.taskName ? '/' : ''}
                    {item.taskName || ''}
                  </div>
                  
                  <div className="card-info">
                    <div className="info-item">
                      <span className="info-label">工作项</span>
                      <span className="info-value">{item.workItemName || '--'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">工作项实例</span>
                      <span className="info-value">{item.workItemEntityName || '--'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">排期</span>
                      <span className="info-value">
                        {item.scheduleDate_start && item.scheduleDate_end
                          ? `${dayjs(item.scheduleDate_start).format("YYYY-MM-DD")}~${dayjs(item.scheduleDate_end).format("YYYY-MM-DD")}`
                          : "--"}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">预估工时</span>
                      <span className="info-value">
                        {item.eval_hour_str !== null && item.eval_day_str !== null
                          ? `${item.eval_hour_str}小时 (${isNumber(item.eval_hour_str) ? item.eval_hour_str.toFixed(2) : item.eval_day_str}人天)`
                          : "--"}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">实际工时</span>
                      <span className="info-value">
                        {item.act_hour !== null && item.act_day !== null
                          ? `${item.act_hour}小时 (${isNumber(item.act_day) ? item.act_day.toFixed(2) : item.act_day}人天)`
                          : "--"}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">工作日期</span>
                      <span className="info-value">
                        {dayjs(item.workDate).format("YYYY-MM-DD")}
                      </span>
                    </div>
                  </div>
                  
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    {/* 删除按钮 */}
                    {item?.isApproving ? (
                      <div className="action-btn disabled" title="当前工时日志存在待审批的工时变更">删除</div>
                    ) : ((item?.tag === 0 && canShowTenantAdminFeature()==false) ? (
                      <div className="action-btn disabled" title="此登记对象已删除，无法进行删除，请联系插件管理员进行操作">删除</div>
                    ) : (
                      <div className="action-btn" onClick={() => onDelLogClick(item)}>删除</div>
                    ))}
                    
                    {/* 编辑按钮 */}
                    {item?.isApproving ? (
                      <div className="action-btn disabled" title="当前工时日志存在待审批的工时变更">编辑</div>
                    ) : ((item?.tag === 0 && canShowTenantAdminFeature()==false) ? (
                      <div className="action-btn disabled" title="此登记对象已删除，无法进行编辑，请联系插件管理员进行操作">编辑</div>
                    ) : (
                      <div className="action-btn" onClick={() => onEditLogClick(item)}>编辑</div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* 无限滚动加载 */}
              <InfiniteScroll
                loadMore={handleLoadMore}
                hasMore={hasMore}
                threshold={100}
              >
                {loadingMore && (
                  <div className="loading-more">
                    <div className="loading-spinner"></div>
                    <span>加载中...</span>
                  </div>
                )}
              </InfiniteScroll>
              
              {!hasMore && logList.nodeWorkHours.length > 0 && (
                <div className="no-more">
                  <div className="no-more-line"></div>
                  <span>已经到底了</span>
                  <div className="no-more-line"></div>
                </div>
              )}
            </>
          ) : (
            // 空状态
            <div className="log-empty">
              <img className="empty-img" src={noDataImage} alt="暂无数据" />
              <div className="empty-text">暂无数据</div>
              {isLoading && (
                <div className="loading-more">
                  <div className="loading-spinner"></div>
                  <span>加载中...</span>
                </div>
              )}
            </div>
          )}
        </div>
        </PullToRefresh>
      </div>
      
      {/* 日历选择器 */}
      <Popup
        visible={calendarPickerVisible}
        onMaskClick={() => setCalendarPickerVisible(false)}
        bodyStyle={{
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          minHeight: "50vh",
          padding: "10px",
          width: "95vw",
        }}
      >
        <div className="popup-header">选择日期</div>
        <div className="popup-content">
          <Calendar
            value={[new Date(startDate), new Date(endDate)]}
            selectionMode="range"
            onChange={(dates) => {
              setStartDate(dayjs(dates[0]).format("YYYY-MM-DD"));
              setEndDate(dayjs(dates[1]).format("YYYY-MM-DD"));
            }}
          />
        </div>
        <div className="popup-footer">
          <button
            className="popup-btn cancel"
            onClick={() => setCalendarPickerVisible(false)}
          >
            取消
          </button>
          <button
            className="popup-btn confirm"
            onClick={onTimeConfirm}
          >
            确认
          </button>
        </div>
      </Popup>
      
      {/* 工作项选择器 */}
      <WorkItemCascader
        visible={workItemPickerVisible}
        onClose={() => setWorkItemPickerVisible(false)}
        value={selectedWorkItem.pathValues}
        onConfirm={handleWorkItemConfirm}
        loginUser={loginUser}
      />
    </div>
  );
};

export default LogPage;
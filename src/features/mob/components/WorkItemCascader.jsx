import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Popup, Loading, InfiniteScroll } from 'antd-mobile';
import { CheckOutlined } from '@ant-design/icons';
import { getWorkItemOptionNew, getWorkItemOptionForRegister, getItemEntityOptionNew, getEntityNodeOptionNew, getNodePersonStatistics, getRegistrationSettings } from '../../../api/api';
import noDataImage from '../../../image/assets/no-data.png';
import nextLevelIcon from '../../../image/assets/next-level.png';
import './WorkItemCascader.less';

const WorkItemCascader = ({ visible, onClose, value, onConfirm, loginUser, isRegistration = false }) => {
  // 缓存所有层级的数据，避免重复请求
  const levelDataCache = useRef({});
  
  // 临时存储已知的路径数据，用于快速恢复
  const pathDataCache = useRef({});

  // 防重复点击下级按钮的 ref
  const operationLockRef = useRef(false); // 全局操作锁，仅用于进入下级操作
  
  // 当前层级（0=工作项, 1=工作项实例, 2=节点...）
  const [currentLevel, setCurrentLevel] = useState(0);
  
  // 各层级的数据
  const [levelData, setLevelData] = useState([]);
  
  // 各层级已选中的项
  const [selectedItems, setSelectedItems] = useState([]);
  
  // 加载状态
  const [loading, setLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false); // 确认按钮加载状态
  
  // 第二层分页状态（工作项实例）
  const [level1PageNum, setLevel1PageNum] = useState(1);
  const [level1HasMore, setLevel1HasMore] = useState(true);
  const [level1LoadingMore, setLevel1LoadingMore] = useState(false);
  const level1WorkItemIdRef = useRef(null); // 当前加载的工作项ID
  const PAGE_SIZE = 20;
  
  // 统计信息（保存最后一层的统计数据）
  const [registrationStats, setRegistrationStats] = useState(null);

  // 登记设置中 myselfStatus 配置（按工作项ID映射）
  const myselfStatusMapRef = useRef({});

  // 获取登记设置配置
  useEffect(() => {
    if (visible && isRegistration) {
      getRegistrationSettings().then(res => {
        if (res?.code === 200 && res?.data?.list) {
          const map = {};
          res.data.list.forEach(item => {
            if (item.canRegistWorkItemId) {
              map[item.canRegistWorkItemId] = item.myselfStatus;
            }
          });
          myselfStatusMapRef.current = map;
          console.log('[Cascader] myselfStatus配置:', map);
        }
      }).catch(err => {
        console.error('[Cascader] 获取登记设置失败:', err);
      });
    }
  }, [visible, isRegistration]);

  // 判断当前选中的工作项是否需要过滤 canRegister
  const shouldFilterCanRegister = (workItemId) => {
    if (!isRegistration) return false;
    // 检查该工作项的 myselfStatus 是否为 1
    const workItemKey = selectedItems[0]?.raw?.workItemKey || workItemId;
    // 遍历所有配置，检查是否匹配
    const map = myselfStatusMapRef.current;
    if (map[workItemKey] === 1 || map[workItemId] === 1) return true;
    // 如果全局配置了 myselfStatus=1（canRegistWorkItemId='0' 表示全部工作项）
    if (map['0'] === 1) return true;
    return false;
  };

  // 初始化加载第一层数据
  useEffect(() => {
    if (visible) {
      if (Array.isArray(value) && value.length > 0) {
        // 检查是否有缓存数据，如果有则先显示缓存数据以提供即时反馈
        const cacheKey = value.join('-');
        if (pathDataCache.current[cacheKey]) {
          const { levelData: cachedLevelData, currentLevel: cachedLevel, selectedItems: cachedSelectedItems } = pathDataCache.current[cacheKey];
          setLevelData(cachedLevelData);
          setCurrentLevel(cachedLevel);
          setSelectedItems(cachedSelectedItems);
        }
        
        // 然后异步恢复选择状态，可能更新数据
        restoreSelectionFromValue(value);
      } else {
        // 否则重置为初始状态
        setCurrentLevel(0);
        setSelectedItems([]);
        fetchLevelData(0, {});
      }
    }
  }, [visible, value]);

  // 预加载所有层级数据并恢复选择状态
  const restoreSelectionFromValue = async (pathValues) => {
    // 确保pathValues是数组且不为空
    if (!Array.isArray(pathValues) || pathValues.length === 0) {
      console.warn('[Cascader] pathValues不是有效的数组:', pathValues);
      setLoading(false);
      return;
    }
      
    setLoading(true);
    try {
      // 检查缓存中是否有对应的数据
      const cacheKey = pathValues.join('-');
      if (pathDataCache.current[cacheKey]) {
        // 如果缓存中有数据，直接使用缓存数据
        const { levelData: cachedLevelData, currentLevel: cachedLevel, selectedItems: cachedSelectedItems } = pathDataCache.current[cacheKey];
        setLevelData(cachedLevelData);
        setCurrentLevel(cachedLevel);
        setSelectedItems(cachedSelectedItems);
        setLoading(false);
        return;
      }
        
      // 并行加载第一层和第二层数据
      const [firstLevelRes, secondLevelRes] = await Promise.all([
        isRegistration ? getWorkItemOptionForRegister() : getWorkItemOptionNew(),
        pathValues[0] ? getItemEntityOptionNew({
          workItemId: pathValues[0],
          pageNum: 1,
          pageSize: PAGE_SIZE,
        }).catch(() => null) : Promise.resolve(null)
      ]);
        
      if (firstLevelRes?.code === 200 && firstLevelRes?.data) {
        const firstLevelOptions = firstLevelRes.data.map(item => ({
          value: item.value,
          label: item.label,
          hasNext: item.hasNext !== false,
          raw: item,
        }));
          
        // 从路径中获取第一层的值
        const firstLevelValue = pathValues[0];
        const firstLevelItem = firstLevelOptions.find(item => item.value === firstLevelValue);
          
        if (!firstLevelItem) {
          // 如果第一层找不到对应的值，显示第一层所有选项
          setLevelData(firstLevelOptions);
          setCurrentLevel(0);
          setSelectedItems([]);
          setLoading(false);
          return;
        }
          
        // 构建选中的项目数组
        const newSelectedItems = [firstLevelItem];
          
        // 检查第二层数据
        if (pathValues.length > 1 && secondLevelRes?.code === 200 && secondLevelRes?.data?.data) {
          const secondLevelOptions = secondLevelRes.data.data.map(item => ({
            value: item.value,
            label: item.label,
            hasNext: item.hasNext !== false,
            raw: item,
          }));
            
          const secondLevelValue = pathValues[1];
          const secondLevelItem = secondLevelOptions.find(item => item.value === secondLevelValue);
            
          if (secondLevelItem) {
            newSelectedItems.push(secondLevelItem);
              
            // 如果有第三层值，加载第三层数据
            if (pathValues.length > 2) {
              const thirdLevelRes = await getEntityNodeOptionNew({
                workItemId: firstLevelItem.value,
                workItemEntityId: secondLevelItem.value,
                nodeId: null,
                userKey: loginUser?.id || sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
                myselfFlag: isRegistration ? true : false,
                pageNum: 1,
                pageSize: 100,
              });
                
              if ((thirdLevelRes?.code === 200 || thirdLevelRes?.result) && thirdLevelRes?.data) {
                const thirdLevelOptions = thirdLevelRes.data.map(item => {
                  const hasChildren = item.children && item.children.length > 0;
                  return {
                    value: item.value,
                    label: item.label,
                    hasNext: item.hasNext === true || hasChildren,
                    children: hasChildren ? item.children.map(child => ({
                      value: child.value,
                      label: child.label,
                      hasNext: child.hasNext === true || (child.children && child.children.length > 0),
                      children: child.children || [],
                      canRegister: child.canRegister ?? true,
                      canRegisterLevel: child.canRegisterLevel ?? 1,
                      canRegisterLevelName: child.canRegisterLevelName ?? '负责人',
                      raw: child,
                    })) : [],
                    canRegister: item.canRegister ?? true,
                    canRegisterLevel: item.canRegisterLevel ?? 1,
                    canRegisterLevelName: item.canRegisterLevelName ?? '负责人',
                    raw: item,
                  };
                });
                  
                const thirdLevelValue = pathValues[2];
                const thirdLevelItem = thirdLevelOptions.find(item => item.value === thirdLevelValue);
                  
                if (thirdLevelItem) {
                  newSelectedItems.push(thirdLevelItem);
                  // 显示第三层的选项
                  setLevelData(thirdLevelOptions);
                  setCurrentLevel(2);
                  setSelectedItems(newSelectedItems);
                    
                  // 缓存本次结果
                  pathDataCache.current[cacheKey] = {
                    levelData: thirdLevelOptions,
                    currentLevel: 2,
                    selectedItems: newSelectedItems
                  };
                    
                  setLoading(false);
                  return;
                }
              }
            }
              
            // 显示第二层的选项
            setLevelData(secondLevelOptions);
            setCurrentLevel(1);
            setSelectedItems(newSelectedItems);
              
            // 缓存本次结果
            pathDataCache.current[cacheKey] = {
              levelData: secondLevelOptions,
              currentLevel: 1,
              selectedItems: newSelectedItems
            };
              
            setLoading(false);
            return;
          }
        }
          
        // 如果只有第一层值或第二层数据无效，显示第一层的选项
        setLevelData(firstLevelOptions);
        setCurrentLevel(0);
        setSelectedItems(newSelectedItems);
          
        // 缓存本次结果
        pathDataCache.current[cacheKey] = {
          levelData: firstLevelOptions,
          currentLevel: 0,
          selectedItems: newSelectedItems
        };
      }
    } catch (error) {
      console.error('恢复选择状态失败:', error);
      // 发生错误时，加载第一层数据
      try {
        const res = isRegistration ? await getWorkItemOptionForRegister() : await getWorkItemOptionNew();
        if (res?.code === 200 && res?.data) {
          const options = res.data.map(item => ({
            value: item.value,
            label: item.label,
            hasNext: item.hasNext !== false,
            raw: item,
          }));
          setLevelData(options);
          setCurrentLevel(0);
          setSelectedItems([]);
        }
      } catch (err) {
        console.error('加载默认数据失败:', err);
        setLevelData([]);
        setCurrentLevel(0);
        setSelectedItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // 加载指定层级的数据
  const fetchLevelData = async (level, parentData) => {
    setLoading(true);
    try {
      let res;
      let options = [];
      
      console.log('[Cascader] 加载层级:', level, '参数:', parentData);
      
      if (level === 0) {
        // 第一层：工作项（新增编辑使用 ForRegister 接口）
        res = isRegistration ? await getWorkItemOptionForRegister() : await getWorkItemOptionNew();
        console.log('[Cascader] 工作项接口返回:', res);
        if (res?.code === 200 && res?.data) {
          options = res.data.map(item => ({
            value: item.value,
            label: item.label,
            hasNext: item.hasNext !== false, // 默认为true
            raw: item,
          }));
        }
      } else if (level === 1) {
        // 第二层：工作项实例（支持分页）
        level1WorkItemIdRef.current = parentData.workItemId;
        setLevel1PageNum(1);
        setLevel1HasMore(true);
        
        res = await getItemEntityOptionNew({
          workItemId: parentData.workItemId,
          userKey: loginUser?.id || sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
          myselfFlag: isRegistration ? true : false,
          pageNum: 1,
          pageSize: PAGE_SIZE,
        });
        console.log('[Cascader] 工作项实例接口返回:', res);
        if (res?.code === 200 && res?.data?.data) {
          options = res.data.data.map(item => ({
            value: item.value,
            label: item.label,
            hasNext: item.hasNext !== false,
            canRegister: item.canRegister ?? true,
            raw: item,
          }));
          // 登记模式下过滤掉 canRegister=false 的实例
          if (isRegistration) {
            options = options.filter(item => item.canRegister !== false);
            console.log('[Cascader] 登记模式，过滤实例后:', options.length);
          }
          // 检查是否有更多数据
          const total = res.data.total || 0;
          setLevel1HasMore(options.length < total);
        }
      } else {
        // 第三层及以下：节点
        res = await getEntityNodeOptionNew({
          workItemId: parentData.workItemId,
          workItemEntityId: parentData.workItemEntityId,
          nodeId: parentData.nodeId, // 父节点ID（如果有）
          userKey: loginUser?.id || sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
          myselfFlag: isRegistration ? true : false,
          pageNum: 1,
          pageSize: 100,
        });
        console.log('[Cascader] 节点接口返回:', res);
        if ((res?.code === 200 || res?.result) && res?.data) {
          options = res.data.map(item => {
            // 检查是否有 children 数据
            const hasChildren = item.children && item.children.length > 0;
            console.log('[Cascader] 节点项:', item.label, 'hasNext:', item.hasNext, 'hasChildren:', hasChildren);
            // 登记模式下过滤 children 中 canRegister=false 的项
            let filteredChildList = hasChildren ? item.children : [];
            if (isRegistration && hasChildren) {
              filteredChildList = filteredChildList.filter(child => child.canRegister !== false);
            }
            const mappedChildren = filteredChildList.map(child => ({
              value: child.value,
              label: child.label,
              hasNext: child.hasNext === true || (child.children && child.children.length > 0),
              children: child.children || [],
              canRegister: child.canRegister ?? true,
              canRegisterLevel: child.canRegisterLevel ?? 1,
              canRegisterLevelName: child.canRegisterLevelName ?? '负责人',
              raw: child,
            }));
            // 登记模式下：如果原始有children但过滤后为空，则hasNext=false（无可选下级）
            const shouldHaveNext = isRegistration
              ? (hasChildren ? mappedChildren.length > 0 : item.hasNext === true)
              : (item.hasNext === true || mappedChildren.length > 0);
            return {
              value: item.value,
              label: item.label,
              hasNext: shouldHaveNext,
              children: mappedChildren,
              canRegister: item.canRegister ?? true,
              canRegisterLevel: item.canRegisterLevel ?? 1,
              canRegisterLevelName: item.canRegisterLevelName ?? '负责人',
              raw: item,
            };
          });
          
          // 登记模式下，节点层级直接过滤 canRegister=false
          if (isRegistration) {
            options = options.filter(item => item.canRegister !== false);
            console.log('[Cascader] 登记模式，过滤节点后:', options.length);
          }
        }
      }
      
      console.log('[Cascader] 转换后的选项:', options);
      setLevelData(options);
    } catch (error) {
      console.error('加载数据失败:', error);
      setLevelData([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 加载更多第二层数据（工作项实例分页）
  const loadMoreLevel1 = useCallback(async () => {
    if (level1LoadingMore || !level1HasMore || currentLevel !== 1) return;
    
    const nextPage = level1PageNum + 1;
    console.log('[Cascader] 加载更多工作项实例, 页码:', nextPage);
    
    setLevel1LoadingMore(true);
    try {
      const res = await getItemEntityOptionNew({
        workItemId: level1WorkItemIdRef.current,
        userKey: loginUser?.id || sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
        myselfFlag: isRegistration ? true : false,
        pageNum: nextPage,
        pageSize: PAGE_SIZE,
      });
      
      if (res?.code === 200 && res?.data?.data) {
        let newOptions = res.data.data.map(item => ({
          value: item.value,
          label: item.label,
          hasNext: item.hasNext !== false,
          canRegister: item.canRegister ?? true,
          raw: item,
        }));
        
        // 登记模式下过滤 canRegister=false 的实例
        if (isRegistration) {
          newOptions = newOptions.filter(item => item.canRegister !== false);
        }
        
        setLevelData(prev => [...prev, ...newOptions]);
        setLevel1PageNum(nextPage);
        
        // 检查是否有更多数据
        const total = res.data.total || 0;
        const currentTotal = levelData.length + newOptions.length;
        setLevel1HasMore(currentTotal < total);
      } else {
        setLevel1HasMore(false);
      }
    } catch (error) {
      console.error('加载更多数据失败:', error);
      setLevel1HasMore(false);
    } finally {
      setLevel1LoadingMore(false);
    }
  }, [level1LoadingMore, level1HasMore, currentLevel, level1PageNum, levelData.length]);
  
  // 获取统计信息（从第二层级开始调用）
  const fetchStatistics = async (items, level) => {
    try {
      // 构建请求参数，根据层级使用不同的参数
      const params = {
        workItemId: items[0]?.value || '',
        workItemEntityId: items[1]?.value || '',
        registrantUseKey: loginUser?.id || sessionStorage.getItem('jwtMeegoTeamworkUserKey') || '',
      };
      
      // 根据层级添加 nodeId 或 taskId
      if (level === 1) {
        // 第二层：工作项实例，只传 workItemId 和 workItemEntityId
        // nodeId 为空
      } else if (level === 2) {
        // 第三层：节点，传 nodeId
        params.nodeId = items[2]?.value || '';
      } else if (level >= 3) {
        // 第四层及以上：任务，传 nodeId 和 taskId
        params.nodeId = items[2]?.value || '';
        params.taskId = items[3]?.value || '';
      }
      
      console.log('[Cascader] 调用统计接口 - 层级:', level, '参数:', params);
      
      const res = await getNodePersonStatistics(params);
      
      console.log('[Cascader] 统计接口返回:', res);
      
      if ((res?.code === 200 || res?.result) && res?.data) {
        const stats = {
          schedule: res.data.schedule || '--',
          estimatedWorkingHours: res.data.estimatedWorkingHours || '--/--',
          registeredWorkingHours: res.data.registeredWorkingHours || '--/--',
          remainingWork: res.data.remainingWork || '--/--',
        };
        // 保存统计数据，最终会随着选择不断更新
        setRegistrationStats(stats);
        console.log('[Cascader] 统计数据已更新:', stats);
        return stats; // 返回统计数据，便于确认时直接使用
      }
      return null;
    } catch (error) {
      console.error('[Cascader] 获取统计数据失败:', error);
      return null;
    }
  };

  // 选择某一项（点击名称区域）- 无防抖，立即响应
  const handleSelect = async (item) => {
    // 只保留当前层级及之前的项，清除之后的所有项
    const newSelectedItems = [...selectedItems.slice(0, currentLevel), item];
    setSelectedItems(newSelectedItems);
    
    console.log('[Cascader] 选择项:', item.label, 'hasNext:', item.hasNext, 'children:', item.children?.length);
    
    // 缓存当前选择状态
    const cacheKey = newSelectedItems.map(i => i.value).join('-');
    pathDataCache.current[cacheKey] = {
      levelData: levelData,
      currentLevel: currentLevel,
      selectedItems: newSelectedItems
    };
    
    // 从第二层级开始（工作项实例），每次选择时调用统计接口
    const actualLevel = newSelectedItems.length - 1;
    if (actualLevel >= 1) {
      // 统计接口异步调用，不阻塞选择操作
      fetchStatistics(newSelectedItems, actualLevel);
    }
  };

  // 进入下一级（点击“下级”按钮）
  const handleGoNext = async (item, e) => {
    e.stopPropagation(); // 阻止冒泡
      
    // 防重复点击：如果正在处理中，直接返回
    if (operationLockRef.current) return;
    operationLockRef.current = true;
    
    // 立即触发 loading 状态，不等待接口调用
    setLoading(true);
  
    try {
      // 只保留当前层级及之前的项，清除之后的所有项
      const newSelectedItems = [...selectedItems.slice(0, currentLevel), item];
      setSelectedItems(newSelectedItems);
        
      console.log('[Cascader] 进入下一级:', item.label);
        
      if (item.hasNext) {
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
          
        // 缓存当前选择状态
        const cacheKey = newSelectedItems.map(i => i.value).join('-');
        pathDataCache.current[cacheKey] = {
          levelData: levelData,
          currentLevel: currentLevel,
          selectedItems: newSelectedItems
        };
          
        // 从第二层级开始（工作项实例），进入下一级时调用统计接口
        // 使用 newSelectedItems.length - 1 作为实际层级
        const actualLevel = newSelectedItems.length - 1;
        if (actualLevel >= 1) {
          // 统计接口异步调用，不阻塞主流程
          fetchStatistics(newSelectedItems, actualLevel);
        }
          
        // 检查是否已有 children 数据
        if (item.children && item.children.length > 0) {
          console.log('[Cascader] 使用已有的 children 数据:', item.children);
          // 登记模式下过滤 canRegister=false
          const filteredChildren = isRegistration
            ? item.children.filter(child => child.canRegister !== false)
            : item.children;
          console.log('[Cascader] 过滤后的 children 数据:', filteredChildren);
          setLevelData(filteredChildren);
          setLoading(false); // 使用缓存数据时立即关闭 loading
        } else {
          const parentData = {
            workItemId: newSelectedItems[0]?.value,
            workItemEntityId: newSelectedItems[1]?.value,
            nodeId: nextLevel > 2 ? newSelectedItems[nextLevel - 1]?.value : undefined,
          };
            
          console.log('[Cascader] 调用接口加载下一层:', nextLevel, '参数:', parentData);
          await fetchLevelData(nextLevel, parentData);
        }
      } else {
        setLoading(false); // 没有下一级时关闭 loading
      }
    } catch (error) {
      console.error('[Cascader] 进入下一级失败:', error);
      setLoading(false);
    } finally {
      // 延迟解锁，确保状态更新完成
      setTimeout(() => {
        operationLockRef.current = false;
      }, 300);
    }
  };

  // 返回上一层
  const handleBack = () => {
    if (currentLevel > 0) {
      const prevLevel = currentLevel - 1;
      setCurrentLevel(prevLevel);
      
      // 重新加载上一层数据
      const parentData = {
        workItemId: Array.isArray(selectedItems) ? selectedItems[0]?.value : undefined,
        workItemEntityId: Array.isArray(selectedItems) ? selectedItems[1]?.value : undefined,
        nodeId: Array.isArray(selectedItems) && prevLevel > 2 ? selectedItems[prevLevel - 1]?.value : undefined,
      };
      
      fetchLevelData(prevLevel, parentData);
    }
  };

  // 确认选择
  const handleConfirm = async (items) => {
    const finalItems = items || selectedItems;
    
    if (finalItems.length < 2) {
      return;
    }
    
    // 开启确认加载状态
    setConfirmLoading(true);
    
    try {
      // 构建返回数据
      const result = {
      workItemId: finalItems[0]?.value || '',
      workItemName: finalItems[0]?.label || '',
      workItemEntityId: finalItems[1]?.value || '',
      workItemEntityName: finalItems[1]?.label || '',
      nodeId: finalItems[2]?.value || '',
      nodeName: finalItems[2]?.label || '',
      // 任务层数据（第四层）
      subNodeId: finalItems[3]?.value || '',
      subNodeName: finalItems[3]?.label || '',
      taskId: finalItems[3]?.value || '',      // 同 subNodeId
      taskName: finalItems[3]?.label || '',    // 同 subNodeName
      targetId: finalItems[finalItems.length - 1]?.value || '',
      targetName: finalItems.map(item => item.label).join(' / '),
      canRegister: finalItems[finalItems.length - 1]?.canRegister ?? true,
      canRegisterLevel: finalItems[finalItems.length - 1]?.canRegisterLevel ?? 1,
      canRegisterLevelName: finalItems[finalItems.length - 1]?.canRegisterLevelName ?? '负责人',
    };
    
    // 缓存最终选择状态
    const cacheKey = finalItems.map(item => item.value).join('-');
    pathDataCache.current[cacheKey] = {
      levelData: levelData,
      currentLevel: currentLevel,
      selectedItems: finalItems
    };
    
    // 确认时始终重新获取当前选择层级的统计数据，确保数据是最新的
    const actualLevel = finalItems.length - 1;
    if (actualLevel >= 1) {
      try {
        console.log('[Cascader] 确认选择，重新获取第', actualLevel, '层的统计数据');
        const stats = await fetchStatistics(finalItems, actualLevel);
        if (stats) {
          result.registrationStats = stats;
          console.log('[Cascader] 最终使用的统计数据:', stats);
        }
      } catch (error) {
        console.error('[Cascader] 获取统计数据失败:', error);
      }
    }
    
    onConfirm(result);
    onClose();
    } finally {
      setConfirmLoading(false);
    }
  };

  // 点击 Tab 跳转到指定层级
  const handleTabClick = (targetLevel) => {
    if (targetLevel <= currentLevel) {
      setCurrentLevel(targetLevel);
      
      // 重新加载该层级的数据
      const parentData = {
        workItemId: Array.isArray(selectedItems) ? selectedItems[0]?.value : undefined,
        workItemEntityId: Array.isArray(selectedItems) && targetLevel > 1 ? selectedItems[1]?.value : undefined,
        nodeId: Array.isArray(selectedItems) && targetLevel > 2 ? selectedItems[targetLevel - 1]?.value : undefined,
      };
      
      fetchLevelData(targetLevel, parentData);
    }
  };

  // 获取当前层级标题
  const getLevelTitle = () => {
    return '请选择';
  };

  // 获取当前层级选中的项
  const getCurrentSelectedValue = () => {
    return Array.isArray(selectedItems) ? selectedItems[currentLevel]?.value : undefined;
  };



  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{ height: '70vh', borderRadius: '12px 12px 0 0' }}
    >
      <div className="work-item-cascader">
        {/* 确认加载遮罩 */}
        {confirmLoading && (
          <div className="confirm-loading-mask">
            <Loading />
          </div>
        )}
        
        {/* 头部 */}
        <div className="cascader-header">
          <span className="title">选择登记对象</span>
          <span className="cancel-btn" onClick={onClose}>取消</span>
        </div>
        
        {/* 级联 Tab 导航 */}
        <div className="cascader-tabs">
          {selectedItems.slice(0, currentLevel).map((item, index) => (
            <span 
              key={`tab-${index}-${item.value}`}
              className="cascader-tab"
              onClick={() => handleTabClick(index)}
            >
              {item.label}
            </span>
          ))}
          <span className="cascader-tab active">
            {Array.isArray(selectedItems) && currentLevel < selectedItems.length 
              ? selectedItems[currentLevel]?.label || '请选择'
              : '请选择'
            }
          </span>
        </div>
        
        {/* 选项列表 */}
        <div className="cascader-list">
          {loading ? (
            <div className="loading-container">
              <Loading />
            </div>
          ) : levelData.length === 0 ? (
            <div className="log-empty">
              <img className="empty-img" src={noDataImage} alt="暂无数据" />
              <div className="empty-text">暂无数据</div>
            </div>
          ) : (
            <>
              {levelData.map((item, index) => (
                <div 
                  key={`item-${index}-${item.value}`}
                  className={`cascader-item ${getCurrentSelectedValue() === item.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(item)}
                >
                  <div className="item-left">
                    <span className="item-label">{item.label}</span>
                    {getCurrentSelectedValue() === item.value && (
                      <CheckOutlined className="check-icon" />
                    )}
                  </div>
                  {item.hasNext && (
                    <div className="item-next" onClick={(e) => handleGoNext(item, e)}>
                      <img className="next-icon" src={nextLevelIcon} alt="下级" />
                      <span className="next-text">下级</span>
                    </div>
                  )}
                </div>
              ))}
              
              {/* 第二层时显示分页加载 */}
              {currentLevel === 1 && (
                <InfiniteScroll
                  loadMore={loadMoreLevel1}
                  hasMore={level1HasMore}
                  threshold={100}
                >
                  {level1LoadingMore && (
                    <div className="loading-more">
                      <Loading />
                      <span>加载中...</span>
                    </div>
                  )}
                </InfiniteScroll>
              )}
            </>
          )}
        </div>
        
        {/* 底部确定按钮 */}
        <div className="cascader-footer">
          <button 
            className={`confirm-btn ${selectedItems.length < 2 ? 'disabled' : ''}`}
            onClick={() => selectedItems.length >= 2 && handleConfirm()}
            disabled={selectedItems.length < 2}
          >
            确定
          </button>
        </div>
      </div>
    </Popup>
  );
};

export default WorkItemCascader;
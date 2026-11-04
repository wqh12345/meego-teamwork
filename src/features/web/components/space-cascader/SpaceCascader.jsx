import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Cascader, Spin, Typography } from 'antd';
import {
  getWorkItemOptionNew,
  getItemEntityOptionNew,
} from '../../../../api/api';
import noDataImg from '../../../../image/assets/no-data.png';
import CustomFieldCascaderOption, {
  getCascaderOptionLabel,
} from '../custom-field-cascader-option/CustomFieldCascaderOption';
import { useTenantCustomFieldConfig } from '../../hooks/useTenantCustomFieldConfig';
import './SpaceCascader.less';

const { Text } = Typography;

/**
 * 级联选择器
 *
 * 默认五级：空间 → 工作项 → 工作项实例 → 节点 → 任务
 * 通过 hideSpace + maxLevel 可控制为两级：工作项 → 工作项实例（隐藏空间层）
 *
 * 数据源（4 个后端接口）：
 *   空间         GET /project/list
 *   工作项       GET /level/getWorkItemOption           入参: projectKey
 *   工作项实例   GET /level/getItemEntityOption          入参: projectKey, workItemId, pageNum?
 *   节点+任务    GET /level/getNodeAndTaskOption         入参: projectKey, workItemId, workItemEntityId, pageNum
 *
 * 也支持自定义各层级获取函数：
 *   - fetchSpaceOptions         自定义空间拉取函数 () => Promise<{result,data}>
 *   - fetchWorkItemOptions      自定义工作项拉取函数 (projectKey) => Promise<{result,data}>
 *   - fetchEntityOptions        自定义实例拉取函数 (projectKey, workItemId, pageNum) => Promise<{result,data, hasMore}>
 *   - fetchNodeOptions          自定义节点任务拉取函数 (projectKey, workItemId, workItemEntityId, pageNum) => Promise<{result,data}>
 *
 * value 结构（受控）：
 *   - 默认五级：[spaceId, workItemId, workItemEntityId, nodeId, taskId]
 *   - hideSpace：[workItemId, workItemEntityId]
 * onChange(ids, names, selectedOptions)
 *
 * Props:
 *   - hideSpace                 隐藏空间层级，首列直接展示工作项（需提供 projectKey 或能从 sessionStorage 获取）
 *   - projectKey                指定项目 key（hideSpace 模式下必填，否则自动从 sessionStorage 读取）
 *   - value / defaultValue      受控/非受控值
 *   - disabled                  禁用
 *   - placeholder               占位
 *   - pageSize                  实例分页大小，默认 20
 *   - changeOnSelect            是否允许任意层级选中，默认 true
 *   - maxLevel                  最大可下钻层级，默认 5
 *   - spaceOptions              可选：静态空间列表
 *   - fetchSpaceOptions/fetchWorkItemOptions/fetchEntityOptions/fetchNodeOptions 自定义拉取函数
 *   - onChange                  见上
 *
 * Ref 方法：
 *   - reset()                   清空选择与缓存
 *   - reloadSpace()             重新拉取首屏数据
 */
const LEVEL_SPACE = 1;
const LEVEL_WORK_ITEM = 2;
const LEVEL_ENTITY = 3;
const LEVEL_NODE = 4;
const LEVEL_TASK = 5;

const joinKey = (...parts) => parts.filter((v) => v !== undefined && v !== null && v !== '').join('::');
const lastSeg = (key) => String(key || '').split('::').pop();

const isOk = (res) => {
  if (!res) return false;
  if (res.result === true) return true;
  if (res.success === true) return true;
  if (res.code === 200 || res.code === 0 || res.code === '200' || res.code === '0') return true;
  if (typeof res.msg === 'string' && res.msg.toLowerCase() === 'success') return true;
  return false;
};

const EMPTY_PREFIX = '__empty__::';
const makeEmptyChild = (parentKey) => ({
  value: `${EMPTY_PREFIX}${parentKey}`,
  label: (
    <div className="space-cascader-empty-item">
      <img src={noDataImg} alt="暂无数据" />
      <span>暂无数据</span>
    </div>
  ),
  disabled: true,
  isLeaf: true,
});
const isEmptyVal = (v) => typeof v === 'string' && v.startsWith(EMPTY_PREFIX);

const SpaceCascaderInner = (props) => {
  const {
    value,
    defaultValue,
    disabled = false,
    placeholder,
    pageSize = 20,
    changeOnSelect = true,
    maxLevel = LEVEL_TASK,
    hideSpace = false,
    projectKey: projectKeyProp,
    spaceOptions: spaceOptionsProp,
    fetchSpaceOptions,
    fetchWorkItemOptions,
    fetchEntityOptions,
    fetchNodeOptions,
    onChange,
    displayNames,
    optionRender: optionRenderProp,
    minDisplayValidLen,
    forwardedRef,
    ...restProps
  } = props || {};

  const { isEnabled: isCustomFieldEnabled } = useTenantCustomFieldConfig();

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [innerValue, setInnerValue] = useState(defaultValue || []);
  const userInteractedRef = useRef(false);

  const entityPagerRef = useRef({});
  const entityOptionValuesRef = useRef(new Set());
  const loadingMoreRef = useRef(false);
  const activeEntityColumnRef = useRef('');

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : innerValue;

  // 当前项目 key：优先 props，其次 sessionStorage
  const getProjectKey = () => {
    if (projectKeyProp) return projectKeyProp;
    return sessionStorage.getItem('jwtMeegoTeamworkProjectKey')
      || sessionStorage.getItem('adminCurrentProjectKey')
      || '';
  };

  /* ------------------------------ 工具函数 ------------------------------ */

  const attachChildren = (tree, parentKey, children, mode = 'replace') => {
    const walk = (list) => {
      for (const item of list) {
        if (item.value === parentKey) {
          if (mode === 'append') {
            item.children = (item.children || []).concat(children || []);
          } else {
            if (children && children.length > 0) {
              item.children = children;
            } else {
              item.children = [makeEmptyChild(parentKey)];
              item.isLeaf = false;
            }
          }
          return true;
        }
        if (item.children?.length && walk(item.children)) return true;
      }
      return false;
    };
    walk(tree);
    return [...tree];
  };

  const filterCanRegister = (arr) => {
    if (!arr?.length) return arr;
    return arr.filter((it) => it.canRegister !== false);
  };

  /* --------------------------- 数据拉取函数 ---------------------------- */

  const fetchSpaceList = async () => {
    if (typeof fetchSpaceOptions === 'function') {
      const res = await fetchSpaceOptions();
      if (!isOk(res)) return [];
      const payload = res.data || {};
      const rawList =
        payload.registrationLevelVoList ||
        payload.registerLevelList ||
        payload.list ||
        payload.records ||
        (Array.isArray(payload) ? payload : payload.data) ||
        [];
      if (!Array.isArray(rawList)) return [];
      return rawList
        .filter((it) => it && (it.value !== undefined && it.value !== null && it.value !== ''))
        .map((it) => ({
          ...it,
          value: String(it.value ?? it.id ?? it.spaceId ?? it.projectKey),
          label: it.label ?? it.level ?? it.name ?? it.spaceName ?? it.projectName,
          isLeaf: false,
          hasNext: it.hasNext !== false,
          raw: it,
        }));
    }
    if (Array.isArray(spaceOptionsProp) && spaceOptionsProp.length) {
      return spaceOptionsProp.map((it) => ({
        label: it.label ?? it.level ?? it.name ?? it.spaceName,
        value: String(it.value ?? it.id ?? it.spaceId),
        isLeaf: false,
        hasNext: true,
        raw: it,
      }));
    }
    const res = await getProjectList();
    if (!isOk(res) || !Array.isArray(res.data)) return [];
    return res.data.map((it) => ({
      label: it.label,
      value: String(it.value),
      isLeaf: false,
      hasNext: true,
      raw: it,
    }));
  };

  const fetchWorkItemList = async (parentKey) => {
    let res;
    if (typeof fetchWorkItemOptions === 'function') {
      const projectKey = hideSpace ? getProjectKey() : lastSeg(parentKey);
      res = await fetchWorkItemOptions(projectKey);
    } else if (hideSpace) {
      // hideSpace 模式：调用新接口 entityInstance/new/getWorkItemOption（无需 projectKey）
      res = await getWorkItemOptionNew();
    } else {
      const projectKey = lastSeg(parentKey);
      res = await getLevelWorkItemOption({ projectKey });
    }
    if (!isOk(res)) return [];
    // 兼容：新接口可能是 {code:200, data:[...]} 或 {result:true, data:[...]}
    let rawList = res.data;
    if (!Array.isArray(rawList)) {
      rawList = rawList?.data || rawList?.list || rawList?.records || rawList?.registrationLevelVoList || [];
    }
    if (!Array.isArray(rawList)) return [];
    const list = filterCanRegister(rawList) || [];
    return list.map((item) => {
      const rawHasNext = item.hasNext !== undefined ? !!item.hasNext : true;
      const workItemLevel = hideSpace ? LEVEL_WORK_ITEM - 1 : LEVEL_WORK_ITEM;
      const hasNext = maxLevel > workItemLevel && rawHasNext;
      return {
        label: item.label ?? item.level ?? item.name,
        value: hideSpace ? String(item.value) : joinKey(parentKey, String(item.value)),
        isLeaf: !hasNext,
        hasNext,
        raw: item,
      };
    });
  };

  const fetchEntityList = async (workItemKey, pageNum = 1) => {
    const segs = workItemKey.split('::');
    let projectKey, workItemId;
    if (hideSpace) {
      workItemId = segs[0];
    } else {
      projectKey = segs[0];
      workItemId = segs[1];
    }
    let res;
    if (typeof fetchEntityOptions === 'function') {
      res = await fetchEntityOptions(projectKey, workItemId, pageNum);
    } else if (hideSpace) {
      // hideSpace 模式：调用新接口 entityInstance/new/getItemEntityOption（返回 {code:200, data:{data:[...], total, hasMore?}}）
      res = await getItemEntityOptionNew({ workItemId, pageNum, pageSize });
    } else {
      res = await getLevelItemEntityOption({ projectKey, workItemId, pageNum, pageSize });
    }
    if (!isOk(res)) return { list: [], hasMore: false };
    // 解析响应：兼容 {data:[...]} / {data:{data:[...]}} / {data:{records:[...]}} / {data:{registrationLevelVoList:[...]}}
    const payload = res.data || {};
    let rawList;
    if (Array.isArray(payload)) {
      rawList = payload;
    } else {
      rawList = payload.registrationLevelVoList
        || payload.registerLevelList
        || payload.data
        || payload.list
        || payload.records
        || [];
    }
    if (!Array.isArray(rawList)) rawList = [];
    const entityLevel = hideSpace ? LEVEL_ENTITY - 1 : LEVEL_ENTITY;
    const rows = rawList.map((item) => {
      const rawHasNext = item.hasNext !== undefined ? !!item.hasNext : true;
      const canRegister = item.canRegister !== false;
      const hasNext = maxLevel > entityLevel && rawHasNext && canRegister;
      const value = joinKey(workItemKey, String(item.value));
      entityOptionValuesRef.current.add(value);
      return {
        label: item.label ?? item.level ?? item.name,
        value,
        isLeaf: !hasNext,
        hasNext,
        raw: item,
      };
    });
    // 分页判断：优先用接口返回的 hasMore/hasNext，否则根据返回数量判断
    let hasMore = false;
    if (payload.hasMore !== undefined) hasMore = !!payload.hasMore;
    else if (payload.hasNext !== undefined) hasMore = !!payload.hasNext;
    else hasMore = rawList.length >= pageSize;
    entityPagerRef.current[workItemKey] = { pageNum, hasMore };
    return { list: rows, hasMore };
  };

  const fetchNodeList = async (entityKey) => {
    const segs = entityKey.split('::');
    let projectKey, workItemId, workItemEntityId;
    if (hideSpace) {
      // hideSpace: [workItemId, entityId]
      projectKey = getProjectKey();
      workItemId = segs[0];
      workItemEntityId = segs[1];
    } else {
      projectKey = segs[0];
      workItemId = segs[1];
      workItemEntityId = segs[2];
    }
    const pageNum = 1;
    let res;
    if (typeof fetchNodeOptions === 'function') {
      res = await fetchNodeOptions(projectKey, workItemId, workItemEntityId, pageNum);
    } else {
      res = await getLevelNodeAndTaskOption({ projectKey, workItemId, workItemEntityId, pageNum });
    }
    if (!isOk(res)) return [];
    const data = res.data || {};
    const rawList = data.registrationLevelVoList || data.registerLevelList || data.data || [];
    const nodeLevel = hideSpace ? LEVEL_NODE - 1 : LEVEL_NODE;
    return (rawList || []).map((node) => {
      const nodeValue = joinKey(entityKey, String(node.value));
      const nodeCanRegister = node.canRegister !== false;
      const tasks = Array.isArray(node.children) ? node.children : [];
      const children = tasks.map((task) => ({
        label: task.label ?? task.level ?? task.name,
        value: joinKey(nodeValue, String(task.value)),
        isLeaf: true,
        raw: task,
      }));
      const rawHasNext = node.hasNext !== undefined ? !!node.hasNext : children.length > 0;
      const hasNext = maxLevel > nodeLevel && rawHasNext && nodeCanRegister;
      return {
        label: node.label ?? node.level ?? node.name,
        value: nodeValue,
        children: hasNext && children.length ? children : undefined,
        isLeaf: !hasNext,
        hasNext,
        raw: node,
      };
    });
  };

  /* ------------------------------ 首屏加载 ----------------------------- */

  const loadFirstLevel = async () => {
    if (options.length) return;
    setLoading(true);
    try {
      const list = hideSpace ? await fetchWorkItemList(null) : await fetchSpaceList();
      setOptions(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      entityPagerRef.current = {};
      entityOptionValuesRef.current.clear();
    };
  }, []);

  /* ------------------------------ 动态加载 ----------------------------- */

  const MORE_PREFIX = 'more::';

  const appendLoadingSentinel = (list, parentKey, pageNum) => {
    list.push({
      disabled: true,
      isLeaf: true,
      value: `${MORE_PREFIX}${parentKey}::${pageNum}`,
      label: (
        <div
          className="space-cascader-loading-sentinel"
          style={{ opacity: 0, pointerEvents: 'none', userSelect: 'none' }}
        />
      ),
    });
    return list;
  };

  const loadData = async (selectedOptions) => {
    const target = selectedOptions[selectedOptions.length - 1];
    const depth = selectedOptions.length; // 1=首列 2=第二列 ...

    // 达到最大层级则不下钻
    if (depth >= maxLevel) return;

    setOptions((prev) => {
      const node = findNodeByValue(prev, target.value);
      if (node) node.loading = true;
      return [...prev];
    });
    try {
      // 根据 hideSpace 决定首列是空间还是工作项
      const firstIsWorkItem = hideSpace;
      if (depth === 1) {
        if (firstIsWorkItem) {
          // 首列是工作项 → 加载实例
          activeEntityColumnRef.current = target.value;
          const { list, hasMore } = await fetchEntityList(target.value, 1);
          if (hasMore) appendLoadingSentinel(list, target.value, 1);
          setOptions((prev) => attachChildren(prev, target.value, list));
        } else {
          // 首列是空间 → 加载工作项
          const list = await fetchWorkItemList(target.value);
          setOptions((prev) => attachChildren(prev, target.value, list));
        }
      } else if (depth === 2) {
        if (firstIsWorkItem) {
          // 第二列是实例 → 加载节点/任务
          const list = await fetchNodeList(target.value);
          setOptions((prev) => attachChildren(prev, target.value, list));
        } else {
          // 第二列是工作项 → 加载实例
          activeEntityColumnRef.current = target.value;
          const { list, hasMore } = await fetchEntityList(target.value, 1);
          if (hasMore) appendLoadingSentinel(list, target.value, 1);
          setOptions((prev) => attachChildren(prev, target.value, list));
        }
      } else if (depth === 3) {
        if (!firstIsWorkItem) {
          // 第三列是实例 → 加载节点/任务
          const list = await fetchNodeList(target.value);
          setOptions((prev) => attachChildren(prev, target.value, list));
        }
      }
      // depth >=4 节点的子任务已随 fetchNodeList 一次返回
    } finally {
      setOptions((prev) => {
        const node = findNodeByValue(prev, target.value);
        if (node) node.loading = false;
        return [...prev];
      });
    }
  };

  const handleMenuScroll = async (e) => {
    const menuEl = e.target;
    if (!menuEl || !menuEl.classList || !menuEl.classList.contains('ant-cascader-menu')) return;
    if (menuEl.scrollTop + menuEl.clientHeight < menuEl.scrollHeight - 8) return;
    if (loadingMoreRef.current) return;

    const lastItem = menuEl.querySelector('li.ant-cascader-menu-item:last-child');
    if (!lastItem || !lastItem.querySelector('.space-cascader-loading-sentinel')) return;

    const parentKey = activeEntityColumnRef.current;
    if (!parentKey) return;
    const pager = entityPagerRef.current[parentKey];
    if (!pager || !pager.hasMore) return;
    const nextPage = (pager.pageNum || 1) + 1;

    loadingMoreRef.current = true;
    try {
      const { list, hasMore } = await fetchEntityList(parentKey, nextPage);
      setOptions((prev) => {
        const parent = findNodeByValue(prev, parentKey);
        if (!parent?.children?.length) return prev;
        const children = parent.children.filter(
          (c) => !(typeof c.value === 'string' && c.value.startsWith(MORE_PREFIX))
        );
        const merged = children.concat(list);
        if (hasMore) appendLoadingSentinel(merged, parentKey, nextPage);
        parent.children = merged;
        return [...prev];
      });
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const findNodeByValue = (tree, value) => {
    for (const item of tree) {
      if (item.value === value) return item;
      if (item.children?.length) {
        const r = findNodeByValue(item.children, value);
        if (r) return r;
      }
    }
    return null;
  };

  const toDisplayValue = (ids, tree) => {
    if (!Array.isArray(ids) || ids.length === 0) return ids;
    const display = [];
    let level = tree;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id === undefined || id === null || id === '') break;
      const idStr = String(id);
      const node = Array.isArray(level)
        ? level.find((it) => lastSeg(it.value) === idStr || String(it.value) === idStr)
        : null;
      if (node) {
        display.push(node.value);
        level = node.children;
      } else {
        const parentKey = display[display.length - 1];
        display.push(parentKey ? joinKey(parentKey, idStr) : idStr);
        level = null;
      }
    }
    return display;
  };

  /* -------------------------------- 选中 ------------------------------- */

  const handleChange = (val, selectedOptions) => {
    if (val && val.some((v) => typeof v === 'string' && (v.startsWith(MORE_PREFIX) || isEmptyVal(v)))) return;

    userInteractedRef.current = true;
    if (!isControlled) setInnerValue(val || []);

    if (typeof onChange !== 'function') return;

    const ids = (val || []).map((key) => lastSeg(key));
    const names = {};
    if (hideSpace) {
      names.workItemName = selectedOptions?.[0]?.label;
      names.workItemEntityName = selectedOptions?.[1]?.label;
      names.nodeName = selectedOptions?.[2]?.label;
      names.taskName = selectedOptions?.[3]?.label;
    } else {
      names.spaceName = selectedOptions?.[0]?.label;
      names.workItemName = selectedOptions?.[1]?.label;
      names.workItemEntityName = selectedOptions?.[2]?.label;
      names.nodeName = selectedOptions?.[3]?.label;
      names.taskName = selectedOptions?.[4]?.label;
    }
    onChange(ids, names, selectedOptions);
  };

  /* -------------------------------- Ref -------------------------------- */

  useImperativeHandle(forwardedRef, () => ({
    reset: () => {
      entityPagerRef.current = {};
      entityOptionValuesRef.current.clear();
      activeEntityColumnRef.current = '';
      setOptions([]);
      if (!isControlled) setInnerValue([]);
      if (typeof onChange === 'function') onChange([], {}, []);
    },
    reloadSpace: async () => {
      entityPagerRef.current = {};
      entityOptionValuesRef.current.clear();
      activeEntityColumnRef.current = '';
      setLoading(true);
      try {
        const list = hideSpace ? await fetchWorkItemList(null) : await fetchSpaceList();
        setOptions(list);
      } finally {
        setLoading(false);
      }
    },
  }));

  /* -------------------------------- 渲染 ------------------------------- */

  const displayValue = toDisplayValue(currentValue, options);

  const finalPlaceholder = placeholder || (hideSpace ? '请选择工作项 / 工作项实例' : '请选择空间 / 工作项 / 实例 / 节点 / 任务');

  const renderLabels = (labels) => {
    if (minDisplayValidLen) {
      const validLen = Array.isArray(currentValue)
        ? currentValue.filter((v) => v !== undefined && v !== null && v !== '').length
        : 0;
      if (validLen < minDisplayValidLen) {
        return <span style={{ color: '#bfbfbf' }}>{finalPlaceholder}</span>;
      }
    }
    if (
      !userInteractedRef.current &&
      Array.isArray(displayNames) &&
      displayNames.filter(Boolean).length &&
      Array.isArray(currentValue) &&
      currentValue.filter((v) => v !== undefined && v !== null && v !== '').length
    ) {
      const validLen = currentValue.filter((v) => v !== undefined && v !== null && v !== '').length;
      const names = displayNames.slice(0, validLen).filter(Boolean);
      if (names.length) return names.join(' / ');
    }
    return labels.join(' / ');
  };

  return (
    <Cascader
      {...restProps}
      className={`space-cascader ${restProps.className || ''}`}
      disabled={disabled}
      options={options}
      value={displayValue}
      optionRender={(option) => {
        const defaultLabel = getCascaderOptionLabel(option);
        if (option?.__cascader_fix_label__ !== undefined) return defaultLabel;
        const label = typeof optionRenderProp === 'function'
          ? optionRenderProp(option)
          : defaultLabel;
        return entityOptionValuesRef.current.has(option.value) ? (
          <CustomFieldCascaderOption
            label={label}
            customFieldValue={option.raw?.customFieldValue ?? option.customFieldValue}
            isCustomFieldEnabled={isCustomFieldEnabled}
          />
        ) : label;
      }}
      loadData={loadData}
      onChange={handleChange}
      changeOnSelect={changeOnSelect}
      placeholder={finalPlaceholder}
      virtual={false}
      onOpenChange={(open) => {
        if (open) loadFirstLevel();
      }}
      onFocus={loadFirstLevel}
      notFoundContent={loading ? <Spin size="small" /> : (
        <div className="space-cascader-empty">
          <img src={noDataImg} alt="暂无数据" />
          <span>暂无数据</span>
        </div>
      )}
      displayRender={(labels) => renderLabels(labels)}
      popupRender={(menus) => (
        <div className="space-cascader-dropdown" onScrollCapture={handleMenuScroll}>
          {menus}
        </div>
      )}
    />
  );
};

const SpaceCascader = React.forwardRef((props, ref) => (
  <SpaceCascaderInner {...props} forwardedRef={ref} />
));

SpaceCascader.displayName = 'SpaceCascader';

export default SpaceCascader;

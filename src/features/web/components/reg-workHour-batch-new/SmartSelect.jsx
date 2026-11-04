import React, { useState, useEffect, useRef, useMemo } from "react";
import { Select, Spin, Empty, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import debounce from "lodash/debounce";
import CustomFieldCascaderOption from "../custom-field-cascader-option/CustomFieldCascaderOption";

export const getWorkItemEntityOptionKey = (workItemId, workItemEntityId) => (
  JSON.stringify([workItemId, workItemEntityId])
);

// 从 value 串（JSON）中解析稳定主键 [workItemId, workItemEntityId]
// 选中态与去重一律按主键判定，不再依赖整串全等 ——
// 记忆恢复链路的串含 projectKey、搜索链路的串不含，
// 全等比较会把同一实例误判为两个不同选项
const getEntityItemKey = (itemStr) => {
  try {
    const parsed = JSON.parse(itemStr);
    if (!parsed?.value) return null;
    return getWorkItemEntityOptionKey(parsed.workItemId, parsed.value);
  } catch (e) {
    return null;
  }
};

// 按主键去重，保留首次出现的串（同一实例只留第一个）
const dedupeByEntityKey = (arr) => {
  const seen = new Set();
  return (arr || []).filter((s) => {
    const key = getEntityItemKey(s);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// onChange 兜底去重：同主键时优先保留上一次已在选中值里的串，
// 丢弃本次新点入的异串（典型场景：原串已被回显映射保住勾选态，
// antd 又把搜索结果串当作新值 append 了进来）
// 返回保留项下标集合，供 option 数组同索引同步过滤
const dedupeEmitByEntityKey = (arr, prevArr) => {
  const prevSet = new Set((prevArr || []).map(getEntityItemKey).filter(Boolean));
  const keptIdxByKey = new Map();
  (arr || []).forEach((s, i) => {
    const key = getEntityItemKey(s);
    if (!key) return;
    if (!keptIdxByKey.has(key)) {
      keptIdxByKey.set(key, i);
      return;
    }
    // 已保留一项时，若当前项是原选中串而暂留项不是，则换绑到当前项
    if (prevSet.has(key) && !prevSet.has(getEntityItemKey(arr[keptIdxByKey.get(key)]))) {
      keptIdxByKey.set(key, i);
    }
  });
  const keptIdx = new Set(keptIdxByKey.values());
  // 无主键可判定的串（解析失败等）全部保留，维持原行为
  (arr || []).forEach((s, i) => {
    if (!getEntityItemKey(s)) keptIdx.add(i);
  });
  return {
    values: (arr || []).filter((_, i) => keptIdx.has(i)),
    droppedIdx: (arr || []).map((_, i) => i).filter((i) => !keptIdx.has(i)),
  };
};

const SmartSelect = ({
  fetchOptions,
  workItemIds,
  workItemEntityIds,
  debounceTimeout = 800,
  pageSize = 50,
  isCustomFieldEnabled,
  workItemEntityCustomFieldValues = {},
  ...props
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const requestId = useRef(0);
  const containerRef = useRef(null);
  // 稳定化防抖后 debounce 只建一次、闭包会捕获旧的 value/workItemIds；
  // 用 ref 始终指向最新 loadData，供防抖搜索与 IntersectionObserver 翻页调用
  const loadDataRef = useRef(null);
  // 翻页时透传当前搜索词（observer effect 依赖不含 searchKeyword，用 ref 取最新值）
  const searchKeywordRef = useRef("");
  // 记录组件自己最近一次 emit 的选中值：回流若与它相等，
  // 说明是“用户刚选中/取消”的回声，不重建 options
  // （否则搜索结果会塌缩成只剩已选项，无法继续多选）
  // 注：只比对 ids，不比 customFieldValues —— 父组件 getWorkItemIdsFilter
  // 每次选中都会合并更新 workItemEntityCustomFieldValues，纳入比对会使回声永远不成立；
  // 搜索结果 options 的 customFieldValue 由 loadData 从接口带出，显示不受影响
  const lastEmittedRef = useRef(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  // 下拉顶部内嵌搜索框的即时输入值（searchKeyword 防抖 800ms 后才更新，不能直绑）
  const [searchText, setSearchText] = useState("");
  const [value, setValue] = useState(null);

useEffect(() => {
    try {
      if (props?.type !== "search") return;
      if (workItemIds?.length) {
        if (value && value?.length) {
          const filterArr = value.filter((item) =>
            workItemIds.includes(JSON.parse(item)?.workItemId)
          );
          setValue(filterArr?.length ? filterArr : null);
        }
      } else {
        setValue(null);
      }
    } catch (error) {
      console.log(error);
    }
  }, [workItemIds]);


  useEffect(() => {
     setValue(workItemEntityIds);
     const isEcho =
       lastEmittedRef.current !== null &&
       lastEmittedRef.current === JSON.stringify(workItemEntityIds);
     // 用户在下拉里选中/取消触发的回流：只同步 value，保留当前搜索结果列表
     if (isEcho) return;
     // 外部回填（记忆/缓存/失焦等）重建时按主键去重，防止同一实例长短串并存
     const uniqIds = dedupeByEntityKey(workItemEntityIds);
      //if (!uniqIds.length) {
        setOptions(
          uniqIds?.map((item) => {
            const parsedItem = JSON.parse(item);
            return {
              label: parsedItem?.label,
              value: item,
              customFieldValue: workItemEntityCustomFieldValues[
                getWorkItemEntityOptionKey(parsedItem?.workItemId, parsedItem?.value)
              ],
            };
          })
        );
      //}
    if (workItemEntityIds?.length) {
      setHasMore(false);
    }
   }, [JSON.stringify(workItemEntityIds), JSON.stringify(workItemEntityCustomFieldValues)]);

  const loadData = async (page = 1, keyword = "") => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const { data } = await fetchOptions({
        pageNum: page,
        pageSize,
        workItemEntityName: keyword,
        workItemIds,
      });

      if (currentRequest !== requestId.current) return;

      // 已选实例的主键 → 选中值里的原串映射：
      // 搜索结果里命中的选项回显为原串，保证 antd 全等匹配生效（显示勾选态、点击即取消）
      const canonicalByKey = new Map();
      (value || []).forEach((s) => {
        const key = getEntityItemKey(s);
        if (key && !canonicalByKey.has(key)) canonicalByKey.set(key, s);
      });
      const newOptions = data?.data?.map((item) => {
        const shortStr = JSON.stringify({
          workItemId: item.workItemId,
          label: item.label,
          value: item.value,
        });
        return {
          label: item.label,
          customFieldValue: item.customFieldValue,
          value: canonicalByKey.get(
            getWorkItemEntityOptionKey(item.workItemId, item.value)
          ) || shortStr,
        };
      });

      if (page === 1) {
        setOptions(newOptions || []);
      } else {
        setOptions((prev) => [...(prev || []), ...(newOptions || [])]);
      }

      setHasMore(data?.hasNext);
    } finally {
      setLoading(false);
    }
  };

  // 每次渲染指向最新 loadData / 最新搜索词
  loadDataRef.current = loadData;
  searchKeywordRef.current = searchKeyword;

  /**
   * 稳定化搜索防抖：整个生命周期只创建一个 debounce 实例。
   * 旧写法写在函数体内，每敲一个字都随重渲染重建 debounce，
   * 旧定时器不被新实例取消 → 连续输入累积多次接口调用，防抖形同失效。
   * 同时：关键字去空白后为空则不发请求，避免空串/空格打到接口。
   */
  const debouncedSearch = useMemo(
    () =>
      debounce(
        (keyword) => {
          const kw = (keyword || "").trim();
          setSearchKeyword(kw);
          setCurrentPage(1);
          if (!kw) {
            setLoading(false);
            return;
          }
          loadDataRef.current(1, kw);
        },
        debounceTimeout,
      ),
    [debounceTimeout],
  );

  // 卸载时取消未执行的防抖，避免组件销毁后仍触发请求 / 状态更新
  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // 已选项回显列表：与反显 effect 同款映射（先按主键去重）
  // （customFieldValue 从 workItemEntityCustomFieldValues 按 optionKey 取）
  const buildEchoOptions = (ids) =>
    dedupeByEntityKey(ids).map((item) => {
      const parsedItem = JSON.parse(item);
      return {
        label: parsedItem?.label,
        value: item,
        customFieldValue: workItemEntityCustomFieldValues[
          getWorkItemEntityOptionKey(parsedItem?.workItemId, parsedItem?.value)
        ],
      };
    });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          setCurrentPage((prev) => {
            loadDataRef.current(prev + 1, searchKeywordRef.current);
            return prev + 1;
          });
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  return (
    <Select
      {...props}
      // 禁用内联搜索，只用下拉顶部内嵌搜索框（搜索仍走原有远程防抖接口）
      showSearch={false}
      className="workItemEntity-select"
      popupClassName={[
        props.popupClassName,
        "batch-work-item-entity-dropdown",
      ].filter(Boolean).join(" ")}
      filterOption={false}
      onSearch={debouncedSearch}
      options={options}
      loading={loading}
      value={value}
      onBlur={() => {
        // 失焦不再清空列表：有已选实例则回显为已选项（带勾选态，可点击取消），
        // 无已选时 options 为空数组，保持“请输入工作项实例名称”空态 UI
        setOptions(buildEchoOptions(workItemEntityIds));
        // 与反显 effect 同语义：有已选项时关掉滚动加载，
        // 避免无搜索词时 IntersectionObserver 混入全量数据；搜索第一页会重新置位
        if (workItemEntityIds?.length) {
          setHasMore(false);
        }
        setSearchKeyword("");
        setSearchText("");
        if (props?.onBlur) props.onBlur();
      }}
      onChange={(nextValue, option) => {
        // 兜底：同主键的长短串只保留一个（优先保留原选中串），
        // option 数组同索引同步过滤后再回传父组件
        const prevValue = value || [];
        const { values: deduped, droppedIdx } = dedupeEmitByEntityKey(
          nextValue,
          prevValue
        );
        const dedupedOption = Array.isArray(option)
          ? option.filter((_, i) => !droppedIdx.includes(i))
          : option;
        setValue(deduped);
        lastEmittedRef.current = JSON.stringify(deduped);
        // 无搜索词时，当前列表是“已选回显快照”：随选中增删即时同步，
        // 避免已删除/取消的实例残留在列表里；
        // 有搜索词时列表是候选集，保持不动以支持连续多选
        if (!searchKeyword && !searchText) {
          setOptions(buildEchoOptions(deduped));
        }
        if (props?.onChange) props.onChange(deduped);
        if (props?.getWorkItemIdsFilter) props.getWorkItemIdsFilter(dedupedOption);
      }}
      optionRender={(option) => (
        <div className="batch-work-item-entity-option">
          <CustomFieldCascaderOption
            label={option.label}
            customFieldValue={option.data?.customFieldValue ?? option.customFieldValue}
            isCustomFieldEnabled={isCustomFieldEnabled}
          />
        </div>
      )}
      notFoundContent={
        (searchText?.trim() || searchKeyword)?.length ? (
          loading ? (
            <div
              style={{
                width: "100%",
                height: "200px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Spin tip="数据加载中..." />
              <span
                style={{ color: "#727272", fontSize: "12px", marginTop: 10 }}
              >
                数据加载中...
              </span>
            </div>
          ) : (
            <Empty
              image={require("../../../../image/no-data-table.png")}
              styles={{
                image: {
                  height: 90,
                  width: 90,
                  margin: "auto",
                  marginBottom: 10,
                },
              }}
              description={
                <span style={{ color: "#727272", fontSize: "12px" }}>
                  没有找到匹配的工作项实例
                </span>
              }
            ></Empty>
          )
        ) : (
          <Empty
            image={require("../../../../image/no-data-table.png")}
            styles={{
              image: {
                height: 90,
                width: 90,
                margin: "auto",
                marginBottom: 10,
              },
            }}
            description={
              <span style={{ color: "#727272", fontSize: "12px" }}>
                请输入工作项实例名称
              </span>
            }
          ></Empty>
        )
      }
      dropdownRender={(menu) => (
        <>
          {/* 下拉顶部内嵌搜索框：输入即触发既有 debouncedSearch 远程模糊搜索 */}
          <div style={{ padding: "8px 8px 4px", borderBottom: "1px solid #f0f0f0" }}>
            <Input
              size="small"
              allowClear
              placeholder="搜索"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => {
                const v = e.target.value;
                setSearchText(v);
                const kw = v.trim();
                // 空 / 纯空白：取消待发防抖、不发接口，列表回退到已选回显快照（同失焦行为）
                if (!kw) {
                  debouncedSearch.cancel();
                  setSearchKeyword("");
                  setLoading(false);
                  setOptions(buildEchoOptions(workItemEntityIds));
                  if (workItemEntityIds?.length) setHasMore(false);
                  return;
                }
                // 有关键字：输入即刻进入 loading（覆盖 800ms 防抖空窗），并透传去空白后的词
                setLoading(true);
                debouncedSearch(kw);
              }}
              // 阻止冒泡：点搜索框不关闭下拉
              onMouseDown={(e) => e.stopPropagation()}
              // 阻止键盘事件冒泡给 Select（Portal 沿组件树冒泡），
              // 避免 Backspace/Enter 被 rc-select 拦截误删已选工作项实例
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div
            ref={containerRef}
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            {menu}
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              {loading && currentPage > 1 && (
                <Spin tip="数据加载中..." size="small" />
              )}
              {!loading && hasMore && options?.length > 0 && (
                <span style={{ color: "#727272", fontSize: "12px" }}>
                  继续滚动加载更多...
                </span>
              )}
            </div>
          </div>
        </>
      )}
    />
  );
};

export default SmartSelect;

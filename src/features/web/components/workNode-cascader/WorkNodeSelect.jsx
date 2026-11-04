import React, { useEffect, useState } from "react";
import { Cascader, Spin, Typography } from "antd";
import {
  getWorkItemOptionNew,
  getItemEntityOptionNew,
  getEntityNodeOptionNew,
  getEntityTaskOptionNew,
  getWorkItemOptionForRegister,
} from "../../../../api/api";
import InfiniteScroll from "react-infinite-scroller";
import { WorkItem } from "@lark-project/js-sdk";
import CustomFieldCascaderOption, {
  getCascaderOptionLabel,
} from "../custom-field-cascader-option/CustomFieldCascaderOption";
import { useTenantCustomFieldConfig } from '../../hooks/useTenantCustomFieldConfig';
import "./WorkNodeSelect.less";
const { Text } = Typography;

const WorkNodeCascader = (props) => {
  const { isEnabled: isCustomFieldEnabled } = useTenantCustomFieldConfig();
  const entityOptionValuesRef = React.useRef(new Set());
  // 暴露方法给父组件
  React.useImperativeHandle(props?.forwardedRef, () => ({
    // 允许外部直接调用fetchItemEntityOptionData方法
    fetchItemEntityOptionData: async (workItemId, pageNum, pageSize) => {
      return fetchItemEntityOptionData(workItemId, pageNum, pageSize);
    },
    // 允许外部直接访问getItemEntityOptionNew接口函数
    getItemEntityOptionNew: async (data) => {
      return fetchWorkItemOptionData(data);
    },
    // 重置选择状态
    resetSelection: () => {
      setWorkItem([]);
      setCurWorkItem([]);
      setWorkItemId("");
      setWorkItemEntityId("");
      setNodeId("");
      setTaskId("");
      setOptions([]);
      entityOptionValuesRef.current.clear();
      // 触发父组件的getWorkItem回调，确保父组件知道选择已清空
      if (typeof props?.getWorkItem === 'function') {
        props.getWorkItem([]);
      }
    }
  }));
      const { userKey = '', myselfFlag: originalMyselfFlag = false } = props || {};
      const myselfFlag = originalMyselfFlag == 1 ? true : false;
    // const { userKey = '', myselfFlag = false } = props || {};
  const [loading, setLoading] = useState(false);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [curFlowType, setCurFlowType] = useState("");
  const [curWorkItem, setCurWorkItem] = useState([]);
  const [workItem, setWorkItem] = useState([]);
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [hasMore, setHasMore] = useState(false); // 是否有更多数据可加载
  const [entityPagination, setEntityPagination] = useState({
    pageNum: 1,
    pageSize: 20,
  });
  const [lastLoadedWorkItemId, setLastLoadedWorkItemId] = useState(null); // 记录上次加载的工作项ID

  /** 获取工作项 */
  const fetchWorkItemOptionData = async () => {
    setEntityPagination({
      pageNum: 1,
      pageSize: 20,
    });
    //console.log('poptions', options);
    setHasMore(false);
    if (options?.length) return;
    setLoading(true);
    if (props?.filterWorkItem) {
      const res = await getWorkItemOptionForRegister();
      if (res?.result) {
        res?.data.forEach((item) => {
          item.isLeaf = !item.hasNext;
        });
        setOptions(res.data);
      }
    } else {
      const res = await getWorkItemOptionNew();
      if (res?.result) {
        res?.data.forEach((item) => {
          item.isLeaf = !item.hasNext;
        });
        setOptions(res.data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    // fetchWorkItemOptionData();
    if (props?.workItemName) {
      setWorkItem(props?.workItemName);
    }
    
    // 组件卸载时重置nodeLoading状态
    return () => {
      setNodeLoading(false);
    };
  }, []);

  /** 获取工作项实例(分页) */
  const fetchItemEntityOptionData = async (workItemId, pageNum, pageSize) => {
    const data = {
      workItemId,
      pageNum: pageNum ? pageNum : entityPagination.pageNum,
      pageSize: pageSize ? pageSize : entityPagination.pageSize,
      userKey,
      myselfFlag,
    };
    const res = await getItemEntityOptionNew(data);
    if (res?.result) {  
      setHasMore(res.data.hasNext);
      // 过滤掉canRegister=false的数据
      if (res?.data?.data?.length > 0) {
        res.data.data = res.data.data.filter(item => item.canRegister !== false);
      }
      if (!res?.data?.data?.length) {
       window.JSSDK.toast.error(`暂无数据！`);
      }
      if (res.data.hasNext) {
        setEntityPagination({
          ...entityPagination,
          pageNum: entityPagination.pageNum + 1,
        });
      }
      res?.data?.data.forEach((item) => {
        item.isLeaf = !item.hasNext;
        item.value = `${workItemId}-${item.value}`;
        entityOptionValuesRef.current.add(item.value);
      });
      if (res.data.hasNext)
        res.data.data.push({
          isLeaf: false,
          value: `more-btn-${entityPagination.pageNum}`,
          label: (
            <Text type="secondary" loading={nodeLoading} className="more-btn">
              点击加载更多实例...
            </Text>
          ),
        });
      return res.data.data;
    }
  };

  /** 获取工作项实例节点 */
  const fetchEntityNodeOptionData = async (workItemId, workItemEntityId) => {
    workItemEntityId = workItemEntityId.split("-")[1];
    const data = {
      workItemId,
      workItemEntityId,
      userKey,
      myselfFlag,

    };
    const res = await getEntityNodeOptionNew(data); 
    if (res?.result) {
      if (res?.data?.length > 0) {
        res.data = res.data.filter(item => item.canRegister !== false);
      }
      res?.data?.forEach((item) => {
          // 如果item.children有值，并且所有对象的canRegister字段都是false，将hasNext设置为false
          if (item?.children && item.children.length > 0) {
            const allCanRegisterFalse = item.children.every(child => child.canRegister === false);
            if (allCanRegisterFalse) {
              item.hasNext = false;
            }
            item.children = item.children.filter(task => task.canRegister !== false);
          }
      })
      res?.data.forEach((item) => {
        item.isLeaf = !item.hasNext;
        item.value = `${workItemId}-${workItemEntityId}-${item.value}`;
        item?.children?.forEach((task) => {
          task.isLeaf = !task.hasNext;
          task.value = `${item.value}-${task.value}`;
        });
      });
      return res.data;
    }
  };

  /** 获取工作项实例节点的任务 */
  const fetchNodeTaskOptionData = async (
    workItemId,
    workItemEntityId,
    nodeId
  ) => {
    workItemEntityId = workItemEntityId.split("-")[1];
    nodeId = nodeId.split("-")[2];
    const data = {
      workItemId,
      workItemEntityId,
      nodeId,
    };
    const res = await getEntityTaskOptionNew(data);
    if (res?.result) {
      if (res?.data?.length > 0) {
        res.data = res.data.filter(item => item.canRegister !== false);
      }
      res?.data.forEach((item) => {
        item.isLeaf = !item.hasNext;
        item.value = `${workItemId}-${workItemEntityId}-${nodeId}-${item.value}`;
      });
      return res.data;
    }
  };

  const loadData = (selectedOptions) => {
    let isMoreBtn = false;
    selectedOptions.forEach((item) => {
      if (item.value.includes("more-btn")) isMoreBtn = true;
    });
    const arr = JSON.parse(JSON.stringify(selectedOptions));
    if (isMoreBtn) {
      onMoreClick();
      return;
    }
    switch (selectedOptions.length) {
      case 1:
        setHasMore(false);
        setWorkItemId(selectedOptions[selectedOptions.length - 1].value);
        fetchItemEntityOptionData(
          selectedOptions[selectedOptions.length - 1].value,
          1,
          20
        ).then((res) => {
          const newOptions = addChildNodeAndReturnNewTree(
            options,
            selectedOptions[selectedOptions.length - 1].value,
            res
          );
          setOptions([...newOptions]);
        });
        break;
      case 2:
        setWorkItemEntityId(
          selectedOptions[selectedOptions.length - 1].value.split("-")[1]
        );
        props?.getWorkItem([
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value.split("-")[1],
        ]);
        props?.getRegisteredName({
          workItemName: selectedOptions[selectedOptions.length - 2].label,
          workItemEntityName: selectedOptions[selectedOptions.length - 1].label,
        });
        fetchEntityNodeOptionData(
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value
        ).then((res) => {
          const newOptions = addChildNodeAndReturnNewTree(
            options,
            selectedOptions[selectedOptions.length - 1].value,
            res
          );
          setOptions([...newOptions]);
        });
        break;
      case 3:
        props.getWorkItem({
          workItemName: selectedOptions[selectedOptions.length - 3].label,
          workItemEntityName: selectedOptions[selectedOptions.length - 2].label,
          nodeName: selectedOptions[selectedOptions.length - 1].label,
        });
        props.getRegisteredName([
          selectedOptions[selectedOptions.length - 3].label,
          selectedOptions[selectedOptions.length - 2].label,
          selectedOptions[selectedOptions.length - 1].label,
        ]);
        setWorkItemId(selectedOptions[selectedOptions.length - 3].value);
        setWorkItemEntityId(
          selectedOptions[selectedOptions.length - 2].value.split("-")[1]
        );
        setNodeId(
          selectedOptions[selectedOptions.length - 1].value.split("-")[2]
        );
        setWorkItem([
          selectedOptions[selectedOptions.length - 3].value,
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value,
        ]);
        // fetchNodeTaskOptionData(
        //   selectedOptions[selectedOptions.length - 3].value,
        //   selectedOptions[selectedOptions.length - 2].value,
        //   selectedOptions[selectedOptions.length - 1].value
        // ).then((res) => {
        //   const newOptions = addChildNodeAndReturnNewTree(
        //     options,
        //     selectedOptions[selectedOptions.length - 1].value,
        //     res
        //   );
        //   setOptions([...newOptions]);
        // });
        break;
      case 4:
        props.getWorkItem([
          selectedOptions[selectedOptions.length - 4].value,
          selectedOptions[selectedOptions.length - 3].value,
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value,
        ]);
        props.getWorkItem({
          workItemName: selectedOptions[selectedOptions.length - 4].label,
          workItemEntityName: selectedOptions[selectedOptions.length - 3].label,
          nodeName: selectedOptions[selectedOptions.length - 2].label,
          taskName: selectedOptions[selectedOptions.length - 1].label,
        });
        setWorkItem([
          selectedOptions[selectedOptions.length - 4].value,
          selectedOptions[selectedOptions.length - 3].value,
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value,
        ]);
        setTaskId(
          selectedOptions[selectedOptions.length - 1].value.split("-")[3]
        );
        break;
      default:
        break;
    }
  };

  /** 动态增加子节点 */
  const addChildNodeAndReturnNewTree = (
    originalTree,
    parentKey,
    newNode,
    type
  ) => {
    // 首先深拷贝原始树结构
    const newTree = originalTree;
    // 遍历新树结构，查找指定父节点并添加子节点
    function addNode(tree, parentKey, newNode) {
      for (let i = 0; i < tree.length; i++) {
        if (tree[i].value === parentKey) {
          // 在找到的父节点的children数组中添加新节点
          if (type === "workItemEntity") {
            const children = tree[i].children.concat(newNode);
            tree[i].children = children;
          } else {
            newNode?.length
              ? (tree[i].children = newNode)
              : (tree[i].isLeaf = true);
          }
          return true; // 表示添加成功
        } else {
          // 如果当前节点有子节点，则递归查找
          if (tree[i].children && tree[i].children.length > 0) {
            const result = addNode(tree[i].children, parentKey, newNode);
            if (result) {
              return result; // 表示在子树中添加成功
            }
          }
        }
      }
      return false; // 表示未找到父节点，添加失败（但实际上在这个函数中不会执行到这里，因为原始树中一定存在该父节点）
    }

    // 调用递归函数添加节点（这里不会返回false，因为假设父节点一定存在）
    addNode(newTree, parentKey, newNode);

    // 返回新的树结构
    return newTree;
  };

  /** 工作项改变 */
  const onChange = (value, selectedOptions) => {
    if (value && JSON.stringify(value).includes("more-btn")) return;
    setCurWorkItem(value);
    if (!value) {
      setWorkItem([]);
      props.getWorkItem(value);
      props.getRegisteredName({});
     
      return;
    }
    if (value?.length > 1) {
      setWorkItemId(value[0]);
      setWorkItemEntityId(value[1]?.split("-")[2]);
      setNodeId(value[2]?.split("-")[2]);
      setTaskId(value[3]?.split("-")[3]);
      setWorkItem([...value]);
      props.getWorkItem([
        value[0],
        value[1]?.split("-")[1],
        value[2]?.split("-")[2],
        value[3]?.split("-")[3],
      ]);
      props.getRegisteredName({
        workItemName: selectedOptions[0]?.label,
        workItemEntityName: selectedOptions[1]?.label,
        customFieldValue: selectedOptions[1]?.customFieldValue ?? null,
        nodeName: selectedOptions[2]?.label,
        taskName: selectedOptions[3]?.label,
        canRegister:selectedOptions[selectedOptions.length - 1]?.canRegister,
        canRegisterLevel: selectedOptions[selectedOptions.length - 1]?.canRegisterLevel,
        canRegisterLevelName: selectedOptions[selectedOptions.length - 1]?.canRegisterLevelName
      });
    }
  };

  const onMoreClick = () => {
    //console.log('entityPagination9999',entityPagination)
    if (hasMore) {
      setNodeLoading(true);
      
      // 判断是否为同个工作项实例
      const isSameWorkItem = lastLoadedWorkItemId === workItemId;
      // 同工作项实例pageNum+1，不同工作项实例pageNum=2
      const targetPageNum = isSameWorkItem ? entityPagination.pageNum + 1 : 2;
      
      // 更新状态
      setEntityPagination({
        pageNum: targetPageNum,
        pageSize: 20,
      });
      setLastLoadedWorkItemId(workItemId);
      //console.log('targetPageNum',targetPageNum)
      // 传递计算好的pageNum给fetchItemEntityOptionData
      fetchItemEntityOptionData(workItemId, targetPageNum).then((res) => {
        if (res?.length) {
          options.forEach((item) => {
            if (item.value === workItemId) {
              item.children.pop();
            }
          });
          const newOptions = addChildNodeAndReturnNewTree(
            options,
            workItemId,
            res,
            "workItemEntity"
          );
          let timer = setTimeout(() => {
            clearTimeout(timer);
            setOptions([...newOptions]);
          }, 1000);
        }
        setNodeLoading(false);
      });
    }
  };

  return (
    <Cascader
      {...props}
      size="small"
      disabled={props.disabled}
      className="top-item"
      options={options}
      optionRender={(option) => {
        if (loading) {
          return (
            <Spin tip="数据加载中...">
              <div style={{ width: 180, height: 180 }}></div>
            </Spin>
          );
        }
        {
          option;
        }
        const label = getCascaderOptionLabel(option);
        return entityOptionValuesRef.current.has(option.value) ? (
          <CustomFieldCascaderOption
            label={label}
            customFieldValue={option.customFieldValue}
            isCustomFieldEnabled={isCustomFieldEnabled}
          />
        ) : label;
      }}
      loadData={loadData}
      onChange={onChange}
      placeholder="请选择登记对象"
      value={workItem}
      changeOnSelect
      onFocus={fetchWorkItemOptionData}
    />
  );
};
// 使用forwardRef包装组件，以支持暴露方法给父组件
const WorkNodeSelect = React.forwardRef((props, ref) => (
  <WorkNodeCascader {...props} forwardedRef={ref} />
));

export default WorkNodeSelect;

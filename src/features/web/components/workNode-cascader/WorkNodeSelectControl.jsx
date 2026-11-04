import React, { useEffect, useState } from "react";
import { Cascader } from "antd";
import {
  getWorkItemOptionNew,
  getItemEntityOptionNew,
  getEntityNodeOptionNew,
  getEntityTaskOptionNew,
} from "../../../../api/api";
import InfiniteScroll from "react-infinite-scroller";
import { WorkItem } from "@lark-project/js-sdk";
import CustomFieldCascaderOption, {
  getCascaderOptionLabel,
} from "../custom-field-cascader-option/CustomFieldCascaderOption";
import { useTenantCustomFieldConfig } from '../../hooks/useTenantCustomFieldConfig';

const WorkNodeCascaderControl = (props) => {
  const { isEnabled: isCustomFieldEnabled } = useTenantCustomFieldConfig();
  const entityOptionValuesRef = React.useRef(new Set());
  const { userKey = '', myselfFlag: originalMyselfFlag = false } = props || {};
  const myselfFlag = originalMyselfFlag == 1 ? true : false;
  const [options, setOptions] = useState([]);
  const [curFlowType, setCurFlowType] = useState("");
  const [workItemName, setWorkItemName] = useState("");
  const [curWorkItem, setCurWorkItem] = useState([]);
  const [workItem, setWorkItem] = useState([]);
  const [workItemId, setWorkItemId] = useState("");
  const [workItemEntityId, setWorkItemEntityId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [entityPagination, setEntityPagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [curLength, setCurLength] = useState(1);
  const [registeredName, setRegisteredName] = useState({});
  useEffect(()=>{
    //console.log('options20260105',options)
  },[options])
  useEffect(() => {
    setWorkItemId(props?.workItem?.workItemId);
    setWorkItemEntityId(props?.workItem?.workItemEntityId);
    setNodeId(props?.workItem?.nodeId);
    setTaskId(props?.workItem?.taskId);
    if (props?.workItem?.nodeId) setCurLength(2);
    const curWorkItem = [
      `${props?.workItem?.workItemId}-${props?.workItem?.workItemEntityId}`,
    ];
    if (props?.workItem?.nodeId)
      curWorkItem.push(
        `${props?.workItem?.workItemId}-${props?.workItem?.workItemEntityId}-${props?.workItem?.nodeId}`
      );
    setCurWorkItem(curWorkItem);
  }, []);
   useEffect(() => {
     setWorkItemId(props?.workItem?.workItemId);
    setWorkItemEntityId(props?.workItem?.workItemEntityId);
    setNodeId(props?.workItem?.nodeId);
    setTaskId(props?.workItem?.taskId);
    if (props?.workItem?.nodeId) setCurLength(2);
    const curWorkItem = [
      `${props?.workItem?.workItemId}-${props?.workItem?.workItemEntityId}`,
    ];
    if (props?.workItem?.nodeId)
      curWorkItem.push(
        `${props?.workItem?.workItemId}-${props?.workItem?.workItemEntityId}-${props?.workItem?.nodeId}`
      );
      //console.log('curWorkItem',curWorkItem)
      setCurWorkItem([curWorkItem]);
    //重新调用接口
    if (workItemId && workItemEntityId) {
      fetchItemEntityOptionData();
    }
  }, [props.userKey]);
  useEffect(() => {
    setRegisteredName(props.registeredName);
  }, [props.registeredName]);

  /** 获取工作项实例(分页) */
  const fetchItemEntityOptionData = async () => {
    const data = {
      workItemId,
      workItemEntityId,
      pageNum: entityPagination.pageNum,
        pageSize: entityPagination.pageSize,
        userKey,
        myselfFlag
      };
    const res = await getItemEntityOptionNew(data);
    if (res?.result) {
      res?.data?.data.forEach((item) => {
        item.isLeaf = !item.hasNext;
        item.value = `${workItemId}-${item.value}`;
        entityOptionValuesRef.current.add(item.value);
        if (
          workItemEntityId &&
          item.value !== `${workItemId}-${workItemEntityId}`
        )
          item.disabled = true;
      });
      //console.log('res?.data?.data2028',res?.data?.data)
      if (props?.flowMode === "workflow" && nodeId) {
        fetchEntityNodeOptionData().then((arr) => {
          if (arr?.length) {
            const newOptions = addChildNodeAndReturnNewTree(
              res?.data?.data,
              `${workItemId}-${workItemEntityId}`,
              arr
            );
            setOptions([...newOptions]);
          }
        });
      } else {
        setOptions([...res.data.data]);
      }
    }
  };

  useEffect(() => {
    if (workItemId && workItemEntityId) {
      fetchItemEntityOptionData();
    }
  }, [workItemId, workItemEntityId]);

  /** 获取工作项实例节点 */
  const fetchEntityNodeOptionData = async () => {
    const data = {
      workItemId,
      workItemEntityId,
      userKey,
      myselfFlag
    };
    const res = await getEntityNodeOptionNew(data);
    if (res?.result) {
      res?.data?.forEach((item) => {
          // 如果item.children有值，并且所有对象的canRegister字段都是false，将hasNext设置为false
          if (item?.children && item.children.length > 0) {
            const allCanRegisterFalse = item.children.every(child => child.canRegister === false);
            if (allCanRegisterFalse) {
              item.hasNext = false;
            }
          }
      })
      res?.data.forEach((item) => {
        item.isLeaf = !item.hasNext;
        item.value = `${workItemId}-${workItemEntityId}-${item.value}`;
        // 过滤掉canRegister为false的任务
        if (item?.children) {
          item.children = item.children.filter(task => task.canRegister !== false);
        }
        //item.children=[]
      });
      if (curLength === 2) {
        res?.data.forEach((item) => {
          if (
            nodeId &&
            item.value !== `${workItemId}-${workItemEntityId}-${nodeId}`
          )
            item.disabled = true;
        });
      }
      return res.data;
    }
  };

  /** 获取工作项实例节点的任务 */
  const fetchNodeTaskOptionData = async (nodeId) => {
    const data = {
      workItemId,
      workItemEntityId,
      nodeId,
      userKey,
      myselfFlag
    };
    const res = await getEntityTaskOptionNew(data);
    if (res?.result) {
      res?.data.forEach((item) => {
        item.isLeaf = !item.hasNext;
        item.value = `${workItemId}-${workItemEntityId}-${nodeId}-${item.value}`;
      });
      return res.data;
    }
  };

  const loadData = (selectedOptions) => {
    switch (selectedOptions.length) {
      case 1:
        if (curLength === 1)
          setCurWorkItem(
            props?.workItem?.nodeId
              ? [
                  selectedOptions[selectedOptions.length - 1].value,
                  props?.workItem?.nodeId,
                ]
              : [selectedOptions[selectedOptions.length - 1].value]
          );
        props.getWorkItem(
          props?.workItem?.nodeId
            ? [workItemId, workItemEntityId, props?.workItem?.nodeId]
            : [workItemId, workItemEntityId]
        );
        props?.getRegisteredName(
          props?.workItem?.nodeId
            ? {
                workItemName: props?.registeredName?.workItemName,
                workItemEntityName:
                  selectedOptions[selectedOptions.length - 1].label,
                nodeName: props?.registeredName?.nodeName,
                canRegister: selectedOptions[selectedOptions.length - 1]?.canRegister,
                canRegisterLevel: selectedOptions[selectedOptions.length - 1]?.canRegisterLevel,
                canRegisterLevelName: selectedOptions[selectedOptions.length - 1]?.canRegisterLevelName
              }
            : {
                workItemName: props?.registeredName?.workItemName,
                workItemEntityName:
                selectedOptions[selectedOptions.length - 1].label,
                canRegister: selectedOptions[selectedOptions.length - 1]?.canRegister,
                canRegisterLevel: selectedOptions[selectedOptions.length - 1]?.canRegisterLevel,
                canRegisterLevelName: selectedOptions[selectedOptions.length - 1]?.canRegisterLevelName
              }
        );
        fetchEntityNodeOptionData().then((res) => {
          if (res?.length) {
            const newOptions = addChildNodeAndReturnNewTree(
              options,
              selectedOptions[selectedOptions.length - 1].value,
              res
            );
            setOptions([...newOptions]);
          }
        });
        break;
      case 2:
        props.getWorkItem([
          workItemId,
          workItemEntityId,
          selectedOptions[selectedOptions.length - 1].value.split("-")[2],
        ]);
        props?.getRegisteredName({
          ...registeredName,
          nodeName: selectedOptions[selectedOptions.length - 1].label,
          taskName: "",
          canRegister: selectedOptions[selectedOptions.length - 1]?.canRegister,
          canRegisterLevel: selectedOptions[selectedOptions.length - 1]?.canRegisterLevel,
          canRegisterLevelName: selectedOptions[selectedOptions.length - 1]?.canRegisterLevelName,
        });
        setCurWorkItem([
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value,
        ]);
        setNodeId(
          selectedOptions[selectedOptions.length - 1].value.split("-")[2]
        );
        // fetchNodeTaskOptionData(
        //   selectedOptions[selectedOptions.length - 1].value.split("-")[2]
        // ).then((res) => {
        //   if (res?.length) {
        //     const newOptions = addChildNodeAndReturnNewTree(
        //       options,
        //       selectedOptions[selectedOptions.length - 1].value,
        //       res
        //     );
        //     setOptions([...newOptions]);
        //   }
        // });
        break;
      case 3:
        setCurWorkItem([
          selectedOptions[selectedOptions.length - 3].value,
          selectedOptions[selectedOptions.length - 2].value,
          selectedOptions[selectedOptions.length - 1].value,
        ]);
        props.getWorkItem([
          workItemId,
          workItemEntityId,
          selectedOptions[selectedOptions.length - 1].value.split("-")[2],
          selectedOptions[selectedOptions.length - 1].value.split("-")[3],
        ]);
        props?.getRegisteredName({
          ...registeredName,
          workItemEntityName: selectedOptions[selectedOptions.length - 3].label,
          nodeName: selectedOptions[selectedOptions.length - 2].label,
          taskName: selectedOptions[selectedOptions.length - 1].label,
        });
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
            tree[i].children = newNode;
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
    if (!value) {
      setWorkItem([]);
      setWorkItemName("");
      props.getWorkItem(value);
      props.getRegisteredName({});
      return;
    }
    if (value?.length > curLength) {
      setCurWorkItem(value);
      let task_id = undefined;
      if(value[2] === 'string'){
        if(value[2].includes("-")){
          task_id = value[2]?.split("-")[3]
        }else{
          task_id = value[2]
        }
      }else{
        task_id = value[2]?value[2]:undefined;
      }
      props.getWorkItem([
        workItemId,
        workItemEntityId,
        typeof value[1] === 'string' ? value[1]?.split("-")[2] : undefined,
        task_id
      ]);
      props.getRegisteredName({
        ...registeredName,
        workItemEntityName: selectedOptions[0]?.label,
        customFieldValue: selectedOptions[0]?.customFieldValue ?? null,
        nodeName: selectedOptions[1]?.label,
        taskName: selectedOptions[2]?.label,
        canRegister: selectedOptions[selectedOptions.length - 1]?.canRegister,
        canRegisterLevel: selectedOptions[selectedOptions.length - 1]?.canRegisterLevel,
        canRegisterLevelName: selectedOptions[selectedOptions.length - 1]?.canRegisterLevelName,
      });
    }
    setNodeId(typeof value[1] === 'string' ? value[1]?.split("-")[2] : undefined);
    setTaskId(typeof value[2] === 'string' ? value[2]?.split("-")[3] : undefined);
  };

  const handleScroll = () => {
    if (hasMore) {
      fetchItemEntityOptionData(workItemId).then((res) => {
        if (res?.length) {
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
      });
    }
  };

  const dropdownRender = (menus) => (
    <InfiniteScroll
      pageStart={0}
      loadMore={handleScroll}
      hasMore={hasMore}
      useWindow={false}
    >
      {menus}
    </InfiniteScroll>
  );

  return (
    <Cascader
      allowClear={false}
      size="small"
      disabled={props?.disabled || props?.flowMode === "stateflow"}
      className="top-item"
      options={options}
      optionRender={(option) => {
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
      value={curWorkItem}
    />
  );
};
export default WorkNodeCascaderControl;

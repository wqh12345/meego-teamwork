var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
          resolve(value);
        });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __rest =
  (this && this.__rest) ||
  function (s, e) {
    var t = {};
    for (var p in s)
      if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
      for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
        if (
          e.indexOf(p[i]) < 0 &&
          Object.prototype.propertyIsEnumerable.call(s, p[i])
        )
          t[p[i]] = s[p[i]];
      }
    return t;
  };
import React, { useState, useEffect, useMemo, useRef } from "react";
import { UserOutlined, SearchOutlined, TeamOutlined } from "@ant-design/icons";
import {
  Avatar,
  Spin,
  Select,
  Tooltip,
  Input,
  Divider,
  Space,
  Empty,
} from "antd";
import {
  postSearchMember,
  getProjectAllStaffUser,
  getSelectProjectUserList,
  getProjectConfig,
  getWorkItemOptionNew
} from "../../../../api/api";
import debounce from "lodash/debounce";
import "./workItemPicker.less";

const TeamPicker = (props) => {
  const [userId, setUserId] = useState([]);
  const [user, setUser] = useState([]);

  /** 工时记录人员筛选 */
  // 修改 TeamPicker 组件中的 onUserSelectChange 函数（约第45-60行）
  const onUserSelectChange = (value) => {
    setUser(value);
    // 确保返回包含 {label, value} 的对象数组
    if (props.mode === "multiple") {
      const userId = [];
      const selectedItems = [];
      for (const item of value) {
        userId.push(item.value);
        // 构建对象数组
        selectedItems.push({ label: item.label, value: item.value });
      }
      setUserId(userId);
      props?.getUserIds(selectedItems); // 传递对象数组
      return;
    }

    // 单选模式，构建单元素对象数组
    const selectedItem = [{ label: value.label, value: value.value }];
    setUserId(value.value);
    props?.getUserIds(selectedItem); // 传递对象数组
  };
  return (
    <DebounceSelect
      mode={props.mode}
      placeholder={props.placeholder}
      defaultValue={props?.registrantUserKey}
      value={props?.value ? props?.value : props?.registrantUserKey}
      onChange={onUserSelectChange}
      style={{
        minWidth: "400px",
      }}
      {...props}
    />
  );
};
export default TeamPicker;

function DebounceSelect(_a) {
  var { fetchOptions, debounceTimeout = 800 } = _a
  try {
    var props = __rest(_a, ["fetchOptions", "debounceTimeout"]);
  } catch (error) {

  }
  //props = __rest(_a, ["fetchOptions", "debounceTimeout"]);
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState([]);
  const { ...other } = props;
  const [name, setName] = useState("");
  const [pagination, setPagination] = useState({
    pageNum: 1,
    pageSize: 10,
  });
  const [hasNext, setHasNext] = useState(false);
  const fetchRef = useRef(0);
  const [val, setVal] = useState([]);
  const [isAllowRegister, setIsAllowRegister] = useState(false);

  const debounceFetcher = useMemo(() => {
    const loadOptions = (value) => {
      fetchRef.current += 1;
      const fetchId = fetchRef.current;
      setOptions([]);
      setFetching(true);
      if (value) {
        searchMember(value).then((newOptions) => {
          if (fetchId !== fetchRef.current) {
            // for fetch callback order
            return;
          }
          // 过滤空对象
          const filteredOptions = newOptions && newOptions.length > 0 ? 
            newOptions.filter(item => item && Object.keys(item).length > 0) : [];
          setOptions(filteredOptions);
          setFetching(false);
        });
      } else {
        getMembers().then((newOptions) => {
          if (fetchId !== fetchRef.current) {
            // for fetch callback order
            return;
          }
          // 过滤空对象
          const filteredOptions = newOptions && newOptions.length > 0 ? 
            newOptions.filter(item => item && Object.keys(item).length > 0) : [];
          if (typeof val === "object" && val.includes("0")) {
            filteredOptions.forEach((item) => {
              if (item.value !== "0") {
                item.disabled = true;
              }
            });
          }
          setOptions(filteredOptions);
          setFetching(false);
        });
      }
    };
    return debounce(loadOptions, debounceTimeout);
  }, [fetchOptions, debounceTimeout]);
  const searchMember = async (value) => {
    const res = await getWorkItemOptionNew();
    if (res?.result) {
    // 处理选中的工作项列表，确保数据结构一致
      if (props.selectedWorkItemsArr && Array.isArray(props.selectedWorkItemsArr)) {
        // 创建一个Set存储已存在的value值，用于快速查找
        const existingValues = new Set(res.data.map(item => item.value));
        
        props.selectedWorkItemsArr.forEach(selectWorkItems => {
          // 获取当前工作项的value
          const workItemValue = selectWorkItems.canRegistWorkItemId || selectWorkItems.value;
          
          // 如果该value不存在于现有数据中
          if (workItemValue && !existingValues.has(workItemValue)) {
            // 判断工作项名称是否已包含"[已删除]"标记
            const workItemName = selectWorkItems.canRegistWorkItemName || selectWorkItems.label || '';
            const hasDeletedMark = workItemName.includes("[已删除]");
            
            // 如果没有标记才拼接，避免重复拼接
            const workItemNameWithMark = selectWorkItems?.tag==0? hasDeletedMark?workItemName:`${workItemName}[已删除]`:workItemName;
            
            // 添加到res.data中，使用统一的value和label格式
            const newItem = {
              value: workItemValue,
              label: workItemNameWithMark
            };
            res.data.push(newItem);
            existingValues.add(workItemValue); // 更新已存在的value集合
          }
        });
      }
      let filteredData = res.data;

      // 根据输入的关键字过滤数据
      if (value && value.trim()) {
        const keyword = value.trim().toLowerCase();
        filteredData = res.data.filter(item =>
          item.label && item.label.toLowerCase().includes(keyword)
        );
      }

      // 只有当搜索结果满足条件时才显示"全部工作项"
      // if (filteredData.length > 0) {
      //   filteredData.unshift({
      //     value: "0",
      //     label: "全部工作项",
      //   });
      // }
      if (JSON.stringify(val).includes("0")) {
        filteredData.forEach((item) => {
          if (item.value !== "0") {
            item.disabled = false;
          }
        });
      }
      return filteredData;
    }
  };

  const getMembers = async () => {
    const res = await getWorkItemOptionNew();
    if (res?.result) {
      // 确保"全部工作项"始终在列表第一位
       if (res?.data?.length > 0) {
        res.data.unshift({
          value: "0",
          label: "全部工作项",
        });
        try{
          // 处理选中的工作项列表，确保数据结构一致
          if (props.selectedWorkItemsArr && Array.isArray(props.selectedWorkItemsArr)) {
            // 创建一个Set存储已存在的value值，用于快速查找
            const existingValues = new Set(res.data.map(item => item.value));
            
            props.selectedWorkItemsArr.forEach(selectWorkItems => {
              // 获取当前工作项的value
              const workItemValue = selectWorkItems.canRegistWorkItemId || selectWorkItems.value;
              
              // 如果该value不存在于现有数据中
              if (workItemValue && !existingValues.has(workItemValue)) {
                // 判断工作项名称是否已包含"[已删除]"标记
                const workItemName = selectWorkItems.canRegistWorkItemName || selectWorkItems.label || '';
                const hasDeletedMark = workItemName.includes("[已删除]");
                
                // 如果没有标记才拼接，避免重复拼接
                const workItemNameWithMark = selectWorkItems?.tag==0? hasDeletedMark?workItemName:`${workItemName}[已删除]`:workItemName;
                
                // 添加到res.data中，使用统一的value和label格式
                const newItem = {
                  value: workItemValue,
                  label: workItemNameWithMark
                };
                res.data.push(newItem);
                existingValues.add(workItemValue); // 更新已存在的value集合
              }
            });
          }
        }catch(err){
          console.log(err);
        }
      }
      if (val && JSON.stringify(val).includes("0")) {
        res.data.forEach((item) => {
          if (item.value !== "0") {
            item.disabled = false;
          }
        });
      }
      if (
        typeof val === "object" &&
        val.length &&
        props?.type !== "approval" &&
        props?.type !== "approvalSet"
      ) {
        val.forEach((value) => {
          // 跳过"全部工作项"的排序
          if (value === "0") return;

          let curIndex = 1;
          let curItem = {};
          res.data.forEach((item, index) => {
            if (item.value === value) {
              curIndex = index;
              curItem = item;
            }
          });
          res.data.splice(curIndex, 1);
          isAllowRegister &&
            sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin"
            ? res.data.splice(2, 0, curItem)
            : res.data.splice(1, 0, curItem);
        });
      }
      return res.data;
    }
  };

  useEffect(() => {
    if (props.value) {
      const fetchId = fetchRef.current;
      // getMembers().then((newOptions) => {
      //   if (fetchId !== fetchRef.current) {
      //     // for fetch callback order
      //     return;
      //   }
      //   if (typeof val === "object" && val.includes("0")) {
      //     newOptions.forEach((item) => {
      //       if (item.value !== "0") {
      //         item.disabled = true;
      //       }
      //     });
      //   }
      //   // 过滤空对象
      //   const filteredOptions = newOptions && newOptions.length > 0 ? 
      //     newOptions.filter(item => item && Object.keys(item).length > 0) : [];
      //   setOptions(filteredOptions);
      //   setFetching(false);
      // });
      // 过滤当前 options 中的空对象
      const filteredOptions = options && options.length > 0 ? 
        options.filter(item => item && Object.keys(item).length > 0) : [];
      setOptions(filteredOptions);
      setFetching(false);
      setVal(props.value);
    } else {
      // 当props.value为空时，默认选中"全部工作项"
      setVal(["0"]);
      const fetchId = fetchRef.current;
      getMembers().then((newOptions) => {
        if (fetchId !== fetchRef.current) {
          // for fetch callback order
          return;
        }
        // 选中"全部工作项"时禁用其他选项
        newOptions.forEach((item) => {
          if (item.value !== "0") {
            item.disabled = true;
          }
        });
        setOptions(newOptions);
        setFetching(false);
      });
    }
  }, [props.value]);

  const onfocus = () => {
    setName("");
    const fetchId = fetchRef.current;
    getMembers().then((newOptions) => {
      if (fetchId !== fetchRef.current) {
        // for fetch callback order
        return;
      }
      if (typeof val === "object" && val.includes("0")) {
        newOptions.forEach((item) => {
          if (item.value !== "0") {
            item.disabled = true;
          }
        });
      }
      setOptions(newOptions);
      setFetching(false);
    });
  };

  const onUserSelectChange = (value) => {
    if (typeof value === "object" && value.includes("0")) {
      value = ["0"];
      options.forEach((item) => {
        if (item.value !== "0") {
          item.disabled = true;
        }
      });
      setOptions([...options]);
    } else {
      if (
        typeof value === "object" &&
        value.length &&
        props?.type !== "approval" &&
        props?.type !== "approvalSet"
      ) {
        const lastValue = value[value.length - 1];

        // 跳过"全部工作项"的排序
        if (lastValue !== "0") {
          let curIndex = 1;
          let curItem = {};
          options.forEach((item, index) => {
            if (item.value !== "0") {
              item.disabled = false;
            }
            if (item.value === lastValue) {
              curIndex = index;
              curItem = item;
            }
          });
          options.splice(curIndex, 1);
          isAllowRegister &&
            sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin"
            ? options.splice(2, 0, curItem)
            : options.splice(1, 0, curItem);
        }
      } else {
        options.forEach((item) => {
          if (item.value !== "0") {
            item.disabled = false;
          }
        });
      }
      setOptions([...options]);
    }
    setVal(value);
    // 确保返回包含 {label, value} 的对象数组
    if (props?.getUserIds) {
      if (Array.isArray(value)) {
        // 多选模式，根据 options 数组构建对象数组
        const selectedItems = value.map(val => {
          const option = options.find(opt => opt.value === val);
          return option ? { label: option.label, value: option.value } : { label: val, value: val };
        });
        props.getUserIds(selectedItems);
      } else {
        // 单选模式，构建单元素对象数组
        const option = options.find(opt => opt.value === value);
        props.getUserIds([option ? { label: option.label, value: option.value } : { label: value, value: value }]);
      }
    }

  };

  const onNameChange = (event) => {
    setName(event.target.value);
  };

  useEffect(() => {
    setOptions([]);
    setFetching(true);
    debounceFetcher(name);
  }, [name]);

  return (
    <Select
      onFocus={onfocus}
      filterOption={false}
      maxTagCount={3}
      maxTagPlaceholder={(omittedValues) => (
        <Tooltip
          styles={{
            root: {
              pointerEvents: "none",
            },
          }}
          title={
            <div
              style={{
                maxWidth: "300px",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              {omittedValues.map(({ label }) => label)}
            </div>
          }
        >
          <span>+{omittedValues?.length}</span>
        </Tooltip>
      )}
      allowClear={
        props?.loginUser
          ? props?.value === props?.loginUser?.id
            ? false
            : true
          : typeof val === "object" && val?.length === 1
            ? false
            : true
      }
      notFoundContent={
        fetching ? (
          <Spin tip="数据加载中...">
            <div size="small" style={{ width: "100%", height: "100px" }}></div>
          </Spin>
        ) : (
          <div className="empty-data">
            <Empty
              image={require("../../../../image/no-data-table.png")}
              styles={{
                image: {
                  height: 40,
                  width: 40,
                  margin: "auto",
                  marginBottom: 10,
                },
              }}
              description={
                <span style={{ color: "#727272", fontSize: "12px" }}>
                  暂无可选工作项
                </span>
              }
            />
          </div>
        )
      }
      {...other}
      value={val}
      onChange={onUserSelectChange}
      dropdownRender={(menu) => (
        <>
          <Input
            disabled={val ? (Array.isArray(val) ? val.includes("0") : val === "0") : false}
            prefix={<SearchOutlined style={{ color: "#BBBBBB" }} />}
            placeholder="搜索"
            value={name}
            onChange={onNameChange}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <Divider
            style={{
              margin: "8px 0",
            }}
          />
          {menu}
        </>
      )}
      options={options && options.length > 0 ? 
        options
          .filter(item => item && Object.keys(item).length > 0) // 过滤掉空对象
          .map((item) => ({
            label:(
              <Tooltip title={item?.label || ''}>
                <div className="selected-item">
                  <span className="selected-item-name deleted-team workItem-ellipsisText">{item?.label}</span>
                </div>
              </Tooltip>
            ),
            // label: (
            //   <div className="selected-item">
            //     <span className="selected-item-name">{item?.label}</span>
            //   </div>
            // ),
            value:
              props?.type === "approval" || props?.type === "approvalSet"
                ? item.staffId
                : item.value,
            disabled: item?.disabled,
          }))
        : []}
      showSearch={false}
    />
  );
}

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
} from "../../../../api/api";
import debounce from "lodash/debounce";
import "./UserPicker.less";

const UserPicker = (props) => {
  const [userId, setUserId] = useState([]);
  const [user, setUser] = useState([]);

  /** 工时记录人员筛选 */
  const onUserSelectChange = (value) => {
    setUser(value);
    if (props.mode === "multiple") {
      const userId = [];
      for (const item of value) {
        userId.push(item.value);
      }
      setUserId(userId);
      props?.getUserIds(userId);
      return;
    }
    setUserId(value);
    props?.getUserIds(value);
  };

  return (
    <DebounceSelect
      mode={props.mode}
      placeholder={props.placeholder}
      defaultValue={props?.registrantUserKey}
      value={props?.value ? props?.value : props?.registrantUserKey}
      onChange={onUserSelectChange}
      style={{
        minWidth: "200px",
      }}
      {...props}
    />
  );
};
export default UserPicker;

function DebounceSelect(_a) {
  var { fetchOptions, debounceTimeout = 800 } = _a,
    props = __rest(_a, ["fetchOptions", "debounceTimeout"]);
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
          setOptions(newOptions);
          setFetching(false);
        });
      } else {
        getMembers().then((newOptions) => {
          if (fetchId !== fetchRef.current) {
            // for fetch callback order
            return;
          }
          if (typeof val === "object" && val.includes("-111")) {
            newOptions.forEach((item) => {
              if (item.staffUserKey !== "-111") {
                item.disabled = true;
              }
            });
          }
          setOptions(newOptions);
          setFetching(false);
        });
      }
    };
    return debounce(loadOptions, debounceTimeout);
  }, [fetchOptions, debounceTimeout]);

  /** 查询是否开启代填工时功能 */
  const getConfig = async () => {
    const data = {
      type: "ALLOW_ADMINISTRATORS_TO_REGISTER_OTHERS_WORKING_HOURS",
    };
    const res = await getProjectConfig(data);
    if (res?.result) {
      setIsAllowRegister(res.data?.value ? true : false);
    }
  };

  useEffect(() => {
    if (props?.type !== "approval") getConfig();
  }, []);

  const searchMember = async (value) => {
    const res = await postSearchMember({
      query: value.trim(),
    });
    if (res?.result) {
      if (!value && isAllowRegister && props?.type === "Gantt")
        res.data.unshift({
          staffUserKey: "-111",
          staffName: "全部代填成员",
        });
      if (props?.type === "approvalSet")
        res.data.unshift({
          staffUserKey: "-222",
          staffName: "团队管理员",
        });
      if (JSON.stringify(val).includes("-111")) {
        res.data.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = false;
          }
        });
      }
      return res.data;
    }
  };

  const getMembers = async () => {
    const res = await getProjectAllStaffUser();
    if (res?.result) {
      if (
        isAllowRegister &&
        sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin" &&
        props?.type === "Gantt"
      )
        res.data.unshift({
          staffUserKey: "-111",
          staffName: "全部代填成员",
        });
      if (props?.type === "approvalSet")
        res.data.unshift({
          staffUserKey: "-222",
          staffName: "团队管理员",
        });
      if (val && JSON.stringify(val).includes("-111")) {
        res.data.forEach((item) => {
          if (item.staffUserKey !== "-111") {
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
          let curIndex = 1;
          let curItem = {};
          res.data.forEach((item, index) => {
            if (item.staffUserKey === value) {
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
      getMembers().then((newOptions) => {
        if (fetchId !== fetchRef.current) {
          // for fetch callback order
          return;
        }
        if (typeof val === "object" && val.includes("-111")) {
          newOptions.forEach((item) => {
            if (item.staffUserKey !== "-111") {
              item.disabled = true;
            }
          });
        }
        setOptions(newOptions);
        setFetching(false);
      });
      setVal(props.value);
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
      if (typeof val === "object" && val.includes("-111")) {
        newOptions.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = true;
          }
        });
      }
      setOptions(newOptions);
      setFetching(false);
    });
  };

  const onUserSelectChange = (value) => {
    if (typeof value === "object" && value.includes("-111")) {
      value = ["-111"];
      options.forEach((item) => {
        if (item.staffUserKey !== "-111") {
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
        let curIndex = 1;
        let curItem = {};
        options.forEach((item, index) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = false;
          }
          if (item.staffUserKey === value[value.length - 1]) {
            curIndex = index;
            curItem = item;
          }
        });
        options.splice(curIndex, 1);
        isAllowRegister &&
        sessionStorage.getItem("jwtMeegoTeamworkUserRole") === "Admin"
          ? options.splice(2, 0, curItem)
          : options.splice(1, 0, curItem);
      } else {
        options.forEach((item) => {
          if (item.staffUserKey !== "-111") {
            item.disabled = false;
          }
        });
      }
      setOptions([...options]);
    }
    setVal(value);
    props?.getUserIds(value);
    if (props?.getPickerUser) {
      const users = JSON.parse(JSON.stringify(options));
      users.filter((item) => {
        if (item.staffUserKey === value) {
          props?.getPickerUser(item);
        }
      });
    }
    if (!value) {
      setVal(props?.loginUser?.id);
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
      maxTagCount={1}
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
                  暂无数据
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
            disabled={val ? JSON.stringify(val).includes("-111") : false}
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
      options={options?.map((item) => ({
        label: (
          <div className="selected-item">
            <Avatar
              className="selected-item-icon"
              size={17}
              src={item?.staffAvatarUrl}
              icon={
                item.staffUserKey === "-222" ? (
                  <TeamOutlined style={{ fontSize: "14px" }} />
                ) : (
                  <UserOutlined />
                )
              }
            />
            <span className="selected-item-name">{item?.staffName}</span>
          </div>
        ),
        value: item.staffUserKey,
        disabled: item?.disabled,
      }))}
      showSearch={false}
    />
  );
}

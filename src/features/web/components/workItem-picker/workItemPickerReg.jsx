import React, { useState, useEffect, useMemo, useRef } from "react";
import { UserOutlined, SearchOutlined } from "@ant-design/icons";
import { Avatar, Spin, Select, Tooltip, Input, Divider, Space } from "antd";
import {
  postSearchMember,
  getProjectAllStaffUser,
  getSelectProjectUserList,
} from "../../../../api/api";
import debounce from "lodash/debounce";
import "./UserPicker.less";
import { del } from "../../../../config";

const TeamPickerReg = (props) => {
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
      props?.getuserids(userId);
      return;
    }
    setUserId(value);
    props?.getuserids(value);
  };

  return (
    <DebounceSelect
      mode={props.mode}
      placeholder={props.placeholder}
      defaultValue={props?.registrantUserKey}
      value={props?.value ? props?.value : props?.registrantUserKey}
      fetchOptions={fetchUserList}
      onChange={onUserSelectChange}
      style={{
        minWidth: "200px",
      }}
      {...props}
    />
  );
};
export default TeamPickerReg;

function DebounceSelect({ fetchOptions, debounceTimeout = 800, ...props }) {
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

  const searchMember = async (value) => {
    const res = await postSearchMember({
      query: value,
    });
    if (res?.result) {
      return res.data;
    }
  };

  useEffect(() => {
    if (props.value) {
      const fetchId = fetchRef.current;
      fetchOptions(1, pagination.pageSize, "", val).then((newOptions) => {
        if (fetchId !== fetchRef.current) {
          return;
        }
        setPagination({
          pageSize: 10,
          pageNum: 1,
        });
        setHasNext(newOptions.hasNext);
        setOptions(newOptions.data);
        setFetching(false);
      });
      setVal(props.value);
    }
  }, [props.value]);

  const onfocus = () => {
    setName("");
    const fetchId = fetchRef.current;
    fetchOptions(1, pagination.pageSize, "", val).then((newOptions) => {
      if (fetchId !== fetchRef.current) {
        // for fetch callback order
        return;
      }
      setPagination({
        pageSize: 10,
        pageNum: 1,
      });
      setHasNext(newOptions.hasNext);
      setOptions(newOptions.data);
      setFetching(false);
    });
  };

  /**
   * 下拉框滚动
   * @param e dom元素
   */
  const handleScroll = (e) => {
    const { target } = e;
    if (target.scrollTop + target.clientHeight + 1 >= target.scrollHeight) {
      if (!hasNext) return;
      const fetchId = fetchRef.current;
      fetchOptions(pagination.pageNum + 1, pagination.pageSize, "", val).then(
        (newOptions) => {
          if (fetchId !== fetchRef.current) {
            // for fetch callback order
            return;
          }
          setPagination({
            pageSize: 10,
            pageNum: pagination.pageNum + 1,
          });
          setHasNext(newOptions.hasNext);
          setOptions([...options, ...newOptions.data]);
          setFetching(false);
        }
      );
    }
  };

  const onUserSelectChange = (value) => {

    if (typeof value === "object" && value.includes("-111")) {
      value = ["-111"];
      options.forEach((item) => {
        if (item.userKey !== "-111") {
          item.disabled = true;
        }
      });
      setOptions([...options]);
    } else {
      options.forEach((item) => {
        if (item.userKey !== "-111") {
          item.disabled = false;
        }
      });
      setOptions([...options]);
    }
    setVal(value);
    props?.getuserids(value);
    if (props?.getPickerUser) {
      const users = JSON.parse(JSON.stringify(options));
      users.filter((item) => {
        if (item.userKey === value) {
          props?.getPickerUser(item);
        }
      });
    }
    if (!value) setVal(props?.loginUser?.id);
  };

  const onNameChange = (event) => {
    setName(event.target.value);
  };

  useEffect(() => {
    fetchOptions(1, pagination.pageSize, name, val).then((newOptions) => {
      setPagination({
        pageSize: 10,
        pageNum: 1,
      });
      setHasNext(newOptions.hasNext);
      setOptions(newOptions.data);
      setFetching(false);
    });
  }, [name]);

  return (
    <Select
      onFocus={onfocus}
      onPopupScroll={handleScroll}
      filterOption={false}
      maxTagCount={1}
      maxTagPlaceholder={(omittedValues) => (
        <Tooltip
          styles={{
            root: {
              pointerEvents: "none",
            },
          }}
          title={omittedValues.map(({ label }) => label)}
        >
          <span>+{omittedValues?.length}</span>
        </Tooltip>
      )}
      allowClear={
        props?.loginUser
          ? props?.value === props?.loginUser?.id
            ? false
            : true
          : typeof val === "object" && val.includes("-111")
          ? false
          : true
      }
      notFoundContent={fetching ? <Spin size="small" /> : <div>暂无数据</div>}
      {...other}
      value={val}
      onChange={onUserSelectChange}
      dropdownRender={(menu) => (
        <>
          <Input
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
      options={options.map((item) => ({
        label: (
          <div className="selected-item">
            <Avatar
              className="selected-item-icon"
              size={20}
              src={item?.avatarUrl}
              icon={<img alt="" src={UserOutlined} />}
            />
            <span className="selected-item-name">{item?.nameCn}</span>
          </div>
        ),
        value: item.userKey,
      }))}
    >
      {/* {props?.type === "Gantt" ? (
        <Select.Option key={-111}>
          <div className="selected-item">
            <Avatar
              className="selected-item-icon"
              size={20}
              icon={<UserOutlined />}
            />
            <span className="selected-item-name">全部代填成员</span>
          </div>
        </Select.Option>
      ) : null}
      {options?.map((item, index) => (
        <Select.Option
          disabled={item?.disabled}
          key={index}
          value={item?.userKey}
          {...item.option}
        >
          <div className="selected-item">
            <Avatar
              className="selected-item-icon"
              size={20}
              src={item?.avatarUrl}
              icon={<img alt="" src={UserOutlined} />}
            />
            <span className="selected-item-name">{item?.nameCn}</span>
          </div>
        </Select.Option>
      ))} */}
    </Select>
  );
}

// Usage of DebounceSelect

async function fetchUserList(pageNum, pageSize, username, selectedVals) {
  const data = {
    userName: username.replace(/\s+/g, ""),
    pageNum,
    pageSize,
  };
  const res = await getSelectProjectUserList(data);
  if (res?.result) {
    if (typeof selectedVals === "object" && selectedVals.includes("-111")) {
      res.data.data.forEach((item) => {
        if (item.userKey !== "-111") {
          item.disabled = true;
        }
      });
    }
    return {
      hasNext: res.data.hasNext,
      data: res.data.data,
    };
  }
}

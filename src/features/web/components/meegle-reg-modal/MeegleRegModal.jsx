// src/FeatureModalInner.tsx
import React, { useEffect, useState } from "react";
import RegWorkHour from "../reg-workHour/RegWorkHour";
import RegWorkHourBatchNew from "../reg-workHour-batch-new/RegWorkHourBatchNew";
import FilterMemorySetting from "./FilterMemorySetting";
import "./MeegleRegModal.less";

export default () => {
  const [props, setProps] = useState({});
  const [filterMemoryEnabled, setFilterMemoryEnabled] = useState(false);
  const [filterMemoryConfig, setFilterMemoryConfig] = useState(null);

  useEffect(() => {
    window.JSSDK.Context.load().then((context) => {
      context.getCustomContext().then((customContext) => {
        try {
          // console.log("customContext", customContext);
          setProps(customContext);
        } catch {}
      });
    });
  }, []);

  const onRegistrationOk = (rel) => {
    // 通过 submit<Params>(params: Params): Promise<void> 对传入的 onSubmit 进行调用    
    props?.getRegStatus && props.getRegStatus(rel);
    window.JSSDK.containerModal.submit({ confirm: rel });
  };

  return (
    <div className="ant-modal" style={{ margin: "20px 24px", marginBottom: 0 }}>
      <div className="meegle-reg-modal-title">
        <span>{props?.title}</span>
        {props?.registrationType === "batch" && (
          <FilterMemorySetting
            configType="BATCH_REGISTER_FILTER_MEMORY"
            memoryConfig={filterMemoryConfig}
            memoryEnabled={filterMemoryEnabled}
            onConfigLoaded={setFilterMemoryConfig}
            onSaved={setFilterMemoryEnabled}
            registrantUserKey={props?.loginUser?.id}
          />
        )}
      </div>
      <RegWorkHour
        {...props}
        filterMemoryEnabled={filterMemoryEnabled}
        onFilterMemoryConfigLoaded={setFilterMemoryConfig}
        onFilterMemoryLoaded={setFilterMemoryEnabled}
        type={props?.type ? props?.type : "web"}
        loginUser={props?.loginUser}
        getRegistrationValue={onRegistrationOk}
        setRegistrationValue={props?.setRegistrationValue}
        registrationType={props?.registrationType}
      />
    </div>
  );
};

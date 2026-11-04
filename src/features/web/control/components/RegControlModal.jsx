// src/FeatureModalInner.tsx
import React, { useEffect, useState } from "react";
import RegWorkHour from "../../components/reg-workHour/RegWorkHour";
export default () => {
  const [props, setProps] = useState({});

  useEffect(() => {
    window.JSSDK.Context.load().then((context) => {
      context.getCustomContext().then((customContext) => {
        try {
          setProps(customContext);
        } catch {}
      });
    });
  }, []);

  const onRegistrationOk = (rel) => {
    // 通过 submit<Params>(params: Params): Promise<void> 对传入的 onSubmit 进行调用
    props?.getRegistrationValue && props?.getRegistrationValue(rel);
    window.JSSDK.containerModal.submit({ confirm: rel });
  };

  return props?.loginUser ? (
    <div className="ant-modal" style={{ margin: "20px 24px", marginBottom: 0 }}>
      <div
        style={{
          margin: 0,
          color: "#222222",
          fontWeight: 600,
          fontSize: "16px",
          lineHeight: 1.5,
          wordWrap: "break-word",
          marginBottom: "8px",
        }}
      >
        登记工时
      </div>
      <RegWorkHour
        point="control"
        flowMode={props?.flowMode}
        workItem={props?.workItem}
        loginUser={props?.loginUser}
        registeredName={props?.registeredName}
        type="web"
        getRegistrationValue={onRegistrationOk}
        setRegistrationValue={false}
      />
    </div>
  ) : null;
};

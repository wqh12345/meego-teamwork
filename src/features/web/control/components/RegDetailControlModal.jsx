// src/FeatureModalInner.tsx
import React, { useEffect, useState } from "react";
import TaskDetail from "../../components/task-detail/TaskDetail";
export default () => {
  const [props, setProps] = useState({});

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
    window.JSSDK.containerModal.submit({ confirm: rel });
  };

  return props?.loginUser ? (
    <div className="ant-modal" style={{ margin: "8px 8px 4px 8px" }}>
      <TaskDetail point="control" {...props} type="web" />
    </div>
  ) : null;
};

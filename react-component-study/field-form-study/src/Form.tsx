import React from 'react';
import useForm from './useForm';
import FormContext, { FormContextProps } from './FormContext';
import FieldContext, { HOOK_MARK } from './FieldContext';
import { isSimilar } from './utils/valueUtil';

import {
  Store,
  FormInstance,
  FieldData,
  ValidateMessages,
  Callbacks,
  InternalFormInstance,
  InternalHooks,
} from './types';

/**
1、传递 FieldContext；
2、拦截处理 submit 事件；
3、渲染子节点。
 */

type BaseFormProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'>;
type RenderProps = (values: Store, form: FormInstance) => JSX.Element | React.ReactNode;

export interface FormProps<Values = any> extends BaseFormProps {
  // 初始值
  initialValues: Store;
  // form 实例
  form?: FormInstance<Values>;
  children?: RenderProps | React.ReactNode;
  // 设置 Form 渲染元素，为 false 则不创建 DOM 节点
  component?: false | string | React.FC<any> | React.ComponentClass<any>;
  // 通过状态管理（如 redux）控制表单字段，如非强需求不推荐使用
  fields?: FieldData[];
  // 表单名称，会作为表单字段 id 前缀使用
  name?: string;
  validateMessages?: ValidateMessages;
  onValuesChange?: Callbacks<Values>['onValuesChange'];
  onFieldsChange?: Callbacks<Values>['onFieldsChange'];
  onFinish?: Callbacks<Values>['onFinish'];
  onFinishFailed?: Callbacks<Values>['onFinishFailed'];
  // 统一设置字段校验规则
  validateTrigger?: string | string[] | false;
  // 当字段被删除时保留字段值
  preserve?: boolean;
}

const Form: React.ForwardRefRenderFunction<FormInstance, FormProps> = (
  {
    name = '',
    initialValues,
    fields,
    form,
    preserve,
    children,
    component: Component = 'form',
    validateMessages,
    validateTrigger = 'onChange',
    onValuesChange,
    onFieldsChange,
    onFinish,
    onFinishFailed,
    ...restProps
  }: FormProps,
  ref,
) => {
  const formContext: FormContextProps = React.useContext(FormContext);
  const [formInstance] = useForm(form);
  // Set initial value, init store value when first mount
  const mountRef = React.useRef(false);
  // Listen if fields provided. We use ref to save prev data here to avoid additional render
  const prevFieldsRef = React.useRef<FieldData[] | undefined>();

  const {
    useSubscribe,
    setInitialValues,
    setCallbacks,
    setValidateMessages,
    setPreserve,
  } = (formInstance as InternalFormInstance).getInternalHooks(HOOK_MARK) as InternalHooks;

  // Pass ref with form instance, 返回实例方法
  React.useImperativeHandle(ref, () => formInstance);

  // Register form into Context
  React.useEffect(() => {
    formContext.registerForm(name, formInstance);
    return () => {
      formContext.unregisterForm(name);
    };
  }, [formContext, formInstance, name]);

  React.useEffect(() => {
    if (!isSimilar(prevFieldsRef.current || [], fields || [])) {
      formInstance.setFields(fields || []);
    }
    prevFieldsRef.current = fields;
  }, [fields, formInstance]);

  // 设置初始值
  setInitialValues(initialValues, !mountRef.current);
  if (!mountRef.current) {
    mountRef.current = true;
  }

  // 设置返回api
  setCallbacks({
    onValuesChange,
    onFieldsChange: (changedFields: FieldData[], ...rest) => {
      formContext.triggerFormChange(name, changedFields);

      if (onFieldsChange) {
        onFieldsChange(changedFields, ...rest);
      }
    },
    onFinish: (values: Store) => {
      formContext.triggerFormFinish(name, values);

      if (onFinish) {
        onFinish(values);
      }
    },
    onFinishFailed,
  });
  // 设置删除保留字段值
  setPreserve(preserve);

  // Prepare children by `children` type
  let childrenNode = children;
  const childrenRenderProps = typeof children === 'function';
  if (childrenRenderProps) {
    const values = formInstance.getFieldsValue(true);
    childrenNode = (children as RenderProps)(values, formInstance);
  }

  // Not use subscribe when using render props
  useSubscribe(!childrenRenderProps);

  const formContextValue = React.useMemo(
    () => ({
      ...(formInstance as InternalFormInstance),
      validateTrigger,
    }),
    [formInstance, validateTrigger],
  );
  const wrapperNode = (
    <FieldContext.Provider value={formContextValue}>{childrenNode}</FieldContext.Provider>
  );

  if (Component === false) {
    return wrapperNode;
  }

  return (
    <Component
      {...restProps}
      onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        event.stopPropagation();

        formInstance.submit();
      }}
      onReset={(event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        formInstance.resetFields();
        restProps.onReset?.(event);
      }}
    >
      {wrapperNode}
    </Component>
  );
};

export default Form;

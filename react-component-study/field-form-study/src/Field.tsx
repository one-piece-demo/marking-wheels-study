import React from 'react';
import FieldContext, { HOOK_MARK } from './FieldContext';
import { getNamePath, getValue, defaultGetValueFromEvent, containsNamePath } from './utils/valueUtil';
import toChildrenArray from './utils/toChildrenArray';
import toArray from './utils/toArray';
import { validateRules } from './utils/validateUtil';

import {
  FieldEntity,
  Meta,
  FormInstance,
  NamePath,
  StoreValue,
  EventArgs,
  InternalNamePath,
  Store,
  Rule,
  InternalFormInstance,
  NotifyInfo,
  RuleObject,
  ValidateOptions,
} from './types';

/*
*
1、把自己注册到 FormStore 中；
2、拦截子元素为其添加 value 以及 onChange 属性
*/

export type ShouldUpdate<Values = any> =
  | boolean
  | ((prevValues: Values, nextValues: Values, info: { source?: string }) => boolean);

interface ChildProps {
  [name: string]: any;
}

export interface InternalFieldProps<Values = any> {
  children?:
    | React.ReactElement
    | ((control: ChildProps, meta: Meta, form?: FormInstance<Values>) => React.ReactNode);
  // 字段名
  name?: InternalNamePath;

  /**
   * Set up `dependencies` field.
   * When dependencies field update and current field is touched,
   * will trigger validate rules and render.
   */
  dependencies?: NamePath[];

  // 设置如何将 event 的值转换成字段值
  getValueFromEvent?: (...args: EventArgs) => StoreValue;
  // 组件获取值后进行转换，再放入 Form 中
  normalize?: (value: StoreValue, prevValue: StoreValue, allValues: Store) => StoreValue;
  // 校验规则
  rules?: Rule[];
  // 自定义字段更新逻辑
  shouldUpdate?: ShouldUpdate<Values>;
  // 设置收集字段值变更的时机
  trigger?: string;
  // 设置字段校验的时机
  validateTrigger?: string | string[] | false;
  // 当某一规则校验不通过时，是否停止剩下的规则的校验。设置 parallel 时会并行校验
  validateFirst?: boolean | 'parallel';
  // 子节点的值的属性，如 Switch 的是 'checked'。该属性为 getValueProps 的封装，自定义 getValueProps 后会失效
  valuePropName?: string;
  // 为子元素value添加额外的属性
  getValueProps?: (value: StoreValue) => object;
  // 默认验证字段的信息
  messageVariables?: Record<string, string>;
  // 默认值
  initialValue?: any;
  // 重置监听
  onReset?: () => void;
  // 当字段被删除时保留字段值
  preserve?: boolean;

   /** @private Passed by Form.List props. Do not use since it will break by path check. */
   isListField?: boolean;

   /** @private Passed by Form.List props. Do not use since it will break by path check. */
   isList?: boolean;

   /** @private Pass context as prop instead of context api
    *  since class component can not get context in constructor */
   fieldContext?: InternalFormInstance;
}

export interface FieldProps<Values = any>
  extends Omit<InternalFieldProps<Values>, 'name' | 'fieldContext'> {
  name?: NamePath;
}

export interface FieldState {
  resetCount: number;
}

// 判断是否需要修改
function requireUpdate(
  shouldUpdate: ShouldUpdate | undefined,
  prev: StoreValue,
  next: StoreValue,
  prevValue: StoreValue,
  nextValue: StoreValue,
  info: NotifyInfo,
): boolean {
  if (typeof shouldUpdate === 'function') {
    return shouldUpdate(prev, next, 'source' in info ? { source: info.source } : {});
  }
  return prevValue !== nextValue;
}

// 需要使用field实例进行方法调用，所以才有class
class Field extends React.Component<InternalFieldProps, FieldState> implements FieldEntity {
  public static contextType = FieldContext; // this.props.fieldContext

  public static defaultProps = {
    trigger: 'onChange',
    valuePropName: 'value',
  };

  public state = {
    resetCount: 0,
  };

  // 是否加载
  private mounted = false;

  // 取消注册
  private cancelRegisterFunc: null | ((
    isListField?: boolean,
    preserve?: boolean,
    namePath?: InternalNamePath,
  ) => void) = null;

  // 校验promise
  private validatePromise: Promise<string[]> | null = null;

  // 错误信息
  private errors: string[] = [];

  // 是否被用户操作过
  private touched: boolean = false;

  // 上次校验是否还存在
  private prevValidating: boolean = false;

   /** Mark when touched & validated. Currently only used for `dependencies` */
   private dirty: boolean = false;

  constructor(props: InternalFieldProps) {
    super(props);

    // 初始化
    if (props.fieldContext) {
      const { getInternalHooks }: InternalFormInstance = props.fieldContext;
      const { initEntityValue } = getInternalHooks(HOOK_MARK) || {};
      initEntityValue && initEntityValue(this);
    }
  }

  public componentDidMount() {
    const { shouldUpdate, fieldContext } = this.props;

    this.mounted = true;

    // Field 挂载时，把自己注册到FieldContext中，也就是 fieldEntities 数组中。
    if (fieldContext) {
      const { getInternalHooks }: InternalFormInstance = fieldContext;
      const { registerField } = getInternalHooks(HOOK_MARK) || {};
      if(registerField) {
        this.cancelRegisterFunc = registerField(this);
      }
    }

    // One more render for component in case fields not ready
    if (shouldUpdate === true) {
      this.reRender();
    }
  }

  public componentWillUnmount() {
    this.cancelRegister();
    this.mounted = false;
  }

  public cancelRegister = () => {
    const { preserve, isListField, name } = this.props;

    if (this.cancelRegisterFunc) {
      this.cancelRegisterFunc(isListField, preserve, getNamePath(name || ''));
    }
    this.cancelRegisterFunc = null;
  };

  public isFieldValidating = () => !!this.validatePromise;

  public isFieldTouched = () => this.touched;

  public isFieldDirty = () => this.dirty;

  public getErrors = () => this.errors;

  public isListField = () => !!this.props.isListField;

  public isList = () => !!this.props.isList;

  public isPreserve = () => !!this.props.preserve;

  // 获取name组合
  public getNamePath = (): InternalNamePath => {
    const { name, fieldContext } = this.props;
    const { prefixName = [] } = fieldContext || {};

    return name !== undefined ? [...prefixName, ...name] : [];
  };

  public getMeta = (): Meta => {
    // Make error & validating in cache to save perf
    this.prevValidating = this.isFieldValidating();

    const meta: Meta = {
      touched: this.isFieldTouched(),
      validating: this.prevValidating,
      errors: this.errors,
      name: this.getNamePath(),
    };

    return meta;
  };

  public getValue = (store?: Store) => {
    const { getFieldsValue } = this.props.fieldContext as FormInstance;
    const namePath = this.getNamePath();
    return getValue(store || getFieldsValue(true), namePath);
  };

  public getRules = (): RuleObject[] => {
    const { rules = [], fieldContext } = this.props;

    return fieldContext ? rules.map(
      (rule: Rule): RuleObject => {
        if (typeof rule === 'function') {
          return rule(fieldContext);
        }
        return rule;
      },
    ) : [];
  };

  // Field 中传进来的子元素变为受控组件，也就是主动添加上 value 和 onChange 属性方法
  public getControlled = (childProps: ChildProps = {}) => {
    const {
      trigger,
      validateTrigger,
      getValueFromEvent,
      normalize,
      valuePropName,
      getValueProps,
      fieldContext,
    } = this.props;

    const triggerKey = trigger || 'onChange';
    const valueKey = valuePropName || 'value';
    const mergedValidateTrigger =
    validateTrigger !== undefined ? validateTrigger : fieldContext?.validateTrigger;

    const namePath = this.getNamePath();
    const { getInternalHooks, getFieldsValue } = fieldContext as InternalFormInstance;
    const { dispatch } = getInternalHooks(HOOK_MARK) || {};
    const value = this.getValue();
    const mergedGetValueProps = getValueProps || ((val: StoreValue) => ({ [valueKey]: val }));

    const originTriggerFunc: any = childProps[triggerKey];

    const control = {
      ...childProps,
      ...mergedGetValueProps(value),
    };


    // Add trigger
    control[triggerKey] = (...args: EventArgs) => {
      // Mark as touched
      this.touched = true;
      this.dirty = true;

      let newValue: StoreValue;
      if (getValueFromEvent) {
        newValue = getValueFromEvent(...args);
      } else {
        newValue = defaultGetValueFromEvent(valueKey, ...args);
      }

      if (normalize) {
        newValue = normalize(newValue, value, getFieldsValue(true));
      }

      dispatch && dispatch({
        type: 'updateValue',
        namePath,
        value: newValue,
      });

      if (originTriggerFunc) {
        originTriggerFunc(...args);
      }
    };

    // Add validateTrigger
    const validateTriggerList: string[] = toArray(mergedValidateTrigger || []);

    validateTriggerList.forEach((triggerName: string) => {
      // Wrap additional function of component, so that we can get latest value from store
      const originTrigger = control[triggerName];
      control[triggerName] = (...args: EventArgs) => {
        if (originTrigger) {
          originTrigger(...args);
        }

        // Always use latest rules
        const { rules } = this.props;
        if (rules && rules.length) {
          // We dispatch validate to root,
          // since it will update related data with other field with same name
          dispatch && dispatch({
            type: 'validateField',
            namePath,
            triggerName,
          });
        }
      };
    });

    return control;
  }

  // 获取有效child
  public getOnlyChild = (
    children:
      | React.ReactNode
      | ((control: ChildProps, meta: Meta, context?: FormInstance) => React.ReactNode),
  ): { child: React.ReactNode | null; isFunction: boolean } => {
    // Support render props
    if (typeof children === 'function') {
      const meta = this.getMeta();

      return {
        ...this.getOnlyChild(children(this.getControlled(), meta, this.props.fieldContext)),
        isFunction: true,
      };
    }

    // Filed element only
    const childList = toChildrenArray(children);
    if (childList.length !== 1 || !React.isValidElement(childList[0])) {
      return { child: childList, isFunction: false };
    }

    return { child: childList[0], isFunction: false };
  }

  public refresh = () => {
    if (!this.mounted) return;

    /**
     * Clean up current node.
     */
    this.setState(({ resetCount }) => ({
      resetCount: resetCount + 1,
    }));
  };

  // 监听Store改变触发
  public onStoreChange: FieldEntity['onStoreChange'] = (prevStore, namePathList, info) => {
    const { shouldUpdate, dependencies = [], onReset } = this.props;
    const { store } = info;
    const namePath = this.getNamePath();
    const prevValue = this.getValue(prevStore);
    const curValue = this.getValue(store);

    const namePathMatch = namePathList && containsNamePath(namePathList, namePath);

    // `setFieldsValue` is a quick access to update related status
    if (info.type === 'valueUpdate' && info.source === 'external' && prevValue !== curValue) {
      this.touched = true;
      this.dirty = true;
      this.validatePromise = null;
      this.errors = [];
    }

    switch (info.type) {
      case 'reset':
        if (!namePathList || namePathMatch) {
          // Clean up state
          this.touched = false;
          this.dirty = false;
          this.validatePromise = null;
          this.errors = [];

          if (onReset) {
            onReset();
          }

          this.refresh();
          return;
        }
        break;

      case 'setField': {
        if (namePathMatch) {
          const { data } = info;
          if ('touched' in data) {
            this.touched = !!data.touched;
          }
          if ('validating' in data && !('originRCField' in data)) {
            this.validatePromise = data.validating ? Promise.resolve([]) : null;
          }
          if ('errors' in data) {
            this.errors = data.errors || [];
          }
          this.dirty = true;

          this.reRender();
          return;
        }

        // Handle update by `setField` with `shouldUpdate`
        if (
          shouldUpdate &&
          !namePath.length &&
          requireUpdate(shouldUpdate, prevStore, store, prevValue, curValue, info)
        ) {
          this.reRender();
          return;
        }
        break;
      }

      case 'dependenciesUpdate': {
        /**
         * Trigger when marked `dependencies` updated. Related fields will all update
         */
        const dependencyList = dependencies.map(getNamePath);
        // No need for `namePathMath` check and `shouldUpdate` check, since `valueUpdate` will be
        // emitted earlier and they will work there
        // If set it may cause unnecessary twice rerendering
        if (dependencyList.some(dependency => containsNamePath(info.relatedFields, dependency))) {
          this.reRender();
          return;
        }
        break;
      }

      default:
        // 1. If `namePath` exists in `namePathList`, means it's related value and should update
        //      For example <List name="list"><Field name={['list', 0]}></List>
        //      If `namePathList` is [['list']] (List value update), Field should be updated
        //      If `namePathList` is [['list', 0]] (Field value update), List shouldn't be updated
        // 2.
        //   2.1 If `dependencies` is set, `name` is not set and `shouldUpdate` is not set,
        //       don't use `shouldUpdate`. `dependencies` is view as a shortcut if `shouldUpdate`
        //       is not provided
        //   2.2 If `shouldUpdate` provided, use customize logic to update the field
        //       else to check if value changed
        if (
          namePathMatch ||
          ((!dependencies.length || namePath.length || shouldUpdate) &&
            requireUpdate(shouldUpdate, prevStore, store, prevValue, curValue, info))
        ) {
          this.reRender();
          return;
        }
        break;
    }

    if (shouldUpdate === true) {
      this.reRender();
    }
  }

  // 校验规则
  public validateRules = (options?: ValidateOptions): Promise<string[]> => {
    const namePath = this.getNamePath();
    const currentValue = this.getValue();

    // Force change to async to avoid rule OOD under renderProps field
    const rootPromise = Promise.resolve().then(() => {
      if (!this.mounted) {
        return [];
      }

      const { validateFirst = false, messageVariables } = this.props;
      const { triggerName } = (options || {}) as ValidateOptions;

      let filteredRules = this.getRules();
      if (triggerName) {
        filteredRules = filteredRules.filter((rule: RuleObject) => {
          const { validateTrigger } = rule;
          if (!validateTrigger) {
            return true;
          }
          const triggerList = toArray(validateTrigger);
          return triggerList.includes(triggerName);
        });
      }

      const promise = validateRules(
        namePath,
        currentValue,
        filteredRules,
        options || {},
        validateFirst,
        messageVariables,
      );

      promise
        .catch((e: any) => e)
        .then((errors: string[] = []) => {
          if (this.validatePromise === rootPromise) {
            this.validatePromise = null;
            this.errors = errors;
            this.reRender();
          }
        });

      return promise;
    });

    this.validatePromise = rootPromise;
    this.dirty = true;
    this.errors = [];

    // Force trigger re-render since we need sync renderProps with new meta
    this.reRender();

    return rootPromise;
  }

  public reRender() {
    if (!this.mounted) return;
    this.forceUpdate();
  }

  public render() {
    const { children } = this.props;
    const { resetCount } = this.state;
    const { child, isFunction } = this.getOnlyChild(children);

    // Not need to `cloneElement` since user can handle this in render function self
    let returnChildNode: React.ReactNode;

    if (isFunction) {
      returnChildNode = child;
    } else if (React.isValidElement(child)) {
      returnChildNode = React.cloneElement(
        child as React.ReactElement,
        this.getControlled((child as React.ReactElement).props),
      );
    } else {
      console.warn('`children` of Field is not validate ReactElement.');
      returnChildNode = child;
    }

    return <React.Fragment key={resetCount}>{returnChildNode}</React.Fragment>;
  }
}

function WrapperField<Values = any> ({ name, ...restProps }: FieldProps<Values>) {
  const fieldContext = React.useContext(FieldContext);
  const namePath = name !== undefined ? getNamePath(name) : undefined;

  let key: string = 'keep';
  if (!restProps.isListField) {
    key = `_${(namePath || []).join('_')}`;
  }

  // Warning if it's a directly list field.
  // We can still support multiple level field preserve.
  if (
    process.env.NODE_ENV !== 'production' &&
    restProps.preserve === false &&
    restProps.isListField && namePath &&
    namePath.length <= 1
  ) {
    console.warn('`preserve` should not apply on Form.List fields.');
  }

  return <Field key={key} name={namePath} {...restProps} fieldContext={fieldContext} />;
}

export default WrapperField;

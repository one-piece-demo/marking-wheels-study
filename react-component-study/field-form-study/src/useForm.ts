/**
 * @name useForm
 * @date 2021/04/01
 * @author NARUTOne
 * @description 获取formInstance实例，对外提供所有方法的调用
 * @feature
 *  1. 返回formInstance，单例模式
 *  2.通过context全局共享实例
 */

import { useRef, useState } from 'react';
import {
  getNamePath,
  getValue,
  cloneByNamePathList,
  containsNamePath,
  setValue,
  setValues,
  matchNamePath,
} from './utils/valueUtil'
import NameMap from './utils/NameMap';
import { allPromiseFinish } from './utils/asyncUtil';
import { defaultValidateMessages } from './utils/messages';
import { HOOK_MARK } from './FieldContext';

import {
  FormInstance,
  InternalFormInstance,
  Store,
  FieldEntity,
  NamePath,
  InternalNamePath,
  Meta,
  NotifyInfo,
  ValuedNotifyInfo,
  FieldData,
  Callbacks,
  InternalValidateFields,
  ValidateOptions,
  ValidateErrorEntity,
  FieldError,
  ValidateMessages,
  InternalFieldData,
  InternalHooks,
  ReducerAction,
  StoreValue,
} from './types';

type InvalidateFieldEntity = { INVALIDATE_NAME_PATH: InternalNamePath };

class FormStore {
  // 判断form是否hook调用了
  private formHooked: boolean = false;

  // stroe 用来存储表单数据，它的格式：{"username": "lion"}
  private store: Store = {};

  // 初始值
  private initialValues: Store = {};

  // 是否订阅
  private subscribable: boolean = true;

  // 用来存储每个 Field 的实例数据，因此在store中可以通过 fieldEntities 来访问到每个表单项
  private fieldEntities: FieldEntity[] = [];

  // 强制更新
  private forceRootUpdate: () => void;

  // 校验返回函数
  private callbacks: Callbacks = {};

  // 校验promise
  private lastValidatePromise: Promise<FieldError[]> | null = null;

  // 校验信息
  private validateMessages: ValidateMessages | null = null;

  // 是否维持
  private preserve?: boolean = false;

  constructor(forceRootUpdate: () => void) {
    this.forceRootUpdate = forceRootUpdate;
  }

  // 提供实例及方法
  public getForm = (): InternalFormInstance => ({
    getFieldValue: this.getFieldValue,
    getFieldsValue: this.getFieldsValue,
    getFieldError: this.getFieldError,
    getFieldsError: this.getFieldsError,
    isFieldsTouched: this.isFieldsTouched,
    isFieldTouched: this.isFieldTouched,
    isFieldValidating: this.isFieldValidating,
    isFieldsValidating: this.isFieldsValidating,
    resetFields: this.resetFields,
    setFields: this.setFields,
    setFieldsValue: this.setFieldsValue,
    validateFields: this.validateFields,
    submit: this.submit,

    getInternalHooks: this.getInternalHooks,
  });

  // ======================== Internal Hooks ========================
  private getInternalHooks = (key: string): InternalHooks | null => {
    if (key === HOOK_MARK) {
      this.formHooked = true;

      return {
        dispatch: this.dispatch,
        initEntityValue: this.initEntityValue,
        registerField: this.registerField,
        useSubscribe: this.useSubscribe,
        setInitialValues: this.setInitialValues,
        setCallbacks: this.setCallbacks,
        setValidateMessages: this.setValidateMessages,
        getFields: this.getFields,
        setPreserve: this.setPreserve,
      };
    }

    console.warn(false, '`getInternalHooks` is internal usage. Should not call directly.');
    return null;
  };

  // ========================== Dev Warning =========================
  private timeoutId: number | null = null;

  // 判断是否hook
  private warningUnhooked = () => {
    if (process.env.NODE_ENV !== 'production' && !this.timeoutId && typeof window !== 'undefined') {
      this.timeoutId = window.setTimeout(() => {
        this.timeoutId = null;

        if (!this.formHooked) {
          console.warn(
            'Instance created by `useForm` is not connected to any Form element. Forget to pass `form` prop?',
          );
        }
      });
    }
  };

  // 派发行为
  private dispatch = (action: ReducerAction) => {
    switch (action.type) {
      case 'updateValue': {
        const { namePath, value } = action;
        this.updateValue(namePath, value);
        break;
      }
      case 'validateField': {
        const { namePath, triggerName } = action;
        this.validateFields([namePath], { triggerName });
        break;
      }
      default:
      // Currently we don't have other action. Do nothing.
    }
  };

  // 初始订阅者
  private useSubscribe = (subscribable: boolean) => {
    this.subscribable = subscribable;
  };

  // 设置callbacks
  private setCallbacks = (callbacks: Callbacks) => {
    this.callbacks = callbacks;
  };

  // 设置维持保存
  private setPreserve = (preserve?: boolean) => {
    this.preserve = preserve;
  };

   /**
    * 初始实体值
   * This only trigger when a field is on constructor to avoid we get initialValue too late
   */
  private initEntityValue = (entity: FieldEntity) => {
    const { initialValue } = entity.props;

    if (initialValue !== undefined) {
      const namePath = entity.getNamePath();
      const prevValue = getValue(this.store, namePath);

      if (prevValue === undefined) {
        this.store = setValue(this.store, namePath, initialValue);
      }
    }
  };

  // 注册字段
  private registerField = (entity: FieldEntity) => {
    this.fieldEntities.push(entity);

    // Set initial values
    if (entity.props.initialValue !== undefined) {
      const prevStore = this.store;
      this.resetWithFieldInitialValue({ entities: [entity], skipExist: true });
      this.notifyObservers(prevStore, [entity.getNamePath()], {
        type: 'valueUpdate',
        source: 'internal',
      });
    }

    // un-register field callback
    return (isListField?: boolean, preserve?: boolean, subNamePath: InternalNamePath = []) => {
      this.fieldEntities = this.fieldEntities.filter(item => item !== entity);

      // Clean up store value if not preserve
      const mergedPreserve = preserve !== undefined ? preserve : this.preserve;

      if (mergedPreserve === false && (!isListField || subNamePath.length > 1)) {
        const namePath = entity.getNamePath();

        const defaultValue = isListField ? undefined : getValue(this.initialValues, namePath);

        if (
          namePath.length &&
          this.getFieldValue(namePath) !== defaultValue &&
          this.fieldEntities.every(
            field =>
              // Only reset when no namePath exist
              !matchNamePath(field.getNamePath(), namePath),
          )
        ) {
          this.store = setValue(this.store, namePath, defaultValue, true);
        }
      }
    };
  };

  /**字段实体
   * Get registered field entities.
   * @param pure Only return field which has a `name`. Default: false
   */
  private getFieldEntities = (pure: boolean = false) => {
    if (!pure) {
      return this.fieldEntities;
    }

    return this.fieldEntities.filter(field => field.getNamePath().length);
  };

  private getFieldsMap = (pure: boolean = false) => {
    const cache: NameMap<FieldEntity> = new NameMap();
    this.getFieldEntities(pure).forEach(field => {
      const namePath = field.getNamePath();
      cache.set(namePath, field);
    });
    return cache;
  };

  private getFieldEntitiesForNamePathList = (
    nameList?: NamePath[],
  ): (FieldEntity | InvalidateFieldEntity)[] => {
    if (!nameList) {
      return this.getFieldEntities(true);
    }
    const cache = this.getFieldsMap(true);
    return nameList.map(name => {
      const namePath = getNamePath(name);
      return cache.get(namePath) || { INVALIDATE_NAME_PATH: getNamePath(name) };
    });
  };

  // 获取初始值
  private getInitialValue = (namePath: InternalNamePath) => getValue(this.initialValues, namePath);

   /**
   * First time `setInitialValues` should update store with initial value
   */
  private setInitialValues = (initialValues: Store, init: boolean) => {
    this.initialValues = initialValues || {};
    if (init) {
      this.store = setValues({}, initialValues, this.store);
    }
  };

  // 获取字段实体数据
  private getFields = (): InternalFieldData[] => {
    const entities = this.getFieldEntities(true);

    const fields = entities.map(
      (field: FieldEntity): InternalFieldData => {
        const namePath = field.getNamePath();
        const meta = field.getMeta();
        const fieldData = {
          ...meta,
          name: namePath,
          value: this.getFieldValue(namePath),
        };

        Object.defineProperty(fieldData, 'originRCField', {
          value: true,
        });

        return fieldData;
      },
    );

    return fields;
  };

  // 设置校验信息
  private setValidateMessages = (validateMessages: ValidateMessages) => {
    this.validateMessages = validateMessages;
  };

  // 获取依赖子字段
  private getDependencyChildrenFields = (rootNamePath: InternalNamePath): InternalNamePath[] => {
    const children: Set<FieldEntity> = new Set();
    const childrenFields: InternalNamePath[] = [];

    const dependencies2fields: NameMap<Set<FieldEntity>> = new NameMap();

    /**
     * Generate maps
     * Can use cache to save perf if user report performance issue with this
     */
    this.getFieldEntities().forEach(field => {
      const { dependencies } = field.props;
      (dependencies || []).forEach(dependency => {
        const dependencyNamePath = getNamePath(dependency);
        dependencies2fields.update(dependencyNamePath, (fields = new Set()) => {
          fields.add(field);
          return fields;
        });
      });
    });

    const fillChildren = (namePath: InternalNamePath) => {
      const fields = dependencies2fields.get(namePath) || new Set();
      fields.forEach(field => {
        if (!children.has(field)) {
          children.add(field);

          const fieldNamePath = field.getNamePath();
          if (field.isFieldDirty() && fieldNamePath.length) {
            childrenFields.push(fieldNamePath);
            fillChildren(fieldNamePath);
          }
        }
      });
    };

    fillChildren(rootNamePath);

    return childrenFields;
  };

  // 触发 onFieldsChange
  private triggerOnFieldsChange = (
    namePathList: InternalNamePath[],
    filedErrors?: FieldError[],
  ) => {
    const { onFieldsChange } = this.callbacks;

    if (onFieldsChange) {
      const fields = this.getFields();

      /**
       * Fill errors since `fields` may be replaced by controlled fields
       */
      if (filedErrors) {
        const cache = new NameMap<string[]>();
        filedErrors.forEach(({ name, errors }) => {
          cache.set(name, errors);
        });

        fields.forEach((field: any) => {
          // eslint-disable-next-line no-param-reassign
          field.errors = cache.get(field.name) || field.errors;
        });
      }

      const changedFields = fields.filter(({ name }: any) =>
        containsNamePath(namePathList, name as InternalNamePath),
      );
      onFieldsChange(changedFields, fields);
    }
  };

  // 通知观察者
  private notifyObservers = (
    prevStore: Store,
    namePathList: InternalNamePath[] | null,
    info: NotifyInfo,
  ) => {
    if (this.subscribable) {
      const mergedInfo: ValuedNotifyInfo = {
        ...info,
        store: this.getFieldsValue(true),
      };
      this.getFieldEntities().forEach(({ onStoreChange }) => {
        onStoreChange(prevStore, namePathList, mergedInfo);
      });
    } else {
      this.forceRootUpdate();
    }
  };

  /**
   * Reset Field with field `initialValue` prop.
   * Can pass `entities` or `namePathList` or just nothing.
   */
  private resetWithFieldInitialValue = (
    info: {
      entities?: FieldEntity[];
      namePathList?: InternalNamePath[];
      /** Skip reset if store exist value. This is only used for field register reset */
      skipExist?: boolean;
    } = {},
  ) => {
    // Create cache
    const cache: NameMap<Set<{ entity: FieldEntity; value: any }>> = new NameMap();

    const fieldEntities = this.getFieldEntities(true);
    fieldEntities.forEach(field => {
      const { initialValue } = field.props;
      const namePath = field.getNamePath();

      // Record only if has `initialValue`
      if (initialValue !== undefined) {
        const records = cache.get(namePath) || new Set();
        records.add({ entity: field, value: initialValue });

        cache.set(namePath, records);
      }
    });

    // Reset
    const resetWithFields = (entities: FieldEntity[]) => {
      entities.forEach(field => {
        const { initialValue } = field.props;

        if (initialValue !== undefined) {
          const namePath = field.getNamePath();
          const formInitialValue = this.getInitialValue(namePath);

          if (formInitialValue !== undefined) {
            // Warning if conflict with form initialValues and do not modify value
            console.warn(
              `Form already set 'initialValues' with path '${namePath.join(
                '.',
              )}'. Field can not overwrite it.`,
            );
          } else {
            const records = cache.get(namePath);
            if (records && records.size > 1) {
              // Warning if multiple field set `initialValue`and do not modify value
              console.warn(
                `Multiple Field with path '${namePath.join(
                  '.',
                )}' set 'initialValue'. Can not decide which one to pick.`,
              );
            } else if (records) {
              const originValue = this.getFieldValue(namePath);
              // Set `initialValue`
              if (!info.skipExist || originValue === undefined) {
                this.store = setValue(this.store, namePath, [...records][0].value);
              }
            }
          }
        }
      });
    };

    let requiredFieldEntities: FieldEntity[];
    if (info.entities) {
      requiredFieldEntities = info.entities;
    } else if (info.namePathList) {
      requiredFieldEntities = [];

      info.namePathList.forEach(namePath => {
        const records = cache.get(namePath);
        if (records) {
          requiredFieldEntities.push(...[...records].map(r => r.entity));
        }
      });
    } else {
      requiredFieldEntities = fieldEntities;
    }

    resetWithFields(requiredFieldEntities);
  };

  // 修改值
  private updateValue = (name: NamePath, value: StoreValue) => {
    const namePath = getNamePath(name);
    const prevStore = this.store;
    this.store = setValue(this.store, namePath, value);

    this.notifyObservers(prevStore, [namePath], {
      type: 'valueUpdate',
      source: 'internal',
    });

    // 依赖相关更新
    // Notify dependencies children with parent update
    // We need delay to trigger validate in case Field is under render props
    const childrenFields = this.getDependencyChildrenFields(namePath);
    if (childrenFields.length) {
      this.validateFields(childrenFields);
    }

    this.notifyObservers(prevStore, childrenFields, {
      type: 'dependenciesUpdate',
      relatedFields: [namePath, ...childrenFields],
    });

    // trigger callback function
    const { onValuesChange } = this.callbacks;

    if (onValuesChange) {
      const changedValues = cloneByNamePathList(this.store, [namePath]);
      onValuesChange(changedValues, this.getFieldsValue());
    }

    this.triggerOnFieldsChange([namePath, ...childrenFields]);
  };


  // ------------------- api ---------------------

  private getFieldValue = (name: NamePath) => {
    this.warningUnhooked();

    const namePath: InternalNamePath = getNamePath(name);
    return getValue(this.store, namePath);
  };

  private getFieldsValue = (nameList?: NamePath[] | true, filterFunc?: (meta: Meta) => boolean) => {
    this.warningUnhooked();

    if (nameList === true && !filterFunc) {
      return this.store;
    }

    const fieldEntities = this.getFieldEntitiesForNamePathList(
      Array.isArray(nameList) ? nameList : [],
    );

    const filteredNameList: NamePath[] = [];
    fieldEntities.forEach((entity: FieldEntity | InvalidateFieldEntity) => {
      const namePath =
        'INVALIDATE_NAME_PATH' in entity ? entity.INVALIDATE_NAME_PATH : entity.getNamePath();

      // Ignore when it's a list item and not specific the namePath,
      // since parent field is already take in count
      if (!nameList && (entity as FieldEntity).isListField?.()) {
        return;
      }

      if (!filterFunc) {
        filteredNameList.push(namePath);
      } else {
        const meta: Meta | null = 'getMeta' in entity ? entity.getMeta() : null;
        if (meta && filterFunc(meta)) {
          filteredNameList.push(namePath);
        }
      }
    });

    return cloneByNamePathList(this.store, filteredNameList.map(getNamePath));
  };

  private getFieldError = (name: NamePath): string[] => {
    this.warningUnhooked();

    const namePath = getNamePath(name);
    const fieldError = this.getFieldsError([namePath])[0];
    return fieldError.errors;
  };

  private getFieldsError = (nameList?: NamePath[]): FieldError[] => {
    this.warningUnhooked();

    // field 实体
    const fieldEntities = this.getFieldEntitiesForNamePathList(nameList);

    return fieldEntities.map((entity, index) => {
      if (entity && !('INVALIDATE_NAME_PATH' in entity)) {
        return {
          name: entity.getNamePath(),
          errors: entity.getErrors(),
        };
      }

      return {
        name: nameList ? getNamePath(nameList[index]) : [],
        errors: [],
      };
    });
  };

  private isFieldsTouched = (...args: any[]) => {
    this.warningUnhooked();

    const [arg0, arg1] = args;
    let namePathList: InternalNamePath[] | null;
    let isAllFieldsTouched = false;

    if (args.length === 0) {
      namePathList = null;
    } else if (args.length === 1) {
      if (Array.isArray(arg0)) {
        namePathList = arg0.map(getNamePath);
        isAllFieldsTouched = false;
      } else {
        namePathList = null;
        isAllFieldsTouched = arg0;
      }
    } else {
      namePathList = arg0.map(getNamePath);
      isAllFieldsTouched = arg1;
    }

    const fieldEntities = this.getFieldEntities(true);
    const isFieldTouched = (field: FieldEntity) => field.isFieldTouched();

    // ===== Will get fully compare when not config namePathList =====
    if (!namePathList) {
      return isAllFieldsTouched
        ? fieldEntities.every(isFieldTouched)
        : fieldEntities.some(isFieldTouched);
    }

    // Generate a nest tree for validate
    const map = new NameMap<FieldEntity[]>();
    namePathList.forEach(shortNamePath => {
      map.set(shortNamePath, []);
    });

    fieldEntities.forEach(field => {
      const fieldNamePath = field.getNamePath();
      if (namePathList) {
        // Find matched entity and put into list
        namePathList.forEach(shortNamePath => {
          if (shortNamePath.every((nameUnit, i) => fieldNamePath[i] === nameUnit)) {
            map.update(shortNamePath, list => [...list, field]);
          }
        });
      }
    });

    // Check if NameMap value is touched
    const isNamePathListTouched = (entities: FieldEntity[]) => entities.some(isFieldTouched);

    const namePathListEntities = map.map(({ value }) => value);

    return isAllFieldsTouched
      ? namePathListEntities.every(isNamePathListTouched)
      : namePathListEntities.some(isNamePathListTouched);
  };

  private isFieldTouched = (name: NamePath) => {
    this.warningUnhooked();
    return this.isFieldsTouched([name]);
  };

  private isFieldValidating = (name: NamePath) => {
    this.warningUnhooked();

    return this.isFieldsValidating([name]);
  };

  private isFieldsValidating = (nameList?: NamePath[]) => {
    this.warningUnhooked();

    const fieldEntities = this.getFieldEntities();
    if (!nameList) {
      return fieldEntities.some(testField => testField.isFieldValidating());
    }

    const namePathList: InternalNamePath[] = nameList.map(getNamePath);
    return fieldEntities.some(testField => {
      const fieldNamePath = testField.getNamePath();
      return containsNamePath(namePathList, fieldNamePath) && testField.isFieldValidating();
    });
  };

  private resetFields = (nameList?: NamePath[]) => {
    this.warningUnhooked();

    const prevStore = this.store;
    if (!nameList) {
      this.store = setValues({}, this.initialValues);
      this.resetWithFieldInitialValue();
      this.notifyObservers(prevStore, null, { type: 'reset' });
      return;
    }

    // Reset by `nameList`
    const namePathList: InternalNamePath[] = nameList.map(getNamePath);
    namePathList.forEach(namePath => {
      const initialValue = this.getInitialValue(namePath);
      this.store = setValue(this.store, namePath, initialValue);
    });
    this.resetWithFieldInitialValue({ namePathList });
    this.notifyObservers(prevStore, namePathList, { type: 'reset' });
  };

  private setFields = (fields: FieldData[]) => {
    this.warningUnhooked();

    const prevStore = this.store;

    fields.forEach((fieldData: FieldData) => {
      const { name, errors, ...data } = fieldData;
      const namePath = getNamePath(name);

      // Value
      if ('value' in data) {
        this.store = setValue(this.store, namePath, data.value);
      }

      this.notifyObservers(prevStore, [namePath], {
        type: 'setField',
        data: fieldData,
      });
    });
  };

   // Let all child Field get update.
  private setFieldsValue = (store: Store) => {
    this.warningUnhooked();

    const prevStore = this.store;

    if (store) {
      this.store = setValues(this.store, store);
    }

    this.notifyObservers(prevStore, null, {
      type: 'valueUpdate',
      source: 'external',
    });
  };

  // 校验 fields
  private validateFields: InternalValidateFields = (
    nameList?: NamePath[],
    options?: ValidateOptions,
  ) => {
    this.warningUnhooked();

    const provideNameList = !!nameList;
    const namePathList: InternalNamePath[] | undefined = provideNameList && nameList
      ? nameList.map(getNamePath)
      : [];

    // Collect result in promise list
    const promiseList: Promise<{
      name: InternalNamePath;
      errors: string[];
    }>[] = [];

    this.getFieldEntities(true).forEach((field: FieldEntity) => {
      // Add field if not provide `nameList`
      if (!provideNameList) {
        namePathList.push(field.getNamePath());
      }

      /**
       * Recursive validate if configured.
       * TODO: perf improvement @zombieJ
       */
      if (options?.recursive && provideNameList && nameList) {
        const namePath = field.getNamePath();
        if (
          // nameList[i] === undefined 说明是以 nameList 开头的
          // ['name'] -> ['name','list']
          namePath.every((nameUnit, i) => nameList[i] === nameUnit || nameList[i] === undefined)
        ) {
          namePathList.push(namePath);
        }
      }

      // Skip if without rule
      if (!field.props.rules || !field.props.rules.length) {
        return;
      }

      const fieldNamePath = field.getNamePath();
      // Add field validate rule in to promise list
      if (!provideNameList || containsNamePath(namePathList, fieldNamePath)) {
        const promise = field.validateRules({
          validateMessages: {
            ...defaultValidateMessages,
            ...this.validateMessages,
          },
          ...options,
        });

        // Wrap promise with field
        promiseList.push(
          promise
            .then(() => ({ name: fieldNamePath, errors: [] }))
            .catch(errors =>
              Promise.reject({
                name: fieldNamePath,
                errors,
              }),
            ),
        );
      }
    });

    const summaryPromise = allPromiseFinish(promiseList);
    this.lastValidatePromise = summaryPromise;

    // Notify fields with rule that validate has finished and need update
    summaryPromise
      .catch((results: any) => results)
      .then((results: FieldError[]) => {
        const resultNamePathList: InternalNamePath[] = results.map(({ name }) => name);
        this.notifyObservers(this.store, resultNamePathList, {
          type: 'validateFinish',
        });
        this.triggerOnFieldsChange(resultNamePathList, results);
      });

    const returnPromise: Promise<Store | ValidateErrorEntity | string[]> = summaryPromise
      .then(
        (): Promise<Store | string[]> => {
          if (this.lastValidatePromise === summaryPromise) {
            return Promise.resolve(this.getFieldsValue(namePathList));
          }
          return Promise.reject<string[]>([]);
        },
      )
      .catch((results: { name: InternalNamePath; errors: string[] }[]) => {
        const errorList = results.filter(result => result && result.errors.length);
        return Promise.reject({
          values: this.getFieldsValue(namePathList),
          errorFields: errorList,
          outOfDate: this.lastValidatePromise !== summaryPromise,
        });
      });

    // Do not throw in console
    returnPromise.catch<ValidateErrorEntity>(e => e);

    return returnPromise as Promise<Store>;
  };

  private submit = () => {
    this.warningUnhooked();

    this.validateFields()
      .then((values: any) => {
        const { onFinish } = this.callbacks;
        if (onFinish) {
          try {
            onFinish(values);
          } catch (err) {
            // Should print error if user `onFinish` callback failed
            console.error(err);
          }
        }
      })
      .catch(e => {
        const { onFinishFailed } = this.callbacks;
        if (onFinishFailed) {
          onFinishFailed(e);
        }
      });
  };
}

function useForm<Values = any>(form?: FormInstance<Values>): [FormInstance<Values>] {
  const formRef = useRef<FormInstance>();
  const [, forceUpdate] = useState({});

  // 简易单例模式判断
  if (!formRef.current) {
    if(form) {
      formRef.current = form;
    } else {
      const forceReRender = () => {
        forceUpdate({});
      };
      const formStore = new FormStore(forceReRender);
      formRef.current = formStore.getForm();
    }
  }

  return [formRef.current];
}

export default useForm;

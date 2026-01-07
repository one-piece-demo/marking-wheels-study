import { ReactElement } from 'react';

// typescript
export type ktype = string | number;
export type InternalNamePath = (string | number)[];
export type NamePath = string | number | InternalNamePath;
export type StoreValue = any;
export type EventArgs = any[];

// store 存储
export interface Store {
  [name: string]: StoreValue;
}

export interface KeyT {
  [k: string]: any;
  [n: number]: any;
}

type ValidateMessage = string | (() => string);

/** Only return partial when type is not any */
type RecursivePartial<T> = T extends object
  ? {
      [P in keyof T]?: T[P] extends (infer U)[]
        ? RecursivePartial<U>[]
        : T[P] extends object
        ? RecursivePartial<T[P]>
        : T[P];
    }
  : any;

// 元信息
export interface Meta {
  // 是否被用户操作过
  touched: boolean;
  // 是否正在校验
  validating: boolean;
  // 错误信息
  errors: string[];
  // 字段名称
  name: InternalNamePath;
}

// rule
export type RuleType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'method'
  | 'regexp'
  | 'integer'
  | 'float'
  | 'object'
  | 'enum'
  | 'date'
  | 'url'
  | 'hex'
  | 'email';

// 验证
type Validator = (
  rule: RuleObject,
  value: StoreValue,
  callback: (error?: string) => void,
) => Promise<void | any> | void;

export type RuleRender = (form: FormInstance) => RuleObject;

export interface ValidatorRule {
  message?: string | ReactElement;
  validator: Validator;
}

interface BaseRule {
  enum?: StoreValue[];
  len?: number;
  max?: number;
  message?: string | ReactElement;
  min?: number;
  pattern?: RegExp;
  required?: boolean;
  transform?: (value: StoreValue) => StoreValue;
  type?: RuleType;
  whitespace?: boolean;

  /** Customize rule level `validateTrigger`. Must be subset of Field `validateTrigger` */
  validateTrigger?: string | string[];
}

// 聚合规则
type AggregationRule = BaseRule & Partial<ValidatorRule>;

interface ArrayRule extends Omit<AggregationRule, 'type'> {
  type: 'array';
  defaultField?: RuleObject;
}

export type RuleObject = AggregationRule | ArrayRule;

export type Rule = RuleObject | RuleRender;

// info
interface ValueUpdateInfo {
  type: 'valueUpdate';
  source: 'internal' | 'external';
}

interface ValidateFinishInfo {
  type: 'validateFinish';
}

interface ResetInfo {
  type: 'reset';
}

interface SetFieldInfo {
  type: 'setField';
  data: FieldData;
}

interface DependenciesUpdateInfo {
  type: 'dependenciesUpdate';
  /**
   * Contains all the related `InternalNamePath[]`.
   * a <- b <- c : change `a`
   * relatedFields=[a, b, c]
   */
  relatedFields: InternalNamePath[];
}

// 通知信息
export type NotifyInfo =
  | ValueUpdateInfo
  | ValidateFinishInfo
  | ResetInfo
  | SetFieldInfo
  | DependenciesUpdateInfo;
export type ValuedNotifyInfo = NotifyInfo & {
  store: Store;
};

interface UpdateAction {
  type: 'updateValue';
  namePath: InternalNamePath;
  value: StoreValue;
}

interface ValidateAction {
  type: 'validateField';
  namePath: InternalNamePath;
  triggerName: string;
}

export type ReducerAction = UpdateAction | ValidateAction;

// 字段错误信息
export interface FieldError {
  name: InternalNamePath;
  errors: string[];
}
export interface InternalFieldData extends Meta {
  // 字段值
  value: StoreValue;
}
/**
 * Used by `setFields` config
 * @Partial 可选
 * @omit 排除
 */
export interface FieldData extends Partial<Omit<InternalFieldData, 'name'>> {
  name: NamePath;
}

// 校验信息
export interface ValidateMessages {
  default?: ValidateMessage;
  required?: ValidateMessage;
  enum?: ValidateMessage;
  whitespace?: ValidateMessage;
  date?: {
    format?: ValidateMessage;
    parse?: ValidateMessage;
    invalid?: ValidateMessage;
  };
  types?: {
    string?: ValidateMessage;
    method?: ValidateMessage;
    array?: ValidateMessage;
    object?: ValidateMessage;
    number?: ValidateMessage;
    date?: ValidateMessage;
    boolean?: ValidateMessage;
    integer?: ValidateMessage;
    float?: ValidateMessage;
    regexp?: ValidateMessage;
    email?: ValidateMessage;
    url?: ValidateMessage;
    hex?: ValidateMessage;
  };
  string?: {
    len?: ValidateMessage;
    min?: ValidateMessage;
    max?: ValidateMessage;
    range?: ValidateMessage;
  };
  number?: {
    len?: ValidateMessage;
    min?: ValidateMessage;
    max?: ValidateMessage;
    range?: ValidateMessage;
  };
  array?: {
    len?: ValidateMessage;
    min?: ValidateMessage;
    max?: ValidateMessage;
    range?: ValidateMessage;
  };
  pattern?: {
    mismatch?: ValidateMessage;
  };
}

// 校验错误实体
export interface ValidateErrorEntity<Values = any> {
  values: Values;
  errorFields: { name: InternalNamePath; errors: string[] }[];
  outOfDate: boolean;
}

// 校验配置
export interface ValidateOptions {
  triggerName?: string;
  validateMessages?: ValidateMessages;
  /**
   * Recursive validate. It will validate all the name path that contains the provided one.
   * e.g. ['a'] will validate ['a'] , ['a', 'b'] and ['a', 1].
   */
  recursive?: boolean;
}
// 内部校验字段
export type InternalValidateFields<Values = any> = (
  nameList?: NamePath[],
  options?: ValidateOptions,
) => Promise<Values>;
// 校验字段
export type ValidateFields<Values = any> = (nameList?: NamePath[]) => Promise<Values>;

// 字段实体
export interface FieldEntity {
  onStoreChange: (
    store: Store,
    namePathList: InternalNamePath[] | null,
    info: ValuedNotifyInfo,
  ) => void;
  isFieldTouched: () => boolean;
  isFieldDirty: () => boolean;
  isFieldValidating: () => boolean;
  isListField: () => boolean;
  isList: () => boolean;
  isPreserve: () => boolean;
  validateRules: (options?: ValidateOptions) => Promise<string[]>;
  getMeta: () => Meta;
  getNamePath: () => InternalNamePath;
  getErrors: () => string[];
  props: {
    name?: NamePath;
    rules?: Rule[];
    dependencies?: NamePath[];
    initialValue?: any;
  };
}

// callback 方法
export interface Callbacks<Values = any> {
  onValuesChange?: (changedValues: any, values: Values) => void;
  onFieldsChange?: (changedFields: FieldData[], allFields: FieldData[]) => void;
  onFinish?: (values: Values) => void;
  onFinishFailed?: (errorInfo: ValidateErrorEntity<Values>) => void;
}

// hooks
export interface InternalHooks {
  dispatch: (action: ReducerAction) => void;
  initEntityValue: (entity: FieldEntity) => void;
  registerField: (entity: FieldEntity) => () => void;
  useSubscribe: (subscribable: boolean) => void;
  setInitialValues: (values: Store, init: boolean) => void;
  setCallbacks: (callbacks: Callbacks) => void;
  getFields: (namePathList?: InternalNamePath[]) => FieldData[];
  setValidateMessages: (validateMessages: ValidateMessages) => void;
  setPreserve: (preserve?: boolean) => void;
}

// form实例
export interface FormInstance<Values = any> {
  // Origin Form API

  //获取对应字段名的值
  getFieldValue: (name: NamePath) => StoreValue;
  // 获取所有值
  getFieldsValue(): Values;
  // 获取对应字段名对应的值
  getFieldsValue(nameList: NamePath[] | true, filterFunc?: (meta: Meta) => boolean): any;
  // 字段错误信息
  getFieldError: (name: NamePath) => string[];
  // 对应字段错误信息
  getFieldsError: (nameList?: NamePath[]) => FieldError[];
  // 对应字段是否被操作过
  isFieldsTouched(nameList?: NamePath[], allFieldsTouched?: boolean): boolean;
  // 所有字段是否被操作过
  isFieldsTouched(allFieldsTouched?: boolean): boolean;
  // 检查字段是否被操作过
  isFieldTouched: (name: NamePath) => boolean;
  // 是否在校验
  isFieldValidating: (name: NamePath) => boolean;
  isFieldsValidating: (nameList: NamePath[]) => boolean;
  // 重置字段
  resetFields: (fields?: NamePath[]) => void;
  // 设置字段值
  setFields: (fields: FieldData[]) => void;
  setFieldsValue: (value: RecursivePartial<Values>) => void;
  // 校验字段
  validateFields: ValidateFields<Values>;

  // New API
  submit: () => void;
}

// 内部form实例
export type InternalFormInstance = Omit<FormInstance, 'validateFields'> & {
  validateFields: InternalValidateFields;

  /**
   * Passed by field context props
   * 名称前缀
   */
  prefixName?: InternalNamePath;

  // 统一设置字段校验规则
  validateTrigger?: string | string[] | false;

  /**
   * Form component should register some content into store.
   * We pass the `HOOK_MARK` as key to avoid user call the function.
   * 获取内部hooks
   */
  getInternalHooks: (secret: string) => InternalHooks | null;
};

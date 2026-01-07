/*
 * @File: List.tsx
 * @Project: field-form-study
 * @Date: Thursday, 8th April 2021 8:24:09 pm
 * @Author: NARUTOne (wznaruto326@163.com/wznarutone326@gamil.com)
 * -----
 * @Last Modified: Thursday, 8th April 2021 8:28:00 pm
 * @Modified By: NARUTOne
 * -----
 * @Copyright fireLeaf © 2021 field-form-study, ***
 * @fighting: 思则行之，迟则忘之，久而久之，恒则竟之
 */

import React from 'react';
import FieldContext from './FieldContext';
import Field from './Field';
import { move, getNamePath } from './utils/valueUtil'

import { InternalNamePath, NamePath, StoreValue, ValidatorRule, Meta } from './types';

// 表单列表list, 支持新增，删除，移动位置

export interface ListField {
  name: number;
  key: number;
  isListField: boolean;
}

export interface ListOperations {
  add: (defaultValue?: StoreValue, index?: number) => void;
  remove: (index: number | number[]) => void;
  move: (from: number, to: number) => void;
}

export interface ListProps {
  name: NamePath;
  rules?: ValidatorRule[];
  validateTrigger?: string | string[] | false;
  initialValue?: any[];
  children?: (
    fields: ListField[],
    operations: ListOperations,
    meta: Meta,
  ) => JSX.Element | React.ReactNode;
}

const List: React.FC<ListProps> = ({
  name,
  initialValue,
  children,
  rules,
  validateTrigger,
}) => {
  const context = React.useContext(FieldContext);
  const keyRef = React.useRef({
    keys: [],
    id: 0,
  });
  const keyManager = keyRef.current;

  // User should not pass `children` as other type.
  if (typeof children !== 'function') {
    console.warn(false, 'Form.List only accepts function as children.');
    return null;
  }

  const parentPrefixName = getNamePath(context.prefixName || '') || [];
  const prefixName: InternalNamePath = [...parentPrefixName, ...getNamePath(name)];

  const shouldUpdate = (prevValue: StoreValue, nextValue: StoreValue, { source }: any) => {
    if (source === 'internal') { // 内部
      return false;
    }
    return prevValue !== nextValue;
  }

  return (
    <FieldContext.Provider value={{ ...context, prefixName }}>
      <Field
        name={[]}
        shouldUpdate={shouldUpdate}
        rules={rules}
        validateTrigger={validateTrigger}
        initialValue={initialValue}
        isList
      >
        {({ value = [], onChange }, meta) => {
          const { getFieldValue } = context;
          const getNewValue = () => {
            const values = getFieldValue(prefixName || []) as StoreValue[];
            return values || [];
          };
          /**
           * Always get latest value in case user update fields by `form` api.
           */
          const operations: ListOperations = {
            add: (defaultValue, index?: number) => {
              // Mapping keys
              const newValue = getNewValue();

              if (index >= 0 && index <= newValue.length) {
                keyManager.keys = [
                  ...keyManager.keys.slice(0, index),
                  keyManager.id,
                  ...keyManager.keys.slice(index),
                ];
                onChange([...newValue.slice(0, index), defaultValue, ...newValue.slice(index)]);
              } else {
                if (
                  process.env.NODE_ENV !== 'production' &&
                  (index < 0 || index > newValue.length)
                ) {
                  console.warn(
                    'The second parameter of the add function should be a valid positive number.',
                  );
                }
                keyManager.keys = [...keyManager.keys, keyManager.id];
                onChange([...newValue, defaultValue]);
              }
              keyManager.id += 1;
            },
            remove: (index: number | number[]) => {
              const newValue = getNewValue();
              const indexSet = new Set(Array.isArray(index) ? index : [index]);

              if (indexSet.size <= 0) {
                return;
              }
              keyManager.keys = keyManager.keys.filter((_, keysIndex) => !indexSet.has(keysIndex));

              // Trigger store change
              onChange(newValue.filter((_, valueIndex) => !indexSet.has(valueIndex)));
            },
            move(from: number, to: number) {
              if (from === to) {
                return;
              }
              const newValue = getNewValue();

              // Do not handle out of range
              if (from < 0 || from >= newValue.length || to < 0 || to >= newValue.length) {
                return;
              }

              keyManager.keys = move(keyManager.keys, from, to);

              // Trigger store change
              onChange(move(newValue, from, to));
            },
          };

          let listValue = value || [];
          if (!Array.isArray(listValue)) {
            listValue = [];

            if (process.env.NODE_ENV !== 'production') {
              console.warn(`Current value of '${prefixName.join(' > ')}' is not an array type.`);
            }
          }

          return children(
            (listValue as StoreValue[]).map(
              (__, index): ListField => {
                let key = keyManager.keys[index];
                if (key === undefined) {
                  keyManager.keys[index] = keyManager.id;
                  key = keyManager.keys[index];
                  keyManager.id += 1;
                }
                // field props
                return {
                  name: index,
                  key,
                  isListField: true,
                };
              },
            ),
            operations,
            meta,
          );
        }}
      </Field>
    </FieldContext.Provider>
  );
};

export default List;

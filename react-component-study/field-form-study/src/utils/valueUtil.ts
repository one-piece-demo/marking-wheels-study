/*
 * @File: valueUtil.ts
 * @Project: field-form-study
 * @Date: Thursday, 8th April 2021 2:21:57 pm
 * @Author: NARUTOne (wznaruto326@163.com/wznarutone326@gamil.com)
 * -----
 * @Last Modified: Thursday, 8th April 2021 2:22:03 pm
 * @Modified By: NARUTOne
 * -----
 * @Copyright fireLeaf © 2021 field-form-study, ***
 * @fighting: 思则行之，迟则忘之，久而久之，恒则竟之
 */

import get from './get';
import set from './set';
import toArray from './toArray';

import {
  NamePath,
  InternalNamePath,
  Store,
  StoreValue,
  KeyT,
  EventArgs,
} from '../types';

function isObject(obj: StoreValue) {
  return typeof obj === 'object' && obj !== null && Object.getPrototypeOf(obj) === Object.prototype;
}

export function getNamePath(path: NamePath | null): InternalNamePath {
  return toArray(path);
}

export function getValue(store: Store, namePath: InternalNamePath) {
  const value = get(store, namePath);
  return value;
}

export function setValue(
  store: Store,
  namePath: InternalNamePath,
  value: StoreValue,
  removeIfUndefined = false,
): Store {
  const newStore = set(store, namePath, value, removeIfUndefined);
  return newStore;
}

/**
 * Copy values into store and return a new values object
 * ({ a: 1, b: { c: 2 } }, { a: 4, b: { d: 5 } }) => { a: 4, b: { c: 2, d: 5 } }
 */
function internalSetValues<T extends KeyT>(store: T, values: T): T {
  const newStore: T = (Array.isArray(store) ? [...store] : { ...store }) as T;

  if (!values) {
    return newStore;
  }

  Object.keys(values).forEach(key => {
    const prevValue = newStore[key];
    const value = values[key];

    // If both are object (but target is not array), we use recursion to set deep value
    const recursive = isObject(prevValue) && isObject(value);
    newStore[key] = recursive ? internalSetValues(prevValue, value || {}) : value;
  });

  return newStore;
}
export function setValues<T>(store: T, ...restValues: T[]): T {
  return restValues.reduce(
    (current: T, newStore: T): T => internalSetValues<T>(current, newStore),
    store,
  );
}

// 全等匹配 namePath
export function matchNamePath(
  namePath: InternalNamePath,
  changedNamePath: InternalNamePath | null,
) {
  if (!namePath || !changedNamePath || namePath.length !== changedNamePath.length) {
    return false;
  }
  return namePath.every((nameUnit, i) => changedNamePath[i] === nameUnit);
}

// 浅拷贝
export function cloneByNamePathList(store: Store, namePathList: InternalNamePath[]): Store {
  let newStore = {};
  namePathList.forEach(namePath => {
    const value = getValue(store, namePath);
    newStore = setValue(newStore, namePath, value);
  });

  return newStore;
}

// 是否包含
export function containsNamePath(namePathList: InternalNamePath[], namePath: InternalNamePath) {
  return namePathList && namePathList.some(path => matchNamePath(path, namePath));
}

// Like `shallowEqual`, but we not check the data which may cause re-render
type SimilarObject = string | number | {[k: string]: any};
export function isSimilar(source: SimilarObject, target: SimilarObject) {
  if (source === target) {
    return true;
  }

  if ((!source && target) || (source && !target)) {
    return false;
  }

  if (!source || !target || typeof source !== 'object' || typeof target !== 'object') {
    return false;
  }

  const sourceKeys = Object.keys(source);
  const targetKeys = Object.keys(target);
  const keys = new Set([...sourceKeys, ...targetKeys]);

  return [...keys].every(key => {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (typeof sourceValue === 'function' && typeof targetValue === 'function') {
      return true;
    }
    return sourceValue === targetValue;
  });
}

// 获取event.target.value
export function defaultGetValueFromEvent(valuePropName: string, ...args: EventArgs) {
  const event = args[0];
  if (event && event.target && valuePropName in event.target) {
    return (event.target as any)[valuePropName || 'value'];
  }

  return event;
}


/**
 * Moves an array item from one position in an array to another.
 *
 * Note: This is a pure function so a new array will be returned, instead
 * of altering the array argument.
 *
 * @param array         Array in which to move an item.         (required)
 * @param moveIndex     The index of the item to move.          (required)
 * @param toIndex       The index to move item at moveIndex to. (required)
 */
export function move<T>(array: T[], moveIndex: number, toIndex: number) {
  const { length } = array;
  if (moveIndex < 0 || moveIndex >= length || toIndex < 0 || toIndex >= length) {
    return array;
  }
  const item = array[moveIndex];
  const diff = moveIndex - toIndex;

  if (diff > 0) {
    // move left
    return [
      ...array.slice(0, toIndex),
      item,
      ...array.slice(toIndex, moveIndex),
      ...array.slice(moveIndex + 1, length),
    ];
  }
  if (diff < 0) {
    // move right
    return [
      ...array.slice(0, moveIndex),
      ...array.slice(moveIndex + 1, toIndex + 1),
      item,
      ...array.slice(toIndex + 1, length),
    ];
  }
  return array;
}

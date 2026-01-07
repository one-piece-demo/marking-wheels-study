/*
 * @File: index.ts
 * @Project: field-form-study
 * @Date: Thursday, 1st April 2021 4:15:40 pm
 * @Author: NARUTOne (wznaruto326@163.com/wznarutone326@gamil.com)
 * -----
 * @Last Modified: Thursday, 1st April 2021 5:09:53 pm
 * @Modified By: NARUTOne
 * -----
 * @Copyright fireLeaf © 2021 field-form-study, ***
 * @fighting: 思则行之，迟则忘之，久而久之，恒则竟之
 */
import * as React from 'react';
import { FormInstance } from './types';
import Field from './Field';
import List from './List';
import useForm from './useForm';
import FieldForm, { FormProps } from './Form';
import { FormProvider } from './FormContext';
import FieldContext from './FieldContext';
import ListContext from './ListContext';

const InternalForm = React.forwardRef<FormInstance, FormProps>(FieldForm) as <Values = any>(
  props: React.PropsWithChildren<FormProps<Values>> & { ref?: React.Ref<FormInstance<Values>> },
) => React.ReactElement;

type InternalForm = typeof InternalForm;
interface RefForm extends InternalForm {
  FormProvider: typeof FormProvider;
  Field: typeof Field;
  List: typeof List;
  useForm: typeof useForm;
}

const RefForm: RefForm = InternalForm as RefForm;

RefForm.FormProvider = FormProvider;
RefForm.Field = Field;
RefForm.List = List;
RefForm.useForm = useForm;

export { FormInstance, Field, List, useForm, FormProvider, FormProps, FieldContext, ListContext };

export default RefForm;

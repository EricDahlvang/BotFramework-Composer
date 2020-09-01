// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { ReactNode } from 'react';
import { WidgetContainerProps, WidgetComponent } from '@bfc/extension';

import { ActionHeader } from '../ActionHeader';

import { CardTemplate } from './CardTemplate';

export interface ActionCardProps extends WidgetContainerProps {
  header?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  hideFooter?: boolean;
}

const safeRender = (input: object | React.ReactNode) => {
  if (React.isValidElement(input)) return input;
  if (typeof input === 'object') return JSON.stringify(input);
  return input;
};

export const ActionCard: WidgetComponent<ActionCardProps> = ({
  header,
  body,
  footer,
  hideFooter = false,
  ...widgetContext
}) => {
  const disabled = widgetContext.data.disabled === true;
  const headerNode = safeRender(header) || <ActionHeader {...widgetContext} />;
  const bodyNode = safeRender(body);
  const footerNode = hideFooter ? null : safeRender(footer);
  return <CardTemplate body={bodyNode} disabled={disabled} footer={footerNode} header={headerNode} />;
};

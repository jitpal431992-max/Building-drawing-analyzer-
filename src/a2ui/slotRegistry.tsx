import React, { createContext, useContext } from 'react';
import { ViewMode } from '../types';

export interface A2uiSlotRegistry {
  renderHeader: () => React.ReactNode;
  renderWorkflowView: (view: ViewMode) => React.ReactNode;
  renderGlobalModals: () => React.ReactNode;
  renderToast: () => React.ReactNode;
}

export const A2uiSlotContext = createContext<A2uiSlotRegistry | null>(null);

export function useA2uiSlots(): A2uiSlotRegistry | null {
  return useContext(A2uiSlotContext);
}

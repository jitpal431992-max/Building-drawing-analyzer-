import React, { useEffect } from 'react';
import { z } from 'zod';
import { createComponentImplementation } from '@a2ui/react';
import { Catalog } from '@a2ui/web_core';
import { CommonSchemas } from '@a2ui/web_core/v1_0';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { ViewMode } from '../types';
import { useA2uiSlots } from './slotRegistry';

export const CPWD_CATALOG_ID = 'https://cpwd-dsr.app/a2ui/catalog/v1';

// 1. WorkspaceShell: Top-level application frame rendered inside A2UI surface
const WorkspaceShellApi = {
  name: 'WorkspaceShell',
  schema: z.object({
    children: CommonSchemas.ChildList,
  }),
};

export const A2uiWorkspaceShell = createComponentImplementation(
  WorkspaceShellApi as any,
  ({ props, buildChild }: { props: { children?: string[] }; buildChild: (id: string) => React.ReactNode }) => {
    const slots = useA2uiSlots();
    const childIds = Array.isArray(props.children) ? props.children : [];

    return (
      <div className="min-h-screen bg-[#090d14] text-slate-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-slate-950">
        {slots?.renderToast()}
        {childIds.map((childId) => (
          <React.Fragment key={childId}>{buildChild(childId)}</React.Fragment>
        ))}
        {slots?.renderGlobalModals()}
      </div>
    );
  }
);

// 2. HeaderBar: Declarative A2UI host for the compact application navigation bar
const HeaderBarApi = {
  name: 'HeaderBar',
  schema: z.object({
    currentView: CommonSchemas.DynamicString,
    estimateCount: CommonSchemas.DynamicNumber,
    isConfirmed: CommonSchemas.DynamicBoolean,
  }),
};

export const A2uiHeaderBar = createComponentImplementation(
  HeaderBarApi as any,
  () => {
    const slots = useA2uiSlots();
    return <>{slots?.renderHeader()}</>;
  }
);

// 3. MainViewport: 80% desktop width engineering viewport container
const MainViewportApi = {
  name: 'MainViewport',
  schema: z.object({
    children: CommonSchemas.ChildList,
  }),
};

export const A2uiMainViewport = createComponentImplementation(
  MainViewportApi as any,
  ({ props, buildChild }: { props: { children?: string[] }; buildChild: (id: string) => React.ReactNode }) => {
    const childIds = Array.isArray(props.children) ? props.children : [];
    return (
      <main className="flex-1 w-[96%] sm:w-[92%] lg:w-[80%] mx-auto px-2 sm:px-3 py-2.5 sm:py-3">
        {childIds.map((childId) => (
          <React.Fragment key={childId}>{buildChild(childId)}</React.Fragment>
        ))}
      </main>
    );
  }
);

// 4. WorkflowViewSlot: Resolves active view from A2UI surface DataModel (@path: '/view')
const WorkflowViewSlotApi = {
  name: 'WorkflowViewSlot',
  schema: z.object({
    viewName: CommonSchemas.DynamicString,
  }),
};

export const A2uiWorkflowViewSlot = createComponentImplementation(
  WorkflowViewSlotApi as any,
  ({ props }: { props: { viewName?: string } }) => {
    const slots = useA2uiSlots();
    const activeView = (props.viewName || 'floor-plan') as ViewMode;
    return <>{slots?.renderWorkflowView(activeView)}</>;
  }
);

// 5. SectionStack: Composable vertical or horizontal layout block inside A2UI surfaces
const SectionStackApi = {
  name: 'SectionStack',
  schema: z.object({
    direction: CommonSchemas.DynamicString.optional(),
    children: CommonSchemas.ChildList,
  }),
};

export const A2uiSectionStack = createComponentImplementation(
  SectionStackApi as any,
  ({
    props,
    buildChild,
  }: {
    props: { direction?: string; children?: string[] };
    buildChild: (id: string) => React.ReactNode;
  }) => {
    const childIds = Array.isArray(props.children) ? props.children : [];
    const isRow = props.direction === 'row';
    return (
      <div className={isRow ? 'flex flex-wrap items-center gap-2' : 'flex flex-col gap-3'}>
        {childIds.map((childId) => (
          <React.Fragment key={childId}>{buildChild(childId)}</React.Fragment>
        ))}
      </div>
    );
  }
);

// 6. MetricStrip: Responsive grid container for A2UI KPI metric tiles
const MetricStripApi = {
  name: 'MetricStrip',
  schema: z.object({
    columns: CommonSchemas.DynamicNumber.optional(),
    children: CommonSchemas.ChildList,
  }),
};

export const A2uiMetricStrip = createComponentImplementation(
  MetricStripApi as any,
  ({
    props,
    buildChild,
  }: {
    props: { columns?: number; children?: string[] };
    buildChild: (id: string) => React.ReactNode;
  }) => {
    const childIds = Array.isArray(props.children) ? props.children : [];
    const cols = props.columns === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-3';
    return (
      <div className={`grid ${cols} gap-2.5`}>
        {childIds.map((childId) => (
          <React.Fragment key={childId}>{buildChild(childId)}</React.Fragment>
        ))}
      </div>
    );
  }
);

// 7. MetricTile: Tabular engineering KPI display bound via @path
const MetricTileApi = {
  name: 'MetricTile',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    value: CommonSchemas.DynamicString,
    tone: CommonSchemas.DynamicString.optional(),
  }),
};

export const A2uiMetricTile = createComponentImplementation(
  MetricTileApi as any,
  ({ props }: { props: { label?: string; value?: string; tone?: string } }) => {
    const toneClass =
      props.tone === 'danger'
        ? 'bg-rose-950/35 border-rose-500/30 text-rose-200'
        : props.tone === 'emerald'
          ? 'bg-emerald-950/35 border-emerald-500/30 text-emerald-200'
          : props.tone === 'amber'
            ? 'bg-amber-950/35 border-amber-500/30 text-amber-200'
            : 'bg-slate-950/70 border-slate-800 text-white';

    return (
      <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
        <div className="text-[11px] font-medium text-slate-400">{props.label}</div>
        <div className="text-sm sm:text-base font-bold font-mono tabular-nums mt-0.5 truncate">
          {props.value}
        </div>
      </div>
    );
  }
);

// 8. NoticeCallout: Contextual warning or compliance callout card
const NoticeCalloutApi = {
  name: 'NoticeCallout',
  schema: z.object({
    title: CommonSchemas.DynamicString,
    body: CommonSchemas.DynamicString,
    tone: CommonSchemas.DynamicString.optional(),
  }),
};

export const A2uiNoticeCallout = createComponentImplementation(
  NoticeCalloutApi as any,
  ({ props }: { props: { title?: string; body?: string; tone?: string } }) => {
    const isDanger = props.tone === 'danger';
    const isWarning = props.tone === 'warning';
    const boxStyle = isDanger
      ? 'bg-rose-950/30 border-rose-500/35 text-rose-200'
      : isWarning
        ? 'bg-amber-950/30 border-amber-500/35 text-amber-200'
        : 'bg-slate-800/70 border-slate-700 text-slate-200';

    const Icon = isDanger ? ShieldAlert : isWarning ? AlertTriangle : Info;
    const iconColor = isDanger
      ? 'text-rose-400'
      : isWarning
        ? 'text-amber-400'
        : 'text-emerald-400';

    return (
      <div className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs ${boxStyle}`}>
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
        <div className="min-w-0">
          <div className="font-semibold text-white">{props.title}</div>
          <p className="mt-0.5 leading-relaxed opacity-90">{props.body}</p>
        </div>
      </div>
    );
  }
);

// 9. ActionButton: Declarative A2UI button dispatching ActionPayload events
const ActionButtonApi = {
  name: 'ActionButton',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    variant: CommonSchemas.DynamicString.optional(),
    disabled: CommonSchemas.DynamicBoolean.optional(),
    onPress: CommonSchemas.Action,
  }),
};

export const A2uiActionButton = createComponentImplementation(
  ActionButtonApi as any,
  ({
    props,
  }: {
    props: { label?: string; variant?: string; disabled?: boolean; onPress?: () => void };
  }) => {
    const variantClass =
      props.variant === 'danger'
        ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/40'
        : props.variant === 'primary'
          ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/40'
          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700';

    return (
      <button
        type="button"
        disabled={Boolean(props.disabled)}
        onClick={() => props.onPress?.()}
        className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${variantClass}`}
      >
        <span>{props.label}</span>
      </button>
    );
  }
);

// 10. ConfirmDialog: Modal dialog surface driven by A2UI MessageProcessor & Actions
const ConfirmDialogApi = {
  name: 'ConfirmDialog',
  schema: z.object({
    title: CommonSchemas.DynamicString,
    subtitle: CommonSchemas.DynamicString,
    message: CommonSchemas.DynamicString,
    tone: CommonSchemas.DynamicString.optional(),
    confirmLabel: CommonSchemas.DynamicString,
    cancelLabel: CommonSchemas.DynamicString,
    children: CommonSchemas.ChildList.optional(),
    onConfirm: CommonSchemas.Action,
    onCancel: CommonSchemas.Action,
  }),
};

export const A2uiConfirmDialog = createComponentImplementation(
  ConfirmDialogApi as any,
  ({
    props,
    buildChild,
  }: {
    props: {
      title?: string;
      subtitle?: string;
      message?: string;
      tone?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      children?: string[];
      onConfirm?: () => void;
      onCancel?: () => void;
    };
    buildChild: (id: string) => React.ReactNode;
  }) => {
    const isDanger = props.tone !== 'emerald';
    const childIds = Array.isArray(props.children) ? props.children : [];

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          props.onCancel?.();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [props.onCancel]);

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm no-print"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            props.onCancel?.();
          }
        }}
      >
        <div
          className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl text-slate-100 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="a2ui-confirm-dialog-title"
        >
          <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/70">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                  isDanger
                    ? 'bg-rose-500/10 border-rose-500/35 text-rose-400'
                    : 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400'
                }`}
              >
                {isDanger ? (
                  <AlertTriangle className="w-4.5 h-4.5" />
                ) : (
                  <CheckCircle2 className="w-4.5 h-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <h3
                  id="a2ui-confirm-dialog-title"
                  className="text-sm sm:text-base font-bold text-white truncate"
                >
                  {props.title}
                </h3>
                {props.subtitle && (
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {props.subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => props.onCancel?.()}
              aria-label="Close confirmation dialog"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3.5 text-xs">
            {props.message && (
              <p className="text-slate-300 leading-relaxed text-[13px]">{props.message}</p>
            )}

            {childIds.map((childId) => (
              <React.Fragment key={childId}>{buildChild(childId)}</React.Fragment>
            ))}
          </div>

          <div className="px-4 py-3 sm:px-5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => props.onCancel?.()}
              className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {props.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => props.onConfirm?.()}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-500 border-rose-400/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40'
              }`}
            >
              {props.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export const cpwdCatalog = new Catalog(
  CPWD_CATALOG_ID,
  '1.0',
  [
    A2uiWorkspaceShell,
    A2uiHeaderBar,
    A2uiMainViewport,
    A2uiWorkflowViewSlot,
    A2uiSectionStack,
    A2uiMetricStrip,
    A2uiMetricTile,
    A2uiNoticeCallout,
    A2uiActionButton,
    A2uiConfirmDialog,
  ] as any,
  []
);

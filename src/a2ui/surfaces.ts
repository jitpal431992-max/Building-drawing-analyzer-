import type { ProcessableMessage } from '@a2ui/web_core';
import { CPWD_CATALOG_ID } from './cpwdCatalog';
import { ViewMode } from '../types';

export const WORKSPACE_SURFACE_ID = 'workspace-shell';
export const CONFIRM_DIALOG_SURFACE_ID = 'confirm-dialog';

export interface WorkspaceDataSnapshot {
  view: ViewMode;
  estimateCount: number;
  inventoryCount: number;
  isConfirmed: boolean;
}

export interface ConfirmDialogMetric {
  label: string;
  value: string;
  tone?: 'default' | 'danger' | 'emerald' | 'amber';
}

export interface ConfirmDialogSpec {
  actionId: string;
  title: string;
  subtitle: string;
  message: string;
  tone?: 'danger' | 'emerald';
  confirmLabel: string;
  cancelLabel?: string;
  noticeTitle?: string;
  noticeBody?: string;
  noticeTone?: 'danger' | 'warning' | 'info';
  metrics?: ConfirmDialogMetric[];
}

export function buildWorkspaceShellMessages(
  initialData: WorkspaceDataSnapshot
): ProcessableMessage[] {
  return [
    {
      version: '1.0',
      createSurface: {
        surfaceId: WORKSPACE_SURFACE_ID,
        catalogId: CPWD_CATALOG_ID,
      },
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: WORKSPACE_SURFACE_ID,
        components: [
          {
            id: 'root',
            component: 'WorkspaceShell',
            children: ['header-bar', 'main-viewport'],
          },
          {
            id: 'header-bar',
            component: 'HeaderBar',
            currentView: { '@path': '/view' },
            estimateCount: { '@path': '/estimateCount' },
            isConfirmed: { '@path': '/isConfirmed' },
          },
          {
            id: 'main-viewport',
            component: 'MainViewport',
            children: ['workflow-slot'],
          },
          {
            id: 'workflow-slot',
            component: 'WorkflowViewSlot',
            viewName: { '@path': '/view' },
          },
        ],
      },
    },
    {
      version: '1.0',
      updateDataModel: {
        surfaceId: WORKSPACE_SURFACE_ID,
        path: '/',
        value: {
          view: initialData.view,
          estimateCount: initialData.estimateCount,
          inventoryCount: initialData.inventoryCount,
          isConfirmed: initialData.isConfirmed,
        },
      },
    },
  ];
}

export function buildWorkspaceDataUpdateMessage(
  data: WorkspaceDataSnapshot
): ProcessableMessage[] {
  return [
    {
      version: '1.0',
      updateDataModel: {
        surfaceId: WORKSPACE_SURFACE_ID,
        path: '/',
        value: {
          view: data.view,
          estimateCount: data.estimateCount,
          inventoryCount: data.inventoryCount,
          isConfirmed: data.isConfirmed,
        },
      },
    },
  ];
}

export function buildConfirmDialogMessages(spec: ConfirmDialogSpec): ProcessableMessage[] {
  const metrics = spec.metrics || [];
  const childIds: string[] = [];
  const extraComponents: Record<string, any>[] = [];

  if (metrics.length > 0) {
    const metricIds = metrics.map((_, idx) => `confirm-metric-${idx}`);
    childIds.push('confirm-metrics-strip');
    extraComponents.push({
      id: 'confirm-metrics-strip',
      component: 'MetricStrip',
      columns: metrics.length <= 2 ? 2 : 3,
      children: metricIds,
    });

    metrics.forEach((_, idx) => {
      extraComponents.push({
        id: `confirm-metric-${idx}`,
        component: 'MetricTile',
        label: { '@path': `/metrics/${idx}/label` },
        value: { '@path': `/metrics/${idx}/value` },
        tone: { '@path': `/metrics/${idx}/tone` },
      });
    });
  }

  if (spec.noticeTitle && spec.noticeBody) {
    childIds.push('confirm-notice');
    extraComponents.push({
      id: 'confirm-notice',
      component: 'NoticeCallout',
      title: { '@path': '/notice/title' },
      body: { '@path': '/notice/body' },
      tone: { '@path': '/notice/tone' },
    });
  }

  return [
    {
      version: '1.0',
      createSurface: {
        surfaceId: CONFIRM_DIALOG_SURFACE_ID,
        catalogId: CPWD_CATALOG_ID,
      },
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: CONFIRM_DIALOG_SURFACE_ID,
        components: [
          {
            id: 'root',
            component: 'ConfirmDialog',
            title: { '@path': '/title' },
            subtitle: { '@path': '/subtitle' },
            message: { '@path': '/message' },
            tone: { '@path': '/tone' },
            confirmLabel: { '@path': '/confirmLabel' },
            cancelLabel: { '@path': '/cancelLabel' },
            children: childIds,
            onConfirm: {
              event: {
                name: 'confirm_dialog_accept',
                context: {
                  actionId: { '@path': '/actionId' },
                },
              },
            },
            onCancel: {
              event: {
                name: 'confirm_dialog_cancel',
                context: {
                  actionId: { '@path': '/actionId' },
                },
              },
            },
          },
          ...extraComponents,
        ],
      },
    },
    {
      version: '1.0',
      updateDataModel: {
        surfaceId: CONFIRM_DIALOG_SURFACE_ID,
        path: '/',
        value: {
          actionId: spec.actionId,
          title: spec.title,
          subtitle: spec.subtitle,
          message: spec.message,
          tone: spec.tone || 'danger',
          confirmLabel: spec.confirmLabel,
          cancelLabel: spec.cancelLabel || 'Cancel',
          metrics: metrics.map((m) => ({
            label: m.label,
            value: m.value,
            tone: m.tone || 'default',
          })),
          notice: {
            title: spec.noticeTitle || '',
            body: spec.noticeBody || '',
            tone: spec.noticeTone || 'warning',
          },
        },
      },
    },
  ];
}

export function buildDeleteConfirmDialogMessage(): ProcessableMessage[] {
  return [
    {
      version: '1.0',
      deleteSurface: {
        surfaceId: CONFIRM_DIALOG_SURFACE_ID,
      },
    },
  ];
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionPayload, MessageProcessor, SurfaceModel } from '@a2ui/web_core';
import type { ReactCatalogComponent } from '@a2ui/react';
import { cpwdCatalog } from './cpwdCatalog';
import {
  CONFIRM_DIALOG_SURFACE_ID,
  ConfirmDialogSpec,
  WorkspaceDataSnapshot,
  buildConfirmDialogMessages,
  buildDeleteConfirmDialogMessage,
  buildWorkspaceDataUpdateMessage,
  buildWorkspaceShellMessages,
} from './surfaces';

export function useA2uiAppRuntime(initialWorkspaceData: WorkspaceDataSnapshot) {
  const pendingConfirmCallbackRef = useRef<(() => void) | null>(null);
  const processorRef = useRef<MessageProcessor<any> | null>(null);

  const closeConfirmDialog = useCallback(() => {
    pendingConfirmCallbackRef.current = null;
    const proc = processorRef.current;
    if (proc && proc.getSurface(CONFIRM_DIALOG_SURFACE_ID)) {
      proc.processMessages(buildDeleteConfirmDialogMessage());
    }
  }, []);

  if (!processorRef.current) {
    const processor = new MessageProcessor(
      [cpwdCatalog as any],
      (action: ActionPayload) => {
        if (action.name === 'confirm_dialog_accept') {
          const cb = pendingConfirmCallbackRef.current;
          pendingConfirmCallbackRef.current = null;
          if (processor.getSurface(CONFIRM_DIALOG_SURFACE_ID)) {
            processor.processMessages(buildDeleteConfirmDialogMessage());
          }
          cb?.();
        } else if (action.name === 'confirm_dialog_cancel') {
          pendingConfirmCallbackRef.current = null;
          if (processor.getSurface(CONFIRM_DIALOG_SURFACE_ID)) {
            processor.processMessages(buildDeleteConfirmDialogMessage());
          }
        }
      }
    );
    processor.processMessages(buildWorkspaceShellMessages(initialWorkspaceData));
    processorRef.current = processor;
  }

  const processor = processorRef.current;

  const [surfaces, setSurfaces] = useState<SurfaceModel<ReactCatalogComponent>[]>(() =>
    Array.from(processor.model.surfacesMap.values()) as unknown as SurfaceModel<ReactCatalogComponent>[]
  );

  useEffect(() => {
    const syncSurfaces = () => {
      setSurfaces(
        Array.from(
          processor.model.surfacesMap.values()
        ) as unknown as SurfaceModel<ReactCatalogComponent>[]
      );
    };

    const createdSub = processor.onSurfaceCreated(syncSurfaces);
    const deletedSub = processor.onSurfaceDeleted(syncSurfaces);

    return () => {
      createdSub.unsubscribe();
      deletedSub.unsubscribe();
    };
  }, [processor]);

  const syncWorkspace = useCallback(
    (snapshot: WorkspaceDataSnapshot) => {
      processor.processMessages(buildWorkspaceDataUpdateMessage(snapshot));
    },
    [processor]
  );

  const openConfirmDialog = useCallback(
    (spec: ConfirmDialogSpec, onConfirm: () => void) => {
      if (processor.getSurface(CONFIRM_DIALOG_SURFACE_ID)) {
        processor.processMessages(buildDeleteConfirmDialogMessage());
      }
      pendingConfirmCallbackRef.current = onConfirm;
      processor.processMessages(buildConfirmDialogMessages(spec));
    },
    [processor]
  );

  return {
    processor,
    surfaces,
    syncWorkspace,
    openConfirmDialog,
    closeConfirmDialog,
  };
}

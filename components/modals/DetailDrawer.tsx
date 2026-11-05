'use client';

import { useStore } from '@/lib/store';
import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';

const JobWorkspace = dynamic(() => import('@/components/JobWorkspace'), {
  loading: () => <WorkspaceLoading />,
});

function WorkspaceLoading() {
  const { dispatch, darkMode } = useStore();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  const close = () => void dispatch({ type: 'CLOSE_DETAIL' });
  return (
    <>
      <button className="job-workspace-backdrop" aria-label="Close job workspace" onClick={close} />
      <section
        className="job-workspace"
        data-theme={darkMode ? 'dark' : 'light'}
        role="dialog"
        aria-modal="true"
        aria-label="Loading job workspace"
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
          if (event.key === 'Tab') {
            event.preventDefault();
            closeButton.current?.focus();
          }
        }}
      >
        <header className="job-workspace-header">
          <p role="status">Loading job workspace…</p>
          <button ref={closeButton} onClick={close}>
            Close workspace
          </button>
        </header>
      </section>
    </>
  );
}

export default function DetailDrawer() {
  const { selectedApp, showDetailDrawer, detailSection } = useStore();
  return showDetailDrawer && selectedApp ? (
    <JobWorkspace key={selectedApp.id} application={selectedApp} initialSection={detailSection} />
  ) : null;
}

'use client';

import { useStore } from '@/lib/store';
import JobWorkspace from '@/components/JobWorkspace';

export default function DetailDrawer() {
  const { selectedApp, showDetailDrawer } = useStore();
  return showDetailDrawer && selectedApp ? <JobWorkspace key={selectedApp.id} application={selectedApp} /> : null;
}

import { createContext, useContext, type ReactNode } from 'react';

/**
 * True only inside the signed-in workspace (never on auth / onboarding
 * screens), so ambient motion can't bleed into the login flow.
 */
const WorkspaceMotionContext = createContext(false);

export function WorkspaceMotionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <WorkspaceMotionContext.Provider value={enabled}>{children}</WorkspaceMotionContext.Provider>;
}

export function useWorkspaceMotion(): boolean {
  return useContext(WorkspaceMotionContext);
}

import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

// Root wrapper for designs built with the client-app components:
// - MemoryRouter: TopBar / BottomNav use react-router hooks and NavLink.
// - #sheet-root: BottomSheet (and the sheets built on it) portal into it, as in index.html.
// Children mount after #sheet-root exists, because BottomSheet looks it up during render.
export function DsProvider({ children, initialPath = '/' }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      {ready ? children : null}
      <div id="sheet-root" />
    </MemoryRouter>
  );
}

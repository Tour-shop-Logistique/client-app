import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { openAuthSheet } from '../store/slices/uiSlice';

// The action a guest was trying to run when the auth sheet opened. Kept at
// module scope (not in Redux, not in a component ref) so it survives across the
// caller component and the AuthSheet, which are mounted in different subtrees.
let pendingAction = null;

export const flushPendingAuthAction = () => {
  const cb = pendingAction;
  pendingAction = null;
  if (typeof cb === 'function') cb();
};

export const clearPendingAuthAction = () => {
  pendingAction = null;
};

/**
 * Gate for "major actions" (validating an expedition / a marketplace order)
 * per cahier 4.1: guests can fill the whole flow, auth is only enforced at the
 * final confirm tap. Call `requireAuth(callback, reason)` from that handler; it
 * runs immediately if already authenticated, otherwise opens the auth sheet and
 * re-runs the callback once the user signs in.
 */
export default function useRequireAuth() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const requireAuth = useCallback((callback, reason) => {
    if (isAuthenticated) {
      callback();
      return;
    }
    pendingAction = callback;
    dispatch(openAuthSheet({ reason, mode: 'login' }));
  }, [isAuthenticated, dispatch]);

  return { requireAuth, isAuthenticated };
}

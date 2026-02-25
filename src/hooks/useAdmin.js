import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { unlock, lock, incrementAttempts, resetLockout, selectIsAdmin, selectAdminExpiry, selectIsLockedOut, selectLockoutExpiry } from '../store/adminSlice';
import { toast } from '../store/toastSlice';
import { checkPassword } from '../utils/helpers';

export function useAdmin() {
  const dispatch = useDispatch();
  const isAdmin = useSelector(selectIsAdmin);
  const expiry = useSelector(selectAdminExpiry);
  const isLockedOut = useSelector(selectIsLockedOut);
  const lockoutExpiry = useSelector(selectLockoutExpiry);
  const failedAttempts = useSelector(s => s.admin.failedAttempts);
  const [, setTick] = useState(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (!isAdmin && !isLockedOut) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isAdmin, isLockedOut]);

  useEffect(() => {
    if (isAdmin && expiry <= 0) {
      dispatch(lock());
      dispatch(toast('Admin session expired.', 'warning'));
    }
  }, [isAdmin, expiry, dispatch]);

  useEffect(() => {
    if (!isLockedOut && lockoutExpiry <= 0 && failedAttempts >= 3) {
      dispatch(resetLockout());
    }
  }, [isLockedOut, lockoutExpiry, failedAttempts, dispatch]);

  const formatTime = (ms) => {
    const secs = Math.ceil(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const countdown = isAdmin ? formatTime(expiry) : null;
  const lockoutCountdown = isLockedOut ? formatTime(lockoutExpiry) : null;

  const tryUnlock = useCallback(() => {
    if (isLockedOut) {
      dispatch(toast('Too many failed attempts. Try again later.', 'error'));
      return;
    }
    setShowPasswordModal(true);
  }, [dispatch, isLockedOut]);

  const handlePasswordSubmit = useCallback(async (pw) => {
    setShowPasswordModal(false);
    if (!pw) return;
    if (!(await checkPassword(pw))) {
      dispatch(incrementAttempts());
      const remaining = 2 - failedAttempts;
      if (remaining > 0) {
        dispatch(toast(`Wrong password. ${remaining} attempt(s) left.`, 'error'));
      } else {
        dispatch(toast('Too many failed attempts. Locked out for 5 minutes.', 'error'));
      }
      return;
    }
    dispatch(unlock());
    dispatch(toast('Admin unlocked for 5 minutes.'));
  }, [dispatch, failedAttempts]);

  const handlePasswordClose = useCallback(() => {
    setShowPasswordModal(false);
  }, []);

  const doLock = useCallback(() => {
    dispatch(lock());
    dispatch(toast('Admin locked.'));
  }, [dispatch]);

  const requireAdmin = useCallback((action) => {
    if (isAdmin) {
      action();
    } else {
      dispatch(toast('Unlock admin first.', 'error'));
    }
  }, [isAdmin, dispatch]);

  return {
    isAdmin, countdown, tryUnlock, doLock, requireAdmin,
    isLockedOut, lockoutCountdown,
    showPasswordModal, handlePasswordSubmit, handlePasswordClose,
  };
}

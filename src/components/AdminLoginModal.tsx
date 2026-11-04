import React, { useState } from 'react';
import { AlertCircle, Coffee, KeyRound, X } from 'lucide-react';
import { authenticateAdminPassword } from '../utils/adminAuth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (!authenticateAdminPassword(password)) {
        setError('Incorrect password. Please try again.');
        return;
      }
      setError(null);
      onSuccess();
    } catch (storageError) {
      console.error('Could not verify the local admin password:', storageError);
      setError('Browser storage is unavailable. Enable local storage and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <Coffee className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">Administrator access</h2>
              <p className="text-xs text-slate-400">Enter your local admin password</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-300">
            Password
            <div className="relative mt-1.5">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-amber-500"
                placeholder="Enter password"
              />
            </div>
          </label>

          {error && (
            <p role="alert" className="flex items-center gap-2 text-xs font-medium text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button type="submit" className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-500">
            Sign in
          </button>
        </form>

        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          This password check is stored in this browser and is not server-side security.
        </p>
      </div>
    </div>
  );
};

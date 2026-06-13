'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Github } from 'lucide-react';
import { handleRequest, signInWithOAuth } from '@/utils/auth-helpers/client';
import {
  signInWithPassword,
  signInWithEmail,
  signUp,
  requestPasswordUpdate,
  updatePassword
} from '@/utils/auth-helpers/server';

// Source: shadcn registry @reactbits-pro/auth-2. Adapted to wire into our
// Supabase auth-helper server actions and to render all five auth views.

export type AuthView =
  | 'password_signin'
  | 'email_signin'
  | 'signup'
  | 'forgot_password'
  | 'update_password';

interface Auth2Props {
  view: AuthView;
  allowOauth: boolean;
  allowEmail: boolean;
  allowPassword: boolean;
  redirectMethod: string;
  disableButton?: boolean;
}

const TITLES: Record<AuthView, string> = {
  password_signin: 'Sign in',
  email_signin: 'Sign in',
  signup: 'Create account',
  forgot_password: 'Reset password',
  update_password: 'Update password'
};

const SUBMIT_LABELS: Record<AuthView, string> = {
  password_signin: 'Sign in',
  email_signin: 'Send magic link',
  signup: 'Create account',
  forgot_password: 'Send reset link',
  update_password: 'Update password'
};

const ACTIONS = {
  password_signin: signInWithPassword,
  email_signin: signInWithEmail,
  signup: signUp,
  forgot_password: requestPasswordUpdate,
  update_password: updatePassword
} as const;

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-600 transition-all';

const oauthButtonClass =
  'w-full px-6 py-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-60';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.24 1.3-.97 2.4-2.07 3.13l3.34 2.59c1.94-1.79 3.06-4.43 3.06-7.56 0-.73-.07-1.43-.19-2.1H12z"
    />
    <path
      fill="#34A853"
      d="M5.5 14.27 4.76 14.84 2.13 16.9c1.66 3.3 5.07 5.6 9.07 5.6 2.74 0 5.03-.9 6.7-2.45l-3.34-2.59c-.92.62-2.1.99-3.36.99-2.59 0-4.79-1.75-5.58-4.11z"
    />
    <path
      fill="#FBBC05"
      d="M2.13 7.1c-.67 1.32-1.05 2.81-1.05 4.4 0 1.59.38 3.08 1.05 4.4 0 .01 3.37-2.61 3.37-2.61-.16-.49-.26-1.01-.26-1.79s.1-1.3.26-1.79L2.13 7.1z"
    />
    <path
      fill="#4285F4"
      d="M12 5.38c1.46 0 2.78.5 3.81 1.49l2.86-2.86C16.97 2.39 14.69 1.5 12 1.5 8 1.5 4.59 3.8 2.13 7.1l3.37 2.61C6.29 7.35 8.49 5.38 12 5.38z"
    />
  </svg>
);

function OAuthRow({ disabled }: { disabled: boolean }) {
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    await signInWithOAuth(e);
  };
  return (
    <div className="space-y-3 mb-6">
      <form onSubmit={onSubmit}>
        <input type="hidden" name="provider" value="google" />
        <motion.button
          type="submit"
          disabled={disabled}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className={oauthButtonClass}
        >
          <GoogleIcon />
          Continue with Google
        </motion.button>
      </form>
      <form onSubmit={onSubmit}>
        <input type="hidden" name="provider" value="github" />
        <motion.button
          type="submit"
          disabled={disabled}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className={oauthButtonClass}
        >
          <Github className="w-5 h-5" />
          Continue with GitHub
        </motion.button>
      </form>
    </div>
  );
}

function FooterLinks({ view, allowEmail }: { view: AuthView; allowEmail: boolean }) {
  const linkClass =
    'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors no-underline';
  if (view === 'update_password') return null;
  return (
    <div className="mt-6 space-y-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
      {view === 'password_signin' && (
        <Link href="/signin/forgot_password" className={`block ${linkClass}`}>
          Forgot password?
        </Link>
      )}
      {view !== 'password_signin' && view !== 'signup' && (
        <Link href="/signin/password_signin" className={`block ${linkClass}`}>
          Sign in with password
        </Link>
      )}
      {allowEmail && view !== 'email_signin' && (
        <Link href="/signin/email_signin" className={`block ${linkClass}`}>
          Sign in with magic link
        </Link>
      )}
      {view !== 'signup' && (
        <p>
          No account?{' '}
          <Link href="/signin/signup" className={linkClass}>
            Sign up
          </Link>
        </p>
      )}
      {view === 'signup' && (
        <p>
          Already have an account?{' '}
          <Link href="/signin/password_signin" className={linkClass}>
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}


export function Auth2({
  view,
  allowOauth,
  allowEmail,
  allowPassword,
  redirectMethod,
  disableButton
}: Auth2Props) {
  const router = redirectMethod === 'client' ? useRouter() : null;
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showOAuth = allowOauth && (view === 'password_signin' || view === 'email_signin');
  const showPasswordField =
    view === 'password_signin' || view === 'signup' || view === 'update_password';
  const showConfirmField = view === 'update_password';
  const showEmailField = view !== 'update_password';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true);
    await handleRequest(e, ACTIONS[view], router);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen w-full flex bg-white dark:bg-neutral-950">
      {/* Left column — brand panel, hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full rounded-2xl p-12 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Millionaire Mindshift</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="text-4xl font-bold text-white leading-tight">
              Welcome back.
              <br />
              Let&apos;s keep building.
            </h2>
            <p className="mt-4 text-white/80 max-w-sm">
              Access your dashboard, track conversions, and manage your funnel — all in
              one place.
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Right column — form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white mb-2">
            {TITLES[view]}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">
            {view === 'signup'
              ? 'Start your journey in seconds.'
              : view === 'forgot_password'
                ? 'Enter your email and we will send a reset link.'
                : view === 'update_password'
                  ? 'Choose a new password for your account.'
                  : 'Welcome back, please sign in to continue.'}
          </p>

          {showOAuth && <OAuthRow disabled={isSubmitting} />}

          {showOAuth && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
              <span className="text-sm text-neutral-500">or</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
            </motion.div>
          )}

          <motion.form
            noValidate
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.45 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {showEmailField && (
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Email"
                autoComplete="email"
                required
                className={inputClass}
              />
            )}
            {showPasswordField && (
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={view === 'update_password' ? 'New password' : 'Password'}
                  autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                  required
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            )}
            {showConfirmField && (
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                className={inputClass}
              />
            )}
            <button
              type="submit"
              disabled={isSubmitting || disableButton}
              className="w-full px-6 py-3 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Please wait…' : SUBMIT_LABELS[view]}
            </button>
          </motion.form>

          <FooterLinks view={view} allowEmail={allowEmail} />
        </motion.div>
      </div>
    </div>
  );
}

export default Auth2;

'use client';

import Button from '@/components/ui/Button';
import { signInWithOAuth } from '@/utils/auth-helpers/client';
import { type Provider } from '@supabase/supabase-js';
import { Github } from 'lucide-react';
import { useState } from 'react';

type OAuthProviders = {
  name: Provider;
  displayName: string;
  icon: JSX.Element;
};

// Inline G mark — lucide-react doesn't ship a Google logo (Google trademark).
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.3-.97 2.4-2.07 3.13l3.34 2.59c1.94-1.79 3.06-4.43 3.06-7.56 0-.73-.07-1.43-.19-2.1H12z" />
    <path fill="#34A853" d="M5.5 14.27 4.76 14.84 2.13 16.9c1.66 3.3 5.07 5.6 9.07 5.6 2.74 0 5.03-.9 6.7-2.45l-3.34-2.59c-.92.62-2.1.99-3.36.99-2.59 0-4.79-1.75-5.58-4.11z" />
    <path fill="#FBBC05" d="M2.13 7.1c-.67 1.32-1.05 2.81-1.05 4.4 0 1.59.38 3.08 1.05 4.4 0 .01 3.37-2.61 3.37-2.61-.16-.49-.26-1.01-.26-1.79s.1-1.3.26-1.79L2.13 7.1z" />
    <path fill="#4285F4" d="M12 5.38c1.46 0 2.78.5 3.81 1.49l2.86-2.86C16.97 2.39 14.69 1.5 12 1.5 8 1.5 4.59 3.8 2.13 7.1l3.37 2.61C6.29 7.35 8.49 5.38 12 5.38z" />
  </svg>
);

export default function OauthSignIn() {
  const oAuthProviders: OAuthProviders[] = [
    {
      name: 'google',
      displayName: 'Google',
      icon: <GoogleIcon />
    },
    {
      name: 'github',
      displayName: 'GitHub',
      icon: <Github className="h-5 w-5" />
    }
    /* Add desired OAuth providers here */
  ];
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true); // Disable the button while the request is being handled
    await signInWithOAuth(e);
    setIsSubmitting(false);
  };

  return (
    <div className="mt-8">
      {oAuthProviders.map((provider) => (
        <form
          key={provider.name}
          className="pb-2"
          onSubmit={(e) => handleSubmit(e)}
        >
          <input type="hidden" name="provider" value={provider.name} />
          <Button
            variant="slim"
            type="submit"
            className="w-full"
            loading={isSubmitting}
          >
            <span className="mr-2">{provider.icon}</span>
            <span>{provider.displayName}</span>
          </Button>
        </form>
      ))}
    </div>
  );
}

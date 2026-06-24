'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { updateUserPassword } from '@/app/update-password/actions';
import SubmitButton from '@/components/SubmitButton';

export function UpdatePasswordForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={updateUserPassword} className="flex flex-col gap-4">
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="New Password"
          required
          className="w-full rounded-lg border border-gray-300 p-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          name="confirmPassword"
          placeholder="Confirm Password"
          required
          className="w-full rounded-lg border border-gray-300 p-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      <SubmitButton
        pendingLabel="Saving…"
        className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary"
      >
        Save and Continue
      </SubmitButton>
    </form>
  );
}
'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { login } from '@/app/login/actions';
import Link from 'next/link';

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={login} className="flex flex-col gap-4">
      <input
        type="email"
        name="email"
        placeholder="Email"
        required
        className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
      />
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          placeholder="Password"
          required
          className="w-full rounded-lg border border-gray-300 p-3 pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      <button
        type="submit"
        className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary"
      >
        Submit
      </button>
      <div className="text-center mt-2">
        <Link href="/forgot-password" className="text-sm text-primary hover:text-secondary font-medium transition-colors duration-200">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { acceptDirectorInvite } from '@/app/director-invite/acceptDirectorInvite';

interface Props {
  token: string;
  email: string;
  clubName: string;
}

export default function DirectorInviteForm({ token, email, clubName }: Props) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    companyName: '',
    title: '',
    bio: '',
    coreSkills: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await acceptDirectorInvite({ token, ...formData });
    setIsSubmitting(false);

    if (result.success) {
      setDone(true);
    } else {
      setError(result.message || 'Failed to accept invite.');
    }
  };

  if (done) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Check your email</h2>
        <div className="border-t-4 border-primary w-16 mx-auto mb-4" />
        <p className="text-base leading-relaxed text-gray-900">
          We&apos;ve sent a link to <strong>{email}</strong> to set your password. Click it and
          you&apos;ll land in the {clubName} dashboard as Club Director.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-100 shadow-card p-8 space-y-5"
    >
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
        <input
          type="email"
          readOnly
          value={email}
          className="w-full rounded-lg border border-gray-300 p-3 text-gray-700 bg-slate-50"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">First Name</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Last Name</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Phone</label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          required
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Company Name</label>
          <input
            type="text"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Bio</label>
        <textarea
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 p-3 h-28 resize-none text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          maxLength={300}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Core Skills <span className="text-gray-500 font-normal">(comma separated)</span>
        </label>
        <input
          type="text"
          name="coreSkills"
          value={formData.coreSkills}
          onChange={handleChange}
          className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          required
        />
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50"
      >
        {isSubmitting ? 'Activating...' : 'Activate My Account'}
      </button>
    </form>
  );
}

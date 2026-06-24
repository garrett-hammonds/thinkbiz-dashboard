'use client';

import { useState } from 'react';
import { submitVisitorAction } from './submitVisitor';

export function VisitorCheckInForm({
  clubId,
  clubName,
}: {
  clubId: string;
  clubName: string;
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    title: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.firstName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!formData.email.trim() && !formData.phone.trim()) {
      setError('Please add an email or phone number so the club can reach you.');
      return;
    }

    setIsSubmitting(true);
    const result = await submitVisitorAction({ clubId, ...formData });
    setIsSubmitting(false);

    if (result.success) {
      setDone(true);
    } else {
      setError(result.message || 'Something went wrong. Please try again.');
    }
  };

  if (done) {
    return (
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold leading-snug text-foreground mb-4">
          Thanks for visiting!
        </h2>
        <div className="border-t-4 border-primary w-16 mx-auto mb-4"></div>
        <p className="text-base leading-relaxed text-gray-900">
          We&apos;ve shared your details with {clubName}. Someone will be in
          touch — enjoy the meeting!
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center mb-2">
        <h1 className="text-3xl font-bold leading-snug text-foreground">
          Welcome to {clubName}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-gray-500">
          Share your details so we can connect after the meeting.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">First Name</label>
        <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className={inputClass} required />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Last Name</label>
        <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Phone</label>
        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Company <span className="text-gray-500 font-normal">(optional)</span></label>
        <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Title <span className="text-gray-500 font-normal">(optional)</span></label>
        <input type="text" name="title" value={formData.title} onChange={handleChange} className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Anything you&apos;re looking for? <span className="text-gray-500 font-normal">(optional)</span></label>
        <textarea name="notes" value={formData.notes} onChange={handleChange} className={`${inputClass} h-24 resize-none`} maxLength={500} />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600" role="alert">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting…' : 'Check in'}
      </button>
      <p className="text-xs text-center text-gray-500">
        We&apos;ll only use your details to follow up about ThinkBiz.
      </p>
    </form>
  );
}

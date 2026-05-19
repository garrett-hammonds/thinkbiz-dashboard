'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import imageCompression from 'browser-image-compression';
import { createClient } from '@/utils/supabase/client';
import { completeOnboarding } from '@/app/actions/completeOnboarding';

interface MemberRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  company_name: string | null;
  title: string | null;
  bio: string | null;
  short_bio: string | null;
  core_skills: string[] | null;
  website_url: string | null;
  linkedin_url: string | null;
  booking_calendar_url: string | null;
  member_headshot: string | null;
}

interface Props {
  member: MemberRow;
  clubName: string;
}

export default function OnboardingForm({ member, clubName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(member.member_headshot || '');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: uploadError } = await supabase.storage
        .from('Member Images')
        .upload(`${user.id}/headshot.webp`, compressedFile, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('Member Images')
        .getPublicUrl(`${user.id}/headshot.webp`);

      setPreviewUrl(`${publicUrl}?t=${Date.now()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image.';
      setError(msg);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set('member_headshot', previewUrl);

    startTransition(async () => {
      const result = await completeOnboarding(formData);
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.message || 'Failed to save profile.');
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-100 shadow-card p-8 space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="block text-gray-500 font-medium mb-1">Email</span>
          <span className="text-gray-900">{member.email}</span>
        </div>
        <div>
          <span className="block text-gray-500 font-medium mb-1">Club</span>
          <span className="text-gray-900">{clubName}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="First Name" name="first_name" defaultValue={member.first_name ?? ''} required />
        <Field label="Last Name" name="last_name" defaultValue={member.last_name ?? ''} required />
      </div>

      <Field
        label="Phone Number"
        name="phone_number"
        type="tel"
        defaultValue={member.phone_number ?? ''}
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Company Name" name="company_name" defaultValue={member.company_name ?? ''} required />
        <Field label="Title" name="title" defaultValue={member.title ?? ''} required />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Bio</label>
        <textarea
          name="bio"
          defaultValue={member.bio ?? ''}
          required
          className="w-full rounded-lg border border-gray-300 p-3 h-32 resize-y text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Short Bio <span className="text-gray-500 font-normal">(one sentence, optional)</span>
        </label>
        <input
          type="text"
          name="short_bio"
          defaultValue={member.short_bio ?? ''}
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Core Skills <span className="text-gray-500 font-normal">(comma separated)</span>
        </label>
        <input
          type="text"
          name="core_skills"
          defaultValue={member.core_skills?.join(', ') ?? ''}
          required
          className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Headshot <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        {previewUrl && (
          <img src={previewUrl} alt="Headshot preview" className="w-24 h-24 rounded-full object-cover mb-3" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary cursor-pointer"
        />
        {uploadingImage && <p className="text-sm text-gray-500 mt-2">Uploading image...</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label="Website URL"
          name="website_url"
          type="url"
          defaultValue={member.website_url ?? ''}
          placeholder="https://example.com"
        />
        <Field
          label="LinkedIn URL"
          name="linkedin_url"
          type="url"
          defaultValue={member.linkedin_url ?? ''}
          placeholder="https://linkedin.com/in/..."
        />
      </div>

      <Field
        label="Booking Calendar URL"
        name="booking_calendar_url"
        type="url"
        defaultValue={member.booking_calendar_url ?? ''}
        placeholder="https://calendly.com/..."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || uploadingImage}
        className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50"
      >
        {isPending ? 'Saving...' : 'Finish Setup & Go to Dashboard'}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        {label}
        {!required && <span className="text-gray-500 font-normal"> (optional)</span>}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
      />
    </div>
  );
}

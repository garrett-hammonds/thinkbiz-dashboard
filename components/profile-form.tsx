'use client';

import { useState, useTransition } from 'react';
import { updateProfile, logout } from '@/app/actions/profile';
import imageCompression from 'browser-image-compression';
import { createClient } from '@/utils/supabase/client';
import NotificationSettings, { type NotificationPrefs } from '@/components/NotificationSettings';

export default function ProfileForm({ member, prefs }: { member: any; prefs: NotificationPrefs }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(member?.member_headshot || '');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const compressedFile = await imageCompression(file, { 
        maxSizeMB: 0.2, 
        maxWidthOrHeight: 800, 
        useWebWorker: true, 
        fileType: 'image/webp' 
      });

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.storage.from('Member Images').upload(`${user.id}/headshot.webp`, compressedFile, { upsert: true });
      
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('Member Images').getPublicUrl(`${user.id}/headshot.webp`);
      
      setPreviewUrl(`${publicUrl}?t=${Date.now()}`);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to upload image.' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('member_headshot', previewUrl);
    
    startTransition(async () => {
      try {
        const result = await updateProfile(formData);
        if (result.success) {
          setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } else {
          setMessage({ type: 'error', text: result.message || 'Failed to update profile.' });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Edit Profile Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 mb-6">
        <h2 className="text-3xl font-bold leading-snug text-foreground mb-6">Edit Profile</h2>
        
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-900 mb-2">Company Name</label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              defaultValue={member?.company_name || ''}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-900 mb-2">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              defaultValue={member?.title || ''}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Headshot</label>
            {previewUrl && (
              <img src={previewUrl} alt="Headshot preview" className="w-24 h-24 rounded-full object-cover mb-4" />
            )}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload} 
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-secondary cursor-pointer"
            />
            {uploadingImage && <p className="text-sm text-gray-500 mt-2">Uploading image...</p>}
          </div>

          <div>
            <label htmlFor="website_url" className="block text-sm font-medium text-gray-900 mb-2">Website URL</label>
            <input
              type="url"
              id="website_url"
              name="website_url"
              defaultValue={member?.website_url || ''}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="linkedin_url" className="block text-sm font-medium text-gray-900 mb-2">LinkedIn URL</label>
            <input
              type="url"
              id="linkedin_url"
              name="linkedin_url"
              defaultValue={member?.linkedin_url || ''}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="booking_calendar_url" className="block text-sm font-medium text-gray-900 mb-2">Booking Calendar URL</label>
            <input
              type="url"
              id="booking_calendar_url"
              name="booking_calendar_url"
              defaultValue={member?.booking_calendar_url || ''}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="core_skills" className="block text-sm font-medium text-gray-900 mb-2">Core Skills (comma separated)</label>
            <input
              type="text"
              id="core_skills"
              name="core_skills"
              defaultValue={member?.core_skills?.join(', ') || ''}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-900 mb-2">Bio</label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              defaultValue={member?.bio || ''}
              className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:ring-2 focus:ring-primary focus:outline-none"
            ></textarea>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-xl font-bold leading-snug text-foreground mb-4">Notifications</h3>
            <NotificationSettings prefs={prefs} />
          </div>

          <div>
            <button
              type="submit"
              disabled={isPending || uploadingImage}
              className="rounded-lg font-semibold bg-primary text-white hover:bg-secondary focus-visible:outline-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Account Actions Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 mb-6">
        <h3 className="text-2xl font-bold leading-snug text-foreground mb-6">Account Actions</h3>
        <button
          onClick={() => startTransition(() => logout())}
          className="rounded-lg font-semibold border-2 border-primary text-primary hover:bg-primary hover:text-white px-6 py-3"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

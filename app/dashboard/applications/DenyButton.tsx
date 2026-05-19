'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { denyApplication } from '@/app/actions/denyApplication';

export function DenyButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDeny = async () => {
    setIsLoading(true);
    try {
      const result = await denyApplication(applicationId);
      if (!result.success) {
        alert(result.message || 'Failed to deny application');
      } else {
        setIsModalOpen(false);
        router.refresh();
      }
    } catch (error) {
      alert('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="border-2 border-primary text-primary hover:border-red-600 hover:text-red-600 hover:bg-red-50 bg-transparent rounded-lg px-6 py-3 font-semibold transition-all duration-200 focus-visible:outline-red-600"
      >
        Deny
      </button>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-xl shadow-card p-6">
            <h3 className="text-xl font-bold text-foreground mb-2">Deny Application?</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to deny this application? This action will permanently delete their application data and cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                disabled={isLoading}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeny}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Denying...' : 'Yes, Deny Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

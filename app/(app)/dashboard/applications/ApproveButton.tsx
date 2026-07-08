'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveApplication } from '@/app/actions/approveApplication';

export default function ApproveButton({ applicationId }: { applicationId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const res = await approveApplication(applicationId);
      if (!res.success) {
        alert(res.message);
      } else {
        if (res.message) {
          alert(res.message);
        }
        router.refresh();
      }
    } catch {
      alert('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleApprove}
      disabled={isLoading}
      className="bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50"
    >
      {isLoading ? 'Approving...' : 'Approve Application'}
    </button>
  );
}
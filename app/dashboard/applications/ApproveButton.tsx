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
        router.refresh();
      }
    } catch (error) {
      alert('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleApprove}
      disabled={isLoading}
      className="bg-primary hover:bg-primary-dark text-primary-foreground px-4 py-2 rounded-md transition-colors disabled:opacity-50"
    >
      {isLoading ? 'Approving...' : 'Approve Application'}
    </button>
  );
}
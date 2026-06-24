'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { submitLogAction } from '@/app/actions/submitLog';
import SubmitButton from '@/components/SubmitButton';
import type { DirectoryMember } from '@/utils/supabase/directory';

// The weekly log is the single most important action in the product, so the
// form is tuned to stay out of the member's way: number fields start empty
// (placeholder "0") rather than pre-filled with a 0 they have to clear, the
// week-ending date can't be set unreasonably far in the future, and the submit
// button reports its own pending state so a slow network can't trigger a
// double submission.

export function WeeklyLogForm({ directory }: { directory: DirectoryMember[] }) {
  const [visitorsBrought, setVisitorsBrought] = useState('');
  const [oneOnOnesHad, setOneOnOnesHad] = useState('');
  const [referralsGiven, setReferralsGiven] = useState('');
  const [thanks, setThanks] = useState([{ memberId: '', amount: '' }]);

  // Allow logging the current week (whose "week ending" may be a few days out)
  // but reject dates far in the future, which only ever pollute the analytics.
  const maxWeekEnding = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const handleThanksChange = (index: number, field: string, value: string) => {
    const newEntries = [...thanks];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setThanks(newEntries);
  };

  const addThanksEntry = () => {
    setThanks([...thanks, { memberId: '', amount: '' }]);
  };

  const removeThanksEntry = (index: number) => {
    if (thanks.length > 1) {
      const newEntries = [...thanks];
      newEntries.splice(index, 1);
      setThanks(newEntries);
    }
  };

  const inputClasses =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm';

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-card">
      <h3 className="text-lg font-semibold leading-6 text-foreground">Log Your Weekly Activity</h3>
      <p className="mt-1 text-sm text-gray-500">
        Submit your stats for the week to keep your dashboard up to date.
      </p>
      <form action={submitLogAction} className="mt-6 space-y-6">
        <input type="hidden" name="revenue_thanks" value={JSON.stringify(thanks)} />
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
          <div>
            <label htmlFor="week-ending" className="block text-sm font-medium leading-6 text-gray-900">
              Week Ending Date
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="week-ending"
                name="week_ending"
                max={maxWeekEnding}
                required
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label htmlFor="visitors-brought" className="block text-sm font-medium leading-6 text-gray-900">
              Visitors Brought
            </label>
            <div className="mt-2">
              <input
                type="number"
                id="visitors-brought"
                name="visitors_brought"
                value={visitorsBrought}
                onChange={(e) => setVisitorsBrought(e.target.value)}
                min="0"
                placeholder="0"
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label htmlFor="one-on-ones" className="block text-sm font-medium leading-6 text-gray-900">
              1-on-1s Had
            </label>
            <div className="mt-2">
              <input
                type="number"
                id="one-on-ones"
                name="one_on_ones_had"
                value={oneOnOnesHad}
                onChange={(e) => setOneOnOnesHad(e.target.value)}
                min="0"
                placeholder="0"
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label htmlFor="referrals-given" className="block text-sm font-medium leading-6 text-gray-900">
              Referrals Given
            </label>
            <div className="mt-2">
              <input
                type="number"
                id="referrals-given"
                name="referrals_given"
                value={referralsGiven}
                onChange={(e) => setReferralsGiven(e.target.value)}
                min="0"
                placeholder="0"
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h4 className="text-md font-semibold text-foreground">Closed Business (Thank You)</h4>
          <p className="text-sm text-gray-500 mb-4">Record revenue generated from referrals.</p>

          {thanks.map((entry, index) => (
            <div key={index} className="flex gap-4 mb-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium leading-6 text-gray-900">Member</label>
                <select
                  value={entry.memberId}
                  onChange={(e) => handleThanksChange(index, 'memberId', e.target.value)}
                  className={`mt-2 ${inputClasses}`}
                >
                  <option value="">Select member...</option>
                  <option value="external">External/Visitor</option>
                  {directory?.map(member => (
                    <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium leading-6 text-gray-900">Dollar Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.amount}
                  onChange={(e) => handleThanksChange(index, 'amount', e.target.value)}
                  className={`mt-2 ${inputClasses}`}
                  placeholder="0.00"
                />
              </div>
              {thanks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeThanksEntry(index)}
                  aria-label={`Remove thank-you entry ${index + 1}`}
                  className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addThanksEntry}
            className="text-primary hover:bg-primary/10 px-4 py-2 rounded-lg font-semibold mt-2 transition-colors"
          >
            Add Another Thank You
          </button>
        </div>

        <div className="flex items-center justify-end mt-6">
          <SubmitButton
            pendingLabel="Submitting…"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Submit Log
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

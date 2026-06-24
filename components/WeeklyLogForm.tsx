'use client';

import { useState } from 'react';
import { submitLogAction } from '@/app/actions/submitLog';
import type { DirectoryMember } from '@/utils/supabase/directory';

export function WeeklyLogForm({ directory }: { directory: DirectoryMember[] }) {
  const [weekEnding, setWeekEnding] = useState('');
  const [visitorsBrought, setVisitorsBrought] = useState(0);
  const [oneOnOnesHad, setOneOnOnesHad] = useState(0);
  const [referralsGiven, setReferralsGiven] = useState(0);
  const [thanks, setThanks] = useState([{ memberId: '', amount: '' }]);

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

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold leading-6 text-card-foreground">Log Your Weekly Activity</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit your stats for the week to keep your dashboard up to date.
      </p>
      <form action={submitLogAction} className="mt-6 space-y-6">
        <input type="hidden" name="revenue_thanks" value={JSON.stringify(thanks)} />
        <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
          <div>
            <label htmlFor="week-ending" className="block text-sm font-medium leading-6 text-foreground">
              Week Ending Date
            </label>
            <div className="mt-2">
              <input
                type="date"
                id="week-ending"
                name="week_ending"
                value={weekEnding}
                onChange={(e) => setWeekEnding(e.target.value)}
                required
                className="block w-full rounded-md border-0 bg-input px-3 py-2 text-foreground shadow-sm ring-1 ring-inset ring-ring placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="visitors-brought" className="block text-sm font-medium leading-6 text-foreground">
              Visitors Brought
            </label>
            <div className="mt-2">
              <input
                type="number"
                id="visitors-brought"
                name="visitors_brought"
                value={visitorsBrought}
                onChange={(e) => setVisitorsBrought(parseInt(e.target.value, 10) || 0)}
                min="0"
                required
                className="block w-full rounded-md border-0 bg-input px-3 py-2 text-foreground shadow-sm ring-1 ring-inset ring-ring placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="one-on-ones" className="block text-sm font-medium leading-6 text-foreground">
              1-on-1s Had
            </label>
            <div className="mt-2">
              <input
                type="number"
                id="one-on-ones"
                name="one_on_ones_had"
                value={oneOnOnesHad}
                onChange={(e) => setOneOnOnesHad(parseInt(e.target.value, 10) || 0)}
                min="0"
                required
                className="block w-full rounded-md border-0 bg-input px-3 py-2 text-foreground shadow-sm ring-1 ring-inset ring-ring placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="referrals-given" className="block text-sm font-medium leading-6 text-foreground">
              Referrals Given
            </label>
            <div className="mt-2">
              <input
                type="number"
                id="referrals-given"
                name="referrals_given"
                value={referralsGiven}
                onChange={(e) => setReferralsGiven(parseInt(e.target.value, 10) || 0)}
                min="0"
                required
                className="block w-full rounded-md border-0 bg-input px-3 py-2 text-foreground shadow-sm ring-1 ring-inset ring-ring placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h4 className="text-md font-semibold text-foreground">Closed Business (Thank You)</h4>
          <p className="text-sm text-muted-foreground mb-4">Record revenue generated from referrals.</p>
          
          {thanks.map((entry, index) => (
            <div key={index} className="flex gap-4 mb-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium leading-6 text-foreground">Member</label>
                <select
                  value={entry.memberId}
                  onChange={(e) => handleThanksChange(index, 'memberId', e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 bg-input px-3 py-2 text-foreground shadow-sm ring-1 ring-inset ring-ring focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                >
                  <option value="">Select member...</option>
                  <option value="external">External/Visitor</option>
                  {directory?.map(member => (
                    <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium leading-6 text-foreground">Dollar Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.amount}
                  onChange={(e) => handleThanksChange(index, 'amount', e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 bg-input px-3 py-2 text-foreground shadow-sm ring-1 ring-inset ring-ring placeholder:text-muted-foreground focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                  placeholder="0.00"
                />
              </div>
              {thanks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeThanksEntry(index)}
                  className="text-primary hover:bg-primary/10 px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  X
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
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-secondary focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
          >
            Submit Log
          </button>
        </div>
      </form>
    </div>
  );
}
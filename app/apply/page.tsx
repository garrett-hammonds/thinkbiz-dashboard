'use client';

import { useState, useEffect } from 'react';
import { submitApplicationAction } from './submitApplication';
import { createClient } from '../../utils/supabase/client';

export default function ApplyPage() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        clubId: '',
        companyName: '',
        title: '',
        bio: '',
        coreSkills: ''
    });
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clubs, setClubs] = useState<{ id: string, name: string }[]>([]);
    const [isLoadingClubs, setIsLoadingClubs] = useState(true);

    useEffect(() => {
        const fetchClubs = async () => {
            const supabase = createClient();
            const { data, error } = await supabase.from('clubs').select('id, name').order('name');
            if (data) {
                setClubs(data);
            } else if (error) {
                console.error('Error fetching clubs:', error);
            }
            setIsLoadingClubs(false);
        };
        fetchClubs();
    }, []);

    const handleNext = () => {
        const { firstName, lastName, email, phone, clubId } = formData;
        
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !clubId) {
            alert('Please fill out all fields before proceeding.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            alert('Please enter a valid email address.');
            return;
        }

        setStep(2);
    };

    const handleBack = () => {
        setStep(1);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const submitApplication = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        console.log('Received Application:', formData);

        const result = await submitApplicationAction(formData);
        
        setIsSubmitting(false);

        if (result.success) {
            setStep(3);
        } else {
            alert(result.message || 'An error occurred. Please try again.');
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-md bg-white rounded-xl border border-gray-100 shadow-card p-8 transition-all duration-200">
                {(step === 1 || step === 2) && (
                    <div className="text-xs font-bold uppercase mb-2 text-center text-gray-500">Step {step} of 2</div>
                )}
                <h1 className="text-3xl font-bold leading-snug text-foreground text-center mb-6">Apply for ThinkBiz</h1>
                
                {step === 1 && (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">First Name</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Last Name</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Club Name</label>
                            <select name="clubId" value={formData.clubId} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required disabled={isLoadingClubs}>
                                <option value="">{isLoadingClubs ? 'Loading clubs…' : 'Select a club'}</option>
                                {clubs.map((club, idx) => (
                                    <option key={idx} value={club.id}>{club.name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleNext} className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50 mt-4">Next step</button>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={submitApplication} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Company Name</label>
                            <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Bio</label>
                            <textarea name="bio" value={formData.bio} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 h-28 resize-none text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" maxLength={300} required />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">Core Skills <span className="text-gray-500 font-normal">(comma separated)</span></label>
                            <input type="text" name="coreSkills" value={formData.coreSkills} onChange={handleChange} className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors" required />
                        </div>
                        <div className="flex space-x-4 pt-4">
                            <button type="button" onClick={handleBack} className="w-full text-primary hover:bg-primary/10 rounded-lg px-4 py-2 font-semibold transition-colors duration-200">Back</button>
                            <button type="submit" disabled={isSubmitting} className="w-full bg-primary text-white hover:bg-secondary rounded-lg px-6 py-3 font-semibold transition-colors duration-200 focus-visible:outline-primary disabled:opacity-50">
                                {isSubmitting ? 'Submitting…' : 'Submit application'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <div className="text-center py-6">
                        <h2 className="text-3xl font-bold leading-snug text-foreground mb-4">Application received</h2>
                        <div className="border-t-4 border-primary w-16 mx-auto mb-4"></div>
                        <p className="text-base leading-relaxed text-gray-900">Thanks for applying. A club director will review your details and be in touch soon.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
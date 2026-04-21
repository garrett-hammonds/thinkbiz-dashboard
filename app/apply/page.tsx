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
            <div className="w-full max-w-md border-4 border-black rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white p-8">
                {(step === 1 || step === 2) && (
                    <div className="text-xs font-bold uppercase mb-2 text-center text-gray-500">Step {step} of 2</div>
                )}
                <h1 className="text-3xl font-black mb-8 text-center text-black uppercase tracking-tight">Apply for ThinkBiz</h1>
                
                {step === 1 && (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">First Name</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Last Name</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Club Name</label>
                            <select name="clubId" value={formData.clubId} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required disabled={isLoadingClubs}>
                                <option value="">{isLoadingClubs ? 'Loading clubs...' : 'Select a club'}</option>
                                {clubs.map((club, idx) => (
                                    <option key={idx} value={club.id}>{club.name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleNext} className="w-full bg-blue-600 text-white font-bold text-lg border-2 border-black rounded-lg p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all mt-4">Next Step</button>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={submitApplication} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Company Name</label>
                            <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Title</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Bio</label>
                            <textarea name="bio" value={formData.bio} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 h-28 resize-none text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" maxLength={300} required />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-black mb-2 uppercase">Core Skills <span className="text-gray-500 font-normal normal-case">(comma separated)</span></label>
                            <input type="text" name="coreSkills" value={formData.coreSkills} onChange={handleChange} className="w-full border-2 border-black rounded-lg p-3 text-black focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all font-medium" required />
                        </div>
                        <div className="flex space-x-4 pt-4">
                            <button type="button" onClick={handleBack} className="w-1/3 bg-white text-black font-bold text-lg border-2 border-black rounded-lg p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">Back</button>
                            <button type="submit" disabled={isSubmitting} className="w-2/3 bg-blue-600 text-white font-bold text-lg border-2 border-black rounded-lg p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {isSubmitting ? 'Submitting...' : 'Submit'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <div className="text-center py-6">
                        <h2 className="text-3xl font-black text-black mb-4 uppercase tracking-tight">Success!</h2>
                        <div className="border-t-4 border-black w-16 mx-auto mb-4"></div>
                        <p className="text-gray-800 font-medium text-lg">Your application has been submitted. A director will review your details and be in touch soon.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
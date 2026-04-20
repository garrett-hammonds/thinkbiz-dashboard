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
        clubName: '',
        companyName: '',
        title: '',
        bio: '',
        coreSkills: ''
    });
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clubs, setClubs] = useState<{ name: string }[]>([]);
    const [isLoadingClubs, setIsLoadingClubs] = useState(true);

    useEffect(() => {
        const fetchClubs = async () => {
            const supabase = createClient();
            const { data, error } = await supabase.from('clubs').select('name').order('name');
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
        const { firstName, lastName, email, phone, clubName } = formData;
        
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !clubName) {
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
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Apply for ThinkBiz</h1>
                
                {step === 1 && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Club Name</label>
                            <select name="clubName" value={formData.clubName} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required disabled={isLoadingClubs}>
                                <option value="">{isLoadingClubs ? 'Loading clubs...' : 'Select a club'}</option>
                                {clubs.map((club, idx) => (
                                    <option key={idx} value={club.name}>{club.name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleNext} className="w-full bg-blue-600 text-white rounded-md p-2 hover:bg-blue-700 transition">Next Step</button>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={submitApplication} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                            <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                            <textarea name="bio" value={formData.bio} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 h-24 resize-none text-black" maxLength={300} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Core Skills <span className="text-gray-500 font-normal">(comma separated)</span></label>
                            <input type="text" name="coreSkills" value={formData.coreSkills} onChange={handleChange} className="w-full border border-gray-300 rounded-md p-2 text-black" required />
                        </div>
                        <div className="flex space-x-4">
                            <button type="button" onClick={handleBack} className="w-1/3 bg-gray-200 text-gray-800 rounded-md p-2 hover:bg-gray-300 transition">Back</button>
                            <button type="submit" disabled={isSubmitting} className="w-2/3 bg-blue-600 text-white rounded-md p-2 hover:bg-blue-700 transition disabled:opacity-50">
                                {isSubmitting ? 'Submitting...' : 'Submit Application'}
                            </button>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-green-600 mb-4">Application Submitted!</h2>
                        <p className="text-gray-600">A director will review your details and be in touch soon.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
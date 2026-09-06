'use client';
import React, { useState } from 'react';
import { BRAND } from '../constants/brand';
import { useOrganization } from '../context/OrganizationContext';
import { BrandLockup } from '@/components/brand/BrandLockup';

interface ExamFeedbackViewProps {
    onSubmitFeedback: (rating: number, comment: string) => void;
    verdict?: { passed: boolean; score?: number | null; passingPercentage?: number };
}

export default function ExamFeedbackView({ onSubmitFeedback, verdict }: ExamFeedbackViewProps) {
    const [rating, setRating] = useState<number>(0);
    const [comment, setComment] = useState('');
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const { organization: orgContext } = useOrganization();

    const displayName = orgContext?.name || BRAND.name;

    const handleSubmit = () => {
        if (rating === 0) return;
        onSubmitFeedback(rating, comment);
    };

    const ratingDescriptions: { [key: number]: string } = {
        1: 'Poor',
        2: 'Fair',
        3: 'Good',
        4: 'Very Good',
        5: 'Excellent',
    };

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col font-sans overflow-hidden relative animate-in fade-in duration-500">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-64 bg-slate-100/50 -z-10 skew-y-2 origin-top-left transform" />

            <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
                {/* Logo Area */}
                <div className="mb-12 flex flex-col items-center">
                    <BrandLockup
                        orgName={orgContext?.name}
                        orgLogo={orgContext?.logo}
                        defaultLogoClassName="mb-4 h-9 max-w-[180px]"
                        iconClassName="mb-4 h-12 w-12"
                        textClassName="mb-4 text-lg font-black"
                    />
                    <div className="h-1 w-12 bg-indigo-500 rounded-full" />
                </div>

                <div className="w-full bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/60 border border-slate-100 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />

                    <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">How was your experience?</h1>
                    <p className="text-slate-500 font-medium mb-10 text-lg">
                        Your feedback helps us make exams better for everyone.
                    </p>
                    {verdict ? (
                        <div
                            className={`mb-6 rounded-2xl border px-4 py-3 text-left ${
                                verdict.passed ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
                            }`}
                        >
                            <p
                                className={`text-sm font-black ${verdict.passed ? 'text-emerald-700' : 'text-rose-700'}`}
                            >
                                {verdict.passed ? 'Passed' : 'Failed'}
                                {typeof verdict.score === 'number' ? ` - ${Math.round(verdict.score)}%` : ''}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-600">
                                Passing threshold: {verdict.passingPercentage ?? 70}%
                            </p>
                        </div>
                    ) : null}

                    {/* Rating Section */}
                    <div className="mb-10">
                        <div className="flex justify-center gap-4 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    onClick={() => setRating(star)}
                                    className={`
                                        w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-300 transform
                                        ${
                                            (hoveredRating || rating) >= star
                                                ? 'bg-indigo-600 text-white scale-110 shadow-xl shadow-indigo-200 ring-4 ring-indigo-50'
                                                : 'bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-400'
                                        }
                                        active:scale-95
                                    `}
                                >
                                    {star <= (hoveredRating || rating) ? '★' : '☆'}
                                </button>
                            ))}
                        </div>
                        <div className="h-6">
                            {(hoveredRating || rating) > 0 && (
                                <span className="text-indigo-600 font-black uppercase tracking-widest text-xs animate-in slide-in-from-bottom-2 duration-300">
                                    {ratingDescriptions[hoveredRating || rating]}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Comment Section */}
                    <div className="mb-8">
                        <textarea
                            placeholder="Add a comment (optional)..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="w-full h-32 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none placeholder:text-slate-400"
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={rating === 0}
                        className={`
                            w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300
                            ${
                                rating > 0
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }
                        `}
                    >
                        Submit Feedback
                    </button>

                    <p className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Powered by {displayName} &bull; {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
}

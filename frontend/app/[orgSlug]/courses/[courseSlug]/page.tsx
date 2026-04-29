import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

const API_BASE = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(
    /\/$/,
    '',
);

type PublicCourseResponse = {
    org: {
        slug: string;
        name: string;
        logo?: string | null;
        plan: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
    };
    course: {
        id: string;
        title: string;
        slug: string;
        shortDescription?: string | null;
        longDescription?: string | null;
        thumbnail?: string | null;
        modules: Array<{ id: string; title: string }>;
    };
};

async function fetchPublicCourse(orgSlug: string, courseSlug: string): Promise<PublicCourseResponse | null> {
    try {
        const res = await fetch(
            `${API_BASE}/courses/public/${encodeURIComponent(orgSlug)}/${encodeURIComponent(courseSlug)}`,
            {
                cache: 'no-store',
            },
        );

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ orgSlug: string; courseSlug: string }>;
}): Promise<Metadata> {
    const { orgSlug, courseSlug } = await params;
    const payload = await fetchPublicCourse(orgSlug, courseSlug);

    if (!payload) {
        return {
            title: 'Course Not Found',
            description: 'This public course could not be found.',
        };
    }

    const title = `${payload.course.title} | ${payload.org.name}`;
    const description =
        payload.course.shortDescription ||
        payload.course.longDescription ||
        `Explore ${payload.course.title} by ${payload.org.name}.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: payload.course.thumbnail ? [{ url: payload.course.thumbnail }] : undefined,
        },
    };
}

export default async function PublicCoursePage({
    params,
}: {
    params: Promise<{ orgSlug: string; courseSlug: string }>;
}) {
    const { orgSlug, courseSlug } = await params;
    const payload = await fetchPublicCourse(orgSlug, courseSlug);

    if (!payload) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-6">
                <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-8 text-center">
                    <h1 className="text-2xl font-black text-slate-900">Course not found</h1>
                    <p className="mt-2 text-sm font-semibold text-slate-500">This course is not publicly available.</p>
                </div>
            </div>
        );
    }

    const { org, course } = payload;
    const showPoweredBy = org.plan === 'FREE';

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
            <main className="max-w-4xl mx-auto px-6 py-10">
                <section className="bg-white border border-slate-100 rounded-[28px] shadow-sm overflow-hidden">
                    {course.thumbnail && (
                        <div className="relative h-56 w-full">
                            <Image src={course.thumbnail} alt={course.title} fill className="object-cover" />
                        </div>
                    )}

                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-4">
                            {org.logo ? (
                                <img src={org.logo} alt={org.name} className="w-10 h-10 rounded-xl object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-[var(--brand-light)] flex items-center justify-center text-[var(--brand)] font-black text-sm">
                                    {org.name.slice(0, 1).toUpperCase()}
                                </div>
                            )}
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">{org.name}</p>
                        </div>

                        <h1 className="text-3xl font-black tracking-tight text-slate-900">{course.title}</h1>
                        <p className="mt-3 text-sm font-semibold text-slate-600">
                            {course.shortDescription || course.longDescription || 'No description provided.'}
                        </p>

                        <div className="mt-8">
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
                                Modules
                            </h2>
                            <ul className="space-y-2">
                                {course.modules.map((module, index) => (
                                    <li
                                        key={module.id}
                                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm font-bold text-slate-700"
                                    >
                                        {index + 1}. {module.title}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <Link
                            href="/signup"
                            className="mt-8 inline-flex items-center justify-center rounded-xl bg-[var(--brand)] px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--brand-dark)]"
                        >
                            Enroll Now
                        </Link>
                    </div>
                </section>

                {showPoweredBy && (
                    <footer className="mt-6 text-center text-xs font-bold text-slate-400">
                        Powered by Mentrily
                    </footer>
                )}
            </main>
        </div>
    );
}

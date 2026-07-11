import Link from 'next/link';
import {
    getPublicPlaygroundFaqs,
    publicPlaygroundSeoEntries,
    type PublicPlaygroundSeoEntry,
} from '@/app/(app)/playground/publicSeo';

export function PublicSeoHeader({ entry }: { entry: PublicPlaygroundSeoEntry }) {
    return (
        <div className="mb-3">
            <h1 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">{entry.h1}</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-500 md:text-sm">{entry.description}</p>
        </div>
    );
}

function aboutCopy(entry: PublicPlaygroundSeoEntry): string[] {
    const label = entry.label;

    if (entry.kind === 'web') {
        return [
            'The Mentrily online HTML editor lets you write HTML, CSS, and JavaScript side by side and see a live preview instantly. It is a fast way to prototype layouts, test snippets, and learn front-end development without setting up a local project.',
            'Everything runs in your browser — no downloads, no configuration, and no account required to start. When you are ready, sign up free to save your work or turn it into course material.',
        ];
    }

    if (entry.kind === 'notebook') {
        return [
            'The Mentrily online Python notebook lets you run Python code cell by cell, just like Jupyter, directly in your browser. Popular data-science libraries such as NumPy and Matplotlib are available out of the box.',
            'It is ideal for quick experiments, data analysis practice, and teaching — with no local Python installation needed.',
        ];
    }

    return [
        `The Mentrily online ${label} compiler lets you write, compile, and run ${label} code directly in your browser. Your program executes in a secure cloud sandbox with standard input support, so it behaves the same way it would in a local terminal — without installing a compiler, IDE, or toolchain.`,
        `It is perfect for practicing ${label}, testing snippets, preparing for coding interviews, and classroom use. Start typing and hit Run — no account required.`,
    ];
}

function featureList(entry: PublicPlaygroundSeoEntry): string[] {
    if (entry.kind === 'web') {
        return [
            'Live preview of HTML, CSS, and JavaScript as you type',
            'No setup — runs entirely in your browser',
            'Free to use, no account required to start',
            'Turn your page into a shareable practice question',
        ];
    }

    if (entry.kind === 'notebook') {
        return [
            'Run Python cells interactively, Jupyter-style',
            'NumPy and Matplotlib available out of the box',
            'No local Python or Jupyter installation needed',
            'Free to use, no account required to start',
        ];
    }

    return [
        `Compile and run ${entry.label} in a secure cloud sandbox`,
        'Standard input (stdin) support for interactive programs',
        'Fast editor with syntax highlighting and error output',
        'Free to use, no account required to start',
        'Switch between 30+ programming languages instantly',
    ];
}

export function PublicSeoContent({ entry }: { entry: PublicPlaygroundSeoEntry }) {
    const faqs = getPublicPlaygroundFaqs(entry);
    const others = publicPlaygroundSeoEntries.filter((other) => other.slug !== entry.slug);
    const paragraphs = aboutCopy(entry);
    const features = featureList(entry);

    return (
        <div className="mt-6 space-y-6 pb-10">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-black tracking-tight text-slate-900">About the {entry.h1}</h2>
                {paragraphs.map((text) => (
                    <p key={text.slice(0, 32)} className="mt-3 text-sm leading-6 text-slate-600">
                        {text}
                    </p>
                ))}
                <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                            {feature}
                        </li>
                    ))}
                </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-black tracking-tight text-slate-900">Frequently asked questions</h2>
                <div className="mt-3 divide-y divide-slate-100">
                    {faqs.map((faq) => (
                        <details key={faq.question} className="group py-3">
                            <summary className="cursor-pointer list-none text-sm font-bold text-slate-800 marker:hidden">
                                {faq.question}
                            </summary>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{faq.answer}</p>
                        </details>
                    ))}
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-black tracking-tight text-slate-900">More online compilers and tools</h2>
                <p className="mt-2 text-sm text-slate-600">
                    Mentrily supports 30+ languages. Jump straight into another playground:
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {others.map((other) => (
                        <li key={other.slug}>
                            <Link
                                href={`/${other.slug}`}
                                className="text-sm font-semibold text-[var(--brand)] hover:underline"
                            >
                                {other.h1.replace(/^Online /, '')}
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

import { PLAYGROUND_LANGUAGES } from '@/app/components/Editor/playgroundLanguages';

export type PublicPlaygroundKind = 'code' | 'web' | 'notebook';

export interface PublicPlaygroundSeoEntry {
    slug: string;
    langId: string;
    label: string;
    kind: PublicPlaygroundKind;
    title: string;
    description: string;
    h1: string;
    keywords: string[];
}

const slugByLanguage: Record<string, string> = {
    javascript: 'online-javascript-compiler',
    typescript: 'online-typescript-compiler',
    python: 'online-python-compiler',
    java: 'online-java-compiler',
    c: 'online-c-compiler',
    cpp: 'online-cpp-compiler',
    csharp: 'online-csharp-compiler',
    go: 'online-go-compiler',
    rust: 'online-rust-compiler',
    php: 'online-php-compiler',
    ruby: 'online-ruby-compiler',
    perl: 'online-perl-compiler',
    swift: 'online-swift-compiler',
    kotlin: 'online-kotlin-compiler',
    scala: 'online-scala-compiler',
    dart: 'online-dart-compiler',
    bash: 'online-bash-compiler',
    powershell: 'online-powershell-compiler',
    r: 'online-r-compiler',
    lua: 'online-lua-compiler',
    haskell: 'online-haskell-compiler',
    julia: 'online-julia-compiler',
    crystal: 'online-crystal-compiler',
    nim: 'online-nim-compiler',
    pascal: 'online-pascal-compiler',
    clojure: 'online-clojure-compiler',
    cobol: 'online-cobol-compiler',
    d: 'online-d-compiler',
    erlang: 'online-erlang-compiler',
    fortran: 'online-fortran-compiler',
    groovy: 'online-groovy-compiler',
    ocaml: 'online-ocaml-compiler',
    sqlite3: 'online-sqlite-compiler',
};

const codeEntries = PLAYGROUND_LANGUAGES.filter((language) => slugByLanguage[language.id]).map((language) => {
    const compilerLabel = language.id === 'sqlite3' ? 'SQLite' : language.label;
    return {
        slug: slugByLanguage[language.id],
        langId: language.id,
        label: compilerLabel,
        kind: 'code' as const,
        title: `Online ${compilerLabel} Compiler - Run ${compilerLabel} Code Free`,
        description: `Write, compile, and run ${compilerLabel} code online for free in the Mentrily playground. No setup required.`,
        h1: `Online ${compilerLabel} Compiler`,
        keywords: [
            `online ${compilerLabel.toLowerCase()} compiler`,
            `run ${compilerLabel.toLowerCase()} code online`,
            `${compilerLabel.toLowerCase()} playground`,
        ],
    };
});

export const publicPlaygroundSeoEntries: PublicPlaygroundSeoEntry[] = [
    ...codeEntries,
    {
        slug: 'online-html-editor',
        langId: 'html',
        label: 'HTML/CSS',
        kind: 'web',
        title: 'Online HTML Editor - HTML CSS JS Playground',
        description: 'Build and preview HTML, CSS, and JavaScript online with a fast browser-based web playground.',
        h1: 'Online HTML Editor',
        keywords: ['online html editor', 'html css js playground', 'html playground online'],
    },
    {
        slug: 'online-python-notebook',
        langId: 'python-notebook',
        label: 'Python Notebook',
        kind: 'notebook',
        title: 'Online Python Notebook - Run Python Cells Online',
        description: 'Run Python notebook cells online with a lightweight browser notebook playground.',
        h1: 'Online Python Notebook',
        keywords: ['online python notebook', 'jupyter notebook online', 'python notebook playground'],
    },
];

export function getPublicPlaygroundSeoEntry(slug: string) {
    return publicPlaygroundSeoEntries.find((entry) => entry.slug === slug) || null;
}

export interface PublicPlaygroundFaq {
    question: string;
    answer: string;
}

export function getPublicPlaygroundFaqs(entry: PublicPlaygroundSeoEntry): PublicPlaygroundFaq[] {
    const label = entry.label;

    if (entry.kind === 'web') {
        return [
            {
                question: 'Is this online HTML editor free to use?',
                answer: 'Yes. The Mentrily HTML editor is completely free. You can write HTML, CSS, and JavaScript and preview the result instantly without creating an account.',
            },
            {
                question: 'Do I need to install anything to build web pages here?',
                answer: 'No. Everything runs directly in your browser. There is nothing to download or configure — open the page and start coding.',
            },
            {
                question: 'Can I see a live preview of my HTML, CSS, and JavaScript?',
                answer: 'Yes. The editor renders a live preview of your page as you type, so you can experiment with layouts, styles, and scripts and see the result immediately.',
            },
            {
                question: 'Can I use this editor for teaching web development?',
                answer: 'Yes. Mentrily is built for educators — you can create full courses and exams with web project questions, share them with learners, and track progress from one dashboard.',
            },
        ];
    }

    if (entry.kind === 'notebook') {
        return [
            {
                question: 'Is this online Python notebook free?',
                answer: 'Yes. You can run Python notebook cells online for free, with popular libraries like NumPy and Matplotlib available, and no account is required to start.',
            },
            {
                question: 'Do I need to install Python or Jupyter to use it?',
                answer: 'No. The notebook runs in your browser with no local setup. It is a lightweight alternative to installing Python and Jupyter on your machine.',
            },
            {
                question: 'Can I plot charts and use data-science libraries?',
                answer: 'Yes. The notebook supports common data-science libraries such as NumPy and Matplotlib, so you can compute, analyze, and plot results cell by cell.',
            },
            {
                question: 'Can I use this notebook for teaching or assessments?',
                answer: 'Yes. Educators on Mentrily can add Python notebook questions to courses and exams, so learners practice in the same environment they are graded in.',
            },
        ];
    }

    return [
        {
            question: `Is this online ${label} compiler free?`,
            answer: `Yes. The Mentrily ${label} compiler is completely free. You can write, compile, and run ${label} code online without creating an account or installing anything.`,
        },
        {
            question: `Do I need to install ${label} on my computer?`,
            answer: `No. Your ${label} code is compiled and executed in a secure cloud sandbox, so it works on any device with a browser — laptops, Chromebooks, and tablets included.`,
        },
        {
            question: `Can my ${label} program read input (stdin)?`,
            answer: `Yes. The playground supports standard input, so programs that read from stdin work the same way they would in a local terminal.`,
        },
        {
            question: `Can I save or share my ${label} code?`,
            answer: `Yes. Create a free Mentrily account to keep your work, or use the built-in question builder to turn a snippet into a shareable practice problem.`,
        },
        {
            question: `Can I use this ${label} playground for teaching or exams?`,
            answer: `Yes. Mentrily is a full teaching platform — educators can build courses and proctored exams with auto-graded ${label} coding questions, then track learner progress in one dashboard.`,
        },
    ];
}

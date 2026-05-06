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

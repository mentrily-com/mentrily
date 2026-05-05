import { LanguageConfig } from './types';

const RAW_PLAYGROUND_LANGUAGES: LanguageConfig[] = [
    {
        id: 'javascript',
        label: 'JavaScript',
        header: '',
        footer: '',
        initialBody: `console.log("Hello, World!");`,
        extension: async () => {
            const { javascript } = await import('@codemirror/lang-javascript');
            return javascript();
        },
    },
    {
        id: 'typescript',
        label: 'TypeScript',
        header: '',
        footer: '',
        initialBody: `console.log("Hello, World!");`,
        extension: async () => {
            const { javascript } = await import('@codemirror/lang-javascript');
            return javascript({ typescript: true });
        },
    },
    {
        id: 'python',
        label: 'Python',
        header: '',
        footer: '',
        initialBody: `print("Hello, World!")`,
        extension: async () => {
            const { python } = await import('@codemirror/lang-python');
            return python();
        },
    },
    {
        id: 'java',
        label: 'Java',
        header: '',
        footer: '',
        initialBody: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
        extension: async () => {
            const { java } = await import('@codemirror/lang-java');
            return java();
        },
    },
    {
        id: 'c',
        label: 'C',
        header: '',
        footer: '',
        initialBody: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`,
        extension: async () => {
            const { cpp } = await import('@codemirror/lang-cpp');
            return cpp();
        },
    },
    {
        id: 'cpp',
        label: 'C++',
        header: '',
        footer: '',
        initialBody: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
        extension: async () => {
            const { cpp } = await import('@codemirror/lang-cpp');
            return cpp();
        },
    },
    {
        id: 'csharp',
        label: 'C#',
        header: '',
        footer: '',
        initialBody: `using System;\n\npublic class Program {\n    public static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { csharp } = await import('@codemirror/legacy-modes/mode/clike');
            return StreamLanguage.define(csharp);
        },
    },
    {
        id: 'go',
        label: 'Go',
        header: '',
        footer: '',
        initialBody: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
        extension: async () => {
            const { go } = await import('@codemirror/lang-go');
            return go();
        },
    },
    {
        id: 'rust',
        label: 'Rust',
        header: '',
        footer: '',
        initialBody: `fn main() {\n    println!("Hello, World!");\n}`,
        extension: async () => {
            const { rust } = await import('@codemirror/lang-rust');
            return rust();
        },
    },
    {
        id: 'php',
        label: 'PHP',
        header: '',
        footer: '',
        initialBody: `<?php\necho "Hello, World!";\n`,
        extension: async () => {
            const { php } = await import('@codemirror/lang-php');
            return php();
        },
    },
    {
        id: 'ruby',
        label: 'Ruby',
        header: '',
        footer: '',
        initialBody: `puts "Hello, World!"`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { ruby } = await import('@codemirror/legacy-modes/mode/ruby');
            return StreamLanguage.define(ruby);
        },
    },
    {
        id: 'perl',
        label: 'Perl',
        header: '',
        footer: '',
        initialBody: `print "Hello, World!\\n";`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { perl } = await import('@codemirror/legacy-modes/mode/perl');
            return StreamLanguage.define(perl);
        },
    },
    {
        id: 'swift',
        label: 'Swift',
        header: '',
        footer: '',
        initialBody: `print("Hello, World!")`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { swift } = await import('@codemirror/legacy-modes/mode/swift');
            return StreamLanguage.define(swift);
        },
    },
    {
        id: 'kotlin',
        label: 'Kotlin',
        header: '',
        footer: '',
        initialBody: `fun main() {\n    println("Hello, World!")\n}`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { kotlin } = await import('@codemirror/legacy-modes/mode/clike');
            return StreamLanguage.define(kotlin);
        },
    },
    {
        id: 'scala',
        label: 'Scala',
        header: '',
        footer: '',
        initialBody: `object Main {\n    def main(args: Array[String]): Unit = {\n        println("Hello, World!")\n    }\n}`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { scala } = await import('@codemirror/legacy-modes/mode/clike');
            return StreamLanguage.define(scala);
        },
    },
    {
        id: 'dart',
        label: 'Dart',
        header: '',
        footer: '',
        initialBody: `void main() {\n  print('Hello, World!');\n}`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { dart } = await import('@codemirror/legacy-modes/mode/clike');
            return StreamLanguage.define(dart);
        },
    },
    {
        id: 'bash',
        label: 'Bash',
        header: '',
        footer: '',
        initialBody: `echo "Hello, World!"`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { shell } = await import('@codemirror/legacy-modes/mode/shell');
            return StreamLanguage.define(shell);
        },
    },
    {
        id: 'powershell',
        label: 'PowerShell',
        header: '',
        footer: '',
        initialBody: `Write-Output "Hello, World!"`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { powerShell } = await import('@codemirror/legacy-modes/mode/powershell');
            return StreamLanguage.define(powerShell);
        },
    },
    {
        id: 'r',
        label: 'R',
        header: '',
        footer: '',
        initialBody: `print("Hello, World!")`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { r } = await import('@codemirror/legacy-modes/mode/r');
            return StreamLanguage.define(r);
        },
    },
    {
        id: 'lua',
        label: 'Lua',
        header: '',
        footer: '',
        initialBody: `print("Hello, World!")`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { lua } = await import('@codemirror/legacy-modes/mode/lua');
            return StreamLanguage.define(lua);
        },
    },
    {
        id: 'haskell',
        label: 'Haskell',
        header: '',
        footer: '',
        initialBody: `main = putStrLn "Hello, World!"`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { haskell } = await import('@codemirror/legacy-modes/mode/haskell');
            return StreamLanguage.define(haskell);
        },
    },
    {
        id: 'julia',
        label: 'Julia',
        header: '',
        footer: '',
        initialBody: `println("Hello, World!")`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { julia } = await import('@codemirror/legacy-modes/mode/julia');
            return StreamLanguage.define(julia);
        },
    },
    {
        id: 'crystal',
        label: 'Crystal',
        header: '',
        footer: '',
        initialBody: `puts "Hello, World!"`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { crystal } = await import('@codemirror/legacy-modes/mode/crystal');
            return StreamLanguage.define(crystal);
        },
    },
    {
        id: 'nim',
        label: 'Nim',
        header: '',
        footer: '',
        initialBody: `echo "Hello, World!"`,
        extension: async () => {
            const { python } = await import('@codemirror/lang-python');
            return python();
        },
    },
    {
        id: 'pascal',
        label: 'Pascal',
        header: '',
        footer: '',
        initialBody: `program Hello;\nbegin\n  writeln('Hello, World!');\nend.`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { pascal } = await import('@codemirror/legacy-modes/mode/pascal');
            return StreamLanguage.define(pascal);
        },
    },
    {
        id: 'clojure',
        label: 'Clojure',
        header: '',
        footer: '',
        initialBody: `(println "Hello, World!")`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { clojure } = await import('@codemirror/legacy-modes/mode/clojure');
            return StreamLanguage.define(clojure);
        },
    },
    {
        id: 'cobol',
        label: 'COBOL',
        header: '',
        footer: '',
        initialBody: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. HELLO-WORLD.\n       PROCEDURE DIVISION.\n           DISPLAY 'Hello, World!'.\n           STOP RUN.`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { cobol } = await import('@codemirror/legacy-modes/mode/cobol');
            return StreamLanguage.define(cobol);
        },
    },
    {
        id: 'd',
        label: 'D',
        header: '',
        footer: '',
        initialBody: `import std.stdio;\n\nvoid main() {\n    writeln("Hello, World!");\n}`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { d } = await import('@codemirror/legacy-modes/mode/d');
            return StreamLanguage.define(d);
        },
    },
    {
        id: 'erlang',
        label: 'Erlang',
        header: '',
        footer: '',
        initialBody: `-module(main).\n-export([main/0]).\n\nmain() ->\n    io:format("Hello, World!~n").`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { erlang } = await import('@codemirror/legacy-modes/mode/erlang');
            return StreamLanguage.define(erlang);
        },
    },
    {
        id: 'fortran',
        label: 'Fortran',
        header: '',
        footer: '',
        initialBody: `program hello\n  print *, "Hello, World!"\nend program hello`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { fortran } = await import('@codemirror/legacy-modes/mode/fortran');
            return StreamLanguage.define(fortran);
        },
    },
    {
        id: 'groovy',
        label: 'Groovy',
        header: '',
        footer: '',
        initialBody: `println "Hello, World!"`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { groovy } = await import('@codemirror/legacy-modes/mode/groovy');
            return StreamLanguage.define(groovy);
        },
    },
    {
        id: 'ocaml',
        label: 'OCaml',
        header: '',
        footer: '',
        initialBody: `print_endline "Hello, World!";;`,
        extension: async () => {
            const { StreamLanguage } = await import('@codemirror/language');
            const { oCaml } = await import('@codemirror/legacy-modes/mode/mllike');
            return StreamLanguage.define(oCaml);
        },
    },
    {
        id: 'sqlite3',
        label: 'SQLite3',
        header: '',
        footer: '',
        initialBody: `SELECT 'Hello, World!';`,
        extension: async () => {
            const { sql } = await import('@codemirror/lang-sql');
            return sql();
        },
    },
];

// Keep this aligned with backend Judge0Strategy.languageMap support.
const JUDGE0_SUPPORTED_PLAYGROUND_IDS = new Set([
    'javascript',
    'typescript',
    'python',
    'java',
    'c',
    'cpp',
    'csharp',
    'go',
    'rust',
    'php',
    'ruby',
    'perl',
    'swift',
    'kotlin',
    'scala',
    'bash',
    'r',
    'lua',
    'haskell',
    'pascal',
    'clojure',
    'cobol',
    'd',
    'erlang',
    'fortran',
    'groovy',
    'ocaml',
    'sqlite3',
]);

export const PLAYGROUND_LANGUAGES: LanguageConfig[] = RAW_PLAYGROUND_LANGUAGES.filter((lang) =>
    JUDGE0_SUPPORTED_PLAYGROUND_IDS.has(lang.id),
);

import { WidgetType, EditorView } from '@codemirror/view';

/**
 * Renders a read-only block of code (boilerplate) within the editor viewport.
 * Refined for a thin, blended look that doesn't feel like a separate "thick div".
 */
export class BoilerplateWidget extends WidgetType {
    constructor(
        private content: string,
        private type: 'header' | 'footer',
        private isCollapsed: boolean = true,
        private onToggle?: (view: EditorView) => void,
    ) {
        super();
    }

    eq(other: BoilerplateWidget) {
        return other.content === this.content && other.type === this.type && other.isCollapsed === this.isCollapsed;
    }

    toDOM(view: EditorView) {
        const wrap = document.createElement('div');
        wrap.className = `cm-boilerplate-widget cm-boilerplate-${this.type} w-full transition-colors duration-200`;

        // Toggle Bar - Thin and blended
        const bar = document.createElement('div');
        bar.className = `flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none border-slate-100 ${
            this.isCollapsed ? 'bg-slate-50/50 hover:bg-slate-100' : 'bg-slate-100/80 hover:bg-slate-100'
        }`;

        // Thin border based on type
        if (this.type === 'header') bar.classList.add('border-b');
        else bar.classList.add('border-t');

        // Very minimal arrow
        const arrow = document.createElement('span');
        arrow.style.fontSize = '7px';
        arrow.style.opacity = '0.5';
        arrow.style.display = 'inline-block';
        arrow.style.transform = this.isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
        arrow.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
        arrow.textContent = '▼';

        const title = document.createElement('span');
        title.className = 'text-[10px] font-bold text-slate-400 font-mono tracking-tight';
        title.textContent = this.type === 'header' ? 'Show Boilerplate Header' : 'Show Boilerplate Footer';

        bar.appendChild(arrow);
        bar.appendChild(title);

        bar.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onToggle?.(view);
        });

        wrap.appendChild(bar);

        // Code Content
        if (!this.isCollapsed) {
            const body = document.createElement('div');
            body.className = 'bg-slate-50/30 border-slate-100 font-mono text-[13px]';
            if (this.type === 'header') body.classList.add('border-b');
            else body.classList.add('border-t');

            const code = document.createElement('pre');
            code.className = 'p-4 m-0 overflow-x-auto leading-relaxed text-slate-400';
            code.textContent = this.content;
            body.appendChild(code);
            wrap.appendChild(body);
        }

        return wrap;
    }

    ignoreEvent() {
        return true;
    }

    get estimatedHeight() {
        if (this.isCollapsed) return 28; // Thinner
        const lines = this.content.split('\n').length;
        return lines * 20 + 40;
    }
}

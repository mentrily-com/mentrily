'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import type { AiConversationSummary } from '@/lib/ai/types';
import UsageMeter from '@/app/components/AiShared/UsageMeter';

function groupLabel(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const t = d.getTime();
    if (t >= startOfToday) return 'Today';
    if (t >= startOfToday - 86_400_000) return 'Yesterday';
    if (t >= startOfToday - 7 * 86_400_000) return 'Previous 7 days';
    return 'Older';
}

function Row({
    item,
    active,
    onSelect,
    onRename,
    onPin,
    onDelete,
}: {
    item: AiConversationSummary;
    active: boolean;
    onSelect: () => void;
    onRename: (title: string) => void;
    onPin: () => void;
    onDelete: () => void;
}) {
    const [menu, setMenu] = useState(false);
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(item.title);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menu) return;
        const onDoc = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) {
                setMenu(false);
                setConfirmDelete(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [menu]);

    if (editing) {
        return (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setEditing(false);
                    if (title.trim() && title !== item.title) onRename(title.trim());
                }}
                className="px-1"
            >
                <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => {
                        setEditing(false);
                        if (title.trim() && title !== item.title) onRename(title.trim());
                    }}
                    onKeyDown={(e) => e.key === 'Escape' && (setTitle(item.title), setEditing(false))}
                    maxLength={120}
                    aria-label="Chat title"
                    className="w-full rounded-lg border border-[var(--brand)] bg-white px-2.5 py-1.5 text-sm outline-none"
                />
            </form>
        );
    }

    return (
        <div ref={ref} className="group relative">
            <button
                type="button"
                onClick={onSelect}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                    active
                        ? 'bg-white font-medium text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                }`}
            >
                {item.pinned && <Pin size={12} className="shrink-0 text-slate-400" />}
                <span className="min-w-0 flex-1 truncate pr-6">{item.title}</span>
            </button>
            <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-label={`Options for ${item.title}`}
                aria-expanded={menu}
                className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 ${menu ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'}`}
            >
                <MoreHorizontal size={15} />
            </button>
            {menu && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    <button
                        type="button"
                        onClick={() => {
                            setMenu(false);
                            setEditing(true);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                    >
                        <Pencil size={13} /> Rename
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMenu(false);
                            onPin();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
                    >
                        {item.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                        {item.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                        type="button"
                        onClick={() => (confirmDelete ? (setMenu(false), onDelete()) : setConfirmDelete(true))}
                        className="flex w-full items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50"
                    >
                        <Trash2 size={13} /> {confirmDelete ? 'Click again to delete' : 'Delete'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ConversationList({
    items,
    loading,
    activeId,
    onSelect,
    onNew,
    onRename,
    onPin,
    onDelete,
}: {
    items: AiConversationSummary[];
    loading: boolean;
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onRename: (id: string, title: string) => void;
    onPin: (id: string, pinned: boolean) => void;
    onDelete: (id: string) => void;
}) {
    const [query, setQuery] = useState('');
    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q ? items.filter((i) => i.title.toLowerCase().includes(q)) : items;
        const map = new Map<string, AiConversationSummary[]>();
        for (const item of filtered) {
            const key = item.pinned ? 'Pinned' : groupLabel(item.lastMessageAt);
            map.set(key, [...(map.get(key) ?? []), item]);
        }
        const order = ['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Older'];
        return order.filter((k) => map.has(k)).map((k) => ({ label: k, items: map.get(k)! }));
    }, [items, query]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-2 p-3">
                <button
                    type="button"
                    onClick={onNew}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                    <Plus size={16} /> New chat
                </button>
                {items.length > 6 && (
                    <label className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5">
                        <Search size={14} className="text-slate-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search chats"
                            aria-label="Search chats"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                    </label>
                )}
            </div>

            <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3" aria-label="Chats">
                {loading && (
                    <div className="space-y-2 px-1">
                        {[70, 55, 80].map((w) => (
                            <div
                                key={w}
                                className="h-8 animate-pulse rounded-lg bg-slate-200/60"
                                style={{ width: `${w}%` }}
                            />
                        ))}
                    </div>
                )}
                {!loading && items.length === 0 && (
                    <p className="px-3 text-xs leading-5 text-slate-500">Your chats will appear here.</p>
                )}
                {groups.map((group) => (
                    <div key={group.label} className="space-y-0.5">
                        <p className="px-2.5 pb-1 text-[11px] font-medium text-slate-400">{group.label}</p>
                        {group.items.map((item) => (
                            <Row
                                key={item.id}
                                item={item}
                                active={item.id === activeId}
                                onSelect={() => onSelect(item.id)}
                                onRename={(title) => onRename(item.id, title)}
                                onPin={() => onPin(item.id, !item.pinned)}
                                onDelete={() => onDelete(item.id)}
                            />
                        ))}
                    </div>
                ))}
            </nav>

            <div className="border-t border-slate-200/70 p-4">
                <UsageMeter />
            </div>
        </div>
    );
}

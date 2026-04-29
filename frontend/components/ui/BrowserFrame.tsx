export default function BrowserFrame({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-2xl overflow-hidden"
            style={{
                border: '1px solid #E2E8F0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.05)',
            }}
        >
            {/* Content area */}
            <div style={{ backgroundColor: '#FFFFFF' }}>
                {children}
            </div>
        </div>
    );
}

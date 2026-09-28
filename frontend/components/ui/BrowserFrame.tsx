export default function BrowserFrame({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-lg overflow-hidden"
            style={{
                border: '1px solid #dce0e6',
                boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.05)',
            }}
        >
            <div style={{ backgroundColor: '#FFFFFF' }}>{children}</div>
        </div>
    );
}

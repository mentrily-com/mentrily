export default function BrowserFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-lg overflow-hidden border border-gray-300 shadow-lg">
            <div className="bg-white">{children}</div>
        </div>
    );
}

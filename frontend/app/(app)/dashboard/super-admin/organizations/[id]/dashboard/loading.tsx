import OrgControlsSkeleton from '@/app/components/Skeletons/OrgControlsSkeleton';
import AdminDashboardViewSkeleton from '@/app/components/Skeletons/AdminDashboardViewSkeleton';

export default function Loading() {
    return (
        <div className="space-y-8">
            <OrgControlsSkeleton />
            <AdminDashboardViewSkeleton />
        </div>
    );
}

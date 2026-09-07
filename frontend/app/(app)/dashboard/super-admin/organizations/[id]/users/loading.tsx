'use client';

import AdminUsersViewSkeleton from '@/app/components/Skeletons/AdminUsersViewSkeleton';

// AdminUsersView (which this route renders) already falls back to
// AdminUsersViewSkeleton while its own data resolves. Matching it here means the
// route-transition fallback and the mounted page show the same shape, instead
// of the parent dashboard skeleton flashing first and then being replaced.
export default function Loading() {
    return <AdminUsersViewSkeleton />;
}

import React from 'react';
import TeacherStudentsPage from '@/app/(app)/dashboard/creator/_components/TeacherStudentsPage';

// Server component: the route shell renders on the server and the interactive
// roster/groups/announcements UI mounts as a client island. The previous
// wrapper was 'use client' only to read the session role via usePlan() and
// pick a loading skeleton, but this route always renders TeacherStudentsPage,
// which owns its own loading/skeleton and data fetching — so the client hook
// was pure overhead in this route's entry bundle. Dropping it lets the child
// start fetching immediately instead of waiting on the session query.
export default function CreatorUsersPage() {
    return <TeacherStudentsPage />;
}

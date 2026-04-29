'use server';

import { auth } from '@clerk/nextjs/server';

export async function logoutAction() {
    return { success: true };
}

export async function getAuthToken() {
    const { getToken } = await auth();
    return await getToken();
}

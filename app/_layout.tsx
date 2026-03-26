import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="project/[id]" />
                <Stack.Screen name="task/[id]" />
                <Stack.Screen name="customer/[id]" />
                <Stack.Screen name="dagplanning" />
            </Stack>
        </QueryClientProvider>
    );
}

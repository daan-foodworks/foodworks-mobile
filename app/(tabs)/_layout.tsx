import { Redirect, Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { ActivityIndicator, View } from 'react-native';
import { MenuProvider, useMenu } from '../../contexts/MenuContext';
import { SideMenu } from '../../components/SideMenu';

function TabsContent() {
    const { isMenuOpen, closeMenu } = useMenu();
    const user = useAuthStore((s) => s.user);
    const isShiftleader = user?.role === 'SHIFTLEADER';

    return (
        <>
            <SideMenu visible={isMenuOpen} onClose={closeMenu} />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: '#1976D2',
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Dashboard',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="projects"
                    options={{
                        title: 'Projecten',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="folder-multiple" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="ritten"
                    options={{
                        title: 'Ritten',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="truck-outline" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="tasks"
                    options={{
                        title: 'Taken',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="checkbox-marked-circle" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="customers"
                    options={{
                        title: 'Klanten',
                        href: isShiftleader ? null : undefined,
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="account-group" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="voorraad"
                    options={{
                        title: 'Voorraad',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="package-variant-closed" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="agenda"
                    options={{
                        title: 'Agenda',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="calendar-month" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="notifications"
                    options={{
                        title: 'Notificaties',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="bell" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profiel',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="account" size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>
        </>
    );
}

export default function TabsLayout() {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <MenuProvider>
            <TabsContent />
        </MenuProvider>
    );
}

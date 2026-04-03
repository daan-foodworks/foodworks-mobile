import { Redirect, Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';
import { ActivityIndicator, View } from 'react-native';
import { MenuProvider, useMenu } from '../../contexts/MenuContext';
import { SideMenu } from '../../components/SideMenu';

function TabsContent() {
    const { isMenuOpen, closeMenu } = useMenu();

    return (
        <>
            <SideMenu visible={isMenuOpen} onClose={closeMenu} />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: '#1976D2',
                }}
            >
                {/* ZICHTBARE TABS */}
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
                    name="agenda"
                    options={{
                        title: 'Agenda',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="calendar-month" size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="operationeel"
                    options={{
                        title: 'Operationeel',
                        tabBarIcon: ({ color, size }) => (
                            <MaterialCommunityIcons name="lightning-bolt" size={size} color={color} />
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

                {/* VERBORGEN TABS (blijven als route bestaan) */}
                <Tabs.Screen name="projects" options={{ href: null }} />
                <Tabs.Screen name="ritten" options={{ href: null }} />
                <Tabs.Screen name="tasks" options={{ href: null }} />
                <Tabs.Screen name="customers" options={{ href: null }} />
                <Tabs.Screen name="voorraad" options={{ href: null }} />
                <Tabs.Screen name="leveringen" options={{ href: null }} />
                <Tabs.Screen name="notifications" options={{ href: null }} />
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

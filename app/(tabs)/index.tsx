import React from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { useAuthStore } from '../../stores/authStore';
import { useMenu } from '../../contexts/MenuContext';

export default function DashboardScreen() {
    const router = useRouter();
    const { user, clearAuth } = useAuthStore();
    const { openMenu } = useMenu();

    // Fetch dashboard stats
    const { data: stats } = useQuery({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const projects = await directApi.projects.getAll();

            return {
                totalProjects: projects.length,
                activeProjects: projects.filter((p: any) => p.status === 'ACTIVE').length,
                plannedProjects: projects.filter((p: any) => p.status === 'PLANNED').length,
            };
        },
    });

    const handleLogout = async () => {
        await clearAuth();
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView style={styles.container}>
                <View>
                    {/* Header Actions */}
                    <View style={styles.actionWrapper}>
                        <TouchableOpacity
                            onPress={openMenu}
                            style={{ marginRight: 'auto' }}>
                            <View style={styles.action}>
                                <FeatherIcon color="#6a99e3" name="menu" size={22} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')}>
                            <View style={styles.action}>
                                <FeatherIcon color="#6a99e3" name="bell" size={22} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                            <View style={styles.action}>
                                <FeatherIcon color="#6a99e3" name="user" size={22} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Welcome Section */}
                    <Text style={styles.title}>
                        Welkom, {user?.name?.split(' ')[0] || 'Gebruiker'}!
                    </Text>
                    <Text style={styles.subtitle}>Hier is je overzicht van vandaag</Text>

                    {/* Stats Cards */}
                    <View style={styles.statsContainer}>
                        <TouchableOpacity
                            style={styles.statCard}
                            onPress={() => router.push('/(tabs)/projects')}>
                            <View style={styles.statIconContainer}>
                                <FeatherIcon name="briefcase" size={24} color="#3B82F6" />
                            </View>
                            <Text style={styles.statValue}>{stats?.totalProjects || 0}</Text>
                            <Text style={styles.statLabel}>Totaal Projecten</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCard}
                            onPress={() => router.push('/(tabs)/projects')}>
                            <View style={[styles.statIconContainer, { backgroundColor: '#DCFCE7' }]}>
                                <FeatherIcon name="activity" size={24} color="#10B981" />
                            </View>
                            <Text style={styles.statValue}>{stats?.activeProjects || 0}</Text>
                            <Text style={styles.statLabel}>Actieve Projecten</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCard}
                            onPress={() => router.push('/(tabs)/projects')}>
                            <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
                                <FeatherIcon name="clock" size={24} color="#F59E0B" />
                            </View>
                            <Text style={styles.statValue}>{stats?.plannedProjects || 0}</Text>
                            <Text style={styles.statLabel}>Geplande Projecten</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Quick Actions */}
                    <Text style={styles.sectionTitle}>Snelle Acties</Text>
                    <View style={styles.quickActions}>
                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={() => router.push('/(tabs)/projects')}>
                            <View style={styles.quickActionIcon}>
                                <FeatherIcon name="folder" size={28} color="#3B82F6" />
                            </View>
                            <Text style={styles.quickActionText}>Projecten</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={() => router.push('/(tabs)/tasks')}>
                            <View style={styles.quickActionIcon}>
                                <FeatherIcon name="check-square" size={28} color="#10B981" />
                            </View>
                            <Text style={styles.quickActionText}>Taken</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={() => router.push('/(tabs)/customers')}>
                            <View style={styles.quickActionIcon}>
                                <FeatherIcon name="users" size={28} color="#8B5CF6" />
                            </View>
                            <Text style={styles.quickActionText}>Klanten</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={() => router.push('/dagplanning' as any)}>
                            <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                                <FeatherIcon name="map" size={28} color="#F59E0B" />
                            </View>
                            <Text style={styles.quickActionText}>Dagplanning</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCard}
                            onPress={handleLogout}>
                            <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                                <FeatherIcon name="log-out" size={28} color="#EF4444" />
                            </View>
                            <Text style={styles.quickActionText}>Uitloggen</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    title: {
        fontSize: 27,
        fontWeight: '700',
        color: '#222',
        marginTop: 24,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#222',
        marginTop: 32,
        marginBottom: 16,
    },
    /** Action */
    action: {
        width: 48,
        height: 48,
        borderRadius: 12,
        marginHorizontal: 8,
        backgroundColor: '#e8f0f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginHorizontal: -8,
    },
    /** Stats */
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 4,
        alignItems: 'center',
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6B7280',
        textAlign: 'center',
    },
    /** Quick Actions */
    quickActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    quickActionCard: {
        width: '50%',
        padding: 8,
    },
    quickActionIcon: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#F0F6FB',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    quickActionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#222',
        textAlign: 'center',
    },
});

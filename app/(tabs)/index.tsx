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
import { isToday, format } from 'date-fns';
import { nl } from 'date-fns/locale';

const PRIORITY_COLOR: Record<string, string> = {
    HIGH: '#EF4444',
    MEDIUM: '#F59E0B',
    LOW: '#10B981',
};

export default function DashboardScreen() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { openMenu } = useMenu();

    const { data: projects } = useQuery({
        queryKey: ['dashboard-projects'],
        queryFn: () => directApi.projects.getAll(),
    });

    const { data: tasks } = useQuery({
        queryKey: ['dashboard-tasks'],
        queryFn: () => directApi.tasks.getAll(),
    });

    const stats = React.useMemo(() => {
        if (!projects) return { total: 0, active: 0, planned: 0 };
        return {
            total: projects.length,
            active: (projects as any[]).filter((p) => p.status === 'ACTIVE').length,
            planned: (projects as any[]).filter((p) => p.status === 'PLANNED').length,
        };
    }, [projects]);

    const todayEvents = React.useMemo(() => {
        if (!projects) return [];
        return (projects as any[])
            .filter((p) => p.eventStartDate && isToday(new Date(p.eventStartDate)))
            .slice(0, 3);
    }, [projects]);

    const openTasks = React.useMemo(() => {
        if (!tasks) return [];
        return (tasks as any[])
            .filter((t) => t.status === 'TODO')
            .sort((a, b) => {
                const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
            })
            .slice(0, 3);
    }, [tasks]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView style={styles.container}>
                <View>
                    {/* Header Actions */}
                    <View style={styles.actionWrapper}>
                        <TouchableOpacity onPress={openMenu} style={{ marginRight: 'auto' }}>
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

                    {/* Welcome */}
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
                            <Text style={styles.statValue}>{stats.total}</Text>
                            <Text style={styles.statLabel}>Totaal{'\n'}Projecten</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCard}
                            onPress={() => router.push('/(tabs)/projects')}>
                            <View style={[styles.statIconContainer, { backgroundColor: '#DCFCE7' }]}>
                                <FeatherIcon name="activity" size={24} color="#10B981" />
                            </View>
                            <Text style={styles.statValue}>{stats.active}</Text>
                            <Text style={styles.statLabel}>Actieve{'\n'}Projecten</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.statCard}
                            onPress={() => router.push('/(tabs)/projects')}>
                            <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
                                <FeatherIcon name="clock" size={24} color="#F59E0B" />
                            </View>
                            <Text style={styles.statValue}>{stats.planned}</Text>
                            <Text style={styles.statLabel}>Geplande{'\n'}Projecten</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Vandaag op de agenda */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Vandaag op de agenda</Text>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/agenda')}>
                            <Text style={styles.sectionLink}>Bekijk agenda →</Text>
                        </TouchableOpacity>
                    </View>

                    {todayEvents.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <FeatherIcon name="calendar" size={20} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Geen events vandaag</Text>
                        </View>
                    ) : (
                        todayEvents.map((event: any) => (
                            <TouchableOpacity
                                key={event.id}
                                style={styles.eventCard}
                                onPress={() => router.push(`/project/${event.id}` as any)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.eventDot} />
                                <View style={styles.eventInfo}>
                                    <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
                                    <Text style={styles.eventMeta}>
                                        {event.eventStartDate
                                            ? format(new Date(event.eventStartDate), 'HH:mm', { locale: nl })
                                            : ''}
                                        {event.location ? `  ·  ${event.location}` : ''}
                                    </Text>
                                </View>
                                <FeatherIcon name="chevron-right" size={16} color="#D1D5DB" />
                            </TouchableOpacity>
                        ))
                    )}

                    {/* Openstaande taken */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Openstaande taken</Text>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
                            <Text style={styles.sectionLink}>Bekijk alle →</Text>
                        </TouchableOpacity>
                    </View>

                    {openTasks.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <FeatherIcon name="check-circle" size={20} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Geen openstaande taken</Text>
                        </View>
                    ) : (
                        openTasks.map((task: any) => (
                            <TouchableOpacity
                                key={task.id}
                                style={styles.taskCard}
                                onPress={() => router.push(`/task/${task.id}` as any)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.priorityBar, { backgroundColor: PRIORITY_COLOR[task.priority] ?? '#9CA3AF' }]} />
                                <View style={styles.taskInfo}>
                                    <Text style={styles.taskTitle} numberOfLines={1}>{task.title}</Text>
                                    {task.project?.name && (
                                        <Text style={styles.taskMeta}>{task.project.name}</Text>
                                    )}
                                </View>
                                <FeatherIcon name="chevron-right" size={16} color="#D1D5DB" />
                            </TouchableOpacity>
                        ))
                    )}

                    <View style={{ height: 32 }} />
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
    /** Header */
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
        marginBottom: 32,
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
    /** Section headers */
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    sectionLink: {
        fontSize: 14,
        fontWeight: '500',
        color: '#3B82F6',
    },
    /** Empty state */
    emptyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    /** Event card */
    eventCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
    },
    eventDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#3B82F6',
        marginRight: 12,
    },
    eventInfo: {
        flex: 1,
    },
    eventName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    eventMeta: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    /** Task card */
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        overflow: 'hidden',
    },
    priorityBar: {
        width: 4,
        height: '100%',
        borderRadius: 2,
        marginRight: 12,
        minHeight: 36,
    },
    taskInfo: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    taskMeta: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
});

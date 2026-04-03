import React from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { useMenu } from '../../contexts/MenuContext';

export default function ProjectsScreen() {
    const router = useRouter();
    const { openMenu } = useMenu();

    const { data: projects, isLoading, refetch } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            return await directApi.projects.getAll();
        },
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return '#10B981';
            case 'PLANNED':
                return '#F59E0B';
            case 'COMPLETED':
                return '#3B82F6';
            case 'ARCHIVED':
                return '#6B7280';
            default:
                return '#6B7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PLANNED': return 'Gepland';
            case 'ACTIVE': return 'Actief';
            case 'COMPLETED': return 'Afgerond';
            case 'ARCHIVED': return 'Archief';
            default: return status;
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={openMenu}>
                            <FeatherIcon name="menu" size={22} color="#6B7280" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Projecten</Text>
                    </View>
                    <Text style={styles.subtitle}>
                        {projects?.length || 0} {projects?.length === 1 ? 'project' : 'projecten'}
                    </Text>
                </View>

                {/* Projects List */}
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
                    }>
                    {(() => {
                        const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2, ARCHIVED: 3 };
                        const sortedProjects = [...(projects || [])].sort((a: any, b: any) => {
                            const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
                            if (statusDiff !== 0) return statusDiff;
                            const dateA = a.eventStartDate ? new Date(a.eventStartDate).getTime() : Infinity;
                            const dateB = b.eventStartDate ? new Date(b.eventStartDate).getTime() : Infinity;
                            return dateA - dateB;
                        });
                        return sortedProjects.map((project: any) => (
                        <TouchableOpacity
                            key={project.id}
                            style={styles.card}
                            onPress={() => router.push(`/project/${project.id}`)}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardIcon}>
                                    <FeatherIcon name="folder" size={20} color="#3B82F6" />
                                </View>
                                <View style={styles.cardBadge}>
                                    <View
                                        style={[
                                            styles.statusDot,
                                            { backgroundColor: getStatusColor(project.status) },
                                        ]}
                                    />
                                    <Text style={styles.statusText}>
                                        {getStatusLabel(project.status)}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.cardTitle}>{project.title}</Text>
                            <Text style={styles.cardSubtitle} numberOfLines={2}>
                                {project.description || 'Geen beschrijving'}
                            </Text>

                            <View style={styles.cardFooter}>
                                <View style={styles.cardMeta}>
                                    <FeatherIcon name="calendar" size={14} color="#6B7280" />
                                    <Text style={styles.cardMetaText}>
                                        {project.eventStartDate
                                            ? new Date(project.eventStartDate).toLocaleDateString('nl-NL', {
                                                day: 'numeric',
                                                month: 'short',
                                            })
                                            : 'Geen datum'}
                                    </Text>
                                </View>

                                {project.projectManager && (
                                    <View style={styles.cardMeta}>
                                        <FeatherIcon name="user" size={14} color="#6B7280" />
                                        <Text style={styles.cardMetaText} numberOfLines={1}>
                                            {project.projectManager.name}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.cardArrow}>
                                <FeatherIcon name="chevron-right" size={20} color="#9CA3AF" />
                            </View>
                        </TouchableOpacity>
                    ));
                    })()}

                    {projects?.length === 0 && !isLoading && (
                        <View style={styles.emptyState}>
                            <FeatherIcon name="folder" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>Geen projecten</Text>
                            <Text style={styles.emptyText}>
                                Er zijn nog geen projecten aangemaakt
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    title: {
        fontSize: 27,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#6B7280',
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: 16,
    },
    /** Card */
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        position: 'relative',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        fontWeight: '400',
        color: '#6B7280',
        marginBottom: 16,
        lineHeight: 20,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    cardMetaText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    cardArrow: {
        position: 'absolute',
        right: 16,
        top: '50%',
        marginTop: -10,
    },
    /** Empty State */
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: 16,
        marginBottom: 4,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '400',
        color: '#9CA3AF',
        textAlign: 'center',
    },
});

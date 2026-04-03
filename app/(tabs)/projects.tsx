import React, { useMemo, useState } from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import RBSheet from 'react-native-raw-bottom-sheet';
import { directApi } from '../../lib/directApi';
import { useMenu } from '../../contexts/MenuContext';

const SORT_OPTIONS = [
    { label: 'Meest recent', value: 'recent' },
    { label: 'Naam A–Z', value: 'name_asc' },
    { label: 'Naam Z–A', value: 'name_desc' },
    { label: 'Status', value: 'status' },
];

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PLANNED: 1, COMPLETED: 2, ARCHIVED: 3 };

export default function ProjectsScreen() {
    const router = useRouter();
    const { openMenu } = useMenu();

    const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
    const [filterStatus, setFilterStatus] = useState<string | null>(filterParam ?? null);

    const sortSheet = React.useRef<any>();
    const [sortBy, setSortBy] = useState('recent');

    const { data: projects, isLoading, refetch } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            return await directApi.projects.getAll();
        },
    });

    const sortedProjects = useMemo(() => {
        if (!projects) return [];
        let arr = [...(projects as any[])];
        if (filterStatus) arr = arr.filter((p) => p.status === filterStatus);
        switch (sortBy) {
            case 'name_asc': return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            case 'name_desc': return arr.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
            case 'status': return arr.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
            default: return arr.sort((a, b) => new Date(b.createdAt || b.eventStartDate || 0).getTime() - new Date(a.createdAt || a.eventStartDate || 0).getTime());
        }
    }, [projects, sortBy, filterStatus]);

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={styles.subtitle}>
                            {projects?.length || 0} {(projects as any)?.length === 1 ? 'project' : 'projecten'}
                        </Text>
                        <TouchableOpacity onPress={() => sortSheet.current?.open()}>
                            <FeatherIcon name="sliders" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Active filter chip */}
                {filterStatus && (
                    <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() => setFilterStatus(null)}
                        activeOpacity={0.7}>
                        <View style={[styles.filterDot, { backgroundColor: getStatusColor(filterStatus) }]} />
                        <Text style={styles.filterChipText}>{getStatusLabel(filterStatus)}</Text>
                        <FeatherIcon name="x" size={14} color="#6B7280" />
                    </TouchableOpacity>
                )}

                {/* Projects List */}
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
                    }>
                    {(() => {
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

                    {sortedProjects.length === 0 && !isLoading && (
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

            {/* Sort sheet */}
            <RBSheet
                ref={sortSheet}
                customStyles={{ container: { borderTopLeftRadius: 14, borderTopRightRadius: 14 } }}
                height={380}
                openDuration={250}>
                <View style={{ borderBottomWidth: 1, borderColor: '#efefef', padding: 16 }}>
                    <Text style={{ fontSize: 20, fontWeight: '600', textAlign: 'center' }}>Sorteren</Text>
                </View>
                <View style={{ padding: 8 }}>
                    {SORT_OPTIONS.map((opt, i) => (
                        <TouchableOpacity key={opt.value} onPress={() => { setSortBy(opt.value); sortSheet.current?.close(); }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderColor: '#e7e7e7' }}>
                                <View style={{ width: 18, height: 18, borderRadius: 9999, borderWidth: sortBy === opt.value ? 5 : 2, borderColor: '#1d1d1d', marginRight: 12 }} />
                                <Text style={{ fontSize: 16, fontWeight: '500', color: '#2d2d3a' }}>{opt.label}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </RBSheet>
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
    /** Filter chip */
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginHorizontal: 16,
        marginBottom: 4,
        gap: 6,
    },
    filterDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
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

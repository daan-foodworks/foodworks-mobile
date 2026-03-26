import React from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { directApi } from '../../lib/directApi';
import { useMenu } from '../../contexts/MenuContext';
import { format, isAfter, isBefore, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { nl } from 'date-fns/locale';

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT:     { label: 'Concept',    color: '#6B7280', bg: '#F3F4F6' },
    PLANNED:   { label: 'Gepland',    color: '#1D4ED8', bg: '#DBEAFE' },
    ACTIVE:    { label: 'Actief',     color: '#B45309', bg: '#FEF3C7' },
    COMPLETED: { label: 'Afgerond',   color: '#065F46', bg: '#D1FAE5' },
    CANCELLED: { label: 'Geannuleerd',color: '#B91C1C', bg: '#FEE2E2' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEventDate(start: string, end?: string | null) {
    const s = new Date(start);
    if (!end) return format(s, 'EEE d MMM · HH:mm', { locale: nl });
    const e = new Date(end);
    const sameDay = format(s, 'yyyy-MM-dd') === format(e, 'yyyy-MM-dd');
    if (sameDay) {
        return `${format(s, 'EEE d MMM', { locale: nl })} · ${format(s, 'HH:mm')}–${format(e, 'HH:mm')}`;
    }
    return `${format(s, 'd MMM', { locale: nl })} – ${format(e, 'd MMM', { locale: nl })}`;
}

interface EventProject {
    id: string;
    name: string;
    status: string;
    eventStartDate: string;
    eventEndDate?: string | null;
    eventLocation?: string | null;
    projectManager?: { firstName: string; lastName: string } | null;
}

function groupProjects(projects: EventProject[]) {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

    const thisWeek: EventProject[] = [];
    const nextWeek: EventProject[] = [];
    const later: EventProject[] = [];

    for (const p of projects) {
        const d = new Date(p.eventStartDate);
        if (!isAfter(d, endOfDay(addDays(now, -1)))) continue; // skip past events
        if (isBefore(d, weekEnd) || format(d, 'yyyy-MM-dd') <= format(weekEnd, 'yyyy-MM-dd')) {
            thisWeek.push(p);
        } else if (
            isAfter(d, nextWeekStart) && isBefore(d, addDays(nextWeekEnd, 1))
        ) {
            nextWeek.push(p);
        } else {
            later.push(p);
        }
    }

    return { thisWeek, nextWeek, later };
}

// ─── Event card ──────────────────────────────────────────────────────────────

function EventCard({ project, onPress }: { project: EventProject; onPress: () => void }) {
    const statusConf = STATUS_CONFIG[project.status] ?? { label: project.status, color: '#6B7280', bg: '#F3F4F6' };

    return (
        <TouchableOpacity style={styles.eventCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.eventLeft}>
                <View style={[styles.statusDot, { backgroundColor: statusConf.color }]} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.eventName} numberOfLines={1}>{project.name}</Text>
                <Text style={styles.eventDate}>
                    {formatEventDate(project.eventStartDate, project.eventEndDate)}
                </Text>
                {project.eventLocation && (
                    <View style={styles.locationRow}>
                        <FeatherIcon name="map-pin" size={11} color="#9CA3AF" />
                        <Text style={styles.eventLocation} numberOfLines={1}>{project.eventLocation}</Text>
                    </View>
                )}
                {project.projectManager && (
                    <View style={styles.locationRow}>
                        <FeatherIcon name="user" size={11} color="#9CA3AF" />
                        <Text style={styles.eventLocation}>
                            {project.projectManager.firstName} {project.projectManager.lastName}
                        </Text>
                    </View>
                )}
            </View>
            <View>
                <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
                    <Text style={[styles.statusText, { color: statusConf.color }]}>{statusConf.label}</Text>
                </View>
                <FeatherIcon name="chevron-right" size={16} color="#D1D5DB" style={{ alignSelf: 'flex-end', marginTop: 8 }} />
            </View>
        </TouchableOpacity>
    );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
    return (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{count}</Text>
            </View>
        </View>
    );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AgendaScreen() {
    const { openMenu } = useMenu();
    const router = useRouter();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['projects-agenda'],
        queryFn: () => directApi.projects.getAll(),
    });

    const allProjects: any[] = Array.isArray(data) ? data : (data as any)?.projects ?? [];

    // Only projects with eventStartDate and active/planned status
    const eventProjects: EventProject[] = allProjects
        .filter((p: any) => p.eventStartDate && ['PLANNED', 'ACTIVE', 'DRAFT'].includes(p.status))
        .sort((a: any, b: any) =>
            new Date(a.eventStartDate).getTime() - new Date(b.eventStartDate).getTime()
        );

    const { thisWeek, nextWeek, later } = groupProjects(eventProjects);
    const total = eventProjects.length;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={openMenu}>
                        <FeatherIcon name="menu" size={22} color="#6B7280" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Agenda</Text>
                </View>
                <Text style={styles.subtitle}>{total} {total === 1 ? 'evenement' : 'evenementen'}</Text>
            </View>

            {isLoading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : total === 0 ? (
                <View style={styles.centerContent}>
                    <FeatherIcon name="calendar" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Geen evenementen</Text>
                    <Text style={styles.emptyText}>Er zijn geen aankomende evenementen</Text>
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
                >
                    {thisWeek.length > 0 && (
                        <>
                            <SectionHeader title="Deze week" count={thisWeek.length} />
                            {thisWeek.map(p => (
                                <EventCard
                                    key={p.id}
                                    project={p}
                                    onPress={() => router.push(`/project/${p.id}` as any)}
                                />
                            ))}
                        </>
                    )}

                    {nextWeek.length > 0 && (
                        <>
                            <SectionHeader title="Volgende week" count={nextWeek.length} />
                            {nextWeek.map(p => (
                                <EventCard
                                    key={p.id}
                                    project={p}
                                    onPress={() => router.push(`/project/${p.id}` as any)}
                                />
                            ))}
                        </>
                    )}

                    {later.length > 0 && (
                        <>
                            <SectionHeader title="Later" count={later.length} />
                            {later.map(p => (
                                <EventCard
                                    key={p.id}
                                    project={p}
                                    onPress={() => router.push(`/project/${p.id}` as any)}
                                />
                            ))}
                        </>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#6B7280',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
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
        color: '#9CA3AF',
        textAlign: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        backgroundColor: '#E5E7EB',
        borderRadius: 99,
    },
    sectionBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    eventCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    eventLeft: {
        paddingTop: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    eventName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 3,
    },
    eventDate: {
        fontSize: 13,
        fontWeight: '500',
        color: '#3B82F6',
        marginBottom: 3,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    eventLocation: {
        fontSize: 12,
        fontWeight: '400',
        color: '#9CA3AF',
        flex: 1,
    },
    statusBadge: {
        alignSelf: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 99,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
});

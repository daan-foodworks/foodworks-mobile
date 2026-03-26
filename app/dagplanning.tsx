import React, { useState } from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    ScrollView, RefreshControl, Linking, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { directApi } from '../lib/directApi';
import { useAuthStore } from '../stores/authStore';
import { format, addDays, subDays } from 'date-fns';
import { nl } from 'date-fns/locale';

// ─── Movement type config ───────────────────────────────────────────────────

const MOVEMENT_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    RIT_DEPARTURE:    { icon: 'truck',       label: 'Rit heenreis',  color: '#1D4ED8', bg: '#DBEAFE' },
    RIT_RETURN:       { icon: 'truck',       label: 'Rit retour',    color: '#065F46', bg: '#D1FAE5' },
    UNIT_DEPARTURE:   { icon: 'package',     label: 'Unit heenreis', color: '#B45309', bg: '#FEF3C7' },
    UNIT_RETURN:      { icon: 'package',     label: 'Unit retour',   color: '#6B7280', bg: '#F3F4F6' },
    DELIVERY:         { icon: 'box',         label: 'Levering',      color: '#7C3AED', bg: '#EDE9FE' },
    PERSONNEL_RIDE:   { icon: 'users',       label: 'Personeelsvervoer', color: '#BE185D', bg: '#FCE7F3' },
    STAY_AT_LOCATION: { icon: 'map-pin',     label: 'Op locatie',    color: '#059669', bg: '#D1FAE5' },
    TRAVEL:           { icon: 'navigation',  label: 'Rijden',        color: '#6B7280', bg: '#F9FAFB' },
};

function fmtTime(d?: string | null) {
    if (!d) return '—';
    return format(new Date(d), 'HH:mm');
}

// ─── Movement card ────────────────────────────────────────────────────────────

function MovementCard({ movement }: { movement: any }) {
    const conf = MOVEMENT_CONFIG[movement.type] ?? { icon: 'circle', label: movement.type, color: '#6B7280', bg: '#F3F4F6' };
    const isRit = movement.type === 'RIT_DEPARTURE' || movement.type === 'RIT_RETURN';
    const isTravel = movement.type === 'TRAVEL';
    const isStay = movement.type === 'STAY_AT_LOCATION';

    function openMaps(location: string) {
        Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(location)}`);
    }

    if (isTravel) {
        return (
            <View style={styles.travelCard}>
                <FeatherIcon name="navigation" size={14} color="#6B7280" />
                <Text style={styles.travelText}>
                    Rijden {movement.from} → {movement.to}
                    {movement.durationMinutes ? ` · ~${movement.durationMinutes} min` : ''}
                    {movement.distanceKm ? ` · ${movement.distanceKm.toFixed(1)} km` : ''}
                </Text>
            </View>
        );
    }

    if (isStay) {
        return (
            <View style={[styles.stayCard, { borderLeftColor: conf.color }]}>
                <Text style={styles.stayLabel}>Op locatie: {movement.location}</Text>
                {movement.durationMinutes > 0 && (
                    <Text style={styles.stayDuration}>{movement.durationMinutes} min</Text>
                )}
            </View>
        );
    }

    return (
        <View style={styles.movementCard}>
            {/* Time + icon column */}
            <View style={styles.timeColumn}>
                <Text style={styles.timeText}>{fmtTime(movement.time)}</Text>
                <View style={[styles.iconCircle, { backgroundColor: conf.bg }]}>
                    <FeatherIcon name={conf.icon} size={14} color={conf.color} />
                </View>
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                <View style={styles.movementHeader}>
                    <Text style={styles.movementType}>{conf.label}</Text>
                    {movement.project?.projectNumber && (
                        <Text style={styles.projectNumber}>{movement.project.projectNumber}</Text>
                    )}
                </View>

                {movement.project?.title && (
                    <Text style={styles.projectTitle} numberOfLines={1}>{movement.project.title}</Text>
                )}

                {/* Route */}
                {movement.from && (
                    <View style={styles.routeRow}>
                        <FeatherIcon name="arrow-right" size={12} color="#9CA3AF" />
                        <Text style={styles.routeText} numberOfLines={1}>
                            {movement.from}
                            {movement.to && movement.to !== movement.from ? ` → ${movement.to}` : ''}
                        </Text>
                    </View>
                )}

                {/* ETA */}
                {movement.estimatedArrivalAt && (
                    <Text style={styles.etaText}>
                        Aankomst ~{fmtTime(movement.estimatedArrivalAt)}
                    </Text>
                )}

                {/* Vehicle */}
                {movement.vehicle && (
                    <View style={styles.vehicleRow}>
                        <FeatherIcon name="truck" size={11} color="#9CA3AF" />
                        <Text style={styles.vehicleText}>
                            {movement.vehicle.name}
                            {movement.vehicle.licensePlate ? ` · ${movement.vehicle.licensePlate}` : ''}
                        </Text>
                    </View>
                )}

                {/* Notes (prominent yellow block) */}
                {movement.notes && (
                    <View style={styles.notesBlock}>
                        <FeatherIcon name="file-text" size={12} color="#92400E" />
                        <Text style={styles.notesText}>{movement.notes}</Text>
                    </View>
                )}

                {/* Maps button */}
                {(isRit && movement.to) && (
                    <TouchableOpacity
                        style={styles.mapsBtn}
                        onPress={() => openMaps(movement.to)}
                    >
                        <FeatherIcon name="map" size={13} color="#3B82F6" />
                        <Text style={styles.mapsBtnText}>Open in Maps</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DagplanningScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['driver-day-plan', user?.id, dateStr],
        queryFn: () => directApi.transport.getDriverDayPlan(user!.id, dateStr),
        enabled: !!user?.id,
    });

    const movements: any[] = (data as any)?.movements ?? [];
    const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <FeatherIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Dagplanning</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* Date picker row */}
            <View style={styles.datePicker}>
                <TouchableOpacity
                    style={styles.dateArrow}
                    onPress={() => setSelectedDate(d => subDays(d, 1))}
                >
                    <FeatherIcon name="chevron-left" size={20} color="#374151" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.dateCenter}
                    onPress={() => setSelectedDate(new Date())}
                >
                    <Text style={styles.dateText}>
                        {isToday ? 'Vandaag' : format(selectedDate, 'EEEE d MMMM', { locale: nl })}
                    </Text>
                    <Text style={styles.dateSubtext}>
                        {isToday
                            ? format(selectedDate, 'EEEE d MMMM', { locale: nl })
                            : format(selectedDate, 'yyyy')}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.dateArrow}
                    onPress={() => setSelectedDate(d => addDays(d, 1))}
                >
                    <FeatherIcon name="chevron-right" size={20} color="#374151" />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : movements.length === 0 ? (
                <View style={styles.centerContent}>
                    <FeatherIcon name="calendar" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Geen ritten</Text>
                    <Text style={styles.emptyText}>
                        {isToday ? 'Geen geplande ritten voor vandaag' : 'Geen ritten op deze datum'}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
                >
                    <Text style={styles.movementsCount}>
                        {movements.filter(m => m.type !== 'TRAVEL' && m.type !== 'STAY_AT_LOCATION').length} bewegingen
                    </Text>
                    {movements.map((movement: any, index: number) => (
                        <MovementCard key={movement.id ?? index} movement={movement} />
                    ))}
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#111827',
    },
    datePicker: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    dateArrow: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateCenter: {
        flex: 1,
        alignItems: 'center',
    },
    dateText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
        textTransform: 'capitalize',
    },
    dateSubtext: {
        fontSize: 13,
        fontWeight: '400',
        color: '#6B7280',
        textTransform: 'capitalize',
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
    movementsCount: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9CA3AF',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Movement card
    movementCard: {
        flexDirection: 'row',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    timeColumn: {
        alignItems: 'center',
        width: 44,
        gap: 6,
    },
    timeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    iconCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    movementHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    movementType: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
    },
    projectNumber: {
        fontSize: 11,
        fontWeight: '500',
        color: '#9CA3AF',
    },
    projectTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    routeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    routeText: {
        fontSize: 13,
        fontWeight: '400',
        color: '#6B7280',
        flex: 1,
    },
    etaText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#3B82F6',
        marginBottom: 4,
    },
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    vehicleText: {
        fontSize: 12,
        fontWeight: '400',
        color: '#9CA3AF',
    },
    notesBlock: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        backgroundColor: '#FFFBEB',
        borderLeftWidth: 3,
        borderLeftColor: '#F59E0B',
        borderRadius: 6,
        padding: 8,
        marginTop: 6,
        marginBottom: 4,
    },
    notesText: {
        fontSize: 13,
        fontWeight: '400',
        color: '#92400E',
        flex: 1,
        lineHeight: 18,
    },
    mapsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
    },
    mapsBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3B82F6',
    },
    // Travel segment
    travelCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 6,
        opacity: 0.6,
    },
    travelText: {
        fontSize: 12,
        fontWeight: '400',
        color: '#6B7280',
        flex: 1,
    },
    // Stay segment
    stayCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginBottom: 6,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
        borderLeftWidth: 3,
    },
    stayLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#065F46',
        flex: 1,
    },
    stayDuration: {
        fontSize: 12,
        fontWeight: '500',
        color: '#065F46',
    },
});

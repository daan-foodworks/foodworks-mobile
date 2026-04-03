import React, { useState } from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    ScrollView, RefreshControl, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { format, addMinutes } from 'date-fns';
import { nl } from 'date-fns/locale';

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT:       { label: 'Concept',      color: '#6B7280', bg: '#F3F4F6' },
    CONFIRMED:   { label: 'Bevestigd',   color: '#1D4ED8', bg: '#DBEAFE' },
    IN_PROGRESS: { label: 'Onderweg',    color: '#B45309', bg: '#FEF3C7' },
    COMPLETED:   { label: 'Afgerond',    color: '#065F46', bg: '#D1FAE5' },
    CANCELLED:   { label: 'Geannuleerd', color: '#B91C1C', bg: '#FEE2E2' },
};

/** Welke transitie knoppen tonen per status */
const TRANSITION_BUTTONS: Record<string, { to: string; label: string; icon: string; primary?: boolean; danger?: boolean }[]> = {
    DRAFT:       [{ to: 'CONFIRMED', label: 'Bevestigen', icon: 'check-circle', primary: true }],
    CONFIRMED:   [{ to: 'IN_PROGRESS', label: 'Rit starten', icon: 'play', primary: true }],
    IN_PROGRESS: [{ to: 'COMPLETED', label: 'Rit afronden', icon: 'check-square', primary: true }],
    COMPLETED:   [],
    CANCELLED:   [],
};

function fmtTijd(d: string | null | undefined) {
    if (!d) return '—';
    return format(new Date(d), 'HH:mm');
}

// ─── Stop regel ────────────────────────────────────────────────────────────────

function StopRegel({
    icon, label, sublabel, time, overrideTime, dwellMinutes, dwellNote, location,
}: {
    icon: string; label: string; sublabel?: string;
    time?: string | null; overrideTime?: string | null;
    dwellMinutes?: number | null; dwellNote?: string | null;
    location?: string | null;
}) {
    const effectiveTime = overrideTime || time;
    const hasOverride = !!overrideTime && overrideTime !== time;
    const dwellEnd = effectiveTime && dwellMinutes
        ? format(addMinutes(new Date(effectiveTime), dwellMinutes), 'HH:mm')
        : null;

    return (
        <View style={stopStyles.row}>
            {/* Tijdkolom */}
            <View style={stopStyles.timeCol}>
                <Text style={[stopStyles.time, hasOverride && stopStyles.timeOverride]}>
                    {effectiveTime ? format(new Date(effectiveTime), 'HH:mm') : '—'}
                </Text>
                {hasOverride && time && (
                    <Text style={stopStyles.timeOriginal}>{fmtTijd(time)}</Text>
                )}
            </View>

            {/* Icoon connector */}
            <View style={stopStyles.connector}>
                <View style={stopStyles.connectorDot}>
                    <FeatherIcon name={icon} size={14} color="#fff" />
                </View>
            </View>

            {/* Info */}
            <View style={stopStyles.info}>
                <Text style={stopStyles.label}>{label}</Text>
                {sublabel ? <Text style={stopStyles.sublabel}>{sublabel}</Text> : null}
                {location ? (
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
                        onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(location)}`)}
                        activeOpacity={0.7}
                    >
                        <FeatherIcon name="map-pin" size={11} color="#1D4ED8" />
                        <Text style={[stopStyles.sublabel, { color: '#1D4ED8', textDecorationLine: 'underline' }]}>{location}</Text>
                    </TouchableOpacity>
                ) : null}
                {dwellMinutes != null && dwellMinutes > 0 ? (
                    <View style={stopStyles.dwellChip}>
                        <FeatherIcon name="clock" size={11} color="#D97706" />
                        <Text style={stopStyles.dwellText}>
                            +{dwellMinutes} min{dwellNote ? ` · ${dwellNote}` : ''}
                            {dwellEnd ? `  → klaar ${dwellEnd}` : ''}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const stopStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
    timeCol: { width: 48, alignItems: 'flex-end', marginRight: 12, paddingTop: 2 },
    time: { fontSize: 14, fontWeight: '700', color: '#111827' },
    timeOverride: { color: '#1D4ED8' },
    timeOriginal: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
    connector: { alignItems: 'center', marginRight: 12 },
    connectorDot: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center',
    },
    info: { flex: 1 },
    label: { fontSize: 14, fontWeight: '600', color: '#111827' },
    sublabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    dwellChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
        backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    dwellText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
});

// ─── Scherm ────────────────────────────────────────────────────────────────────

export default function RitDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const qc = useQueryClient();

    const { data: rit, isLoading, refetch } = useQuery({
        queryKey: ['rit', id],
        queryFn: () => directApi.ritten.getById(id),
        enabled: !!id,
    });

    const statusMutation = useMutation({
        mutationFn: ({ status }: { status: string }) =>
            directApi.ritten.updateStatus(id, status),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['rit', id] });
            qc.invalidateQueries({ queryKey: ['mijn-ritten'] });
        },
        onError: (e: any) => Alert.alert('Fout', e?.message ?? 'Statuswijziging mislukt'),
    });

    const handleTransition = (to: string, label: string) => {
        Alert.alert(
            label,
            `Weet je zeker dat je de rit wilt ${label.toLowerCase()}?`,
            [
                { text: 'Annuleren', style: 'cancel' },
                { text: label, style: to === 'COMPLETED' ? 'destructive' : 'default',
                  onPress: () => statusMutation.mutate({ status: to }) },
            ]
        );
    };

    if (isLoading || !rit) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1976D2" />
            </SafeAreaView>
        );
    }

    const sc = STATUS_CONFIG[rit.status] ?? STATUS_CONFIG.DRAFT;
    const transitions = TRANSITION_BUTTONS[rit.status] ?? [];

    // Planbord stops opbouwen
    const stops: any[] = [];
    if (rit.departureAt) {
        stops.push({ type: 'depot', icon: 'truck', label: 'Vertrek depot', time: rit.departureAt, location: rit.departureLocation });
    }
    (rit.departureUnits ?? []).forEach((u: any) => {
        stops.push({
            type: 'unit_dep', icon: 'package',
            label: `Vertrek: ${u.unit?.name}`,
            sublabel: `${u.project?.title} · ${u.project?.projectNumber}`,
            time: u.departureAt,
            overrideTime: u.overrideDepartureAt,
            dwellMinutes: u.overrideStopMinutes,
            dwellNote: u.overrideStopNote,
            location: u.project?.eventLocation,
        });
    });
    (rit.deliveries ?? []).forEach((d: any) => {
        stops.push({
            type: 'delivery', icon: 'shopping-bag',
            label: d.description ?? d.supplierName ?? 'Levering',
            sublabel: d.deliveryType === 'EXTERNAL' ? 'Externe levering' : 'Intern',
            time: d.scheduledAt,
        });
    });
    (rit.returnUnits ?? []).forEach((u: any) => {
        stops.push({
            type: 'unit_ret', icon: 'rotate-ccw',
            label: `Retour: ${u.unit?.name}`,
            sublabel: `${u.project?.title} · ${u.project?.projectNumber}`,
            time: u.returnAt,
            overrideTime: u.overrideReturnAt,
            dwellMinutes: u.overrideReturnStopMinutes,
            dwellNote: u.overrideReturnStopNote,
            location: u.project?.eventLocation,
        });
    });
    if (rit.returnAt) {
        stops.push({ type: 'depot_ret', icon: 'truck', label: 'Retour depot', time: rit.returnAt, location: rit.returnLocation });
    }

    stops.sort((a, b) => {
        const at = (a.overrideTime || a.time) ? new Date(a.overrideTime || a.time).getTime() : Infinity;
        const bt = (b.overrideTime || b.time) ? new Date(b.overrideTime || b.time).getTime() : Infinity;
        return at - bt;
    });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <FeatherIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.headerTitle}>Rit detail</Text>
                    <Text style={styles.headerSub}>
                        {format(new Date(rit.date), 'EEEE d MMMM yyyy', { locale: nl })}
                    </Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusChipText, { color: sc.color }]}>{sc.label}</Text>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
            >
                {/* Actie knoppen */}
                {transitions.length > 0 && (
                    <View style={styles.actieBar}>
                        {transitions.map(t => (
                            <TouchableOpacity
                                key={t.to}
                                style={[styles.actieBtn, t.primary && styles.actieBtnPrimary]}
                                onPress={() => handleTransition(t.to, t.label)}
                                disabled={statusMutation.isPending}
                                activeOpacity={0.8}
                            >
                                {statusMutation.isPending
                                    ? <ActivityIndicator size="small" color={t.primary ? '#fff' : '#1976D2'} />
                                    : <FeatherIcon name={t.icon} size={16} color={t.primary ? '#fff' : '#1976D2'} />
                                }
                                <Text style={[styles.actieBtnText, t.primary && { color: '#fff' }]}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Km registreren knop */}
                <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                    <TouchableOpacity
                        style={[styles.actieBtn, { justifyContent: 'center', gap: 8 }]}
                        onPress={() => router.push(`/kilometerregistratie/${id}`)}
                        activeOpacity={0.8}
                    >
                        <FeatherIcon name="map" size={16} color="#1976D2" />
                        <Text style={styles.actieBtnText}>Km registreren</Text>
                    </TouchableOpacity>
                </View>

                {/* Info sectie */}
                <View style={styles.infoCard}>
                    {rit.vehicle && (
                        <View style={styles.infoRow}>
                            <FeatherIcon name="truck" size={15} color="#6B7280" />
                            <View style={{ marginLeft: 10 }}>
                                <Text style={styles.infoLabel}>Voertuig</Text>
                                <Text style={styles.infoValue}>
                                    {rit.vehicle.name}
                                    {rit.vehicle.licensePlate ? ` (${rit.vehicle.licensePlate})` : ''}
                                </Text>
                            </View>
                        </View>
                    )}
                    {rit.driver && (
                        <View style={styles.infoRow}>
                            <FeatherIcon name="user" size={15} color="#6B7280" />
                            <View style={{ marginLeft: 10 }}>
                                <Text style={styles.infoLabel}>Chauffeur</Text>
                                <Text style={styles.infoValue}>{rit.driver.name}</Text>
                            </View>
                        </View>
                    )}
                    {rit.estimatedArrivalAt && (
                        <View style={styles.infoRow}>
                            <FeatherIcon name="navigation" size={15} color="#1D4ED8" />
                            <View style={{ marginLeft: 10 }}>
                                <Text style={styles.infoLabel}>ETA aankomst</Text>
                                <Text style={[styles.infoValue, { color: '#1D4ED8' }]}>
                                    {format(new Date(rit.estimatedArrivalAt), 'HH:mm')}
                                </Text>
                            </View>
                        </View>
                    )}
                    {rit.notes && (
                        <View style={styles.infoRow}>
                            <FeatherIcon name="file-text" size={15} color="#6B7280" />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.infoLabel}>Notities</Text>
                                <Text style={styles.infoValue}>{rit.notes}</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Planbord */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Planbord</Text>
                    {stops.length === 0 ? (
                        <Text style={styles.emptyText}>Geen stops gepland</Text>
                    ) : (
                        stops.map((s, i) => (
                            <StopRegel
                                key={i}
                                icon={s.icon}
                                label={s.label}
                                sublabel={s.sublabel}
                                time={s.time}
                                overrideTime={s.overrideTime}
                                dwellMinutes={s.dwellMinutes}
                                dwellNote={s.dwellNote}
                                location={s.location}
                            />
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 14, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
    statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    statusChipText: { fontSize: 12, fontWeight: '700' },

    actieBar: {
        flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0,
    },
    actieBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#1976D2',
    },
    actieBtnPrimary: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
    actieBtnText: { fontSize: 15, fontWeight: '700', color: '#1976D2' },

    infoCard: {
        margin: 16, backgroundColor: '#fff', borderRadius: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
        padding: 16, gap: 12,
    },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
    infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2 },

    section: { paddingHorizontal: 16, paddingTop: 4 },
    sectionTitle: {
        fontSize: 11, fontWeight: '700', color: '#9CA3AF',
        letterSpacing: 1, marginBottom: 16,
    },
    emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },
});

import React, { useRef, useState } from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    ScrollView, RefreshControl, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import RBSheet from 'react-native-raw-bottom-sheet';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { format, addMinutes, isPast } from 'date-fns';
import { nl } from 'date-fns/locale';

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT:       { label: 'Concept',      color: '#6B7280', bg: '#F3F4F6' },
    CONFIRMED:   { label: 'Bevestigd',   color: '#1D4ED8', bg: '#DBEAFE' },
    IN_PROGRESS: { label: 'Onderweg',    color: '#B45309', bg: '#FEF3C7' },
    COMPLETED:   { label: 'Afgerond',    color: '#065F46', bg: '#D1FAE5' },
    CANCELLED:   { label: 'Geannuleerd', color: '#B91C1C', bg: '#FEE2E2' },
};

const TRANSITION_BUTTONS: Record<string, { to: string; label: string; icon: string; primary?: boolean }[]> = {
    DRAFT:       [{ to: 'CONFIRMED',   label: 'Bevestigen',   icon: 'check-circle', primary: true }],
    CONFIRMED:   [{ to: 'IN_PROGRESS', label: 'Rit starten',  icon: 'play',         primary: true }],
    IN_PROGRESS: [{ to: 'COMPLETED',   label: 'Rit afronden', icon: 'check-square', primary: true }],
    COMPLETED:   [],
    CANCELLED:   [],
};

const STATUS_LABELS: Record<string, string> = {
    CONFIRMED:   'Bevestigd',
    IN_PROGRESS: 'Onderweg',
    COMPLETED:   'Afgerond',
};

function fmtTijd(d: string | null | undefined) {
    if (!d) return '—';
    return format(new Date(d), 'HH:mm');
}

// ─── Multi-app navigatiepicker ──────────────────────────────────────────────────

function openNavigation(location: string) {
    const enc = encodeURIComponent(location);
    Alert.alert('Navigeren naar', location, [
        { text: 'Apple Kaarten', onPress: () => Linking.openURL(`maps:?q=${enc}`) },
        { text: 'Google Maps',   onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${enc}`) },
        { text: 'Waze',          onPress: () => Linking.openURL(`https://waze.com/ul?q=${enc}`) },
        { text: 'Annuleren', style: 'cancel' },
    ]);
}

// ─── Stop regel ────────────────────────────────────────────────────────────────

function ContactRij({ icon, name, phone }: { icon: string; name: string; phone?: string | null }) {
    return (
        <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}
            onPress={phone ? () => Linking.openURL(`tel:${phone}`) : undefined}
            activeOpacity={phone ? 0.7 : 1}
        >
            <FeatherIcon name={icon} size={11} color={phone ? '#1D4ED8' : '#9CA3AF'} />
            <Text style={[{ fontSize: 12, color: '#6B7280' }, phone && { color: '#1D4ED8', textDecorationLine: 'underline' }]}>
                {name}{phone ? ` · ${phone}` : ''}
            </Text>
        </TouchableOpacity>
    );
}

function StopRegel({
    icon, label, sublabel, time, overrideTime, dwellMinutes, dwellNote, location,
    responsible, projectInfo, isCompleted, isNext, stepNumber,
}: {
    icon: string; label: string; sublabel?: string;
    time?: string | null; overrideTime?: string | null;
    dwellMinutes?: number | null; dwellNote?: string | null;
    location?: string | null;
    responsible?: { name: string; phone?: string | null } | null;
    projectInfo?: {
        eventStartDate?: string | null; eventEndDate?: string | null;
        projectManager?: { name: string; phone?: string | null } | null;
        shiftleaders?: { user: { name: string; phone?: string | null } }[];
    } | null;
    isCompleted?: boolean; isNext?: boolean;
    stepNumber?: number;
}) {
    const effectiveTime = overrideTime || time;
    const hasOverride = !!overrideTime && overrideTime !== time;
    const dwellEnd = effectiveTime && dwellMinutes
        ? format(addMinutes(new Date(effectiveTime), dwellMinutes), 'HH:mm')
        : null;

    return (
        <View style={[stopStyles.row, isNext && stopStyles.rowNext, isCompleted && stopStyles.rowCompleted]}>
            {/* Stapnummer + tijdkolom */}
            <View style={stopStyles.timeCol}>
                {stepNumber != null && (
                    <Text style={[stopStyles.stepNumber, isCompleted && stopStyles.stepNumberDim]}>{stepNumber}.</Text>
                )}
                <Text style={[stopStyles.time, hasOverride && stopStyles.timeOverride, isCompleted && stopStyles.timeDim]}>
                    {effectiveTime ? format(new Date(effectiveTime), 'HH:mm') : '—'}
                </Text>
                {hasOverride && time && (
                    <Text style={stopStyles.timeOriginal}>{fmtTijd(time)}</Text>
                )}
            </View>

            {/* Icoon connector */}
            <View style={stopStyles.connector}>
                <View style={[stopStyles.connectorDot, isCompleted && stopStyles.connectorDotDim, isNext && stopStyles.connectorDotNext]}>
                    <FeatherIcon
                        name={isCompleted ? 'check' : icon}
                        size={14}
                        color="#fff"
                    />
                </View>
            </View>

            {/* Info */}
            <View style={stopStyles.info}>
                <Text style={[stopStyles.label, isCompleted && stopStyles.labelDim]}>{label}</Text>
                {sublabel ? <Text style={[stopStyles.sublabel, isCompleted && stopStyles.labelDim]}>{sublabel}</Text> : null}

                {/* Responsible contact */}
                {responsible?.name && (
                    <ContactRij icon="user" name={`Verantw.: ${responsible.name}`} phone={responsible.phone} />
                )}

                {location ? (
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
                        onPress={() => openNavigation(location)}
                        activeOpacity={0.7}
                    >
                        <FeatherIcon name="map-pin" size={11} color="#1D4ED8" />
                        <Text style={[stopStyles.sublabel, { color: '#1D4ED8', textDecorationLine: 'underline' }]}>{location}</Text>
                    </TouchableOpacity>
                ) : null}

                {/* Project info: event tijden + contacten */}
                {projectInfo && (
                    <View style={stopStyles.projectInfo}>
                        {(projectInfo.eventStartDate || projectInfo.eventEndDate) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                <FeatherIcon name="calendar" size={11} color="#6B7280" />
                                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                                    {projectInfo.eventStartDate
                                        ? format(new Date(projectInfo.eventStartDate), 'EEE d MMM · HH:mm', { locale: nl })
                                        : ''}
                                    {projectInfo.eventEndDate
                                        ? ` – ${format(new Date(projectInfo.eventEndDate), 'HH:mm')}`
                                        : ''}
                                </Text>
                            </View>
                        )}
                        {projectInfo.projectManager?.name && (
                            <ContactRij icon="briefcase" name={`PM: ${projectInfo.projectManager.name}`} phone={projectInfo.projectManager.phone} />
                        )}
                        {(projectInfo.shiftleaders ?? []).map((sl, idx) => (
                            <ContactRij key={idx} icon="users" name={`Shiftleader: ${sl.user.name}`} phone={sl.user.phone} />
                        ))}
                    </View>
                )}

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
    rowNext: {
        backgroundColor: '#EFF6FF', borderRadius: 12, padding: 10, marginHorizontal: -10,
        borderLeftWidth: 3, borderLeftColor: '#1976D2',
    },
    rowCompleted: { opacity: 0.45 },
    timeCol: { width: 52, alignItems: 'flex-end', marginRight: 12, paddingTop: 2 },
    stepNumber: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', marginBottom: 1 },
    stepNumberDim: { color: '#D1D5DB' },
    time: { fontSize: 14, fontWeight: '700', color: '#111827' },
    timeOverride: { color: '#1D4ED8' },
    timeDim: { color: '#9CA3AF' },
    timeOriginal: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
    connector: { alignItems: 'center', marginRight: 12 },
    connectorDot: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center',
    },
    connectorDotDim: { backgroundColor: '#9CA3AF' },
    connectorDotNext: { backgroundColor: '#1976D2', shadowColor: '#1976D2', shadowOpacity: 0.4, shadowRadius: 6, elevation: 3 },
    info: { flex: 1 },
    label: { fontSize: 14, fontWeight: '600', color: '#111827' },
    labelDim: { color: '#9CA3AF' },
    sublabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    projectInfo: {
        marginTop: 6, paddingTop: 6,
        borderTopWidth: 1, borderTopColor: '#F3F4F6',
    },
    dwellChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
        backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    dwellText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
});

// ─── Volgende stop kaart ────────────────────────────────────────────────────────

function NextStopCard({ stop, onDone }: {
    stop: { label: string; time?: string | null; location?: string | null };
    onDone: () => void;
}) {
    return (
        <View style={nextStyles.card}>
            <View style={nextStyles.left}>
                <Text style={nextStyles.heading}>Volgende stop</Text>
                <Text style={nextStyles.label} numberOfLines={1}>{stop.label}</Text>
                {stop.location && (
                    <Text style={nextStyles.location} numberOfLines={1}>{stop.location}</Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    {stop.location && (
                        <TouchableOpacity
                            style={nextStyles.navBtn}
                            onPress={() => openNavigation(stop.location!)}
                            activeOpacity={0.8}
                        >
                            <FeatherIcon name="navigation" size={13} color="#fff" />
                            <Text style={nextStyles.navBtnText}>Navigeer</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={nextStyles.doneBtn}
                        onPress={onDone}
                        activeOpacity={0.8}
                    >
                        <FeatherIcon name="check" size={13} color="#1976D2" />
                        <Text style={nextStyles.doneBtnText}>Klaar</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={nextStyles.right}>
                {stop.time && (
                    <Text style={nextStyles.time}>{format(new Date(stop.time), 'HH:mm')}</Text>
                )}
            </View>
        </View>
    );
}

const nextStyles = StyleSheet.create({
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1976D2', borderRadius: 14,
        marginHorizontal: 16, marginTop: 12, padding: 14,
        shadowColor: '#1976D2', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    left: { flex: 1, marginRight: 12 },
    heading: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    label: { fontSize: 15, fontWeight: '700', color: '#fff' },
    location: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    right: { alignItems: 'flex-end', gap: 6 },
    time: { fontSize: 18, fontWeight: '800', color: '#fff' },
    navBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6,
    },
    navBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    doneBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#fff', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 6,
    },
    doneBtnText: { fontSize: 13, fontWeight: '700', color: '#1976D2' },
});

// ─── Scherm ────────────────────────────────────────────────────────────────────

export default function RitDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const qc = useQueryClient();

    const statusSheetRef = useRef<any>();
    const [pendingTransition, setPendingTransition] = useState<{ to: string; label: string } | null>(null);
    const [completedStopIndices, setCompletedStopIndices] = useState<number[]>([]);

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
            statusSheetRef.current?.close();
        },
        onError: (e: any) => {
            statusSheetRef.current?.close();
            Alert.alert('Fout', e?.message ?? 'Statuswijziging mislukt');
        },
    });

    const handleTransition = (to: string, label: string) => {
        if (to === 'IN_PROGRESS') {
            // Check-in flow: navigate to check-in screen which handles status transition
            router.push(`/rit/checkin/${id}`);
            return;
        }
        if (to === 'COMPLETED') {
            // Check-out flow: navigate to check-out screen which handles status transition
            router.push(`/rit/checkout/${id}`);
            return;
        }
        setPendingTransition({ to, label });
        statusSheetRef.current?.open();
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
    const isInProgress = rit.status === 'IN_PROGRESS';

    // ─── Planbord stops opbouwen ────────────────────────────────────────────────
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
            responsible: u.departureResponsible ?? null,
            projectInfo: u.project ? {
                eventStartDate: u.project.eventStartDate,
                eventEndDate: u.project.eventEndDate,
                projectManager: u.project.projectManager,
                shiftleaders: u.project.shiftleaders,
            } : null,
        });
    });
    (rit.deliveries ?? []).forEach((d: any) => {
        stops.push({
            type: 'delivery', icon: 'shopping-bag',
            label: d.description ?? d.supplierName ?? 'Levering',
            sublabel: d.deliveryType === 'EXTERNAL' ? 'Externe levering' : 'Intern',
            time: d.scheduledAt,
            location: d.address ?? null,
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
            responsible: u.arrivalResponsible ?? null,
            projectInfo: u.project ? {
                eventStartDate: u.project.eventStartDate,
                eventEndDate: u.project.eventEndDate,
                projectManager: u.project.projectManager,
                shiftleaders: u.project.shiftleaders,
            } : null,
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

    // ─── Volgende stop bepalen (voor IN_PROGRESS) ───────────────────────────────
    const isStopDone = (i: number, s: any) => {
        if (completedStopIndices.includes(i)) return true;
        const t = s.overrideTime || s.time;
        return t ? isPast(new Date(t)) : false;
    };

    const nextStopIndex = isInProgress
        ? stops.findIndex((s, i) => !isStopDone(i, s))
        : -1;

    const nextStop = nextStopIndex >= 0 ? stops[nextStopIndex] : (isInProgress && stops.length > 0 ? stops[0] : null);

    const handleStopDone = () => {
        if (nextStopIndex >= 0) {
            setCompletedStopIndices(prev => [...prev, nextStopIndex]);
        }
    };

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


                {/* Volgende stop kaart (alleen IN_PROGRESS) */}
                {isInProgress && nextStop && (
                    <NextStopCard stop={nextStop} onDone={handleStopDone} />
                )}

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
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.infoLabel}>Chauffeur</Text>
                                <Text style={styles.infoValue}>{rit.driver.name}</Text>
                                {rit.driver.phone && (
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(`tel:${rit.driver.phone}`)}
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}
                                        activeOpacity={0.7}
                                    >
                                        <FeatherIcon name="phone" size={13} color="#1D4ED8" />
                                        <Text style={[styles.infoValue, { fontSize: 13, color: '#1D4ED8', textDecorationLine: 'underline' }]}>
                                            {rit.driver.phone}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                    {rit.estimatedArrivalAt && (
                        <View style={styles.infoRow}>
                            <FeatherIcon name="navigation" size={15} color="#1D4ED8" />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={styles.infoLabel}>ETA aankomst</Text>
                                <Text style={[styles.infoValue, { color: '#1D4ED8' }]}>
                                    {format(new Date(rit.estimatedArrivalAt), 'HH:mm')}
                                </Text>
                                {rit.etaNotes && (
                                    <Text style={styles.etaNotes}>{rit.etaNotes}</Text>
                                )}
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
                        stops.map((s, i) => {
                            const effectiveTime = s.overrideTime || s.time;
                            const isCompleted = isInProgress && isStopDone(i, s);
                            const isNext = isInProgress && i === nextStopIndex;
                            return (
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
                                    responsible={s.responsible}
                                    projectInfo={s.projectInfo ?? null}
                                    isCompleted={!!isCompleted}
                                    isNext={isNext}
                                    stepNumber={i + 1}
                                />
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Status overgang bottom sheet */}
            <RBSheet
                ref={statusSheetRef}
                customStyles={{ container: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 } }}
                height={220}
                openDuration={250}
                closeOnDragDown
            >
                {pendingTransition && (
                    <>
                        <Text style={styles.sheetTitle}>{pendingTransition.label}</Text>
                        <Text style={styles.sheetSubtitle}>
                            Status wordt gewijzigd naar "{STATUS_LABELS[pendingTransition.to] ?? pendingTransition.to}"
                        </Text>
                        <TouchableOpacity
                            style={[styles.actieBtn, styles.actieBtnPrimary, { marginTop: 20 }]}
                            onPress={() => statusMutation.mutate({ status: pendingTransition.to })}
                            disabled={statusMutation.isPending}
                            activeOpacity={0.8}
                        >
                            {statusMutation.isPending
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={[styles.actieBtnText, { color: '#fff' }]}>Bevestigen</Text>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actieBtn, { marginTop: 10 }]}
                            onPress={() => statusSheetRef.current?.close()}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.actieBtnText}>Annuleren</Text>
                        </TouchableOpacity>
                    </>
                )}
            </RBSheet>
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

    actieBar: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
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
    etaNotes: { fontSize: 12, color: '#6B7280', fontStyle: 'italic', marginTop: 3 },

    section: { paddingHorizontal: 16, paddingTop: 4 },
    sectionTitle: {
        fontSize: 11, fontWeight: '700', color: '#9CA3AF',
        letterSpacing: 1, marginBottom: 16,
    },
    emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 20 },

    sheetTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
    sheetSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6 },
});

import React, { useState } from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { directApi } from '../../../lib/directApi';

const BLUE = '#1976D2';

export default function CheckOutScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const qc = useQueryClient();

    const [endKmText, setEndKmText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { data: rit, isLoading } = useQuery({
        queryKey: ['rit', id],
        queryFn: () => directApi.ritten.getById(id),
        enabled: !!id,
    });

    const endKm = Number(endKmText) || 0;
    const startKm: number | null = rit?.startKm ?? null;
    const kmDriven = startKm != null && endKm > 0 ? endKm - startKm : null;
    const kmInvalid = startKm != null && endKm > 0 && endKm < startKm;

    async function submitCheckOut() {
        if (kmInvalid) {
            Alert.alert(
                'Ongeldige km-stand',
                `Eind km-stand (${endKm}) mag niet lager zijn dan begin km-stand (${startKm}).`,
            );
            return;
        }
        if (!endKmText.trim() || isNaN(Number(endKmText))) {
            Alert.alert('Vereist', 'Voer een geldige eind km-stand in.');
            return;
        }

        setSubmitting(true);
        try {
            await directApi.ritten.checkOut(id, { endKm });
            await directApi.ritten.updateStatus(id, 'COMPLETED');

            qc.invalidateQueries({ queryKey: ['rit', id] });
            qc.invalidateQueries({ queryKey: ['mijn-ritten'] });

            router.replace(`/rit/${id}`);
        } catch (e: any) {
            Alert.alert('Check-out mislukt', e?.message ?? 'Probeer opnieuw');
        } finally {
            setSubmitting(false);
        }
    }

    if (isLoading || !rit) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    const canSubmit = endKmText.trim().length > 0 && !isNaN(Number(endKmText)) && !kmInvalid;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <FeatherIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.headerTitle}>Check-out</Text>
                    <Text style={s.headerSub}>Rit afronden</Text>
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

                    {/* Rit info kaart */}
                    <View style={s.infoCard}>
                        {rit.vehicle && (
                            <View style={s.infoRow}>
                                <FeatherIcon name="truck" size={15} color="#6B7280" />
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={s.infoLabel}>Voertuig</Text>
                                    <Text style={s.infoValue}>
                                        {rit.vehicle.name}
                                        {rit.vehicle.licensePlate ? ` · ${rit.vehicle.licensePlate}` : ''}
                                    </Text>
                                </View>
                            </View>
                        )}
                        {rit.departureAt && (
                            <View style={s.infoRow}>
                                <FeatherIcon name="clock" size={15} color="#6B7280" />
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={s.infoLabel}>Vertrektijd</Text>
                                    <Text style={s.infoValue}>
                                        {format(new Date(rit.departureAt), 'EEEE d MMM · HH:mm', { locale: nl })}
                                    </Text>
                                </View>
                            </View>
                        )}
                        {startKm != null && (
                            <View style={s.infoRow}>
                                <FeatherIcon name="map-pin" size={15} color="#6B7280" />
                                <View style={{ marginLeft: 10 }}>
                                    <Text style={s.infoLabel}>Begin km-stand</Text>
                                    <Text style={s.infoValue}>{startKm.toLocaleString('nl-NL')} km</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Eind km invoer */}
                    <Text style={s.inputLabel}>Eind km-stand</Text>
                    <TextInput
                        style={[s.kmInput, kmInvalid && s.kmInputError]}
                        placeholder="0"
                        placeholderTextColor="#D1D5DB"
                        value={endKmText}
                        onChangeText={setEndKmText}
                        keyboardType="number-pad"
                        autoFocus
                    />
                    <Text style={s.kmUnit}>km</Text>

                    {/* Live km berekening */}
                    {kmDriven !== null && kmDriven > 0 && !kmInvalid && (
                        <View style={s.kmChip}>
                            <FeatherIcon name="navigation" size={15} color="#059669" />
                            <Text style={s.kmChipText}>{kmDriven.toLocaleString('nl-NL')} km gereden</Text>
                        </View>
                    )}

                    {/* Foutmelding */}
                    {kmInvalid && (
                        <View style={s.errorChip}>
                            <FeatherIcon name="alert-circle" size={15} color="#DC2626" />
                            <Text style={s.errorText}>
                                Eind km ({endKm}) is lager dan begin km ({startKm})
                            </Text>
                        </View>
                    )}

                    {/* Bevestig knop */}
                    <TouchableOpacity
                        style={[s.primaryBtn, (!canSubmit || submitting) && s.primaryBtnDisabled]}
                        onPress={submitCheckOut}
                        disabled={!canSubmit || submitting}
                        activeOpacity={0.8}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <FeatherIcon name="log-out" size={18} color="#fff" />
                                <Text style={s.primaryBtnText}>Check-out bevestigen</Text>
                            </>
                        )}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingVertical: 14, backgroundColor: '#fff',
        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
    headerSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },

    content: { padding: 24, paddingTop: 20 },

    infoCard: {
        backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16,
        gap: 12, marginBottom: 28,
        borderWidth: 1, borderColor: '#F3F4F6',
    },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
    infoLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 2 },

    inputLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
    kmInput: {
        fontSize: 56, fontWeight: '800', color: '#111827',
        textAlign: 'center', paddingVertical: 16,
        borderBottomWidth: 2, borderBottomColor: BLUE,
        marginBottom: 4,
    },
    kmInputError: { borderBottomColor: '#DC2626' },
    kmUnit: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 20 },

    kmChip: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#D1FAE5', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        alignSelf: 'center', marginBottom: 24,
    },
    kmChipText: { fontSize: 16, fontWeight: '700', color: '#059669' },

    errorChip: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#FEE2E2', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        alignSelf: 'center', marginBottom: 24,
    },
    errorText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },

    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: BLUE, borderRadius: 14,
        paddingVertical: 16, marginTop: 8,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

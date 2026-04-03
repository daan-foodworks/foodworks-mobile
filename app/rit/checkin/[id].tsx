import React, { useState } from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    TextInput, ScrollView, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { directApi } from '../../../lib/directApi';

const BLUE = '#1976D2';
const TOTAL_STEPS = 4;

// ─── Stapindicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
    return (
        <View style={ind.row}>
            {Array.from({ length: total }).map((_, i) => (
                <View
                    key={i}
                    style={[
                        ind.dot,
                        i < current ? ind.dotDone : i === current ? ind.dotActive : ind.dotIdle,
                    ]}
                />
            ))}
        </View>
    );
}

const ind = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    dotActive: { backgroundColor: BLUE },
    dotDone: { backgroundColor: '#93C5FD' },
    dotIdle: { backgroundColor: '#E5E7EB' },
});

// ─── Fotosectie ───────────────────────────────────────────────────────────────

function PhotoRow({
    photos,
    onAdd,
    onRemove,
    max,
    uploading,
}: {
    photos: string[];
    onAdd: () => void;
    onRemove: (i: number) => void;
    max: number;
    uploading: boolean;
}) {
    return (
        <View style={ph.row}>
            {photos.map((uri, i) => (
                <View key={i} style={ph.thumb}>
                    <Image source={{ uri }} style={ph.img} />
                    <TouchableOpacity style={ph.del} onPress={() => onRemove(i)} activeOpacity={0.8}>
                        <FeatherIcon name="x" size={12} color="#fff" />
                    </TouchableOpacity>
                </View>
            ))}
            {photos.length < max && (
                <TouchableOpacity style={ph.addBtn} onPress={onAdd} disabled={uploading} activeOpacity={0.7}>
                    {uploading ? (
                        <ActivityIndicator size="small" color={BLUE} />
                    ) : (
                        <FeatherIcon name="camera" size={22} color={BLUE} />
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const ph = StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', position: 'relative' },
    img: { width: '100%', height: '100%' },
    del: {
        position: 'absolute', top: 4, right: 4,
        backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 3,
    },
    addBtn: {
        width: 72, height: 72, borderRadius: 10,
        borderWidth: 1.5, borderColor: BLUE, borderStyle: 'dashed',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#EFF6FF',
    },
});

// ─── Hoofd scherm ─────────────────────────────────────────────────────────────

export default function CheckInScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const qc = useQueryClient();

    const [step, setStep] = useState(0);

    // Stap 1
    const [manualPlate, setManualPlate] = useState('');

    // Stap 2
    const [startKmText, setStartKmText] = useState('');

    // Stap 3
    const [hasDamage, setHasDamage] = useState<boolean | null>(null);
    const [damageNotes, setDamageNotes] = useState('');
    const [damagePhotos, setDamagePhotos] = useState<string[]>([]);   // local URIs for display
    const [damagePhotoUrls, setDamagePhotoUrls] = useState<string[]>([]); // uploaded URLs
    const [uploadingDamage, setUploadingDamage] = useState(false);

    // Stap 4
    const [tankFull, setTankFull] = useState<boolean | null>(null);
    const [tankPhotoUri, setTankPhotoUri] = useState<string | null>(null);
    const [tankPhotoUrl, setTankPhotoUrl] = useState<string | null>(null);
    const [uploadingTank, setUploadingTank] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    const { data: rit, isLoading } = useQuery({
        queryKey: ['rit', id],
        queryFn: () => directApi.ritten.getById(id),
        enabled: !!id,
    });

    // ─── Camera helper ────────────────────────────────────────────────────────

    async function pickPhoto(): Promise<string | null> {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (camPerm.status !== 'granted') {
            // Fallback naar galerij als camera geweigerd
            const galPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (galPerm.status !== 'granted') {
                Alert.alert('Toegang geweigerd', 'Camera of galerij toegang is vereist.');
                return null;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.7,
            });
            if (result.canceled) return null;
            return result.assets[0].uri;
        }
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });
        if (result.canceled) return null;
        return result.assets[0].uri;
    }

    // ─── Schade foto toevoegen ────────────────────────────────────────────────

    async function addDamagePhoto() {
        const uri = await pickPhoto();
        if (!uri) return;
        setUploadingDamage(true);
        try {
            const url = await directApi.ritten.uploadPhoto(uri);
            setDamagePhotos(prev => [...prev, uri]);
            setDamagePhotoUrls(prev => [...prev, url]);
        } catch (e: any) {
            Alert.alert('Upload mislukt', e?.message ?? 'Foto kon niet worden geupload');
        } finally {
            setUploadingDamage(false);
        }
    }

    function removeDamagePhoto(i: number) {
        setDamagePhotos(prev => prev.filter((_, idx) => idx !== i));
        setDamagePhotoUrls(prev => prev.filter((_, idx) => idx !== i));
    }

    // ─── Tank foto toevoegen ──────────────────────────────────────────────────

    async function addTankPhoto() {
        const uri = await pickPhoto();
        if (!uri) return;
        setUploadingTank(true);
        try {
            const url = await directApi.ritten.uploadPhoto(uri);
            setTankPhotoUri(uri);
            setTankPhotoUrl(url);
        } catch (e: any) {
            Alert.alert('Upload mislukt', e?.message ?? 'Foto kon niet worden geupload');
        } finally {
            setUploadingTank(false);
        }
    }

    // ─── Navigatie tussen stappen ─────────────────────────────────────────────

    function canProceedStep(): boolean {
        if (step === 1) return startKmText.trim().length > 0 && !isNaN(Number(startKmText));
        return true;
    }

    function nextStep() {
        if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    }

    // ─── Check-in indienen ────────────────────────────────────────────────────

    async function submitCheckIn() {
        setSubmitting(true);
        try {
            const startKm = Number(startKmText);
            const licensePlate = rit?.vehicle?.licensePlate || manualPlate.trim() || undefined;

            const checkInData: {
                startKm: number;
                checkinLicensePlate?: string;
                damageNotes?: string;
                damagePhotos?: string[];
                tankPhotoUrl?: string;
            } = { startKm };

            if (licensePlate) checkInData.checkinLicensePlate = licensePlate;
            if (hasDamage && damageNotes.trim()) checkInData.damageNotes = damageNotes.trim();
            if (hasDamage && damagePhotoUrls.length > 0) checkInData.damagePhotos = damagePhotoUrls;
            if (!tankFull && tankPhotoUrl) checkInData.tankPhotoUrl = tankPhotoUrl;

            await directApi.ritten.checkIn(id, checkInData);
            await directApi.ritten.updateStatus(id, 'IN_PROGRESS');

            qc.invalidateQueries({ queryKey: ['rit', id] });
            qc.invalidateQueries({ queryKey: ['mijn-ritten'] });

            router.replace(`/rit/${id}`);
        } catch (e: any) {
            Alert.alert('Check-in mislukt', e?.message ?? 'Probeer opnieuw');
        } finally {
            setSubmitting(false);
        }
    }

    // ─── Render laden ─────────────────────────────────────────────────────────

    if (isLoading || !rit) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color={BLUE} />
            </SafeAreaView>
        );
    }

    const vehiclePlate = rit.vehicle?.licensePlate ?? null;
    const vehicleName = rit.vehicle?.name ?? null;
    const startKm = Number(startKmText) || 0;

    // ─── Stap inhoud ──────────────────────────────────────────────────────────

    function renderStep() {
        switch (step) {
            // ── Stap 1: Voertuig ──────────────────────────────────────────────
            case 0:
                return (
                    <View style={s.stepContent}>
                        <Text style={s.stepTitle}>Voertuig controleren</Text>
                        <Text style={s.stepSub}>Bevestig het voertuig dat je gaat besturen.</Text>

                        <View style={s.vehicleCard}>
                            <FeatherIcon name="truck" size={28} color={BLUE} />
                            <View style={{ marginLeft: 14, flex: 1 }}>
                                {vehicleName ? (
                                    <Text style={s.vehicleName}>{vehicleName}</Text>
                                ) : (
                                    <Text style={[s.vehicleName, { color: '#9CA3AF' }]}>Geen voertuig gekoppeld</Text>
                                )}
                                {vehiclePlate ? (
                                    <Text style={s.vehiclePlate}>{vehiclePlate}</Text>
                                ) : (
                                    <Text style={s.vehiclePlateLabel}>Voer kenteken in:</Text>
                                )}
                            </View>
                        </View>

                        {!vehiclePlate && (
                            <TextInput
                                style={s.input}
                                placeholder="Bijv. AB-123-C"
                                placeholderTextColor="#9CA3AF"
                                value={manualPlate}
                                onChangeText={setManualPlate}
                                autoCapitalize="characters"
                            />
                        )}

                        <TouchableOpacity style={s.primaryBtn} onPress={nextStep} activeOpacity={0.8}>
                            <Text style={s.primaryBtnText}>Volgende</Text>
                            <FeatherIcon name="arrow-right" size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>
                );

            // ── Stap 2: Begin KM stand ─────────────────────────────────────────
            case 1:
                return (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <View style={s.stepContent}>
                            <Text style={s.stepTitle}>Begin km-stand</Text>
                            {vehiclePlate && (
                                <View style={s.plateTag}>
                                    <FeatherIcon name="tag" size={13} color={BLUE} />
                                    <Text style={s.plateTagText}>{vehiclePlate}</Text>
                                </View>
                            )}
                            <Text style={s.stepSub}>Voer de huidige km-stand in van het voertuig.</Text>

                            <TextInput
                                style={s.kmInput}
                                placeholder="0"
                                placeholderTextColor="#D1D5DB"
                                value={startKmText}
                                onChangeText={setStartKmText}
                                keyboardType="number-pad"
                                autoFocus
                            />
                            <Text style={s.kmUnit}>km</Text>

                            <TouchableOpacity
                                style={[s.primaryBtn, !canProceedStep() && s.primaryBtnDisabled]}
                                onPress={nextStep}
                                disabled={!canProceedStep()}
                                activeOpacity={0.8}
                            >
                                <Text style={s.primaryBtnText}>Volgende</Text>
                                <FeatherIcon name="arrow-right" size={18} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                );

            // ── Stap 3: Schade check ──────────────────────────────────────────
            case 2:
                return (
                    <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled">
                        <Text style={s.stepTitle}>Schade aanwezig?</Text>
                        <Text style={s.stepSub}>Controleer het voertuig op schade voor vertrek.</Text>

                        <View style={s.bigBtnRow}>
                            <TouchableOpacity
                                style={[s.bigBtn, hasDamage === false && s.bigBtnActiveGreen]}
                                onPress={() => setHasDamage(false)}
                                activeOpacity={0.8}
                            >
                                <FeatherIcon name="check-circle" size={28} color={hasDamage === false ? '#fff' : '#059669'} />
                                <Text style={[s.bigBtnText, hasDamage === false && { color: '#fff' }]}>
                                    Nee, geen schade
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.bigBtn, hasDamage === true && s.bigBtnActiveOrange]}
                                onPress={() => setHasDamage(true)}
                                activeOpacity={0.8}
                            >
                                <FeatherIcon name="alert-triangle" size={28} color={hasDamage === true ? '#fff' : '#D97706'} />
                                <Text style={[s.bigBtnText, hasDamage === true && { color: '#fff' }]}>
                                    Ja, schade aanwezig
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {hasDamage === true && (
                            <View style={s.damageSection}>
                                <Text style={s.fieldLabel}>Foto's van schade (max 5)</Text>
                                <PhotoRow
                                    photos={damagePhotos}
                                    onAdd={addDamagePhoto}
                                    onRemove={removeDamagePhoto}
                                    max={5}
                                    uploading={uploadingDamage}
                                />
                                <Text style={[s.fieldLabel, { marginTop: 16 }]}>Omschrijving schade</Text>
                                <TextInput
                                    style={s.textarea}
                                    placeholder="Beschrijf de schade..."
                                    placeholderTextColor="#9CA3AF"
                                    value={damageNotes}
                                    onChangeText={setDamageNotes}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>
                        )}

                        {hasDamage !== null && (
                            <TouchableOpacity style={s.primaryBtn} onPress={nextStep} activeOpacity={0.8}>
                                <Text style={s.primaryBtnText}>Volgende</Text>
                                <FeatherIcon name="arrow-right" size={18} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                );

            // ── Stap 4: Tank ──────────────────────────────────────────────────
            case 3:
                return (
                    <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled">
                        <Text style={s.stepTitle}>Is de tank vol?</Text>
                        <Text style={s.stepSub}>Controleer de brandstofstand voor vertrek.</Text>

                        <View style={s.bigBtnRow}>
                            <TouchableOpacity
                                style={[s.bigBtn, tankFull === true && s.bigBtnActiveGreen]}
                                onPress={() => setTankFull(true)}
                                activeOpacity={0.8}
                            >
                                <FeatherIcon name="check-circle" size={28} color={tankFull === true ? '#fff' : '#059669'} />
                                <Text style={[s.bigBtnText, tankFull === true && { color: '#fff' }]}>
                                    Ja, tank is vol
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.bigBtn, tankFull === false && s.bigBtnActiveOrange]}
                                onPress={() => setTankFull(false)}
                                activeOpacity={0.8}
                            >
                                <FeatherIcon name="droplet" size={28} color={tankFull === false ? '#fff' : '#D97706'} />
                                <Text style={[s.bigBtnText, tankFull === false && { color: '#fff' }]}>
                                    Nee, bijvullen vereist
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {tankFull === false && (
                            <View style={s.damageSection}>
                                <Text style={s.fieldLabel}>Foto tankwijzer</Text>
                                {tankPhotoUri ? (
                                    <View style={{ position: 'relative', alignSelf: 'flex-start', marginTop: 10 }}>
                                        <Image source={{ uri: tankPhotoUri }} style={ph.img} />
                                        <TouchableOpacity
                                            style={[ph.del, { position: 'absolute' }]}
                                            onPress={() => { setTankPhotoUri(null); setTankPhotoUrl(null); }}
                                            activeOpacity={0.8}
                                        >
                                            <FeatherIcon name="x" size={12} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[ph.addBtn, { marginTop: 10 }]}
                                        onPress={addTankPhoto}
                                        disabled={uploadingTank}
                                        activeOpacity={0.7}
                                    >
                                        {uploadingTank ? (
                                            <ActivityIndicator size="small" color={BLUE} />
                                        ) : (
                                            <FeatherIcon name="camera" size={22} color={BLUE} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {tankFull !== null && (
                            <TouchableOpacity
                                style={[s.primaryBtn, submitting && s.primaryBtnDisabled]}
                                onPress={submitCheckIn}
                                disabled={submitting}
                                activeOpacity={0.8}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <FeatherIcon name="log-in" size={18} color="#fff" />
                                        <Text style={s.primaryBtnText}>Check-in bevestigen</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                );

            default:
                return null;
        }
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity
                    onPress={() => (step > 0 ? setStep(s => s - 1) : router.back())}
                    style={s.backBtn}
                >
                    <FeatherIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.headerTitle}>Check-in</Text>
                    <Text style={s.headerSub}>Stap {step + 1} van {TOTAL_STEPS}</Text>
                </View>
            </View>

            <StepIndicator current={step} total={TOTAL_STEPS} />

            <View style={{ flex: 1 }}>
                {renderStep()}
            </View>
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

    stepContent: { padding: 24, paddingTop: 16 },
    stepTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
    stepSub: { fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 20 },

    vehicleCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#EFF6FF', borderRadius: 14,
        padding: 18, marginBottom: 16,
    },
    vehicleName: { fontSize: 16, fontWeight: '700', color: '#111827' },
    vehiclePlate: {
        fontSize: 18, fontWeight: '800', color: BLUE,
        letterSpacing: 1.5, marginTop: 4,
    },
    vehiclePlateLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },

    plateTag: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#EFF6FF', borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 5,
        alignSelf: 'flex-start', marginBottom: 16,
    },
    plateTagText: { fontSize: 14, fontWeight: '700', color: BLUE, letterSpacing: 1 },

    input: {
        borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
        padding: 14, fontSize: 16, color: '#111827',
        marginBottom: 24, backgroundColor: '#FAFAFA',
    },

    kmInput: {
        fontSize: 56, fontWeight: '800', color: '#111827',
        textAlign: 'center', paddingVertical: 16,
        borderBottomWidth: 2, borderBottomColor: BLUE,
        marginBottom: 4,
    },
    kmUnit: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32 },

    bigBtnRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    bigBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingVertical: 20, borderRadius: 16,
        borderWidth: 1.5, borderColor: '#E5E7EB', gap: 10,
        backgroundColor: '#FAFAFA',
    },
    bigBtnActiveGreen: { backgroundColor: '#059669', borderColor: '#059669' },
    bigBtnActiveOrange: { backgroundColor: '#D97706', borderColor: '#D97706' },
    bigBtnText: { fontSize: 13, fontWeight: '700', color: '#374151', textAlign: 'center' },

    damageSection: {
        backgroundColor: '#FFF7ED', borderRadius: 14,
        padding: 16, marginBottom: 20,
    },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
    textarea: {
        borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
        padding: 12, fontSize: 15, color: '#111827',
        marginTop: 8, backgroundColor: '#fff', minHeight: 90,
    },

    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: BLUE, borderRadius: 14,
        paddingVertical: 16, marginTop: 8,
    },
    primaryBtnDisabled: { opacity: 0.45 },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

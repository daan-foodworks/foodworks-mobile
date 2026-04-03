import React, { useState } from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useMutation, useQuery } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

type Doel = 'ZAKELIJK' | 'WOON_WERK';

export default function KilometerregistratieScreen() {
    const { ritId } = useLocalSearchParams<{ ritId: string }>();
    const router = useRouter();

    const [beginstand, setBeginstand] = useState('');
    const [eindstand, setEindstand] = useState('');
    const [doel, setDoel] = useState<Doel>('ZAKELIJK');
    const [notitie, setNotitie] = useState('');

    const { data: rit } = useQuery({
        queryKey: ['rit', ritId],
        queryFn: () => directApi.ritten.getById(ritId),
        enabled: !!ritId,
    });

    const parseKm = (val: string): number => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 0 : num;
    };

    const beginKm = parseKm(beginstand);
    const eindKm = parseKm(eindstand);
    const aantalKm = eindKm > beginKm ? eindKm - beginKm : 0;

    const ritSubtitle = rit
        ? [
              rit.date
                  ? format(new Date(rit.date), 'EEEE d MMMM yyyy', { locale: nl })
                  : null,
              rit.vehicle?.name ?? null,
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    const saveMutation = useMutation({
        mutationFn: async () => {
            const start = parseKm(beginstand);
            const end = parseKm(eindstand);

            if (!beginstand || !eindstand) {
                throw new Error('Vul zowel beginstand als eindstand in');
            }
            if (end < start) {
                throw new Error('Eindstand moet groter zijn dan of gelijk aan beginstand');
            }

            return directApi.ritten.addMileage(ritId, {
                startKm: start,
                endKm: end,
                purpose: doel,
                notes: notitie.trim() || undefined,
            });
        },
        onSuccess: () => {
            router.back();
        },
        onError: (error: Error) => {
            Alert.alert('Fout', error.message);
        },
    });

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f7' }}>
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Header back */}
                <TouchableOpacity
                    style={styles.headerBack}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <FeatherIcon name="arrow-left" size={22} color="#007aff" />
                </TouchableOpacity>

                {/* Header title */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Kilometerregistratie</Text>
                    {ritSubtitle ? (
                        <Text style={styles.headerSubtitle}>{ritSubtitle}</Text>
                    ) : null}
                </View>

                {/* BEGINSTAND */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Beginstand (km)</Text>
                    <View style={styles.sectionBody}>
                        <TextInput
                            style={styles.sectionInput}
                            placeholder="0"
                            placeholderTextColor="#c7c7cc"
                            keyboardType="number-pad"
                            value={beginstand}
                            onChangeText={setBeginstand}
                        />
                    </View>
                </View>

                {/* EINDSTAND */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Eindstand (km)</Text>
                    <View style={styles.sectionBody}>
                        <TextInput
                            style={styles.sectionInput}
                            placeholder="0"
                            placeholderTextColor="#c7c7cc"
                            keyboardType="number-pad"
                            value={eindstand}
                            onChangeText={setEindstand}
                        />
                    </View>
                </View>

                {/* AANTAL KM */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Aantal km</Text>
                    <View style={styles.sectionBody}>
                        <Text style={styles.sectionReadonly}>{aantalKm} km</Text>
                    </View>
                </View>

                {/* DOEL */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Doel</Text>
                    <View style={styles.doelRow}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, doel === 'ZAKELIJK' && styles.toggleBtnActive]}
                            onPress={() => setDoel('ZAKELIJK')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.toggleText, doel === 'ZAKELIJK' && styles.toggleTextActive]}>
                                Zakelijk
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleBtn, doel === 'WOON_WERK' && styles.toggleBtnActive]}
                            onPress={() => setDoel('WOON_WERK')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.toggleText, doel === 'WOON_WERK' && styles.toggleTextActive]}>
                                Woon-werk
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* NOTITIE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notitie</Text>
                    <View style={styles.sectionBody}>
                        <TextInput
                            style={[styles.sectionInput, { height: 80, paddingTop: 14, textAlignVertical: 'top' }]}
                            placeholder="Optioneel"
                            placeholderTextColor="#c7c7cc"
                            value={notitie}
                            onChangeText={setNotitie}
                            multiline
                        />
                    </View>
                </View>

                {/* Opslaan knop */}
                <View style={styles.sectionAction}>
                    <TouchableOpacity
                        style={[styles.btn, saveMutation.isPending && { opacity: 0.6 }]}
                        onPress={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.btnText}>
                            {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                        </Text>
                        {!saveMutation.isPending && (
                            <FeatherIcon
                                name="arrow-right-circle"
                                size={18}
                                color="#fff"
                                style={{ marginLeft: 8 }}
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 24, marginBottom: 12 },
    headerBack: { alignSelf: 'flex-start', paddingHorizontal: 20, marginTop: 6, marginBottom: 16 },
    headerTitle: { fontSize: 32, fontWeight: '700', color: '#1d1d1d' },
    headerSubtitle: { fontSize: 15, fontWeight: '500', color: '#929292', marginTop: 6 },
    section: { paddingTop: 12 },
    sectionTitle: { marginVertical: 8, marginHorizontal: 24, fontSize: 14, fontWeight: '600', color: '#a7a7a7', textTransform: 'uppercase', letterSpacing: 1.2 },
    sectionBody: { paddingLeft: 24, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e3e3e3' },
    sectionInput: { paddingRight: 16, height: 50, fontSize: 17, fontWeight: '500', color: '#000' },
    sectionReadonly: { paddingRight: 16, height: 50, fontSize: 17, fontWeight: '700', color: '#1d1d1d', lineHeight: 50 },
    sectionAction: { marginTop: 24, paddingHorizontal: 20 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#007aff', borderWidth: 1, borderColor: '#007aff' },
    btnText: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: '#fff' },

    doelRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
    toggleBtn: {
        borderWidth: 1,
        borderColor: '#e3e3e3',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
    },
    toggleBtnActive: {
        backgroundColor: '#007aff',
        borderColor: '#007aff',
    },
    toggleText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#1d1d1d',
    },
    toggleTextActive: {
        color: '#fff',
    },
});

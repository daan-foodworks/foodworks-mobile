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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';

export default function OmzetregistratieScreen() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [contant, setContant] = useState('');
    const [pin, setPin] = useState('');
    const [online, setOnline] = useState('');
    const [aantalPersonen, setAantalPersonen] = useState('');

    const { data: project } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => directApi.projects.getById(projectId),
        enabled: !!projectId,
    });

    const parseAmount = (val: string): number => {
        const num = parseFloat(val.replace(',', '.'));
        return isNaN(num) ? 0 : num;
    };

    const totaal =
        parseAmount(contant) + parseAmount(pin) + parseAmount(online);

    const formatTotaal = (num: number): string => {
        return num.toLocaleString('nl-NL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const bedragContant = parseAmount(contant);
            const bedragPin = parseAmount(pin);
            const bedragOnline = parseAmount(online);

            if (bedragContant <= 0 && bedragPin <= 0 && bedragOnline <= 0) {
                throw new Error('Vul minimaal één bedrag in groter dan 0');
            }

            const date = new Date().toISOString();
            const promises: Promise<any>[] = [];

            if (bedragContant > 0) {
                promises.push(
                    directApi.revenues.create({
                        projectId,
                        amount: bedragContant,
                        vatRate: 9,
                        description: 'Contant',
                        date,
                    })
                );
            }
            if (bedragPin > 0) {
                promises.push(
                    directApi.revenues.create({
                        projectId,
                        amount: bedragPin,
                        vatRate: 9,
                        description: 'Pin',
                        date,
                    })
                );
            }
            if (bedragOnline > 0) {
                promises.push(
                    directApi.revenues.create({
                        projectId,
                        amount: bedragOnline,
                        vatRate: 9,
                        description: 'Online',
                        date,
                    })
                );
            }

            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
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
                    <Text style={styles.headerTitle}>Omzetregistratie</Text>
                    {project?.title ? (
                        <Text style={styles.headerSubtitle}>{project.title}</Text>
                    ) : null}
                </View>

                {/* CONTANT */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Contant (€)</Text>
                    <View style={styles.sectionBody}>
                        <TextInput
                            style={styles.sectionInput}
                            placeholder="0,00"
                            placeholderTextColor="#c7c7cc"
                            keyboardType="decimal-pad"
                            value={contant}
                            onChangeText={setContant}
                        />
                    </View>
                </View>

                {/* PIN */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Pin (€)</Text>
                    <View style={styles.sectionBody}>
                        <TextInput
                            style={styles.sectionInput}
                            placeholder="0,00"
                            placeholderTextColor="#c7c7cc"
                            keyboardType="decimal-pad"
                            value={pin}
                            onChangeText={setPin}
                        />
                    </View>
                </View>

                {/* ONLINE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Online (€)</Text>
                    <View style={styles.sectionBody}>
                        <TextInput
                            style={styles.sectionInput}
                            placeholder="0,00"
                            placeholderTextColor="#c7c7cc"
                            keyboardType="decimal-pad"
                            value={online}
                            onChangeText={setOnline}
                        />
                    </View>
                </View>

                {/* TOTAAL */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Totaal</Text>
                    <View style={styles.sectionBody}>
                        <Text style={styles.sectionReadonly}>
                            € {formatTotaal(totaal)}
                        </Text>
                    </View>
                </View>

                {/* AANTAL PERSONEN */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Aantal personen</Text>
                    <View style={styles.sectionBody}>
                        <TextInput
                            style={styles.sectionInput}
                            placeholder="Optioneel"
                            placeholderTextColor="#c7c7cc"
                            keyboardType="number-pad"
                            value={aantalPersonen}
                            onChangeText={setAantalPersonen}
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
});

import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CARDS = [
    { label: 'Taken', icon: 'checkbox-marked-circle', color: '#3B82F6', bg: '#EFF6FF', route: '/(tabs)/tasks' },
    { label: 'Ritten', icon: 'truck-outline', color: '#F59E0B', bg: '#FFFBEB', route: '/(tabs)/ritten' },
    { label: 'Voorraad', icon: 'package-variant-closed', color: '#10B981', bg: '#ECFDF5', route: '/(tabs)/voorraad' },
    { label: 'Leveringen', icon: 'truck-delivery-outline', color: '#8B5CF6', bg: '#F5F3FF', route: '/(tabs)/leveringen' },
];

export default function OperationeelScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Operationeel</Text>
            </View>
            <ScrollView contentContainerStyle={styles.grid}>
                {CARDS.map((card) => (
                    <TouchableOpacity
                        key={card.route}
                        style={styles.card}
                        onPress={() => router.push(card.route as any)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconWrap, { backgroundColor: card.bg }]}>
                            <MaterialCommunityIcons name={card.icon as any} size={32} color={card.color} />
                        </View>
                        <Text style={styles.cardLabel}>{card.label}</Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    title: { fontSize: 28, fontWeight: '700', color: '#111827' },
    grid: { padding: 16, gap: 12 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    cardLabel: { flex: 1, fontSize: 17, fontWeight: '600', color: '#111827' },
});

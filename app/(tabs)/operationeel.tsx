import React from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { isToday } from 'date-fns';

export default function OperationeelScreen() {
    const router = useRouter();

    const { data: tasks } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => directApi.tasks.getAll(),
    });

    const { data: ritten } = useQuery({
        queryKey: ['ritten'],
        queryFn: () => directApi.ritten.getMijnRitten(),
    });

    const { data: stock } = useQuery({
        queryKey: ['stock'],
        queryFn: () => directApi.stock.getAll(),
    });

    const openTasks = (tasks as any[])?.filter((t: any) => t.status === 'TODO').length ?? null;
    const todayRitten = (ritten as any[])?.filter((r: any) => r.date && isToday(new Date(r.date))).length ?? null;
    const stockList = (stock as any)?.stock ?? (Array.isArray(stock) ? stock : []);
    const lowStock = stockList.length > 0
        ? stockList.filter((s: any) => s.minStock !== null && s.quantity <= s.minStock).length
        : null;

    const CARDS = [
        {
            label: 'Taken',
            icon: 'checkbox-marked-circle' as const,
            color: '#3B82F6',
            bg: '#EFF6FF',
            route: '/(tabs)/tasks',
            count: openTasks,
            countLabel: (n: number) => n === 0 ? 'Alles gedaan' : `${n} open`,
            urgentIf: (n: number) => n > 0,
            urgentColor: '#EF4444',
        },
        {
            label: 'Ritten',
            icon: 'truck-outline' as const,
            color: '#F59E0B',
            bg: '#FFFBEB',
            route: '/(tabs)/ritten',
            count: todayRitten,
            countLabel: (n: number) => n === 0 ? 'Geen vandaag' : `${n} vandaag`,
            urgentIf: () => false,
            urgentColor: '#F59E0B',
        },
        {
            label: 'Voorraad',
            icon: 'package-variant-closed' as const,
            color: '#10B981',
            bg: '#ECFDF5',
            route: '/(tabs)/voorraad',
            count: lowStock,
            countLabel: (n: number) => n === 0 ? 'Alles op peil' : `${n} laag`,
            urgentIf: (n: number) => n > 0,
            urgentColor: '#F59E0B',
        },
        {
            label: 'Leveringen',
            icon: 'truck-delivery-outline' as const,
            color: '#8B5CF6',
            bg: '#F5F3FF',
            route: '/(tabs)/leveringen',
            count: null,
            countLabel: () => 'Items scannen',
            urgentIf: () => false,
            urgentColor: '#8B5CF6',
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Operationeel</Text>
            </View>
            <ScrollView contentContainerStyle={styles.grid}>
                {CARDS.map((card) => {
                    const isUrgent = card.count !== null && card.urgentIf(card.count);
                    const subtitle = card.count !== null ? card.countLabel(card.count) : '—';

                    return (
                        <TouchableOpacity
                            key={card.route}
                            style={styles.card}
                            onPress={() => router.push(card.route as any)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconWrapContainer}>
                                <View style={[styles.iconWrap, { backgroundColor: card.bg }]}>
                                    <MaterialCommunityIcons name={card.icon} size={32} color={card.color} />
                                </View>
                                {isUrgent && (
                                    <View style={[styles.urgentDot, { backgroundColor: card.urgentColor }]} />
                                )}
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardLabel}>{card.label}</Text>
                                <Text style={[styles.cardSubtitle, isUrgent && { color: card.urgentColor }]}>
                                    {subtitle}
                                </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={18} color="#9CA3AF" />
                        </TouchableOpacity>
                    );
                })}
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
    iconWrapContainer: {
        position: 'relative',
        marginRight: 16,
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    urgentDot: {
        position: 'absolute',
        top: -3,
        right: -3,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    cardText: {
        flex: 1,
    },
    cardLabel: { fontSize: 17, fontWeight: '600', color: '#111827' },
    cardSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
});

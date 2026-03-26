import React, { useState, useRef } from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    ScrollView, RefreshControl, FlatList, Modal, TextInput,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { useMenu } from '../../contexts/MenuContext';

// ─── Types ─────────────────────────────────────────────────────────────────

interface StockItem {
    id: string;
    productId: string;
    locationId: string;
    quantity: number;
    minStock: number | null;
    reservedQuantity: number;
    product: {
        id: string;
        name: string;
        sku: string | null;
        barcode: string | null;
        unit: string | null;
        supplier?: { name: string };
    };
    location: {
        id: string;
        name: string;
        type: string;
    };
}

interface Location {
    id: string;
    name: string;
    type: string;
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function VoorraadScreen() {
    const { openMenu } = useMenu();
    const queryClient = useQueryClient();

    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [scannedItem, setScannedItem] = useState<StockItem | null>(null);
    const [countModal, setCountModal] = useState(false);
    const [adjustModal, setAdjustModal] = useState(false);
    const [adjustTarget, setAdjustTarget] = useState<StockItem | null>(null);
    const [countInput, setCountInput] = useState('');
    const [adjustInput, setAdjustInput] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [scanProcessing, setScanProcessing] = useState(false);

    const [permission, requestPermission] = useCameraPermissions();

    // Stock query
    const { data: stockData, isLoading: stockLoading, refetch: refetchStock } = useQuery({
        queryKey: ['stock', selectedLocationId],
        queryFn: () => directApi.stock.getAll(selectedLocationId ?? undefined),
    });

    // Locations query
    const { data: locationsData } = useQuery({
        queryKey: ['locations'],
        queryFn: () => directApi.locations.getAll(),
    });

    const stockList: StockItem[] = (stockData as any)?.stock ?? [];
    const locations: Location[] = Array.isArray(locationsData) ? locationsData : (locationsData as any)?.locations ?? [];

    // Count mutation
    const countMutation = useMutation({
        mutationFn: ({ itemId, quantity, notes }: { itemId: string; quantity: number; notes?: string }) =>
            directApi.stock.count(itemId, quantity, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            setCountModal(false);
            setScannedItem(null);
            setCountInput('');
        },
        onError: () => Alert.alert('Fout', 'Opslaan mislukt, probeer opnieuw.'),
    });

    // Adjust mutation
    const adjustMutation = useMutation({
        mutationFn: ({ itemId, adjustment, reason }: { itemId: string; adjustment: number; reason?: string }) =>
            directApi.stock.adjust(itemId, adjustment, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            setAdjustModal(false);
            setAdjustTarget(null);
            setAdjustInput('');
            setAdjustReason('');
        },
        onError: () => Alert.alert('Fout', 'Opslaan mislukt, probeer opnieuw.'),
    });

    // ─── Barcode scan handler ────────────────────────────────────────────────

    async function handleBarcodeScanned({ data }: { data: string }) {
        if (scanProcessing) return;
        setScanProcessing(true);
        try {
            const result = await directApi.products.getByBarcode(data);
            const product = (result as any).product;
            if (!product) {
                Alert.alert('Niet gevonden', `Geen product gevonden voor barcode: ${data}`);
                setScanProcessing(false);
                return;
            }
            // Find stock item in current list matching this product
            const match = stockList.find(s => s.productId === product.id);
            if (match) {
                setScannedItem(match);
                setCountInput(String(match.quantity));
                setShowScanner(false);
                setCountModal(true);
            } else {
                Alert.alert('Niet in voorraad', `${product.name} is niet gevonden in de geselecteerde locatie.`);
            }
        } catch {
            Alert.alert('Niet gevonden', `Geen product gevonden voor barcode: ${data}`);
        } finally {
            setScanProcessing(false);
        }
    }

    // ─── Open scanner ────────────────────────────────────────────────────────

    async function openScanner() {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Geen toegang', 'Camera-toegang is vereist voor de barcode scanner.');
                return;
            }
        }
        setScanProcessing(false);
        setShowScanner(true);
    }

    // ─── Long press adjust ───────────────────────────────────────────────────

    function openAdjust(item: StockItem) {
        setAdjustTarget(item);
        setAdjustInput('');
        setAdjustReason('');
        setAdjustModal(true);
    }

    // ─── Render stock row ────────────────────────────────────────────────────

    function renderItem({ item }: { item: StockItem }) {
        const isLow = item.minStock != null && item.quantity <= item.minStock;
        return (
            <TouchableOpacity
                style={styles.stockRow}
                onLongPress={() => openAdjust(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.stockQtyBadge, isLow && styles.stockQtyBadgeLow]}>
                    <Text style={[styles.stockQtyText, isLow && styles.stockQtyTextLow]}>
                        {item.quantity}
                    </Text>
                    <Text style={[styles.stockUnitText, isLow && styles.stockUnitTextLow]}>
                        {item.product.unit ?? ''}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.productName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.locationName}>{item.location?.name ?? '—'}</Text>
                    {item.product.supplier?.name && (
                        <Text style={styles.supplierName}>{item.product.supplier.name}</Text>
                    )}
                </View>
                {isLow && (
                    <View style={styles.lowBadge}>
                        <FeatherIcon name="alert-triangle" size={12} color="#DC2626" />
                        <Text style={styles.lowBadgeText}>Laag</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    }

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={openMenu}>
                        <FeatherIcon name="menu" size={22} color="#6B7280" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Voorraad</Text>
                </View>
                <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
                    <FeatherIcon name="camera" size={18} color="#fff" />
                    <Text style={styles.scanBtnText}>Scan</Text>
                </TouchableOpacity>
            </View>

            {/* Location filter */}
            {locations.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterBar}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
                >
                    <TouchableOpacity
                        style={[styles.filterChip, selectedLocationId === null && styles.filterChipActive]}
                        onPress={() => setSelectedLocationId(null)}
                    >
                        <Text style={[styles.filterChipText, selectedLocationId === null && styles.filterChipTextActive]}>
                            Alle
                        </Text>
                    </TouchableOpacity>
                    {locations.map((loc: Location) => (
                        <TouchableOpacity
                            key={loc.id}
                            style={[styles.filterChip, selectedLocationId === loc.id && styles.filterChipActive]}
                            onPress={() => setSelectedLocationId(loc.id)}
                        >
                            <Text style={[styles.filterChipText, selectedLocationId === loc.id && styles.filterChipTextActive]}>
                                {loc.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* List */}
            {stockLoading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : stockList.length === 0 ? (
                <View style={styles.centerContent}>
                    <MaterialCommunityIcons name="package-variant-closed" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>Geen voorraad</Text>
                    <Text style={styles.emptyText}>Geen producten gevonden</Text>
                </View>
            ) : (
                <FlatList
                    data={stockList}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16 }}
                    refreshControl={<RefreshControl refreshing={stockLoading} onRefresh={refetchStock} />}
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
            )}

            {/* Barcode scanner modal */}
            <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        onBarcodeScanned={handleBarcodeScanned}
                        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'qr', 'code128', 'code39', 'upc_a', 'upc_e'] }}
                    />
                    {/* Overlay */}
                    <View style={styles.scanOverlay}>
                        <View style={styles.scanFrame} />
                        <Text style={styles.scanHint}>Richt de camera op de barcode</Text>
                        {scanProcessing && <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />}
                    </View>
                    <TouchableOpacity
                        style={styles.scanCloseBtn}
                        onPress={() => setShowScanner(false)}
                    >
                        <FeatherIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* Count modal */}
            <Modal visible={countModal} transparent animationType="fade" onRequestClose={() => setCountModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Telling registreren</Text>
                        {scannedItem && (
                            <Text style={styles.modalSubtitle} numberOfLines={1}>{scannedItem.product.name}</Text>
                        )}
                        <Text style={styles.inputLabel}>Werkelijk aantal</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={countInput}
                            onChangeText={setCountInput}
                            placeholder="0"
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => { setCountModal(false); setScannedItem(null); }}
                            >
                                <Text style={styles.cancelBtnText}>Annuleren</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, countMutation.isPending && { opacity: 0.5 }]}
                                disabled={countMutation.isPending}
                                onPress={() => {
                                    if (!scannedItem) return;
                                    const qty = parseFloat(countInput);
                                    if (isNaN(qty) || qty < 0) {
                                        Alert.alert('Ongeldig', 'Voer een geldig aantal in.');
                                        return;
                                    }
                                    countMutation.mutate({ itemId: scannedItem.id, quantity: qty });
                                }}
                            >
                                {countMutation.isPending
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.saveBtnText}>Opslaan</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Adjust modal (via long press) */}
            <Modal visible={adjustModal} transparent animationType="fade" onRequestClose={() => setAdjustModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Voorraad aanpassen</Text>
                        {adjustTarget && (
                            <Text style={styles.modalSubtitle} numberOfLines={1}>
                                {adjustTarget.product.name} — huidig: {adjustTarget.quantity} {adjustTarget.product.unit ?? ''}
                            </Text>
                        )}
                        <Text style={styles.inputLabel}>Aanpassing (+/-)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numbers-and-punctuation"
                            value={adjustInput}
                            onChangeText={setAdjustInput}
                            placeholder="-5 of +10"
                            autoFocus
                        />
                        <Text style={styles.inputLabel}>Reden (optioneel)</Text>
                        <TextInput
                            style={[styles.input, { marginBottom: 16 }]}
                            value={adjustReason}
                            onChangeText={setAdjustReason}
                            placeholder="bv. Gespild, telling, levering"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setAdjustModal(false)}
                            >
                                <Text style={styles.cancelBtnText}>Annuleren</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, adjustMutation.isPending && { opacity: 0.5 }]}
                                disabled={adjustMutation.isPending}
                                onPress={() => {
                                    if (!adjustTarget) return;
                                    const adj = parseFloat(adjustInput);
                                    if (isNaN(adj)) {
                                        Alert.alert('Ongeldig', 'Voer een getal in, bv. -5 of 10');
                                        return;
                                    }
                                    adjustMutation.mutate({
                                        itemId: adjustTarget.id,
                                        adjustment: adj,
                                        reason: adjustReason || undefined,
                                    });
                                }}
                            >
                                {adjustMutation.isPending
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.saveBtnText}>Opslaan</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
    scanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#3B82F6',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    scanBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    filterBar: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        maxHeight: 54,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 99,
        backgroundColor: '#F3F4F6',
    },
    filterChipActive: {
        backgroundColor: '#DBEAFE',
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    filterChipTextActive: {
        color: '#1D4ED8',
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
    stockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    stockQtyBadge: {
        minWidth: 52,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    stockQtyBadgeLow: {
        backgroundColor: '#FEF2F2',
    },
    stockQtyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#065F46',
    },
    stockQtyTextLow: {
        color: '#DC2626',
    },
    stockUnitText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#065F46',
    },
    stockUnitTextLow: {
        color: '#DC2626',
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    locationName: {
        fontSize: 12,
        fontWeight: '400',
        color: '#6B7280',
    },
    supplierName: {
        fontSize: 12,
        fontWeight: '400',
        color: '#9CA3AF',
    },
    lowBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 99,
    },
    lowBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#DC2626',
    },
    // Scanner overlay
    scanOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
    },
    scanFrame: {
        width: 250,
        height: 180,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 12,
        opacity: 0.8,
    },
    scanHint: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 8,
    },
    scanCloseBtn: {
        position: 'absolute',
        top: 56,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        fontWeight: '400',
        color: '#6B7280',
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
        marginBottom: 16,
        backgroundColor: '#F9FAFB',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    saveBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});

import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    FlatList,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { useMenu } from '../../contexts/MenuContext';
import { BarcodeScanner } from '../../components/BarcodeScanner';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Location {
    id: string;
    name: string;
    type: string;
}

interface DraftItem {
    productId: string;
    productName: string;
    quantity: number;
    unitCost?: number;
    batchNumber?: string;
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function LeveringenScreen() {
    const { openMenu } = useMenu();
    const queryClient = useQueryClient();

    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
    const [successBanner, setSuccessBanner] = useState(false);

    // Scanner
    const [showScanner, setShowScanner] = useState(false);
    const [scanProcessing, setScanProcessing] = useState(false);

    // Item modal (after scan)
    const [itemModal, setItemModal] = useState(false);
    const [pendingProduct, setPendingProduct] = useState<{ id: string; name: string } | null>(null);
    const [itemQty, setItemQty] = useState('1');
    const [itemCost, setItemCost] = useState('');
    const [itemBatch, setItemBatch] = useState('');

    // Edit modal
    const [editModal, setEditModal] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [editQty, setEditQty] = useState('');
    const [editCost, setEditCost] = useState('');
    const [editBatch, setEditBatch] = useState('');

    const { data: locationsData } = useQuery({
        queryKey: ['locations'],
        queryFn: () => directApi.locations.getAll(),
    });

    const locations: Location[] = Array.isArray(locationsData)
        ? locationsData
        : (locationsData as any)?.locations ?? [];

    useEffect(() => {
        if (selectedLocationId !== null || locations.length === 0) return;
        const magazijn =
            locations.find((loc) => loc.name.toLowerCase() === 'magazijn') ??
            locations.find((loc) => loc.name.toLowerCase().includes('magazijn'));
        if (magazijn) setSelectedLocationId(magazijn.id);
    }, [locations, selectedLocationId]);

    const submitMutation = useMutation({
        mutationFn: () => {
            if (!selectedLocationId) throw new Error('Geen locatie geselecteerd');
            return directApi.receipts.create({
                locationId: selectedLocationId,
                items: draftItems.map((d) => ({
                    productId: d.productId,
                    quantity: d.quantity,
                    unitCost: d.unitCost,
                    batchNumber: d.batchNumber,
                })),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            setDraftItems([]);
            setSuccessBanner(true);
            setTimeout(() => setSuccessBanner(false), 3000);
        },
        onError: (e: any) => {
            Alert.alert('Fout', e?.message || 'Levering versturen mislukt.');
        },
    });

    // ─── Barcode scan handler ─────────────────────────────────────────────

    const handleBarcodeScanned = useCallback(
        async (data: string) => {
            if (scanProcessing) return;
            setScanProcessing(true);
            try {
                const result = await directApi.products.getByBarcode(data);
                const product = (result as any).product;
                if (!product) {
                    setShowScanner(false);
                    Alert.alert('Niet gevonden', `Geen product gevonden voor barcode: ${data}`);
                    return;
                }
                setPendingProduct({ id: product.id, name: product.name });
                setItemQty('1');
                setItemCost('');
                setItemBatch('');
                setShowScanner(false);
                setItemModal(true);
            } catch {
                setShowScanner(false);
                Alert.alert('Niet gevonden', `Geen product gevonden voor barcode: ${data}`);
            } finally {
                setScanProcessing(false);
            }
        },
        [scanProcessing],
    );

    // ─── Add item from modal ──────────────────────────────────────────────

    function confirmAddItem() {
        if (!pendingProduct) return;
        const qty = parseFloat(itemQty);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Ongeldig', 'Voer een geldig aantal in.');
            return;
        }
        const cost = itemCost ? parseFloat(itemCost) : undefined;
        setDraftItems((prev) => {
            const existing = prev.findIndex((d) => d.productId === pendingProduct.id);
            if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = {
                    ...updated[existing],
                    quantity: updated[existing].quantity + qty,
                    unitCost: cost ?? updated[existing].unitCost,
                    batchNumber: itemBatch || updated[existing].batchNumber,
                };
                return updated;
            }
            return [
                ...prev,
                {
                    productId: pendingProduct.id,
                    productName: pendingProduct.name,
                    quantity: qty,
                    unitCost: cost,
                    batchNumber: itemBatch || undefined,
                },
            ];
        });
        setItemModal(false);
        setPendingProduct(null);
    }

    // ─── Edit item ────────────────────────────────────────────────────────

    function openEdit(index: number) {
        const item = draftItems[index];
        setEditIndex(index);
        setEditQty(String(item.quantity));
        setEditCost(item.unitCost != null ? String(item.unitCost) : '');
        setEditBatch(item.batchNumber ?? '');
        setEditModal(true);
    }

    function confirmEdit() {
        if (editIndex === null) return;
        const qty = parseFloat(editQty);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Ongeldig', 'Voer een geldig aantal in.');
            return;
        }
        setDraftItems((prev) => {
            const updated = [...prev];
            updated[editIndex] = {
                ...updated[editIndex],
                quantity: qty,
                unitCost: editCost ? parseFloat(editCost) : undefined,
                batchNumber: editBatch || undefined,
            };
            return updated;
        });
        setEditModal(false);
        setEditIndex(null);
    }

    function removeItem(index: number) {
        setDraftItems((prev) => prev.filter((_, i) => i !== index));
    }

    // ─── Render draft item ─────────────────────────────────────────────────

    function renderDraftItem({ item, index }: { item: DraftItem; index: number }) {
        return (
            <View style={styles.draftRow}>
                <View style={styles.draftQtyBadge}>
                    <Text style={styles.draftQtyText}>{item.quantity}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.draftName} numberOfLines={1}>{item.productName}</Text>
                    {(item.unitCost != null || item.batchNumber) && (
                        <Text style={styles.draftMeta}>
                            {item.unitCost != null ? `€${item.unitCost.toFixed(2)}/st` : ''}
                            {item.unitCost != null && item.batchNumber ? '  ·  ' : ''}
                            {item.batchNumber ? `Batch: ${item.batchNumber}` : ''}
                        </Text>
                    )}
                </View>
                <TouchableOpacity style={styles.draftEditBtn} onPress={() => openEdit(index)}>
                    <FeatherIcon name="edit-2" size={16} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.draftDeleteBtn} onPress={() => removeItem(index)}>
                    <FeatherIcon name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
            </View>
        );
    }

    const canSubmit = selectedLocationId && draftItems.length > 0;

    // ─── Render ────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={openMenu}>
                        <FeatherIcon name="menu" size={22} color="#6B7280" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Leveringen</Text>
                </View>
                <TouchableOpacity
                    style={[styles.scanBtn, !selectedLocationId && styles.scanBtnDisabled]}
                    onPress={() => {
                        if (!selectedLocationId) {
                            Alert.alert('Selecteer locatie', 'Kies eerst een ontvangstlocatie.');
                            return;
                        }
                        setShowScanner(true);
                    }}
                >
                    <FeatherIcon name="camera" size={18} color="#fff" />
                    <Text style={styles.scanBtnText}>Scan</Text>
                </TouchableOpacity>
            </View>

            {/* Success banner */}
            {successBanner && (
                <View style={styles.successBanner}>
                    <FeatherIcon name="check-circle" size={16} color="#fff" />
                    <Text style={styles.successBannerText}>Levering verwerkt!</Text>
                </View>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
                {/* Location selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Ontvangstlocatie</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                    >
                        {locations.map((loc) => (
                            <TouchableOpacity
                                key={loc.id}
                                style={[
                                    styles.filterChip,
                                    selectedLocationId === loc.id && styles.filterChipActive,
                                ]}
                                onPress={() => setSelectedLocationId(loc.id)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selectedLocationId === loc.id && styles.filterChipTextActive,
                                    ]}
                                >
                                    {loc.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Draft items */}
                {draftItems.length > 0 ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>
                            Items ({draftItems.length})
                        </Text>
                        {draftItems.map((item, index) =>
                            renderDraftItem({ item, index }),
                        )}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons
                            name="barcode-scan"
                            size={48}
                            color="#D1D5DB"
                        />
                        <Text style={styles.emptyTitle}>Geen items</Text>
                        <Text style={styles.emptyText}>
                            Scan een barcode om een product toe te voegen
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Submit button */}
            {draftItems.length > 0 && (
                <View style={styles.submitBar}>
                    <TouchableOpacity
                        style={[
                            styles.submitBtn,
                            (!canSubmit || submitMutation.isPending) && styles.submitBtnDisabled,
                        ]}
                        disabled={!canSubmit || submitMutation.isPending}
                        onPress={() => submitMutation.mutate()}
                    >
                        {submitMutation.isPending ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <MaterialCommunityIcons
                                    name="truck-delivery-outline"
                                    size={20}
                                    color="#fff"
                                />
                                <Text style={styles.submitBtnText}>
                                    Levering versturen ({draftItems.length}{' '}
                                    {draftItems.length === 1 ? 'item' : 'items'})
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Barcode scanner */}
            <BarcodeScanner
                visible={showScanner}
                onScan={handleBarcodeScanned}
                onClose={() => setShowScanner(false)}
                isProcessing={scanProcessing}
                hint="Scan product voor levering"
            />

            {/* Add item modal */}
            <Modal
                visible={itemModal}
                transparent
                animationType="fade"
                onRequestClose={() => setItemModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Product toevoegen</Text>
                        {pendingProduct && (
                            <Text style={styles.modalSubtitle} numberOfLines={1}>
                                {pendingProduct.name}
                            </Text>
                        )}
                        <Text style={styles.inputLabel}>Aantal *</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={itemQty}
                            onChangeText={setItemQty}
                            placeholder="1"
                            autoFocus
                        />
                        <Text style={styles.inputLabel}>Inkoopprijs per stuk (optioneel)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={itemCost}
                            onChangeText={setItemCost}
                            placeholder="0.00"
                        />
                        <Text style={styles.inputLabel}>Batchnummer (optioneel)</Text>
                        <TextInput
                            style={[styles.input, { marginBottom: 20 }]}
                            value={itemBatch}
                            onChangeText={setItemBatch}
                            placeholder="bv. LOT2024-001"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => { setItemModal(false); setPendingProduct(null); }}
                            >
                                <Text style={styles.cancelBtnText}>Annuleren</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={confirmAddItem}>
                                <Text style={styles.saveBtnText}>Toevoegen</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Edit item modal */}
            <Modal
                visible={editModal}
                transparent
                animationType="fade"
                onRequestClose={() => setEditModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Item aanpassen</Text>
                        {editIndex !== null && (
                            <Text style={styles.modalSubtitle} numberOfLines={1}>
                                {draftItems[editIndex]?.productName}
                            </Text>
                        )}
                        <Text style={styles.inputLabel}>Aantal *</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={editQty}
                            onChangeText={setEditQty}
                            autoFocus
                        />
                        <Text style={styles.inputLabel}>Inkoopprijs per stuk (optioneel)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="decimal-pad"
                            value={editCost}
                            onChangeText={setEditCost}
                            placeholder="0.00"
                        />
                        <Text style={styles.inputLabel}>Batchnummer (optioneel)</Text>
                        <TextInput
                            style={[styles.input, { marginBottom: 20 }]}
                            value={editBatch}
                            onChangeText={setEditBatch}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setEditModal(false)}
                            >
                                <Text style={styles.cancelBtnText}>Annuleren</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={confirmEdit}>
                                <Text style={styles.saveBtnText}>Opslaan</Text>
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
    scanBtnDisabled: {
        backgroundColor: '#93C5FD',
    },
    scanBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    successBannerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    section: {
        gap: 10,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
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
    draftRow: {
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
    draftQtyBadge: {
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    draftQtyText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    draftName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    draftMeta: {
        fontSize: 12,
        color: '#6B7280',
    },
    draftEditBtn: {
        padding: 6,
    },
    draftDeleteBtn: {
        padding: 6,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
        gap: 8,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginTop: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    submitBar: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        paddingVertical: 16,
        borderRadius: 12,
    },
    submitBtnDisabled: {
        backgroundColor: '#6EE7B7',
    },
    submitBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
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

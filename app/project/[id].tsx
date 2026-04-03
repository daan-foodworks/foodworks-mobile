import React, { useState } from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { useAuthStore } from '../../stores/authStore';

type TabKey = 'info' | 'financials' | 'revenue' | 'inventory';

export default function ProjectDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const user = useAuthStore((s) => s.user);
    const isShiftleader = user?.role === 'SHIFTLEADER';

    const [activeTab, setActiveTab] = useState<TabKey>('info');
    const [showRevenueForm, setShowRevenueForm] = useState(false);
    const [revenueAmount, setRevenueAmount] = useState('');
    const [revenueDescription, setRevenueDescription] = useState('');
    const [revenueVatRate, setRevenueVatRate] = useState('21');

    // Inventory planning state
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [planQty, setPlanQty] = useState('1');

    // Closeout state
    const [showCloseoutModal, setShowCloseoutModal] = useState(false);
    const [closeoutItems, setCloseoutItems] = useState<Record<string, { remainingQty: string; disposition: 'RETURN' | 'WASTE' }>>({});

    const { data: project, isLoading } = useQuery({
        queryKey: ['project', id],
        queryFn: () => directApi.projects.getById(id),
        enabled: !!id,
    });

    const addRevenueMutation = useMutation({
        mutationFn: async () => {
            const amount = parseFloat(revenueAmount.replace(',', '.'));
            if (isNaN(amount) || amount <= 0) {
                throw new Error('Voer een geldig bedrag in');
            }
            return await directApi.revenues.create({
                projectId: id,
                amount,
                vatRate: parseFloat(revenueVatRate) || 0,
                description: revenueDescription || undefined,
                date: new Date().toISOString(),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            setShowRevenueForm(false);
            setRevenueAmount('');
            setRevenueDescription('');
            setRevenueVatRate('21');
        },
        onError: (error: Error) => {
            Alert.alert('Fout', error.message);
        },
    });

    const deleteRevenueMutation = useMutation({
        mutationFn: (revenueId: string) => directApi.revenues.delete(revenueId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project', id] });
        },
    });

    // ── Stock allocation queries & mutations ──
    const { data: allocationsData, refetch: refetchAllocations } = useQuery({
        queryKey: ['allocations', id],
        queryFn: () => directApi.stockAllocations.getAllocations(id),
        enabled: !!id && activeTab === 'inventory',
    });
    const allocations: any[] = allocationsData?.allocations || [];

    const { data: productsData, isLoading: productsLoading } = useQuery({
        queryKey: ['products-all'],
        queryFn: () => directApi.products.getAll(),
        enabled: showAddItemModal,
    });
    const allProducts: any[] = Array.isArray(productsData) ? productsData : [];

    const planMutation = useMutation({
        mutationFn: ({ productId, qty }: { productId: string; qty: number }) =>
            directApi.stockAllocations.plan(id, [{ productId, plannedQuantity: qty }]),
        onSuccess: () => {
            refetchAllocations();
            setShowAddItemModal(false);
            setSelectedProduct(null);
            setProductSearch('');
            setPlanQty('1');
        },
        onError: (e: any) => Alert.alert('Fout', e?.message ?? 'Plannen mislukt'),
    });

    const loadMutation = useMutation({
        mutationFn: () => {
            const planned = allocations.filter((a: any) => a.status === 'PLANNED');
            if (planned.length === 0) throw new Error('Geen geplande items om te laden');
            const items = planned.map((a: any) => ({
                productId: a.productId,
                quantity: a.plannedQuantity,
            }));
            return directApi.stockAllocations.load(id, items, user?.id);
        },
        onSuccess: () => {
            refetchAllocations();
            Alert.alert('Geladen', 'De vrachtwagen is geladen. Voorraad is bijgewerkt.');
        },
        onError: (e: any) => Alert.alert('Fout', e?.message ?? 'Laden mislukt'),
    });

    const closeoutMutation = useMutation({
        mutationFn: () => {
            const items = Object.entries(closeoutItems).map(([allocationId, val]) => ({
                allocationId,
                remainingQuantity: parseInt(val.remainingQty || '0', 10),
                disposition: val.disposition,
            }));
            return directApi.stockAllocations.closeout(id, items);
        },
        onSuccess: () => {
            setShowCloseoutModal(false);
            setCloseoutItems({});
            refetchAllocations();
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            Alert.alert('Afgerond', 'Het evenement is succesvol afgesloten. Resterende voorraad is verwerkt.');
        },
        onError: (e: any) => Alert.alert('Fout', e?.message ?? 'Afronden mislukt'),
    });

    const handleDeleteRevenue = (revenueId: string, description: string) => {
        Alert.alert(
            'Omzet verwijderen',
            `Weet je zeker dat je "${description || 'deze omzet'}" wilt verwijderen?`,
            [
                { text: 'Annuleren', style: 'cancel' },
                {
                    text: 'Verwijderen',
                    style: 'destructive',
                    onPress: () => deleteRevenueMutation.mutate(revenueId),
                },
            ]
        );
    };

    const openLocation = (location: any) => {
        const query = location.address || location.name;
        const encoded = encodeURIComponent(query);
        Alert.alert('Navigeren', 'Open locatie in:', [
            { text: 'Apple Kaarten', onPress: () => Linking.openURL(`maps:?q=${encoded}`) },
            { text: 'Google Maps', onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`) },
            { text: 'Waze', onPress: () => Linking.openURL(`https://waze.com/ul?q=${encoded}`) },
            { text: 'Annuleren', style: 'cancel' },
        ]);
    };

    // Shiftleaders can only see revenue module during event dates
    const canSeeRevenue = (() => {
        if (!isShiftleader) return true;
        if (!project?.eventStartDate) return false;
        const now = new Date();
        const start = new Date(project.eventStartDate);
        start.setHours(0, 0, 0, 0);
        const end = project.eventEndDate ? new Date(project.eventEndDate) : new Date(project.eventStartDate);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
    })();

    if (isLoading || !project) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                <View style={styles.loading}>
                    <Text style={styles.loadingText}>Laden...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#10B981';
            case 'PLANNED': return '#F59E0B';
            case 'COMPLETED': return '#3B82F6';
            case 'ARCHIVED': return '#6B7280';
            default: return '#6B7280';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PLANNED': return 'Gepland';
            case 'ACTIVE': return 'Actief';
            case 'COMPLETED': return 'Afgerond';
            case 'ARCHIVED': return 'Archief';
            default: return status;
        }
    };

    // Build available tabs based on role
    const tabs: { key: TabKey; label: string; icon: string }[] = [
        { key: 'info', label: 'Info', icon: 'info' },
    ];
    if (!isShiftleader) {
        tabs.push({ key: 'financials', label: 'Financiën', icon: 'bar-chart-2' });
    }
    if (canSeeRevenue) {
        tabs.push({ key: 'revenue', label: 'Omzet', icon: 'trending-up' });
    }
    tabs.push({ key: 'inventory', label: 'Voorraad', icon: 'package' });

    // ─── Tab Content Renderers ───

    const renderInfoTab = () => (
        <ScrollView style={styles.tabContent}>
            <View style={styles.infoCard}>
                <InfoRow icon="hash" label="Projectnummer" value={project.projectNumber} />
                {project.description && (
                    <InfoRow icon="file-text" label="Beschrijving" value={project.description} />
                )}
                {project.eventStartDate && (
                    <InfoRow
                        icon="calendar"
                        label="Datum"
                        value={`${new Date(project.eventStartDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}${project.eventEndDate && project.eventEndDate !== project.eventStartDate
                            ? ` — ${new Date(project.eventEndDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`
                            : ''
                            }`}
                    />
                )}
                {project.projectManager && (
                    <InfoRow icon="user" label="Projectmanager" value={project.projectManager.name} />
                )}
                {project.location && (
                    <TouchableOpacity
                        style={styles.infoRow}
                        onPress={() => openLocation(project.location)}
                        activeOpacity={0.6}
                    >
                        <View style={[styles.infoIcon, { backgroundColor: '#EFF6FF' }]}>
                            <FeatherIcon name="map-pin" size={16} color="#3B82F6" />
                        </View>
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Locatie</Text>
                            <Text style={[styles.infoValue, { color: '#3B82F6' }]}>{project.location.name}</Text>
                            {project.location.address && (
                                <Text style={styles.infoSubValue}>{project.location.address}</Text>
                            )}
                        </View>
                        <FeatherIcon name="navigation" size={16} color="#3B82F6" style={{ alignSelf: 'center' }} />
                    </TouchableOpacity>
                )}
                {project.clientName && (
                    <InfoRow icon="briefcase" label="Klant" value={project.clientName} last />
                )}
            </View>

            {/* Shiftleaders section */}
            {project.shiftleaders && project.shiftleaders.length > 0 && (
                <View style={[styles.infoCard, { marginTop: 12 }]}>
                    <Text style={styles.cardTitle}>Shiftleaders</Text>
                    {project.shiftleaders.map((sl: any) => (
                        <View key={sl.user?.id || sl.userId} style={styles.shiftleaderRow}>
                            <View style={styles.shiftleaderAvatar}>
                                <Text style={styles.shiftleaderInitial}>
                                    {sl.user?.name?.charAt(0) || '?'}
                                </Text>
                            </View>
                            <Text style={styles.shiftleaderName}>{sl.user?.name || 'Onbekend'}</Text>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );

    const renderFinancialsTab = () => (
        <ScrollView style={styles.tabContent}>
            <View style={styles.financialGrid}>
                <View style={[styles.financialCard, { backgroundColor: '#F0FDF4' }]}>
                    <FeatherIcon name="trending-up" size={22} color="#10B981" />
                    <Text style={styles.financialLabel}>Omzet</Text>
                    <Text style={[styles.financialAmount, { color: '#10B981' }]}>
                        €{project.totalRevenue?.toFixed(2) || '0.00'}
                    </Text>
                </View>
                <View style={[styles.financialCard, { backgroundColor: '#FEF2F2' }]}>
                    <FeatherIcon name="trending-down" size={22} color="#EF4444" />
                    <Text style={styles.financialLabel}>Kosten</Text>
                    <Text style={[styles.financialAmount, { color: '#EF4444' }]}>
                        €{project.totalExpenses?.toFixed(2) || '0.00'}
                    </Text>
                </View>
            </View>
            <View style={[styles.financialCard, styles.profitCard]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <FeatherIcon name="award" size={24} color={project.netProfit >= 0 ? '#10B981' : '#EF4444'} />
                    <View>
                        <Text style={styles.financialLabel}>Netto winst</Text>
                        <Text style={[styles.financialAmountLarge, { color: project.netProfit >= 0 ? '#10B981' : '#EF4444' }]}>
                            €{project.netProfit?.toFixed(2) || '0.00'}
                        </Text>
                    </View>
                </View>
            </View>
            {project.commission > 0 && (
                <View style={[styles.financialCard, { marginTop: 12 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <FeatherIcon name="percent" size={20} color="#F59E0B" />
                        <View>
                            <Text style={styles.financialLabel}>Afdracht ({project.commissionRate}%)</Text>
                            <Text style={[styles.financialAmount, { color: '#F59E0B' }]}>
                                €{project.commission?.toFixed(2)}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Laatste 5 kosten */}
            <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 }}>
                    Laatste kosten
                </Text>
                {(() => {
                    const costs = (project.invoices || [])
                        .filter((inv: any) => inv.type === 'INCOMING_INVOICE' || inv.type === 'RECEIPT')
                        .sort((a: any, b: any) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime())
                        .slice(0, 5);

                    if (costs.length === 0) {
                        return (
                            <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center' }}>
                                <FeatherIcon name="inbox" size={32} color="#D1D5DB" />
                                <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>Geen kosten gevonden</Text>
                            </View>
                        );
                    }

                    return (
                        <View style={{
                            backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
                            shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2
                        }}>
                            {costs.map((inv: any, index: number) => (
                                <View key={inv.id} style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    paddingHorizontal: 16, paddingVertical: 12,
                                    borderBottomWidth: index < costs.length - 1 ? 1 : 0,
                                    borderBottomColor: '#F3F4F6',
                                }}>
                                    <View style={{
                                        width: 36, height: 36, borderRadius: 18,
                                        backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
                                        marginRight: 12,
                                    }}>
                                        <FeatherIcon
                                            name={inv.type === 'RECEIPT' ? 'file' : 'file-text'}
                                            size={16}
                                            color="#EF4444"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                                            {inv.supplier || inv.description || (inv.type === 'RECEIPT' ? 'Bon' : 'Factuur')}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                                            {inv.invoiceDate
                                                ? new Date(inv.invoiceDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                                                : ''}
                                            {inv.type === 'RECEIPT' ? ' • Bon' : ' • Factuur'}
                                            {inv.status && inv.status !== 'PAID' ? ` • ${inv.status}` : ''}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>
                                        €{(inv.totalAmount || inv.amount || 0).toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    );
                })()}
            </View>
        </ScrollView>
    );

    const renderRevenueTab = () => (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.tabContent}>
                {project.revenues && project.revenues.length > 0 ? (
                    project.revenues.map((rev: any) => (
                        <View key={rev.id} style={styles.revenueCard}>
                            <View style={styles.revenueMain}>
                                <View style={styles.revenueIcon}>
                                    <FeatherIcon name="trending-up" size={18} color="#10B981" />
                                </View>
                                <View style={styles.revenueInfo}>
                                    <Text style={styles.revenueAmount}>
                                        €{rev.amount?.toFixed(2)}
                                    </Text>
                                    {rev.description ? (
                                        <Text style={styles.revenueDesc}>{rev.description}</Text>
                                    ) : null}
                                    <Text style={styles.revenueDate}>
                                        {new Date(rev.date).toLocaleDateString('nl-NL', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                        {rev.enteredBy && ` • ${rev.enteredBy.name}`}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteRevBtn}
                                    onPress={() => handleDeleteRevenue(rev.id, rev.description)}
                                >
                                    <FeatherIcon name="trash-2" size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <FeatherIcon name="bar-chart-2" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>Nog geen omzet</Text>
                        <Text style={styles.emptySubtitle}>
                            Registreer omzet voor dit project
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Floating add button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowRevenueForm(true)}
                activeOpacity={0.8}
            >
                <FeatherIcon name="plus" size={22} color="#fff" />
            </TouchableOpacity>
        </View>
    );

    const renderInventoryTab = () => {
        const transactions = project.inventoryTransactions || [];

        const plannedItems = allocations.filter((a: any) => a.status === 'PLANNED');
        const loadedItems = allocations.filter((a: any) => a.status !== 'PLANNED');

        const getStatusBadge = (status: string) => {
            if (status === 'LOADED') return { label: 'Geladen', bg: '#D1FAE5', color: '#065F46' };
            if (status === 'COMPLETED') return { label: 'Afgerond', bg: '#DBEAFE', color: '#1D4ED8' };
            return { label: 'Gepland', bg: '#FEF3C7', color: '#92400E' };
        };

        // Keep existing daily stocks logic below
        const dailyStocks = project.dailyStocks || [];
        const stocksByDate: Record<string, any[]> = {};
        dailyStocks.forEach((ds: any) => {
            const dateKey = new Date(ds.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
            if (!stocksByDate[dateKey]) stocksByDate[dateKey] = [];
            stocksByDate[dateKey].push(ds);
        });
        const sortedDates = Object.keys(stocksByDate).sort((a, b) => {
            const parseDate = (d: string) => {
                const parts = d.split(' ');
                return new Date(`${parts[1]} ${parts[0]}, ${parts[2]}`);
            };
            return parseDate(b).getTime() - parseDate(a).getTime();
        });

        const getTransactionTypeInfo = (type: string) => {
            switch (type) {
                case 'IN': return { label: 'Inkomend', color: '#10B981', icon: 'arrow-down-circle' };
                case 'OUT': return { label: 'Uitgaand', color: '#EF4444', icon: 'arrow-up-circle' };
                case 'COUNT': return { label: 'Telling', color: '#3B82F6', icon: 'check-circle' };
                case 'ADJUSTMENT': return { label: 'Correctie', color: '#F59E0B', icon: 'edit-3' };
                default: return { label: type, color: '#6B7280', icon: 'activity' };
            }
        };

        return (
            <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 40 }}>

                {/* ── Planning sectie ── */}
                <View style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Planning</Text>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                            onPress={() => setShowAddItemModal(true)}
                        >
                            <FeatherIcon name="plus" size={14} color="#1D4ED8" />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1D4ED8' }}>Item toevoegen</Text>
                        </TouchableOpacity>
                    </View>

                    {allocations.length === 0 ? (
                        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center' }}>
                            <FeatherIcon name="package" size={32} color="#D1D5DB" />
                            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>Nog geen voorraad gepland</Text>
                        </View>
                    ) : (
                        <View style={{ backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                            {allocations.map((alloc: any, idx: number) => {
                                const badge = getStatusBadge(alloc.status);
                                return (
                                    <View key={alloc.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: idx < allocations.length - 1 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                            <FeatherIcon name="package" size={16} color="#3B82F6" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                                                {alloc.product?.name || 'Onbekend product'}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                                                {alloc.plannedQuantity} {alloc.product?.unit || 'stuks'} gepland
                                                {alloc.loadedQuantity ? ` · ${alloc.loadedQuantity} geladen` : ''}
                                            </Text>
                                        </View>
                                        <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: badge.color }}>{badge.label}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Vrachtwagen laden knop */}
                    {plannedItems.length > 0 && !project.closeoutAt && (
                        <TouchableOpacity
                            style={{ marginTop: 12, backgroundColor: '#1976D2', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loadMutation.isPending ? 0.7 : 1 }}
                            onPress={() => {
                                Alert.alert(
                                    'Vrachtwagen laden',
                                    `${plannedItems.length} item(s) laden vanuit magazijn naar dit project?`,
                                    [
                                        { text: 'Annuleren', style: 'cancel' },
                                        { text: 'Laden', onPress: () => loadMutation.mutate() },
                                    ]
                                );
                            }}
                            disabled={loadMutation.isPending}
                        >
                            <FeatherIcon name="truck" size={18} color="#fff" />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                                {loadMutation.isPending ? 'Laden...' : `Laad vrachtwagen (${plannedItems.length})`}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Evenement afronden knop */}
                    {!project.closeoutAt && loadedItems.length > 0 && (
                        <TouchableOpacity
                            style={{ marginTop: 12, backgroundColor: '#DC2626', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            onPress={() => {
                                // Initialise closeout state met defaults
                                const initial: Record<string, { remainingQty: string; disposition: 'RETURN' | 'WASTE' }> = {};
                                loadedItems.forEach((a: any) => { initial[a.id] = { remainingQty: '0', disposition: 'RETURN' }; });
                                setCloseoutItems(initial);
                                setShowCloseoutModal(true);
                            }}
                        >
                            <FeatherIcon name="flag" size={18} color="#fff" />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Evenement afronden</Text>
                        </TouchableOpacity>
                    )}

                    {/* Afgesloten banner */}
                    {project.closeoutAt && (
                        <View style={{ marginTop: 12, backgroundColor: '#D1FAE5', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <FeatherIcon name="check-circle" size={20} color="#065F46" />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#065F46' }}>Evenement afgesloten</Text>
                                <Text style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                                    {new Date(project.closeoutAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Daily Stock Counts */}
                {sortedDates.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 }}>
                            Dagtellingen
                        </Text>
                        {sortedDates.slice(0, 3).map((dateKey) => (
                            <View key={dateKey} style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6 }}>
                                    {dateKey}
                                </Text>
                                <View style={{
                                    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
                                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2
                                }}>
                                    {stocksByDate[dateKey].map((ds: any, idx: number) => (
                                        <View key={ds.id} style={{
                                            flexDirection: 'row', alignItems: 'center',
                                            paddingHorizontal: 16, paddingVertical: 12,
                                            borderBottomWidth: idx < stocksByDate[dateKey].length - 1 ? 1 : 0,
                                            borderBottomColor: '#F3F4F6',
                                        }}>
                                            <View style={{
                                                width: 36, height: 36, borderRadius: 18,
                                                backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
                                                marginRight: 12,
                                            }}>
                                                <FeatherIcon name="package" size={16} color="#3B82F6" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                                                    {ds.item?.name || 'Onbekend item'}
                                                </Text>
                                                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                                                    Geteld door {ds.countedBy?.name || 'onbekend'}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>
                                                    {ds.quantity}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                                                    {ds.item?.unit || 'stuks'}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Transactions */}
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 }}>
                    Transacties
                </Text>
                {transactions.length > 0 ? (
                    <View style={{
                        backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2
                    }}>
                        {transactions.slice(0, 10).map((tx: any, idx: number) => {
                            const typeInfo = getTransactionTypeInfo(tx.type);
                            return (
                                <View key={tx.id} style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    paddingHorizontal: 16, paddingVertical: 12,
                                    borderBottomWidth: idx < Math.min(transactions.length, 10) - 1 ? 1 : 0,
                                    borderBottomColor: '#F3F4F6',
                                }}>
                                    <View style={{
                                        width: 36, height: 36, borderRadius: 18,
                                        backgroundColor: `${typeInfo.color}15`, alignItems: 'center', justifyContent: 'center',
                                        marginRight: 12,
                                    }}>
                                        <FeatherIcon name={typeInfo.icon} size={16} color={typeInfo.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                                            {tx.item?.name || 'Item'}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                                            {typeInfo.label}
                                            {tx.performedBy && ` • ${tx.performedBy.name}`}
                                            {tx.createdAt && ` • ${new Date(tx.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: typeInfo.color }}>
                                        {tx.type === 'OUT' ? '-' : '+'}{tx.quantity}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <FeatherIcon name="package" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyTitle}>Geen voorraad data</Text>
                        <Text style={styles.emptySubtitle}>
                            Er zijn nog geen voorraadtellingen of transacties voor dit project
                        </Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <FeatherIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {project.title}
                    </Text>
                    <View style={styles.statusPill}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(project.status) }]} />
                        <Text style={styles.statusPillText}>{getStatusLabel(project.status)}</Text>
                    </View>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.7}
                    >
                        <FeatherIcon
                            name={tab.icon}
                            size={16}
                            color={activeTab === tab.key ? '#1976D2' : '#9CA3AF'}
                        />
                        <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab Content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'info' && renderInfoTab()}
                {activeTab === 'financials' && renderFinancialsTab()}
                {activeTab === 'revenue' && renderRevenueTab()}
                {activeTab === 'inventory' && renderInventoryTab()}
            </View>

            {/* Add Item Modal */}
            <Modal
                visible={showAddItemModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => { setShowAddItemModal(false); setSelectedProduct(null); setProductSearch(''); setPlanQty('1'); }}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => {
                                if (selectedProduct) { setSelectedProduct(null); } else { setShowAddItemModal(false); setProductSearch(''); setPlanQty('1'); }
                            }}>
                                {selectedProduct
                                    ? <FeatherIcon name="arrow-left" size={22} color="#111827" />
                                    : <Text style={styles.modalCancel}>Annuleren</Text>
                                }
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{selectedProduct ? 'Hoeveelheid' : 'Product kiezen'}</Text>
                            {selectedProduct ? (
                                <TouchableOpacity
                                    onPress={() => {
                                        const qty = parseInt(planQty, 10);
                                        if (!qty || qty <= 0) { Alert.alert('Fout', 'Voer een geldige hoeveelheid in'); return; }
                                        planMutation.mutate({ productId: selectedProduct.id, qty });
                                    }}
                                    disabled={planMutation.isPending}
                                >
                                    <Text style={[styles.modalSave, planMutation.isPending && { opacity: 0.4 }]}>
                                        {planMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                                    </Text>
                                </TouchableOpacity>
                            ) : <View style={{ width: 60 }} />}
                        </View>

                        {selectedProduct ? (
                            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
                                <View style={{ backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <FeatherIcon name="package" size={20} color="#1D4ED8" />
                                    <View>
                                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{selectedProduct.name}</Text>
                                        {selectedProduct.unit ? <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{selectedProduct.unit}</Text> : null}
                                    </View>
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Hoeveelheid te plannen</Text>
                                    <TextInput
                                        style={[styles.textInput, { minHeight: undefined, textAlignVertical: 'center', fontSize: 20, fontWeight: '700', paddingVertical: 14 }]}
                                        keyboardType="numeric"
                                        value={planQty}
                                        onChangeText={setPlanQty}
                                        autoFocus
                                        selectTextOnFocus
                                    />
                                </View>
                            </ScrollView>
                        ) : (
                            <>
                                <View style={{ padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
                                        <FeatherIcon name="search" size={16} color="#9CA3AF" />
                                        <TextInput
                                            style={{ flex: 1, fontSize: 15, color: '#111827' }}
                                            placeholder="Zoek product..."
                                            placeholderTextColor="#9CA3AF"
                                            value={productSearch}
                                            onChangeText={setProductSearch}
                                            autoFocus
                                        />
                                        {productSearch ? (
                                            <TouchableOpacity onPress={() => setProductSearch('')}>
                                                <FeatherIcon name="x" size={16} color="#9CA3AF" />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                                <ScrollView keyboardShouldPersistTaps="handled">
                                    {productsLoading ? (
                                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                            <ActivityIndicator size="large" color="#1976D2" />
                                        </View>
                                    ) : null}
                                    {!productsLoading && allProducts
                                        .filter((p: any) => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()))
                                        .map((p: any) => (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 }}
                                                onPress={() => { setSelectedProduct(p); setPlanQty('1'); }}
                                            >
                                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                                    <FeatherIcon name="package" size={16} color="#3B82F6" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{p.name}</Text>
                                                    {p.unit ? <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{p.unit}</Text> : null}
                                                </View>
                                                {allocations.find((a: any) => a.productId === p.id) ? (
                                                    <View style={{ backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>Gepland</Text>
                                                    </View>
                                                ) : null}
                                                <FeatherIcon name="chevron-right" size={16} color="#D1D5DB" />
                                            </TouchableOpacity>
                                        ))
                                    }
                                    {!productsLoading && allProducts.filter((p: any) => !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                            <FeatherIcon name="package" size={32} color="#D1D5DB" />
                                            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>Geen producten gevonden</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            </>
                        )}
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>

            {/* Closeout Modal */}
            <Modal
                visible={showCloseoutModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowCloseoutModal(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowCloseoutModal(false)}>
                                <Text style={styles.modalCancel}>Annuleren</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Evenement afronden</Text>
                            <TouchableOpacity
                                onPress={() => {
                                    Alert.alert(
                                        'Evenement afronden',
                                        'Dit kan niet ongedaan worden. Weet je zeker dat je wilt afronden?',
                                        [
                                            { text: 'Annuleren', style: 'cancel' },
                                            { text: 'Afronden', style: 'destructive', onPress: () => closeoutMutation.mutate() },
                                        ]
                                    );
                                }}
                                disabled={closeoutMutation.isPending}
                            >
                                <Text style={[styles.modalSave, { color: '#DC2626' }, closeoutMutation.isPending && { opacity: 0.4 }]}>
                                    {closeoutMutation.isPending ? 'Bezig...' : 'Afronden'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
                            {/* Warning */}
                            <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                                <FeatherIcon name="alert-triangle" size={18} color="#DC2626" style={{ marginTop: 1 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626', marginBottom: 3 }}>Let op</Text>
                                    <Text style={{ fontSize: 13, color: '#991B1B', lineHeight: 18 }}>
                                        Voer de resterende hoeveelheid in per product. Resterende voorraad wordt teruggeplaatst in het magazijn. Dit kan niet ongedaan worden.
                                    </Text>
                                </View>
                            </View>

                            {/* Item list */}
                            {allocations.filter((a: any) => a.status !== 'PLANNED').map((alloc: any) => {
                                const item = closeoutItems[alloc.id] || { remainingQty: '0', disposition: 'RETURN' as const };
                                return (
                                    <View key={alloc.id} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                                        {/* Product name + loaded qty */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                                <FeatherIcon name="package" size={16} color="#3B82F6" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                                                    {alloc.product?.name || 'Onbekend product'}
                                                </Text>
                                                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                                                    {alloc.loadedQuantity ?? alloc.plannedQuantity} {alloc.product?.unit || 'stuks'} geladen
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Remaining qty input */}
                                        <View style={{ marginBottom: 12 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                                                Resterende hoeveelheid
                                            </Text>
                                            <TextInput
                                                style={{ backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' }}
                                                keyboardType="numeric"
                                                value={item.remainingQty}
                                                onChangeText={(val) =>
                                                    setCloseoutItems((prev) => ({ ...prev, [alloc.id]: { ...item, remainingQty: val } }))
                                                }
                                                selectTextOnFocus
                                            />
                                        </View>

                                        {/* Disposition toggle */}
                                        <View>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                                                Wat te doen met resterende voorraad?
                                            </Text>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <TouchableOpacity
                                                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: item.disposition === 'RETURN' ? '#1976D2' : '#E5E7EB', backgroundColor: item.disposition === 'RETURN' ? '#EFF6FF' : '#fff', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                                                    onPress={() => setCloseoutItems((prev) => ({ ...prev, [alloc.id]: { ...item, disposition: 'RETURN' } }))}
                                                >
                                                    <FeatherIcon name="corner-up-left" size={15} color={item.disposition === 'RETURN' ? '#1976D2' : '#9CA3AF'} />
                                                    <Text style={{ fontSize: 13, fontWeight: '700', color: item.disposition === 'RETURN' ? '#1976D2' : '#9CA3AF' }}>Retour</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: item.disposition === 'WASTE' ? '#DC2626' : '#E5E7EB', backgroundColor: item.disposition === 'WASTE' ? '#FEF2F2' : '#fff', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                                                    onPress={() => setCloseoutItems((prev) => ({ ...prev, [alloc.id]: { ...item, disposition: 'WASTE' } }))}
                                                >
                                                    <FeatherIcon name="trash-2" size={15} color={item.disposition === 'WASTE' ? '#DC2626' : '#9CA3AF'} />
                                                    <Text style={{ fontSize: 13, fontWeight: '700', color: item.disposition === 'WASTE' ? '#DC2626' : '#9CA3AF' }}>Afschrijven</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>

            {/* Revenue Entry Modal */}
            <Modal
                visible={showRevenueForm}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowRevenueForm(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowRevenueForm(false)}>
                                <Text style={styles.modalCancel}>Annuleren</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Omzet toevoegen</Text>
                            <TouchableOpacity
                                onPress={() => addRevenueMutation.mutate()}
                                disabled={addRevenueMutation.isPending || !revenueAmount}
                            >
                                <Text style={[
                                    styles.modalSave,
                                    (!revenueAmount || addRevenueMutation.isPending) && { opacity: 0.4 },
                                ]}>
                                    {addRevenueMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <Text style={styles.modalProjectTitle}>{project.title}</Text>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Bedrag (excl. BTW) *</Text>
                                <View style={styles.amountInputWrapper}>
                                    <Text style={styles.currencySymbol}>€</Text>
                                    <TextInput
                                        style={styles.amountInput}
                                        placeholder="0,00"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="decimal-pad"
                                        value={revenueAmount}
                                        onChangeText={setRevenueAmount}
                                        autoFocus
                                    />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>BTW-percentage</Text>
                                <View style={styles.vatOptions}>
                                    {['0', '9', '21'].map((rate) => (
                                        <TouchableOpacity
                                            key={rate}
                                            style={[styles.vatOption, revenueVatRate === rate && styles.vatOptionActive]}
                                            onPress={() => setRevenueVatRate(rate)}
                                        >
                                            <Text style={[styles.vatOptionText, revenueVatRate === rate && styles.vatOptionTextActive]}>
                                                {rate}%
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Beschrijving (optioneel)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Bijv. dag 1 verkoop, catering, etc."
                                    placeholderTextColor="#9CA3AF"
                                    value={revenueDescription}
                                    onChangeText={setRevenueDescription}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            {revenueAmount ? (
                                <View style={styles.previewCard}>
                                    <Text style={styles.previewTitle}>Samenvatting</Text>
                                    <View style={styles.previewRow}>
                                        <Text style={styles.previewLabel}>Excl. BTW</Text>
                                        <Text style={styles.previewValue}>
                                            €{parseFloat(revenueAmount.replace(',', '.') || '0').toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={styles.previewRow}>
                                        <Text style={styles.previewLabel}>BTW ({revenueVatRate}%)</Text>
                                        <Text style={styles.previewValue}>
                                            €{(parseFloat(revenueAmount.replace(',', '.') || '0') * parseFloat(revenueVatRate) / 100).toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={[styles.previewRow, styles.previewTotal]}>
                                        <Text style={styles.previewTotalLabel}>Totaal incl. BTW</Text>
                                        <Text style={styles.previewTotalValue}>
                                            €{(parseFloat(revenueAmount.replace(',', '.') || '0') * (1 + parseFloat(revenueVatRate) / 100)).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            ) : null}
                        </ScrollView>
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

// ─── Reusable Info Row ───
function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
    return (
        <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
            <View style={styles.infoIcon}>
                <FeatherIcon name={icon} size={16} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );
}

// ─── Styles ───
const styles = StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { fontSize: 16, color: '#6B7280' },

    /** Header */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backButton: {
        width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    },
    headerCenter: {
        flex: 1, alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17, fontWeight: '600', color: '#111827',
    },
    statusPill: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 10, marginTop: 4,
    },
    statusDot: {
        width: 6, height: 6, borderRadius: 3, marginRight: 6,
    },
    statusPillText: {
        fontSize: 12, fontWeight: '500', color: '#6B7280',
    },

    /** Tab Bar */
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingHorizontal: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: '#1976D2',
    },
    tabText: {
        fontSize: 14, fontWeight: '500', color: '#9CA3AF',
    },
    tabTextActive: {
        color: '#1976D2', fontWeight: '600',
    },

    /** Tab Content */
    tabContent: {
        flex: 1, padding: 16,
    },

    /** Info Card */
    infoCard: {
        backgroundColor: '#fff', borderRadius: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
        overflow: 'hidden',
    },
    infoRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    infoIcon: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 12, fontWeight: '500', color: '#9CA3AF', marginBottom: 2 },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
    infoSubValue: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
    cardTitle: {
        fontSize: 14, fontWeight: '600', color: '#6B7280',
        paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
    },
    shiftleaderRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    shiftleaderAvatar: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    shiftleaderInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
    shiftleaderName: { fontSize: 15, fontWeight: '500', color: '#111827' },

    /** Financials */
    financialGrid: {
        flexDirection: 'row', gap: 12, marginBottom: 12,
    },
    financialCard: {
        flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 18,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    financialLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 8 },
    financialAmount: { fontSize: 22, fontWeight: '700', marginTop: 2 },
    financialAmountLarge: { fontSize: 28, fontWeight: '700' },
    profitCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },

    /** Revenue */
    revenueCard: {
        backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    },
    revenueMain: { flexDirection: 'row', alignItems: 'center' },
    revenueIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    revenueInfo: { flex: 1 },
    revenueAmount: { fontSize: 17, fontWeight: '700', color: '#10B981' },
    revenueDesc: { fontSize: 14, color: '#374151', marginTop: 2 },
    revenueDate: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
    deleteRevBtn: { padding: 8 },

    emptyState: {
        alignItems: 'center', paddingVertical: 48,
    },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 14 },
    emptySubtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },

    fab: {
        position: 'absolute', right: 20, bottom: 24,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
    },

    /** Modal */
    modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    },
    modalCancel: { fontSize: 16, color: '#6B7280' },
    modalTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
    modalSave: { fontSize: 16, fontWeight: '600', color: '#10B981' },
    modalContent: { flex: 1, padding: 16 },
    modalProjectTitle: { fontSize: 14, fontWeight: '500', color: '#6B7280', marginBottom: 20 },

    formGroup: { marginBottom: 20 },
    formLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    amountInputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 12,
        borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 16,
    },
    currencySymbol: { fontSize: 24, fontWeight: '700', color: '#10B981', marginRight: 8 },
    amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: '#111827', paddingVertical: 16 },

    vatOptions: { flexDirection: 'row', gap: 10 },
    vatOption: {
        flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    },
    vatOptionActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
    vatOptionText: { fontSize: 16, fontWeight: '600', color: '#374151' },
    vatOptionTextActive: { color: '#fff' },

    textInput: {
        backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
        paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
        minHeight: 80, textAlignVertical: 'top',
    },

    previewCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16,
        marginTop: 4, borderWidth: 1, borderColor: '#E5E7EB',
    },
    previewTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    previewLabel: { fontSize: 14, color: '#6B7280' },
    previewValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
    previewTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 4, paddingTop: 10 },
    previewTotalLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
    previewTotalValue: { fontSize: 15, fontWeight: '700', color: '#10B981' },
});

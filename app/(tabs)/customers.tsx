import React from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
} from 'react-native';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { directApi } from '../../lib/directApi';
import { useMenu } from '../../contexts/MenuContext';

export default function CustomersScreen() {
    const { openMenu } = useMenu();
    const router = useRouter();
    const { data, isLoading, refetch, error } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => {
            try {
                console.log('Fetching customers...');
                const result = await directApi.customers.getAll();
                console.log('Customers result:', result);
                // API returns {customers: [...], total: number}
                return result;
            } catch (err) {
                console.error('Error fetching customers:', err);
                throw err;
            }
        },
    });

    // Extract customers array from response
    const customers = (data as any)?.customers || [];

    console.log('Customers data:', data);
    console.log('Customers array:', customers);
    console.log('Is loading:', isLoading);
    console.log('Error:', error);

    // Ensure customers is always an array
    const customersList = Array.isArray(customers) ? customers : [];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={openMenu}>
                            <FeatherIcon name="menu" size={22} color="#6B7280" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Klanten</Text>
                    </View>
                    <Text style={styles.subtitle}>
                        {customersList.length} {customersList.length === 1 ? 'klant' : 'klanten'}
                    </Text>
                </View>

                {/* Error State */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>
                            Error: {error instanceof Error ? error.message : 'Failed to load customers'}
                        </Text>
                        <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
                            <Text style={styles.retryText}>Opnieuw proberen</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Customers List */}
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
                    }>
                    {customersList.map((customer: any) => (
                        <TouchableOpacity
                            key={customer.id}
                            style={styles.customerCard}
                            onPress={() => router.push(`/customer/${customer.id}` as any)}>
                            <View style={styles.customerAvatar}>
                                <Text style={styles.customerInitials}>
                                    {customer.name?.charAt(0)?.toUpperCase() || 'K'}
                                </Text>
                            </View>

                            <View style={styles.customerInfo}>
                                <Text style={styles.customerName}>{customer.name}</Text>

                                {customer.email && (
                                    <View style={styles.customerMeta}>
                                        <FeatherIcon name="mail" size={12} color="#9CA3AF" />
                                        <Text style={styles.customerMetaText}>{customer.email}</Text>
                                    </View>
                                )}

                                {customer.phone && (
                                    <View style={styles.customerMeta}>
                                        <FeatherIcon name="phone" size={12} color="#9CA3AF" />
                                        <Text style={styles.customerMetaText}>{customer.phone}</Text>
                                    </View>
                                )}
                            </View>

                            <FeatherIcon name="chevron-right" size={20} color="#D1D5DB" />
                        </TouchableOpacity>
                    ))}

                    {customersList.length === 0 && !isLoading && !error && (
                        <View style={styles.emptyState}>
                            <FeatherIcon name="users" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>Geen klanten</Text>
                            <Text style={styles.emptyText}>
                                Er zijn nog geen klanten aangemaakt
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
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
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#6B7280',
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: 16,
    },
    /** Customer Card */
    customerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    customerAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    customerInitials: {
        fontSize: 18,
        fontWeight: '700',
        color: '#3B82F6',
    },
    customerInfo: {
        flex: 1,
    },
    customerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    customerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    customerMetaText: {
        fontSize: 13,
        fontWeight: '400',
        color: '#6B7280',
    },
    /** Empty State */
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
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
        fontWeight: '400',
        color: '#9CA3AF',
        textAlign: 'center',
    },
    /** Error State */
    errorContainer: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        margin: 16,
        borderRadius: 12,
    },
    errorText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#991B1B',
        marginBottom: 12,
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#DC2626',
        borderRadius: 8,
    },
    retryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});

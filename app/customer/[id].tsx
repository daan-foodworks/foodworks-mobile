import React from 'react';
import {
    StyleSheet, SafeAreaView, View, Text, TouchableOpacity,
    ScrollView, RefreshControl, Linking, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const TYPE_LABEL: Record<string, string> = {
    INDIVIDUAL: 'Particulier',
    COMPANY: 'Bedrijf',
};

const PROJECT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT:     { label: 'Concept',    color: '#6B7280', bg: '#F3F4F6' },
    PLANNED:   { label: 'Gepland',    color: '#1D4ED8', bg: '#DBEAFE' },
    ACTIVE:    { label: 'Actief',     color: '#B45309', bg: '#FEF3C7' },
    COMPLETED: { label: 'Afgerond',   color: '#065F46', bg: '#D1FAE5' },
    CANCELLED: { label: 'Geannuleerd',color: '#B91C1C', bg: '#FEE2E2' },
};

export default function CustomerDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const { data: customer, isLoading, error, refetch } = useQuery({
        queryKey: ['customer', id],
        queryFn: () => directApi.customers.getById(id),
        enabled: !!id,
    });

    const { data: projectsData } = useQuery({
        queryKey: ['projects-by-customer', id],
        queryFn: () => directApi.projects.getByCustomer(id),
        enabled: !!id,
    });

    const recentProjects = Array.isArray(projectsData)
        ? (projectsData as any[]).slice(0, 5)
        : ((projectsData as any)?.projects || []).slice(0, 5);

    const fullAddress = customer
        ? [
            customer.street && customer.houseNumber
                ? `${(customer as any).street} ${(customer as any).houseNumber}`
                : (customer as any).street,
            (customer as any).postalCode,
            (customer as any).city,
          ].filter(Boolean).join(', ')
        : null;

    function openPhone(phone: string) {
        Linking.openURL(`tel:${phone}`);
    }

    function openEmail(email: string) {
        Linking.openURL(`mailto:${email}`);
    }

    function openMaps(address: string) {
        Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`);
    }

    if (isLoading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !customer) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <FeatherIcon name="arrow-left" size={22} color="#111827" />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <FeatherIcon name="alert-circle" size={40} color="#DC2626" />
                    <Text style={styles.errorText}>Klant niet gevonden</Text>
                    <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
                        <Text style={styles.retryText}>Opnieuw proberen</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const c = customer as any;
    const typeConf = TYPE_LABEL[c.type] ?? c.type;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <FeatherIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Klant</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
            >
                {/* Identity card */}
                <View style={styles.identityCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarInitial}>
                            {c.name?.charAt(0)?.toUpperCase() || 'K'}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.customerName}>{c.name}</Text>
                        {c.companyName && c.companyName !== c.name && (
                            <Text style={styles.companyName}>{c.companyName}</Text>
                        )}
                        <View style={[styles.typeBadge, c.type === 'COMPANY' ? styles.typeBadgeCompany : styles.typeBadgeIndividual]}>
                            <Text style={[styles.typeBadgeText, c.type === 'COMPANY' ? styles.typeBadgeTextCompany : styles.typeBadgeTextIndividual]}>
                                {typeConf}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Contact */}
                {(c.phone || c.alternativePhone || c.email) && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Contact</Text>

                        {c.phone && (
                            <TouchableOpacity style={styles.contactRow} onPress={() => openPhone(c.phone)}>
                                <View style={styles.contactIconWrap}>
                                    <FeatherIcon name="phone" size={16} color="#3B82F6" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.contactLabel}>Telefoon</Text>
                                    <Text style={styles.contactValue}>{c.phone}</Text>
                                </View>
                                <FeatherIcon name="chevron-right" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}

                        {c.alternativePhone && (
                            <TouchableOpacity style={styles.contactRow} onPress={() => openPhone(c.alternativePhone)}>
                                <View style={styles.contactIconWrap}>
                                    <FeatherIcon name="phone" size={16} color="#6B7280" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.contactLabel}>Alternatief nr.</Text>
                                    <Text style={styles.contactValue}>{c.alternativePhone}</Text>
                                </View>
                                <FeatherIcon name="chevron-right" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}

                        {c.email && (
                            <TouchableOpacity style={styles.contactRow} onPress={() => openEmail(c.email)}>
                                <View style={styles.contactIconWrap}>
                                    <FeatherIcon name="mail" size={16} color="#3B82F6" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.contactLabel}>E-mail</Text>
                                    <Text style={styles.contactValue}>{c.email}</Text>
                                </View>
                                <FeatherIcon name="chevron-right" size={16} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Address */}
                {fullAddress && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Adres</Text>
                        <View style={styles.addressRow}>
                            <View style={styles.contactIconWrap}>
                                <FeatherIcon name="map-pin" size={16} color="#3B82F6" />
                            </View>
                            <View style={{ flex: 1 }}>
                                {c.street && (
                                    <Text style={styles.contactValue}>
                                        {c.street}{c.houseNumber ? ` ${c.houseNumber}` : ''}
                                    </Text>
                                )}
                                {(c.postalCode || c.city) && (
                                    <Text style={styles.contactValue}>
                                        {[c.postalCode, c.city].filter(Boolean).join('  ')}
                                    </Text>
                                )}
                                {c.country && c.country !== 'Nederland' && (
                                    <Text style={styles.contactLabel}>{c.country}</Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.mapsBtn}
                                onPress={() => openMaps(fullAddress)}
                            >
                                <FeatherIcon name="navigation" size={14} color="#fff" />
                                <Text style={styles.mapsBtnText}>Navigeer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Company info */}
                {c.type === 'COMPANY' && (c.kvkNumber || c.vatNumber) && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Bedrijfsgegevens</Text>
                        {c.kvkNumber && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>KVK</Text>
                                <Text style={styles.infoValue}>{c.kvkNumber}</Text>
                            </View>
                        )}
                        {c.vatNumber && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>BTW</Text>
                                <Text style={styles.infoValue}>{c.vatNumber}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Notes */}
                {(c.specialRequests || c.internalNotes) && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Notities</Text>
                        {c.specialRequests && (
                            <View style={styles.notesBlock}>
                                <Text style={styles.notesLabel}>Bijzondere wensen</Text>
                                <Text style={styles.notesText}>{c.specialRequests}</Text>
                            </View>
                        )}
                        {c.internalNotes && (
                            <View style={styles.notesBlock}>
                                <Text style={styles.notesLabel}>Interne notities</Text>
                                <Text style={styles.notesText}>{c.internalNotes}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Recent projects */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Recente projecten</Text>
                    {recentProjects.length === 0 ? (
                        <Text style={styles.emptyText}>Geen projecten gevonden</Text>
                    ) : (
                        recentProjects.map((project: any) => {
                            const statusConf = PROJECT_STATUS_CONFIG[project.status] ?? {
                                label: project.status, color: '#6B7280', bg: '#F3F4F6',
                            };
                            return (
                                <TouchableOpacity
                                    key={project.id}
                                    style={styles.projectRow}
                                    onPress={() => router.push(`/project/${project.id}` as any)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.projectName} numberOfLines={1}>
                                            {project.name}
                                        </Text>
                                        {project.eventStartDate && (
                                            <Text style={styles.projectDate}>
                                                {format(new Date(project.eventStartDate), 'd MMM yyyy', { locale: nl })}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
                                        <Text style={[styles.statusText, { color: statusConf.color }]}>
                                            {statusConf.label}
                                        </Text>
                                    </View>
                                    <FeatherIcon name="chevron-right" size={16} color="#D1D5DB" style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    backBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#111827',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
        marginTop: 12,
        marginBottom: 16,
    },
    retryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
    },
    retryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    identityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
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
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 22,
        fontWeight: '700',
        color: '#3B82F6',
    },
    customerName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    companyName: {
        fontSize: 14,
        fontWeight: '400',
        color: '#6B7280',
        marginBottom: 6,
    },
    typeBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 99,
        marginTop: 4,
    },
    typeBadgeIndividual: {
        backgroundColor: '#F3F4F6',
    },
    typeBadgeCompany: {
        backgroundColor: '#EFF6FF',
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    typeBadgeTextIndividual: {
        color: '#6B7280',
    },
    typeBadgeTextCompany: {
        color: '#1D4ED8',
    },
    card: {
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
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    contactIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactLabel: {
        fontSize: 12,
        fontWeight: '400',
        color: '#9CA3AF',
    },
    contactValue: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
    },
    mapsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#3B82F6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    mapsBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '400',
        color: '#6B7280',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    notesBlock: {
        marginBottom: 10,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#9CA3AF',
        marginBottom: 4,
    },
    notesText: {
        fontSize: 14,
        fontWeight: '400',
        color: '#374151',
        lineHeight: 20,
    },
    projectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    projectName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 2,
    },
    projectDate: {
        fontSize: 13,
        fontWeight: '400',
        color: '#6B7280',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 99,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingVertical: 8,
    },
});

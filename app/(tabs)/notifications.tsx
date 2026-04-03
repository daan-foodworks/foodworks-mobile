import React, { useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RBSheet from 'react-native-raw-bottom-sheet';
import { directApi } from '../../lib/directApi';
import { Notification } from '@foodworks/shared-types';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useMenu } from '../../contexts/MenuContext';

export default function NotificationsScreen() {
    const queryClient = useQueryClient();
    const { openMenu } = useMenu();

    const deleteSheet = React.useRef<any>();
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const { data: notifications, isLoading, refetch } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => directApi.notifications.getAll(),
    });

    const markAsReadMutation = useMutation({
        mutationFn: (id: string) => directApi.notifications.markAsRead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: () => directApi.notifications.markAllAsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => directApi.notifications.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });

    const handleMarkAsRead = (notification: any) => {
        if (!notification.isRead) {
            markAsReadMutation.mutate(notification.id);
        }
    };

    const handleDelete = (id: string) => {
        setPendingDeleteId(id);
        deleteSheet.current?.open();
    };

    const notificationsList = Array.isArray(notifications) ? notifications : [];
    const unreadCount = notificationsList.filter((n: any) => !n.isRead).length;

    const renderNotification = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.card, !item.isRead && styles.unreadCard]}
            onPress={() => handleMarkAsRead(item)}
            activeOpacity={0.7}
        >
            <View style={styles.notificationHeader}>
                <View style={styles.notificationContent}>
                    <View style={styles.titleRow}>
                        {!item.isRead && <View style={styles.unreadDot} />}
                        <Text style={[styles.title, !item.isRead && styles.unreadText]}>
                            {item.title}
                        </Text>
                    </View>
                    <Text style={styles.message}>{item.message}</Text>
                    <Text style={styles.time}>
                        {format(new Date(item.createdAt), 'd MMM yyyy HH:mm', { locale: nl })}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <FeatherIcon name="trash-2" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.pageHeader}>
                <TouchableOpacity onPress={openMenu}>
                    <FeatherIcon name="menu" size={22} color="#6B7280" />
                </TouchableOpacity>
                <Text style={styles.pageTitle}>Notificaties</Text>
            </View>
            {unreadCount > 0 && (
                <View style={styles.header}>
                    <Text style={styles.headerText}>
                        {unreadCount} ongelezen notificatie{unreadCount !== 1 ? 's' : ''}
                    </Text>
                </View>
            )}

            <FlatList
                data={notificationsList}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refetch} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <FeatherIcon name="bell-off" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>Geen notificaties</Text>
                    </View>
                }
            />

            {unreadCount > 0 && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => markAllAsReadMutation.mutate()}
                    activeOpacity={0.8}
                >
                    <FeatherIcon name="check-circle" size={20} color="#fff" />
                    <Text style={styles.fabText}>Markeer alles als gelezen</Text>
                </TouchableOpacity>
            )}

            <RBSheet
                ref={deleteSheet}
                customStyles={{ container: { borderTopLeftRadius: 14, borderTopRightRadius: 14 } }}
                height={280}
                openDuration={250}>
                <View style={{ borderBottomWidth: 1, borderColor: '#efefef', padding: 16 }}>
                    <Text style={{ fontSize: 20, fontWeight: '600', textAlign: 'center' }}>Verwijderen</Text>
                </View>
                <View style={{ padding: 24 }}>
                    <Text style={{ fontSize: 16, lineHeight: 24, color: '#0e0e0e', marginBottom: 24, textAlign: 'center' }}>
                        Weet je zeker dat je dit wilt verwijderen?
                    </Text>
                    <TouchableOpacity onPress={() => { deleteSheet.current?.close(); if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId); }}>
                        <View style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#ff3c2f', marginBottom: 12 }}>
                            <Text style={{ fontSize: 17, fontWeight: '600', color: '#fff' }}>Verwijderen</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSheet.current?.close()}>
                        <View style={{ alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#dddce0' }}>
                            <Text style={{ fontSize: 17, fontWeight: '600', color: '#000' }}>Annuleren</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </RBSheet>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    pageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: '#fff',
    },
    pageTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    headerText: {
        fontSize: 14,
        color: '#6B7280',
    },
    list: {
        padding: 16,
    },
    card: {
        marginBottom: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    unreadCard: {
        backgroundColor: '#EFF6FF',
        borderLeftWidth: 3,
        borderLeftColor: '#3B82F6',
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    notificationContent: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3B82F6',
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
    },
    unreadText: {
        fontWeight: '700',
    },
    message: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    time: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 8,
    },
    deleteBtn: {
        padding: 8,
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#9CA3AF',
        marginTop: 12,
    },
    fab: {
        position: 'absolute',
        right: 16,
        bottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 28,
        gap: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    fabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});

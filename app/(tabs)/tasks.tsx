import React, { useState } from 'react';
import {
    StyleSheet,
    SafeAreaView,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { directApi } from '../../lib/directApi';
import { useMenu } from '../../contexts/MenuContext';
import { useAuthStore } from '../../stores/authStore';

type ModalView = 'form' | 'project' | 'assignee';

export default function TasksScreen() {
    const queryClient = useQueryClient();
    const { openMenu } = useMenu();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDone, setShowDone] = useState(false);
    const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
    const [modalView, setModalView] = useState<ModalView>('form');
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newPriority, setNewPriority] = useState('MEDIUM');
    const [newProjectId, setNewProjectId] = useState<string | null>(null);
    const [newAssigneeId, setNewAssigneeId] = useState<string | null>(null);

    const { data: rawTasks, isLoading, refetch } = useQuery({
        queryKey: ['tasks', user?.id],
        queryFn: () => directApi.tasks.getAll(user?.id ? { assignedToId: user.id } : undefined),
        enabled: !!user,
    });

    const tasks = (rawTasks || []).filter((t: any) => {
        if (!showDone && t.status === 'DONE') return false;
        if (priorityFilter && t.priority !== priorityFilter) return false;
        return true;
    });

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: () => directApi.projects.getAll(),
    });

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => directApi.users.getAll(),
    });

    const toggleTaskMutation = useMutation({
        mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
            const newStatus = currentStatus === 'DONE' ? 'TODO' : 'DONE';
            await directApi.tasks.update({ id, status: newStatus });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    const createTaskMutation = useMutation({
        mutationFn: async () => {
            if (!newTitle.trim()) throw new Error('Titel is verplicht');
            return await directApi.tasks.create({
                title: newTitle.trim(),
                description: newDescription.trim() || undefined,
                priority: newPriority,
                projectId: newProjectId || undefined,
                assignedToId: newAssigneeId || undefined,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            resetForm();
        },
        onError: (error: Error) => {
            Alert.alert('Fout', error.message);
        },
    });

    const resetForm = () => {
        setShowCreateModal(false);
        setModalView('form');
        setNewTitle('');
        setNewDescription('');
        setNewPriority('MEDIUM');
        setNewProjectId(null);
        setNewAssigneeId(null);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH': return '#EF4444';
            case 'MEDIUM': return '#F59E0B';
            case 'LOW': return '#10B981';
            default: return '#6B7280';
        }
    };

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'HIGH': return 'Hoog';
            case 'MEDIUM': return 'Gemiddeld';
            case 'LOW': return 'Laag';
            default: return priority;
        }
    };

    const usersList = Array.isArray(users) ? users : [];
    const selectedProject = projects?.find((p: any) => p.id === newProjectId);
    const selectedAssignee = usersList.find((u: any) => u.id === newAssigneeId);

    // Render the correct view inside the modal
    const renderModalContent = () => {
        if (modalView === 'project') {
            return (
                <>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setModalView('form')}>
                            <FeatherIcon name="arrow-left" size={22} color="#111827" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Kies project</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <ScrollView style={styles.modalContent}>
                        {/* Clear selection */}
                        <TouchableOpacity
                            style={styles.pickerItem}
                            onPress={() => { setNewProjectId(null); setModalView('form'); }}
                        >
                            <FeatherIcon name="x-circle" size={18} color="#9CA3AF" />
                            <Text style={[styles.pickerItemText, { color: '#9CA3AF' }]}>Geen project</Text>
                        </TouchableOpacity>
                        {projects?.map((p: any) => (
                            <TouchableOpacity
                                key={p.id}
                                style={styles.pickerItem}
                                onPress={() => { setNewProjectId(p.id); setModalView('form'); }}
                            >
                                <FeatherIcon name="folder" size={18} color={newProjectId === p.id ? '#1976D2' : '#6B7280'} />
                                <Text style={[styles.pickerItemText, newProjectId === p.id && { color: '#1976D2', fontWeight: '600' }]}>
                                    {p.title}
                                </Text>
                                {newProjectId === p.id && <FeatherIcon name="check" size={18} color="#1976D2" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            );
        }

        if (modalView === 'assignee') {
            return (
                <>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setModalView('form')}>
                            <FeatherIcon name="arrow-left" size={22} color="#111827" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Toewijzen aan</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <ScrollView style={styles.modalContent}>
                        {/* Clear selection */}
                        <TouchableOpacity
                            style={styles.pickerItem}
                            onPress={() => { setNewAssigneeId(null); setModalView('form'); }}
                        >
                            <FeatherIcon name="x-circle" size={18} color="#9CA3AF" />
                            <Text style={[styles.pickerItemText, { color: '#9CA3AF' }]}>Niemand</Text>
                        </TouchableOpacity>
                        {usersList.map((u: any) => (
                            <TouchableOpacity
                                key={u.id}
                                style={styles.pickerItem}
                                onPress={() => { setNewAssigneeId(u.id); setModalView('form'); }}
                            >
                                <View style={styles.userAvatar}>
                                    <Text style={styles.userInitial}>{u.name?.charAt(0) || '?'}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.pickerItemText, newAssigneeId === u.id && { color: '#1976D2', fontWeight: '600' }]}>
                                        {u.name}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{u.role}</Text>
                                </View>
                                {newAssigneeId === u.id && <FeatherIcon name="check" size={18} color="#1976D2" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </>
            );
        }

        // Default: form view
        return (
            <>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={resetForm}>
                        <Text style={styles.modalCancel}>Annuleren</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Nieuwe taak</Text>
                    <TouchableOpacity
                        onPress={() => createTaskMutation.mutate()}
                        disabled={!newTitle.trim() || createTaskMutation.isPending}
                    >
                        <Text style={[
                            styles.modalSave,
                            (!newTitle.trim() || createTaskMutation.isPending) && { opacity: 0.4 },
                        ]}>
                            {createTaskMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                        </Text>
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Titel *</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Wat moet er gedaan worden?"
                            placeholderTextColor="#9CA3AF"
                            value={newTitle}
                            onChangeText={setNewTitle}
                            autoFocus
                        />
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Beschrijving</Text>
                        <TextInput
                            style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
                            placeholder="Extra details..."
                            placeholderTextColor="#9CA3AF"
                            value={newDescription}
                            onChangeText={setNewDescription}
                            multiline
                            numberOfLines={3}
                        />
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Prioriteit</Text>
                        <View style={styles.priorityOptions}>
                            {[
                                { key: 'LOW', label: 'Laag', color: '#10B981' },
                                { key: 'MEDIUM', label: 'Gemiddeld', color: '#F59E0B' },
                                { key: 'HIGH', label: 'Hoog', color: '#EF4444' },
                            ].map((p) => (
                                <TouchableOpacity
                                    key={p.key}
                                    style={[
                                        styles.priorityOption,
                                        newPriority === p.key && { backgroundColor: p.color, borderColor: p.color },
                                    ]}
                                    onPress={() => setNewPriority(p.key)}
                                >
                                    <Text style={[
                                        styles.priorityOptionText,
                                        newPriority === p.key && { color: '#fff' },
                                    ]}>{p.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Project</Text>
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setModalView('project')}
                        >
                            <FeatherIcon name="folder" size={16} color="#6B7280" />
                            <Text style={[styles.pickerText, selectedProject && { color: '#111827' }]}>
                                {selectedProject ? selectedProject.title : 'Selecteer project...'}
                            </Text>
                            <FeatherIcon name="chevron-right" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.formLabel}>Toewijzen aan</Text>
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setModalView('assignee')}
                        >
                            <FeatherIcon name="user" size={16} color="#6B7280" />
                            <Text style={[styles.pickerText, selectedAssignee && { color: '#111827' }]}>
                                {selectedAssignee ? selectedAssignee.name : 'Selecteer persoon...'}
                            </Text>
                            <FeatherIcon name="chevron-right" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={openMenu}>
                            <FeatherIcon name="menu" size={22} color="#6B7280" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Taken</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={styles.subtitle}>
                            {tasks.length} {tasks.length === 1 ? 'taak' : 'taken'}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowDone((v) => !v)}
                            style={[styles.doneToggle, showDone && styles.doneToggleActive]}
                        >
                            <FeatherIcon name="check-circle" size={14} color={showDone ? '#fff' : '#6B7280'} />
                            <Text style={[styles.doneToggleText, showDone && { color: '#fff' }]}>
                                Afgevinkt
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Priority filter chips */}
                <View style={styles.filterRow}>
                    {[
                        { key: null, label: 'Alle' },
                        { key: 'HIGH', label: 'Hoog', color: '#EF4444' },
                        { key: 'MEDIUM', label: 'Gemiddeld', color: '#F59E0B' },
                        { key: 'LOW', label: 'Laag', color: '#10B981' },
                    ].map((chip) => (
                        <TouchableOpacity
                            key={chip.key ?? 'alle'}
                            style={[
                                styles.filterChip,
                                priorityFilter === chip.key && {
                                    backgroundColor: chip.color || '#1976D2',
                                    borderColor: chip.color || '#1976D2',
                                },
                            ]}
                            onPress={() => setPriorityFilter(chip.key)}
                            activeOpacity={0.7}
                        >
                            {chip.color && (
                                <View style={[styles.filterDot, { backgroundColor: chip.color }]} />
                            )}
                            <Text style={[
                                styles.filterChipText,
                                priorityFilter === chip.key && { color: '#fff' },
                            ]}>{chip.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
                >
                    {tasks.map((task: any) => (
                        <TouchableOpacity
                            key={task.id}
                            style={[styles.taskCard, task.status === 'DONE' && styles.taskCardCompleted]}
                            onPress={() => router.push(`/task/${task.id}`)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(task.priority) }]} />
                            <View style={styles.taskContent}>
                                <TouchableOpacity
                                    style={[styles.checkbox, task.status === 'DONE' && styles.checkboxChecked]}
                                    onPress={() => toggleTaskMutation.mutate({ id: task.id, currentStatus: task.status })}
                                >
                                    {task.status === 'DONE' && <FeatherIcon name="check" size={16} color="#fff" />}
                                </TouchableOpacity>
                                <View style={styles.taskInfo}>
                                    <Text style={[styles.taskTitle, task.status === 'DONE' && styles.taskTitleCompleted]}>
                                        {task.title}
                                    </Text>
                                    {task.description && (
                                        <Text style={styles.taskDescription} numberOfLines={2}>{task.description}</Text>
                                    )}
                                    <View style={styles.taskMeta}>
                                        {task.project && (
                                            <View style={styles.taskMetaItem}>
                                                <FeatherIcon name="folder" size={12} color="#9CA3AF" />
                                                <Text style={styles.taskMetaText} numberOfLines={1}>{task.project.title}</Text>
                                            </View>
                                        )}
                                        <View style={styles.taskMetaItem}>
                                            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                                            <Text style={styles.taskMetaText}>{getPriorityLabel(task.priority)}</Text>
                                        </View>
                                        {task.deadline && (
                                            <View style={styles.taskMetaItem}>
                                                <FeatherIcon name="calendar" size={12} color="#9CA3AF" />
                                                <Text style={styles.taskMetaText}>
                                                    {new Date(task.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {tasks.length === 0 && !isLoading && (
                        <View style={styles.emptyState}>
                            <FeatherIcon name="check-square" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyTitle}>
                                {showDone ? 'Geen taken' : 'Geen openstaande taken'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {showDone ? 'Er zijn nog geen taken aan jou toegewezen' : 'Alle taken zijn afgevinkt!'}
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
                    <FeatherIcon name="plus" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Single Modal with view switching */}
            <Modal
                visible={showCreateModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={resetForm}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <SafeAreaView style={styles.modalContainer}>
                        {renderModalContent()}
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    title: { fontSize: 27, fontWeight: '700', color: '#111827', marginBottom: 4 },
    subtitle: { fontSize: 15, fontWeight: '500', color: '#6B7280' },
    list: { flex: 1 },
    listContent: { padding: 16, paddingBottom: 80 },

    taskCard: {
        backgroundColor: '#fff', borderRadius: 12, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
        elevation: 1, overflow: 'hidden', position: 'relative',
    },
    taskCardCompleted: { opacity: 0.6 },
    priorityBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
    taskContent: { flexDirection: 'row', padding: 16, paddingLeft: 20, alignItems: 'flex-start' },
    checkbox: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB',
        alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
    },
    checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
    taskInfo: { flex: 1 },
    taskTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
    taskTitleCompleted: { textDecorationLine: 'line-through', color: '#9CA3AF' },
    taskDescription: { fontSize: 14, color: '#6B7280', marginBottom: 8, lineHeight: 20 },
    taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    taskMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    taskMetaText: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
    priorityDot: { width: 6, height: 6, borderRadius: 3 },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 4 },
    emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    doneToggle: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    },
    doneToggleActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
    doneToggleText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

    fab: {
        position: 'absolute', right: 20, bottom: 24,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center',
        shadowColor: '#1976D2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
    },

    modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
    modalHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    },
    modalCancel: { fontSize: 16, color: '#6B7280' },
    modalTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
    modalSave: { fontSize: 16, fontWeight: '600', color: '#1976D2' },
    modalContent: { flex: 1, padding: 16 },

    formGroup: { marginBottom: 20 },
    formLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    textInput: {
        backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
        paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
    },
    priorityOptions: { flexDirection: 'row', gap: 10 },
    priorityOption: {
        flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    },
    priorityOptionText: { fontSize: 14, fontWeight: '600', color: '#374151' },

    pickerButton: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
        paddingHorizontal: 16, paddingVertical: 14,
    },
    pickerText: { flex: 1, fontSize: 15, color: '#9CA3AF' },

    pickerItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    },
    pickerItemText: { flex: 1, fontSize: 15, color: '#111827' },

    userAvatar: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: '#1976D2', alignItems: 'center', justifyContent: 'center',
    },
    userInitial: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

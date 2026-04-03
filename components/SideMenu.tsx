import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Modal,
    Pressable,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.78;

interface SideMenuProps {
    visible: boolean;
    onClose: () => void;
}

const menuItems = [
    { icon: 'grid', label: 'Dashboard', route: '/(tabs)' },
    { icon: 'calendar', label: 'Agenda', route: '/(tabs)/agenda' },
    { icon: 'zap', label: 'Operationeel', route: '/(tabs)/operationeel' },
    { icon: 'folder', label: 'Projecten', route: '/(tabs)/projects' },
    { icon: 'check-square', label: 'Taken', route: '/(tabs)/tasks' },
    { icon: 'truck', label: 'Ritten', route: '/(tabs)/ritten' },
    { icon: 'users', label: 'Klanten', route: '/(tabs)/customers' },
    { icon: 'package', label: 'Voorraad', route: '/(tabs)/voorraad' },
    { icon: 'truck', label: 'Leveringen', route: '/(tabs)/leveringen' },
    { icon: 'bell', label: 'Notificaties', route: '/(tabs)/notifications' },
];

export const SideMenu: React.FC<SideMenuProps> = ({ visible, onClose }) => {
    const router = useRouter();
    const { user, clearAuth } = useAuthStore();
    const translateX = useSharedValue(-MENU_WIDTH);
    const overlayOpacity = useSharedValue(0);

    React.useEffect(() => {
        if (visible) {
            translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
            overlayOpacity.value = withTiming(1, { duration: 250 });
        } else {
            translateX.value = withTiming(-MENU_WIDTH, { duration: 200 });
            overlayOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    const menuStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: overlayOpacity.value,
    }));

    const handleNavigate = (route: string) => {
        onClose();
        setTimeout(() => {
            router.push(route as any);
        }, 100);
    };

    const handleLogout = async () => {
        onClose();
        await clearAuth();
        router.replace('/(auth)/login');
    };

    const initials = user?.name?.substring(0, 2).toUpperCase() || 'U';

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Overlay */}
                <Animated.View style={[styles.overlay, overlayStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>

                {/* Menu Panel */}
                <Animated.View style={[styles.menu, menuStyle]}>
                    {/* User Profile Section */}
                    <View style={styles.profileSection}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                        <Text style={styles.userName}>{user?.name || 'Gebruiker'}</Text>
                        <Text style={styles.userEmail}>{user?.email || ''}</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>
                                {user?.role === 'ADMIN' ? 'Administrator' :
                                    user?.role === 'MANAGER' ? 'Manager' :
                                        user?.role === 'SHIFTLEADER' ? 'Shiftleader' :
                                            'Medewerker'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Menu Items */}
                    <View style={styles.menuItems}>
                        {menuItems.map((item, index) => (
                            <TouchableOpacity
                                key={item.route}
                                style={styles.menuItem}
                                onPress={() => handleNavigate(item.route)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.menuIconContainer}>
                                    <FeatherIcon name={item.icon} size={20} color="#4B5563" />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                                <FeatherIcon name="chevron-right" size={16} color="#D1D5DB" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            style={styles.logoutItem}
                            onPress={handleLogout}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.menuIconContainer, styles.logoutIcon]}>
                                <FeatherIcon name="log-out" size={20} color="#DC2626" />
                            </View>
                            <Text style={styles.logoutLabel}>Uitloggen</Text>
                        </TouchableOpacity>

                        <Text style={styles.version}>Foodworks Mobile v1.0.0</Text>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    menu: {
        width: MENU_WIDTH,
        height: '100%',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        justifyContent: 'flex-start',
    },
    profileSection: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 24,
        backgroundColor: '#F0F5FF',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    userEmail: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    roleBadge: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#3B82F6',
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    roleText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginHorizontal: 16,
    },
    menuItems: {
        flex: 1,
        paddingTop: 8,
        paddingHorizontal: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    menuIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: '#374151',
    },
    footer: {
        paddingBottom: 40,
        paddingHorizontal: 12,
    },
    logoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginTop: 8,
    },
    logoutIcon: {
        backgroundColor: '#FEE2E2',
    },
    logoutLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: '#DC2626',
    },
    version: {
        fontSize: 11,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 16,
    },
});

import {
    Project,
    Task,
    Customer,
    Notification,
} from '@foodworks/shared-types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://foodworks-backend-production.up.railway.app/api';

async function getAuthToken(): Promise<string | null> {
    const SecureStore = await import('expo-secure-store');
    const token = await SecureStore.getItemAsync('auth_token');
    console.log('Auth token from SecureStore:', token ? 'TOKEN EXISTS' : 'NO TOKEN');
    return token;
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('Making authenticated request to:', endpoint);
    } else {
        console.warn('NO AUTH TOKEN - Making unauthenticated request to:', endpoint);
    }

    console.log('Request headers:', Object.keys(headers));

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        console.error('API Error:', error);
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {};
    }

    const data = await response.json();
    console.log('Response data length:', Array.isArray(data) ? data.length : 'not an array');
    return data;
}

export const directApi = {
    projects: {
        async getAll(): Promise<Project[]> {
            return fetchWithAuth('/projects');
        },
        async getById(id: string): Promise<Project> {
            return fetchWithAuth(`/projects/${id}`);
        },
        async create(data: any): Promise<Project> {
            return fetchWithAuth('/projects', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
        async update(id: string, data: any): Promise<Project> {
            return fetchWithAuth(`/projects/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },
        async delete(id: string): Promise<void> {
            return fetchWithAuth(`/projects/${id}`, {
                method: 'DELETE',
            });
        },
        async getByCustomer(customerId: string): Promise<any[]> {
            return fetchWithAuth(`/projects?customerId=${customerId}`);
        },
    },

    tasks: {
        async getAll(params?: any): Promise<Task[]> {
            const query = params ? `?${new URLSearchParams(params).toString()}` : '';
            return fetchWithAuth(`/tasks${query}`);
        },
        async getById(id: string): Promise<Task> {
            return fetchWithAuth(`/tasks/${id}`);
        },
        async create(data: any): Promise<Task> {
            return fetchWithAuth('/tasks', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
        async update(data: any): Promise<Task> {
            const { id, ...updateData } = data;
            return fetchWithAuth(`/tasks/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updateData),
            });
        },
        async delete(id: string): Promise<void> {
            return fetchWithAuth(`/tasks/${id}`, {
                method: 'DELETE',
            });
        },
    },

    customers: {
        async getAll(): Promise<Customer[]> {
            return fetchWithAuth('/customers');
        },
        async getById(id: string): Promise<Customer> {
            return fetchWithAuth(`/customers/${id}`);
        },
        async create(data: any): Promise<Customer> {
            return fetchWithAuth('/customers', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
        async update(id: string, data: any): Promise<Customer> {
            return fetchWithAuth(`/customers/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },
        async delete(id: string): Promise<void> {
            return fetchWithAuth(`/customers/${id}`, {
                method: 'DELETE',
            });
        },
    },

    notifications: {
        async getAll(): Promise<Notification[]> {
            return fetchWithAuth('/notifications');
        },
        async markAsRead(id: string): Promise<void> {
            return fetchWithAuth(`/notifications/${id}/read`, {
                method: 'PATCH',
            });
        },
        async markAllAsRead(): Promise<void> {
            return fetchWithAuth('/notifications/read-all', {
                method: 'PATCH',
            });
        },
    },

    revenues: {
        async create(data: {
            projectId: string;
            amount: number;
            vatRate: number;
            description?: string;
            date: string;
            endDate?: string;
        }): Promise<any> {
            return fetchWithAuth('/revenues', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
        async getByProject(projectId: string): Promise<any[]> {
            return fetchWithAuth(`/revenues?projectId=${projectId}`);
        },
        async delete(id: string): Promise<void> {
            return fetchWithAuth(`/revenues/${id}`, {
                method: 'DELETE',
            });
        },
    },

    users: {
        async getAll(): Promise<any[]> {
            return fetchWithAuth('/users');
        },
    },

    stock: {
        async getAll(locationId?: string): Promise<any> {
            const q = locationId ? `?locationId=${locationId}` : '';
            return fetchWithAuth(`/stock${q}`);
        },
        async count(itemId: string, quantity: number, notes?: string): Promise<any> {
            return fetchWithAuth('/stock/count', {
                method: 'POST',
                body: JSON.stringify({ itemId, quantity, notes }),
            });
        },
        async adjust(itemId: string, adjustment: number, reason?: string): Promise<any> {
            return fetchWithAuth('/stock/adjust', {
                method: 'POST',
                body: JSON.stringify({ itemId, adjustment, reason }),
            });
        },
    },

    locations: {
        async getAll(): Promise<any[]> {
            return fetchWithAuth('/locations');
        },
    },

    products: {
        async getAll(): Promise<any[]> {
            const data = await fetchWithAuth('/products');
            return Array.isArray(data) ? data : (data?.products ?? []);
        },
        async getByBarcode(barcode: string): Promise<any> {
            return fetchWithAuth(`/products/barcode/${encodeURIComponent(barcode)}`);
        },
    },

    stockAllocations: {
        async getAllocations(projectId: string): Promise<any> {
            return fetchWithAuth(`/projects/${projectId}/stock/allocations`);
        },
        async plan(projectId: string, items: { productId: string; plannedQuantity: number }[]): Promise<any> {
            return fetchWithAuth(`/projects/${projectId}/stock/plan`, {
                method: 'POST',
                body: JSON.stringify({ items }),
            });
        },
        async load(projectId: string, items: { productId: string; quantity: number }[], userId?: string): Promise<any> {
            return fetchWithAuth(`/projects/${projectId}/stock/load`, {
                method: 'POST',
                body: JSON.stringify({ items, userId }),
            });
        },
        async closeout(projectId: string, items: { allocationId: string; remainingQuantity: number; disposition: 'RETURN' | 'WASTE' }[]): Promise<any> {
            return fetchWithAuth(`/projects/${projectId}/closeout`, {
                method: 'POST',
                body: JSON.stringify({ items }),
            });
        },
    },

    receipts: {
        async create(data: {
            locationId: string;
            items: Array<{
                productId: string;
                quantity: number;
                unitCost?: number;
                batchNumber?: string;
                expiryDate?: string;
                notes?: string;
            }>;
            supplierId?: string;
        }): Promise<any> {
            return fetchWithAuth('/receipts', {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
    },

    transport: {
        async getDriverDayPlan(driverId: string, date: string): Promise<any> {
            return fetchWithAuth(`/transport/driver-plan?driverId=${driverId}&date=${date}`);
        },
    },

    ritten: {
        async getMijnRitten(params?: { from?: string; to?: string }): Promise<any[]> {
            const q = params ? `?${new URLSearchParams(Object.fromEntries(
                Object.entries(params).filter(([, v]) => v != null) as [string, string][]
            )).toString()}` : '';
            return fetchWithAuth(`/vehicle-assignments${q}`);
        },
        async getById(id: string): Promise<any> {
            return fetchWithAuth(`/vehicle-assignments/${id}`);
        },
        async updateStatus(id: string, status: string): Promise<any> {
            return fetchWithAuth(`/vehicle-assignments/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
        },
        async addMileage(ritId: string, data: { startKm: number; endKm: number; purpose: 'ZAKELIJK' | 'WOON_WERK'; notes?: string }): Promise<any> {
            return fetchWithAuth(`/vehicle-assignments/${ritId}/mileage`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },
    },
};
